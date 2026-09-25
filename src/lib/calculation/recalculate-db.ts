import { prisma } from "@/lib/prisma";
import { buildCalculationInputFromRecord } from "./build-input";
import { runCalculation } from "./engine";
import {
  calcLaborItemTotal,
  calcMachineHourlyRate,
  calcMaterialItemSales,
  calcMachineUsageTotal,
  calcProcurementTotal,
  calcTravelTotal,
} from "./formulas";
import type { OverheadMode } from "./types";
import { applyFixedCustomerTotals } from "./fixed-price";

export async function recalculateCalculationRecord(calculationId: string, tenantId: string) {
  const calc = await prisma.calculation.findFirst({
    where: { id: calculationId, tenantId },
    include: {
      laborItems: true,
      materialItems: true,
      machineUsages: { include: { machine: true } },
      procurementCosts: true,
      travelCost: true,
      additionalItems: true,
      riskSettings: true,
      profitSettings: true,
      incomeTaxSettings: true,
      vatSettings: true,
      order: { include: { property: true } },
    },
  });

  if (!calc) throw new Error("Kalkulation nicht gefunden");

  const [fixedCosts, overheadSettings, travelZones, company] = await Promise.all([
    prisma.monthlyFixedCost.aggregate({
      where: { tenantId, isActive: true },
      _sum: { amountNet: true },
    }),
    prisma.overheadSettings.findUnique({ where: { tenantId } }),
    prisma.travelZone.findMany({ where: { tenantId }, orderBy: { sortOrder: "asc" } }),
    prisma.companySettings.findUnique({ where: { tenantId } }),
  ]);

  const monthlyFixedCostsTotal = fixedCosts._sum.amountNet ?? 0;
  const productiveHoursPerMonth = overheadSettings?.productiveHoursPerMonth ?? 160;
  const overheadMode = (overheadSettings?.overheadCalculationMode ??
    "HYBRID") as OverheadMode;

  for (const item of calc.laborItems) {
    const total = calcLaborItemTotal(item.hours, item.hourlyRateNet, item.quantityWorkers);
    await prisma.laborItem.update({ where: { id: item.id }, data: { totalNet: total } });
    item.totalNet = total;
  }

  for (const item of calc.materialItems) {
    const { purchase, sales } = calcMaterialItemSales(
      item.quantity,
      item.purchasePriceNet,
      item.markupPercent,
      item.wastePercent
    );
    await prisma.materialItem.update({
      where: { id: item.id },
      data: { totalPurchaseNet: purchase, totalSalesNet: sales },
    });
    item.totalPurchaseNet = purchase;
    item.totalSalesNet = sales;
  }

  for (const usage of calc.machineUsages) {
    let rate = usage.hourlyRateNet;
    if (usage.machine) {
      rate = calcMachineHourlyRate({
        costMethod: usage.machine.costMethod as "AMORTIZATION" | "FLAT_RATE",
        flatRatePerHourNet: usage.machine.flatRatePerHourNet,
        purchasePriceNet: usage.machine.purchasePriceNet,
        residualValueNet: usage.machine.residualValueNet,
        expectedLifetimeHours: usage.machine.expectedLifetimeHours,
        expectedRepairCostsNet: usage.machine.expectedRepairCostsNet,
        expectedMaintenanceCostsNet: usage.machine.expectedMaintenanceCostsNet,
        expectedConsumablePartsNet: usage.machine.expectedConsumablePartsNet,
        insuranceCostsNet: usage.machine.insuranceCostsNet,
        energyCostsTotalNet: usage.machine.energyCostsTotalNet,
        breakageRiskPercent:
          usage.breakageRiskPercent != null
            ? usage.breakageRiskPercent
            : usage.machine.breakageRiskPercent,
      });
    }
    const total = calcMachineUsageTotal(usage.usageHours, rate);
    await prisma.machineUsageItem.update({
      where: { id: usage.id },
      data: { hourlyRateNet: rate, totalNet: total },
    });
    usage.hourlyRateNet = rate;
    usage.totalNet = total;
  }

  for (const proc of calc.procurementCosts) {
    const total = calcProcurementTotal({
      purchasingTimeHours: proc.purchasingTimeHours,
      procurementHourlyRateNet: proc.procurementHourlyRateNet,
      pickupDistanceKm: proc.pickupDistanceKm,
      pickupKilometerRateNet: proc.pickupKilometerRateNet,
      supplierFeesNet: proc.supplierFeesNet,
      packagingHandlingNet: proc.packagingHandlingNet,
      otherCostsNet: proc.otherCostsNet,
    });
    await prisma.procurementCost.update({ where: { id: proc.id }, data: { totalNet: total } });
    proc.totalNet = total;
  }

  if (calc.travelCost) {
    const zones = travelZones
      .filter((z) => z.isActive)
      .map((z) => ({
        id: z.id,
        name: z.name,
        minKm: z.minKm,
        maxKm: z.maxKm,
        flatFeeNet: z.flatFeeNet,
        useFormula: z.useFormula,
      }));

    // Datenstruktur: Kunde → Standort (Property) → Zone → Anfahrtskosten.
    // Eine explizit am Standort hinterlegte Zone hat Vorrang vor der Entfernungsauswahl.
    const propertyZoneId = calc.order?.property?.travelZoneId ?? null;
    const effectiveZoneId =
      (calc.travelCost.selectedZoneId &&
      zones.some((z) => z.id === calc.travelCost!.selectedZoneId)
        ? calc.travelCost.selectedZoneId
        : null) ??
      (propertyZoneId && zones.some((z) => z.id === propertyZoneId)
        ? propertyZoneId
        : null);

    if (calc.travelCost.totalIsManual) {
      const manual =
        calc.travelCost.manualTotalNet != null && Number.isFinite(calc.travelCost.manualTotalNet)
          ? Number(calc.travelCost.manualTotalNet)
          : 0;
      await prisma.travelCost.update({
        where: { id: calc.travelCost.id },
        data: {
          totalNet: manual,
          selectedZoneId: effectiveZoneId,
        },
      });
      calc.travelCost.totalNet = manual;
      calc.travelCost.selectedZoneId = effectiveZoneId;
    } else {
      const travel = calcTravelTotal({
        distanceKm: calc.travelCost.distanceKm,
        estimatedDriveTimeHours: calc.travelCost.estimatedDriveTimeHours,
        zones,
        kilometerRateNet: calc.travelCost.kilometerRateNet,
        travelHourlyRateNet: calc.travelCost.travelHourlyRateNet,
        parkingFeesNet: calc.travelCost.parkingFeesNet,
        tollFeesNet: calc.travelCost.tollFeesNet,
        otherTravelCostsNet: calc.travelCost.otherTravelCostsNet,
        selectedZoneId: effectiveZoneId,
      });
      await prisma.travelCost.update({
        where: { id: calc.travelCost.id },
        data: {
          totalNet: travel.total,
          zoneName: travel.zoneName,
          calculationMode: travel.mode,
          selectedZoneId: travel.zoneId ?? null,
          zoneFlatFeeNet: travel.flatFee,
        },
      });
      calc.travelCost.totalNet = travel.total;
      calc.travelCost.selectedZoneId = travel.zoneId ?? null;
    }
  }

  const hasFixedOverhead =
    calc.overheadAmountOverride != null && Number.isFinite(calc.overheadAmountOverride);
  const hasPercentOverhead =
    !hasFixedOverhead &&
    calc.overheadPercentOverride != null &&
    Number.isFinite(calc.overheadPercentOverride);

  const input = buildCalculationInputFromRecord(
    calc,
    {
      monthlyFixedCostsTotal,
      productiveHoursPerMonth,
      overheadCalculationMode: hasPercentOverhead ? "PERCENTAGE" : overheadMode,
      overheadPercent: hasPercentOverhead
        ? Number(calc.overheadPercentOverride)
        : (overheadSettings?.overheadPercent ?? company?.defaultOverheadPercent),
      additionalOverheadPercent: hasPercentOverhead
        ? 0
        : (company?.additionalOverheadPercent ?? 0),
      manualAmount: hasFixedOverhead ? Number(calc.overheadAmountOverride) : null,
    },
    travelZones
      .filter((z) => z.isActive)
      .map((z) => ({
        id: z.id,
        name: z.name,
        minKm: z.minKm,
        maxKm: z.maxKm,
        flatFeeNet: z.flatFeeNet,
        useFormula: z.useFormula,
      }))
  );

  const result = runCalculation(input);

  const fixedActive =
    Boolean(calc.useFixedPrice) &&
    calc.fixedPriceNet != null &&
    Number.isFinite(calc.fixedPriceNet);
  const customer = fixedActive
    ? applyFixedCustomerTotals({
        fixedPriceNet: Number(calc.fixedPriceNet),
        directCosts: result.directCosts,
        engineNetSalesPrice: result.netSalesPrice,
        vatRatePercent: calc.vatSettings?.vatRatePercent ?? 19,
        reverseCharge: Boolean(calc.vatSettings?.reverseCharge),
        taxExempt: Boolean(calc.vatSettings?.taxExempt),
      })
    : null;

  const updated = await prisma.calculation.update({
    where: { id: calculationId },
    data: {
      status: "CALCULATED",
      laborTotal: result.laborTotal,
      materialTotal: result.materialTotal,
      machineTotal: result.machineTotal,
      procurementTotal: result.procurementTotal,
      travelTotal: result.travelTotal,
      additionalTotal: result.additionalTotal,
      directCosts: result.directCosts,
      overheadAmount: customer ? 0 : result.overheadAmount,
      incomeTaxOwnerAmount: customer ? 0 : result.incomeTaxOwnerAmount,
      subtotalBeforeRisk: customer ? result.directCosts : result.subtotalBeforeRisk,
      riskAmount: customer ? 0 : result.riskAmount,
      subtotalAfterRisk: customer ? result.directCosts : result.subtotalAfterRisk,
      profitAmount: customer ? customer.profitAmount : result.profitAmount,
      netSalesPrice: customer ? customer.netSalesPrice : result.netSalesPrice,
      vatAmount: customer ? customer.vatAmount : result.vatAmount,
      grossSalesPrice: customer ? customer.grossSalesPrice : result.grossSalesPrice,
      engineNetSalesPrice: customer ? customer.engineNetSalesPrice : null,
      contributionMargin: customer ? customer.contributionMargin : result.contributionMargin,
      contributionMarginRate: customer
        ? customer.netSalesPrice > 0
          ? Math.round((customer.contributionMargin / customer.netSalesPrice) * 10000) / 100
          : 0
        : result.contributionMarginRate,
      marginPercent: customer
        ? customer.netSalesPrice > 0
          ? Math.round((customer.profitAmount / customer.netSalesPrice) * 10000) / 100
          : 0
        : result.marginPercent,
      minimumPrice: customer ? customer.directCosts : result.minimumPrice,
      profitAfterTaxEstimate: customer ? customer.profitAmount : result.profitAfterTaxEstimate,
      totalBillableHours: result.totalBillableHours,
      profitabilityStatus: result.profitabilityStatus,
      snapshotJson: {
        ...result,
        customerPriceSource: customer ? "FIXED" : "CALCULATED",
        engineNetSalesPrice: result.netSalesPrice,
      } as object,
    },
    include: {
      laborItems: {
        include: {
          employee: {
            include: { user: { select: { id: true, firstName: true, lastName: true } } },
          },
        },
      },
      materialItems: true,
      machineUsages: true,
      procurementCosts: true,
      travelCost: true,
      additionalItems: true,
      riskSettings: true,
      profitSettings: true,
      incomeTaxSettings: true,
      vatSettings: true,
      customer: true,
    },
  });

  return { calculation: updated, breakdown: result };
}

export async function recalculateMachineHourlyRate(machineId: string, tenantId: string) {
  const machine = await prisma.machine.findFirst({ where: { id: machineId, tenantId } });
  if (!machine) throw new Error("Maschine nicht gefunden");

  const rate = calcMachineHourlyRate({
    costMethod: machine.costMethod as "AMORTIZATION" | "FLAT_RATE",
    flatRatePerHourNet: machine.flatRatePerHourNet,
    purchasePriceNet: machine.purchasePriceNet,
    residualValueNet: machine.residualValueNet,
    expectedLifetimeHours: machine.expectedLifetimeHours,
    expectedRepairCostsNet: machine.expectedRepairCostsNet,
    expectedMaintenanceCostsNet: machine.expectedMaintenanceCostsNet,
    expectedConsumablePartsNet: machine.expectedConsumablePartsNet,
    insuranceCostsNet: machine.insuranceCostsNet,
    energyCostsTotalNet: machine.energyCostsTotalNet,
    breakageRiskPercent: machine.breakageRiskPercent,
  });

  return prisma.machine.update({
    where: { id: machineId },
    data: { calculatedHourlyRateNet: rate },
  });
}
