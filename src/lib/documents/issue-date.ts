/**
 * Parst ein Rechnungsdatum aus dem Client (YYYY-MM-DD oder ISO).
 * Speichert als lokaler Mitternacht → UTC, damit der Kalendertag stabil bleibt.
 */
export function parseIssueDateInput(raw: unknown): Date | null {
  if (raw == null || raw === "") return null;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return startOfLocalDay(raw);
  }
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  const dayOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dayOnly) {
    const y = Number(dayOnly[1]);
    const m = Number(dayOnly[2]);
    const d = Number(dayOnly[3]);
    const date = new Date(y, m - 1, d, 12, 0, 0, 0);
    if (
      date.getFullYear() !== y ||
      date.getMonth() !== m - 1 ||
      date.getDate() !== d
    ) {
      return null;
    }
    return date;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return startOfLocalDay(parsed);
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
}

/** Verschiebt Fälligkeit um dieselbe Differenz wie das Rechnungsdatum. */
export function shiftDueDateForIssueChange(
  oldIssue: Date,
  newIssue: Date,
  dueDate: Date | null | undefined
): Date | null {
  if (!dueDate) return null;
  const delta = newIssue.getTime() - oldIssue.getTime();
  return new Date(dueDate.getTime() + delta);
}

export function formatIssueDateInput(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
