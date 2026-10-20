import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { prisma } from './lib/db.js';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';
import { env, isDemo, isDev } from './lib/env.js';
import { authRoutes } from './routes/auth.js';
import { devRoutes } from './routes/dev.js';
import { parentRoutes } from './routes/parents.js';
import { webhookRoutes } from './routes/webhooks.js';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string };
    user: { sub: string };
  }
}
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export async function buildApp() {
  // Behind a host's proxy (Render), use the forwarded client address, or every visitor would
  // share one IP and one rate limit.
  const app = Fastify({ logger: { level: 'info' }, trustProxy: env.NODE_ENV === 'production' });

  await app.register(cors, { origin: env.WEB_ORIGIN });
  await app.register(jwt, { secret: env.JWT_SECRET });
  // Off by default; switched on per route where guessing or cost matters (sign-in, Ask).
  await app.register(rateLimit, { global: false });
  app.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: 'Please sign in' });
    }
    // A valid token for a deleted account is still a signed-out user.
    if (!(await prisma.user.findUnique({ where: { id: req.user.sub }, select: { id: true } }))) {
      return reply.code(401).send({ error: 'Please sign in' });
    }
  });

  app.setErrorHandler((err: Error, _req, reply) => {
    if (err instanceof ZodError) return reply.code(400).send({ error: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) app.log.error(err);
    return reply.code(status).send({ error: status >= 500 ? 'Something went wrong' : err.message });
  });

  await app.register(
    async (api) => {
      api.get('/health', async () => ({ ok: true, devTools: isDev, demo: isDemo }));
      await api.register(authRoutes);
      await api.register(parentRoutes);
      await api.register(webhookRoutes);
      if (isDev) await api.register(devRoutes);
    },
    { prefix: '/api' },
  );

  // In a deployment the built website is served from here too: one service, one URL.
  const web = fileURLToPath(new URL('../../web/dist', import.meta.url));
  if (existsSync(web)) {
    await app.register(fastifyStatic, { root: web, wildcard: false });
    app.setNotFoundHandler((req, reply) =>
      req.url.startsWith('/api/') ? reply.code(404).send({ error: 'Not found' }) : reply.sendFile('index.html'),
    );
  }
  return app;
}
