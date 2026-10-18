import type { HealthEvent, OccurrenceStatus, RoutineType } from '@prisma/client';
import { DateTime } from 'luxon';
import { prisma } from '../lib/db.js';
import { describeSchedule, expectedGapDays, isDueOn, nextDueDate } from '../routines/schedule.js';

// Deterministic insights from the database. Wording stays neutral: missing data is reported as
// "not updated", never as a problem, and no reading is ever interpreted.

// A reading is overdue once two days pass beyond its normal gap (3 days for a daily check).
const GRACE_DAYS = 2;
const MEASURED: RoutineType[] = ['BP', 'SUGAR', 'WATER', 'WELLBEING'];

const STATUS_LABEL: Record<OccurrenceStatus, string> = {
  SCHEDULED: 'upcoming',
  SENT: 'waiting',
  DONE: 'done',
  NOT_DONE: 'not_done',
  NO_RESPONSE: 'no_response',
};

export const fmtEvent = (e: HealthEvent): string => {
  switch (e.type) {
    case 'BP':
      return `${e.valueNum}/${e.valueNum2}`;
    case 'SUGAR':
      return `${e.valueNum} mg/dL${e.context ? ` (${e.context})` : ''}`;
    case 'WATER':
      return `${e.valueNum} glasses`;
    case 'WEIGHT':
      return `${e.valueNum} kg`;
    default:
      return e.valueText ?? '';
  }
};

