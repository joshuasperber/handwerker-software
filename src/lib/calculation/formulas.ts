/** Zentrale Kalkulationsformeln – einzige Quelle der Wahrheit */

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calcLaborItemTotal(
  hours: number,
  hourlyRateNet: number,
  quantityWorkers = 1
): number {
  return roundMoney(hours * hourlyRateNet * quantityWorkers);
}

export function calcLaborTotal(
  items: { hours: number; hourlyRateNet: number; quantityWorkers?: number }[]
): number {
  return roundMoney(
    items.reduce(
      (sum, i) =>
        sum + calcLaborItemTotal(i.hours, i.hourlyRateNet, i.quantityWorkers ?? 1),
      0
    )
  );
}

export function calcMaterialItemSales(
  quantity: number,
  purchasePriceNet: number,
  markupPercent: number,
  wastePercent = 0
): { purchase: number; sales: number } {
  const purchase = roundMoney(quantity * purchasePriceNet);
  const withWaste = roundMoney(purchase * (1 + wastePercent / 100));
  const sales = roundMoney(withWaste * (1 + markupPercent / 100));
  return { purchase, sales };
}

export function calcMaterialTotal(
  items: {
    quantity: number;
    purchasePriceNet: number;
    markupPercent: number;
    wastePercent?: number;
  }[]
): number {
  return roundMoney(
    items.reduce(
      (sum, i) =>
        sum +
        calcMaterialItemSales(
          i.quantity,
          i.purchasePriceNet,
          i.markupPercent,
          i.wastePercent ?? 0
        ).sales,
      0
    )
  );
}

/** Maschinenstundensatz – Amortisation (detailliert) oder Pauschale (einfach) */
export function calcMachineHourlyRate(params: {
  costMethod?: "AMORTIZATION" | "FLAT_RATE";
  flatRatePerHourNet?: number | null;
  purchasePriceNet: number;
  residualValueNet: number;
  expectedRepairCostsNet: number;
  expectedMaintenanceCostsNet: number;
  expectedConsumablePartsNet: number;
  insuranceCostsNet: number;
  energyCostsTotalNet: number;
  expectedLifetimeHours: number;
  breakageRiskPercent: number;
}): number {
  if (params.costMethod === "FLAT_RATE") {
    const rate = params.flatRatePerHourNet ?? 0;
    if (rate <= 0) {
      throw new Error("Pauschale pro Stunde muss größer als 0 sein.");
    }
    return roundMoney(rate);
  }

  const {
    purchasePriceNet,
    residualValueNet,
    expectedRepairCostsNet,
    expectedMaintenanceCostsNet,
    expectedConsumablePartsNet,
    insuranceCostsNet,
    energyCostsTotalNet,
    expectedLifetimeHours,
    breakageRiskPercent,
  } = params;

  if (expectedLifetimeHours <= 0) {
    throw new Error("Erwartete Nutzungsstunden müssen größer als 0 sein.");
  }

  const depreciable =
    purchasePriceNet -
    residualValueNet +
    expectedRepairCostsNet +
    expectedMaintenanceCostsNet +
    expectedConsumablePartsNet +
    insuranceCostsNet +
    energyCostsTotalNet;

  const baseRate = depreciable / expectedLifetimeHours;
  return roundMoney(baseRate * (1 + breakageRiskPercent / 100));
}

