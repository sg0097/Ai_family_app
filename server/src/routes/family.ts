import type { FastifyInstance, FastifyRequest } from 'fastify';
import { DateTime } from 'luxon';
import { z } from 'zod';
import { refreshMemory } from '../care/memory.js';
import { checkIn, strings } from '../conversation/copy.js';
import { accessibleBy } from '../lib/access.js';
import { prisma } from '../lib/db.js';
import { isDemo, isDev, labs } from '../lib/env.js';
import { HttpError, notFound } from '../lib/http.js';
import { enqueueOutbound } from '../lib/queues.js';
import { FAMILY_PRICE_INR, FREE_PARENTS, FAMILY_PARENTS, planOf, requireFamily } from '../lib/plan.js';

// Voice notes, check-ins, memory and the plan: the parts of care that carry the child's own voice.

const MAX_CLIP_BYTES = 1_000_000;
const MAX_CLIP_SECONDS = 60;
const MAX_CLIPS = 20;
const MAX_CHECKINS_PER_DAY = 5;
const AUDIO = /^audio\/(mp4|ogg|webm|mpeg|aac)(;.*)?$/;

const clipBody = z.object({
  label: z.string().trim().min(1).max(60),
  mime: z.string().regex(AUDIO, 'Unsupported audio format'),
  seconds: z.number().int().min(1).max(MAX_CLIP_SECONDS),
  data: z.string().min(1), // base64
});
const checkInBody = z.object({ text: z.string().trim().min(1).max(200), voiceClipId: z.string().nullish() });

