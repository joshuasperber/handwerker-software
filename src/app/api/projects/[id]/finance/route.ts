import { NextRequest } from "next/server";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { getProjectFinance } from "@/lib/projects/finance";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.read");
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const data = await getProjectFinance(auth.tenantId, id);
  if (!data) return apiError("Projekt nicht gefunden", 404);
  return apiSuccess(data);
}
