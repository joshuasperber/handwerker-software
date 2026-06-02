import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calcMachineHourlyRate,
  calcTravelTotal,
  roundMoney,
  selectTravelZone,
} from "../src/lib/calculation/formulas";
import { runCalculation } from "../src/lib/calculation/engine";
import type { CalculationInput } from "../src/lib/calculation/types";

const DEFAULT_ZONES = [
  { name: "Zone 1", minKm: 0, maxKm: 10, flatFeeNet: 35, useFormula: false },
  { name: "Zone 2", minKm: 10.01, maxKm: 25, flatFeeNet: 59, useFormula: false },
  { name: "Zone 3", minKm: 25.01, maxKm: 50, flatFeeNet: 89, useFormula: false },
  { name: "Zone 4", minKm: 50.01, maxKm: null, flatFeeNet: 0, useFormula: true },
];

describe("Maschinenstundensatz", () => {
  it("berechnet Stundensatz mit Bruchrisiko", () => {
    const rate = calcMachineHourlyRate({
      purchasePriceNet: 2500,
      residualValueNet: 300,
      expectedLifetimeHours: 800,
      expectedRepairCostsNet: 700,
      expectedMaintenanceCostsNet: 0,
      expectedConsumablePartsNet: 500,
      insuranceCostsNet: 0,
      energyCostsTotalNet: 0,
      breakageRiskPercent: 15,
    });
    assert.equal(rate, 4.89);
  });
});

describe("Fahrtzonen", () => {
  it("wählt Zone 3 bei 46 km", () => {
    const zone = selectTravelZone(46, DEFAULT_ZONES);
    assert.equal(zone?.name, "Zone 3");
    assert.equal(zone?.useFormula, false);
  });

  it("verwendet Pauschale 89 € für Zone 3", () => {
    const result = calcTravelTotal({
      distanceKm: 46,
      estimatedDriveTimeHours: 1,
      zones: DEFAULT_ZONES,
      kilometerRateNet: 0.45,
      travelHourlyRateNet: 45,
      parkingFeesNet: 0,
      tollFeesNet: 0,
      otherTravelCostsNet: 0,
    });
    assert.equal(result.zoneName, "Zone 3");
    assert.equal(result.mode, "ZONE_FLAT_FEE");
    assert.equal(result.total, 89);
  });

  it("wählt Zone 4 und Formel bei 72 km", () => {
    const result = calcTravelTotal({
      distanceKm: 72,
      estimatedDriveTimeHours: 1.2,
      zones: DEFAULT_ZONES,
      kilometerRateNet: 0.45,
      travelHourlyRateNet: 45,
      parkingFeesNet: 0,
      tollFeesNet: 0,
      otherTravelCostsNet: 0,
    });
    assert.equal(result.zoneName, "Zone 4");
    assert.equal(result.mode, "FORMULA");
    assert.equal(result.total, roundMoney(72 * 0.45 + 1.2 * 45));
  });
});

describe("Beispielrechnung aus Spezifikation", () => {
  const machineRate = calcMachineHourlyRate({
    purchasePriceNet: 2500,
    residualValueNet: 300,
    expectedLifetimeHours: 800,
    expectedRepairCostsNet: 700,
    expectedMaintenanceCostsNet: 0,
    expectedConsumablePartsNet: 500,
    insuranceCostsNet: 0,
    energyCostsTotalNet: 0,
    breakageRiskPercent: 15,
  });

  const input: CalculationInput = {
    laborItems: [{ hours: 5, hourlyRateNet: 68, quantityWorkers: 1 }],
    materialItems: [
      { quantity: 1, purchasePriceNet: 180, markupPercent: 25, wastePercent: 0 },
    ],
    machineUsages: [{ usageHours: 5, hourlyRateNet: machineRate }],
    procurement: {
      purchasingTimeHours: 0.25,
      procurementHourlyRateNet: 55,
      pickupDistanceKm: 0,
      pickupKilometerRateNet: 0,
      supplierFeesNet: 0,
      packagingHandlingNet: 0,
      otherCostsNet: 0,
    },
    travel: {
      distanceKm: 46,
      estimatedDriveTimeHours: 0,
      zones: DEFAULT_ZONES,
      kilometerRateNet: 0.45,
      travelHourlyRateNet: 45,
    },
    additionalItems: [],
    overhead: {
      mode: "HOURLY_ALLOCATION",
      monthlyFixedCostsTotal: 4000,
      productiveHoursPerMonth: 160,
      totalBillableHours: 0,
      directCosts: 0,
    },
    risk: { riskPercent: 7 },
    profit: { strategy: "PERCENT", profitPercent: 12 },
    incomeTax: {
      includeInCalculation: false,
      allocationMode: "PROFIT_CHECK_ONLY",
      estimatedIncomeTaxPercent: 30,
      estimatedPrivateInsurancePercent: 5,
      estimatedOtherPrivateObligationsPercent: 3,
      desiredNetOwnerIncomeMonthly: 4000,
      productiveHoursPerMonth: 160,
      totalBillableHours: 0,
    },
    vat: { vatRatePercent: 19 },
  };

  const result = runCalculation(input);

  it("Arbeitskosten = 340 €", () => {
    assert.equal(result.laborTotal, 340);
  });

  it("Material = 225 €", () => {
    assert.equal(result.materialTotal, 225);
  });

  it("Fahrt Zone 3 = 89 €", () => {
    assert.equal(result.travelTotal, 89);
    assert.equal(result.travelZoneName, "Zone 3");
  });

  it("Gemeinkosten = 125 €", () => {
    assert.equal(result.overheadAmount, 125);
    assert.equal(result.overheadHourlyRate, 25);
  });

  it("Netto und Brutto plausibel", () => {
    assert.ok(result.netSalesPrice > result.directCosts);
    assert.ok(result.grossSalesPrice > result.netSalesPrice);
    assert.equal(result.riskAmount, Math.round(result.subtotalBeforeRisk * 0.07 * 100) / 100);
  });

  it("Marge mindestens 10 % bei diesem Beispiel", () => {
    assert.ok(result.marginPercent >= 10);
    assert.equal(result.profitabilityStatus, "profitable");
  });
});
