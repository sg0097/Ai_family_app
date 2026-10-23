import type { Frequency } from '@prisma/client';

// How long a medicine's stock will last, from the reminders that use it. Pure arithmetic on
// what the family entered; the product never suggests doses.

interface DoseSchedule {
  active: boolean;
  frequency: Frequency;
  daysOfWeek: number[];
  intervalDays: number | null;
}

/** Average reminders per day across the linked schedules ("Mon, Thu" = 2/7 a day). */
export function dosesPerDay(routines: DoseSchedule[]): number {
  return routines
    .filter((r) => r.active)
    .reduce((sum, r) => {
      switch (r.frequency) {
        case 'DAILY':
          return sum + 1;
        case 'WEEKLY':
          return sum + r.daysOfWeek.length / 7;
        case 'INTERVAL':
          return sum + 1 / (r.intervalDays || 1);
        case 'MONTHLY':
          return sum + 12 / 365;
      }
    }, 0);
}

/** Whole days the stock covers, or null when stock isn't tracked or nothing uses it. */
export function daysLeft(med: { pillsLeft: number | null; pillsPerDose: number }, routines: DoseSchedule[]): number | null {
  if (med.pillsLeft == null) return null;
  const perDay = dosesPerDay(routines) * Math.max(1, med.pillsPerDose);
  if (perDay === 0) return null;
  return Math.floor(med.pillsLeft / perDay);
}
