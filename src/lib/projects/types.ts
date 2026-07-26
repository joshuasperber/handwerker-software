import type { ProjectCostSource, ProjectStatus } from "@/generated/prisma/client";

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  GEPLANT: "Geplant",
  AKTIV: "Aktiv",
  PAUSIERT: "Pausiert",
  ABGESCHLOSSEN: "Abgeschlossen",
  ABGERECHNET: "Abgerechnet",
  STORNIERT: "Storniert",
};

export const PROJECT_COST_SOURCE_LABELS: Record<ProjectCostSource, string> = {
  MANUAL: "Manuell",
  INVENTORY: "Inventar",
  EXPENSE: "Beleg / Ausgabe",
  ORDER_MATERIAL: "Auftragsmaterial",
  RECEIPT: "Beleg",
  INVOICE: "Rechnung",
  ORDER: "Auftrag",
};

export const PROJECT_STATUSES = Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[];

export interface ProjectInput {
  name: string;
  customerId: string;
  addressStreet?: string | null;
  addressZip?: string | null;
  addressCity?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: ProjectStatus;
  description?: string | null;
  notes?: string | null;
  teamId?: string | null;
  employeeIds?: string[];
}

export function validateProjectInput(input: ProjectInput): string | null {
  if (!input.name?.trim()) return "Projektname ist Pflicht.";
  if (!input.customerId?.trim()) return "Kunde ist Pflicht.";
  if (input.startDate && input.endDate) {
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end < start) {
      return "Enddatum darf nicht vor dem Startdatum liegen.";
    }
  }
  return null;
}

export function parseOptionalDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
