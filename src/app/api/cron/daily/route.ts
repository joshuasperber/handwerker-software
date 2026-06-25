import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { apiSuccess, apiError } from "@/lib/api";
import { runJobs, type JobName } from "@/lib/jobs/run-all";
import { startJobRun, finishJobRun } from "@/lib/jobs/persist-run";
import { logger } from "@/lib/logger";

export const maxDuration = 60;

async function authorize(request: Request): Promise<{ tenantId?: string; trigger: "CRON" | "MANUAL" } | Response> {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (secret && authHeader === `Bearer ${secret}`) {
    return { trigger: "CRON" };
  }

  const session = await getSession();
  if (session && hasPermission(session.role, "notifications.manage")) {
    return { tenantId: session.tenantId, trigger: "MANUAL" };
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

  const run = await startJobRun({
    jobName: "daily",
    trigger: auth.trigger,
    tenantId: auth.tenantId,
  });
  const startedAt = run.startedAt;

  logger.info("cron daily started", {
    job: "daily",
    trigger: auth.trigger,
    tenantId: auth.tenantId,
  });

  try {
    const result = await runJobs({ jobs, tenantId: auth.tenantId });
    const totalErrors = result.reports.reduce((s, r) => s + r.errors, 0);
    const status =
      totalErrors === 0 ? "COMPLETED" : totalErrors < result.reports.length ? "PARTIAL" : "FAILED";

    await finishJobRun(run.id, {
      status,
      startedAt,
      tenantCount: result.tenants,
      reports: result.reports,
    });

    return apiSuccess({ ...result, jobRunId: run.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cron fehlgeschlagen";
    logger.error("cron daily failed", { job: "daily" }, err);
    await finishJobRun(run.id, {
      status: "FAILED",
      startedAt,
      errorMessage: message,
    });
    return apiError(message, 500);
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
