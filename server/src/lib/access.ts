import type { Prisma } from '@prisma/client';
import { prisma } from './db.js';

/** Parents this user can see: ones they added, and ones shared with them. */
export const accessibleBy = (userId: string): Prisma.ParentProfileWhereInput => ({
  OR: [{ userId }, { members: { some: { userId } } }],
});

/** Everyone caring for a parent: the owner first, then members. */
export async function careTeam(parentId: string) {
  const p = await prisma.parentProfile.findUniqueOrThrow({
    where: { id: parentId },
    include: { user: true, members: { include: { user: true }, orderBy: { createdAt: 'asc' } } },
  });
  return [p.user, ...p.members.map((m) => m.user)];
}

/** "Priya" or "Priya aur Rahul": who the parent is told will see their replies. */
export function teamNames(team: { name: string }[], joiner = 'aur'): string {
  const first = team.map((u) => u.name.trim().split(/\s+/)[0]);
  return first.length <= 1 ? first[0] ?? '' : `${first.slice(0, -1).join(', ')} ${joiner} ${first[first.length - 1]}`;
}
