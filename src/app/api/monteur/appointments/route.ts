import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { parseBody } from "@/lib/api-body";
import { monteurCreateAppointmentSchema } from "@/lib/schemas/orders";
import { getEmployeeForUser } from "@/lib/monteur-access";
import { generateOrderNumber } from "@/lib/utils";
import { standardPhaseCreateData } from "@/lib/orders/phases";
import { findEmployeeScheduleConflict } from "@/lib/disposition/schedule-conflicts";

export async function POST(request: NextRequest) {
  const auth = await requireAuth("monteur.create_own");
  if (auth instanceof Response) return auth;

  const employee = await getEmployeeForUser(auth);
  if (!employee) return apiError("Kein Mitarbeiterprofil", 403);

  const body = await parseBody(request, monteurCreateAppointmentSchema);
  if (body instanceof Response) return body;

  const customer = await prisma.customer.findFirst({
    where: { id: body.customerId, tenantId: auth.tenantId },
  });
  if (!customer) return apiError("Kunde nicht gefunden", 404);

  const property = await prisma.property.findFirst({
    where: { id: body.propertyId, customerId: body.customerId, tenantId: auth.tenantId },
  });
  if (!property) return apiError("Objekt nicht gefunden", 404);

  const startTime = new Date(body.startTime);
  const endTime = new Date(body.endTime);
  if (endTime <= startTime) return apiError("Ende muss nach Beginn liegen", 400);

  const conflict = await findEmployeeScheduleConflict(
    auth.tenantId,
    employee.id,
    startTime,
    endTime
  );
  if (conflict) return apiError(conflict.message, 409);

  const order = await prisma.order.create({
    data: {
      tenantId: auth.tenantId,
      customerId: body.customerId,
      propertyId: body.propertyId,
      orderNumber: generateOrderNumber(),
      title: body.title,
      description: body.description ?? null,
      status: "EINGEPLANT",
      scheduledStart: startTime,
      scheduledEnd: endTime,
      phases: { create: standardPhaseCreateData() },
      appointments: {
        create: {
          tenantId: auth.tenantId,
          employeeId: employee.id,
          startTime,
          endTime,
          status: "GEPLANT",
          notes: "Eigener Termin (Monteur)",
        },
      },
    },
    include: {
      appointments: true,
      customer: true,
      property: true,
    },
  });

  return apiSuccess(order, 201);
}
