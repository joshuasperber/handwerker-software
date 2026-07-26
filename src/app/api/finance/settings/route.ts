import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { getOrCreateFinanceSettings, updateFinanceSettings } from "@/lib/finance/settings";

const nullableNumber = z
  .union([z.number(), z.null()])
  .optional();

const patchSchema = z.object({
  estimatedTaxRate: z.number().min(0).max(100).optional(),
  revenueBasis: z.enum(["ISSUE_DATE", "PAYMENT_DATE"]).optional(),
  includeUnpaidInvoices: z.boolean().optional(),
  defaultPeriodPreset: z
    .enum([
      "current_month",
      "last_month",
      "current_quarter",
      "last_quarter",
      "current_year",
    ])
    .optional(),
  monthlyProfitTargetNet: nullableNumber,
  highProfitWarningThreshold: nullableNumber,
  profitSpikeFactor: z.number().min(1).max(10).optional(),
  lowExpenseRatioThreshold: z.number().min(0).max(1).optional(),
  highRevenueThreshold: z.number().min(0).optional(),
  lowLiquidityWarningThreshold: nullableNumber,
});

export async function GET() {
  const auth = await requireAuth("invoices.read");
  if (auth instanceof Response) return auth;

  const settings = await getOrCreateFinanceSettings(auth.tenantId);
  return apiSuccess(settings);
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth("invoices.write");
  if (auth instanceof Response) return auth;

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Ungültige Eingabe");
  }

  const settings = await updateFinanceSettings(auth.tenantId, parsed.data);
  return apiSuccess(settings);
}
