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
  netAmount: z.number().min(0),
  vatAmount: z.number().min(0).default(0),
  grossAmount: z.number().min(0),
  expenseDate: z.string().min(1),
  paymentStatus: z.enum(["OFFEN", "BEZAHLT"]).default("BEZAHLT"),
  supplier: z.string().max(200).optional().nullable(),
  orderId: z.string().optional().nullable(),
  customerId: z.string().optional().nullable(),
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
