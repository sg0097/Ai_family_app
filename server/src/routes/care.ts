import type { FastifyInstance, FastifyRequest } from 'fastify';
import { DateTime } from 'luxon';
import { z } from 'zod';
import type { Medicine, ParentProfile, Routine } from '@prisma/client';
import { daysLeft } from '../care/refill.js';
import { consentRequest, reminder } from '../conversation/copy.js';
import { doctorReport } from '../insights/doctorReport.js';
import { accessibleBy } from '../lib/access.js';
import { prisma } from '../lib/db.js';
import { HttpError, notFound } from '../lib/http.js';

// Medicines, doctor appointments, family notes and the doctor-visit report.

const text = (max: number) => z.string().trim().min(1).max(max);
const optional = (max: number) => z.string().trim().max(max).nullish().transform((v) => (v ? v : null));

const medicineBody = z.object({
  name: text(60),
  dose: optional(60),
  instructions: optional(160),
  prescribedBy: optional(80),
  pillsLeft: z.number().int().min(0).max(5000).nullish(),
  pillsPerDose: z.number().int().min(1).max(20).default(1),
  refillAlertDays: z.number().int().min(1).max(60).default(5),
  active: z.boolean().default(true),
});

const appointmentBody = z.object({
  title: text(80),
  place: optional(120),
  /** Local date-time in the parent's timezone, e.g. "2026-10-25T11:00". */
  localAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Pick a date and time'),
  notes: optional(500),
  remindParent: z.boolean().default(true),
});

const noteBody = z.object({ text: text(1000), pinned: z.boolean().default(false) });

