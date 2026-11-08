import { describe, expect, it } from 'vitest';
import { planOf } from '../src/lib/plan.js';

const now = new Date('2026-10-26T10:00:00Z');
const days = (n: number) => new Date(now.getTime() + n * 86_400_000);
const u = (plan: 'FREE' | 'BASIC' | 'PREMIUM', renews: number | null, trial: number | null) => ({ plan, planRenewsAt: renews == null ? null : days(renews), trialEndsAt: trial == null ? null : days(trial) });

describe('planOf', () => {
  it('nothing paid and no trial: reminders off', () => {
    expect(planOf(u('FREE', null, null), now)).toMatchObject({ plan: 'FREE', active: false, premium: false, monthlyInr: 0 });
  });
  it('trial opens everything and counts days left', () => {
    expect(planOf(u('FREE', null, 3.5), now)).toMatchObject({ active: true, premium: true, trial: true, trialDaysLeft: 4 });
  });
  it('an ended trial closes everything', () => {
    expect(planOf(u('FREE', null, -1), now)).toMatchObject({ active: false, premium: false });
  });
  it('basic is active but not premium, ₹100 per parent', () => {
    expect(planOf(u('BASIC', 10, null), now, 2)).toMatchObject({ plan: 'BASIC', active: true, premium: false, monthlyInr: 200 });
  });
  it('premium is ₹149 per parent', () => {
    expect(planOf(u('PREMIUM', 10, null), now, 3)).toMatchObject({ plan: 'PREMIUM', active: true, premium: true, monthlyInr: 447 });
  });
  it('a lapsed paid period falls back to free', () => {
    expect(planOf(u('PREMIUM', -1, null), now)).toMatchObject({ plan: 'FREE', active: false });
  });
});
