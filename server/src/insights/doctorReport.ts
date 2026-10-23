import { DateTime } from 'luxon';
import { careTeam } from '../lib/access.js';
import { prisma } from '../lib/db.js';
import { describeSchedule } from '../routines/schedule.js';

// A summary to take to a doctor's visit. It reports exactly what was recorded: readings as sent,
// symptoms in the parent's own words, medicines as the family entered them, and how often each
// reminder was confirmed. Only arithmetic (counts, ranges, averages); never an interpretation.

const MAX_DAYS = 180;

export async function doctorReport(parentId: string, from?: string, to?: string) {
  const parent = await prisma.parentProfile.findUniqueOrThrow({ where: { id: parentId } });
  const zone = parent.timezone;
  const end = (to ? DateTime.fromISO(to, { zone }) : DateTime.now().setZone(zone)).endOf('day');
  let start = (from ? DateTime.fromISO(from, { zone }) : end.minus({ days: 29 })).startOf('day');
  if (end.diff(start, 'days').days > MAX_DAYS) start = end.minus({ days: MAX_DAYS - 1 }).startOf('day');
  const range = { gte: start.toJSDate(), lte: end.toJSDate() };
  const dates = { gte: start.toISODate()!, lte: end.toISODate()! };

  const [team, medicines, occurrences, events, appointments, notes] = await Promise.all([
    careTeam(parentId),
    prisma.medicine.findMany({ where: { parentId, active: true }, include: { routines: true }, orderBy: { createdAt: 'asc' } }),
    prisma.routineOccurrence.findMany({ where: { parentId, localDate: dates }, include: { routine: true } }),
    prisma.healthEvent.findMany({ where: { parentId, occurredAt: range }, orderBy: { occurredAt: 'asc' }, include: { message: { select: { body: true } } } }),
    prisma.appointment.findMany({ where: { parentId, OR: [{ at: range }, { at: { gt: end.toJSDate() }, status: 'UPCOMING' }] }, orderBy: { at: 'asc' } }),
    prisma.careNote.findMany({ where: { parentId, OR: [{ pinned: true }, { createdAt: range }] }, orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }], include: { author: { select: { name: true } } } }),
  ]);

  const tally = (list: { status: string }[]) => {
    const n = (s: string) => list.filter((o) => o.status === s).length;
    return { done: n('DONE'), notYet: n('NOT_DONE'), noReply: n('NO_RESPONSE') };
  };
  const stats = (vals: number[]) =>
    vals.length ? { min: Math.min(...vals), max: Math.max(...vals), avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) } : null;
  const of = (type: string) => events.filter((e) => e.type === type);

  const bp = of('BP');
  const sugar = of('SUGAR');
  const wellbeing = of('WELLBEING');

  // Medicine reminders not linked to a listed medicine still belong in the report.
  const linked = new Set(medicines.flatMap((m) => m.routines.map((r) => r.id)));
  const otherMedicineReminders = [...new Map(occurrences.filter((o) => o.routine.type === 'MEDICINE' && !linked.has(o.routineId)).map((o) => [o.routineId, o.routine])).values()];

  return {
    parent: { name: parent.name, relationship: parent.relationship },
    preparedBy: team.map((u) => u.name),
    generatedAt: new Date(),
    range: { from: start.toISODate(), to: end.toISODate(), days: Math.round(end.diff(start, 'days').days) },
    medicines: [
      ...medicines.map((m) => ({
        name: m.name,
        dose: m.dose,
        instructions: m.instructions,
        prescribedBy: m.prescribedBy,
        reminders: m.routines.filter((r) => r.active).map((r) => `${describeSchedule(r)} at ${DateTime.fromFormat(r.timeOfDay, 'HH:mm').toFormat('h:mm a')}`),
        taken: tally(occurrences.filter((o) => o.routine.medicineId === m.id)),
      })),
      ...otherMedicineReminders.map((r) => ({
        name: r.name,
        dose: null,
        instructions: null,
        prescribedBy: null,
        reminders: [`${describeSchedule(r)} at ${DateTime.fromFormat(r.timeOfDay, 'HH:mm').toFormat('h:mm a')}`],
        taken: tally(occurrences.filter((o) => o.routineId === r.id)),
      })),
    ],
    readings: {
      bp: bp.map((e) => ({ at: e.occurredAt, value: `${e.valueNum}/${e.valueNum2}`, context: e.context })),
      bpStats: bp.length ? { systolic: stats(bp.map((e) => e.valueNum!)), diastolic: stats(bp.map((e) => e.valueNum2!)) } : null,
      sugar: sugar.map((e) => ({ at: e.occurredAt, value: e.valueNum!, context: e.context })),
      sugarStats: stats(sugar.map((e) => e.valueNum!)),
      weight: of('WEIGHT').map((e) => ({ at: e.occurredAt, value: e.valueNum! })),
    },
    symptoms: of('SYMPTOM').map((e) => ({ at: e.occurredAt, name: e.valueText, since: e.context, words: e.message?.body ?? null })),
    wellbeing: { good: wellbeing.filter((e) => e.valueText === 'good').length, okay: wellbeing.filter((e) => e.valueText === 'okay').length, low: wellbeing.filter((e) => e.valueText === 'low').length },
    appointments: appointments.map((a) => ({ at: a.at, title: a.title, place: a.place, status: a.status, notes: a.notes })),
    notes: notes.map((n) => ({ text: n.text, pinned: n.pinned, at: n.createdAt, author: n.author?.name ?? null })),
  };
}
