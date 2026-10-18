import type { EventSource, EventType, Prisma, Routine, RoutineOccurrence, RoutineType } from '@prisma/client';
import { prisma } from '../lib/db.js';
import { enqueueOutbound } from '../lib/queues.js';
import type { Button, SessionMessage } from '../whatsapp/types.js';
import type { OutboundJob } from '../whatsapp/outbound.js';
import { DateTime } from 'luxon';
import { notifyChild } from '../care/notify.js';
import { redFlags } from '../care/redflags.js';
import { canonicalSymptom, isGenericSymptom } from './symptoms.js';
import { payload, text } from './copy.js';
import type { Finding } from './findings.js';
import { llmEnabled, understandWithLlm } from './llm.js';
import { consentAnswer, isEmergencyRequest, isStopRequest, parseWithRules } from './rules.js';

type Pending = RoutineOccurrence & { routine: Routine };
type Tx = Prisma.TransactionClient;

/**
 * Handle one inbound parent message: work out what it refers to, store the facts, reply.
 * Understanding happens first (rules, then the model if needed); all writes then run in one transaction.
 */
export async function processInbound(messageId: string) {
  const msg = await prisma.message.findUnique({ where: { id: messageId }, include: { parent: { include: { user: true } } } });
  if (!msg?.parent || msg.direction !== 'IN' || msg.handledBy) return; // unknown sender, or already handled on a retry
  const parent = msg.parent;
  const childName = parent.user.name;
  const outbox: OutboundJob[] = [];
  const reply = (session: SessionMessage) => outbox.push({ parentId: parent.id, toPhone: parent.phone, session });

  const markHandled = (tx: Tx, handledBy: string) => tx.message.update({ where: { id: msg.id }, data: { handledBy } });

  // 1. Emergency: explicit button or a message that is only "HELP". Works even before consent.
  if (msg.payload === payload.emergency || isEmergencyRequest(msg.body)) {
    const alert = await prisma.$transaction(async (tx) => {
      const a = await tx.alert.create({ data: { parentId: parent.id, kind: 'EMERGENCY', messageId: msg.id } });
      await markHandled(tx, 'RULES');
      return a;
    });
    await notifyChild({
      parentId: parent.id,
      kind: 'HELP',
      title: `🚨 ${parent.name} sent HELP`,
      body: `Please call them now: +${parent.phone}`,
      dedupeKey: `help:${alert.id}`,
    });
    reply({ text: text.emergency(childName, parent.emergencyNumber) });
    return flush(outbox);
  }

  // 2. Consent: nothing else happens until the parent has said yes.
  const consentTap = msg.payload?.startsWith('consent:') ? (msg.payload.slice(8) as 'yes' | 'no') : null;
  if (parent.consentStatus !== 'GRANTED' || consentTap) {
    const answer = consentTap ?? consentAnswer(msg.body);
    await prisma.$transaction(async (tx) => {
      if (answer === 'yes') await tx.parentProfile.update({ where: { id: parent.id }, data: { consentStatus: 'GRANTED', consentAt: new Date() } });
      if (answer === 'no' && parent.consentStatus !== 'GRANTED') await tx.parentProfile.update({ where: { id: parent.id }, data: { consentStatus: 'DECLINED' } });
      await markHandled(tx, consentTap ? 'BUTTON' : 'RULES');
    });
    if (answer === 'yes' && parent.consentStatus !== 'GRANTED') reply({ text: text.welcome(childName) });
    else if (answer === 'no' && parent.consentStatus !== 'GRANTED') reply({ text: text.declined });
    else if (parent.consentStatus === 'PENDING') reply({ text: text.askConsentAgain });
    return flush(outbox);
  }

  if (isStopRequest(msg.body)) {
    await prisma.$transaction(async (tx) => {
      await tx.parentProfile.update({ where: { id: parent.id }, data: { consentStatus: 'REVOKED' } });
      await tx.routineOccurrence.updateMany({ where: { parentId: parent.id, status: { in: ['SCHEDULED', 'SENT'] } }, data: { status: 'NO_RESPONSE' } });
      await markHandled(tx, 'RULES');
    });
    reply({ text: text.stopped });
    return flush(outbox);
  }

  // 3. Understand. Buttons are unambiguous; text goes rules-first, model only when rules aren't sure.
  // Open questions: unanswered reminders, plus "not yet" answers we've since followed up on.
  const pending: Pending[] = await prisma.routineOccurrence.findMany({
    where: { parentId: parent.id, OR: [{ status: 'SENT' }, { status: 'NOT_DONE', followUpAt: { not: null } }] },
    include: { routine: true },
    orderBy: { scheduledFor: 'desc' },
  });

  let findings: Finding[];
  let source: EventSource;
  let modelRan = false;
  let buttonTarget: Pending | undefined;

  const tap = msg.payload?.match(/^(occ|wb):([^:]+):(\w+)$/);
  if (tap) {
    const occ = await prisma.routineOccurrence.findFirst({ where: { id: tap[2], parentId: parent.id }, include: { routine: true } });
    if (!occ) return prisma.message.update({ where: { id: msg.id }, data: { handledBy: 'NONE' } });
    buttonTarget = occ;
    findings = tap[1] === 'wb'
      ? [{ kind: 'wellbeing', level: tap[3] as 'good' | 'okay' | 'low' }]
      : [{ kind: 'confirm', done: tap[3] === 'done', routine: occ.routine.type }];
    source = 'BUTTON';
  } else {
    const rules = parseWithRules(msg.body, pending.map((p) => p.routine.type));
    findings = rules.findings;
    source = 'RULES';
    if (!rules.confident && llmEnabled()) {
      const llm = await understandWithLlm(msg.body, pending.map((p) => ({ type: p.routine.type, name: p.routine.name })));
      if (llm) {
        modelRan = true;
        // A model that sees nothing doesn't overrule rules that saw something.
        if (llm.length || !rules.findings.length) {
          findings = llm;
          source = 'LLM';
        }
      }
    }
  }

  // One name per symptom; if the model only said "pain" but rules saw "knee pain", keep the specific one.
  const ruleSymptoms = tap ? [] : parseWithRules(msg.body).findings.filter((f) => f.kind === 'symptom').map((f) => (f as { name: string }).name);
  findings = findings.map((f) => {
    if (f.kind !== 'symptom') return f;
    const name = canonicalSymptom(f.name);
    return { ...f, name: isGenericSymptom(name) && ruleSymptoms.length && !isGenericSymptom(ruleSymptoms[0]) ? ruleSymptoms[0] : name };
  });

  // 4. Store and decide the reply.
  const result = await prisma.$transaction(async (tx) => {
    const r = await applyFindings(tx, {
      parentId: parent.id,
      childName,
      messageId: msg.id,
      at: msg.createdAt,
      source,
      pending: buttonTarget ? [buttonTarget] : pending,
      findings,
    });
    await markHandled(tx, findings.length ? source : 'NONE');
    return r;
  });

  const clock = (d: Date) => DateTime.fromJSDate(d).setZone(parent.timezone).toFormat('h:mm a');

  // Anything they say about how they feel physically reaches the child promptly, in their own
  // words. Serious signs (fixed word list, no AI) always go to WhatsApp and remind the parent
  // that HELP and the emergency number are there. Nothing here diagnoses or declares an emergency.
  const symptoms = findings.filter((f): f is Extract<Finding, { kind: 'symptom' }> => f.kind === 'symptom').map((f) => f.name);
  const flags = [...new Set([...redFlags(msg.body), ...symptoms.flatMap(redFlags)])];
  const today = DateTime.fromJSDate(msg.createdAt).setZone(parent.timezone).toISODate();
  const quote = `“${msg.body.length > 160 ? `${msg.body.slice(0, 157)}…` : msg.body}”`;
  if (flags.length) {
    await notifyChild({
      parentId: parent.id,
      kind: 'SYMPTOM',
      urgent: true,
      title: `${parent.name} mentioned ${flags.join(' and ')}`,
      body: `At ${clock(msg.createdAt)}: ${quote} Please call them.`,
      dedupeKey: `redflag:${msg.id}`,
    });
  } else {
    for (const name of new Set(symptoms)) {
      await notifyChild({
        parentId: parent.id,
        kind: 'SYMPTOM',
        title: `${parent.name} mentioned ${name}`,
        body: `At ${clock(msg.createdAt)}: ${quote}`,
        dedupeKey: `symptom:${parent.id}:${name}:${today}`,
      });
    }
  }

  // The child was told this wasn't done: let them know it's sorted.
  for (const occ of result.resolved) {
    await notifyChild({
      parentId: parent.id,
      kind: 'RESOLVED',
      title: `Update: ${parent.name} ${occ.routine.type === 'MEDICINE' || occ.routine.type === 'WALK' ? 'confirmed' : 'sent'} ${occ.routine.name}`,
      body: `At ${clock(msg.createdAt)}.`,
      dedupeKey: `resolved:${occ.id}`,
      routineId: occ.routineId,
      occurrenceId: occ.id,
    });
  }

  // A serious mention gets one clear reply instead of the usual "noted" for symptoms.
  const acks = flags.length ? result.acks.filter((a) => !a.startsWith(text.symptomAck(''))) : result.acks;
  const safety = flags.length ? [text.redFlag(childName, parent.emergencyNumber)] : [];
  if (result.clarify) reply({ text: [...acks, ...safety, text.clarify].join(' '), buttons: result.clarify });
  else if (acks.length || safety.length) reply({ text: [...new Set(acks), ...safety].join(' ') });
  else reply({ text: modelRan ? '❤️' : text.notUnderstood });
  return flush(outbox);
}

