import { describe, expect, it } from 'vitest';
import { planOf } from '../src/lib/plan.js';

const now = new Date('2026-10-26T10:00:00Z');
const days = (n: number) => new Date(now.getTime() + n * 86_400_000);

describe('planOf', () => {
  it('free with no trial', () => {
    expect(planOf({ plan: 'FREE', planRenewsAt: null, trialEndsAt: null }, now)).toMatchObject({ plan: 'FREE', family: false, maxParents: 1 });
  });
  it('trial opens Family features and counts days left', () => {
    expect(planOf({ plan: 'FREE', planRenewsAt: null, trialEndsAt: days(3.5) }, now)).toMatchObject({ plan: 'FREE', family: true, trialDaysLeft: 4, maxParents: 4 });
  });
  it('an ended trial closes them', () => {
    expect(planOf({ plan: 'FREE', planRenewsAt: null, trialEndsAt: days(-1) }, now).family).toBe(false);
  });
  it('paid until the period ends', () => {
    expect(planOf({ plan: 'FAMILY', planRenewsAt: days(10), trialEndsAt: null }, now)).toMatchObject({ plan: 'FAMILY', family: true, trialDaysLeft: 0 });
    expect(planOf({ plan: 'FAMILY', planRenewsAt: days(-1), trialEndsAt: null }, now)).toMatchObject({ plan: 'FREE', family: false });
  });
});
