import type { FastifyInstance } from 'fastify';
import { env } from '../lib/env.js';
import { parseMetaStatuses, parseMetaWebhook, verifyMetaSignature } from '../whatsapp/meta.js';
import { receiveInbound } from '../whatsapp/inbound.js';
import { verifyWebhookSignature } from '../lib/razorpay.js';
import { activatePayment } from '../lib/billing.js';
import { prisma } from '../lib/db.js';

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
    const body = req.body as Parameters<typeof parseMetaWebhook>[0];
    for (const m of parseMetaWebhook(body)) await receiveInbound(m);
    // Delivery receipts: keep the furthest state, and remember why a send failed.
    const rank: Record<string, number> = { sent: 1, delivered: 2, read: 3, failed: 4 };
    for (const r of parseMetaStatuses(body)) {
      const msg = await prisma.message.findUnique({ where: { waMessageId: r.waMessageId }, select: { id: true, deliveryStatus: true } });
      if (!msg || (rank[msg.deliveryStatus ?? ''] ?? 0) >= (rank[r.status] ?? 0)) continue;
      await prisma.message.update({ where: { id: msg.id }, data: { deliveryStatus: r.status, failureReason: r.failureReason } });
    }
    return reply.code(200).send();
  });

  // Razorpay tells us a payment was captured or failed, even if the customer closed the tab.
  app.post('/webhooks/razorpay', async (req, reply) => {
    const raw = (req as { rawBody?: string }).rawBody ?? '';
    if (!verifyWebhookSignature(raw, req.headers['x-razorpay-signature'] as string | undefined)) return reply.code(401).send();
    const body = req.body as { event?: string; payload?: { payment?: { entity?: { id?: string; order_id?: string } } } };
    const p = body.payload?.payment?.entity;
    if (p?.order_id && p.id) {
      if (body.event === 'payment.captured' || body.event === 'order.paid') await activatePayment(p.order_id, p.id);
      else if (body.event === 'payment.failed') await prisma.payment.updateMany({ where: { orderId: p.order_id, status: 'CREATED' }, data: { status: 'FAILED' } });
    }
    return reply.code(200).send();
  });
}
