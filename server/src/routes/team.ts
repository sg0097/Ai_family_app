import { randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { notifyChild } from '../care/notify.js';
import { accessibleBy } from '../lib/access.js';
import { prisma } from '../lib/db.js';
import { sendEmail } from '../lib/email.js';
import { appUrl } from '../lib/env.js';
import { HttpError, notFound } from '../lib/http.js';

// Family sharing. The person who added a parent is the owner; they can invite siblings by email.
// An invite only works for the email it was sent to, so a forwarded link can't give a stranger
// access to someone's health records.

const INVITE_DAYS = 14;
const inviteLink = (token: string) => `${appUrl()}/invite/${token}`;

export async function teamRoutes(app: FastifyInstance) {
  app.addHook('preHandler', async (req, reply) => {
    // Opening an invite link works signed out (it shows who invited you); everything else needs sign-in.
    // (routeOptions.url includes the /api prefix, so match the end.)
    if (req.method === 'GET' && req.routeOptions.url?.endsWith('/invites/:token')) return;
    return app.authenticate(req, reply);
  });

  const parentFor = async (req: FastifyRequest, id: string) => {
    const parent = await prisma.parentProfile.findFirst({ where: { id, ...accessibleBy(req.user.sub) }, include: { user: true } });
    if (!parent) throw notFound();
    return { parent, isOwner: parent.userId === req.user.sub };
  };

  app.get<{ Params: { id: string } }>('/parents/:id/team', async (req) => {
    const { parent, isOwner } = await parentFor(req, req.params.id);
    const [members, invites] = await Promise.all([
      prisma.careMember.findMany({ where: { parentId: parent.id }, include: { user: true }, orderBy: { createdAt: 'asc' } }),
      isOwner ? prisma.careInvite.findMany({ where: { parentId: parent.id, acceptedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } }) : [],
    ]);
    const person = (u: { id: string; name: string; email: string }) => ({ id: u.id, name: u.name, email: u.email });
    return {
      isOwner,
      me: req.user.sub,
      owner: person(parent.user),
      members: members.map((m) => ({ ...person(m.user), since: m.createdAt })),
      invites: invites.map((i) => ({ id: i.id, email: i.email, createdAt: i.createdAt, expiresAt: i.expiresAt, link: inviteLink(i.token) })),
    };
  });

  app.post<{ Params: { id: string } }>('/parents/:id/invites', { config: { rateLimit: { max: 20, timeWindow: '1 hour' } } }, async (req, reply) => {
    const { parent, isOwner } = await parentFor(req, req.params.id);
    if (!isOwner) throw new HttpError(403, `Only ${parent.user.name} can invite people to ${parent.name}’s care team`);
    const { email } = z.object({ email: z.string().trim().toLowerCase().email() }).parse(req.body);
    if (email === parent.user.email) throw new HttpError(400, 'That’s your own email');
    const existing = await prisma.careMember.findFirst({ where: { parentId: parent.id, user: { email } } });
    if (existing) throw new HttpError(409, 'They’re already on the care team');

    const token = randomBytes(24).toString('base64url');
    const invite = await prisma.careInvite.create({
      data: { parentId: parent.id, email, token, invitedById: req.user.sub, expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000) },
    });
    await sendEmail({
      to: email,
      subject: `${parent.user.name} invited you to help care for ${parent.name}`,
      text:
        `${parent.user.name} uses Family Care to stay close to ${parent.name}'s everyday health, through WhatsApp.\n\n` +
        `Join to see how ${parent.name}'s day is going and get alerts if something isn't done:\n${inviteLink(token)}\n\n` +
        `Use this email address (${email}) to sign in or sign up. The link works for ${INVITE_DAYS} days.\n\nFamily Care`,
    });
    return reply.code(201).send({ id: invite.id, email, link: inviteLink(token), expiresAt: invite.expiresAt });
  });

  app.delete<{ Params: { id: string; inviteId: string } }>('/parents/:id/invites/:inviteId', async (req, reply) => {
    const { isOwner, parent } = await parentFor(req, req.params.id);
    if (!isOwner) throw new HttpError(403, 'Only the owner can cancel invites');
    await prisma.careInvite.deleteMany({ where: { id: req.params.inviteId, parentId: parent.id } });
    return reply.code(204).send();
  });

  /** The owner removes someone, or a member leaves. */
  app.delete<{ Params: { id: string; userId: string } }>('/parents/:id/members/:userId', async (req, reply) => {
    const { isOwner, parent } = await parentFor(req, req.params.id);
    const leaving = req.params.userId === req.user.sub;
    if (!isOwner && !leaving) throw new HttpError(403, 'Only the owner can remove people');
    if (leaving && isOwner) throw new HttpError(400, `You added ${parent.name}; remove them in Settings instead`);
    await prisma.careMember.deleteMany({ where: { parentId: parent.id, userId: req.params.userId } });
    return reply.code(204).send();
  });

  /** What an invite link shows before joining. */
  app.get<{ Params: { token: string } }>('/invites/:token', async (req) => {
    const invite = await prisma.careInvite.findUnique({ where: { token: req.params.token }, include: { parent: { include: { user: true } } } });
    if (!invite) throw notFound();
    return {
      parentName: invite.parent.name,
      invitedBy: invite.parent.user.name,
      email: invite.email,
      status: invite.acceptedAt ? 'accepted' : invite.expiresAt < new Date() ? 'expired' : 'open',
    };
  });

  app.post<{ Params: { token: string } }>('/invites/:token/accept', async (req) => {
    const invite = await prisma.careInvite.findUnique({ where: { token: req.params.token }, include: { parent: true } });
    if (!invite) throw notFound();
    if (invite.expiresAt < new Date() && !invite.acceptedAt) throw new HttpError(410, 'This invite has expired. Ask for a new one.');
    const me = await prisma.user.findUniqueOrThrow({ where: { id: req.user.sub } });
    if (me.email !== invite.email) throw new HttpError(403, `This invite is for ${invite.email}. Sign in with that email to join.`);
    if (invite.parent.userId !== me.id) {
      await prisma.careMember.upsert({
        where: { parentId_userId: { parentId: invite.parentId, userId: me.id } },
        create: { parentId: invite.parentId, userId: me.id },
        update: {},
      });
    }
    if (!invite.acceptedAt) {
      await prisma.careInvite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
      await notifyChild({
        parentId: invite.parentId,
        kind: 'TEAM',
        title: `${me.name} joined ${invite.parent.name}’s care team`,
        body: `They’ll see ${invite.parent.name}’s day and get the same alerts as you.`,
        dedupeKey: `team:${invite.id}`,
      });
    }
    return { parentId: invite.parentId };
  });
}
