export type OverheadMode = "PERCENTAGE" | "HOURLY_ALLOCATION" | "HYBRID";
export type ProfitStrategy = "PERCENT" | "FIXED_AMOUNT" | "TARGET_MARGIN";
export type IncomeTaxMode = "PER_HOUR" | "PER_ORDER" | "PROFIT_CHECK_ONLY";
export type TravelMode = "ZONE_FLAT_FEE" | "FORMULA";
export type ProfitabilityStatus = "profitable" | "tight" | "loss" | "unknown";

export interface TravelZoneInput {
  name: string;
  minKm: number;
  maxKm: number | null;
  flatFeeNet: number;
  useFormula: boolean;
}

export interface LaborItemInput {
  hours: number;
  hourlyRateNet: number;
  quantityWorkers?: number;
}

export interface MaterialItemInput {
  quantity: number;
  purchasePriceNet: number;
  markupPercent: number;
  wastePercent?: number;
}

export interface MachineUsageInput {
  usageHours: number;
  hourlyRateNet: number;
  breakageRiskPercent?: number;
}

export interface MachineDefinitionInput {
  purchasePriceNet: number;
  residualValueNet: number;
  expectedLifetimeHours: number;
  expectedRepairCostsNet: number;
  expectedMaintenanceCostsNet: number;
  expectedConsumablePartsNet: number;
  insuranceCostsNet: number;
  energyCostsTotalNet: number;
  breakageRiskPercent: number;
}

export interface ProcurementInput {
  purchasingTimeHours: number;
  procurementHourlyRateNet: number;
  pickupDistanceKm?: number;
  pickupKilometerRateNet?: number;
  supplierFeesNet?: number;
  packagingHandlingNet?: number;
  otherCostsNet?: number;
}

export interface TravelInput {
  distanceKm: number;
  estimatedDriveTimeHours?: number;
  zones: TravelZoneInput[];
  kilometerRateNet: number;
  travelHourlyRateNet: number;
  parkingFeesNet?: number;
  tollFeesNet?: number;
  otherTravelCostsNet?: number;
}

export interface AdditionalCostInput {
  amountNet: number;
  markupPercent?: number;
}

export interface OverheadInput {
  mode: OverheadMode;
  monthlyFixedCostsTotal: number;
  productiveHoursPerMonth: number;
  totalBillableHours: number;
  directCosts: number;
  overheadPercent?: number;
  additionalOverheadPercent?: number;
}

export interface RiskInput {
  riskPercent: number;
}

export interface ProfitInput {
  strategy: ProfitStrategy;
  profitPercent?: number;
  targetProfitAmountNet?: number;
  targetMarginPercent?: number;
}

export interface IncomeTaxInput {
  includeInCalculation: boolean;
  allocationMode: IncomeTaxMode;
  estimatedIncomeTaxPercent: number;
  estimatedPrivateInsurancePercent: number;
  estimatedOtherPrivateObligationsPercent: number;
  desiredNetOwnerIncomeMonthly: number;
  productiveHoursPerMonth: number;
  totalBillableHours: number;
  manualOwnerAmountPerOrder?: number;
}

export interface VATInput {
  vatRatePercent: number;
}

export interface CalculationInput {
  laborItems: LaborItemInput[];
  materialItems: MaterialItemInput[];
  machineUsages: MachineUsageInput[];
  procurement?: ProcurementInput | null;
  travel?: TravelInput | null;
  additionalItems: AdditionalCostInput[];
  overhead: OverheadInput;
  risk: RiskInput;
  profit: ProfitInput;
  incomeTax: IncomeTaxInput;
  vat: VATInput;
}

export interface CalculationBreakdown {
  laborTotal: number;
  materialTotal: number;
  machineTotal: number;
  procurementTotal: number;
  travelTotal: number;
  additionalTotal: number;
  directCosts: number;
  overheadAmount: number;
  overheadHourlyRate: number;
  incomeTaxOwnerAmount: number;
  subtotalBeforeRisk: number;
  riskAmount: number;
  subtotalAfterRisk: number;
  profitAmount: number;
  netSalesPrice: number;
  vatAmount: number;
  grossSalesPrice: number;
  contributionMargin: number;
  contributionMarginRate: number;
  marginPercent: number;
  minimumPrice: number;
  profitAfterTaxEstimate: number;
  totalBillableHours: number;
  profitabilityStatus: ProfitabilityStatus;
  travelZoneName?: string;
  travelCalculationMode?: TravelMode;
  machineHourlyRates?: number[];
}
