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
  roundMoney,
} from "./formulas";
import type { OverheadMode } from "./types";

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
        breakageRiskPercent: usage.breakageRiskPercent || usage.machine.breakageRiskPercent,
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
    const zones = travelZones.map((z) => ({
      name: z.name,
      minKm: z.minKm,
      maxKm: z.maxKm,
      flatFeeNet: z.flatFeeNet,
      useFormula: z.useFormula,
    }));
    const travel = calcTravelTotal({
      distanceKm: calc.travelCost.distanceKm,
      estimatedDriveTimeHours: calc.travelCost.estimatedDriveTimeHours,
      zones,
      kilometerRateNet: calc.travelCost.kilometerRateNet,
      travelHourlyRateNet: calc.travelCost.travelHourlyRateNet,
      parkingFeesNet: calc.travelCost.parkingFeesNet,
      tollFeesNet: calc.travelCost.tollFeesNet,
      otherTravelCostsNet: calc.travelCost.otherTravelCostsNet,
    });
    const zone = travelZones.find((z) => z.name === travel.zoneName);
    await prisma.travelCost.update({
      where: { id: calc.travelCost.id },
      data: {
        totalNet: travel.total,
        zoneName: travel.zoneName,
        calculationMode: travel.mode,
        selectedZoneId: zone?.id,
        zoneFlatFeeNet: travel.flatFee,
      },
    });
    calc.travelCost.totalNet = travel.total;
  }

  const input = buildCalculationInputFromRecord(
    calc,
    {
      monthlyFixedCostsTotal,
      productiveHoursPerMonth,
      overheadCalculationMode: overheadMode,
      overheadPercent: overheadSettings?.overheadPercent ?? company?.defaultOverheadPercent,
      additionalOverheadPercent: company?.additionalOverheadPercent ?? 0,
    },
    travelZones.map((z) => ({
      name: z.name,
      minKm: z.minKm,
      maxKm: z.maxKm,
      flatFeeNet: z.flatFeeNet,
      useFormula: z.useFormula,
    }))
  );

  const result = runCalculation(input);

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
      overheadAmount: result.overheadAmount,
      incomeTaxOwnerAmount: result.incomeTaxOwnerAmount,
      subtotalBeforeRisk: result.subtotalBeforeRisk,
      riskAmount: result.riskAmount,
      subtotalAfterRisk: result.subtotalAfterRisk,
      profitAmount: result.profitAmount,
      netSalesPrice: result.netSalesPrice,
      vatAmount: result.vatAmount,
      grossSalesPrice: result.grossSalesPrice,
      contributionMargin: result.contributionMargin,
      contributionMarginRate: result.contributionMarginRate,
      marginPercent: result.marginPercent,
      minimumPrice: result.minimumPrice,
      profitAfterTaxEstimate: result.profitAfterTaxEstimate,
      totalBillableHours: result.totalBillableHours,
      profitabilityStatus: result.profitabilityStatus,
      snapshotJson: result as object,
    },
    include: {
      laborItems: true,
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
