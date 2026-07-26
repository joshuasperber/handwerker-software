/** Tätigkeiten für Stundenzettel ohne (oder mit) Auftrag */
export const TIME_ENTRY_ACTIVITIES = [
  "Lagerarbeit",
  "Vorbereitung",
  "Fahrzeit",
  "Büroarbeit",
  "allgemeine Arbeit",
  "interne Aufgaben",
  "Werkstatt",
  "Sonstiges",
] as const;

export type TimeEntryActivity = (typeof TIME_ENTRY_ACTIVITIES)[number];

export const TIME_ENTRY_STATUS_LABELS: Record<string, string> = {
  OPEN: "Offen",
  REVIEWED: "Geprüft",
  APPROVED: "Freigegeben",
};

export interface TimeEntryInput {
  startTime: string | Date;
  endTime?: string | Date | null;
  breakMinutes?: number;
  orderId?: string | null;
  activity?: string | null;
  notes?: string | null;
  status?: "OPEN" | "REVIEWED" | "APPROVED";
  /** Bei Update: Endzeit darf fehlen (läuft noch) */
  requireEndTime?: boolean;
}

export function validateTimeEntryInput(input: TimeEntryInput): string | null {
  if (!input.startTime) return "Startzeit ist Pflicht.";

  const start = new Date(input.startTime);
  if (Number.isNaN(start.getTime())) return "Ungültige Startzeit.";

  const requireEnd = input.requireEndTime !== false;
  if (requireEnd && (input.endTime == null || input.endTime === "")) {
    return "Endzeit ist Pflicht.";
  }

  let end: Date | null = null;
  if (input.endTime != null && input.endTime !== "") {
    end = new Date(input.endTime);
    if (Number.isNaN(end.getTime())) return "Ungültige Endzeit.";
    if (end.getTime() < start.getTime()) {
      return "Endzeit darf nicht vor der Startzeit liegen.";
    }
  }

  const breakMinutes = Number(input.breakMinutes ?? 0);
  if (!Number.isFinite(breakMinutes) || breakMinutes < 0) {
    return "Pause muss 0 oder größer sein.";
  }

  if (end) {
    const workMinutes = (end.getTime() - start.getTime()) / 60000;
    if (breakMinutes > workMinutes) {
      return "Pause darf nicht größer als die Arbeitszeit sein.";
    }
  }

  const hasOrder = Boolean(input.orderId);
  const activity = input.activity?.trim() ?? "";
  const notes = input.notes?.trim() ?? "";
  if (!hasOrder && !activity && !notes) {
    return "Ohne Auftrag bitte eine Tätigkeit oder Notiz angeben.";
  }

  return null;
}

export function calcWorkedHours(
  startTime: Date | string,
  endTime: Date | string | null | undefined,
  breakMinutes = 0
): number | null {
  if (!endTime) return null;
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  const hours = Math.max(0, (end - start) / 3600000 - breakMinutes / 60);
  return Math.round(hours * 100) / 100;
}
