import { prisma } from "@/lib/prisma";
import { recalculateCalculationRecord } from "@/lib/calculation/recalculate-db";
import { createCalculationFromOrder } from "@/lib/calculation/build-from-order";
import { resolveMaterialLineUnitPrice } from "@/lib/orders/material-lines";
import { formatEuro } from "@/lib/utils";

type LineKind =
  | "header"
  | "service"
  | "material"
  | "labor"
  | "machine"
  | "travel"
  | "fixed"
  | "cost"
  | "other";

export type ProjectInvoiceDraftLine = {
  kind: LineKind;
  orderId: string | null;
  orderLabel: string | null;
  label: string;
  netAmount: number;
  /** Für LaborItems: Stunden / Stundensatz */
  hours?: number;
  hourlyRateNet?: number;
  /** Für Material */
  quantity?: number;
  unit?: string;
  purchasePriceNet?: number;
  markupPercent?: number;
  articleId?: string | null;
  /** Für Maschinen */
  usageHours?: number;
  machineId?: string | null;
  category?: "OTHER" | "MATERIAL" | "MACHINE" | "TRAVEL" | "LABOR";
  sourceKey?: string;
};

export type ProjectInvoiceDraft = {
  lines: ProjectInvoiceDraftLine[];
  groups: Array<{
    orderId: string | null;
    orderLabel: string;
    lines: ProjectInvoiceDraftLine[];
    subtotalNet: number;
  }>;
  netTotal: number;
  vatRatePercent: number;
  vatAmount: number;
  grossTotal: number;
  warnings: Array<{ orderId: string | null; message: string }>;
  includedOrderIds: string[];
  markOrderIds: string[];
  selectedCostIds: string[];
};

function timeEntryHours(entry: {
  startTime: Date;
  endTime: Date | null;
  breakMinutes: number;
}): number {
  if (!entry.endTime) return 0;
  const ms = entry.endTime.getTime() - entry.startTime.getTime();
  return Math.max(0, ms / 3_600_000 - (entry.breakMinutes || 0) / 60);
}

function orderLabel(order: { orderNumber: string; title: string | null }) {
  return order.title?.trim()
    ? `${order.orderNumber} · ${order.title.trim()}`
    : order.orderNumber;
}

function withOrderPrefix(order: { orderNumber: string; title: string | null }, text: string) {
  return `${orderLabel(order)} — ${text}`;
}

type OrderWithRelations = {
  id: string;
  orderNumber: string;
  title: string | null;
  status: string;
  customerId: string;
  invoicedAt: Date | null;
  services: Array<{
    id: string;
    quantity: number;
    unitPriceCents: number | null;
    customName: string | null;
    service: { name: string; durationMinutes: number } | null;
  }>;
  materialLines: Array<{
    id: string;
    name: string;
    notes: string | null;
    quantityRequired: number;
    unit: string;
    isTool: boolean;
    articleId: string | null;
    unitPriceNet: number | null;
    article: {
      name: string | null;
      supplierName: string | null;
      salesPriceNet: number | null;
      purchasePriceNet: number | null;
    } | null;
  }>;
  timeEntries: Array<{
    id: string;
    startTime: Date;
    endTime: Date | null;
    breakMinutes: number;
    status: string;
    employee: { user: { firstName: string; lastName: string } };
  }>;
  calculations: Array<{
    id: string;
    useFixedPrice: boolean;
    fixedPriceNet: number | null;
    fixedPriceLabel: string | null;
    netSalesPrice: number;
    documents: Array<{ id: string }>;
    laborItems: Array<{
      description: string;
      hours: number;
      hourlyRateNet: number;
      quantityWorkers: number;
      totalNet: number;
      isVisibleToCustomer: boolean;
    }>;
    materialItems: Array<{
      articleId: string | null;
      name: string;
      description: string | null;
      quantity: number;
      unit: string;
      purchasePriceNet: number;
      markupPercent: number;
      wastePercent: number;
      totalSalesNet: number;
      isVisibleToCustomer: boolean;
      supplierName: string | null;
    }>;
    machineUsages: Array<{
      machineId: string | null;
      description: string;
      usageHours: number;
      hourlyRateNet: number;
      breakageRiskPercent: number;
      totalNet: number;
      isVisibleToCustomer: boolean;
    }>;
    travelCost: {
      totalNet: number;
      isVisibleToCustomer: boolean;
    } | null;
    additionalItems: Array<{
      category: string;
      description: string;
      amountNet: number;
      markupPercent: number;
      totalNet: number;
      isVisibleToCustomer: boolean;
    }>;
    procurementCosts: Array<{
      description: string | null;
      totalNet: number;
      isVisibleToCustomer: boolean;
    }>;
  }>;
};

