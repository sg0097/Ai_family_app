import type { FastifyInstance } from 'fastify';
import { env } from '../lib/env.js';
import { parseMetaWebhook, verifyMetaSignature } from '../whatsapp/meta.js';
import { receiveInbound } from '../whatsapp/inbound.js';

export async function webhookRoutes(app: FastifyInstance) {
  // Keep the raw body: the signature is computed over the exact bytes Meta sent.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    (req as { rawBody?: string }).rawBody = body as string;
    try {
      done(null, JSON.parse(body as string));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  // Meta's subscription handshake.
  app.get<{ Querystring: Record<string, string> }>('/webhooks/whatsapp', async (req, reply) => {
    const q = req.query;
    if (q['hub.mode'] === 'subscribe' && env.META_VERIFY_TOKEN && q['hub.verify_token'] === env.META_VERIFY_TOKEN) {
      return reply.type('text/plain').send(q['hub.challenge']);
    }
    return reply.code(403).send();
  });

  // Acknowledge fast; processing happens on the inbound queue.
  app.post('/webhooks/whatsapp', async (req, reply) => {
    const raw = (req as { rawBody?: string }).rawBody ?? '';
    if (!verifyMetaSignature(raw, req.headers['x-hub-signature-256'] as string | undefined)) return reply.code(401).send();
    for (const m of parseMetaWebhook(req.body as Parameters<typeof parseMetaWebhook>[0])) await receiveInbound(m);
    return reply.code(200).send();
  });
}
