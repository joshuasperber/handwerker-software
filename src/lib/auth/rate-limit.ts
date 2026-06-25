import { prisma } from "@/lib/prisma";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS_PER_EMAIL = 8;
const MAX_FAILS_PER_IP = 25;

export async function recordLoginAttempt(
  email: string,
  ip: string | undefined,
  success: boolean
) {
  await prisma.loginAttempt.create({
    data: {
      email: email.toLowerCase().trim(),
      ip: ip ?? null,
      success,
    },
  });
}

export async function isLoginRateLimited(
  email: string,
  ip: string | undefined
): Promise<{ limited: boolean; reason?: string }> {
  const since = new Date(Date.now() - WINDOW_MS);
  const normalizedEmail = email.toLowerCase().trim();

  const [emailFails, ipFails] = await Promise.all([
    prisma.loginAttempt.count({
      where: {
        email: normalizedEmail,
        success: false,
        createdAt: { gte: since },
      },
    }),
    ip
      ? prisma.loginAttempt.count({
          where: {
            ip,
            success: false,
            createdAt: { gte: since },
          },
        })
      : Promise.resolve(0),
  ]);

  if (emailFails >= MAX_FAILS_PER_EMAIL) {
    return { limited: true, reason: "Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen." };
  }
  if (ipFails >= MAX_FAILS_PER_IP) {
    return { limited: true, reason: "Zu viele Anfragen von dieser Adresse. Bitte später erneut versuchen." };
  }
  return { limited: false };
}

/** Alte Einträge entfernen (optional beim Login aufrufen). */
export async function pruneLoginAttempts(olderThanDays = 7) {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  await prisma.loginAttempt.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
}
