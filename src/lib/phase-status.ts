/**
 * Client- und serverseitig nutzbare, reine Helfer rund um den Phasenstatus.
 * (Kein Prisma-Import, damit auch Client-Komponenten dies verwenden können.)
 */

type PhaseLike = {
  id: string;
  name: string;
  status: string;
  isEnabled?: boolean;
  sortOrder?: number;
};

/** Phasen-Form inkl. Zuweisung, wie sie Schedule-/Today-APIs liefern. */
export interface PhaseSummary {
  id: string;
  name: string;
  status: string;
  isEnabled: boolean;
  sortOrder: number;
  assignedTeam?: { id: string; name: string } | null;
  assignedEmployee?: { user: { firstName: string; lastName: string } } | null;
  notes?: string | null;
  specialNotes?: string | null;
}

/** Kurzname des/der Phasen-Zuständigen (Mitarbeiter bevorzugt, sonst Team). */
export function phaseAssigneeLabel(phase: PhaseSummary | null | undefined): string | null {
  if (!phase) return null;
  if (phase.assignedEmployee) {
    return `${phase.assignedEmployee.user.firstName} ${phase.assignedEmployee.user.lastName}`;
  }
  return phase.assignedTeam?.name ?? null;
}

/**
 * Ermittelt die aktuell relevante Phase eines Auftrags für die Übersicht:
 *  1. die erste aktive Phase „in Bearbeitung“,
 *  2. sonst die erste noch nicht abgeschlossene/übersprungene Phase,
 *  3. sonst die letzte aktive Phase (alle erledigt).
 * Deaktivierte Phasen werden ignoriert.
 */
export function getCurrentPhase<T extends PhaseLike>(
  phases: T[] | undefined | null
): T | null {
  if (!phases || phases.length === 0) return null;

  const enabled = [...phases]
    .filter((p) => p.isEnabled !== false)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  if (enabled.length === 0) return null;

  const inProgress = enabled.find((p) => p.status === "IN_ARBEIT");
  if (inProgress) return inProgress;

  const open = enabled.find(
    (p) =>
      p.status !== "ABGESCHLOSSEN" &&
      p.status !== "UEBERSPRUNGEN" &&
      p.status !== "STORNIERT"
  );
  if (open) return open;

  return enabled[enabled.length - 1];
}
