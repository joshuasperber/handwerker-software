import { prisma } from "@/lib/prisma";

/** Invalidiert alle bestehenden Sessions eines Nutzers (JWT sessionVersion). */
export async function bumpSessionVersion(userId: string): Promise<number> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
    select: { sessionVersion: true },
  });
  return user.sessionVersion;
}