function latestCalc(order: OrderWithRelations) {
  return order.calculations[0] ?? null;
}

function isOrderAlreadyBilled(order: OrderWithRelations) {
  return (
    order.status === "ABGERECHNET" ||
    Boolean(order.invoicedAt) ||
    order.calculations.some((c) => c.documents.length > 0)
  );
}

/** Ob die Kalkulation überhaupt übernehmbare Positionen hat. */
function calcHasBillableContent(
  calc: NonNullable<ReturnType<typeof latestCalc>>
): boolean {
  if (
    calc.useFixedPrice &&
    calc.fixedPriceNet != null &&
    Number.isFinite(calc.fixedPriceNet)
  ) {
    return true;
  }
  if (calc.laborItems.some((l) => Math.abs(l.totalNet) >= 0.001 || l.hours > 0)) {
    return true;
  }
  if (calc.materialItems.some((m) => Math.abs(m.totalSalesNet) >= 0.001 || m.quantity > 0)) {
    return true;
  }
  if (calc.machineUsages.some((m) => Math.abs(m.totalNet) >= 0.001 || m.usageHours > 0)) {
    return true;
  }
  if (calc.travelCost && Math.abs(calc.travelCost.totalNet) >= 0.001) return true;
  if (calc.additionalItems.some((a) => Math.abs(a.totalNet) >= 0.001)) return true;
  if (calc.procurementCosts.some((p) => Math.abs(p.totalNet) >= 0.001)) return true;
  return false;
}

function countLinesForOrder(lines: ProjectInvoiceDraftLine[], orderId: string) {
  return lines.filter((l) => l.orderId === orderId && l.kind !== "header").length;
}

function pushServiceLines(
  lines: ProjectInvoiceDraftLine[],
  order: OrderWithRelations,
  services: OrderWithRelations["services"],
  hourlyRate: number
) {
  for (const os of services) {
    const label = os.service?.name ?? os.customName ?? "Leistung";
    const qty = os.quantity && os.quantity > 0 ? os.quantity : 1;
    if (os.unitPriceCents != null && !os.service) {
      const amountNet = (os.unitPriceCents / 100) * qty;
      lines.push({
        kind: "other",
        orderId: order.id,
        orderLabel: orderLabel(order),
        label: withOrderPrefix(order, label),
        netAmount: amountNet,
        category: "OTHER",
        sourceKey: `service:${os.id}`,
      });
      continue;
    }
    const hours = os.service
      ? Math.max((os.service.durationMinutes / 60) * qty, 0.25)
      : Math.max(qty, 0.25);
    lines.push({
      kind: "service",
      orderId: order.id,
      orderLabel: orderLabel(order),
      label: withOrderPrefix(order, label),
      netAmount: hours * hourlyRate,
      hours,
      hourlyRateNet: hourlyRate,
      sourceKey: `service:${os.id}`,
    });
  }
}

function pushMaterialLines(
  lines: ProjectInvoiceDraftLine[],
  order: OrderWithRelations,
  materials: OrderWithRelations["materialLines"],
  markup: number
) {
  for (const line of materials.filter((l) => !l.isTool)) {
    const unit = resolveMaterialLineUnitPrice(line);
    const amountNet = unit * line.quantityRequired;
    lines.push({
      kind: "material",
      orderId: order.id,
      orderLabel: orderLabel(order),
      label: withOrderPrefix(order, line.name),
      netAmount: amountNet * (1 + markup / 100),
      quantity: line.quantityRequired,
      unit: line.unit,
      purchasePriceNet: unit,
      markupPercent: markup,
      articleId: line.articleId,
      sourceKey: `material:${line.id}`,
    });
  }
}

