import type { User } from '@prisma/client';
import { prisma } from './db.js';
import { HttpError } from './http.js';

export const TRIAL_DAYS = 14;
export const FAMILY_PRICE_INR = 199;
export const FREE_PARENTS = 1;
export const FREE_HISTORY_DAYS = 14;
export const FAMILY_PARENTS = 4;

/** What the Family plan adds. Reminders, one-tap replies, Today, the weekly report and HELP are free for everyone. */
export type FamilyFeature = 'voice' | 'parents' | 'team' | 'midday' | 'checkin' | 'report' | 'history';

const FEATURE_NAME: Record<FamilyFeature, string> = {
  voice: 'Voice notes',
  parents: 'Caring for more than one parent',
  team: 'Sharing with family',
  midday: 'The 1 PM WhatsApp summary',
  checkin: 'Sending a nudge',
  report: 'The doctor visit report',
  history: 'History older than two weeks',
};

type PlanUser = Pick<User, 'plan' | 'planRenewsAt' | 'trialEndsAt'>;

export function planOf(u: PlanUser, now = new Date()) {
  const paid = u.plan === 'FAMILY' && (!u.planRenewsAt || u.planRenewsAt > now);
  const trial = !paid && !!u.trialEndsAt && u.trialEndsAt > now;
  return {
    plan: paid ? ('FAMILY' as const) : ('FREE' as const),
    family: paid || trial,
    trialDaysLeft: trial ? Math.ceil((u.trialEndsAt!.getTime() - now.getTime()) / 86_400_000) : 0,
    renewsAt: paid ? u.planRenewsAt : null,
    priceInr: FAMILY_PRICE_INR,
    maxParents: paid || trial ? FAMILY_PARENTS : FREE_PARENTS,
  };
}

/** Parent-scoped features follow the plan of whoever added the parent, so siblings share it. */
export async function requireFamily(feature: FamilyFeature, by: { userId?: string; parentId?: string }) {
  const user = by.parentId
    ? (await prisma.parentProfile.findUniqueOrThrow({ where: { id: by.parentId }, include: { user: true } })).user
    : await prisma.user.findUniqueOrThrow({ where: { id: by.userId! } });
  if (!planOf(user).family) throw new HttpError(402, `${FEATURE_NAME[feature]} is part of the Family plan (₹${FAMILY_PRICE_INR}/month)`);
}
