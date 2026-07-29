import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  apiSuccess,
  apiError,
  getClientIp,
  NO_STORE_HEADERS,
} from "@/lib/api";
import { assertSameOrigin } from "@/lib/security/origin";
import {
  isActionRateLimited,
  recordActionAttempt,
} from "@/lib/auth/action-rate-limit";
import { createAuditLog } from "@/lib/audit";

/**
 * Art.-15-Vorbereitung: JSON-Export eigener Nutzerdaten bzw. Kundendaten (Admin).
 * Kein vollständiger Steuer-/Archivexport — Platzhalter für Betroffenenauskunft.
 */
export async function GET(request: NextRequest) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;

  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const ip = getClientIp(request);
  const limited = await isActionRateLimited("privacy_export", `${auth.tenantId}:${auth.id}`);
  if (limited.limited) return apiError(limited.reason ?? "Rate limit", 429);
  await recordActionAttempt("privacy_export", `${auth.tenantId}:${auth.id}`, ip);

  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customerId") ?? undefined;
  const userId = searchParams.get("userId") ?? auth.id;

  if (userId !== auth.id && auth.role !== "ADMIN") {
    return apiError("Nur Admins dürfen fremde Nutzerdaten exportieren", 403);
  }

  if (customerId && auth.role !== "ADMIN" && auth.role !== "MEISTER" && auth.role !== "BUERO") {
    return apiError("Keine Berechtigung für Kundenexport", 403);
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId: auth.tenantId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      address: true,
      role: true,
      createdAt: true,
      lastLoginAt: true,
      isActive: true,
      employee: {
        select: {
          id: true,
          color: true,
          hourlyWageNet: true,
          operationalStatus: true,
          qualifications: { select: { name: true } },
          workingHours: true,
          absences: {
            select: {
              id: true,
              startDate: true,
              endDate: true,
              type: true,
              notes: true,
            },
          },
        },
      },
    },
  });

  if (!user) return apiError("Nutzer nicht gefunden", 404);

  const [messages, aiSessions, timeEntries] = await Promise.all([
    prisma.message.findMany({
      where: {
        tenantId: auth.tenantId,
        OR: [{ senderId: userId }, { recipientUserId: userId }],
      },
      select: {
        id: true,
        subject: true,
        body: true,
        createdAt: true,
        senderId: true,
        recipientUserId: true,
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.aiChatSession.findMany({
      where: { tenantId: auth.tenantId, userId },
      include: {
        messages: {
          select: { id: true, role: true, content: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    user.employee
      ? prisma.timeEntry.findMany({
          where: { employeeId: user.employee.id },
          select: {
            id: true,
            startTime: true,
            endTime: true,
            breakMinutes: true,
            activity: true,
            notes: true,
            status: true,
            orderId: true,
          },
          orderBy: { startTime: "desc" },
          take: 1000,
        })
      : Promise.resolve([]),
  ]);

  let customerExport = null;
  if (customerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId: auth.tenantId },
      include: {
        properties: true,
        orders: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            title: true,
            createdAt: true,
            scheduledStart: true,
          },
          take: 500,
        },
      },
    });
    if (!customer) return apiError("Kunde nicht gefunden", 404);
    customerExport = customer;
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    disclaimer:
      "Technischer Auskunfts-Export (Entwurf). Keine Garantie auf Vollständigkeit für steuerliche Archive.",
    subject: { type: customerId ? "customer" : "user", userId, customerId: customerId ?? null },
    user,
    messages,
    aiChatSessions: aiSessions,
    timeEntries,
    customer: customerExport,
  };

  await createAuditLog({
    tenantId: auth.tenantId,
    userId: auth.id,
    entityType: "privacy_export",
    entityId: customerId ?? userId,
    action: "EXPORT",
    newValues: { userId, customerId: customerId ?? null },
    ipAddress: ip,
  });

  return apiSuccess(payload, 200, NO_STORE_HEADERS);
}
