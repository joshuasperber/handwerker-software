import type { CalculationBreakdown, CalculationInput } from "./types";
import {
  calcAdditionalTotal,
  calcIncomeTaxOwnerAmount,
  calcLaborTotal,
  calcMachineUsageTotal,
  calcMaterialTotal,
  calcOverhead,
  calcProcurementTotal,
  calcProfit,
  calcProfitability,
  calcRiskAmount,
  calcTravelTotal,
  calcVAT,
  roundMoney,
} from "./formulas";

export function runCalculation(input: CalculationInput): CalculationBreakdown {
  const laborTotal = calcLaborTotal(input.laborItems);
  const materialTotal = calcMaterialTotal(input.materialItems);
  const machineTotal = roundMoney(
    input.machineUsages.reduce((s, m) => s + calcMachineUsageTotal(m.usageHours, m.hourlyRateNet), 0)
  );

  let procurementTotal = 0;
  if (input.procurement) {
    procurementTotal = calcProcurementTotal({
      purchasingTimeHours: input.procurement.purchasingTimeHours,
      procurementHourlyRateNet: input.procurement.procurementHourlyRateNet,
      pickupDistanceKm: input.procurement.pickupDistanceKm ?? 0,
      pickupKilometerRateNet: input.procurement.pickupKilometerRateNet ?? 0,
      supplierFeesNet: input.procurement.supplierFeesNet ?? 0,
      packagingHandlingNet: input.procurement.packagingHandlingNet ?? 0,
      otherCostsNet: input.procurement.otherCostsNet ?? 0,
    });
  }

  let travelTotal = 0;
  let travelZoneName: string | undefined;
  let travelCalculationMode: "ZONE_FLAT_FEE" | "FORMULA" | undefined;
  let travelZoneId: string | undefined;
  let travelNoZone = false;

  if (input.travel) {
    const travel = calcTravelTotal({
      distanceKm: input.travel.distanceKm,
      estimatedDriveTimeHours: input.travel.estimatedDriveTimeHours ?? 0,
      zones: input.travel.zones,
      kilometerRateNet: input.travel.kilometerRateNet,
      travelHourlyRateNet: input.travel.travelHourlyRateNet,
      parkingFeesNet: input.travel.parkingFeesNet ?? 0,
      tollFeesNet: input.travel.tollFeesNet ?? 0,
      otherTravelCostsNet: input.travel.otherTravelCostsNet ?? 0,
      selectedZoneId: input.travel.selectedZoneId,
    });
    travelTotal = travel.total;
    travelZoneName = travel.zoneName;
    travelCalculationMode = travel.mode;
    travelZoneId = travel.zoneId;
    travelNoZone = travel.noZone;
  }

  const additionalTotal = calcAdditionalTotal(input.additionalItems);

  const directCosts = roundMoney(
    laborTotal +
      materialTotal +
      machineTotal +
      procurementTotal +
      travelTotal +
      additionalTotal
  );

  const totalBillableHours = roundMoney(
    input.laborItems.reduce(
      (s, i) => s + i.hours * (i.quantityWorkers ?? 1),
      0
    )
  );

  const overhead = calcOverhead({
    mode: input.overhead.mode,
    monthlyFixedCostsTotal: input.overhead.monthlyFixedCostsTotal,
    productiveHoursPerMonth: input.overhead.productiveHoursPerMonth,
    totalBillableHours,
    directCosts,
    overheadPercent: input.overhead.overheadPercent,
    additionalOverheadPercent: input.overhead.additionalOverheadPercent,
  });

  let subtotalBeforeRisk = roundMoney(directCosts + overhead.amount);

  const incomeTaxOwnerAmount = calcIncomeTaxOwnerAmount({
    includeInCalculation: input.incomeTax.includeInCalculation,
    allocationMode: input.incomeTax.allocationMode,
    estimatedIncomeTaxPercent: input.incomeTax.estimatedIncomeTaxPercent,
    estimatedPrivateInsurancePercent: input.incomeTax.estimatedPrivateInsurancePercent,
    estimatedOtherPrivateObligationsPercent:
      input.incomeTax.estimatedOtherPrivateObligationsPercent,
    desiredNetOwnerIncomeMonthly: input.incomeTax.desiredNetOwnerIncomeMonthly,
    productiveHoursPerMonth: input.incomeTax.productiveHoursPerMonth,
    totalBillableHours,
    manualOwnerAmountPerOrder: input.incomeTax.manualOwnerAmountPerOrder,
  });

  subtotalBeforeRisk = roundMoney(subtotalBeforeRisk + incomeTaxOwnerAmount);

  const riskAmount = calcRiskAmount(subtotalBeforeRisk, input.risk.riskPercent);
  const subtotalAfterRisk = roundMoney(subtotalBeforeRisk + riskAmount);

  const { profitAmount, netSalesPrice } = calcProfit({
    strategy: input.profit.strategy,
    subtotalAfterRisk,
    profitPercent: input.profit.profitPercent,
    targetProfitAmountNet: input.profit.targetProfitAmountNet,
    targetMarginPercent: input.profit.targetMarginPercent,
  });

  const { vatAmount, grossSalesPrice } = calcVAT(
    netSalesPrice,
    input.vat.vatRatePercent
  );

  const contributionMargin = roundMoney(netSalesPrice - directCosts);
  const contributionMarginRate =
    netSalesPrice > 0 ? roundMoney((contributionMargin / netSalesPrice) * 100) : 0;
  const marginPercent =
    netSalesPrice > 0 ? roundMoney((profitAmount / netSalesPrice) * 100) : 0;

  const minimumPrice = roundMoney(directCosts + overhead.amount + riskAmount);

  const totalPrivatePercent =
    input.incomeTax.estimatedIncomeTaxPercent +
    input.incomeTax.estimatedPrivateInsurancePercent +
    input.incomeTax.estimatedOtherPrivateObligationsPercent;

  const profitAfterTaxEstimate =
    totalPrivatePercent < 100
      ? roundMoney(profitAmount * (1 - totalPrivatePercent / 100))
      : profitAmount;

  const profitabilityStatus = calcProfitability(
    marginPercent,
    netSalesPrice,
    directCosts
  );

  return {
    laborTotal,
    materialTotal,
    machineTotal,
    procurementTotal,
    travelTotal,
    additionalTotal,
    directCosts,
    overheadAmount: overhead.amount,
    overheadHourlyRate: overhead.hourlyRate,
    incomeTaxOwnerAmount,
    subtotalBeforeRisk,
    riskAmount,
    subtotalAfterRisk,
    profitAmount,
    netSalesPrice,
    vatAmount,
    grossSalesPrice,
    contributionMargin,
    contributionMarginRate,
    marginPercent,
    minimumPrice,
    profitAfterTaxEstimate,
    totalBillableHours,
    profitabilityStatus,
    travelZoneName,
    travelCalculationMode,
    travelZoneId,
    travelNoZone,
  };
}