/** What happened today, what's missing, and what needs attention. */
export async function todayView(parentId: string) {
  const parent = await prisma.parentProfile.findUniqueOrThrow({ where: { id: parentId }, include: { routines: { where: { active: true }, orderBy: { timeOfDay: 'asc' } } } });
  const zone = parent.timezone;
  const now = DateTime.now().setZone(zone);
  const today = now.toISODate()!;
  const weekAgo = now.minus({ days: 7 }).startOf('day').toJSDate();

  const [occurrences, recentEvents, alerts, urgent] = await Promise.all([
    prisma.routineOccurrence.findMany({ where: { parentId, localDate: today } }),
    prisma.healthEvent.findMany({ where: { parentId, occurredAt: { gte: weekAgo } }, orderBy: { occurredAt: 'desc' } }),
    prisma.alert.findMany({ where: { parentId, acknowledgedAt: null }, orderBy: { createdAt: 'desc' } }),
    // Serious signs mentioned today (see care/redflags.ts).
    prisma.notification.findMany({
      where: { parentId, kind: 'SYMPTOM', dedupeKey: { startsWith: 'redflag:' }, createdAt: { gte: now.startOf('day').toJSDate() } },
      orderBy: { createdAt: 'desc' },
      select: { title: true, createdAt: true },
    }),
  ]);
  // Latest-ever event per measured type, for "not updated for N days" beyond the last week.
  const lastByType = new Map<string, HealthEvent>();
  for (const type of MEASURED) {
    const e = await prisma.healthEvent.findFirst({ where: { parentId, type }, orderBy: { occurredAt: 'desc' } });
    if (e) lastByType.set(type, e);
  }
  const lastWeight = await prisma.healthEvent.findFirst({ where: { parentId, type: 'WEIGHT' }, orderBy: { occurredAt: 'desc' } });
  const localDay = (d: Date) => DateTime.fromJSDate(d).setZone(zone).toISODate()!;
  const daysSince = (d: Date) => Math.floor(now.startOf('day').diff(DateTime.fromJSDate(d).setZone(zone).startOf('day'), 'days').days);

  const routines = parent.routines.map((r) => {
    const occ = occurrences.find((o) => o.routineId === r.id);
    const scheduledToday = isDueOn(r, now);
    const last = MEASURED.includes(r.type) ? lastByType.get(r.type) : undefined;
    const lastToday = last && localDay(last.occurredAt) === today ? last : undefined;
    let latest: string | undefined;
    if (r.type === 'WATER') {
      const max = Math.max(...recentEvents.filter((e) => e.type === 'WATER' && localDay(e.occurredAt) === today).map((e) => e.valueNum ?? 0));
      latest = Number.isFinite(max) ? `${max}${r.target ? `/${r.target}` : ''} glasses` : undefined;
    } else if (r.type === 'BP' || r.type === 'SUGAR') {
      latest = last ? fmtEvent(last) : undefined;
    } else if (r.type === 'WELLBEING') {
      latest = lastToday ? fmtEvent(lastToday) : undefined;
    }
    return {
      id: r.id,
      type: r.type,
      name: r.name,
      timeOfDay: r.timeOfDay,
      target: r.target,
      // A reading sent without being asked still counts as done for the day.
      status: occ ? STATUS_LABEL[occ.status] : lastToday ? 'done' : scheduledToday ? 'upcoming' : 'not_today',
      note: occ?.note ?? null,
      respondedAt: occ?.respondedAt ?? lastToday?.occurredAt ?? null,
      latest: latest ?? null,
      lastReportedAt: last?.occurredAt ?? null,
      daysSinceReport: last ? daysSince(last.occurredAt) : null,
      schedule: describeSchedule(r),
      nextDue: scheduledToday ? today : nextDueDate(r, now.plus({ days: 1 }))?.toISODate() ?? null,
      sentAt: occ?.sentAt ?? null,
      followUpAt: occ?.followUpAt ?? null,
      childAlertedAt: occ?.childAlertedAt ?? null,
    };
  });

  const attention: { kind: string; text: string }[] = [];
  for (const a of alerts) {
    attention.push({ kind: 'emergency', text: `${parent.name} asked for help ${DateTime.fromJSDate(a.createdAt).setZone(zone).toRelative()}` });
  }
  for (const r of routines) {
    if (r.status === 'not_done') attention.push({ kind: 'not_done', text: `${r.name}: said "not yet" today` });
    if (!MEASURED.includes(r.type) || r.type === 'WELLBEING') continue;
    const routine = parent.routines.find((x) => x.id === r.id)!;
    const staleAfter = expectedGapDays(routine) + GRACE_DAYS;
    if (r.daysSinceReport != null && r.daysSinceReport >= staleAfter) {
      attention.push({ kind: 'stale', text: `${label(r.type)} not updated for ${r.daysSinceReport} days${routine.frequency === 'DAILY' ? '' : ` (${describeSchedule(routine).toLowerCase()})`}` });
    } else if (r.daysSinceReport == null && daysSince(routine.createdAt) >= staleAfter) {
      attention.push({ kind: 'stale', text: `No ${label(r.type)} reading yet` });
    }
  }
  for (const s of symptomCounts(recentEvents, localDay)) {
    if (s.count >= 2) attention.push({ kind: 'symptom', text: `${parent.name} mentioned ${s.name} ${s.count} times this week` });
  }
  const wellbeingToday = routines.find((r) => r.type === 'WELLBEING')?.latest;
  if (wellbeingToday === 'low') attention.push({ kind: 'wellbeing', text: `${parent.name} said they're not feeling good today` });

  return {
    parent: { id: parent.id, name: parent.name, relationship: parent.relationship, phone: parent.phone, timezone: zone, consentStatus: parent.consentStatus },
    date: today,
    lastInboundAt: parent.lastInboundAt,
    routines,
    attention,
    symptoms: recentEvents.filter((e) => e.type === 'SYMPTOM').map((e) => ({ name: e.valueText, since: e.context, at: e.occurredAt })),
    alerts,
    urgent: urgent.map((u) => ({ text: u.title, at: u.createdAt })),
    // The most recent of each reading, whenever it was, shown as sent (never judged).
    latestReadings: {
      bp: lastByType.get('BP') ? { value: fmtEvent(lastByType.get('BP')!), at: lastByType.get('BP')!.occurredAt } : null,
      sugar: lastByType.get('SUGAR') ? { value: fmtEvent(lastByType.get('SUGAR')!), at: lastByType.get('SUGAR')!.occurredAt } : null,
      weight: lastWeight ? { value: fmtEvent(lastWeight), at: lastWeight.occurredAt } : null,
      waterToday: (() => {
        const list = recentEvents.filter((e) => e.type === 'WATER' && localDay(e.occurredAt) === today);
        if (!list.length) return null;
        const last = list.reduce((a, b) => (b.valueNum! > a.valueNum! ? b : a));
        return { glasses: last.valueNum!, goal: parent.routines.find((r) => r.type === 'WATER')?.target ?? null, at: last.occurredAt };
      })(),
    },
  };
}

export function symptomCounts(events: HealthEvent[], localDay: (d: Date) => string) {
  const map = new Map<string, Set<string>>();
  const counts = new Map<string, number>();
  for (const e of events) {
    if (e.type !== 'SYMPTOM' || !e.valueText) continue;
    if (!map.has(e.valueText)) map.set(e.valueText, new Set());
    map.get(e.valueText)!.add(localDay(e.occurredAt));
    counts.set(e.valueText, (counts.get(e.valueText) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([name, days]) => ({ name, count: counts.get(name)!, days: [...days].sort() }))
    .sort((a, b) => b.count - a.count);
}

const label = (t: RoutineType) => ({ BP: 'BP', SUGAR: 'Sugar', WATER: 'Water', WELLBEING: 'Wellbeing', MEDICINE: 'Medicine', WALK: 'Walk' })[t];