/** Amortisation & Ersatzrücklage – prüft ob Maschine sich vor Lebensende selbst finanziert */
export function calcMachinePaybackAnalysis(params: {
  costMethod?: "AMORTIZATION" | "FLAT_RATE";
  flatRatePerHourNet?: number | null;
  purchasePriceNet: number;
  residualValueNet: number;
  expectedRepairCostsNet: number;
  expectedMaintenanceCostsNet: number;
  expectedConsumablePartsNet: number;
  insuranceCostsNet: number;
  energyCostsTotalNet: number;
  expectedLifetimeHours: number;
  breakageRiskPercent: number;
  expectedHoursPerYear?: number;
}): {
  hourlyRateNet: number;
  totalLifecycleCost: number;
  totalRecoveryOverLifetime: number;
  paybackHours: number;
  paybackYears: number;
  expectedLifetimeYears: number;
  replacementReserveAtEnd: number;
  canFundReplacement: boolean;
  paysBackBeforeEndOfLife: boolean;
  annualRecovery: number;
  isFlatRate: boolean;
} {
  const isFlatRate = params.costMethod === "FLAT_RATE";
  const hourlyRateNet = calcMachineHourlyRate(params);
  const hoursPerYear =
    params.expectedHoursPerYear ??
    (params.expectedLifetimeHours > 0 ? params.expectedLifetimeHours / 3 : 400);

  if (isFlatRate) {
    return {
      hourlyRateNet,
      totalLifecycleCost: 0,
      totalRecoveryOverLifetime: roundMoney(hourlyRateNet * params.expectedLifetimeHours),
      paybackHours: 0,
      paybackYears: 0,
      expectedLifetimeYears: hoursPerYear > 0 ? roundMoney(params.expectedLifetimeHours / hoursPerYear) : 0,
      replacementReserveAtEnd: 0,
      canFundReplacement: true,
      paysBackBeforeEndOfLife: true,
      annualRecovery: roundMoney(hourlyRateNet * hoursPerYear),
      isFlatRate: true,
    };
  }

  const totalLifecycleCost =
    params.purchasePriceNet -
    params.residualValueNet +
    params.expectedRepairCostsNet +
    params.expectedMaintenanceCostsNet +
    params.expectedConsumablePartsNet +
    params.insuranceCostsNet +
    params.energyCostsTotalNet;

  const totalRecoveryOverLifetime = roundMoney(hourlyRateNet * params.expectedLifetimeHours);
  const paybackHours = hourlyRateNet > 0 ? roundMoney(totalLifecycleCost / hourlyRateNet) : 0;
  const paybackYears = hoursPerYear > 0 ? roundMoney(paybackHours / hoursPerYear) : 0;
  const expectedLifetimeYears =
    hoursPerYear > 0 ? roundMoney(params.expectedLifetimeHours / hoursPerYear) : 0;
  const replacementReserveAtEnd = roundMoney(totalRecoveryOverLifetime - totalLifecycleCost);

  return {
    hourlyRateNet,
    totalLifecycleCost: roundMoney(totalLifecycleCost),
    totalRecoveryOverLifetime,
    paybackHours,
    paybackYears,
    expectedLifetimeYears,
    replacementReserveAtEnd,
    canFundReplacement: totalRecoveryOverLifetime >= params.purchasePriceNet,
    paysBackBeforeEndOfLife: paybackYears < expectedLifetimeYears,
    annualRecovery: roundMoney(hourlyRateNet * hoursPerYear),
    isFlatRate: false,
  };
}

export function calcMachineUsageTotal(
  usageHours: number,
  hourlyRateWithRisk: number
): number {
  return roundMoney(usageHours * hourlyRateWithRisk);
}

export function calcProcurementTotal(params: {
  purchasingTimeHours: number;
  procurementHourlyRateNet: number;
  pickupDistanceKm: number;
  pickupKilometerRateNet: number;
  supplierFeesNet: number;
  packagingHandlingNet: number;
  otherCostsNet: number;
}): number {
  const timeCost = params.purchasingTimeHours * params.procurementHourlyRateNet;
  const pickupCost = params.pickupDistanceKm * params.pickupKilometerRateNet;
  return roundMoney(
    timeCost +
      pickupCost +
      params.supplierFeesNet +
      params.packagingHandlingNet +
      params.otherCostsNet
  );
}

export interface TravelZoneLike {
  id?: string;
  minKm: number;
  maxKm: number | null;
  name: string;
  flatFeeNet: number;
  useFormula: boolean;
}

export function selectTravelZone(
  distanceKm: number,
  zones: TravelZoneLike[]
): TravelZoneLike | null {
  const sorted = [...zones].sort((a, b) => a.minKm - b.minKm);
  for (const zone of sorted) {
    if (distanceKm >= zone.minKm) {
      if (zone.maxKm === null || distanceKm <= zone.maxKm) {
        return zone;
      }
    }
  }
  return sorted[sorted.length - 1] ?? null;
}

