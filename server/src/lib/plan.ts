import type { User } from '@prisma/client';
import { prisma } from './db.js';
import { HttpError } from './http.js';

export const TRIAL_DAYS = 7;
export const BASIC_PRICE_INR = 100; // per parent, per month
export const PREMIUM_PRICE_INR = 149; // per parent, per month
export const MAX_PARENTS = 6;
export const BASIC_HISTORY_DAYS = 14;
/** @deprecated name kept for the history checks: the history window on Basic. */
export const FREE_HISTORY_DAYS = BASIC_HISTORY_DAYS;

/**
 * What Premium adds. Basic already has reminders in your words, one-tap replies, Today, the
 * evening summary, HELP, the weekly report, medicines/refills and doctor visit reminders.
 */
export type PremiumFeature = 'voice' | 'team' | 'checkin' | 'report' | 'history';

const FEATURE_NAME: Record<PremiumFeature, string> = {
  voice: 'Reminders in your own voice',
  team: 'Sharing with brothers and sisters',
  checkin: 'Saying hi any time',
  report: 'The doctor visit report',
  history: 'History older than two weeks',
};

type PlanUser = Pick<User, 'plan' | 'planRenewsAt' | 'trialEndsAt'>;

export function planOf(u: PlanUser, now = new Date(), parents = 1) {
  const paid = (u.plan === 'BASIC' || u.plan === 'PREMIUM') && (!u.planRenewsAt || u.planRenewsAt > now);
  const trial = !paid && !!u.trialEndsAt && u.trialEndsAt > now;
  const plan = paid ? (u.plan as 'BASIC' | 'PREMIUM') : ('FREE' as const);
  const perParent = plan === 'PREMIUM' ? PREMIUM_PRICE_INR : BASIC_PRICE_INR;
  return {
    plan,
    /** Reminders run: on trial or on a paid plan. */
    active: paid || trial,
    /** Premium features open: on trial or Premium. */
    premium: plan === 'PREMIUM' || trial,
    trial,
    trialDaysLeft: trial ? Math.ceil((u.trialEndsAt!.getTime() - now.getTime()) / 86_400_000) : 0,
    renewsAt: paid ? u.planRenewsAt : null,
    basicInr: BASIC_PRICE_INR,
    premiumInr: PREMIUM_PRICE_INR,
    parents,
    monthlyInr: paid ? perParent * Math.max(parents, 1) : 0,
    maxParents: MAX_PARENTS,
  };
}

/** Premium features follow the plan of whoever added the parent, so siblings share it. */
export async function requirePremium(feature: PremiumFeature, by: { userId?: string; parentId?: string }) {
  const user = by.parentId
    ? (await prisma.parentProfile.findUniqueOrThrow({ where: { id: by.parentId }, include: { user: true } })).user
    : await prisma.user.findUniqueOrThrow({ where: { id: by.userId! } });
  if (!planOf(user).premium) throw new HttpError(402, `${FEATURE_NAME[feature]} is part of the Premium plan (₹${PREMIUM_PRICE_INR} per parent a month)`);
}
