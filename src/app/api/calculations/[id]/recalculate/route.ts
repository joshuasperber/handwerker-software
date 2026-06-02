import { NextRequest } from "next/server";
import { requireAuth, apiSuccess } from "@/lib/api";
import { recalculateCalculationRecord } from "@/lib/calculation/recalculate-db";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("calculations.write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const result = await recalculateCalculationRecord(id, auth.tenantId);
  return apiSuccess(result);
}