function pushTimeLines(
  lines: ProjectInvoiceDraftLine[],
  order: OrderWithRelations,
  entries: OrderWithRelations["timeEntries"],
  hourlyRate: number
) {
  for (const te of entries) {
    if (!te.endTime || te.status === "OPEN") continue;
    const hours = timeEntryHours(te);
    if (hours <= 0) continue;
    const name = `${te.employee.user.firstName} ${te.employee.user.lastName}`.trim();
    lines.push({
      kind: "labor",
      orderId: order.id,
      orderLabel: orderLabel(order),
      label: withOrderPrefix(order, `Arbeitszeit ${name} (${hours.toFixed(2)} h)`),
      netAmount: hours * hourlyRate,
      hours,
      hourlyRateNet: hourlyRate,
      sourceKey: `time:${te.id}`,
    });
  }
}

function pushFromCalculation(
  lines: ProjectInvoiceDraftLine[],
  order: OrderWithRelations,
  calc: NonNullable<ReturnType<typeof latestCalc>>
) {
  if (
    calc.useFixedPrice &&
    calc.fixedPriceNet != null &&
    Number.isFinite(calc.fixedPriceNet)
  ) {
    const festLabel = (calc.fixedPriceLabel?.trim() || "Festpreis").trim();
    const title = order.title?.trim() || order.orderNumber;
    lines.push({
      kind: "fixed",
      orderId: order.id,
      orderLabel: orderLabel(order),
      label: `${festLabel} – ${title} – ${formatEuro(Number(calc.fixedPriceNet))}`,
      netAmount: Number(calc.fixedPriceNet),
      category: "OTHER",
      sourceKey: `fixed:${order.id}`,
    });
    return;
  }

  for (const l of calc.laborItems) {
    if (!l.isVisibleToCustomer && l.totalNet === 0) continue;
    lines.push({
      kind: "service",
      orderId: order.id,
      orderLabel: orderLabel(order),
      label: withOrderPrefix(order, l.description),
      netAmount: l.totalNet,
      hours: l.hours * Math.max(l.quantityWorkers, 1),
      hourlyRateNet: l.hourlyRateNet,
      sourceKey: `calc-labor:${calc.id}:${l.description}`,
    });
  }
  for (const m of calc.materialItems) {
    lines.push({
      kind: "material",
      orderId: order.id,
      orderLabel: orderLabel(order),
      label: withOrderPrefix(order, m.name),
      netAmount: m.totalSalesNet,
      quantity: m.quantity,
      unit: m.unit,
      purchasePriceNet: m.purchasePriceNet,
      markupPercent: m.markupPercent,
      articleId: m.articleId,
      sourceKey: `calc-mat:${calc.id}:${m.name}`,
    });
  }
  for (const mu of calc.machineUsages) {
    lines.push({
      kind: "machine",
      orderId: order.id,
      orderLabel: orderLabel(order),
      label: withOrderPrefix(order, mu.description || "Maschine"),
      netAmount: mu.totalNet,
      usageHours: mu.usageHours,
      hourlyRateNet: mu.hourlyRateNet,
      machineId: mu.machineId,
      category: "MACHINE",
      sourceKey: `calc-machine:${calc.id}:${mu.description}`,
    });
  }
  if (calc.travelCost && calc.travelCost.totalNet > 0) {
    lines.push({
      kind: "travel",
      orderId: order.id,
      orderLabel: orderLabel(order),
      label: withOrderPrefix(order, "Anfahrt / Fahrtkosten"),
      netAmount: calc.travelCost.totalNet,
      category: "TRAVEL",
      sourceKey: `calc-travel:${calc.id}`,
    });
  }
  for (const a of calc.additionalItems) {
    if (Math.abs(a.totalNet) < 0.001) continue;
    lines.push({
      kind: "other",
      orderId: order.id,
      orderLabel: orderLabel(order),
      label: withOrderPrefix(order, a.description),
      netAmount: a.totalNet,
      category: (a.category as ProjectInvoiceDraftLine["category"]) ?? "OTHER",
      sourceKey: `calc-add:${calc.id}:${a.description}`,
    });
  }
  for (const p of calc.procurementCosts) {
    if (Math.abs(p.totalNet) < 0.001) continue;
    lines.push({
      kind: "other",
      orderId: order.id,
      orderLabel: orderLabel(order),
      label: withOrderPrefix(order, p.description?.trim() || "Beschaffung"),
      netAmount: p.totalNet,
      category: "OTHER",
      sourceKey: `calc-proc:${calc.id}:${p.description ?? "x"}`,
    });
  }
}

