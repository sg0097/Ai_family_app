import type { FastifyInstance, FastifyRequest } from 'fastify';
import { DateTime } from 'luxon';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { adminEmails } from '../lib/env.js';
import { HttpError } from '../lib/http.js';
import { outboundQueue, inboundQueue } from '../lib/queues.js';
import { planOf } from '../lib/plan.js';

/** The operator's view for launch: who signed up, who pays, and whether messages are reaching parents. */
export async function adminRoutes(app: FastifyInstance) {
  const isAdmin = async (req: FastifyRequest) => {
    const me = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { email: true } });
    return !!me && adminEmails.includes(me.email.toLowerCase());
  };
  app.addHook('preHandler', async (req) => {
    if (!(await isAdmin(req))) throw new HttpError(404, 'Not found');
  });

  app.get('/admin/overview', async () => {
    const now = new Date();
    const day = DateTime.utc().minus({ hours: 24 }).toJSDate();
    const week = DateTime.utc().minus({ days: 7 }).toJSDate();
    const [users, parents, granted, sent, byStatus, failed, replied, revenue, qOut, qIn, signups] = await Promise.all([
      prisma.user.findMany({ select: { plan: true, planRenewsAt: true, trialEndsAt: true } }),
      prisma.parentProfile.count(),
      prisma.parentProfile.count({ where: { consentStatus: 'GRANTED' } }),
      prisma.message.count({ where: { direction: 'OUT', createdAt: { gte: day } } }),
      prisma.message.groupBy({ by: ['deliveryStatus'], where: { direction: 'OUT', createdAt: { gte: day } }, _count: true }),
      prisma.message.findMany({ where: { OR: [{ deliveryStatus: 'failed' }, { kind: 'dropped' }], createdAt: { gte: week } }, orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, toPhone: true, kind: true, failureReason: true, createdAt: true, parent: { select: { name: true } } } }),
      prisma.parentProfile.count({ where: { lastInboundAt: { gte: week } } }),
      prisma.payment.aggregate({ where: { status: 'PAID' }, _sum: { amountPaise: true }, _count: true }),
      outboundQueue.getJobCounts('waiting', 'active', 'failed', 'delayed'),
      inboundQueue.getJobCounts('waiting', 'active', 'failed'),
      prisma.user.count({ where: { createdAt: { gte: week } } }),
    ]);
    const tiers = { trial: 0, basic: 0, premium: 0, expired: 0 };
    for (const u of users) {
      const p = planOf(u, now);
      if (p.plan === 'PREMIUM') tiers.premium++;
      else if (p.plan === 'BASIC') tiers.basic++;
      else if (p.trial) tiers.trial++;
      else tiers.expired++;
    }
    return {
      users: users.length,
      signupsThisWeek: signups,
      tiers,
      parents,
      parentsOnWhatsApp: granted,
      parentsRepliedThisWeek: replied,
      messagesLast24h: { sent, byStatus: Object.fromEntries(byStatus.map((s) => [s.deliveryStatus ?? 'unknown', s._count])) },
      queues: { outbound: qOut, inbound: qIn },
      revenue: { paidOrders: revenue._count, totalInr: (revenue._sum.amountPaise ?? 0) / 100 },
      recentFailures: failed.map((f) => ({ ...f, toPhone: f.toPhone ? `${f.toPhone.slice(0, 4)}•••${f.toPhone.slice(-2)}` : null })),
    };
  });

  app.get('/admin/users', async () => {
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { _count: { select: { parents: true } } } });
    return users.map((u) => ({ id: u.id, name: u.name, email: u.email, createdAt: u.createdAt, suspended: u.suspended, ...planOf(u, new Date(), u._count.parents) }));
  });

  app.patch<{ Params: { id: string } }>('/admin/users/:id', async (req) => {
    const b = z.object({ suspended: z.boolean().optional(), grant: z.enum(['BASIC', 'PREMIUM']).optional(), days: z.number().int().min(1).max(366).default(30) }).parse(req.body);
    const data: Record<string, unknown> = {};
    if (b.suspended !== undefined) data.suspended = b.suspended;
    // Comp a plan (for the first families, paid by UPI outside the app).
    if (b.grant) Object.assign(data, { plan: b.grant, planRenewsAt: DateTime.utc().plus({ days: b.days }).toJSDate() });
    await prisma.user.update({ where: { id: req.params.id }, data });
    return { ok: true };
  });
}
