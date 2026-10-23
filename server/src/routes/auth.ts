import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { createHash, randomBytes } from 'node:crypto';
import { DateTime } from 'luxon';
import { sendEmail } from '../lib/email.js';
import { appUrl } from '../lib/env.js';
import { normalizePhone } from '../lib/phone.js';

const timezone = z.string().max(64).refine((tz) => DateTime.local().setZone(tz).isValid, 'Unknown timezone');
const signupBody = z.object({ name: z.string().trim().min(1).max(60), email: z.string().trim().toLowerCase().email(), password: z.string().min(8).max(200), timezone: timezone.optional() });
const loginBody = z.object({ email: z.string().trim().toLowerCase(), password: z.string() });
const meBody = z.object({ name: z.string().trim().min(1).max(60).optional(), phone: z.string().nullable().optional(), whatsappAlerts: z.boolean().optional(), timezone: timezone.optional() });

const RESET_TTL_MS = 60 * 60 * 1000;
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

const DUMMY_HASH = '0000000000000000:' + '0'.repeat(128);

const publicUser = (u: { id: string; name: string; email: string; phone: string | null; whatsappAlerts: boolean; timezone: string | null }) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, whatsappAlerts: u.whatsappAlerts, timezone: u.timezone });

export async function authRoutes(app: FastifyInstance) {
  const issue = (u: { id: string; tokenVersion: number }) => app.jwt.sign({ sub: u.id, v: u.tokenVersion }, { expiresIn: '30d' });

  // Slow down password guessing.
  const limited = { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } };

  app.post('/auth/signup', limited, async (req, reply) => {
    const body = signupBody.parse(req.body);
    if (await prisma.user.findUnique({ where: { email: body.email } })) return reply.code(409).send({ error: 'An account with this email already exists' });
    const user = await prisma.user.create({ data: { name: body.name, email: body.email, passwordHash: await hashPassword(body.password), timezone: body.timezone } });
    return { token: issue(user), user: publicUser(user) };
  });

  app.post('/auth/login', limited, async (req, reply) => {
    const body = loginBody.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    // Hash even for unknown emails so response time doesn't reveal who has an account.
    const ok = await verifyPassword(body.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) return reply.code(401).send({ error: 'Wrong email or password' });
    return { token: issue(user), user: publicUser(user) };
  });

  /** Always answers the same way, so it can't be used to find out who has an account. */
  app.post('/auth/forgot', limited, async (req) => {
    const { email } = z.object({ email: z.string().trim().toLowerCase().email() }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const token = randomBytes(32).toString('base64url');
      await prisma.passwordReset.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) } });
      await sendEmail({
        to: user.email,
        subject: 'Reset your Family Care password',
        text: `Hi ${user.name},\n\nUse this link to choose a new password. It works once, for the next hour:\n${appUrl()}/reset/${token}\n\nIf you didn't ask for this, you can ignore this email; your password stays the same.\n\nFamily Care`,
      });
    }
    return { ok: true };
  });

  app.post('/auth/reset', limited, async (req, reply) => {
    const { token, password } = z.object({ token: z.string().min(20).max(200), password: z.string().min(8).max(200) }).parse(req.body);
    const reset = await prisma.passwordReset.findUnique({ where: { tokenHash: sha256(token) } });
    if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
      return reply.code(400).send({ error: 'This link has expired or was already used. Ask for a new one.' });
    }
    const user = await prisma.$transaction(async (tx) => {
      await tx.passwordReset.updateMany({ where: { userId: reset.userId, usedAt: null }, data: { usedAt: new Date() } });
      // New password, and every older session is signed out.
      return tx.user.update({ where: { id: reset.userId }, data: { passwordHash: await hashPassword(password), tokenVersion: { increment: 1 } } });
    });
    return { token: issue(user), user: publicUser(user) };
  });

  app.get('/me', { preHandler: app.authenticate }, async (req) => {
    return publicUser(await prisma.user.findUniqueOrThrow({ where: { id: req.user.sub } }));
  });

  /** Delete the account and every parent and record in it. Needs the password. */
  app.delete('/me', { preHandler: app.authenticate, ...limited }, async (req, reply) => {
    const { password } = z.object({ password: z.string() }).parse(req.body ?? {});
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user.sub } });
    if (!(await verifyPassword(password, user.passwordHash))) return reply.code(401).send({ error: 'That password isn’t right' });
    await prisma.user.delete({ where: { id: user.id } }); // cascades to parents and all their data
    return reply.code(204).send();
  });

  app.patch('/me', { preHandler: app.authenticate }, async (req, reply) => {
    const body = meBody.parse(req.body);
    const phone = body.phone ? normalizePhone(body.phone) : body.phone;
    if (body.phone && !phone) return reply.code(400).send({ error: 'Enter a valid phone number' });
    return publicUser(await prisma.user.update({ where: { id: req.user.sub }, data: { name: body.name, phone, whatsappAlerts: body.whatsappAlerts, timezone: body.timezone } }));
  });
}
