import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api";
import { getSystemHealth } from "@/lib/system/health-checks";

export async function GET() {
  const health = await getSystemHealth(false);
  const status = health.checks.database.status === "error" ? 503 : 200;
  return apiSuccess(
    {
      ok: health.ok,
      database: health.checks.database.status,
      latencyMs: health.checks.database.latencyMs,
    },
    status
  );
}

/** Detaillierter Health-Check (Admin oder CRON_SECRET). */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (secret && authHeader === `Bearer ${secret}`) {
    const health = await getSystemHealth(true);
    return apiSuccess(health, health.ok ? 200 : 503);
  }

  const auth = await requireAuth("notifications.manage");
  if (auth instanceof Response) return auth;

  const health = await getSystemHealth(true);
  return apiSuccess(health, health.ok ? 200 : 503);
}
