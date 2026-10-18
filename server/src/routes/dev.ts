import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { notFound } from '../lib/http.js';
import { tick } from '../routines/scheduler.js';
import { receiveInbound } from '../whatsapp/inbound.js';
import { seedDemoParent } from './demo-seed.js';

const inboundBody = z.object({ parentId: z.string(), text: z.string().min(1).max(2000), payload: z.string().optional() });

/** Only registered with the fake WhatsApp provider: lets the simulator play the parent's phone. */
export async function devRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.post('/dev/inbound', async (req) => {
    const body = inboundBody.parse(req.body);
    const parent = await prisma.parentProfile.findFirst({ where: { id: body.parentId, userId: req.user.sub } });
    if (!parent) throw notFound();
    const status = await receiveInbound({
      waMessageId: `fake-in-${randomUUID()}`,
      from: parent.phone,
      text: body.text,
      buttonPayload: body.payload,
      timestamp: new Date(),
    });
    return { status };
  });

  app.post('/dev/tick', async () => tick());

  app.post('/dev/seed-demo', async (req, reply) => reply.code(201).send({ id: (await seedDemoParent(req.user.sub)).id }));
}
