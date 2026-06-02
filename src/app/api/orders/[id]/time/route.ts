import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.write");
  if (auth instanceof Response) return auth;

  const { id: orderId } = await params;
  const body = await request.json();

  const employee = await prisma.employee.findFirst({
    where: { userId: auth.id, tenantId: auth.tenantId },
  });

  if (!employee) return apiError("Mitarbeiterprofil nicht gefunden", 404);

  const entry = await prisma.timeEntry.create({
    data: {
      orderId,
      employeeId: employee.id,
      startTime: new Date(body.startTime),
      endTime: body.endTime ? new Date(body.endTime) : undefined,
      breakMinutes: body.breakMinutes ?? 0,
      notes: body.notes,
    },
  });

  return apiSuccess(entry, 201);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.read");
  if (auth instanceof Response) return auth;

  const { id: orderId } = await params;

  const entries = await prisma.timeEntry.findMany({
    where: { orderId, order: { tenantId: auth.tenantId } },
    include: { employee: { include: { user: true } } },
  });

  return apiSuccess(entries);
}
