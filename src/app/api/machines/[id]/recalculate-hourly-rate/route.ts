import { NextRequest } from "next/server";
import { requireAuth, apiSuccess } from "@/lib/api";
import { recalculateMachineHourlyRate } from "@/lib/calculation/recalculate-db";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("calculations.settings");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const machine = await recalculateMachineHourlyRate(id, auth.tenantId);
  return apiSuccess(machine);
}
