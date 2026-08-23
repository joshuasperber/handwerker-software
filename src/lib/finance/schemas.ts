import { z } from "zod";

const money = z.coerce.number().min(0, "Betrag darf nicht negativ sein");

/** Leere Strings / __none__ → null (Select „Kein Auftrag“). */
function normalizeOptionalId(v: unknown): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t && t !== "__none__" ? t : null;
}

const optionalIdField = z.preprocess(normalizeOptionalId, z.string().nullable());

export const expenseInputSchema = z.object({
  category: z.enum([
    "MATERIAL",
    "MACHINERY",
    "TOOLS",
    "FUEL",
    "VEHICLES",
    "RENT",
    "SUBCONTRACTOR",
    "INSURANCE",
    "SOFTWARE",
    "TELECOM",
    "OTHER",
  ]),
  description: z.string().min(1, "Beschreibung erforderlich").max(500),
  netAmount: money,
  vatAmount: money.default(0),
  grossAmount: money,
  expenseDate: z.string().min(1, "Datum erforderlich"),
  paymentStatus: z.enum(["OFFEN", "BEZAHLT"]).default("BEZAHLT"),
  supplier: z.string().max(200).optional().nullable(),
  orderId: optionalIdField.optional(),
  customerId: optionalIdField.optional(),
  projectId: optionalIdField.optional(),
  internalNote: z.string().max(2000).optional().nullable(),
  isInvestment: z.coerce.boolean().default(false),
});

/** PATCH: nur gesetzte Felder, ohne Default-Injection auf fehlende Keys. */
export const expensePatchSchema = z.object({
  category: expenseInputSchema.shape.category.optional(),
  description: expenseInputSchema.shape.description.optional(),
  netAmount: money.optional(),
  vatAmount: money.optional(),
  grossAmount: money.optional(),
  expenseDate: z.string().min(1).optional(),
  paymentStatus: z.enum(["OFFEN", "BEZAHLT"]).optional(),
  supplier: z.string().max(200).optional().nullable(),
  orderId: optionalIdField.optional(),
  customerId: optionalIdField.optional(),
  projectId: optionalIdField.optional(),
  internalNote: z.string().max(2000).optional().nullable(),
  isInvestment: z.coerce.boolean().optional(),
});

export const investmentInputSchema = z.object({
  title: z.string().min(1).max(200),
  plannedAmount: z.coerce.number().min(0),
  plannedDate: z.string().optional().nullable(),
  category: z.enum(["MACHINE", "TOOL", "VEHICLE", "SOFTWARE", "MATERIAL_BULK", "OTHER"]),
  note: z.string().max(2000).optional().nullable(),
  status: z.enum(["PLANNED", "PURCHASED", "POSTPONED", "CANCELLED"]).default("PLANNED"),
  machineId: optionalIdField.optional(),
  articleId: optionalIdField.optional(),
  projectId: optionalIdField.optional(),
});

export const financeSettingsSchema = z.object({
  estimatedTaxRate: z.coerce.number().min(0).max(100).optional(),
  /** Gewünschter Rücklagenprozentsatz (oft = Steuersatz); unverbindlich */
  reservePercent: z.coerce.number().min(0).max(100).optional().nullable(),
  revenueBasis: z.enum(["ISSUE_DATE", "PAYMENT_DATE"]).optional(),
  includeUnpaidInvoices: z.boolean().optional(),
  defaultPeriodPreset: z
    .enum([
      "current_month",
      "last_month",
      "current_quarter",
      "last_quarter",
      "current_year",
      "custom",
    ])
    .optional(),
  monthlyProfitTargetNet: z.coerce.number().min(0).optional().nullable(),
  highProfitWarningThreshold: z.coerce.number().min(0).optional().nullable(),
  profitSpikeFactor: z.coerce.number().min(1).max(10).optional(),
  lowExpenseRatioThreshold: z.coerce.number().min(0).max(1).optional(),
  highRevenueThreshold: z.coerce.number().min(0).optional(),
  lowLiquidityWarningThreshold: z.coerce.number().min(0).optional().nullable(),
  vatRegistered: z.boolean().optional(),
  kleinunternehmer: z.boolean().optional(),
  hasTaxAdvisor: z.boolean().optional(),
  profileNote: z.string().max(2000).optional().nullable(),
});
