import { prisma } from "@/lib/prisma";
import type { OrderPhaseType } from "@/generated/prisma/client";

/**
 * Kanonische Standardphasen, die jeder Auftrag erhält. `phaseKey` ist ein
 * stabiler Schlüssel, mit dem sich Standardphasen unabhängig vom angezeigten
 * Namen wiedererkennen lassen; `phaseType` knüpft an das bestehende Enum an.
 */
export const STANDARD_PHASES = [
  { phaseKey: "AUFMASS", name: "Aufmaß", phaseType: "BESICHTIGUNG" },
  { phaseKey: "ANGEBOT", name: "Vertrag vorstellen", phaseType: "PLANUNG" },
  { phaseKey: "FERTIGEN", name: "Fertigen", phaseType: "VORFERTIGUNG" },
  { phaseKey: "MONTIEREN", name: "Möbel einbauen", phaseType: "AUSFUEHRUNG_1" },
  { phaseKey: "RECHNUNG", name: "Rechnung", phaseType: "RECHNUNG" },
] as const;

/** Erzeugt die Prisma-`create`-Daten für die Standardphasen eines Auftrags. */
export function standardPhaseCreateData() {
  return STANDARD_PHASES.map((phase, index) => ({
    name: phase.name,
    phaseType: phase.phaseType as OrderPhaseType,
    status: "AUSSTEHEND" as const,
    isEnabled: true,
    sortOrder: index,
  }));
}

/**
 * Stellt sicher, dass ein Auftrag Phasen besitzt. Bestehende Aufträge ohne
 * Phasen erhalten dabei automatisch die Standardphasen. Idempotent: existieren
 * bereits Phasen, passiert nichts.
 */
export async function ensureOrderPhases(orderId: string): Promise<void> {
  const count = await prisma.orderPhase.count({ where: { orderId } });
  if (count > 0) return;

  await prisma.orderPhase.createMany({
    data: standardPhaseCreateData().map((phase) => ({ ...phase, orderId })),
  });
}

export { getCurrentPhase } from "@/lib/phase-status";
