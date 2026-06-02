import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api";
import { startOfDay, endOfDay } from "date-fns";

export async function GET() {
  const auth = await requireAuth("orders.read");
  if (auth instanceof Response) return auth;

  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    todayAppointments,
    todayOrders,
    newRequests,
    billingReady,
    openTasks,
    warnings,
    recentOrders,
    todaySchedule,
  ] = await Promise.all([
    prisma.appointment.count({
      where: {
        tenantId: auth.tenantId,
        startTime: { gte: startOfDay(today), lte: endOfDay(today) },
        status: { not: "STORNIERT" },
      },
    }),
    prisma.order.count({
      where: {
        tenantId: auth.tenantId,
        status: { in: ["UNTERWEGS", "IN_ARBEIT", "EINGEPLANT"] },
        scheduledStart: { gte: startOfDay(today), lte: endOfDay(today) },
      },
    }),
    prisma.order.findMany({
      where: { tenantId: auth.tenantId, status: "NEUE_ANFRAGE" },
      include: { customer: true, property: true, services: { include: { service: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.order.findMany({
      where: { tenantId: auth.tenantId, status: "ABRECHNUNGSBEREIT" },
      include: { customer: true, property: true },
      orderBy: { completedAt: "desc" },
      take: 10,
    }),
    prisma.order.findMany({
      where: {
        tenantId: auth.tenantId,
        status: { in: ["NEUE_ANFRAGE", "TERMIN_GEBUCHT", "EINGEPLANT"] },
        OR: [
          { internalNotes: null },
          { appointments: { none: {} } },
        ],
      },
      include: { customer: true, property: true },
      orderBy: { createdAt: "asc" },
      take: 10,
    }),
    prisma.order.findMany({
      where: {
        tenantId: auth.tenantId,
        OR: [
          { status: "EINGEPLANT", appointments: { none: { employeeId: { not: null } } } },
          { priority: "NOTFALL", status: { notIn: ["ABGESCHLOSSEN", "ABRECHNUNGSBEREIT", "ABGERECHNET", "STORNIERT"] } },
          { scheduledStart: { lt: today }, status: { in: ["EINGEPLANT", "TERMIN_GEBUCHT"] } },
        ],
      },
      include: { customer: true, property: true },
      take: 10,
    }),
    prisma.order.findMany({
      where: { tenantId: auth.tenantId },
      include: { customer: true, property: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.appointment.findMany({
      where: {
        tenantId: auth.tenantId,
        startTime: { gte: startOfDay(today), lte: endOfDay(today) },
        status: { not: "STORNIERT" },
      },
      include: {
        order: { include: { customer: true, property: true } },
        employee: { include: { user: true } },
      },
      orderBy: { startTime: "asc" },
      take: 10,
    }),
  ]);

  const completedThisWeek = await prisma.order.count({
    where: {
      tenantId: auth.tenantId,
      status: { in: ["ABGESCHLOSSEN", "ABRECHNUNGSBEREIT"] },
      completedAt: { gte: weekAgo },
    },
  });

  return apiSuccess({
    stats: {
      todayAppointments,
      todayOrders,
      newRequestsCount: newRequests.length,
      billingReadyCount: billingReady.length,
      openTasksCount: openTasks.length,
      warningsCount: warnings.length,
      completedThisWeek,
    },
    newRequests,
    billingReady,
    openTasks,
    warnings,
    recentOrders,
    todaySchedule,
  });
}
