import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { apiSuccess, apiError } from "@/lib/api";
import { runJobs, type JobName } from "@/lib/jobs/run-all";

export const maxDuration = 60;

/**
 * Geplanter Tageslauf (Vercel Cron). Autorisierung entweder ueber den von Vercel
 * gesetzten `Authorization: Bearer ${CRON_SECRET}` oder einen eingeloggten Admin
 * (notifications.manage) fuer den manuellen Test-Trigger.
 */
async function authorize(request: Request): Promise<{ tenantId?: string } | Response> {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (secret && authHeader === `Bearer ${secret}`) {
    return {}; // Cron: alle Tenants
  }

  const session = await getSession();
  if (session && hasPermission(session.role, "notifications.manage")) {
    return { tenantId: session.tenantId }; // Manuell: nur eigener Tenant
  }

  return apiError("Nicht autorisiert", 401);
}

async function handle(request: Request) {
  const auth = await authorize(request);
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const only = searchParams.get("jobs");
  const jobs = only
    ? (only.split(",").filter((j) => ["reminders", "dunning", "reorder"].includes(j)) as JobName[])
    : undefined;

  const result = await runJobs({ jobs, tenantId: auth.tenantId });
  return apiSuccess(result);
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
