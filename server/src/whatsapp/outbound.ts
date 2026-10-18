import { prisma } from '../lib/db.js';
import { maskPhone } from '../lib/phone.js';
import { whatsapp } from './index.js';
import type { SessionMessage, TemplateMessage } from './types.js';

export interface OutboundJob {
  parentId?: string; // conversation this belongs to
  toPhone: string;
  session: SessionMessage;
  template?: TemplateMessage; // needed when the 24h window is closed
  alwaysTemplate?: boolean; // recipient's window is unknown (e.g. alerts to the child)
  windowKnownOpen?: boolean; // caller checked the 24h window itself (e.g. the profile is being deleted)
  occurrenceId?: string;
}

const SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Send one message, picking a free-form session message or a paid template depending on the 24h window. */
export async function sendOutbound(job: OutboundJob) {
  const parent = job.parentId ? await prisma.parentProfile.findUnique({ where: { id: job.parentId } }) : null;
  // The parent was removed after this was queued (or they said STOP): send nothing.
  if (job.parentId && !parent) return;
  if (parent && parent.consentStatus !== 'GRANTED' && job.occurrenceId) return;
  const windowOpen =
    !job.alwaysTemplate && (job.windowKnownOpen || (!!parent?.lastInboundAt && Date.now() - parent.lastInboundAt.getTime() < SESSION_WINDOW_MS));

  const log = (kind: string, waMessageId: string | null) =>
    prisma.message.create({
      data: {
        parentId: job.parentId,
        direction: 'OUT',
        toPhone: job.toPhone,
        body: job.session.text,
        kind,
        buttons: job.session.buttons ? (job.session.buttons as object[]) : undefined,
        waMessageId,
        occurrenceId: job.occurrenceId,
      },
    });

  if (windowOpen) {
    await log('session', await whatsapp.sendSession(job.toPhone, job.session));
  } else if (job.template) {
    await log('template', await whatsapp.sendTemplate(job.toPhone, job.template, job.session));
  } else {
    // Free-form text outside the window would be rejected by WhatsApp.
    console.warn(`[outbound] dropped message to ${maskPhone(job.toPhone)}: session window closed and no template`);
    await log('dropped', null);
  }
}
