import { requireAuth, apiSuccess } from "@/lib/api";
import { getDashboardAnalytics } from "@/lib/dashboard/analytics";

export async function GET() {
  const auth = await requireAuth("orders.read");
  if (auth instanceof Response) return auth;

  const data = await getDashboardAnalytics(auth.tenantId);
  return apiSuccess(data);
}
