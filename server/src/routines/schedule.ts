import type { Frequency } from '@prisma/client';
import { DateTime } from 'luxon';

// When a routine is due. Pure functions: no database, so they're shared by the scheduler,
// the dashboard and the tests.

export interface ScheduleRule {
  frequency: Frequency;
  daysOfWeek: number[];
  intervalDays: number | null;
  startDate: string | null;
  dayOfMonth: number | null;
}

/** `day` is a calendar day in the parent's timezone (any time of day; only the date counts). */
export function isDueOn(rule: ScheduleRule, day: DateTime): boolean {
  switch (rule.frequency) {
    case 'DAILY':
      return true;
    case 'WEEKLY':
      return rule.daysOfWeek.includes(day.weekday);
    case 'INTERVAL': {
      if (!rule.intervalDays || !rule.startDate) return false;
      const start = DateTime.fromISO(rule.startDate, { zone: day.zone });
      const diff = Math.round(day.startOf('day').diff(start.startOf('day'), 'days').days);
      return diff >= 0 && diff % rule.intervalDays === 0;
    }
    case 'MONTHLY': {
      if (!rule.dayOfMonth) return false;
      // "31st" in a 30-day month means the last day.
      return day.day === Math.min(rule.dayOfMonth, day.daysInMonth!);
    }
  }
}

/** The next due day on or after `from`, within a year. */
export function nextDueDate(rule: ScheduleRule, from: DateTime): DateTime | null {
  for (let i = 0; i < 366; i++) {
    const d = from.plus({ days: i });
    if (isDueOn(rule, d)) return d.startOf('day');
  }
  return null;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

export function describeSchedule(rule: ScheduleRule): string {
  switch (rule.frequency) {
    case 'DAILY':
      return 'Every day';
    case 'WEEKLY': {
      const days = [...rule.daysOfWeek].sort((a, b) => a - b);
      if (days.length === 7) return 'Every day';
      if (days.join() === '1,2,3,4,5') return 'Weekdays';
      if (days.join() === '6,7') return 'Weekends';
      return days.length === 1 ? `Every ${DAY_NAMES[days[0] - 1]}` : days.map((d) => DAY_NAMES[d - 1]).join(', ');
    }
    case 'INTERVAL':
      return rule.intervalDays === 1 ? 'Every day' : `Every ${rule.intervalDays} days`;
    case 'MONTHLY':
      return `Monthly on the ${ordinal(rule.dayOfMonth ?? 1)}`;
  }
}

/** Longest normal gap between due days. Used to decide when a reading is overdue, not just absent. */
export function expectedGapDays(rule: ScheduleRule): number {
  switch (rule.frequency) {
    case 'DAILY':
      return 1;
    case 'WEEKLY': {
      const days = [...new Set(rule.daysOfWeek)].sort((a, b) => a - b);
      if (!days.length) return 7;
      return Math.max(...days.map((d, i) => (i + 1 < days.length ? days[i + 1] - d : days[0] + 7 - d)));
    }
    case 'INTERVAL':
      return rule.intervalDays ?? 1;
    case 'MONTHLY':
      return 31;
  }
}
