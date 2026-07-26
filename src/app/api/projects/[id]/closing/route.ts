import { NextRequest } from "next/server";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { getProjectClosingOverview } from "@/lib/projects/overview";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.read");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  try {
    const data = await getProjectClosingOverview(auth.tenantId, id);
    if (!data) return apiError("Projekt nicht gefunden", 404);
    return apiSuccess(data);
  } catch (err) {
    console.error("[projects/closing]", err);
    return apiError("Abschlussübersicht konnte nicht geladen werden", 500);
  }
}
