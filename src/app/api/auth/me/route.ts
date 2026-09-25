import { apiSuccess, requireAuth } from "@/lib/api";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  return apiSuccess({ user: auth });
}
