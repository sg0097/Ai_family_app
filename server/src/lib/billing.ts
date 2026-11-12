import { DateTime } from 'luxon';
import { prisma } from './db.js';
import { BASIC_PRICE_INR, PREMIUM_PRICE_INR } from './plan.js';

export const amountPaise = (plan: 'BASIC' | 'PREMIUM', parents: number) => (plan === 'PREMIUM' ? PREMIUM_PRICE_INR : BASIC_PRICE_INR) * Math.max(parents, 1) * 100;

/**
 * Mark an order paid and give the user a month of the plan. Safe to call twice (browser and
 * webhook both report the same payment): only the first call changes anything.
 * Renewing early adds a month to the end of the current period instead of losing days.
 */
export async function activatePayment(orderId: string, paymentId: string): Promise<boolean> {
  const pay = await prisma.payment.findUnique({ where: { orderId } });
  if (!pay) return false;
  const claimed = await prisma.payment.updateMany({ where: { id: pay.id, status: { not: 'PAID' } }, data: { status: 'PAID', paymentId, paidAt: new Date() } });
  if (claimed.count !== 1) return true; // already activated
  const user = await prisma.user.findUniqueOrThrow({ where: { id: pay.userId } });
  const now = DateTime.utc();
  const base = user.planRenewsAt && user.planRenewsAt > now.toJSDate() && user.plan === pay.plan ? DateTime.fromJSDate(user.planRenewsAt) : now;
  await prisma.user.update({ where: { id: user.id }, data: { plan: pay.plan, planRenewsAt: base.plus({ days: 30 }).toJSDate() } });
  return true;
}
