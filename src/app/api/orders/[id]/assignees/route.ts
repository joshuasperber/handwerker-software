import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError, getClientIp } from "@/lib/api";
import { parseBody } from "@/lib/api-body";
import { setOrderAssignees, ORDER_ASSIGNEE_INCLUDE } from "@/lib/orders/assignees";
import { auditEntityChange } from "@/lib/audit";

const putSchema = z.object({
  employeeIds: z.array(z.string().min(1)),
  syncAppointments: z.boolean().optional().default(true),
  startTime: z.string().datetime().optional().nullable(),
  endTime: z.string().datetime().optional().nullable(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.read");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const order = await prisma.order.findFirst({
    where: { id, tenantId: auth.tenantId },
    select: { id: true },
  });
  if (!order) return apiError("Auftrag nicht gefunden", 404);

  const assignees = await prisma.orderAssignee.findMany({
    where: { orderId: id },
    include: ORDER_ASSIGNEE_INCLUDE,
    orderBy: { createdAt: "asc" },
  });

  return apiSuccess(
    assignees.map((a) => ({
      id: a.id,
      employeeId: a.employeeId,
      createdAt: a.createdAt.toISOString(),
      employee: {
        id: a.employee.id,
        color: a.employee.color,
        operationalStatus: a.employee.operationalStatus,
        user: a.employee.user,
      },
    }))
  );
}

/**
 * Mitarbeiter-Zuordnung setzen (Mehrfachauswahl).
 * Erzeugt/aktualisiert bei vorhandenem Termin auch Kalendereinträge.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.assign");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const body = await parseBody(request, putSchema);
  if (body instanceof Response) return body;

  const order = await prisma.order.findFirst({
    where: { id, tenantId: auth.tenantId },
    select: { id: true },
  });
  if (!order) return apiError("Auftrag nicht gefunden", 404);

  try {
    const result = await setOrderAssignees({
      tenantId: auth.tenantId,
      orderId: id,
      employeeIds: body.employeeIds,
      syncAppointments: body.syncAppointments,
      startTime: body.startTime ? new Date(body.startTime) : null,
      endTime: body.endTime ? new Date(body.endTime) : null,
    });

    await auditEntityChange(
      auth,
      "Order",
      id,
      "ASSIGNEES_UPDATED",
      null,
      { employeeIds: result.employeeIds },
      getClientIp(request)
    );

    const assignees = await prisma.orderAssignee.findMany({
      where: { orderId: id },
      include: ORDER_ASSIGNEE_INCLUDE,
      orderBy: { createdAt: "asc" },
    });

    return apiSuccess({
      employeeIds: result.employeeIds,
      assignees: assignees.map((a) => ({
        id: a.id,
        employeeId: a.employeeId,
        employee: {
          id: a.employee.id,
          color: a.employee.color,
          operationalStatus: a.employee.operationalStatus,
          user: a.employee.user,
        },
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Zuweisung fehlgeschlagen";
    return apiError(message, 400);
  }
}
