import { requireAuth, apiSuccess, NO_STORE_HEADERS } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { isStorageConfigured } from "@/lib/storage";

/** Aggregierte Sicherheitsübersicht für Admins. */
export async function GET() {
  const auth = await requireAuth("tenant.manage");
  if (auth instanceof Response) return auth;

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const tenantUsers = await prisma.user.findMany({
    where: { tenantId: auth.tenantId },
    select: { id: true, email: true, role: true, isActive: true, lastLoginAt: true },
    orderBy: { lastName: "asc" },
  });
  const emails = tenantUsers.map((u) => u.email.toLowerCase());

  const [
    failedLogins24h,
    failedLogins7d,
    recentFailed,
    recentAudit,
    aiSessions,
    aiMessages7d,
  ] = await Promise.all([
    emails.length
      ? prisma.loginAttempt.count({
          where: {
            success: false,
            createdAt: { gte: since24h },
            email: { in: emails },
          },
        })
      : Promise.resolve(0),
    emails.length
      ? prisma.loginAttempt.count({
          where: {
            success: false,
            createdAt: { gte: since7d },
            email: { in: emails },
          },
        })
      : Promise.resolve(0),
    emails.length
      ? prisma.loginAttempt.findMany({
          where: {
            success: false,
            createdAt: { gte: since7d },
            email: { in: emails },
          },
          orderBy: { createdAt: "desc" },
          take: 30,
        })
      : Promise.resolve([]),
    prisma.auditLog.findMany({
      where: { tenantId: auth.tenantId, createdAt: { gte: since7d } },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.aiChatSession.count({
      where: { tenantId: auth.tenantId },
    }),
    prisma.aiChatMessage.count({
      where: {
        createdAt: { gte: since7d },
        session: { tenantId: auth.tenantId },
      },
    }),
  ]);

  return apiSuccess(
    {
      generatedAt: new Date().toISOString(),
      users: tenantUsers.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      })),
      login: {
        failedLast24h: failedLogins24h,
        failedLast7d: failedLogins7d,
        recentFailed: recentFailed.map((a) => ({
          email: a.email,
          ip: a.ip,
          createdAt: a.createdAt.toISOString(),
        })),
      },
      audit: recentAudit.map((l) => ({
        id: l.id,
        entityType: l.entityType,
        entityId: l.entityId,
        action: l.action,
        createdAt: l.createdAt.toISOString(),
        user: l.user
          ? `${l.user.firstName} ${l.user.lastName}`.trim() || l.user.email
          : null,
      })),
      ai: {
        sessionCount: aiSessions,
        messagesLast7d: aiMessages7d,
        llmConfigured: Boolean(
          process.env.GROQ_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim()
        ),
        providerHint: process.env.GROQ_API_KEY?.trim()
          ? "groq"
          : process.env.OPENAI_API_KEY?.trim()
            ? "openai"
            : "none",
        retentionNote: "Pro Nutzer werden ältere Chats auf die letzten 3 Sessions begrenzt.",
      },
      storage: {
        configured: isStorageConfigured(),
        signedUrlsPreferred: true,
        publicUrlConfigured: Boolean(process.env.S3_PUBLIC_URL),
        maxUploadMb: 15,
        allowedTypes: ["image/*", "application/pdf"],
        malwareScan: "not_configured",
      },
      backups: {
        status: "manual_ops",
        recommendation:
          "PostgreSQL-PITR (z. B. Supabase) und S3-Versioning aktivieren; Restore-Drill dokumentieren.",
      },
      privacyEndpoints: {
        export: "/api/privacy/export",
        erasureCheck: "/api/privacy/erasure-check?customerId=",
      },
    },
    200,
    NO_STORE_HEADERS
  );
}
