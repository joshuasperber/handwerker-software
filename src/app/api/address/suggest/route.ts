import { NextRequest } from "next/server";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { suggestAddresses } from "@/lib/addresses/suggest";

/** Einfaches In-Memory-Rate-Limit pro Tenant (Serverless: best-effort). */
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string, max = 40, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count += 1;
  return entry.count > max;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const limit = Number(searchParams.get("limit") ?? 8);

  if (q.length < 3) {
    return apiSuccess({ suggestions: [], provider: "none" });
  }
  if (q.length > 120) {
    return apiError("Suchbegriff zu lang", 400);
  }

  if (rateLimited(`addr:${auth.tenantId}`)) {
    return apiError("Zu viele Adresssuchen – bitte kurz warten.", 429);
  }

  const result = await suggestAddresses({
    query: q,
    limit: Number.isFinite(limit) ? limit : 8,
  });

  return apiSuccess(result);
}