function pushWholeOrderFallback(
  lines: ProjectInvoiceDraftLine[],
  order: OrderWithRelations,
  hourlyRate: number,
  markup: number
) {
  pushServiceLines(lines, order, order.services, hourlyRate);
  pushMaterialLines(lines, order, order.materialLines, markup);
  pushTimeLines(
    lines,
    order,
    order.timeEntries.filter((t) => t.endTime && t.status !== "OPEN"),
    hourlyRate
  );
  if (
    order.services.length === 0 &&
    order.materialLines.filter((l) => !l.isTool).length === 0 &&
    order.timeEntries.every((t) => !t.endTime || t.status === "OPEN")
  ) {
    lines.push({
      kind: "other",
      orderId: order.id,
      orderLabel: orderLabel(order),
      label: withOrderPrefix(order, "Auftragspauschale (keine Positionen erfasst)"),
      netAmount: 0,
      category: "OTHER",
      sourceKey: `empty:${order.id}`,
    });
  }
}

function groupLines(lines: ProjectInvoiceDraftLine[]) {
  const map = new Map<
    string,
    { orderId: string | null; orderLabel: string; lines: ProjectInvoiceDraftLine[] }
  >();
  for (const line of lines) {
    const key = line.orderId ?? "__project__";
    const label = line.orderLabel ?? "Projektkosten";
    if (!map.has(key)) {
      map.set(key, { orderId: line.orderId, orderLabel: label, lines: [] });
    }
    map.get(key)!.lines.push(line);
  }
  return [...map.values()].map((g) => ({
    ...g,
    subtotalNet: g.lines.reduce((s, l) => s + l.netAmount, 0),
  }));
}

/**
 * Baut die Positionsvorschau für eine Projekt-Abschlussrechnung (ohne Speichern).
 */
