import type { OccurrenceStatus, RoutineType } from '@prisma/client';
import { DateTime } from 'luxon';
import { prisma } from '../lib/db.js';
import { describeSchedule, isDueOn } from '../routines/schedule.js';

// The reminders plan for one week (Mon–Sun): what was sent and what happened, and what's coming.

type ItemStatus = 'planned' | 'upcoming' | 'waiting' | 'done' | 'not_done' | 'no_response';
interface ScheduleItem {
  routineId: string;
  occurrenceId: string | null;
  name: string;
  type: RoutineType;
  time: string;
  status: ItemStatus;
  sentAt: Date | null;
  followUpAt: Date | null;
  respondedAt: Date | null;
  childAlertedAt: Date | null;
  note: string | null;
}
const STATUS: Record<OccurrenceStatus, ItemStatus> = {
  SCHEDULED: 'upcoming',
  SENT: 'waiting',
  DONE: 'done',
  NOT_DONE: 'not_done',
  NO_RESPONSE: 'no_response',
};

export async function weekSchedule(parentId: string, start?: string) {
  const parent = await prisma.parentProfile.findUniqueOrThrow({ where: { id: parentId }, include: { routines: { orderBy: { timeOfDay: 'asc' } } } });
  const zone = parent.timezone;
  const now = DateTime.now().setZone(zone);
  const today = now.toISODate()!;
  const monday = (start ? DateTime.fromISO(start, { zone }) : now).startOf('week');
  const dates = Array.from({ length: 7 }, (_, i) => monday.plus({ days: i }));

  const occurrences = await prisma.routineOccurrence.findMany({
    where: { parentId, localDate: { gte: dates[0].toISODate()!, lte: dates[6].toISODate()! } },
  });

  const days = dates.map((d) => {
    const date = d.toISODate()!;
    const items = parent.routines.flatMap((r): ScheduleItem[] => {
      const occ = occurrences.find((o) => o.routineId === r.id && o.localDate === date);
      if (occ) {
        return [{
          routineId: r.id, occurrenceId: occ.id, name: r.name, type: r.type, time: r.timeOfDay, status: STATUS[occ.status],
          sentAt: occ.sentAt, followUpAt: occ.followUpAt, respondedAt: occ.respondedAt, childAlertedAt: occ.childAlertedAt, note: occ.note,
        }];
      }
      // Future reminders the scheduler will create. Past days without one are simply not shown.
      const created = DateTime.fromJSDate(r.createdAt).setZone(zone).toISODate()!;
      if (r.active && parent.consentStatus === 'GRANTED' && date >= today && date >= created && isDueOn(r, d)) {
        return [{
          routineId: r.id, occurrenceId: null, name: r.name, type: r.type, time: r.timeOfDay, status: date === today ? 'upcoming' : 'planned',
          sentAt: null, followUpAt: null, respondedAt: null, childAlertedAt: null, note: null,
        }];
      }
      return [];
    });
    return { date, items: items.sort((a, b) => a.time.localeCompare(b.time)) };
  });

  const all = days.flatMap((d) => d.items);
  const count = (s: ItemStatus) => all.filter((i) => i.status === s).length;
  return {
    weekStart: dates[0].toISODate(),
    weekEnd: dates[6].toISODate(),
    today,
    days,
    routines: parent.routines.filter((r) => r.active).map((r) => ({ id: r.id, name: r.name, type: r.type, time: r.timeOfDay, schedule: describeSchedule(r) })),
    totals: {
      reminders: all.length,
      sent: all.filter((i) => i.sentAt).length,
      done: count('done'),
      notDone: count('not_done'),
      noResponse: count('no_response'),
      waiting: count('waiting'),
      ahead: count('planned') + count('upcoming'),
      followUps: all.filter((i) => i.followUpAt).length,
      childAlerts: all.filter((i) => i.childAlertedAt).length,
    },
  };
}
