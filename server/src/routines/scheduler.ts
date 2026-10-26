import type { Medicine, ParentProfile, Routine } from '@prisma/client';
import { DateTime } from 'luxon';
import { prisma } from '../lib/db.js';
import { enqueueOutbound } from '../lib/queues.js';
import { reminder } from '../conversation/copy.js';
import { runCareRules } from '../care/rules.js';
import { HttpError } from '../lib/http.js';
import { isDueOn } from './schedule.js';

/** Don't send a reminder that is this late (e.g. a routine created at 11:00 for 08:00 starts tomorrow). */
const STALE_AFTER_MINUTES = 120;

/**
 * Runs every minute. No AI here, just four steps:
 *  1. create today's occurrence for each routine due today (in the parent's timezone)
 *  2. send reminders that are due
 *  3. close yesterday's unanswered questions as NO_RESPONSE (missing data, not a missed dose)
 *  4. care rules: follow-ups to the parent, alerts to the child
 */
export async function tick(now: DateTime = DateTime.utc()) {
  const parents = await prisma.parentProfile.findMany({
    where: { consentStatus: 'GRANTED' },
    include: { routines: { where: { active: true } } },
  });

  for (const parent of parents) {
    const local = now.setZone(parent.timezone);
    const today = local.toISODate()!;

    for (const routine of parent.routines) await materialize(routine, local, now);

    await prisma.routineOccurrence.updateMany({
      where: { parentId: parent.id, status: { in: ['SCHEDULED', 'SENT'] }, localDate: { lt: today } },
      data: { status: 'NO_RESPONSE' },
    });
  }

  const due = await prisma.routineOccurrence.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledFor: { lte: now.toJSDate(), gte: now.minus({ minutes: STALE_AFTER_MINUTES }).toJSDate() },
      parent: { consentStatus: 'GRANTED' },
      routine: { active: true },
    },
    include: { routine: { include: { medicine: true } }, parent: true },
  });
  for (const occ of due) await sendReminder(occ.id, occ.parent, occ.routine, now.toJSDate());
  const care = await runCareRules(now);
  return { parents: parents.length, sent: due.length, ...care };
}

async function materialize(routine: Routine, local: DateTime, now: DateTime) {
  if (!isDueOn(routine, local)) return;
  const [hour, minute] = routine.timeOfDay.split(':').map(Number);
  const scheduled = local.set({ hour, minute, second: 0, millisecond: 0 });
  const localDate = local.toISODate()!;

  // Too late to remind today (routine added or consent given after the slot): start tomorrow
  // instead of creating a question that could only ever show as unanswered.
  if (scheduled < now.minus({ minutes: STALE_AFTER_MINUTES })) return;
  await prisma.routineOccurrence.createMany({
    data: [{ routineId: routine.id, parentId: routine.parentId, localDate, scheduledFor: scheduled.toJSDate() }],
    skipDuplicates: true,
  });
}

/** Claim the occurrence (SCHEDULED → SENT) so overlapping ticks can't double-send, then queue the message. */
export async function sendReminder(occurrenceId: string, parent: ParentProfile, routine: Routine & { medicine?: Medicine | null }, at: Date = new Date()) {
  const claimed = await prisma.routineOccurrence.updateMany({
    where: { id: occurrenceId, status: 'SCHEDULED' },
    data: { status: 'SENT', sentAt: at, followUpAt: null, childAlertedAt: null },
  });
  if (claimed.count !== 1) return;
  await enqueueOutbound({ parentId: parent.id, toPhone: parent.phone, occurrenceId, voiceClipId: routine.voiceClipId ?? undefined, ...reminder(parent, routine, occurrenceId) });
}

/** One-tap nudge: (re)open today's occurrence for a routine and send its reminder immediately. */
export async function sendNow(routineId: string) {
  const routine = await prisma.routine.findUniqueOrThrow({ where: { id: routineId }, include: { parent: true, medicine: true } });
  const localDate = DateTime.utc().setZone(routine.parent.timezone).toISODate()!;
  const existing = await prisma.routineOccurrence.findUnique({ where: { routineId_localDate: { routineId, localDate } } });
  if (existing?.status === 'DONE') throw new HttpError(409, 'Already done today');
  const occ = await prisma.routineOccurrence.upsert({
    where: { routineId_localDate: { routineId, localDate } },
    create: { routineId, parentId: routine.parentId, localDate, scheduledFor: new Date() },
    update: { status: 'SCHEDULED', respondedAt: null, note: null },
  });
  await sendReminder(occ.id, routine.parent, routine);
}
