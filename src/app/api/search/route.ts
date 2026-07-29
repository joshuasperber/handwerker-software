import { NextRequest } from "next/server";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { runGlobalSearch } from "@/lib/search/run-search";

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) {
    return apiSuccess({
      query: q,
      groups: [],
      topCategories: [],
      moreCategories: [],
      totalHits: 0,
    });
  }
  if (q.length > 120) {
    return apiError("Suchbegriff zu lang", 400);
  }

  try {
    const result = await runGlobalSearch({
      tenantId: auth.tenantId,
      role: auth.role,
      query: q,
    });
    return apiSuccess(result);
  } catch (err) {
    console.error("[search]", err);
    return apiError("Suche fehlgeschlagen", 500);
  }
}
