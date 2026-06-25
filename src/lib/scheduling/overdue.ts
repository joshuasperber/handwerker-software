import { startOfDay, endOfDay } from "date-fns";
import type { OrderStatus, AppointmentStatus, Prisma } from "@/generated/prisma/client";
import { DONE_ORDER_STATUSES } from "@/lib/utils";

/** Abgeschlossene oder stornierte Termine zählen nicht als überfällig. */
export const TERMINAL_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "ABGESCHLOSSEN",
  "STORNIERT",
];

/** Laufende Termine (heute) gelten nicht als überfällig. */
export const IN_PROGRESS_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "UNTERWEGS",
  "ANGEKOMMEN",
  "IN_ARBEIT",
];

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Auftrag überfällig: geplanter Termin liegt vor dem heutigen Tag
 * und der Auftrag ist noch nicht erledigt.
 */
export function isOrderOverdue(
  scheduledStart: string | Date | null | undefined,
  status: string,
  now = new Date()
): boolean {
  if (DONE_ORDER_STATUSES.includes(status)) return false;
  const date = toDate(scheduledStart);
  if (!date) return false;
  return date < startOfDay(now);
}

/**
 * Termin überfällig: vergangener Kalendertag oder heute geplant,
 * Startzeit vorbei, Status noch GEPLANT (nicht unterwegs/in Arbeit).
 */
export function isAppointmentOverdue(
  startTime: string | Date | null | undefined,
  status: string,
  now = new Date()
): boolean {
  if (TERMINAL_APPOINTMENT_STATUSES.includes(status as AppointmentStatus)) {
    return false;
  }
  const date = toDate(startTime);
  if (!date) return false;

  const dayStart = startOfDay(now);
  if (date < dayStart) return true;

  if (IN_PROGRESS_APPOINTMENT_STATUSES.includes(status as AppointmentStatus)) {
    return false;
  }

  return status === "GEPLANT" && date < now;
}

/** Prisma-Filter für überfällige Aufträge (Dashboard, Critical, Stats). */
export function buildOrderOverdueWhere(
  tenantId: string,
  now = new Date()
): Prisma.OrderWhereInput {
  return {
    tenantId,
    scheduledStart: { lt: startOfDay(now) },
    status: { notIn: DONE_ORDER_STATUSES as OrderStatus[] },
  };
}

/** Prisma-Filter für überfällige Termine. */
export function buildAppointmentOverdueWhere(
  tenantId: string,
  now = new Date()
): Prisma.AppointmentWhereInput {
  const dayStart = startOfDay(now);
  return {
    tenantId,
    status: { notIn: TERMINAL_APPOINTMENT_STATUSES },
    OR: [
      { startTime: { lt: dayStart } },
      {
        startTime: { gte: dayStart, lt: now },
        status: "GEPLANT",
      },
    ],
  };
}

/** Aktive Aufträge mit Termin heute (Critical-Warnungen). */
export function buildTodayActiveOrdersWhere(
  tenantId: string,
  now = new Date()
): Prisma.OrderWhereInput {
  return {
    tenantId,
    scheduledStart: { gte: startOfDay(now), lte: endOfDay(now) },
    status: { notIn: DONE_ORDER_STATUSES as OrderStatus[] },
  };
}
