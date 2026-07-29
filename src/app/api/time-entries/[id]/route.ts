import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import {
  resolveStoredActivity,
  validateTimeEntryInput,
} from "@/lib/time-entry";

/**
 * Admin/Büro: Stundenzettel prüfen, freigeben oder bearbeiten.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("time_entries.approve");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const body = await request.json();

  const entry = await prisma.timeEntry.findFirst({
    where: {
      id,
      employee: { tenantId: auth.tenantId },
    },
  });
  if (!entry) return apiError("Eintrag nicht gefunden", 404);

  const nextStart = body.startTime ?? entry.startTime;
  const nextEnd = body.endTime !== undefined ? body.endTime : entry.endTime;
  const nextBreak =
    body.breakMinutes !== undefined ? Number(body.breakMinutes) : entry.breakMinutes;
  const nextOrderId =
    body.orderId !== undefined ? body.orderId || null : entry.orderId;
  const nextActivity =
    body.activity !== undefined || body.activityCustom !== undefined
      ? resolveStoredActivity(body.activity ?? entry.activity, body.activityCustom)
      : entry.activity;
  const nextNotes = body.notes !== undefined ? body.notes : entry.notes;
  const nextStatus = body.status !== undefined ? body.status : entry.status;

  if (body.status !== undefined && !["OPEN", "REVIEWED", "APPROVED"].includes(body.status)) {
    return apiError("Ungültiger Status");
  }

  // Wenn nur Status geändert wird, keine Zeit-Validierung erzwingen für offene Einträge ohne Endzeit
  const onlyStatus =
    body.status !== undefined &&
    body.startTime === undefined &&
    body.endTime === undefined &&
    body.breakMinutes === undefined &&
    body.orderId === undefined &&
    body.activity === undefined &&
    body.activityCustom === undefined &&
    body.notes === undefined;

  if (!onlyStatus) {
    const validationError = validateTimeEntryInput({
      startTime: nextStart,
      endTime: nextEnd,
      breakMinutes: nextBreak,
      orderId: nextOrderId,
      activity: body.activity ?? nextActivity,
      activityCustom: body.activityCustom,
      notes: nextNotes,
      requireEndTime: Boolean(nextEnd),
    });
    if (validationError) return apiError(validationError, 400);

    if (nextOrderId) {
      const order = await prisma.order.findFirst({
        where: { id: nextOrderId, tenantId: auth.tenantId },
        select: { id: true },
      });
      if (!order) return apiError("Auftrag nicht gefunden", 404);
    }
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
      ...(body.orderId !== undefined ? { orderId: nextOrderId } : {}),
      ...(body.activity !== undefined || body.activityCustom !== undefined
        ? { activity: nextActivity }
        : {}),
      ...(body.notes !== undefined ? { notes: body.notes || null } : {}),
      ...(body.status !== undefined
        ? { status: nextStatus as "OPEN" | "REVIEWED" | "APPROVED" }
        : {}),
    },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          customer: { select: { firstName: true, lastName: true } },
        },
      },
      employee: {
        select: {
          id: true,
          user: { select: { firstName: true, lastName: true } },
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
  const auth = await requireAuth("time_entries.approve");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const entry = await prisma.timeEntry.findFirst({
    where: { id, employee: { tenantId: auth.tenantId } },
  });
  if (!entry) return apiError("Eintrag nicht gefunden", 404);

  await prisma.timeEntry.delete({ where: { id } });
  return apiSuccess({ deleted: true });
}
