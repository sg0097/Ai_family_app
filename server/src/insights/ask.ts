import { DateTime } from 'luxon';
import { llmEnabled, ollamaChat } from '../conversation/llm.js';
import { prisma } from '../lib/db.js';
import { isGrounded } from './grounding.js';
import { fmtEvent } from './index.js';
import { describeSchedule } from '../routines/schedule.js';

// Child questions: retrieve the actual records first, then let the model phrase an answer from
// those facts only. Without a model the facts themselves are the answer.

const FACT_DAYS = 30;

export async function buildFacts(parentId: string): Promise<string[]> {
  const parent = await prisma.parentProfile.findUniqueOrThrow({ where: { id: parentId }, include: { routines: true } });
  const zone = parent.timezone;
  const now = DateTime.now().setZone(zone);
  const since = now.minus({ days: FACT_DAYS }).startOf('day');
  const fmtDay = (d: Date | string) => (typeof d === 'string' ? DateTime.fromISO(d, { zone }) : DateTime.fromJSDate(d).setZone(zone)).toFormat('ccc d LLL');
  const fmtWhen = (d: Date) => DateTime.fromJSDate(d).setZone(zone).toFormat("ccc d LLL, h:mm a");

  const [events, occurrences, alerts, lastIn] = await Promise.all([
    prisma.healthEvent.findMany({ where: { parentId, occurredAt: { gte: since.toJSDate() } }, orderBy: { occurredAt: 'asc' } }),
    prisma.routineOccurrence.findMany({ where: { parentId, localDate: { gte: since.toISODate()! } }, orderBy: { localDate: 'asc' } }),
    prisma.alert.findMany({ where: { parentId, createdAt: { gte: since.toJSDate() } } }),
    prisma.message.findFirst({ where: { parentId, direction: 'IN' }, orderBy: { createdAt: 'desc' } }),
  ]);

  const weekStart = now.minus({ days: 6 }).startOf('day');
  const prevStart = now.minus({ days: 13 }).startOf('day');
  const facts: string[] = [
    `Today is ${now.toFormat('cccc d LLLL yyyy')}, ${now.toFormat('h:mm a')}. ${parent.name} is the user's ${parent.relationship.toLowerCase()}. "This week" means ${fmtDay(weekStart.toJSDate())} to today; "last week" means ${fmtDay(prevStart.toJSDate())} to ${fmtDay(weekStart.minus({ days: 1 }).toJSDate())}.`,
    lastIn ? `${parent.name}'s most recent WhatsApp message was at ${fmtWhen(lastIn.createdAt)}.` : `${parent.name} has not sent any messages yet.`,
  ];

  const TODAY_STATUS: Record<string, string> = {
    DONE: 'confirmed',
    NOT_DONE: 'said "not yet"',
    NO_RESPONSE: 'no reply',
    SENT: 'reminder sent, still waiting for a reply (not done as far as we know)',
    SCHEDULED: 'reminder not sent yet',
  };
  for (const r of parent.routines.filter((x) => x.active)) {
    const list = occurrences.filter((o) => o.routineId === r.id);
    if (!list.length) {
      facts.push(`Routine "${r.name}" (${r.type.toLowerCase()}, ${r.timeOfDay}) has no history yet.`);
      continue;
    }
    const summarize = (from: DateTime, to: DateTime) => {
      const w = list.filter((o) => o.localDate >= from.toISODate()! && o.localDate <= to.toISODate()!);
      const days = (status: string) => w.filter((o) => o.status === status).map((o) => fmtDay(o.localDate));
      const notYet = days('NOT_DONE');
      const silent = days('NO_RESPONSE');
      return (
        `confirmed on ${days('DONE').length} day(s)` +
        `; said "not yet" on ${notYet.length ? notYet.join(', ') : 'no days'}` +
        `; no reply (unknown, not a missed dose) on ${silent.length ? silent.join(', ') : 'no days'}`
      );
    };
    const todayOcc = list.find((o) => o.localDate === now.toISODate());
    facts.push(
      `Routine "${r.name}" (${r.type.toLowerCase()}, ${describeSchedule(r).toLowerCase()} at ${r.timeOfDay}). This week: ${summarize(weekStart, now)}. Last week: ${summarize(prevStart, weekStart.minus({ days: 1 }))}. ` +
        `Today: ${todayOcc ? TODAY_STATUS[todayOcc.status] + (todayOcc.note ? ` (${todayOcc.note})` : '') : 'not scheduled today'}.`,
    );
  }

  for (const [type, label] of [['BP', 'blood pressure'], ['SUGAR', 'blood sugar'], ['WEIGHT', 'weight']] as const) {
    const list = events.filter((e) => e.type === type);
    if (!list.length) {
      facts.push(`No ${label} readings recorded in the last ${FACT_DAYS} days.`);
      continue;
    }
    const last = list[list.length - 1];
    const thisWeek = list.filter((e) => e.occurredAt >= weekStart.toJSDate());
    facts.push(`Most recent ${label} reading: ${fmtEvent(last)} on ${fmtWhen(last.occurredAt)}. ${thisWeek.length} ${label} reading(s) this week.`);
    facts.push(`All ${label} readings, oldest first: ${list.map((e) => `${fmtDay(e.occurredAt)} ${fmtEvent(e)}`).join('; ')}.`);
  }

  const water = new Map<string, number>();
  for (const e of events.filter((x) => x.type === 'WATER')) water.set(fmtDay(e.occurredAt), Math.max(water.get(fmtDay(e.occurredAt)) ?? 0, e.valueNum ?? 0));
  if (water.size) facts.push(`Glasses of water reported per day: ${[...water].map(([d, g]) => `${d} ${g}`).join('; ')}.`);

  const feel = events.filter((e) => e.type === 'WELLBEING');
  if (feel.length) facts.push(`How ${parent.name} said they felt: ${feel.map((e) => `${fmtDay(e.occurredAt)} ${e.valueText}`).join('; ')}.`);

  const symptoms = events.filter((e) => e.type === 'SYMPTOM');
  facts.push(
    symptoms.length
      ? `Symptoms mentioned: ${symptoms.map((e) => `${fmtDay(e.occurredAt)} ${e.valueText}${e.context ? ` (${e.context})` : ''}`).join('; ')}.`
      : 'No symptoms mentioned in the last 30 days.',
  );
  if (alerts.length) facts.push(`HELP was sent on: ${alerts.map((a) => fmtWhen(a.createdAt)).join(', ')}.`);
  // Patterns the family chose to keep, each already backed by stored messages.
  const kept = await prisma.memory.findMany({ where: { parentId, status: 'KEPT' } });
  for (const m of kept) facts.push(`The family noted: ${m.text}.`);
  return facts;
}

