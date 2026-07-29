import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { getEmployeeForUser, requireMonteurOrder } from "@/lib/monteur-access";
import {
  resolveStoredActivity,
  validateTimeEntryInput,
  TIME_ENTRY_ACTIVITY_SONSTIGES,
  isSonstigesActivity,
} from "@/lib/time-entry";
import type { SessionUser } from "@/lib/auth";

async function requireOwnTimeEntry(auth: SessionUser | Response, entryId: string) {
  if (auth instanceof Response) return { error: auth };

  const employee = await getEmployeeForUser(auth);
  if (!employee) return { error: apiError("Kein Mitarbeiterprofil", 403) };

  const entry = await prisma.timeEntry.findFirst({
    where: {
      id: entryId,
      employeeId: employee.id,
      employee: { tenantId: auth.tenantId },
    },
  });
  if (!entry) return { error: apiError("Zeiteintrag nicht gefunden", 404) };

  return { auth, employee, entry };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("monteur.own");
  const { id } = await params;
  const access = await requireOwnTimeEntry(auth, id);
  if ("error" in access) return access.error;

  const body = await request.json();
  const nextStart = body.startTime ?? access.entry.startTime;
  const nextEnd =
    body.endTime !== undefined ? body.endTime : access.entry.endTime;
  const nextBreak =
    body.breakMinutes !== undefined
      ? Number(body.breakMinutes)
      : access.entry.breakMinutes;
  const nextOrderId =
    body.orderId !== undefined ? body.orderId || null : access.entry.orderId;

  let activityForValidation =
    body.activity !== undefined ? body.activity : access.entry.activity;
  let activityCustom = body.activityCustom as string | undefined;
  if (
    body.activity === undefined &&
    body.activityCustom === undefined &&
    isSonstigesActivity(access.entry.activity)
  ) {
    activityForValidation = TIME_ENTRY_ACTIVITY_SONSTIGES;
    activityCustom = access.entry.activity ?? undefined;
  }

  const nextNotes = body.notes !== undefined ? body.notes : access.entry.notes;
  const storedActivity =
    body.activity !== undefined || body.activityCustom !== undefined
      ? resolveStoredActivity(activityForValidation, activityCustom)
      : access.entry.activity;

  const validationError = validateTimeEntryInput({
    startTime: nextStart,
    endTime: nextEnd,
    breakMinutes: nextBreak,
    orderId: nextOrderId,
    activity: activityForValidation,
    activityCustom,
    notes: nextNotes,
    requireEndTime: Boolean(nextEnd),
  });
  if (validationError) return apiError(validationError, 400);

  if (nextOrderId && nextOrderId !== access.entry.orderId) {
    const orderAccess = await requireMonteurOrder(access.auth, nextOrderId, {
      forTimeBooking: true,
    });
    if ("error" in orderAccess) return orderAccess.error;
  }

  const updated = await prisma.timeEntry.update({
    where: { id },
    data: {
      ...(body.startTime !== undefined ? { startTime: new Date(body.startTime) } : {}),
      ...(body.endTime !== undefined
        ? { endTime: body.endTime ? new Date(body.endTime) : null }
        : {}),
      ...(body.breakMinutes !== undefined
        ? { breakMinutes: Number(body.breakMinutes) || 0 }
        : {}),
      ...(body.notes !== undefined ? { notes: body.notes || null } : {}),
      ...(body.activity !== undefined || body.activityCustom !== undefined
        ? { activity: storedActivity }
        : {}),
      ...(body.orderId !== undefined ? { orderId: body.orderId || null } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
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

  return apiSuccess(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("monteur.own");
  const { id } = await params;
  const access = await requireOwnTimeEntry(auth, id);
  if ("error" in access) return access.error;

  await prisma.timeEntry.delete({ where: { id } });
  return apiSuccess({ deleted: true });
}
