import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { DateTime } from 'luxon';
import { normalizePhone } from '../lib/phone.js';

const timezone = z.string().max(64).refine((tz) => DateTime.local().setZone(tz).isValid, 'Unknown timezone');
const signupBody = z.object({ name: z.string().trim().min(1).max(60), email: z.string().trim().toLowerCase().email(), password: z.string().min(8).max(200), timezone: timezone.optional() });
const loginBody = z.object({ email: z.string().trim().toLowerCase(), password: z.string() });
const meBody = z.object({ name: z.string().trim().min(1).max(60).optional(), phone: z.string().nullable().optional(), whatsappAlerts: z.boolean().optional(), timezone: timezone.optional() });

const DUMMY_HASH = '0000000000000000:' + '0'.repeat(128);

const publicUser = (u: { id: string; name: string; email: string; phone: string | null; whatsappAlerts: boolean; timezone: string | null }) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, whatsappAlerts: u.whatsappAlerts, timezone: u.timezone });

export async function authRoutes(app: FastifyInstance) {
  // Slow down password guessing.
  const limited = { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } };

  app.post('/auth/signup', limited, async (req, reply) => {
    const body = signupBody.parse(req.body);
    if (await prisma.user.findUnique({ where: { email: body.email } })) return reply.code(409).send({ error: 'An account with this email already exists' });
    const user = await prisma.user.create({ data: { name: body.name, email: body.email, passwordHash: await hashPassword(body.password), timezone: body.timezone } });
    return { token: app.jwt.sign({ sub: user.id }, { expiresIn: '30d' }), user: publicUser(user) };
  });

  app.post('/auth/login', limited, async (req, reply) => {
    const body = loginBody.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    // Hash even for unknown emails so response time doesn't reveal who has an account.
    const ok = await verifyPassword(body.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) return reply.code(401).send({ error: 'Wrong email or password' });
    return { token: app.jwt.sign({ sub: user.id }, { expiresIn: '30d' }), user: publicUser(user) };
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
