import { DateTime } from 'luxon';
import { appointmentReminder, followUp } from '../conversation/copy.js';
import { daysLeft } from './refill.js';
import { prisma } from '../lib/db.js';
import { enqueueOutbound } from '../lib/queues.js';
import { weeklyReport } from '../insights/report.js';
import { notifyChild } from './notify.js';

// Care rules: deterministic follow-ups and escalation. Runs every minute after the scheduler.
//   1. Follow up once with the parent if a reminder is unanswered (or "not yet") for a while.
//   2. Tell the child if it still isn't done later that day.
//   3. Tell the child if reminders are going out but nothing has come back for a day.
// "Not done yet" is stated as a fact about replies, never as a missed dose.

const QUIET_START = 22; // no follow-ups to parents from 10 PM…
const QUIET_END = 7; // …to 7 AM, their time
const SILENCE_HOURS = 24;

const fmtTime = (d: Date, zone: string) => DateTime.fromJSDate(d).setZone(zone).toFormat('h:mm a');

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
  let alerts = 0;
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
          await enqueueOutbound({ parentId: parent.id, toPhone: parent.phone, occurrenceId: occ.id, ...followUp(parent, routine, occ.id) });
          occ.followUpAt = now.toJSDate();
          followUps++;
        }
      }
    }

    // 2. Escalate to the child.
    if (!occ.childAlertedAt && routine.alertAfterMinutes != null && now >= DateTime.fromJSDate(occ.scheduledFor).plus({ minutes: routine.alertAfterMinutes })) {
      const claimed = await prisma.routineOccurrence.updateMany({ where: { id: occ.id, childAlertedAt: null }, data: { childAlertedAt: now.toJSDate() } });
      if (claimed.count !== 1) continue;
      const reading = routine.type === 'BP' || routine.type === 'SUGAR' || routine.type === 'WATER';
      const title =
        occ.status === 'NOT_DONE'
          ? `${parent.name} said “not yet” to ${routine.name}`
          : reading
            ? `No ${routine.name} reply from ${parent.name} yet`
            : `${parent.name} hasn’t confirmed ${routine.name} yet`;
      const steps = [`Reminder sent at ${fmtTime(occ.sentAt ?? occ.scheduledFor, parent.timezone)}`];
      if (occ.followUpAt) steps.push(`follow-up at ${fmtTime(occ.followUpAt, parent.timezone)}`);
      await notifyChild({
        parentId: parent.id,
        kind: 'NOT_DONE',
        title,
        body: `${steps.join(', ')}. No confirmation since. A quick call might help.`,
        dedupeKey: `notdone:${occ.id}`,
        routineId: routine.id,
        occurrenceId: occ.id,
      });
      alerts++;
    }
  }

  alerts += await silenceAlerts(now);
  const reports = await weeklyReportReady(now);
  const refills = await refillAlerts(now);
  const appointments = await appointmentReminders(now);
  return { followUps, alerts, reports, refills, appointments };
}

/** Reminders are going out but nothing has come back for a day. One alert per quiet spell. */
async function silenceAlerts(now: DateTime): Promise<number> {
  const cutoff = now.minus({ hours: SILENCE_HOURS }).toJSDate();
  const parents = await prisma.parentProfile.findMany({
    where: { consentStatus: 'GRANTED', OR: [{ lastInboundAt: { lt: cutoff } }, { lastInboundAt: null, consentAt: { lt: cutoff } }] },
  });
  let n = 0;
  for (const p of parents) {
    const sent = await prisma.routineOccurrence.count({ where: { parentId: p.id, sentAt: { gte: cutoff } } });
    if (sent < 2) continue; // nothing was asked, so silence isn't news
    const last = p.lastInboundAt;
    const when = last ? DateTime.fromJSDate(last).setZone(p.timezone).toFormat("ccc h:mm a") : null;
    const created = await notifyChild({
      parentId: p.id,
      kind: 'SILENCE',
      title: `No replies from ${p.name} for over a day`,
      body: `${sent} reminders have gone out${when ? ` since their last message on ${when}` : ''}. Their phone may be off or out of charge; a quick call might help.`,
      dedupeKey: `silence:${p.id}:${last?.toISOString() ?? 'never'}`,
    });
    if (created) n++;
  }
  return n;
}

const REPORT_WEEKDAY = 7; // Sunday…
const REPORT_HOUR = 19; // …from 7 PM, parent's time, once the week's reminders are mostly done

/** "Mummy's weekly report is ready", once per parent per week. */
async function weeklyReportReady(now: DateTime): Promise<number> {
  const parents = await prisma.parentProfile.findMany({ where: { consentStatus: 'GRANTED' } });
  let n = 0;
  for (const p of parents) {
    const local = now.setZone(p.timezone);
    if (local.weekday !== REPORT_WEEKDAY || local.hour < REPORT_HOUR) continue;
    const weekStart = local.startOf('week').toISODate()!;
    const key = `report:${p.id}:${weekStart}`;
    if (await prisma.notification.findUnique({ where: { dedupeKey: key } })) continue;
    const report = await weeklyReport(p.id, weekStart);
    if (await notifyChild({ parentId: p.id, kind: 'REPORT', title: `${p.name}’s weekly report is ready`, body: report.summary, dedupeKey: key })) n++;
  }
  return n;
}

const DAYTIME = (hour: number) => hour >= 9 && hour < 21;

/** Tablets running low: one alert to the family per refill cycle, during the day. */
export async function refillAlerts(now: DateTime): Promise<number> {
  const meds = await prisma.medicine.findMany({
    where: { active: true, pillsLeft: { not: null }, parent: { consentStatus: 'GRANTED' } },
    include: { routines: true, parent: true },
  });
  let n = 0;
  for (const m of meds) {
    if (!DAYTIME(now.setZone(m.parent.timezone).hour)) continue;
    const days = daysLeft(m, m.routines);
    if (days == null || days > m.refillAlertDays) continue;
    const created = await notifyChild({
      parentId: m.parentId,
      kind: 'REFILL',
      title: days === 0 ? `${m.parent.name}’s ${m.name} has run out` : `${m.parent.name}’s ${m.name}: about ${days} day${days === 1 ? '' : 's'} left`,
      body: `${m.pillsLeft} left at ${m.pillsPerDose} per dose. Mark it refilled on the Care page once more is bought.`,
      dedupeKey: `refill:${m.id}:${(m.refilledAt ?? m.createdAt).toISOString()}`,
    });
    if (created) n++;
  }
  return n;
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
      await notifyChild({
        parentId: a.parentId,
        kind: 'APPOINTMENT',
        title: `Tomorrow: ${a.parent.name} has ${a.title}`,
        body: `At ${at.toFormat('h:mm a')}${a.place ? `, ${a.place}` : ''}.${a.remindParent ? ` ${a.parent.name} has been reminded on WhatsApp.` : ''}`,
        dedupeKey: `appt:${a.id}:tomorrow`,
      });
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
