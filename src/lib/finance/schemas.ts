import { z } from "zod";

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
  netAmount: z.number().min(0, "Betrag netto darf nicht negativ sein"),
  vatAmount: z.number().min(0, "Umsatzsteuer darf nicht negativ sein").default(0),
  grossAmount: z.number().min(0, "Betrag brutto darf nicht negativ sein"),
  expenseDate: z.string().min(1, "Datum erforderlich"),
  paymentStatus: z.enum(["OFFEN", "BEZAHLT"]).default("BEZAHLT"),
  supplier: z.string().max(200).optional().nullable(),
  orderId: z.string().optional().nullable(),
  customerId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  internalNote: z.string().max(2000).optional().nullable(),
  isInvestment: z.boolean().default(false),
});

export const investmentInputSchema = z.object({
  title: z.string().min(1).max(200),
  plannedAmount: z.number().min(0),
  plannedDate: z.string().optional().nullable(),
  category: z.enum(["MACHINE", "TOOL", "VEHICLE", "SOFTWARE", "MATERIAL_BULK", "OTHER"]),
  note: z.string().max(2000).optional().nullable(),
  status: z.enum(["PLANNED", "PURCHASED", "POSTPONED", "CANCELLED"]).default("PLANNED"),
});
