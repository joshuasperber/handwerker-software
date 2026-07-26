export type ServiceUsage = {
  orderServices: number;
  checklistTemplates: number;
  orderMaterialLines: number;
  total: number;
  inUse: boolean;
};

export function summarizeServiceUsage(counts: {
  orderServices: number;
  checklistTemplates: number;
  orderMaterialLines: number;
}): ServiceUsage {
  const orderServices = Math.max(0, counts.orderServices);
  const checklistTemplates = Math.max(0, counts.checklistTemplates);
  const orderMaterialLines = Math.max(0, counts.orderMaterialLines);
  const total = orderServices + checklistTemplates + orderMaterialLines;
  return {
    orderServices,
    checklistTemplates,
    orderMaterialLines,
    total,
    inUse: total > 0,
  };
}

/** Menschlich lesbare Begründung, warum hartes Löschen nicht möglich ist. */
export function describeServiceUsageBlock(usage: ServiceUsage): string {
  if (!usage.inUse) return "";
  const parts: string[] = [];
  if (usage.orderServices > 0) {
    parts.push(
      `${usage.orderServices} Auftrag${usage.orderServices === 1 ? "" : "e"}`
    );
  }
  if (usage.checklistTemplates > 0) {
    parts.push(
      `${usage.checklistTemplates} Checklisten-Vorlage${usage.checklistTemplates === 1 ? "" : "n"}`
    );
  }
  if (usage.orderMaterialLines > 0) {
    parts.push(
      `${usage.orderMaterialLines} Materialposition${usage.orderMaterialLines === 1 ? "" : "en"}`
    );
  }
  return `Die Leistung wird bereits verwendet (${parts.join(", ")}) und kann nicht endgültig gelöscht werden. Sie wurde deaktiviert und erscheint nicht mehr in neuen Aufträgen.`;
}
