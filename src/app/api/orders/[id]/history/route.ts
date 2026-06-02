import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.read");
  if (auth instanceof Response) return auth;

  const { id: orderId } = await params;
  const order = await prisma.order.findFirst({ where: { id: orderId, tenantId: auth.tenantId } });
  if (!order) return apiError("Auftrag nicht gefunden", 404);

  const [auditLogs, staffRequests, appointments] = await Promise.all([
    prisma.auditLog.findMany({
      where: { tenantId: auth.tenantId, entityType: "Order", entityId: orderId },
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.staffAssignmentRequest.findMany({
      where: { orderId },
      include: {
        employee: { include: { user: { select: { firstName: true, lastName: true } } } },
        requestedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.appointment.findMany({
      where: { orderId, tenantId: auth.tenantId },
      include: { employee: { include: { user: { select: { firstName: true, lastName: true } } } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const appointmentAudits = await prisma.auditLog.findMany({
    where: {
      tenantId: auth.tenantId,
      entityType: "Appointment",
      entityId: { in: appointments.map((a) => a.id) },
    },
    include: { user: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "desc" },
  });

  type TimelineEntry = {
    id: string;
    at: string;
    label: string;
    detail?: string;
    user?: string;
  };

  const timeline: TimelineEntry[] = [];

  for (const log of auditLogs) {
    const user = log.user ? `${log.user.firstName} ${log.user.lastName}` : "System";
    if (log.action === "STATUS_CHANGE") {
      const nv = log.newValues as { status?: string } | null;
      const ov = log.oldValues as { status?: string } | null;
      timeline.push({
        id: log.id,
        at: log.createdAt.toISOString(),
        label: "Status geändert",
        detail: `${ov?.status ?? "?"} → ${nv?.status ?? "?"}`,
        user,
      });
    } else if (log.action === "UPDATE") {
      timeline.push({
        id: log.id,
        at: log.createdAt.toISOString(),
        label: "Auftrag aktualisiert",
        user,
      });
    }
  }

  for (const aa of appointmentAudits) {
    if (aa.action === "CREATE") {
      const apt = appointments.find((a) => a.id === aa.entityId);
      timeline.push({
        id: aa.id,
        at: aa.createdAt.toISOString(),
        label: "Termin angelegt",
        detail: apt?.employee
          ? `${apt.employee.user.firstName} ${apt.employee.user.lastName} · ${formatDateTime(apt.startTime.toISOString())}`
          : undefined,
        user: aa.user ? `${aa.user.firstName} ${aa.user.lastName}` : undefined,
      });
    }
  }

  for (const sr of staffRequests) {
    timeline.push({
      id: sr.id,
      at: sr.createdAt.toISOString(),
      label: "Verstärkung angefragt",
      detail: `${sr.employee.user.firstName} ${sr.employee.user.lastName} (${sr.status})`,
      user: `${sr.requestedBy.firstName} ${sr.requestedBy.lastName}`,
    });
  }

  timeline.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return apiSuccess({ timeline: timeline.slice(0, 40) });
}
