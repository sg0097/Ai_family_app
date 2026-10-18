import { Prisma } from '@prisma/client';
import { prisma } from '../lib/db.js';
import { maskPhone, normalizePhone } from '../lib/phone.js';
import { enqueueInbound } from '../lib/queues.js';
import type { InboundMessage } from './types.js';

/** Store an inbound message and queue it for processing. Safe to call twice for the same message. */
export async function receiveInbound(m: InboundMessage): Promise<'queued' | 'duplicate' | 'unknown_sender'> {
  const phone = normalizePhone(m.from);
  const parent = phone ? await prisma.parentProfile.findUnique({ where: { phone } }) : null;
  if (!parent) {
    console.warn(`[inbound] message from unknown number ${maskPhone(m.from)}, ignored`);
    return 'unknown_sender';
  }
  try {
    const [msg] = await prisma.$transaction([
      prisma.message.create({
        data: {
          parentId: parent.id,
          direction: 'IN',
          body: m.text,
          kind: m.buttonPayload ? 'button' : 'text',
          payload: m.buttonPayload,
          waMessageId: m.waMessageId,
          createdAt: m.timestamp,
        },
      }),
      prisma.parentProfile.update({ where: { id: parent.id }, data: { lastInboundAt: m.timestamp } }),
    ]);
    await enqueueInbound(msg.id);
    return 'queued';
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return 'duplicate';
    throw err;
  }
}