export async function buildProjectInvoiceDraft(input: {
  tenantId: string;
  projectId: string;
  costIds?: string[];
  orderIds?: string[];
  materialLineIds?: string[];
  orderServiceIds?: string[];
  timeEntryIds?: string[];
  /** Bereits abgerechnete Aufträge bewusst erneut übernehmen. */
  includeAlreadyBilled?: boolean;
  /** In der Vorschau abgewählte Positions-Keys. */
  excludedSourceKeys?: string[];
}): Promise<ProjectInvoiceDraft> {
  const project = await prisma.project.findFirst({
    where: { id: input.projectId, tenantId: input.tenantId },
    include: {
      costs: true,
      orders: {
        include: {
          services: { include: { service: true } },
          materialLines: { include: { article: true } },
          timeEntries: {
            include: {
              employee: {
                include: { user: { select: { firstName: true, lastName: true } } },
              },
            },
          },
          calculations: {
            orderBy: { updatedAt: "desc" },
            include: {
              documents: {
                where: { documentType: "INVOICE", status: { not: "STORNIERT" } },
                select: { id: true },
              },
              laborItems: true,
              materialItems: true,
              machineUsages: true,
              travelCost: true,
              additionalItems: true,
              procurementCosts: true,
            },
          },
        },
      },
    },
  });
  if (!project) throw new Error("Projekt nicht gefunden");

  const company = await prisma.companySettings.findUnique({
    where: { tenantId: input.tenantId },
  });
  const hourlyRate = company?.defaultHourlyRate ?? 68;
  const markup = company?.defaultMaterialMarkupPercent ?? 25;
  const vatRatePercent = company?.defaultVatRate ?? 19;
  const includeAlreadyBilled = Boolean(input.includeAlreadyBilled);
  const excluded = new Set(input.excludedSourceKeys ?? []);

  const selectedCosts = project.costs.filter((c) => {
    if (!c.isBillable) return false;
    if (c.invoicedAt && !includeAlreadyBilled) return false;
    if (input.costIds?.length) return input.costIds.includes(c.id);
    return false;
  });

  const selectedOrderIds = new Set(input.orderIds ?? []);
  const selectedMaterialIds = new Set(input.materialLineIds ?? []);
  const selectedServiceIds = new Set(input.orderServiceIds ?? []);
  const selectedTimeIds = new Set(input.timeEntryIds ?? []);

  // Wenn „gesamter Auftrag“ gewählt ist, hat das Vorrang vor Einzelpositionen.
  const warnings: ProjectInvoiceDraft["warnings"] = [];
  const lines: ProjectInvoiceDraftLine[] = [];
  const markOrderIds: string[] = [];
  const includedOrderIds = new Set<string>();

  for (const cost of selectedCosts) {
    if (cost.invoicedAt) {
      warnings.push({
        orderId: cost.orderId,
        message: `Kostenposition „${cost.description}“ wurde bereits abgerechnet.`,
      });
    }
    lines.push({
      kind: "cost",
      orderId: cost.orderId,
      orderLabel: cost.orderId
        ? orderLabel(
            project.orders.find((o) => o.id === cost.orderId) ?? {
              orderNumber: "Auftrag",
              title: null,
            }
          )
        : "Projektkosten",
      label: cost.description,
      netAmount: cost.netAmount,
      category: "OTHER",
      sourceKey: `cost:${cost.id}`,
    });
  }

  for (const order of project.orders as unknown as OrderWithRelations[]) {
    if (!selectedOrderIds.has(order.id)) continue;

    const billed = isOrderAlreadyBilled(order);
    if (billed && !includeAlreadyBilled) {
      warnings.push({
        orderId: order.id,
        message: `Auftrag ${order.orderNumber} wurde bereits abgerechnet und wurde übersprungen.`,
      });
      continue;
    }
    if (billed) {
      warnings.push({
        orderId: order.id,
        message:
          "Dieser Auftrag wurde bereits abgerechnet. Bitte prüfe, ob er erneut in die Projekt-Abschlussrechnung übernommen werden soll.",
      });
    }

    includedOrderIds.add(order.id);
    markOrderIds.push(order.id);

    const calc = latestCalc(order);
    if (calc && calcHasBillableContent(calc)) {
      const before = countLinesForOrder(lines, order.id);
      pushFromCalculation(lines, order, calc);
      // Leere/defekte Kalkulation → Auftragsdaten als Fallback
      if (countLinesForOrder(lines, order.id) === before) {
        pushWholeOrderFallback(lines, order, hourlyRate, markup);
      }
    } else {
      pushWholeOrderFallback(lines, order, hourlyRate, markup);
    }
  }

  for (const order of project.orders as unknown as OrderWithRelations[]) {
    // Gesamter Auftrag hat Vorrang – Granularzeilen dann nicht zusätzlich
    if (selectedOrderIds.has(order.id)) continue;

    const services = order.services.filter((os) => selectedServiceIds.has(os.id));
    const materials = order.materialLines.filter((l) => selectedMaterialIds.has(l.id));
    const times = order.timeEntries.filter((t) => selectedTimeIds.has(t.id));
    if (!services.length && !materials.length && !times.length) continue;

    const billed = isOrderAlreadyBilled(order);
    if (billed && !includeAlreadyBilled) {
      warnings.push({
        orderId: order.id,
        message: `Positionen von ${order.orderNumber} übersprungen (bereits abgerechnet).`,
      });
      continue;
    }
    if (billed) {
      warnings.push({
        orderId: order.id,
        message:
          "Dieser Auftrag wurde bereits abgerechnet. Bitte prüfe, ob er erneut in die Projekt-Abschlussrechnung übernommen werden soll.",
      });
    }

    includedOrderIds.add(order.id);
    pushServiceLines(lines, order, services, hourlyRate);
    pushMaterialLines(lines, order, materials, markup);
    pushTimeLines(lines, order, times, hourlyRate);
  }

  const billableLines = lines
    .filter((l) => l.kind !== "header")
    .filter((l) => !l.sourceKey || !excluded.has(l.sourceKey));
  if (billableLines.length === 0) {
    throw new Error(
      "Bitte mindestens eine noch nicht abgerechnete Position für die Rechnung auswählen."
    );
  }

  const netTotal = billableLines.reduce((s, l) => s + l.netAmount, 0);
  const vatAmount = Math.round(netTotal * (vatRatePercent / 100) * 100) / 100;
  const grossTotal = Math.round((netTotal + vatAmount) * 100) / 100;
  const remainingOrderIds = [
    ...new Set(billableLines.map((l) => l.orderId).filter((x): x is string => Boolean(x))),
  ];

  return {
    lines: billableLines,
    groups: groupLines(billableLines),
    netTotal,
    vatRatePercent,
    vatAmount,
    grossTotal,
    warnings,
    includedOrderIds: remainingOrderIds,
    markOrderIds: markOrderIds.filter((id) => remainingOrderIds.includes(id)),
    selectedCostIds: selectedCosts
      .map((c) => c.id)
      .filter((id) => !excluded.has(`cost:${id}`)),
  };
}