export async function careRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  const parentFor = async (req: FastifyRequest, id: string) => {
    const p = await prisma.parentProfile.findFirst({ where: { id, ...accessibleBy(req.user.sub) } });
    if (!p) throw notFound();
    return p;
  };

  // ── Medicines ──
  const withStock = <M extends { pillsLeft: number | null; pillsPerDose: number; routines: Parameters<typeof daysLeft>[1] }>(m: M) => ({
    ...m,
    daysLeft: daysLeft(m, m.routines),
  });

  app.get<{ Params: { id: string } }>('/parents/:id/medicines', async (req) => {
    await parentFor(req, req.params.id);
    const meds = await prisma.medicine.findMany({ where: { parentId: req.params.id }, include: { routines: true }, orderBy: [{ active: 'desc' }, { createdAt: 'asc' }] });
    return meds.map(withStock);
  });

  app.post<{ Params: { id: string } }>('/parents/:id/medicines', async (req, reply) => {
    await parentFor(req, req.params.id);
    const { pillsLeft, ...b } = medicineBody.parse(req.body);
    const med = await prisma.medicine.create({ data: { ...b, pillsLeft: pillsLeft ?? null, refilledAt: pillsLeft != null ? new Date() : null, parentId: req.params.id }, include: { routines: true } });
    return reply.code(201).send(withStock(med));
  });

  const ownMedicine = async (req: FastifyRequest, id: string) => {
    const med = await prisma.medicine.findFirst({ where: { id, parent: accessibleBy(req.user.sub) } });
    if (!med) throw notFound();
    return med;
  };

  app.patch<{ Params: { id: string } }>('/medicines/:id', async (req) => {
    await ownMedicine(req, req.params.id);
    const b = medicineBody.partial().parse(req.body);
    const med = await prisma.medicine.update({ where: { id: req.params.id }, data: b, include: { routines: true } });
    return withStock(med);
  });

  /** "Bought 30 more": adds to the stock and starts a new refill cycle (one alert per cycle). */
  app.post<{ Params: { id: string } }>('/medicines/:id/refill', async (req) => {
    const med = await ownMedicine(req, req.params.id);
    const { pills } = z.object({ pills: z.number().int().min(1).max(5000) }).parse(req.body);
    const updated = await prisma.medicine.update({
      where: { id: med.id },
      data: { pillsLeft: (med.pillsLeft ?? 0) + pills, refilledAt: new Date() },
      include: { routines: true },
    });
    return withStock(updated);
  });

  // ── Appointments ──
  app.get<{ Params: { id: string } }>('/parents/:id/appointments', async (req) => {
    await parentFor(req, req.params.id);
    return prisma.appointment.findMany({ where: { parentId: req.params.id }, orderBy: { at: 'asc' } });
  });

  const toInstant = (localAt: string, zone: string) => {
    const at = DateTime.fromISO(localAt, { zone });
    if (!at.isValid) throw new HttpError(400, 'Pick a valid date and time');
    return at.toJSDate();
  };

  app.post<{ Params: { id: string } }>('/parents/:id/appointments', async (req, reply) => {
    const parent = await parentFor(req, req.params.id);
    const { localAt, ...b } = appointmentBody.parse(req.body);
    return reply.code(201).send(await prisma.appointment.create({ data: { ...b, at: toInstant(localAt, parent.timezone), parentId: parent.id } }));
  });

  app.patch<{ Params: { id: string } }>('/appointments/:id', async (req) => {
    const appt = await prisma.appointment.findFirst({ where: { id: req.params.id, parent: accessibleBy(req.user.sub) }, include: { parent: true } });
    if (!appt) throw notFound();
    const b = appointmentBody.partial().extend({ status: z.enum(['UPCOMING', 'DONE', 'CANCELLED']).optional() }).parse(req.body);
    const { localAt, ...rest } = b;
    const at = localAt ? toInstant(localAt, appt.parent.timezone) : undefined;
    return prisma.appointment.update({
      where: { id: appt.id },
      // A new time means new reminders.
      data: { ...rest, ...(at && { at, remindedDayBefore: null, remindedSameDay: null }) },
    });
  });

  // ── Family notes ──
  app.get<{ Params: { id: string } }>('/parents/:id/notes', async (req) => {
    await parentFor(req, req.params.id);
    return prisma.careNote.findMany({
      where: { parentId: req.params.id },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      include: { author: { select: { id: true, name: true } } },
    });
  });

  app.post<{ Params: { id: string } }>('/parents/:id/notes', async (req, reply) => {
    await parentFor(req, req.params.id);
    const b = noteBody.parse(req.body);
    return reply.code(201).send(await prisma.careNote.create({ data: { ...b, parentId: req.params.id, authorId: req.user.sub }, include: { author: { select: { id: true, name: true } } } }));
  });

  const ownNote = async (req: FastifyRequest, id: string) => {
    const note = await prisma.careNote.findFirst({ where: { id, parent: accessibleBy(req.user.sub) }, include: { parent: true } });
    if (!note) throw notFound();
    return note;
  };

  app.patch<{ Params: { id: string } }>('/notes/:id', async (req) => {
    await ownNote(req, req.params.id);
    const b = noteBody.partial().parse(req.body);
    return prisma.careNote.update({ where: { id: req.params.id }, data: b, include: { author: { select: { id: true, name: true } } } });
  });

  /** The author or the parent's owner can delete a note. */
  app.delete<{ Params: { id: string } }>('/notes/:id', async (req, reply) => {
    const note = await ownNote(req, req.params.id);
    if (note.authorId !== req.user.sub && note.parent.userId !== req.user.sub) throw new HttpError(403, 'Only the person who wrote this note can delete it');
    await prisma.careNote.delete({ where: { id: note.id } });
    return reply.code(204).send();
  });

  /** The exact WhatsApp message a reminder will send, built by the same code that sends it. */
  app.post('/preview/reminder', async (req) => {
    const b = z
      .object({
        parentName: text(40),
        language: z.enum(['HINGLISH', 'HINDI', 'ENGLISH']).default('HINGLISH'),
        type: z.enum(['MEDICINE', 'WATER', 'BP', 'SUGAR', 'WALK', 'WELLBEING']),
        name: z.string().trim().max(40).default(''),
        frequency: z.enum(['DAILY', 'WEEKLY', 'INTERVAL', 'MONTHLY']).default('DAILY'),
        medicine: z.object({ name: text(60), dose: optional(60) }).nullish(),
      })
      .parse(req.body);
    const placeholder = { MEDICINE: 'dawa', BP: 'BP check', SUGAR: 'sugar test', WATER: 'paani', WALK: 'walk', WELLBEING: 'kaisa feel' }[b.type];
    const parent = { name: b.parentName, language: b.language } as ParentProfile;
    const routine = { type: b.type, name: b.name || placeholder, frequency: b.frequency, medicine: b.medicine ? ({ name: b.medicine.name, dose: b.medicine.dose } as Medicine) : null } as Routine & { medicine: Medicine | null };
    const { session } = reminder(parent, routine, 'preview');
    return { text: session.text, buttons: session.buttons?.map((x) => x.title) ?? [] };
  });

  /** The first WhatsApp message a new parent gets (the invite to start). */
  app.post('/preview/consent', async (req) => {
    const b = z.object({ parentName: text(40), language: z.enum(['HINGLISH', 'HINDI', 'ENGLISH']).default('HINGLISH') }).parse(req.body);
    const me = await prisma.user.findUniqueOrThrow({ where: { id: req.user.sub } });
    const { session } = consentRequest({ name: b.parentName, language: b.language } as ParentProfile, me.name);
    return { text: session.text, buttons: session.buttons?.map((x) => x.title) ?? [] };
  });

  // ── Doctor visit report ──
  app.get<{ Params: { id: string }; Querystring: { from?: string; to?: string } }>('/parents/:id/doctor-report', async (req) => {
    await parentFor(req, req.params.id);
    const date = /^\d{4}-\d{2}-\d{2}$/;
    return doctorReport(req.params.id, date.test(req.query.from ?? '') ? req.query.from : undefined, date.test(req.query.to ?? '') ? req.query.to : undefined);
  });
}
