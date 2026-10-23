import type { EventType, OccurrenceStatus, Prisma, RoutineType } from '@prisma/client';
import { DateTime } from 'luxon';
import { prisma } from '../lib/db.js';

// Dev only: a parent with 45 days of believable history so the dashboard can be explored
// without waiting weeks. Deterministic, so screenshots are stable.

const DAYS = 45;

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

export async function seedDemoParent(userId: string) {
  const rand = rng(7);
  const pick = <T>(weights: [T, number][]): T => {
    let r = rand() * weights.reduce((a, [, w]) => a + w, 0);
    for (const [v, w] of weights) if ((r -= w) <= 0) return v;
    return weights[0][0];
  };

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const zone = 'Asia/Kolkata';
  const now = DateTime.now().setZone(zone);
  let phone: string;
  do phone = `9199${Math.floor(10_000_000 + rand() * 89_999_999)}`;
  while (await prisma.parentProfile.findUnique({ where: { phone } }));

  const parent = await prisma.parentProfile.create({
    data: {
      userId,
      name: 'Mummy',
      relationship: 'Mother',
      phone,
      timezone: zone,
      consentStatus: 'GRANTED',
      consentAt: now.minus({ days: DAYS }).toJSDate(),
      lastInboundAt: now.minus({ minutes: 25 }).toJSDate(),
      createdAt: now.minus({ days: DAYS }).toJSDate(),
    },
  });

  const defs: { type: RoutineType; name: string; time: string; target?: number; days?: number[]; follow: number | null; alert: number | null }[] = [
    { type: 'MEDICINE', name: 'morning wali dawa', time: '08:00', follow: 60, alert: 180 },
    { type: 'BP', name: 'BP check', time: '09:00', follow: 120, alert: 300 },
    { type: 'SUGAR', name: 'fasting sugar test', time: '07:30', days: [1, 4], follow: 120, alert: 300 },
    { type: 'WALK', name: 'evening walk', time: '18:00', follow: 120, alert: null },
    { type: 'WATER', name: 'paani', time: '19:00', target: 8, follow: null, alert: null },
    { type: 'WELLBEING', name: 'kaisa feel', time: '20:00', follow: 120, alert: null },
    { type: 'MEDICINE', name: 'raat wali dawa', time: '21:30', follow: 60, alert: 180 },
  ];
  const routines = [];
  for (const d of defs) {
    routines.push(
      await prisma.routine.create({
        data: {
          parentId: parent.id, type: d.type, name: d.name, timeOfDay: d.time, target: d.target ?? null,
          frequency: d.days ? 'WEEKLY' : 'DAILY', daysOfWeek: d.days ?? [],
          followUpMinutes: d.follow, alertAfterMinutes: d.alert, createdAt: now.minus({ days: DAYS }).toJSDate(),
        },
      }),
    );
  }

  const alerted: { index: number; routine: (typeof routines)[number]; at: DateTime; status: OccurrenceStatus }[] = [];
  let sys = 136;
  let dia = 86;
  const occurrences: Prisma.RoutineOccurrenceCreateManyInput[] = [];
  const events: { type: EventType; valueNum?: number; valueNum2?: number; valueText?: string; unit?: string; context?: string; occurredAt: Date; occIndex?: number }[] = [];

  for (let ago = DAYS; ago >= 0; ago--) {
    const day = now.minus({ days: ago }).startOf('day');
    const localDate = day.toISODate()!;
    // Adherence improves over the period, which makes the week-over-week view interesting.
    const better = 1 - ago / DAYS;
    sys = Math.round(Math.min(150, Math.max(122, sys + (rand() - 0.55) * 6)));
    dia = Math.round(Math.min(94, Math.max(76, dia + (rand() - 0.55) * 4)));

    for (const r of routines) {
      if (r.frequency === 'WEEKLY' && !r.daysOfWeek.includes(day.weekday)) continue;
      const [h, m] = r.timeOfDay.split(':').map(Number);
      const at = day.set({ hour: h, minute: m });
      if (ago === 0 && at > now) {
        occurrences.push({ routineId: r.id, parentId: parent.id, localDate, scheduledFor: at.toJSDate(), status: 'SCHEDULED' });
        continue;
      }
      let status: OccurrenceStatus;
      if (ago === 0 && r.type === 'BP') status = 'SENT';
      else if (r.type === 'MEDICINE') status = pick([['DONE', 0.78 + better * 0.18], ['NOT_DONE', 0.05], ['NO_RESPONSE', 0.09 - better * 0.05]]);
      else if (r.type === 'WALK') status = pick([['DONE', 0.55 + better * 0.15], ['NOT_DONE', 0.25], ['NO_RESPONSE', 0.15]]);
      else status = pick([['DONE', 0.7 + better * 0.15], ['NO_RESPONSE', 0.25]]);
      const replied = at.plus({ minutes: 4 + Math.floor(rand() * 50) });
      const note = r.type === 'MEDICINE' && status === 'DONE' && rand() < 0.3 ? (h < 12 ? 'after breakfast' : 'after dinner') : null;
      // Care rules history: unanswered items got a follow-up, and the child was alerted where the routine says so.
      const open = status === 'NO_RESPONSE' || status === 'NOT_DONE' || status === 'SENT';
      const followUpAt = open && r.followUpMinutes ? at.plus({ minutes: r.followUpMinutes }) : null;
      const childAlertedAt = open && r.alertAfterMinutes && at.plus({ minutes: r.alertAfterMinutes }) <= now ? at.plus({ minutes: r.alertAfterMinutes }) : null;
      if (childAlertedAt) alerted.push({ index: occurrences.length, routine: r, at: childAlertedAt, status });
      occurrences.push({
        followUpAt: followUpAt && followUpAt <= now ? followUpAt.toJSDate() : null,
        childAlertedAt: childAlertedAt?.toJSDate() ?? null,
        routineId: r.id,
        parentId: parent.id,
        localDate,
        scheduledFor: at.toJSDate(),
        sentAt: at.toJSDate(),
        status,
        respondedAt: status === 'DONE' || status === 'NOT_DONE' ? replied.toJSDate() : null,
        note,
      });
      const occIndex = occurrences.length - 1;
      if (status === 'NO_RESPONSE' || status === 'SENT') continue;
      const when = replied.toJSDate();
      if (r.type === 'MEDICINE' || r.type === 'WALK') events.push({ type: r.type, valueText: status === 'DONE' ? 'done' : 'not done', context: note ?? undefined, occurredAt: when, occIndex });
      if (r.type === 'BP') events.push({ type: 'BP', valueNum: sys, valueNum2: dia, unit: 'mmHg', occurredAt: when, occIndex });
      if (r.type === 'WATER') events.push({ type: 'WATER', valueNum: Math.max(3, Math.min(9, Math.round(5 + better * 2 + (rand() - 0.5) * 4))), unit: 'glasses', occurredAt: when, occIndex });
      if (r.type === 'WELLBEING') events.push({ type: 'WELLBEING', valueText: pick([['good', 0.6], ['okay', 0.32], ['low', 0.08]]), occurredAt: when, occIndex });
      if (r.type === 'SUGAR') events.push({ type: 'SUGAR', valueNum: Math.round(98 + rand() * 30), unit: 'mg/dL', context: 'fasting', occurredAt: when, occIndex });
    }
    if (ago % 14 === 3) events.push({ type: 'WEIGHT', valueNum: Math.round((63.5 - (DAYS - ago) * 0.02 + rand() * 0.4) * 10) / 10, unit: 'kg', occurredAt: day.set({ hour: 8, minute: 30 }).toJSDate() });
  }
  // A recurring topic in the last week, and an older one-off.
  for (const [ago, name, since] of [[5, 'knee pain', 'since yesterday'], [3, 'knee pain', undefined], [1, 'knee pain', undefined], [19, 'headache', undefined]] as const) {
    events.push({ type: 'SYMPTOM', valueText: name, context: since, occurredAt: now.minus({ days: ago }).set({ hour: 11, minute: 15 }).toJSDate() });
  }

  await prisma.routineOccurrence.createMany({ data: occurrences });
  const occRows = await prisma.routineOccurrence.findMany({ where: { parentId: parent.id }, select: { id: true, routineId: true, localDate: true } });
  const occId = (i?: number) => {
    if (i == null) return undefined;
    const o = occurrences[i];
    return occRows.find((r) => r.routineId === o.routineId && r.localDate === o.localDate)?.id;
  };
  await prisma.healthEvent.createMany({
    data: events.map(({ occIndex, ...e }) => ({ ...e, parentId: parent.id, source: e.type === 'SYMPTOM' ? 'LLM' : 'RULES', occurrenceId: occId(occIndex) })),
  });

  // The child's alert history for the last week.
  for (const a of alerted.filter((x) => x.at > now.minus({ days: 7 }))) {
    const o = occurrences[a.index];
    const id = occId(a.index)!;
    await prisma.notification.create({
      data: {
        userId, parentId: parent.id, routineId: a.routine.id, occurrenceId: id, kind: 'NOT_DONE',
        // Same wording as the care rules (care/rules.ts).
        title:
          a.status === 'NOT_DONE'
            ? `Mummy said “not yet” to ${a.routine.name}`
            : ['BP', 'SUGAR', 'WATER'].includes(a.routine.type)
              ? `No ${a.routine.name} reply from Mummy yet`
              : `Mummy hasn’t confirmed ${a.routine.name} yet`,
        body: `Reminder sent at ${DateTime.fromJSDate(o.scheduledFor as Date).setZone(zone).toFormat('h:mm a')}${o.followUpAt ? `, follow-up at ${DateTime.fromJSDate(o.followUpAt as Date).setZone(zone).toFormat('h:mm a')}` : ''}. No confirmation since. A quick call might help.`,
        dedupeKey: `notdone:${id}`, createdAt: a.at.toJSDate(), readAt: a.at < now.minus({ days: 1 }) ? a.at.plus({ hours: 1 }).toJSDate() : null,
      },
    });
  }

  // A short recent conversation so the chat view isn't empty.
  const today = now.startOf('day');
  const convo: [number, 'IN' | 'OUT', string, string?][] = [
    [8 * 60, 'OUT', 'Mummy, morning wali dawa le li? ❤️'],
    [8 * 60 + 12, 'IN', 'Haan beta, breakfast ke baad le li thi', 'RULES'],
    [8 * 60 + 12, 'OUT', 'Shabash! ❤️'],
    [9 * 60, 'OUT', 'Mummy, aaj BP check kiya? Reading bhej dijiye, jaise 130/80 🩺'],
    [11 * 60 + 15, 'IN', 'Ghutne mein phir se dard hai thoda', 'LLM'],
    [11 * 60 + 15, 'OUT', `Dhyan rakhiye ❤️ Maine note kar liya, ${user.name} ko bhi dikh jayega.`],
  ];
  for (const [i, [mins, direction, body, handledBy]] of convo.entries()) {
    const at = today.plus({ minutes: mins, seconds: i }); // keep reply after the message it answers
    if (at > now) continue;
    await prisma.message.create({ data: { parentId: parent.id, direction, body, kind: direction === 'IN' ? 'text' : 'session', handledBy, toPhone: direction === 'OUT' ? phone : null, createdAt: at.toJSDate() } });
  }
  // Medicines as prescribed, linked to the two medicine reminders; one is running low.
  const morning = routines.find((r) => r.name === 'morning wali dawa')!;
  const night = routines.find((r) => r.name === 'raat wali dawa')!;
  const telma = await prisma.medicine.create({
    data: { parentId: parent.id, name: 'Telma 40', dose: '1 tablet', instructions: 'after breakfast', prescribedBy: 'Dr. Mehta', pillsLeft: 24, refilledAt: now.minus({ days: 6 }).toJSDate() },
  });
  const metformin = await prisma.medicine.create({
    data: { parentId: parent.id, name: 'Metformin 500', dose: '1 tablet', instructions: 'after dinner', prescribedBy: 'Dr. Mehta', pillsLeft: 4, refilledAt: now.minus({ days: 26 }).toJSDate() },
  });
  await prisma.routine.update({ where: { id: morning.id }, data: { medicineId: telma.id } });
  await prisma.routine.update({ where: { id: night.id }, data: { medicineId: metformin.id } });

  await prisma.appointment.createMany({
    data: [
      { parentId: parent.id, title: 'Dr. Mehta (heart)', place: 'Fortis, Noida', at: now.plus({ days: 3 }).set({ hour: 11, minute: 0, second: 0, millisecond: 0 }).toJSDate(), notes: 'Take the BP diary and last blood test' },
      { parentId: parent.id, title: 'Eye check-up', place: 'Centre for Sight', at: now.minus({ days: 20 }).set({ hour: 10, minute: 30, second: 0, millisecond: 0 }).toJSDate(), status: 'DONE', notes: 'New reading glasses ordered' },
    ],
  });
  await prisma.careNote.createMany({
    data: [
      { parentId: parent.id, authorId: userId, text: 'Doctor said: less salt, and a 20-minute walk every evening.', pinned: true, createdAt: now.minus({ days: 20 }).toJSDate() },
      { parentId: parent.id, authorId: userId, text: 'Calls are best after 7 PM, after her serial.', createdAt: now.minus({ days: 9 }).toJSDate() },
    ],
  });
  return parent;
}