async function flush(outbox: OutboundJob[]) {
  for (const job of outbox) await enqueueOutbound(job);
}

interface ApplyContext {
  parentId: string;
  childName: string;
  messageId: string;
  at: Date;
  source: EventSource;
  pending: Pending[];
  findings: Finding[];
}

async function applyFindings(tx: Tx, ctx: ApplyContext): Promise<{ acks: string[]; clarify?: Button[]; resolved: Pending[] }> {
  const acks: string[] = [];
  const resolved: Pending[] = [];
  const used = new Set<string>();
  let clarify: Button[] | undefined;

  const unused = () => ctx.pending.filter((p) => !used.has(p.id));
  const resolve = async (type: RoutineType, done: boolean, note?: string) => {
    let occ: Pending | null | undefined = unused().find((p) => p.routine.type === type);
    // A reading sent before its reminder answers today's question, so don't ask later.
    // Water is a running total and keeps its evening check.
    if (!occ && done && (type === 'BP' || type === 'SUGAR' || type === 'WELLBEING')) {
      occ = await tx.routineOccurrence.findFirst({
        where: { parentId: ctx.parentId, status: 'SCHEDULED', routine: { type } },
        include: { routine: true },
      });
    }
    if (!occ) return undefined;
    used.add(occ.id);
    await tx.routineOccurrence.update({
      where: { id: occ.id },
      data: { status: done ? 'DONE' : 'NOT_DONE', respondedAt: ctx.at, note: note ?? null },
    });
    if (done && occ.childAlertedAt) resolved.push(occ);
    return occ;
  };
  const event = (type: EventType, data: Partial<Prisma.HealthEventUncheckedCreateInput>, occurrenceId?: string) =>
    tx.healthEvent.create({
      data: { parentId: ctx.parentId, type, occurredAt: ctx.at, source: ctx.source, messageId: ctx.messageId, occurrenceId, ...data },
    });

  for (const f of ctx.findings) {
    switch (f.kind) {
      case 'bp': {
        const occ = await resolve('BP', true);
        await event('BP', { valueNum: f.systolic, valueNum2: f.diastolic, unit: 'mmHg' }, occ?.id);
        acks.push(`BP ${f.systolic}/${f.diastolic} note kar liya ❤️`);
        break;
      }
      case 'sugar': {
        const occ = await resolve('SUGAR', true);
        await event('SUGAR', { valueNum: f.value, unit: 'mg/dL', context: f.context }, occ?.id);
        acks.push(`Sugar ${f.value} note kar li ❤️`);
        break;
      }
      case 'water': {
        const occ = await resolve('WATER', true);
        await event('WATER', { valueNum: f.glasses, unit: 'glasses' }, occ?.id);
        const target = occ?.routine.target;
        acks.push(target && f.glasses >= target ? `${f.glasses} glass, shabash! 🌟` : `${f.glasses} glass paani 👍`);
        break;
      }
      case 'weight':
        await event('WEIGHT', { valueNum: f.kg, unit: 'kg' });
        acks.push(`Weight ${f.kg} kg note kar liya ❤️`);
        break;
      case 'wellbeing': {
        const occ = await resolve('WELLBEING', true);
        await event('WELLBEING', { valueText: f.level }, occ?.id);
        acks.push(f.level === 'good' ? 'Sunke achha laga 😊' : `Dhyan rakhiye ❤️ ${ctx.childName} ko bhi dikh jayega.`);
        break;
      }
      case 'symptom':
        await event('SYMPTOM', { valueText: f.name, context: f.since });
        acks.push(text.symptomAck(ctx.childName));
        break;
      case 'confirm': {
        const candidates = unused().filter((p) => !f.routine || p.routine.type === f.routine);
        if (candidates.length > 1 && !f.routine) {
          // Several questions are open and the reply doesn't say which: ask, don't guess.
          clarify = candidates.slice(0, 3).map((p) => ({
            id: payload.occurrence(p.id, f.done ? 'done' : 'not_done'),
            title: p.routine.name.slice(0, 20),
          }));
          break;
        }
        const type = f.routine ?? candidates[0]?.routine.type;
        const occ = type ? await resolve(type, f.done, f.note) : undefined;
        if (type === 'MEDICINE' || type === 'WALK') {
          await event(type, { valueText: f.done ? 'done' : 'not done', context: f.note }, occ?.id);
        }
        if (type) acks.push(f.done ? 'Shabash! ❤️' : 'Koi baat nahi, jab ho jaye tab bata dijiye ❤️');
        else acks.push(text.noted);
        break;
      }
    }
  }
  return { acks, clarify, resolved };
}
