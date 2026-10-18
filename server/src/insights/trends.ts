import type { OccurrenceStatus } from '@prisma/client';
import { DateTime } from 'luxon';
import { prisma } from '../lib/db.js';
import { symptomCounts } from './index.js';

// Longer-range views for the dashboard: charts, the adherence calendar, streaks and the activity feed.
// Everything is computed from stored records; nothing is inferred.

type DayStatus = 'done' | 'not_done' | 'no_response' | 'waiting' | 'upcoming' | 'none';

const DAY_STATUS: Record<OccurrenceStatus, DayStatus> = {
  DONE: 'done',
  NOT_DONE: 'not_done',
  NO_RESPONSE: 'no_response',
  SENT: 'waiting',
  SCHEDULED: 'upcoming',
};

export async function trends(parentId: string, days: number) {
  const parent = await prisma.parentProfile.findUniqueOrThrow({ where: { id: parentId }, include: { routines: { orderBy: { timeOfDay: 'asc' } } } });
  const zone = parent.timezone;
  const today = DateTime.now().setZone(zone).startOf('day');
  const start = today.minus({ days: days - 1 });
  const prevStart = start.minus({ days });
  const dates = Array.from({ length: days }, (_, i) => start.plus({ days: i }).toISODate()!);
  const localDay = (d: Date) => DateTime.fromJSDate(d).setZone(zone).toISODate()!;

  const [events, occurrences, prevOccurrences, medicineHistory] = await Promise.all([
    prisma.healthEvent.findMany({ where: { parentId, occurredAt: { gte: start.toJSDate() } }, orderBy: { occurredAt: 'asc' } }),
    prisma.routineOccurrence.findMany({ where: { parentId, localDate: { gte: dates[0] } } }),
    prisma.routineOccurrence.findMany({ where: { parentId, localDate: { gte: prevStart.toISODate()!, lt: dates[0] } }, include: { routine: true } }),
    prisma.routineOccurrence.findMany({
      where: { parentId, routine: { type: 'MEDICINE' }, localDate: { gte: today.minus({ days: 365 }).toISODate()! } },
      orderBy: { localDate: 'desc' },
    }),
  ]);

  const series = (type: string) => events.filter((e) => e.type === type);
  const maxPerDay = (type: string) => {
    const byDay = new Map<string, number>();
    for (const e of series(type)) byDay.set(localDay(e.occurredAt), Math.max(byDay.get(localDay(e.occurredAt)) ?? 0, e.valueNum ?? 0));
    return dates.map((date) => ({ date, value: byDay.get(date) ?? null }));
  };

  const adherence = parent.routines
    .filter((r) => r.active || occurrences.some((o) => o.routineId === r.id))
    .map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      days: dates.map((date) => {
        const occ = occurrences.find((o) => o.routineId === r.id && o.localDate === date);
        return { date, status: occ ? DAY_STATUS[occ.status] : ('none' as DayStatus), note: occ?.note ?? null };
      }),
    }));

  const wellbeingByDay = new Map<string, string>();
  for (const e of series('WELLBEING')) if (e.valueText) wellbeingByDay.set(localDay(e.occurredAt), e.valueText);

  // Rate = confirmed / days whose question is closed. Open questions today don't count either way.
  const rate = (list: { status: OccurrenceStatus }[]) => {
    const closed = list.filter((o) => o.status === 'DONE' || o.status === 'NOT_DONE' || o.status === 'NO_RESPONSE');
    return closed.length ? { done: closed.filter((o) => o.status === 'DONE').length, closed: closed.length } : null;
  };
  const medicineIds = new Set(parent.routines.filter((r) => r.type === 'MEDICINE').map((r) => r.id));
  const water = maxPerDay('WATER');
  const waterDays = water.filter((d) => d.value != null);

  return {
    range: { from: dates[0], to: dates[dates.length - 1], days },
    dates,
    bp: series('BP').map((e) => ({ at: e.occurredAt, date: localDay(e.occurredAt), systolic: e.valueNum!, diastolic: e.valueNum2!, source: e.source })),
    sugar: series('SUGAR').map((e) => ({ at: e.occurredAt, date: localDay(e.occurredAt), value: e.valueNum!, context: e.context, source: e.source })),
    weight: series('WEIGHT').map((e) => ({ at: e.occurredAt, date: localDay(e.occurredAt), value: e.valueNum!, source: e.source })),
    water: water.map((d) => ({ date: d.date, glasses: d.value })),
    waterTarget: parent.routines.find((r) => r.type === 'WATER' && r.active)?.target ?? null,
    wellbeing: dates.map((date) => ({ date, level: wellbeingByDay.get(date) ?? null })),
    adherence,
    symptoms: symptomCounts(series('SYMPTOM'), localDay),
    stats: {
      medicine: rate(occurrences.filter((o) => medicineIds.has(o.routineId))),
      medicinePrev: rate(prevOccurrences.filter((o) => o.routine.type === 'MEDICINE')),
      streak: medicineStreak(medicineHistory, today.toISODate()!),
      bpReadings: series('BP').length,
      waterAvg: waterDays.length ? Math.round((waterDays.reduce((a, d) => a + d.value!, 0) / waterDays.length) * 10) / 10 : null,
      waterDays: waterDays.length,
      daysHeardFrom: new Set(events.map((e) => localDay(e.occurredAt))).size,
    },
  };
}

/** Consecutive days, counting back from the latest closed day, on which every medicine was confirmed. */
function medicineStreak(history: { localDate: string; status: OccurrenceStatus }[], today: string): number {
  const byDay = new Map<string, OccurrenceStatus[]>();
  for (const o of history) byDay.set(o.localDate, [...(byDay.get(o.localDate) ?? []), o.status]);
  let streak = 0;
  let day = DateTime.fromISO(today);
  // Today only counts once it's fully confirmed; an open question today doesn't break the streak.
  const todays = byDay.get(today);
  if (todays?.length && todays.every((s) => s === 'DONE')) streak++;
  for (;;) {
    day = day.minus({ days: 1 });
    const statuses = byDay.get(day.toISODate()!);
    if (!statuses?.length || !statuses.every((s) => s === 'DONE')) return streak;
    streak++;
  }
}

