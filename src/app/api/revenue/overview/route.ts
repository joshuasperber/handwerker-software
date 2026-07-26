import { NextRequest } from "next/server";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { FINANCE_PERIOD_PRESETS } from "@/lib/finance/period";
import type { FinancePeriodPreset } from "@/lib/finance/types";
import { getRevenueOverview } from "@/lib/revenue/overview";

export async function GET(request: NextRequest) {
  const auth = await requireAuth("invoices.read");
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const preset = searchParams.get("preset") as FinancePeriodPreset | null;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (preset && !FINANCE_PERIOD_PRESETS.includes(preset)) {
    return apiError("Ungültiger Zeitraum");
  }

  try {
    const data = await getRevenueOverview(auth.tenantId, {
      preset: preset ?? "current_month",
      from,
      to,
    });
    return apiSuccess(data);
  } catch (err) {
    console.error("[revenue/overview]", err);
    const devDetail =
      process.env.NODE_ENV === "development" && err instanceof Error
        ? `: ${err.message}`
        : "";
    return apiError(`Umsatzübersicht konnte nicht geladen werden${devDetail}`, 500);
  }
}
