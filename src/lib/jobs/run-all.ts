import { prisma } from "@/lib/prisma";
import { runAppointmentReminders } from "./appointment-reminders";
import { runDunning } from "./dunning";
import { runReorderCheck } from "./reorder-check";
import { emptyReport, type JobReport } from "./types";

export type JobName = "reminders" | "dunning" | "reorder";

const JOBS: Record<JobName, (tenantId: string, now?: Date) => Promise<JobReport>> = {
  reminders: runAppointmentReminders,
  dunning: runDunning,
  reorder: runReorderCheck,
};

function mergeInto(target: JobReport, src: JobReport) {
  target.processed += src.processed;
  target.skipped += src.skipped;
  target.errors += src.errors;
  if (src.details?.length) target.details?.push(...src.details);
}

/**
 * Fuehrt die angegebenen Jobs (Default: alle) ueber alle Tenants aus.
 * Fehler einzelner Tenants/Jobs brechen den Lauf nicht ab.
 */
export async function runJobs(opts?: {
  jobs?: JobName[];
  tenantId?: string;
  now?: Date;
}): Promise<{ reports: JobReport[]; tenants: number }> {
  const now = opts?.now ?? new Date();
  const jobNames = opts?.jobs ?? (Object.keys(JOBS) as JobName[]);

  const tenants = opts?.tenantId
    ? [{ id: opts.tenantId }]
    : await prisma.tenant.findMany({ select: { id: true } });

  const summary: Record<JobName, JobReport> = {
    reminders: emptyReport("appointment-reminders"),
    dunning: emptyReport("dunning"),
    reorder: emptyReport("reorder-check"),
  };

  for (const tenant of tenants) {
    for (const name of jobNames) {
      try {
        const report = await JOBS[name](tenant.id, now);
        mergeInto(summary[name], report);
      } catch (err) {
        summary[name].errors++;
        summary[name].details?.push(
          `Tenant ${tenant.id}: ${err instanceof Error ? err.message : "Fehler"}`
        );
      }
    }
  }

  return {
    reports: jobNames.map((n) => summary[n]),
    tenants: tenants.length,
  };
}
