import { NextRequest } from "next/server";
import { requireAuth, apiSuccess, apiError, NO_STORE_HEADERS } from "@/lib/api";
import { getOrCreateFinanceSettings, updateFinanceSettings } from "@/lib/finance/settings";
import { financeSettingsSchema } from "@/lib/finance/schemas";

export async function GET() {
  const auth = await requireAuth("invoices.read");
  if (auth instanceof Response) return auth;

  const settings = await getOrCreateFinanceSettings(auth.tenantId);
  return apiSuccess(settings, 200, NO_STORE_HEADERS);
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth("invoices.write");
  if (auth instanceof Response) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Ungültige JSON-Daten");
  }

  const parsed = financeSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Ungültige Eingabe");
  }

  const data = { ...parsed.data };
  if (data.profileNote !== undefined) {
    data.profileNote = data.profileNote?.trim() || null;
  }

  try {
    const settings = await updateFinanceSettings(auth.tenantId, data);
    return apiSuccess(settings, 200, NO_STORE_HEADERS);
  } catch (err) {
    console.error("[finance/settings PATCH]", err);
    return apiError("Finanzprofil konnte nicht gespeichert werden", 500);
  }
}
