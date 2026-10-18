import type { FastifyInstance, FastifyRequest } from 'fastify';
import { DateTime } from 'luxon';
import { z } from 'zod';
import { consentRequest, text } from '../conversation/copy.js';
import { askAboutParent } from '../insights/ask.js';
import { todayView } from '../insights/index.js';
import { weeklyReport } from '../insights/report.js';
import { weekSchedule } from '../insights/schedule.js';
import { trends } from '../insights/trends.js';
import { prisma } from '../lib/db.js';
import { HttpError, notFound } from '../lib/http.js';
import { normalizePhone } from '../lib/phone.js';
import { enqueueOutbound } from '../lib/queues.js';
import { sendNow } from '../routines/scheduler.js';

const routineFields = z.object({
  type: z.enum(['MEDICINE', 'WATER', 'BP', 'SUGAR', 'WALK', 'WELLBEING']),
  name: z.string().trim().min(1).max(40),
  timeOfDay: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm'),
  frequency: z.enum(['DAILY', 'WEEKLY', 'INTERVAL', 'MONTHLY']).default('DAILY'),
  daysOfWeek: z.array(z.number().int().min(1).max(7)).default([]),
  intervalDays: z.number().int().min(2).max(60).nullish(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  dayOfMonth: z.number().int().min(1).max(31).nullish(),
  target: z.number().int().min(1).max(30).nullish(),
  followUpMinutes: z.number().int().min(15).max(720).nullable().optional(),
  alertAfterMinutes: z.number().int().min(30).max(1440).nullable().optional(),
  active: z.boolean().default(true),
});

/** Each frequency needs its own detail. Checked on the merged routine so partial updates are covered too. */
function checkSchedule(r: { frequency?: string; daysOfWeek?: number[]; intervalDays?: number | null; dayOfMonth?: number | null }) {
  if (r.frequency === 'WEEKLY' && !r.daysOfWeek?.length) throw new HttpError(400, 'Pick at least one day of the week');
  if (r.frequency === 'INTERVAL' && !r.intervalDays) throw new HttpError(400, 'Choose how many days apart');
  if (r.frequency === 'MONTHLY' && !r.dayOfMonth) throw new HttpError(400, 'Choose a day of the month');
}

// Medicine and readings escalate to the child; a skipped walk or water check only gets a nudge.
const CARE_DEFAULTS: Record<string, { followUpMinutes: number | null; alertAfterMinutes: number | null }> = {
  MEDICINE: { followUpMinutes: 60, alertAfterMinutes: 180 },
  BP: { followUpMinutes: 120, alertAfterMinutes: 300 },
  SUGAR: { followUpMinutes: 120, alertAfterMinutes: 300 },
  WALK: { followUpMinutes: 120, alertAfterMinutes: null },
  WATER: { followUpMinutes: null, alertAfterMinutes: null },
  WELLBEING: { followUpMinutes: 120, alertAfterMinutes: null },
};

/** Normalise a new routine: start interval schedules today (parent's time) and drop fields other frequencies don't use. */
function routineData(r: z.infer<typeof routineFields>, timezone: string) {
  checkSchedule(r);
  return {
    ...r,
    followUpMinutes: r.followUpMinutes !== undefined ? r.followUpMinutes : CARE_DEFAULTS[r.type].followUpMinutes,
    alertAfterMinutes: r.alertAfterMinutes !== undefined ? r.alertAfterMinutes : CARE_DEFAULTS[r.type].alertAfterMinutes,
    daysOfWeek: r.frequency === 'WEEKLY' ? [...new Set(r.daysOfWeek)].sort() : [],
    intervalDays: r.frequency === 'INTERVAL' ? r.intervalDays! : null,
    startDate: r.frequency === 'INTERVAL' ? r.startDate ?? DateTime.now().setZone(timezone).toISODate()! : null,
    dayOfMonth: r.frequency === 'MONTHLY' ? r.dayOfMonth! : null,
    target: r.target ?? null,
  };
}

const profileBody = z.object({
  name: z.string().trim().min(1).max(40),
  relationship: z.string().trim().min(1).max(40),
  timezone: z.string().refine((tz) => DateTime.local().setZone(tz).isValid, 'Unknown timezone'),
  emergencyNumber: z.string().trim().min(1).max(20),
});

// Readings the child can add by hand, e.g. from a doctor's visit.
const eventBody = z.discriminatedUnion('type', [
  z.object({ type: z.literal('BP'), systolic: z.number().int().min(60).max(260), diastolic: z.number().int().min(30).max(160), occurredAt: z.coerce.date().optional(), note: z.string().max(120).optional() }),
  z.object({ type: z.literal('SUGAR'), value: z.number().min(20).max(700), occurredAt: z.coerce.date().optional(), note: z.string().max(120).optional() }),
  z.object({ type: z.literal('WEIGHT'), value: z.number().min(20).max(300), occurredAt: z.coerce.date().optional(), note: z.string().max(120).optional() }),
  z.object({ type: z.literal('SYMPTOM'), name: z.string().trim().min(1).max(60), occurredAt: z.coerce.date().optional(), note: z.string().max(120).optional() }),
]);

const parentBody = z.object({
  name: z.string().trim().min(1).max(40),
  relationship: z.string().trim().min(1).max(40),
  phone: z.string(),
  timezone: z.string().default('Asia/Kolkata'),
  emergencyNumber: z.string().trim().max(20).default('112'),
  routines: z.array(routineFields).max(12).default([]),
});

export async function parentRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  /** 404s unless the parent belongs to the signed-in child. */
  const ownParent = async (req: FastifyRequest, id: string) => {
    const parent = await prisma.parentProfile.findFirst({ where: { id, userId: req.user.sub }, include: { user: true } });
    if (!parent) throw notFound();
    return parent;
  };
  const ownRoutine = async (req: FastifyRequest, id: string) => {
    const routine = await prisma.routine.findFirst({ where: { id, parent: { userId: req.user.sub } } });
    if (!routine) throw notFound();
    return routine;
  };

  /** Family overview: each parent with a compact view of today. */
  app.get('/parents', async (req) => {
    const parents = await prisma.parentProfile.findMany({ where: { userId: req.user.sub }, orderBy: { createdAt: 'asc' } });
    return Promise.all(
      parents.map(async (p) => {
        const t = await todayView(p.id);
        const scheduled = t.routines.filter((r) => r.status !== 'not_today');
        return {
          id: p.id,
          name: p.name,
          relationship: p.relationship,
          phone: p.phone,
          consentStatus: p.consentStatus,
          timezone: p.timezone,
          lastInboundAt: p.lastInboundAt,
          today: {
            done: scheduled.filter((r) => r.status === 'done').length,
            total: scheduled.length,
            routines: t.routines.map((r) => ({ type: r.type, name: r.name, status: r.status, latest: r.latest, childAlertedAt: r.childAlertedAt })),
          },
          attention: t.attention.filter((a) => a.kind !== 'emergency').length,
          urgent: t.urgent,
          alerts: t.alerts.length,
        };
      }),
    );
  });

  app.post('/parents', async (req, reply) => {
    const body = parentBody.parse(req.body);
    const phone = normalizePhone(body.phone);
    if (!phone) return reply.code(400).send({ error: 'Enter a valid WhatsApp number' });
    if (await prisma.parentProfile.findUnique({ where: { phone } })) return reply.code(409).send({ error: 'This number is already connected' });
    const parent = await prisma.parentProfile.create({
      data: {
        userId: req.user.sub,
        name: body.name,
        relationship: body.relationship,
        phone,
        timezone: body.timezone,
        emergencyNumber: body.emergencyNumber,
        routines: { create: body.routines.map((r) => routineData(r, body.timezone)) },
      },
      include: { user: true },
    });
    // Nothing is sent to the parent until they reply yes to this.
    await enqueueOutbound({ parentId: parent.id, toPhone: parent.phone, ...consentRequest(parent, parent.user.name) });
    return reply.code(201).send({ id: parent.id });
  });

  app.post<{ Params: { id: string } }>('/parents/:id/resend-consent', async (req) => {
    const parent = await ownParent(req, req.params.id);
    await enqueueOutbound({ parentId: parent.id, toPhone: parent.phone, ...consentRequest(parent, parent.user.name) });
    return { ok: true };
  });

  app.get<{ Params: { id: string } }>('/parents/:id/today', async (req) => {
    await ownParent(req, req.params.id);
    return todayView(req.params.id);
  });


  app.patch<{ Params: { id: string } }>('/parents/:id', async (req) => {
    await ownParent(req, req.params.id);
    const body = profileBody.partial().parse(req.body);
    return prisma.parentProfile.update({
      where: { id: req.params.id },
      data: body,
      select: { id: true, name: true, relationship: true, timezone: true, emergencyNumber: true },
    });
  });

  /** Remove a parent and everything recorded about them. The child must type the parent's name. */
  app.delete<{ Params: { id: string } }>('/parents/:id', async (req, reply) => {
    const parent = await ownParent(req, req.params.id);
    const { confirmName } = z.object({ confirmName: z.string() }).parse(req.body ?? {});
    if (confirmName.trim().toLowerCase() !== parent.name.trim().toLowerCase()) throw new HttpError(400, `Type “${parent.name}” to confirm`);
    // A polite goodbye if WhatsApp still allows a free-form message; not linked to the deleted profile.
    const windowOpen = parent.lastInboundAt && Date.now() - parent.lastInboundAt.getTime() < 23 * 60 * 60 * 1000;
    if (parent.consentStatus === 'GRANTED' && windowOpen) {
      await enqueueOutbound({ toPhone: parent.phone, windowKnownOpen: true, session: { text: text.removed(parent.user.name) } });
    }
    await prisma.parentProfile.delete({ where: { id: parent.id } }); // cascades to routines, records, messages, alerts
    return reply.code(204).send();
  });

  app.get<{ Params: { id: string } }>('/parents/:id/profile', async (req) => {
    const p = await ownParent(req, req.params.id);
    return { id: p.id, name: p.name, relationship: p.relationship, phone: p.phone, timezone: p.timezone, emergencyNumber: p.emergencyNumber, consentStatus: p.consentStatus, consentAt: p.consentAt, createdAt: p.createdAt };
  });

  app.get<{ Params: { id: string }; Querystring: { days?: string } }>('/parents/:id/trends', async (req) => {
    await ownParent(req, req.params.id);
    const days = [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
    return trends(req.params.id, days);
  });


  app.get<{ Params: { id: string }; Querystring: { type?: string; limit?: string } }>('/parents/:id/events', async (req) => {
    await ownParent(req, req.params.id);
    const type = req.query.type?.toUpperCase();
    const types = ['MEDICINE', 'BP', 'SUGAR', 'WATER', 'WEIGHT', 'WALK', 'WELLBEING', 'SYMPTOM'] as const;
    return prisma.healthEvent.findMany({
      where: { parentId: req.params.id, ...(type && (types as readonly string[]).includes(type) && { type: type as (typeof types)[number] }) },
      orderBy: { occurredAt: 'desc' },
      take: Math.min(Number(req.query.limit) || 100, 500),
      select: { id: true, type: true, valueNum: true, valueNum2: true, valueText: true, unit: true, context: true, occurredAt: true, source: true, message: { select: { body: true } }, occurrence: { select: { routine: { select: { name: true } } } } },
    });
  });

  app.post<{ Params: { id: string } }>('/parents/:id/events', async (req, reply) => {
    await ownParent(req, req.params.id);
    const b = eventBody.parse(req.body);
    const base = { parentId: req.params.id, source: 'DASHBOARD' as const, occurredAt: b.occurredAt ?? new Date(), context: b.note };
    const data =
      b.type === 'BP' ? { ...base, type: b.type, valueNum: b.systolic, valueNum2: b.diastolic, unit: 'mmHg' }
      : b.type === 'SUGAR' ? { ...base, type: b.type, valueNum: b.value, unit: 'mg/dL' }
      : b.type === 'WEIGHT' ? { ...base, type: b.type, valueNum: b.value, unit: 'kg' }
      : { ...base, type: b.type, valueText: b.name.toLowerCase() };
    return reply.code(201).send(await prisma.healthEvent.create({ data }));
  });

  /** Remove a record, e.g. one the assistant misunderstood. */
  app.delete<{ Params: { id: string } }>('/events/:id', async (req, reply) => {
    const event = await prisma.healthEvent.findFirst({ where: { id: req.params.id, parent: { userId: req.user.sub } } });
    if (!event) throw notFound();
    await prisma.healthEvent.delete({ where: { id: event.id } });
    return reply.code(204).send();
  });

  app.get<{ Params: { id: string }; Querystring: { start?: string } }>('/parents/:id/schedule', async (req) => {
    await ownParent(req, req.params.id);
    const start = req.query.start && /^\d{4}-\d{2}-\d{2}$/.test(req.query.start) ? req.query.start : undefined;
    return weekSchedule(req.params.id, start);
  });

  app.get<{ Params: { id: string }; Querystring: { start?: string } }>('/parents/:id/report', async (req) => {
    await ownParent(req, req.params.id);
    const start = req.query.start && /^\d{4}-\d{2}-\d{2}$/.test(req.query.start) ? req.query.start : undefined;
    return weeklyReport(req.params.id, start);
  });

  /** The child's alerts, newest first. */
  app.get<{ Querystring: { parentId?: string; limit?: string } }>('/notifications', async (req) => {
    const where = { userId: req.user.sub, ...(req.query.parentId && { parentId: req.query.parentId }) };
    const [items, unread] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(Number(req.query.limit) || 30, 100),
        select: { id: true, kind: true, title: true, body: true, createdAt: true, readAt: true, whatsappAt: true, parentId: true, parent: { select: { name: true } } },
      }),
      prisma.notification.count({ where: { ...where, readAt: null } }),
    ]);
    return { items, unread };
  });

  app.post('/notifications/read', async (req) => {
    const { ids } = z.object({ ids: z.array(z.string()).max(200).optional() }).parse(req.body ?? {});
    const res = await prisma.notification.updateMany({
      where: { userId: req.user.sub, readAt: null, ...(ids && { id: { in: ids } }) },
      data: { readAt: new Date() },
    });
    return { updated: res.count };
  });

  app.post<{ Params: { id: string } }>('/parents/:id/ask', { config: { rateLimit: { max: 30, timeWindow: '1 hour' } } }, async (req) => {
    await ownParent(req, req.params.id);
    const { question } = z.object({ question: z.string().trim().min(2).max(300) }).parse(req.body);
    return askAboutParent(req.params.id, question);
  });

  app.get<{ Params: { id: string }; Querystring: { limit?: string } }>('/parents/:id/messages', async (req) => {
    await ownParent(req, req.params.id);
    const messages = await prisma.message.findMany({
      where: { parentId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(req.query.limit) || 50, 200),
      select: { id: true, direction: true, body: true, kind: true, buttons: true, payload: true, handledBy: true, toPhone: true, createdAt: true },
    });
    return messages.reverse();
  });

  app.get<{ Params: { id: string } }>('/parents/:id/routines', async (req) => {
    await ownParent(req, req.params.id);
    return prisma.routine.findMany({ where: { parentId: req.params.id }, orderBy: { timeOfDay: 'asc' } });
  });

  app.post<{ Params: { id: string } }>('/parents/:id/routines', async (req, reply) => {
    const parent = await ownParent(req, req.params.id);
    const data = routineData(routineFields.parse(req.body), parent.timezone);
    return reply.code(201).send(await prisma.routine.create({ data: { ...data, parentId: req.params.id } }));
  });

  app.patch<{ Params: { id: string } }>('/routines/:id', async (req) => {
    const current = await ownRoutine(req, req.params.id);
    const body = routineFields.partial().parse(req.body);
    const merged = { ...current, ...body };
    checkSchedule(merged);
    const scheduleChanged = ['timeOfDay', 'frequency', 'daysOfWeek', 'intervalDays', 'startDate', 'dayOfMonth'].some((k) => k in body);
    if (body.frequency === 'INTERVAL' && !merged.startDate) {
      const parent = await prisma.parentProfile.findUniqueOrThrow({ where: { id: current.parentId } });
      body.startDate = DateTime.now().setZone(parent.timezone).toISODate()!;
    }
    // Today's not-yet-sent occurrence is recreated under the new schedule on the next tick.
    if (scheduleChanged || body.active === false) {
      await prisma.routineOccurrence.deleteMany({ where: { routineId: req.params.id, status: 'SCHEDULED' } });
    }
    return prisma.routine.update({ where: { id: req.params.id }, data: body });
  });

  /** One-tap nudge: send this routine's reminder right now. */
  app.post<{ Params: { id: string } }>('/routines/:id/send-now', async (req, reply) => {
    const routine = await ownRoutine(req, req.params.id);
    const parent = await prisma.parentProfile.findUniqueOrThrow({ where: { id: routine.parentId } });
    if (parent.consentStatus !== 'GRANTED') return reply.code(409).send({ error: `${parent.name} hasn't said yes on WhatsApp yet` });
    await sendNow(routine.id);
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>('/alerts/:id/ack', async (req) => {
    const alert = await prisma.alert.findFirst({ where: { id: req.params.id, parent: { userId: req.user.sub } } });
    if (!alert) throw notFound();
    return prisma.alert.update({ where: { id: alert.id }, data: { acknowledgedAt: new Date() } });
  });
}
