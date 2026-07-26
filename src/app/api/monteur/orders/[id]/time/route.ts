import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { requireMonteurOrder } from "@/lib/monteur-access";
import { validateTimeEntryInput } from "@/lib/time-entry";

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
  const validationError = validateTimeEntryInput({
    startTime: body.startTime,
    endTime: body.endTime,
    breakMinutes: body.breakMinutes,
    orderId,
    activity: body.activity,
    notes: body.notes,
    requireEndTime: body.endTime != null && body.endTime !== "" ? true : false,
  });
  // Für Pause aus Tagesplan darf Endzeit fehlen — sonst Endzeit verlangen wenn gesetzt
  if (body.endTime && validationError) return apiError(validationError, 400);
  if (!body.startTime) return apiError("Startzeit ist Pflicht.", 400);

  if (body.endTime) {
    const start = new Date(body.startTime);
    const end = new Date(body.endTime);
    if (end < start) return apiError("Endzeit darf nicht vor der Startzeit liegen.", 400);
    const breakMinutes = Number(body.breakMinutes) || 0;
    const workMinutes = (end.getTime() - start.getTime()) / 60000;
    if (breakMinutes > workMinutes) {
      return apiError("Pause darf nicht größer als die Arbeitszeit sein.", 400);
    }
  }

  const entry = await prisma.timeEntry.create({
    data: {
      orderId,
      employeeId: access.employee.id,
      startTime: new Date(body.startTime),
      endTime: body.endTime ? new Date(body.endTime) : undefined,
      breakMinutes: Number(body.breakMinutes) || 0,
      activity: body.activity?.trim() || null,
      notes: body.notes?.trim() || null,
      status: "OPEN",
    },
  });

  return apiSuccess(entry, 201);
}
