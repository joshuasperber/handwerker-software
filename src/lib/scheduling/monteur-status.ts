import type { AppointmentStatus } from "@/generated/prisma/client";

/** Status, die Monteur per App setzen darf (kein Storno, kein Rücksetzen auf GEPLANT). */
export const MONTEUR_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "UNTERWEGS",
  "ANGEKOMMEN",
  "IN_ARBEIT",
  "ABGESCHLOSSEN",
];

export function isMonteurAppointmentStatus(status: string): status is AppointmentStatus {
  return (MONTEUR_APPOINTMENT_STATUSES as string[]).includes(status);
}
