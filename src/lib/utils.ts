import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Anzeigename einer Auftrags-Leistung (Katalog oder „Sonstige Leistung“). */
export function orderServiceLabel(entry: {
  service?: { name: string } | null;
  customName?: string | null;
}): string {
  return entry.service?.name ?? entry.customName ?? "Sonstige Leistung";
}

const euroFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

/** Formatiert einen Euro-Betrag (Wert ist bereits in Euro). */
export function formatEuro(value: number | null | undefined): string {
  return euroFormatter.format(Number(value ?? 0));
}

/** Formatiert einen in Cent gespeicherten Betrag als Euro. */
export function formatCurrency(cents: number | null | undefined): string {
  return euroFormatter.format(Number(cents ?? 0) / 100);
}

/** Parst eine Eingabe (akzeptiert Komma oder Punkt als Dezimaltrenner). */
export function parseNumberInput(value: string, fallback = 0): number {
  if (value === "" || value == null) return fallback;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "";
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "";
  return date.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatSlotLabel(
  start: string | Date,
  end: string | Date
): string {
  const fmt = (value: string | Date) => {
    const date = toDate(value);
    return date
      ? date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
      : "";
  };
  return `${fmt(start)} – ${fmt(end)} Uhr`;
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  NEUE_ANFRAGE: "Neue Anfrage",
  TERMIN_GEBUCHT: "Termin gebucht",
  EINGEPLANT: "Eingeplant",
  UNTERWEGS: "Unterwegs",
  IN_ARBEIT: "In Arbeit",
  ABGESCHLOSSEN: "Abgeschlossen",
  ABRECHNUNGSBEREIT: "Abrechnungsbereit",
  ABGERECHNET: "Abgerechnet",
  STORNIERT: "Storniert",
};

/**
 * Auftragsstatus, die als "erledigt" gelten und im Erledigt-Reiter landen.
 * Aktive Aufträge sind alle übrigen Status.
 */
export const DONE_ORDER_STATUSES: string[] = [
  "ABGESCHLOSSEN",
  "ABRECHNUNGSBEREIT",
  "ABGERECHNET",
  "STORNIERT",
];

/** True, wenn der Auftrag als erledigt gilt. */
export function isOrderDone(status: string): boolean {
  return DONE_ORDER_STATUSES.includes(status);
}

/** True, wenn das Datum auf den heutigen Tag fällt. */
export function isToday(value: string | Date | null | undefined): boolean {
  const date = toDate(value);
  if (!date) return false;
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

import { isOrderOverdue } from "@/lib/scheduling/overdue";

/** @deprecated Alias — bitte isOrderOverdue aus @/lib/scheduling/overdue verwenden. */
export function isOverdue(
  scheduledStart: string | Date | null | undefined,
  status: string
): boolean {
  return isOrderOverdue(scheduledStart, status);
}

/** Logische Reihenfolge der Auftragsstatus (für Status-Auswahl). */
export const ORDER_STATUS_FLOW: string[] = [
  "NEUE_ANFRAGE",
  "TERMIN_GEBUCHT",
  "EINGEPLANT",
  "UNTERWEGS",
  "IN_ARBEIT",
  "ABGESCHLOSSEN",
  "ABRECHNUNGSBEREIT",
  "ABGERECHNET",
  "STORNIERT",
];

export const PRIORITY_LABELS: Record<string, string> = {
  NORMAL: "Normal",
  DRINGEND: "Dringend",
  NOTFALL: "Notfall",
};

export const PRIORITY_COLORS: Record<string, string> = {
  NORMAL: "bg-slate-100 text-slate-600",
  DRINGEND: "bg-amber-100 text-amber-700",
  NOTFALL: "bg-red-100 text-red-700",
};

export const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  GEPLANT: "Geplant",
  UNTERWEGS: "Unterwegs",
  ANGEKOMMEN: "Angekommen",
  IN_ARBEIT: "In Arbeit",
  ABGESCHLOSSEN: "Abgeschlossen",
  STORNIERT: "Storniert",
};

export const PHASE_STATUS_LABELS: Record<string, string> = {
  AUSSTEHEND: "Offen",
  IN_ARBEIT: "In Bearbeitung",
  ABGESCHLOSSEN: "Abgeschlossen",
  UEBERSPRUNGEN: "Übersprungen",
  STORNIERT: "Storniert",
};

/** Auswählbare Phasen-Status in logischer Reihenfolge. */
export const PHASE_STATUS_FLOW: string[] = [
  "AUSSTEHEND",
  "IN_ARBEIT",
  "ABGESCHLOSSEN",
  "UEBERSPRUNGEN",
];

/** Badge-Farb-Status (vgl. Badge-Komponente) je Phasen-Status. */
export const PHASE_STATUS_BADGE: Record<string, string> = {
  AUSSTEHEND: "NEUE_ANFRAGE",
  IN_ARBEIT: "IN_ARBEIT",
  ABGESCHLOSSEN: "ABGESCHLOSSEN",
  UEBERSPRUNGEN: "DRAFT",
  STORNIERT: "STORNIERT",
};

export const VEHICLE_STATUS_LABELS: Record<string, string> = {
  VERFUEGBAR: "Verfügbar",
  IM_EINSATZ: "Im Einsatz",
  WERKSTATT: "Werkstatt",
  INAKTIV: "Inaktiv",
};

/** Badge-Farb-Status (vgl. Badge-Komponente) je Fahrzeug-Status. */
export const VEHICLE_STATUS_BADGE: Record<string, string> = {
  VERFUEGBAR: "VERFUEGBAR",
  IM_EINSATZ: "IM_TERMIN",
  WERKSTATT: "URLAUB",
  INAKTIV: "STORNIERT",
};

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrator",
  MEISTER: "Meister",
  BUERO: "Büro",
  MONTEUR: "Monteur",
  KUNDE: "Kunde",
  GAST: "Gast (eingeladen)",
};

/** Erzeugt eine Auftragsnummer im Format AUF-JJJJMMTT-XXXX. */
export function generateOrderNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const random = Math.floor(1000 + Math.random() * 9000);
  return `AUF-${year}${month}${day}-${random}`;
}

export const BOOKING_STEPS: string[] = [
  "Leistung",
  "Beschreibung",
  "Adresse",
  "Termin",
  "Kontakt",
  "Übersicht",
];
