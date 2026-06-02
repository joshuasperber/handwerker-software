import { getSession } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api";

export async function GET() {
  const session = await getSession();
  if (!session) return apiError("Nicht authentifiziert", 401);
  return apiSuccess({ user: session });
}
