import { DateTime } from 'luxon';
import { appointmentReminder, followUp } from '../conversation/copy.js';
import { daysLeft } from './refill.js';
import { prisma } from '../lib/db.js';
import { enqueueOutbound } from '../lib/queues.js';
import { notifyChild } from './notify.js';
import { signature } from '../routines/scheduler.js';

// Care rules: deterministic follow-ups and escalation. Runs every minute after the scheduler.
//   1. Follow up once with the parent if a reminder is unanswered (or "not yet") for a while.
//   2. Tell the child ONCE a day (evening): "Mummy: 4 of 5 done today", with what's left.
// The child isn't pinged per task. Only HELP and serious symptoms interrupt (see processor.ts).
// "Not done" is stated as a fact about replies, never as a missed dose.

const QUIET_START = 22; // no follow-ups to parents from 10 PM…
const QUIET_END = 7; // …to 7 AM, their time

export async function runCareRules(now: DateTime = DateTime.utc()) {
  const open = await prisma.routineOccurrence.findMany({
    where: {
      status: { in: ['SENT', 'NOT_DONE'] },
      OR: [{ followUpAt: null }, { childAlertedAt: null }],
      routine: { active: true },
      parent: { consentStatus: 'GRANTED' },
    },
    include: { routine: { include: { medicine: true } }, parent: true },
  });

  let followUps = 0;
  for (const occ of open) {
    const { routine, parent } = occ;
    const local = now.setZone(parent.timezone);
    if (occ.localDate !== local.toISODate()) continue; // only today's questions

    // 1. One gentle follow-up to the parent.
    const since = occ.status === 'NOT_DONE' ? occ.respondedAt : occ.sentAt;
    if (!occ.followUpAt && routine.followUpMinutes != null && since && local.hour >= QUIET_END && local.hour < QUIET_START) {
      if (now >= DateTime.fromJSDate(since).plus({ minutes: routine.followUpMinutes })) {
        const claimed = await prisma.routineOccurrence.updateMany({ where: { id: occ.id, followUpAt: null }, data: { followUpAt: now.toJSDate() } });
        if (claimed.count === 1) {
          await enqueueOutbound({ parentId: parent.id, toPhone: parent.phone, occurrenceId: occ.id, ...followUp(parent, routine, occ.id, await signature(parent)) });
          occ.followUpAt = now.toJSDate();
          followUps++;
        }
      }
    }

  }

  const summaries = await dailySummaries(now);
  const appointments = await appointmentReminders(now);
  return { followUps, summaries, appointments };
}

const APPT_EVENING_HOUR = 19; // the evening before, parent's time
const APPT_SAME_DAY_HOURS = 3; // and this long before, on the day

/** Doctor appointments: remind the parent the evening before and on the day; tell the family the evening before. */
export async function appointmentReminders(now: DateTime): Promise<number> {
  const upcoming = await prisma.appointment.findMany({
    where: { status: 'UPCOMING', at: { gt: now.toJSDate(), lt: now.plus({ days: 2 }).toJSDate() }, parent: { consentStatus: 'GRANTED' } },
    include: { parent: true },
  });
  let n = 0;
  for (const a of upcoming) {
    const local = now.setZone(a.parent.timezone);
    const at = DateTime.fromJSDate(a.at).setZone(a.parent.timezone);
    const tomorrow = at.hasSame(local.plus({ days: 1 }), 'day');

    if (tomorrow && local.hour >= APPT_EVENING_HOUR && !a.remindedDayBefore) {
      const claimed = await prisma.appointment.updateMany({ where: { id: a.id, remindedDayBefore: null }, data: { remindedDayBefore: now.toJSDate() } });
      if (claimed.count !== 1) continue;
      if (a.remindParent) await enqueueOutbound({ parentId: a.parentId, toPhone: a.parent.phone, ...appointmentReminder(a.parent, a, 'tomorrow') });
      n++;
    }

    const soon = at.hasSame(local, 'day') && at.diff(local, 'hours').hours <= APPT_SAME_DAY_HOURS && local.hour >= 7;
    if (soon && a.remindParent && !a.remindedSameDay) {
      const claimed = await prisma.appointment.updateMany({ where: { id: a.id, remindedSameDay: null }, data: { remindedSameDay: now.toJSDate() } });
      if (claimed.count !== 1) continue;
      await enqueueOutbound({ parentId: a.parentId, toPhone: a.parent.phone, ...appointmentReminder(a.parent, a, 'today') });
      n++;
    }
  }
  return n;
}

const SUMMARY_HOUR = 20; // 8 PM, parent's time

/**
 * The one message the child gets about the day: "Mummy: 4 of 5 done today", plus what's left,
 * tablets running low and tomorrow's doctor visit. Once per parent per day, in the app and
 * (if they set a number and WhatsApp alerts) on WhatsApp. Free for everyone.
 */
export async function dailySummaries(now: DateTime): Promise<number> {
  const parents = await prisma.parentProfile.findMany({ where: { consentStatus: 'GRANTED' } });
  let n = 0;
  for (const p of parents) {
    const local = now.setZone(p.timezone);
    if (local.hour < SUMMARY_HOUR) continue;
    const today = local.toISODate()!;
    const key = `daily:${p.id}:${today}`;
    if (await prisma.notification.findUnique({ where: { dedupeKey: key } })) continue;

    const occs = await prisma.routineOccurrence.findMany({
      where: { parentId: p.id, localDate: today, scheduledFor: { lte: now.toJSDate() } },
      include: { routine: true },
      orderBy: { scheduledFor: 'asc' },
    });
    if (!occs.length) continue;
    const done = occs.filter((o) => o.status === 'DONE');
    const left = occs.filter((o) => o.status !== 'DONE').map((o) => o.routine.name);

    const lines = [left.length ? `Not done: ${left.join(', ')}.` : 'Everything was done. A nice day.'];
    const meds = await prisma.medicine.findMany({ where: { parentId: p.id, active: true, pillsLeft: { not: null } }, include: { routines: true } });
    for (const m of meds) {
      const days = daysLeft(m, m.routines);
      if (days != null && days <= m.refillAlertDays) lines.push(`${m.name} is running low (${days === 0 ? 'none left' : `about ${days} day${days === 1 ? '' : 's'} left`}).`);
    }
    const tomorrow = local.plus({ days: 1 });
    const appts = await prisma.appointment.findMany({ where: { parentId: p.id, status: 'UPCOMING', at: { gte: tomorrow.startOf('day').toJSDate(), lte: tomorrow.endOf('day').toJSDate() } } });
    for (const a of appts) lines.push(`Tomorrow: ${a.title} at ${DateTime.fromJSDate(a.at).setZone(p.timezone).toFormat('h:mm a')}.`);

    const created = await notifyChild({
      parentId: p.id,
      kind: 'DAILY',
      title: `${p.name}: ${done.length} of ${occs.length} done today`,
      body: lines.join(' '),
      dedupeKey: key,
    });
    if (created) n++;
  }
  return n;
}
