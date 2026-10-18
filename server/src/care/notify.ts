import { Prisma } from '@prisma/client';
import { prisma } from '../lib/db.js';
import { enqueueOutbound } from '../lib/queues.js';

export type NotificationKind = 'NOT_DONE' | 'RESOLVED' | 'SILENCE' | 'HELP' | 'REPORT' | 'SYMPTOM';

interface NotifyInput {
  parentId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  dedupeKey: string;
  routineId?: string;
  occurrenceId?: string;
  /** Always goes to WhatsApp too, like HELP, whatever the child's alert setting. */
  urgent?: boolean;
}

/**
 * Tell the child something. Idempotent on `dedupeKey`, so the care rules can run every minute
 * without repeating themselves. Also goes to the child's WhatsApp when they've set a number.
 * Returns false if this notification already existed.
 */
export async function notifyChild(input: NotifyInput): Promise<boolean> {
  const parent = await prisma.parentProfile.findUniqueOrThrow({ where: { id: input.parentId }, include: { user: true } });
  const user = parent.user;
  // A child abroad reads "8:00 AM" as their own time unless told otherwise.
  if (user.timezone && user.timezone !== parent.timezone && /\d{1,2}:\d{2}\s?[AP]M/i.test(input.body)) {
    input = { ...input, body: `${input.body} (Times are ${parent.name}’s time.)` };
  }
  let id: string;
  try {
    const { urgent: _urgent, ...data } = input;
    ({ id } = await prisma.notification.create({ data: { ...data, userId: user.id } }));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return false;
    throw err;
  }

  // HELP and serious symptoms always go to WhatsApp; everything else only if the child wants it there.
  const toWhatsApp = user.phone && (input.kind === 'HELP' || input.urgent || user.whatsappAlerts);
  if (toWhatsApp) {
    const text = `${input.title}\n${input.body}`;
    await enqueueOutbound({
      parentId: parent.id,
      toPhone: user.phone!,
      alwaysTemplate: true, // the child's 24h window is unknown
      session: { text },
      template: { name: 'child_update', params: [user.name, input.title, input.body] },
    });
    await prisma.notification.update({ where: { id }, data: { whatsappAt: new Date() } });
  }
  return true;
}