const SYSTEM = `You help an adult child understand how their parent has been doing, using ONLY the facts provided.
Rules:
- Answer only from the facts. If they don't contain the answer, say it hasn't been recorded.
- "No reply" means the parent didn't answer; it is unknown, never a missed dose. Say so plainly.
- Never diagnose. Never call a reading normal, high, low, fine, safe, dangerous or worrying, not even "not dangerous". Never suggest changing medicine. If asked whether something is concerning, list what was recorded and suggest they discuss it with the parent's doctor.
- Use symptom names exactly as written in the facts; never reword or translate them.
- A routine whose reminder is waiting for a reply is NOT done; don't say it was completed.
- Only use dates that appear in the facts for the period being asked about.
- Saying "not yet" is what the parent reported; describe it as that, never as "no missed doses" and never as a confirmed miss.
- Be warm, specific and short: 2-4 sentences, plain English, include dates and numbers from the facts.
- Refer to the parent by name: {NAME}.`;

export async function askAboutParent(parentId: string, question: string) {
  const parent = await prisma.parentProfile.findUniqueOrThrow({ where: { id: parentId } });
  const facts = await buildFacts(parentId);
  if (llmEnabled()) {
    try {
      const answer = (
        await ollamaChat([
          { role: 'system', content: SYSTEM.replace('{NAME}', parent.name) },
          { role: 'user', content: `Facts:\n- ${facts.join('\n- ')}\n\nQuestion: ${question}` },
        ])
      ).trim();
      if (answer && isGrounded(answer, facts)) return { answer, facts, usedModel: true };
      // Don't log the answer itself: it contains health details.
      console.warn('[ask] answer failed the grounding check; showing records instead');
    } catch (err) {
      console.warn('[ask] model unavailable:', (err as Error).message);
    }
  }
  return { answer: "I couldn't write a summary I'm confident in, so here is exactly what's on record for the last 30 days.", facts, usedModel: false };
}