export async function familyRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  const parentFor = async (req: FastifyRequest, id: string) => {
    const p = await prisma.parentProfile.findFirst({ where: { id, ...accessibleBy(req.user.sub) } });
    if (!p) throw notFound();
    return p;
  };
  const clipFor = async (req: FastifyRequest, id: string) => {
    const c = await prisma.voiceClip.findFirst({ where: { id, parent: accessibleBy(req.user.sub) } });
    if (!c) throw notFound();
    return c;
  };

  // ── Voice library ──
  app.get<{ Params: { id: string } }>('/parents/:id/voice', async (req) => {
    const parent = await parentFor(req, req.params.id);
    const clips = await prisma.voiceClip.findMany({
      where: { parentId: parent.id },
      select: { id: true, label: true, seconds: true, mime: true, createdAt: true, author: { select: { name: true } }, routines: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return clips.map(({ author, ...c }) => ({ ...c, author: author.name }));
  });

  app.post<{ Params: { id: string } }>('/parents/:id/voice', { bodyLimit: 2_000_000 }, async (req, reply) => {
    const parent = await parentFor(req, req.params.id);
    await requireFamily('voice', { parentId: parent.id });
    const body = clipBody.parse(req.body);
    const data = Buffer.from(body.data, 'base64');
    if (!data.length) throw new HttpError(400, 'That recording is empty');
    if (data.length > MAX_CLIP_BYTES) throw new HttpError(413, 'Keep voice notes under a minute');
    if ((await prisma.voiceClip.count({ where: { parentId: parent.id } })) >= MAX_CLIPS) throw new HttpError(409, `Up to ${MAX_CLIPS} voice notes; delete one to add another`);
    const clip = await prisma.voiceClip.create({ data: { parentId: parent.id, authorId: req.user.sub, label: body.label, mime: body.mime, seconds: body.seconds, data } });
    return reply.code(201).send({ id: clip.id });
  });

  app.get<{ Params: { id: string } }>('/voice/:id/audio', async (req, reply) => {
    const clip = await clipFor(req, req.params.id);
    return reply.header('Content-Type', clip.mime).header('Cache-Control', 'private, max-age=3600').send(Buffer.from(clip.data));
  });

  app.delete<{ Params: { id: string } }>('/voice/:id', async (req, reply) => {
    const clip = await clipFor(req, req.params.id);
    await prisma.voiceClip.delete({ where: { id: clip.id } }); // reminders using it go back to text only
    return reply.code(204).send();
  });

  /** Play this clip with a reminder (or stop, with null). */
  app.put<{ Params: { id: string } }>('/routines/:id/voice', async (req) => {
    const { voiceClipId } = z.object({ voiceClipId: z.string().nullable() }).parse(req.body);
    const routine = await prisma.routine.findFirst({ where: { id: req.params.id, parent: accessibleBy(req.user.sub) } });
    if (!routine) throw notFound();
    if (voiceClipId) {
      const clip = await clipFor(req, voiceClipId);
      if (clip.parentId !== routine.parentId) throw notFound();
      await requireFamily('voice', { parentId: routine.parentId });
    }
    await prisma.routine.update({ where: { id: routine.id }, data: { voiceClipId } });
    return { ok: true };
  });

  // ── Check-ins ──
  app.get<{ Params: { id: string } }>('/parents/:id/check-ins', async (req) => {
    const parent = await parentFor(req, req.params.id);
    const recent = await prisma.checkIn.findMany({
      where: { parentId: parent.id },
      include: { from: { select: { name: true } }, voiceClip: { select: { label: true } } },
      orderBy: { createdAt: 'desc' },
      take: 8,
    });
    return {
      ideas: strings(parent.language).checkInIdeas(parent.name),
      recent: recent.map((c) => ({ id: c.id, text: c.text, from: c.from.name, voice: c.voiceClip?.label ?? null, answer: c.answer, answeredAt: c.answeredAt, createdAt: c.createdAt })),
    };
  });

  app.post<{ Params: { id: string } }>('/parents/:id/check-ins', { config: { rateLimit: { max: 20, timeWindow: '1 hour' } } }, async (req, reply) => {
    const parent = await parentFor(req, req.params.id);
    if (parent.consentStatus !== 'GRANTED') throw new HttpError(409, `${parent.name} hasn’t said yes on WhatsApp yet`);
    await requireFamily('checkin', { parentId: parent.id });
    const body = checkInBody.parse(req.body);
    if (body.voiceClipId) {
      const clip = await clipFor(req, body.voiceClipId);
      if (clip.parentId !== parent.id) throw notFound();
      await requireFamily('voice', { parentId: parent.id });
    }
    const startOfDay = DateTime.utc().setZone(parent.timezone).startOf('day').toJSDate();
    if ((await prisma.checkIn.count({ where: { parentId: parent.id, createdAt: { gte: startOfDay } } })) >= MAX_CHECKINS_PER_DAY) {
      throw new HttpError(429, `${MAX_CHECKINS_PER_DAY} check-ins already went today. A call might be nicer now.`);
    }
    const me = await prisma.user.findUniqueOrThrow({ where: { id: req.user.sub } });
    const family = me.name.trim().split(/\s+/)[0];
    const row = await prisma.checkIn.create({ data: { parentId: parent.id, fromId: me.id, text: body.text, voiceClipId: body.voiceClipId ?? null } });
    await enqueueOutbound({ parentId: parent.id, toPhone: parent.phone, voiceClipId: body.voiceClipId ?? undefined, ...checkIn(parent, family, row.id, body.text) });
    return reply.code(201).send({ id: row.id });
  });

  // ── Memory ──
  app.get<{ Params: { id: string } }>('/parents/:id/memory', async (req) => {
    const parent = await parentFor(req, req.params.id);
    if (!labs) throw notFound();
    await refreshMemory(parent.id);
    return prisma.memory.findMany({ where: { parentId: parent.id, status: { not: 'DISMISSED' } }, orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }] });
  });

  app.patch<{ Params: { id: string } }>('/memory/:id', async (req) => {
    const { status } = z.object({ status: z.enum(['KEPT', 'DISMISSED']) }).parse(req.body);
    const m = await prisma.memory.findFirst({ where: { id: req.params.id, parent: accessibleBy(req.user.sub) } });
    if (!m) throw notFound();
    return prisma.memory.update({ where: { id: m.id }, data: { status } });
  });

  // ── Plan ──
  app.get('/plan', async (req) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user.sub } });
    return { ...planOf(user), freeParents: FREE_PARENTS, familyParents: FAMILY_PARENTS, payments: isDemo || isDev ? 'demo' : 'unavailable' };
  });

  // Payments (Razorpay) aren't connected yet. In the demo, upgrading is simulated and free.
  app.post('/plan/upgrade', async (req) => {
    if (!isDemo && !isDev) throw new HttpError(503, 'Payments aren’t set up yet');
    const user = await prisma.user.update({
      where: { id: req.user.sub },
      data: { plan: 'FAMILY', planRenewsAt: DateTime.utc().plus({ months: 1 }).toJSDate() },
    });
    return { ...planOf(user), priceInr: FAMILY_PRICE_INR };
  });

  // Demo only, like upgrading: back to the free plan straight away. Nothing already set up is
  // deleted; Family features just stop accepting new things.
  app.post('/plan/cancel', async (req) => {
    if (!isDemo && !isDev) throw new HttpError(503, 'Payments aren’t set up yet');
    const updated = await prisma.user.update({ where: { id: req.user.sub }, data: { plan: 'FREE', planRenewsAt: null, trialEndsAt: null } });
    return planOf(updated);
  });
}
