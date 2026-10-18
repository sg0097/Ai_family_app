import type { HealthEvent, OccurrenceStatus, RoutineType } from '@prisma/client';
import { DateTime } from 'luxon';
import { prisma } from '../lib/db.js';

// The weekly health report: one calendar week (Mon–Sun, parent's timezone) compared with the week
// before. Every number comes straight from the records and every sentence is built from those
// numbers, with no model involved, so nothing can be invented. Readings are listed, never judged.

interface Tally {
  done: number;
  notYet: number;
  noReply: number;
  asked: number; // reminders whose day has closed or that were answered
}

const tally = (list: { status: OccurrenceStatus }[]): Tally => {
  const n = (s: OccurrenceStatus) => list.filter((o) => o.status === s).length;
  const done = n('DONE');
  const notYet = n('NOT_DONE');
  const noReply = n('NO_RESPONSE');
  return { done, notYet, noReply, asked: done + notYet + noReply };
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function change(now: number, before: number, unit: string, vs: string): string | null {
  if (!before && !now) return null;
  const d = now - before;
  if (d === 0) return `same as ${vs}`;
  const n = Math.abs(d);
  const word = n === 1 && unit.endsWith('s') ? unit.slice(0, -1) : unit; // "1 more reading", "2 more readings"
  return `${n} ${d > 0 ? 'more' : 'fewer'} ${word} than ${vs}`;
}

export async function weeklyReport(parentId: string, start?: string) {
  const parent = await prisma.parentProfile.findUniqueOrThrow({ where: { id: parentId }, include: { routines: true, user: true } });
  const zone = parent.timezone;
  const now = DateTime.now().setZone(zone);
  const monday = (start ? DateTime.fromISO(start, { zone }) : now).startOf('week');
  const sunday = monday.plus({ days: 6 }).endOf('day');
  const prevMonday = monday.minus({ weeks: 1 });
  const days = Array.from({ length: 7 }, (_, i) => monday.plus({ days: i }).toISODate()!);
  const isCurrent = now >= monday && now <= sunday;
  // Mid-week, compare like with like: Mon→today against Mon→same weekday last week.
  const prevEnd = isCurrent ? now.minus({ weeks: 1 }).endOf('day') : monday.minus({ days: 1 }).endOf('day');
  const vs = isCurrent ? 'on the same days last week' : 'last week';
  const localDay = (d: Date) => DateTime.fromJSDate(d).setZone(zone).toISODate()!;

  const [occ, prevOcc, events, prevEvents, alerts, notifications] = await Promise.all([
    prisma.routineOccurrence.findMany({ where: { parentId, localDate: { gte: days[0], lte: days[6] } }, include: { routine: true } }),
    prisma.routineOccurrence.findMany({ where: { parentId, localDate: { gte: prevMonday.toISODate()!, lte: prevEnd.toISODate()! } }, include: { routine: true } }),
    prisma.healthEvent.findMany({ where: { parentId, occurredAt: { gte: monday.toJSDate(), lte: sunday.toJSDate() } }, orderBy: { occurredAt: 'asc' } }),
    prisma.healthEvent.findMany({ where: { parentId, occurredAt: { gte: prevMonday.toJSDate(), lte: prevEnd.toJSDate() } } }),
    prisma.alert.count({ where: { parentId, createdAt: { gte: monday.toJSDate(), lte: sunday.toJSDate() } } }),
    prisma.notification.count({ where: { parentId, kind: { in: ['NOT_DONE', 'SILENCE'] }, createdAt: { gte: monday.toJSDate(), lte: sunday.toJSDate() } } }),
  ]);

  const ofType = (list: typeof occ, type: RoutineType) => list.filter((o) => o.routine.type === type);
  const evOf = (list: HealthEvent[], type: string) => list.filter((e) => e.type === type);

  // Reminders, grouped by routine.
  const routineIds = [...new Set(occ.map((o) => o.routineId))];
  const reminders = routineIds
    .map((id) => {
      const list = occ.filter((o) => o.routineId === id);
      const r = list[0].routine;
      return {
        id,
        name: r.name,
        type: r.type,
        time: r.timeOfDay,
        ...tally(list),
        previous: tally(prevOcc.filter((o) => o.routineId === id)),
        notYetDays: list.filter((o) => o.status === 'NOT_DONE').map((o) => o.localDate).sort(),
        noReplyDays: list.filter((o) => o.status === 'NO_RESPONSE').map((o) => o.localDate).sort(),
      };
    })
    .sort((a, b) => a.time.localeCompare(b.time));

  const medicine = tally(ofType(occ, 'MEDICINE'));
  const medicinePrev = tally(ofType(prevOcc, 'MEDICINE'));
  const walk = tally(ofType(occ, 'WALK'));
  const walkPrev = tally(ofType(prevOcc, 'WALK'));

  const readings = (type: 'BP' | 'SUGAR' | 'WEIGHT') =>
    evOf(events, type).map((e) => ({ at: e.occurredAt, date: localDay(e.occurredAt), value: e.valueNum!, value2: e.valueNum2, context: e.context, source: e.source }));
  const bp = readings('BP');
  const sugar = readings('SUGAR');
  const weight = readings('WEIGHT');
  const range = (vals: number[]) => (vals.length ? { min: Math.min(...vals), max: Math.max(...vals) } : null);

  const waterByDay = days.map((date) => {
    const list = evOf(events, 'WATER').filter((e) => localDay(e.occurredAt) === date);
    return { date, glasses: list.length ? Math.max(...list.map((e) => e.valueNum ?? 0)) : null };
  });
  const waterDays = waterByDay.filter((d) => d.glasses != null);
  const waterAvg = waterDays.length ? Math.round((waterDays.reduce((a, d) => a + d.glasses!, 0) / waterDays.length) * 10) / 10 : null;
  const prevWaterDays = new Map<string, number>();
  for (const e of evOf(prevEvents, 'WATER')) prevWaterDays.set(localDay(e.occurredAt), Math.max(prevWaterDays.get(localDay(e.occurredAt)) ?? 0, e.valueNum ?? 0));
  const prevWaterAvg = prevWaterDays.size ? Math.round(([...prevWaterDays.values()].reduce((a, b) => a + b, 0) / prevWaterDays.size) * 10) / 10 : null;
  const waterGoal = parent.routines.find((r) => r.type === 'WATER' && r.active)?.target ?? null;

  const feelings = days.map((date) => {
    const list = evOf(events, 'WELLBEING').filter((e) => localDay(e.occurredAt) === date);
    return { date, level: (list[list.length - 1]?.valueText as 'good' | 'okay' | 'low' | undefined) ?? null };
  });

  const symptomMap = new Map<string, { days: Set<string>; count: number; since: string | null }>();
  for (const e of evOf(events, 'SYMPTOM')) {
    const s = symptomMap.get(e.valueText!) ?? { days: new Set(), count: 0, since: null };
    s.days.add(localDay(e.occurredAt));
    s.count++;
    s.since ??= e.context;
    symptomMap.set(e.valueText!, s);
  }
  const symptoms = [...symptomMap].map(([name, s]) => ({ name, count: s.count, days: [...s.days].sort(), since: s.since })).sort((a, b) => b.count - a.count);
  const prevSymptoms = new Set(evOf(prevEvents, 'SYMPTOM').map((e) => e.valueText));

  const heardFrom = new Set(events.map((e) => localDay(e.occurredAt))).size;
  const fmtDays = (ds: string[]) => ds.map((d) => DateTime.fromISO(d, { zone }).toFormat('ccc')).join(', ');

  // Plain sentences, built only from the numbers above.
  const headline: string[] = [];
  if (medicine.asked) headline.push(`said done to ${medicine.done} of ${plural(medicine.asked, 'medicine reminder')}`);
  if (bp.length) headline.push(`sent ${plural(bp.length, 'BP reading')}`);
  if (walk.asked) headline.push(`walked on ${walk.done} of ${walk.asked} days`);
  const summary = headline.length
    ? `This week ${parent.name} ${headline.join(', ').replace(/, ([^,]*)$/, ' and $1')}.`
    : `No replies from ${parent.name} have been recorded this week yet.`;

  const changes: string[] = [];
  const medDelta = medicine.asked && medicinePrev.asked ? medicine.done - medicinePrev.done : null;
  if (medDelta) changes.push(`Medicine confirmed ${Math.abs(medDelta)} ${medDelta > 0 ? 'more' : 'fewer'} ${Math.abs(medDelta) === 1 ? 'time' : 'times'} than ${vs}.`);
  const bpChange = change(bp.length, evOf(prevEvents, 'BP').length, 'BP readings', vs);
  if (bpChange && !bpChange.startsWith('same')) changes.push(`${bpChange.charAt(0).toUpperCase()}${bpChange.slice(1)}.`);
  if (waterAvg != null && prevWaterAvg != null && waterAvg !== prevWaterAvg) changes.push(`Water: ${waterAvg} glasses a day on average, ${waterAvg > prevWaterAvg ? 'up' : 'down'} from ${prevWaterAvg} ${vs}.`);
  for (const s of symptoms) if (!prevSymptoms.has(s.name)) changes.push(`Mentioned ${s.name} this week, not ${vs}.`);

  // What we don't know: unanswered reminders and scheduled checks with no reading.
  const missing: string[] = [];
  for (const r of reminders) {
    if (r.noReplyDays.length) missing.push(`No reply to ${r.name} on ${fmtDays(r.noReplyDays)}.`);
  }
  for (const [type, label] of [['BP', 'BP'], ['SUGAR', 'sugar']] as const) {
    const scheduled = parent.routines.some((r) => r.type === type && r.active);
    if (scheduled && !evOf(events, type).length && !isCurrent) missing.push(`No ${label} readings this week.`);
  }

  return {
    parent: { id: parent.id, name: parent.name, relationship: parent.relationship },
    child: parent.user.name,
    week: { start: days[0], end: days[6], isCurrent, days, comparedTo: vs },
    summary,
    glance: {
      medicine: { ...medicine, change: medicine.asked && medicinePrev.asked ? change(medicine.done, medicinePrev.done, 'confirmed', vs) : null },
      bp: { count: bp.length, change: change(bp.length, evOf(prevEvents, 'BP').length, 'readings', vs) },
      water: { avg: waterAvg, goal: waterGoal, days: waterDays.length, change: waterAvg != null && prevWaterAvg != null ? `was ${prevWaterAvg} ${vs}` : null },
      walk: { ...walk, change: walk.asked && walkPrev.asked ? change(walk.done, walkPrev.done, 'walks', vs) : null },
    },
    reminders,
    readings: {
      bp: { list: bp, systolic: range(bp.map((b) => b.value)), diastolic: range(bp.map((b) => b.value2!)) },
      sugar: { list: sugar, range: range(sugar.map((s) => s.value)) },
      weight: { list: weight },
    },
    water: { byDay: waterByDay, avg: waterAvg, goal: waterGoal },
    feelings,
    symptoms,
    changes,
    missing,
    contact: { daysHeardFrom: heardFrom, helpAlerts: alerts, notDoneAlerts: notifications },
  };
}
