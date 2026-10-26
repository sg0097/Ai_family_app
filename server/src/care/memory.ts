import type { Prisma } from '@prisma/client';
import { DateTime } from 'luxon';
import { prisma } from '../lib/db.js';

// Long-term memory: patterns across weeks of messages that are easy to lose in a chat.
// Deterministic and evidence-first: every memory carries the messages it came from, starts as
// a suggestion, and only the family can keep it. Nothing here interprets a reading or diagnoses.

const LOOKBACK_DAYS = 30;
const MIN_DAYS = 3; // a pattern needs at least this many separate days
const MAX_EVIDENCE = 5;

interface Evidence {
  at: string;
  quote: string;
}
interface Found {
  key: string;
  kind: 'HEALTH' | 'HABIT' | 'PREFERENCE';
  text: string;
  evidence: Evidence[];
}

function groupBy<T>(items: T[], key: (t: T) => string) {
  const out = new Map<string, T[]>();
  for (const item of items) out.set(key(item), [...(out.get(key(item)) ?? []), item]);
  return out;
}

const quote = (s: string) => (s.length > 120 ? `${s.slice(0, 117)}…` : s);

export async function findPatterns(parentId: string, now = DateTime.utc()): Promise<Found[]> {
  const parent = await prisma.parentProfile.findUniqueOrThrow({ where: { id: parentId } });
  const zone = parent.timezone;
  const since = now.minus({ days: LOOKBACK_DAYS }).toJSDate();
  const day = (d: Date) => DateTime.fromJSDate(d).setZone(zone).toISODate()!;
  const found: Found[] = [];

  // 1. The same symptom mentioned on several different days.
  const symptoms = await prisma.healthEvent.findMany({
    where: { parentId, type: 'SYMPTOM', occurredAt: { gte: since } },
    include: { message: true },
    orderBy: { occurredAt: 'desc' },
  });
  const bySymptom = groupBy(symptoms, (e) => e.valueText ?? '');
  for (const [name, events] of bySymptom) {
    const days = new Set(events.map((e) => day(e.occurredAt)));
    if (!name || days.size < MIN_DAYS) continue;
    found.push({
      key: `symptom:${name}`,
      kind: 'HEALTH',
      text: `Has mentioned ${name} on ${days.size} different days in the last month`,
      evidence: events.slice(0, MAX_EVIDENCE).map((e) => ({ at: e.occurredAt.toISOString(), quote: quote(e.message?.body ?? name) })),
    });
  }

  // 2. Not feeling good on several days.
  const low = await prisma.healthEvent.findMany({
    where: { parentId, type: 'WELLBEING', valueText: 'low', occurredAt: { gte: since } },
    include: { message: true },
    orderBy: { occurredAt: 'desc' },
  });
  const lowDays = new Set(low.map((e) => day(e.occurredAt)));
  if (lowDays.size >= MIN_DAYS) {
    found.push({
      key: 'wellbeing:low',
      kind: 'HEALTH',
      text: `Said they weren’t feeling good on ${lowDays.size} days in the last month`,
      evidence: low.slice(0, MAX_EVIDENCE).map((e) => ({ at: e.occurredAt.toISOString(), quote: quote(e.message?.body ?? 'Not feeling good') })),
    });
  }

  // 3. The same words with a routine, again and again ("after breakfast").
  const answered = await prisma.routineOccurrence.findMany({
    where: { parentId, status: 'DONE', respondedAt: { gte: since } },
    include: { routine: true },
    orderBy: { respondedAt: 'desc' },
  });
  const byNote = groupBy(answered.filter((o) => o.note), (o) => `${o.routineId}|${o.note!.toLowerCase()}`);
  for (const [k, occs] of byNote) {
    if (occs.length < MIN_DAYS) continue;
    const o = occs[0];
    found.push({
      key: `note:${k}`,
      kind: 'PREFERENCE',
      text: `Usually takes ${o.routine.name} ${o.note!.toLowerCase()}`,
      evidence: occs.slice(0, MAX_EVIDENCE).map((x) => ({ at: x.respondedAt!.toISOString(), quote: `“${x.note}”` })),
    });
  }

  // 4. When they usually confirm each routine: a good time to call, or to move the reminder.
  for (const [routineId, occs] of groupBy(answered, (o) => o.routineId)) {
    if (occs.length < 5) continue;
    const minutes = occs
      .map((o) => DateTime.fromJSDate(o.respondedAt!).setZone(zone))
      .map((d) => d.hour * 60 + d.minute)
      .sort((a, b) => a - b);
    const median = minutes[Math.floor(minutes.length / 2)];
    const at = DateTime.fromObject({ hour: Math.floor(median / 60), minute: Math.round((median % 60) / 5) * 5 % 60 }, { zone });
    const [h, m] = occs[0].routine.timeOfDay.split(':').map(Number);
    if (Math.abs(median - (h * 60 + m)) < 45) continue; // replies come soon after the reminder: nothing to learn
    found.push({
      key: `reply:${routineId}`,
      kind: 'HABIT',
      text: `Usually replies about ${occs[0].routine.name} around ${at.toFormat('h:mm a')}; the reminder goes at ${DateTime.fromObject({ hour: h, minute: m }).toFormat('h:mm a')}`,
      evidence: occs.slice(0, MAX_EVIDENCE).map((o) => ({ at: o.respondedAt!.toISOString(), quote: `Confirmed at ${DateTime.fromJSDate(o.respondedAt!).setZone(zone).toFormat('h:mm a')}` })),
    });
  }
  return found;
}

/** Store new patterns as suggestions and refresh the evidence on known ones. Dismissed ones stay dismissed. */
export async function refreshMemory(parentId: string, now = DateTime.utc()) {
  for (const f of await findPatterns(parentId, now)) {
    const evidence = f.evidence as unknown as Prisma.InputJsonValue;
    await prisma.memory.upsert({
      where: { parentId_key: { parentId, key: f.key } },
      create: { parentId, key: f.key, kind: f.kind, text: f.text, evidence },
      update: { text: f.text, evidence },
    });
  }
}
