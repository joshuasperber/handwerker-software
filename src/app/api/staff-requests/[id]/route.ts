import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { getEmployeeForUser } from "@/lib/monteur-access";
import { acceptStaffRequest, declineStaffRequest } from "@/lib/staff-requests";
import { queueStaffRequestResponded } from "@/lib/inngest/dispatch";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("monteur.own");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const body = await request.json();
  const { action } = body;

  const employee = await getEmployeeForUser(auth);
  if (!employee) return apiError("Kein Mitarbeiterprofil", 403);

  const existing = await prisma.staffAssignmentRequest.findFirst({
    where: { id, tenantId: auth.tenantId, employeeId: employee.id, status: "PENDING" },
  });
  if (!existing) return apiError("Anfrage nicht gefunden", 404);
  if (existing.requestedById === auth.id) {
    return apiError("Eigene Anfrage kann nicht angenommen werden", 400);
  }

  if (action === "accept") {
    const result = await acceptStaffRequest(id, auth.tenantId);
    const empName = result.employee
      ? `${result.employee.user.firstName} ${result.employee.user.lastName}`
      : "Mitarbeiter";
    await queueStaffRequestResponded({
      tenantId: auth.tenantId,
      requestedById: existing.requestedById,
      orderNumber: result.order?.orderNumber ?? "",
      employeeName: empName,
      accepted: true,
    }).catch((err) => console.error("[staff-request accept notify]", err));
    return apiSuccess(result);
  }
  if (action === "decline") {
    const emp = await prisma.employee.findFirst({
      where: { id: employee.id },
      include: { user: true },
    });
    const order = await prisma.order.findFirst({
      where: { id: existing.orderId },
      select: { orderNumber: true },
    });
    await declineStaffRequest(id, auth.tenantId);
    await queueStaffRequestResponded({
      tenantId: auth.tenantId,
      requestedById: existing.requestedById,
      orderNumber: order?.orderNumber ?? "",
      employeeName: emp ? `${emp.user.firstName} ${emp.user.lastName}` : "Mitarbeiter",
      accepted: false,
    }).catch((err) => console.error("[staff-request decline notify]", err));
    return apiSuccess({ declined: true });
  }

  return apiError("action muss accept oder decline sein", 400);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.assign");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  await prisma.staffAssignmentRequest.updateMany({
    where: { id, tenantId: auth.tenantId, status: "PENDING" },
    data: { status: "CANCELLED" },
  });
  return apiSuccess({ cancelled: true });
}
