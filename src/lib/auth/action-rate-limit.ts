import { prisma } from "@/lib/prisma";

type RateLimitKind = "ai_chat" | "upload" | "privacy_export";

const LIMITS: Record<RateLimitKind, { windowMs: number; max: number }> = {
  ai_chat: { windowMs: 15 * 60 * 1000, max: 60 },
  upload: { windowMs: 15 * 60 * 1000, max: 40 },
  privacy_export: { windowMs: 60 * 60 * 1000, max: 10 },
};

/**
 * Wiederverwendet LoginAttempt als leichtgewichtiges Counter-Store
 * (email-Feld = stabiler Scope-Key, success=false zählt als Versuch).
 */
export async function isActionRateLimited(
  kind: RateLimitKind,
  scopeKey: string
): Promise<{ limited: boolean; reason?: string }> {
  const cfg = LIMITS[kind];
  const since = new Date(Date.now() - cfg.windowMs);
  const key = `${kind}:${scopeKey}`.toLowerCase().slice(0, 190);

  const count = await prisma.loginAttempt.count({
    where: {
      email: key,
      success: false,
      createdAt: { gte: since },
    },
  });

  if (count >= cfg.max) {
    return {
      limited: true,
      reason: "Zu viele Anfragen. Bitte später erneut versuchen.",
    };
  }
  return { limited: false };
}

export async function recordActionAttempt(
  kind: RateLimitKind,
  scopeKey: string,
  ip?: string
) {
  const key = `${kind}:${scopeKey}`.toLowerCase().slice(0, 190);
  await prisma.loginAttempt.create({
    data: {
      email: key,
      ip: ip ?? null,
      success: false,
    },
  });
}