export type TravelTotalResult = {
  total: number;
  zoneName: string;
  zoneId?: string;
  mode: "ZONE_FLAT_FEE" | "FORMULA";
  flatFee: number;
  /** true, wenn keine Zone bestimmt werden konnte (Kosten 0, Hinweis erforderlich) */
  noZone: boolean;
};

/** Berechnet die Kosten einer konkreten (zugeordneten) Zone. */
export function calcTravelTotalForZone(
  zone: TravelZoneLike,
  params: {
    distanceKm: number;
    estimatedDriveTimeHours: number;
    kilometerRateNet: number;
    travelHourlyRateNet: number;
    parkingFeesNet: number;
    tollFeesNet: number;
    otherTravelCostsNet: number;
  }
): TravelTotalResult {
  if (zone.useFormula) {
    const total = roundMoney(
      params.distanceKm * params.kilometerRateNet +
        params.estimatedDriveTimeHours * params.travelHourlyRateNet +
        params.parkingFeesNet +
        params.tollFeesNet +
        params.otherTravelCostsNet
    );
    return { total, zoneName: zone.name, zoneId: zone.id, mode: "FORMULA", flatFee: 0, noZone: false };
  }

  return {
    total: roundMoney(zone.flatFeeNet),
    zoneName: zone.name,
    zoneId: zone.id,
    mode: "ZONE_FLAT_FEE",
    flatFee: zone.flatFeeNet,
    noZone: false,
  };
}

export function calcTravelTotal(params: {
  distanceKm: number;
  estimatedDriveTimeHours: number;
  zones: TravelZoneLike[];
  kilometerRateNet: number;
  travelHourlyRateNet: number;
  parkingFeesNet: number;
  tollFeesNet: number;
  otherTravelCostsNet: number;
  /** Wenn gesetzt, wird diese Zone fest verwendet (Standort-Zuordnung) statt Auswahl nach Entfernung. */
  selectedZoneId?: string | null;
}): TravelTotalResult {
  // 1) Fest zugeordnete Zone (Kunde → Standort → Zone) hat Vorrang.
  const forced =
    params.selectedZoneId != null
      ? params.zones.find((z) => z.id === params.selectedZoneId)
      : undefined;

  // 2) Sonst Auswahl nach Entfernung (Rückwärtskompatibilität).
  const zone = forced ?? selectTravelZone(params.distanceKm, params.zones);

  if (!zone) {
    return { total: 0, zoneName: "Keine Zone", mode: "ZONE_FLAT_FEE", flatFee: 0, noZone: true };
  }

  return calcTravelTotalForZone(zone, params);
}

export function calcAdditionalTotal(
  items: { amountNet: number; markupPercent?: number }[]
): number {
  return roundMoney(
    items.reduce(
      (sum, i) =>
        sum + roundMoney(i.amountNet * (1 + (i.markupPercent ?? 0) / 100)),
      0
    )
  );
}

export function calcOverhead(params: {
  mode: "PERCENTAGE" | "HOURLY_ALLOCATION" | "HYBRID";
  monthlyFixedCostsTotal: number;
  productiveHoursPerMonth: number;
  totalBillableHours: number;
  directCosts: number;
  overheadPercent?: number;
  additionalOverheadPercent?: number;
}): { amount: number; hourlyRate: number } {
  const hourlyRate =
    params.productiveHoursPerMonth > 0
      ? params.monthlyFixedCostsTotal / params.productiveHoursPerMonth
      : 0;

  let amount = 0;

  if (params.mode === "PERCENTAGE") {
    amount = params.directCosts * ((params.overheadPercent ?? 0) / 100);
  } else if (params.mode === "HOURLY_ALLOCATION") {
    amount = params.totalBillableHours * hourlyRate;
  } else {
    amount =
      params.totalBillableHours * hourlyRate +
      params.directCosts * ((params.additionalOverheadPercent ?? 0) / 100);
  }

  return { amount: roundMoney(amount), hourlyRate: roundMoney(hourlyRate) };
}

