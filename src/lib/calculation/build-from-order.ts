import { prisma } from "@/lib/prisma";
import { recalculateCalculationRecord } from "@/lib/calculation/recalculate-db";

export async function createCalculationFromOrder(tenantId: string, orderId: string) {
  const existing = await prisma.calculation.findFirst({
    where: { tenantId, orderId },
    orderBy: { updatedAt: "desc" },
  });
  if (existing) return { calculation: existing, created: false };

  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId },
    include: {
      customer: true,
      property: true,
      services: { include: { service: true } },
      materialLines: { include: { article: true } },
    },
  });
  if (!order) throw new Error("Auftrag nicht gefunden");

  const [company, overhead] = await Promise.all([
    prisma.companySettings.findUnique({ where: { tenantId } }),
    prisma.overheadSettings.findUnique({ where: { tenantId } }),
  ]);

  const defaultRate = company?.defaultHourlyRate ?? 68;
  const markup = company?.defaultMaterialMarkupPercent ?? 25;
  const kmRate = company?.defaultKilometerRate ?? 0.45;
  const travelRate = company?.defaultTravelHourlyRate ?? 45;

  // Katalog-Leistungen → Arbeitszeit aus hinterlegter Dauer.
  // „Sonstige Leistungen“ (customName): mit Festpreis als Zusatzposition,
  // ohne Festpreis als Arbeitszeit (1 h je Einheit).
  const laborCreates: {
    description: string;
    laborType: "ONSITE_WORK";
    hours: number;
    hourlyRateNet: number;
    quantityWorkers: number;
  }[] = [];

  const additionalCreates: {
    category: "OTHER";
    description: string;
    amountNet: number;
    markupPercent: number;
  }[] = [];

  for (const os of order.services) {
    const qty = os.quantity && os.quantity > 0 ? os.quantity : 1;
    if (os.service) {
      laborCreates.push({
        description: os.service.name,
        laborType: "ONSITE_WORK",
        hours: Math.max((os.service.durationMinutes / 60) * qty, 0.25),
        hourlyRateNet: defaultRate,
        quantityWorkers: 1,
      });
    } else if (os.unitPriceCents != null) {
      additionalCreates.push({
        category: "OTHER",
        description: os.customName ?? "Sonstige Leistung",
        amountNet: (os.unitPriceCents / 100) * qty,
        markupPercent: 0,
      });
    } else {
      laborCreates.push({
        description: os.customName ?? "Sonstige Leistung",
        laborType: "ONSITE_WORK",
        hours: Math.max(qty, 0.25),
        hourlyRateNet: defaultRate,
        quantityWorkers: 1,
      });
    }
  }

  if (laborCreates.length === 0 && additionalCreates.length === 0) {
    laborCreates.push({
      description: order.title ?? order.orderNumber,
      laborType: "ONSITE_WORK",
      hours: 2,
      hourlyRateNet: defaultRate,
      quantityWorkers: 1,
    });
  }

  const materialCreates = order.materialLines
    .filter((l) => !l.isTool)
    .map((line) => ({
      name: line.name,
      quantity: line.quantityRequired,
      unit: line.unit,
      purchasePriceNet: line.article?.purchasePriceNet ?? 0,
      markupPercent: markup,
    }));

  const startAddress = company
    ? [company.street, company.houseNumber, company.postalCode, company.city].filter(Boolean).join(" ")
    : "Betrieb";

  const destinationAddress = `${order.property.street}, ${order.property.zipCode} ${order.property.city}`;

  const calc = await prisma.calculation.create({
    data: {
      tenantId,
      orderId: order.id,
      customerId: order.customerId,
      title: `Kalkulation ${order.orderNumber}`,
      ...(laborCreates.length ? { laborItems: { create: laborCreates } } : {}),
      ...(materialCreates.length ? { materialItems: { create: materialCreates } } : {}),
      ...(additionalCreates.length ? { additionalItems: { create: additionalCreates } } : {}),
      travelCost: {
        create: {
          startAddress: startAddress || "Betrieb",
          destinationAddress,
          distanceKm: 15,
          estimatedDriveTimeHours: 0.5,
          kilometerRateNet: kmRate,
          travelHourlyRateNet: travelRate,
          // Zone des Kundenstandorts vorbelegen (Kunde → Standort → Zone → Anfahrtskosten).
          // recalculateCalculationRecord ermittelt daraus den korrekten Preis/Modus.
          selectedZoneId: order.property.travelZoneId ?? undefined,
          calculationMode: order.property.travelZoneId ? "ZONE_FLAT_FEE" : "FORMULA",
        },
      },
      riskSettings: {
        create: {
          riskLevel: "NORMAL",
          riskPercent: company?.defaultRiskPercent ?? 7,
        },
      },
      profitSettings: {
        create: {
          profitPercent: company?.defaultProfitPercent ?? 12,
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

  await recalculateCalculationRecord(calc.id, tenantId);
  const full = await prisma.calculation.findUnique({ where: { id: calc.id } });
  return { calculation: full!, created: true };
}
