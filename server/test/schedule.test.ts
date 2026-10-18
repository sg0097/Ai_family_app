import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { describeSchedule, expectedGapDays, isDueOn, nextDueDate, type ScheduleRule } from '../src/routines/schedule.js';

const zone = 'Asia/Kolkata';
const day = (iso: string) => DateTime.fromISO(iso, { zone });
const rule = (r: Partial<ScheduleRule>): ScheduleRule => ({ frequency: 'DAILY', daysOfWeek: [], intervalDays: null, startDate: null, dayOfMonth: null, ...r });

describe('isDueOn', () => {
  it('daily is always due', () => {
    expect(isDueOn(rule({}), day('2026-10-16'))).toBe(true);
  });

  it('weekly is due only on its days', () => {
    const sundaySugar = rule({ frequency: 'WEEKLY', daysOfWeek: [7] });
    expect(isDueOn(sundaySugar, day('2026-10-18'))).toBe(true); // Sunday
    expect(isDueOn(sundaySugar, day('2026-10-16'))).toBe(false); // Friday
  });

  it('interval counts from the start date', () => {
    const every3 = rule({ frequency: 'INTERVAL', intervalDays: 3, startDate: '2026-10-16' });
    expect(['2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19'].map((d) => isDueOn(every3, day(d)))).toEqual([true, false, false, true]);
    expect(isDueOn(every3, day('2026-10-13'))).toBe(false); // before the start
  });

  it('monthly falls back to the last day of short months', () => {
    const on31 = rule({ frequency: 'MONTHLY', dayOfMonth: 31 });
    expect(isDueOn(on31, day('2026-11-30'))).toBe(true);
    expect(isDueOn(on31, day('2026-10-31'))).toBe(true);
    expect(isDueOn(on31, day('2026-10-30'))).toBe(false);
    expect(isDueOn(rule({ frequency: 'MONTHLY', dayOfMonth: 1 }), day('2026-11-01'))).toBe(true);
  });
});

describe('nextDueDate', () => {
  it('finds the next weekly day', () => {
    expect(nextDueDate(rule({ frequency: 'WEEKLY', daysOfWeek: [7] }), day('2026-10-16'))?.toISODate()).toBe('2026-10-18');
  });
  it('includes today', () => {
    expect(nextDueDate(rule({}), day('2026-10-16'))?.toISODate()).toBe('2026-10-16');
  });
});

describe('describeSchedule', () => {
  it('reads naturally', () => {
    expect(describeSchedule(rule({}))).toBe('Every day');
    expect(describeSchedule(rule({ frequency: 'WEEKLY', daysOfWeek: [7] }))).toBe('Every Sun');
    expect(describeSchedule(rule({ frequency: 'WEEKLY', daysOfWeek: [4, 1] }))).toBe('Mon, Thu');
    expect(describeSchedule(rule({ frequency: 'WEEKLY', daysOfWeek: [1, 2, 3, 4, 5] }))).toBe('Weekdays');
    expect(describeSchedule(rule({ frequency: 'INTERVAL', intervalDays: 3 }))).toBe('Every 3 days');
    expect(describeSchedule(rule({ frequency: 'MONTHLY', dayOfMonth: 1 }))).toBe('Monthly on the 1st');
    expect(describeSchedule(rule({ frequency: 'MONTHLY', dayOfMonth: 22 }))).toBe('Monthly on the 22nd');
  });
});

describe('expectedGapDays', () => {
  it('is the longest normal gap between due days', () => {
    expect(expectedGapDays(rule({}))).toBe(1);
    expect(expectedGapDays(rule({ frequency: 'WEEKLY', daysOfWeek: [7] }))).toBe(7);
    expect(expectedGapDays(rule({ frequency: 'WEEKLY', daysOfWeek: [1, 4] }))).toBe(4); // Thu → Mon
    expect(expectedGapDays(rule({ frequency: 'INTERVAL', intervalDays: 3 }))).toBe(3);
  });
});
