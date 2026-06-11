import type { Prisma } from "@/generated/prisma/client";
import type { CalculationInput, OverheadMode } from "./types";

type CalcWithRelations = Prisma.CalculationGetPayload<{
  include: {
    laborItems: true;
    materialItems: true;
    machineUsages: true;
    procurementCosts: true;
    travelCost: true;
    additionalItems: true;
    riskSettings: true;
    profitSettings: true;
    incomeTaxSettings: true;
    vatSettings: true;
  };
}>;

export function buildCalculationInputFromRecord(
  calc: CalcWithRelations,
  overheadContext: {
    monthlyFixedCostsTotal: number;
    productiveHoursPerMonth: number;
    overheadCalculationMode: OverheadMode;
    overheadPercent?: number | null;
    additionalOverheadPercent?: number;
  },
  travelZones: {
    id?: string;
    name: string;
    minKm: number;
    maxKm: number | null;
    flatFeeNet: number;
    useFormula: boolean;
  }[]
): CalculationInput {
  const procurement = calc.procurementCosts[0];

  return {
    laborItems: calc.laborItems.map((l) => ({
      hours: l.hours,
      hourlyRateNet: l.hourlyRateNet,
      quantityWorkers: l.quantityWorkers,
    })),
    materialItems: calc.materialItems.map((m) => ({
      quantity: m.quantity,
      purchasePriceNet: m.purchasePriceNet,
      markupPercent: m.markupPercent,
      wastePercent: m.wastePercent,
    })),
    machineUsages: calc.machineUsages.map((m) => ({
      usageHours: m.usageHours,
      hourlyRateNet: m.hourlyRateNet,
      breakageRiskPercent: m.breakageRiskPercent,
    })),
    procurement: procurement
      ? {
          purchasingTimeHours: procurement.purchasingTimeHours,
          procurementHourlyRateNet: procurement.procurementHourlyRateNet,
          pickupDistanceKm: procurement.pickupDistanceKm,
          pickupKilometerRateNet: procurement.pickupKilometerRateNet,
          supplierFeesNet: procurement.supplierFeesNet,
          packagingHandlingNet: procurement.packagingHandlingNet,
          otherCostsNet: procurement.otherCostsNet,
        }
      : null,
    travel: calc.travelCost
      ? {
          distanceKm: calc.travelCost.distanceKm,
          estimatedDriveTimeHours: calc.travelCost.estimatedDriveTimeHours,
          zones: travelZones,
          kilometerRateNet: calc.travelCost.kilometerRateNet,
          travelHourlyRateNet: calc.travelCost.travelHourlyRateNet,
          parkingFeesNet: calc.travelCost.parkingFeesNet,
          tollFeesNet: calc.travelCost.tollFeesNet,
          otherTravelCostsNet: calc.travelCost.otherTravelCostsNet,
          selectedZoneId: calc.travelCost.selectedZoneId,
        }
      : null,
    additionalItems: calc.additionalItems.map((a) => ({
      amountNet: a.amountNet,
      markupPercent: a.markupPercent,
    })),
    overhead: {
      mode: overheadContext.overheadCalculationMode,
      monthlyFixedCostsTotal: overheadContext.monthlyFixedCostsTotal,
      productiveHoursPerMonth: overheadContext.productiveHoursPerMonth,
      totalBillableHours: 0,
      directCosts: 0,
      overheadPercent: overheadContext.overheadPercent ?? undefined,
      additionalOverheadPercent: overheadContext.additionalOverheadPercent ?? 0,
    },
    risk: {
      riskPercent: calc.riskSettings?.riskPercent ?? 7,
    },
    profit: {
      strategy: (calc.profitSettings?.profitStrategy ?? "PERCENT") as CalculationInput["profit"]["strategy"],
      profitPercent: calc.profitSettings?.profitPercent ?? 12,
      targetProfitAmountNet: calc.profitSettings?.targetProfitAmountNet ?? undefined,
      targetMarginPercent: calc.profitSettings?.targetMarginPercent ?? undefined,
    },
    incomeTax: {
      includeInCalculation: calc.incomeTaxSettings?.includeIncomeTaxCalculation ?? false,
      allocationMode: (calc.incomeTaxSettings?.allocationMode ??
        "PROFIT_CHECK_ONLY") as CalculationInput["incomeTax"]["allocationMode"],
      estimatedIncomeTaxPercent: calc.incomeTaxSettings?.estimatedIncomeTaxPercent ?? 30,
      estimatedPrivateInsurancePercent:
        calc.incomeTaxSettings?.estimatedPrivateInsurancePercent ?? 5,
      estimatedOtherPrivateObligationsPercent:
        calc.incomeTaxSettings?.estimatedOtherPrivateObligationsPercent ?? 3,
      desiredNetOwnerIncomeMonthly:
        calc.incomeTaxSettings?.desiredNetOwnerIncomeMonthly ?? 4000,
      productiveHoursPerMonth:
        calc.incomeTaxSettings?.productiveHoursPerMonth ??
        overheadContext.productiveHoursPerMonth,
      totalBillableHours: 0,
      manualOwnerAmountPerOrder:
        calc.incomeTaxSettings?.manualOwnerAmountPerOrder ?? undefined,
    },
    vat: {
      vatRatePercent: calc.vatSettings?.vatRatePercent ?? 19,
    },
  };
}
