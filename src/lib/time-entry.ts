/** Tätigkeiten für Stundenzettel */
export const TIME_ENTRY_ACTIVITIES = [
  "Montage",
  "Fahrtzeit",
  "Vorbereitung",
  "Lagerarbeit",
  "Aufmaß",
  "Nacharbeit",
  "Reparatur",
  "Büroarbeit",
  "Werkstatt",
  "allgemeine Arbeit",
  "Sonstiges",
] as const;

export type TimeEntryActivity = (typeof TIME_ENTRY_ACTIVITIES)[number];

export const TIME_ENTRY_ACTIVITY_SONSTIGES = "Sonstiges" as const;

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
  /** Auswahlliste-Wert, z. B. Montage oder Sonstiges */
  activity?: string | null;
  /** Pflicht-Freitext wenn activity === Sonstiges */
  activityCustom?: string | null;
  notes?: string | null;
  status?: "OPEN" | "REVIEWED" | "APPROVED";
  /** Bei Update: Endzeit darf fehlen (läuft noch) */
  requireEndTime?: boolean;
}

/** Speichert Tätigkeit: bei Sonstiges den Freitext, sonst den Listenwert. */
export function resolveStoredActivity(
  activity: string | null | undefined,
  activityCustom?: string | null
): string | null {
  const selected = activity?.trim() ?? "";
  if (!selected) return null;
  if (selected === TIME_ENTRY_ACTIVITY_SONSTIGES) {
    const custom = activityCustom?.trim() ?? "";
    return custom || TIME_ENTRY_ACTIVITY_SONSTIGES;
  }
  return selected;
}

export function isSonstigesActivity(activity: string | null | undefined): boolean {
  const a = activity?.trim() ?? "";
  if (a === TIME_ENTRY_ACTIVITY_SONSTIGES) return true;
  // Gespeicherte Freitexte sind nicht in der Standardliste
  if (!a) return false;
  return !(TIME_ENTRY_ACTIVITIES as readonly string[]).includes(a);
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

  const selected = input.activity?.trim() ?? "";
  if (selected === TIME_ENTRY_ACTIVITY_SONSTIGES) {
    const custom = input.activityCustom?.trim() ?? "";
    if (!custom) {
      return "Bitte die Tätigkeit unter „Sonstiges“ beschreiben.";
    }
  }

  const storedActivity = resolveStoredActivity(input.activity, input.activityCustom);
  const hasOrder = Boolean(input.orderId);
  const notes = input.notes?.trim() ?? "";
  if (!hasOrder && !storedActivity && !notes) {
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

/** Arbeitskosten = Stunden × Stundenlohn (netto). */
export function calcLaborCost(
  hours: number | null | undefined,
  hourlyWageNet: number | null | undefined
): number | null {
  if (hours == null || hourlyWageNet == null) return null;
  if (!Number.isFinite(hours) || !Number.isFinite(hourlyWageNet)) return null;
  if (hours < 0 || hourlyWageNet < 0) return null;
  return Math.round(hours * hourlyWageNet * 100) / 100;
}
