import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { requireTenantOrder } from "@/lib/tenant-scope";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.write");
  if (auth instanceof Response) return auth;

  const { id: orderId } = await params;
  const order = await requireTenantOrder(auth.tenantId, orderId);
  if (!order) return apiError("Auftrag nicht gefunden", 404);

  const body = await request.json();

  const employee = await prisma.employee.findFirst({
    where: { userId: auth.id, tenantId: auth.tenantId },
  });

  if (!employee) return apiError("Mitarbeiterprofil nicht gefunden", 404);

  const usage = await prisma.materialUsage.create({
    data: {
      orderId,
      employeeId: employee.id,
      name: body.name,
      quantity: body.quantity,
      unit: body.unit ?? "Stk",
      notes: body.notes,
    },
  });

  return apiSuccess(usage, 201);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.read");
  if (auth instanceof Response) return auth;

  const { id: orderId } = await params;

  const usages = await prisma.materialUsage.findMany({
    where: { orderId, order: { tenantId: auth.tenantId } },
    include: { employee: { include: { user: true } } },
  });

  return apiSuccess(usages);
}
