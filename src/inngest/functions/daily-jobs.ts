import { inngest } from "@/inngest/client";
import { runJobs, type JobName } from "@/lib/jobs/run-all";
import { startJobRun, finishJobRun } from "@/lib/jobs/persist-run";

/** Manueller/geplanter Job-Lauf via Inngest-Event (Vercel Cron bleibt primär). */
export const manualDailyJobsFn = inngest.createFunction(
  { id: "daily-jobs-manual", retries: 1, triggers: [{ event: "jobs/daily-run" }] },
  async ({ event }) => {
    const { tenantId, jobs, trigger } = event.data as {
      tenantId?: string;
      jobs?: JobName[];
      trigger: "CRON" | "MANUAL";
    };
    const run = await startJobRun({
      jobName: "daily",
      trigger: trigger === "MANUAL" ? "MANUAL" : "CRON",
      tenantId,
    });
    const startedAt = run.startedAt;

    try {
      const result = await runJobs({ tenantId, jobs });
      const totalErrors = result.reports.reduce((s, r) => s + r.errors, 0);
      const status =
        totalErrors === 0 ? "COMPLETED" : totalErrors < result.reports.length ? "PARTIAL" : "FAILED";

      await finishJobRun(run.id, {
        status,
        startedAt,
        tenantCount: result.tenants,
        reports: result.reports,
      });

      return { status, jobRunId: run.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Job run failed";
      await finishJobRun(run.id, { status: "FAILED", startedAt, errorMessage: message });
      throw err;
    }
  }
);
