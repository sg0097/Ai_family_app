import { Prisma } from '@prisma/client';
import { careTeam } from '../lib/access.js';
import { prisma } from '../lib/db.js';
import { enqueueOutbound } from '../lib/queues.js';

export type NotificationKind = 'NOT_DONE' | 'RESOLVED' | 'SILENCE' | 'HELP' | 'REPORT' | 'SYMPTOM' | 'REFILL' | 'APPOINTMENT' | 'TEAM' | 'CHECKIN' | 'MIDDAY';

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
 * Tell everyone caring for the parent. Idempotent on `dedupeKey` (per person), so the care
 * rules can run every minute without repeating themselves. Also goes to each person's WhatsApp
 * when they've set a number. Returns false if nobody needed telling (all already notified).
 */
export async function notifyChild(input: NotifyInput): Promise<boolean> {
  const parent = await prisma.parentProfile.findUniqueOrThrow({ where: { id: input.parentId } });
  const team = await careTeam(parent.id);
  let created = false;
  for (const [i, user] of team.entries()) {
    // The owner keeps the plain key (so existing checks still find it); members get their own.
    const dedupeKey = i === 0 ? input.dedupeKey : `${input.dedupeKey}:${user.id}`;
    // A child abroad reads "8:00 AM" as their own time unless told otherwise.
    const body = user.timezone && user.timezone !== parent.timezone && /\d{1,2}:\d{2}\s?[AP]M/i.test(input.body)
      ? `${input.body} (Times are ${parent.name}’s time.)`
      : input.body;
    let id: string;
    try {
      const { urgent: _urgent, ...data } = input;
      ({ id } = await prisma.notification.create({ data: { ...data, body, dedupeKey, userId: user.id } }));
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') continue;
      throw err;
    }
    created = true;

    // HELP and serious symptoms always go to WhatsApp; everything else only if they want it there.
    if (user.phone && (input.kind === 'HELP' || input.urgent || user.whatsappAlerts)) {
      await enqueueOutbound({
        parentId: parent.id,
        toPhone: user.phone,
        alwaysTemplate: true, // their 24h window is unknown
        session: { text: `${input.title}\n${body}` },
        template: { name: 'child_update', params: [user.name, input.title, body] },
      });
      await prisma.notification.update({ where: { id }, data: { whatsappAt: new Date() } });
    }
  }
  return created;
}
