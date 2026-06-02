/** Zentrale Inventarformeln – Spec §10.3 */

export function calcAvailableQuantity(onHand: number, reserved: number): number {
  return Math.max(0, roundQty(onHand - reserved));
}

export function roundQty(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function calcReorderSuggestion(params: {
  targetStock: number;
  availableTotal: number;
  openOrderDemand: number;
  packageSize: number;
  minimumOrderQty?: number;
}): number {
  const need = params.targetStock - params.availableTotal + params.openOrderDemand;
  if (need <= 0) return 0;

  const pkg = params.packageSize > 0 ? params.packageSize : 1;
  let qty = Math.ceil(need / pkg) * pkg;

  if (params.minimumOrderQty && qty < params.minimumOrderQty) {
    qty = params.minimumOrderQty;
  }

  return roundQty(qty);
}

export type MaterialAmpel = "green" | "yellow" | "red" | "gray";

export function materialAmpel(status: string): MaterialAmpel {
  switch (status) {
    case "COMPLETE":
    case "PACKED":
    case "CONSUMED":
      return "green";
    case "PARTLY_AVAILABLE":
    case "ORDERED":
    case "DELIVERED":
    case "NOT_CHECKED":
      return "yellow";
    case "MISSING":
      return "red";
    default:
      return "gray";
  }
}

export const ORDER_TYPE_LABELS: Record<string, string> = {
  RENOVIERUNG: "Wohnungssanierung / Renovierung",
  INNENAUSBAU: "Innenausbau",
  REPARATUR: "Reparatur",
  MONTAGE: "Montage",
  ELEKTRO: "Elektroinstallation",
  BESICHTIGUNG: "Besichtigung / Aufmaß",
  NACHARBEIT: "Nacharbeit / Reklamation",
  NOTDIENST: "Notdienst",
  SONSTIGES: "Sonstiges",
};

export const MATERIAL_STATUS_LABELS: Record<string, string> = {
  NOT_CHECKED: "Nicht geprüft",
  COMPLETE: "Vollständig",
  PARTLY_AVAILABLE: "Teilweise verfügbar",
  MISSING: "Material fehlt",
  ORDERED: "Bestellt",
  DELIVERED: "Geliefert",
  PACKED: "Gepackt",
  CONSUMED: "Verbraucht",
};

export const PHASE_TEMPLATES: Record<string, { name: string; phaseType: string }[]> = {
  DEFAULT: [
    { name: "Aufmaß", phaseType: "BESICHTIGUNG" },
    { name: "Angebot", phaseType: "PLANUNG" },
    { name: "Ausführung", phaseType: "AUSFUEHRUNG_1" },
    { name: "Rechnung", phaseType: "RECHNUNG" },
  ],
  RENOVIERUNG: [
    { name: "Aufmaß", phaseType: "BESICHTIGUNG" },
    { name: "Angebot", phaseType: "PLANUNG" },
    { name: "Materialbestellung", phaseType: "MATERIALBESTELLUNG" },
    { name: "Ausführung", phaseType: "AUSFUEHRUNG_1" },
    { name: "Rechnung", phaseType: "RECHNUNG" },
  ],
  INNENAUSBAU: [
    { name: "Aufmaß", phaseType: "BESICHTIGUNG" },
    { name: "Angebot", phaseType: "PLANUNG" },
    { name: "Fertigen", phaseType: "VORFERTIGUNG" },
    { name: "Montieren", phaseType: "AUSFUEHRUNG_1" },
    { name: "Rechnung", phaseType: "RECHNUNG" },
  ],
  REPARATUR: [
    { name: "Aufmaß", phaseType: "BESICHTIGUNG" },
    { name: "Angebot", phaseType: "PLANUNG" },
    { name: "Ausführung", phaseType: "AUSFUEHRUNG_1" },
    { name: "Rechnung", phaseType: "RECHNUNG" },
  ],
  MONTAGE: [
    { name: "Angebot", phaseType: "PLANUNG" },
    { name: "Montieren", phaseType: "AUSFUEHRUNG_1" },
    { name: "Rechnung", phaseType: "RECHNUNG" },
  ],
  BESICHTIGUNG: [
    { name: "Aufmaß", phaseType: "BESICHTIGUNG" },
    { name: "Angebot", phaseType: "PLANUNG" },
  ],
};
