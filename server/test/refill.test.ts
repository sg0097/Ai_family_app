import { describe, expect, it } from 'vitest';
import { daysLeft, dosesPerDay } from '../src/care/refill.js';

const daily = { active: true, frequency: 'DAILY' as const, daysOfWeek: [], intervalDays: null };

describe('refill', () => {
  it('counts doses a day across reminders', () => {
    expect(dosesPerDay([daily, daily])).toBe(2);
    expect(dosesPerDay([{ ...daily, frequency: 'WEEKLY', daysOfWeek: [1, 4] }])).toBeCloseTo(2 / 7);
    expect(dosesPerDay([{ ...daily, active: false }])).toBe(0);
  });
  it('turns stock into whole days', () => {
    expect(daysLeft({ pillsLeft: 10, pillsPerDose: 1 }, [daily, daily])).toBe(5); // morning + night
    expect(daysLeft({ pillsLeft: 9, pillsPerDose: 2 }, [daily])).toBe(4);
    expect(daysLeft({ pillsLeft: null, pillsPerDose: 1 }, [daily])).toBeNull(); // not tracked
    expect(daysLeft({ pillsLeft: 10, pillsPerDose: 1 }, [])).toBeNull(); // no reminder uses it
  });
});