export function calcIncomeTaxOwnerAmount(params: {
  includeInCalculation: boolean;
  allocationMode: "PER_HOUR" | "PER_ORDER" | "PROFIT_CHECK_ONLY";
  estimatedIncomeTaxPercent: number;
  estimatedPrivateInsurancePercent: number;
  estimatedOtherPrivateObligationsPercent: number;
  desiredNetOwnerIncomeMonthly: number;
  productiveHoursPerMonth: number;
  totalBillableHours: number;
  manualOwnerAmountPerOrder?: number;
}): number {
  if (!params.includeInCalculation || params.allocationMode === "PROFIT_CHECK_ONLY") {
    return 0;
  }

  if (params.allocationMode === "PER_ORDER" && params.manualOwnerAmountPerOrder != null) {
    return roundMoney(params.manualOwnerAmountPerOrder);
  }

  const totalPercent =
    params.estimatedIncomeTaxPercent +
    params.estimatedPrivateInsurancePercent +
    params.estimatedOtherPrivateObligationsPercent;

  if (totalPercent >= 100) {
    throw new Error(
      "Summe aus Einkommensteuer und privaten Abgabenquote darf nicht 100 % oder mehr betragen."
    );
  }

  const requiredBeforeTax =
    params.desiredNetOwnerIncomeMonthly / (1 - totalPercent / 100);

  const perHour =
    params.productiveHoursPerMonth > 0
      ? requiredBeforeTax / params.productiveHoursPerMonth
      : 0;

  return roundMoney(params.totalBillableHours * perHour);
}

export function calcRiskAmount(subtotalBeforeRisk: number, riskPercent: number): number {
  return roundMoney(subtotalBeforeRisk * (riskPercent / 100));
}

export function calcProfit(params: {
  strategy: "PERCENT" | "FIXED_AMOUNT" | "TARGET_MARGIN";
  subtotalAfterRisk: number;
  profitPercent?: number;
  targetProfitAmountNet?: number;
  targetMarginPercent?: number;
}): { profitAmount: number; netSalesPrice: number } {
  const { subtotalAfterRisk, strategy } = params;

  if (strategy === "FIXED_AMOUNT") {
    const profitAmount = roundMoney(params.targetProfitAmountNet ?? 0);
    return {
      profitAmount,
      netSalesPrice: roundMoney(subtotalAfterRisk + profitAmount),
    };
  }

  if (strategy === "TARGET_MARGIN") {
    const margin = params.targetMarginPercent ?? 0;
    if (margin >= 100) {
      throw new Error("Zielmarge darf nicht 100 % oder größer sein.");
    }
    const netSalesPrice = roundMoney(subtotalAfterRisk / (1 - margin / 100));
    return {
      profitAmount: roundMoney(netSalesPrice - subtotalAfterRisk),
      netSalesPrice,
    };
  }

  const profitAmount = roundMoney(subtotalAfterRisk * ((params.profitPercent ?? 0) / 100));
  return {
    profitAmount,
    netSalesPrice: roundMoney(subtotalAfterRisk + profitAmount),
  };
}

export function calcVAT(netSalesPrice: number, vatRatePercent: number): {
  vatAmount: number;
  grossSalesPrice: number;
} {
  const vatAmount = roundMoney(netSalesPrice * (vatRatePercent / 100));
  return { vatAmount, grossSalesPrice: roundMoney(netSalesPrice + vatAmount) };
}

export function calcProfitability(marginPercent: number, netSalesPrice: number, directCosts: number): "profitable" | "tight" | "loss" {
  if (netSalesPrice < directCosts || marginPercent < 3) return "loss";
  if (marginPercent < 10) return "tight";
  return "profitable";
}

export const RISK_PERCENT_BY_LEVEL: Record<string, number> = {
  LOW: 3,
  NORMAL: 7,
  HIGH: 12,
  VERY_HIGH: 20,
};
