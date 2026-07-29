import { NextRequest } from "next/server";
import { requireAuth, apiSuccess, apiError, NO_STORE_HEADERS } from "@/lib/api";
import { getFinanceOverview } from "@/lib/finance/overview";
import type { FinancePeriodPreset } from "@/lib/finance/types";

import { FINANCE_PERIOD_PRESETS } from "@/lib/finance/period";

const VALID_PRESETS: FinancePeriodPreset[] = FINANCE_PERIOD_PRESETS;

export async function GET(request: NextRequest) {
  const auth = await requireAuth("invoices.read");
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const preset = searchParams.get("preset") as FinancePeriodPreset | null;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (preset && !VALID_PRESETS.includes(preset)) {
    return apiError("Ungültiger Zeitraum");
  }

  try {
    const data = await getFinanceOverview(auth.tenantId, {
      preset: preset ?? "current_month",
      from,
      to,
    });
    // Finanzdaten: nur In-Memory (SWR), nie HTTP-/Browser-Cache
    return apiSuccess(data, 200, NO_STORE_HEADERS);
  } catch (err) {
    console.error("[finance/overview]", err);
    const devDetail =
      process.env.NODE_ENV === "development" && err instanceof Error
        ? `: ${err.message}`
        : "";
    return apiError(`Finanzübersicht konnte nicht geladen werden${devDetail}`, 500);
  }
}
