import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { getEmployeeForUser } from "@/lib/monteur-access";
import { requireMonteurOrder } from "@/lib/monteur-access";
import { validateTimeEntryInput } from "@/lib/time-entry";

/** Zeiteintrag anlegen — mit oder ohne Auftrag */
export async function POST(request: NextRequest) {
  const auth = await requireAuth("monteur.own");
  if (auth instanceof Response) return auth;

  const employee = await getEmployeeForUser(auth);
  if (!employee) return apiError("Kein Mitarbeiterprofil", 403);

  const body = await request.json();
  const orderId = body.orderId ? String(body.orderId) : null;

  const validationError = validateTimeEntryInput({
    startTime: body.startTime,
    endTime: body.endTime,
    breakMinutes: body.breakMinutes,
    orderId,
    activity: body.activity,
    notes: body.notes,
    requireEndTime: true,
  });
  if (validationError) return apiError(validationError, 400);

  if (orderId) {
    const access = await requireMonteurOrder(auth, orderId);
    if ("error" in access) return access.error;
  }

  const entry = await prisma.timeEntry.create({
    data: {
      orderId: orderId || null,
      employeeId: employee.id,
      startTime: new Date(body.startTime),
      endTime: body.endTime ? new Date(body.endTime) : null,
      breakMinutes: Number(body.breakMinutes) || 0,
      activity: body.activity?.trim() || null,
      notes: body.notes?.trim() || null,
      status: body.status ?? "OPEN",
    },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          customer: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  return apiSuccess(entry, 201);
}
