import { NextRequest } from "next/server";
import { requireAuth, apiSuccess } from "@/lib/api";
import { getEmployeeAvailability, getTeamsWithMembers } from "@/lib/disposition/availability";

export async function GET(request: NextRequest) {
  const auth = await requireAuth("orders.read");
  if (auth instanceof Response) return auth;

  const dateParam = request.nextUrl.searchParams.get("date");
  const date = dateParam ? new Date(dateParam) : new Date();

  const [employees, teams] = await Promise.all([
    getEmployeeAvailability(auth.tenantId, date),
    getTeamsWithMembers(auth.tenantId),
  ]);

  return apiSuccess({ date: date.toISOString(), employees, teams });
}
