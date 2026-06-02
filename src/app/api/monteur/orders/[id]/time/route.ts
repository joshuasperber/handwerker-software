import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { requireMonteurOrder } from "@/lib/monteur-access";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("monteur.own");
  if (auth instanceof Response) return auth;

  const { id: orderId } = await params;
  const access = await requireMonteurOrder(auth, orderId);
  if ("error" in access) return access.error;

  const body = await request.json();
  const entry = await prisma.timeEntry.create({
    data: {
      orderId,
      employeeId: access.employee.id,
      startTime: new Date(body.startTime),
      endTime: body.endTime ? new Date(body.endTime) : undefined,
      breakMinutes: body.breakMinutes ?? 0,
      notes: body.notes,
    },
  });

  return apiSuccess(entry, 201);
}