/**
 * Erstellt Projekt-Abschlusskalkulation(en).
 * - mode=aggregate: eine Gesamtrechnung aus ausgewählten Positionen (Variante A: gruppiert nach Auftrag)
 * - mode=per_order: je Auftrag eine eigene Kalkulation (nur orderIds)
 */
export async function createProjectInvoiceCalculation(input: {
  tenantId: string;
  projectId: string;
  title?: string;
  mode?: "aggregate" | "per_order";
  costIds?: string[];
  orderIds?: string[];
  materialLineIds?: string[];
  orderServiceIds?: string[];
  timeEntryIds?: string[];
  includeAlreadyBilled?: boolean;
  excludedSourceKeys?: string[];
  /** Nur Vorschau – keine Persistenz. */
  preview?: boolean;
}) {
  const mode = input.mode ?? "aggregate";

  if (mode === "per_order") {
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, tenantId: input.tenantId },
      include: {
        orders: {
          include: {
            calculations: {
              include: {
                documents: {
                  where: { documentType: "INVOICE", status: { not: "STORNIERT" } },
                  select: { id: true },
                },
              },
            },
          },
        },
      },
    });
    if (!project) throw new Error("Projekt nicht gefunden");

    const orderIds = input.orderIds?.length
      ? input.orderIds
      : project.orders.map((o) => o.id);
    const results: Array<{
      id: string;
      title: string | null;
      status: string;
      netSalesPrice: number;
      vatAmount: number;
      grossSalesPrice: number;
      orderId: string | null;
      created: boolean;
    }> = [];
    const warnings: ProjectInvoiceDraft["warnings"] = [];

    for (const orderId of orderIds) {
      const order = project.orders.find((o) => o.id === orderId);
      if (!order) continue;
      const hasInvoice = order.calculations.some((c) => c.documents.length > 0);
      if ((hasInvoice || order.status === "ABGERECHNET") && !input.includeAlreadyBilled) {
        warnings.push({
          orderId,
          message: `Auftrag bereits abgerechnet und übersprungen.`,
        });
        continue;
      }
      if (input.preview) {
        results.push({
          id: "preview",
          title: `Kalkulation ${order.orderNumber}`,
          status: "DRAFT",
          netSalesPrice: 0,
          vatAmount: 0,
          grossSalesPrice: 0,
          orderId,
          created: false,
        });
        continue;
      }
      const { calculation, created } = await createCalculationFromOrder(
        input.tenantId,
        orderId
      );
      if (!calculation.projectId) {
        await prisma.calculation.update({
          where: { id: calculation.id },
          data: { projectId: project.id },
        });
      }
      results.push({
        id: calculation.id,
        title: calculation.title,
        status: calculation.status,
        netSalesPrice: calculation.netSalesPrice,
        vatAmount: calculation.vatAmount,
        grossSalesPrice: calculation.grossSalesPrice,
        orderId: calculation.orderId,
        created,
      });
    }

    if (results.length === 0) {
      throw new Error(
        "Keine neuen Auftragskalkulationen möglich (bereits abgerechnet oder keine Auswahl)."
      );
    }

    return {
      mode: "per_order" as const,
      calculations: results,
      primary: results[0],
      draft: null as ProjectInvoiceDraft | null,
      warnings,
    };
  }

  const draft = await buildProjectInvoiceDraft({
    tenantId: input.tenantId,
    projectId: input.projectId,
    costIds: input.costIds,
    orderIds: input.orderIds,
    materialLineIds: input.materialLineIds,
    orderServiceIds: input.orderServiceIds,
    timeEntryIds: input.timeEntryIds,
    includeAlreadyBilled: input.includeAlreadyBilled,
    excludedSourceKeys: input.preview ? undefined : input.excludedSourceKeys,
  });

  if (input.preview) {
    return {
      mode: "aggregate" as const,
      calculations: [],
      primary: null,
      draft,
      warnings: draft.warnings,
    };
  }

  const project = await prisma.project.findFirst({
    where: { id: input.projectId, tenantId: input.tenantId },
    select: { id: true, name: true, customerId: true },
  });
  if (!project) throw new Error("Projekt nicht gefunden");

  const company = await prisma.companySettings.findUnique({
    where: { tenantId: input.tenantId },
  });
  const overhead = await prisma.overheadSettings.findUnique({
    where: { tenantId: input.tenantId },
  });

  const laborCreates = draft.lines
    .filter((l) => l.kind === "service" || l.kind === "labor")
    .map((l) => ({
      description: l.label,
      laborType: "ONSITE_WORK" as const,
      hours: Math.max(l.hours ?? (l.netAmount / Math.max(l.hourlyRateNet ?? 1, 0.01)), 0.01),
      hourlyRateNet: l.hourlyRateNet ?? company?.defaultHourlyRate ?? 68,
      quantityWorkers: 1,
      isVisibleToCustomer: true,
    }));

  const materialCreates = draft.lines
    .filter((l) => l.kind === "material")
    .map((l) => ({
      articleId: l.articleId ?? undefined,
      name: l.label,
      quantity: l.quantity ?? 1,
      unit: l.unit ?? "Stk",
      purchasePriceNet: l.purchasePriceNet ?? 0,
      markupPercent: l.markupPercent ?? 0,
      isVisibleToCustomer: true,
    }));

  // Maschinen, Festpreis, Fahrt, Kosten, Sonstiges → zusätzliche Positionen,
  // damit sie auf der Kundenrechnung sichtbar sind (nicht in „Projektpauschale“).
  const additionalCreates = draft.lines
    .filter((l) =>
      ["fixed", "travel", "cost", "other", "machine"].includes(l.kind)
    )
    .map((l) => ({
      category: "OTHER" as const,
      description: l.label,
      amountNet: l.netAmount,
      markupPercent: 0,
      totalNet: l.netAmount,
      isVisibleToCustomer: true,
    }));

  const orderLabels = draft.groups
    .filter((g) => g.orderId)
    .map((g) => g.orderLabel);

  const calc = await prisma.calculation.create({
    data: {
      tenantId: input.tenantId,
      title: input.title?.trim() || `Abschlussrechnung ${project.name}`,
      customerId: project.customerId,
      projectId: project.id,
      // Direkte Positionsübernahme ohne Zuschläge (sonst „Projektpauschale“ auf dem Beleg)
      overheadAmountOverride: 0,
      snapshotJson: {
        projectClosingInvoice: true,
        includedOrderIds: draft.includedOrderIds,
        markOrderIds: draft.markOrderIds,
        orderLabels,
        lineCount: draft.lines.length,
        netTotal: draft.netTotal,
      },
      ...(laborCreates.length ? { laborItems: { create: laborCreates } } : {}),
      ...(materialCreates.length
        ? { materialItems: { create: materialCreates } }
        : {}),
      ...(additionalCreates.length
        ? { additionalItems: { create: additionalCreates } }
        : {}),
      riskSettings: {
        create: {
          riskLevel: "NORMAL",
          riskPercent: 0,
        },
      },
      profitSettings: {
        create: {
          profitPercent: 0,
          profitStrategy: "PERCENT",
        },
      },
      incomeTaxSettings: {
        create: {
          estimatedIncomeTaxPercent: company?.defaultIncomeTaxPercent ?? 30,
          productiveHoursPerMonth: overhead?.productiveHoursPerMonth ?? 160,
          allocationMode: "PROFIT_CHECK_ONLY",
        },
      },
      vatSettings: {
        create: {
          vatRatePercent: company?.defaultVatRate ?? 19,
        },
      },
    },
  });

  if (draft.selectedCostIds.length > 0) {
    await prisma.projectCost.updateMany({
      where: {
        id: { in: draft.selectedCostIds },
        projectId: project.id,
        invoicedAt: null,
      },
      data: {
        invoicedAt: new Date(),
        invoicedCalculationId: calc.id,
      },
    });
  }

  if (draft.markOrderIds.length > 0) {
    await prisma.order.updateMany({
      where: {
        id: { in: draft.markOrderIds },
        tenantId: input.tenantId,
      },
      data: {
        status: "ABGERECHNET",
        invoicedAt: new Date(),
      },
    });
  }

  await recalculateCalculationRecord(calc.id, input.tenantId);

  const full = await prisma.calculation.findFirstOrThrow({
    where: { id: calc.id },
    select: {
      id: true,
      title: true,
      status: true,
      netSalesPrice: true,
      vatAmount: true,
      grossSalesPrice: true,
      orderId: true,
    },
  });

  return {
    mode: "aggregate" as const,
    calculations: [full],
    primary: full,
    draft,
    warnings: draft.warnings,
  };
}
