import { prisma } from "@/lib/prisma";
import type { JobRunStatus, JobRunTrigger, Prisma } from "@/generated/prisma/client";
import type { JobReport } from "./types";
import { logger } from "@/lib/logger";

export async function startJobRun(params: {
  jobName: string;
  trigger: JobRunTrigger;
  tenantId?: string;
}) {
  return prisma.jobRun.create({
    data: {
      jobName: params.jobName,
      trigger: params.trigger,
      tenantId: params.tenantId ?? null,
      status: "RUNNING",
    },
  });
}

export async function finishJobRun(
  runId: string,
  params: {
    status: JobRunStatus;
    startedAt: Date;
    tenantCount?: number;
    reports?: JobReport[];
    errorMessage?: string;
  }
) {
  const processed = params.reports?.reduce((s, r) => s + r.processed, 0) ?? 0;
  const skipped = params.reports?.reduce((s, r) => s + r.skipped, 0) ?? 0;
  const errors = params.reports?.reduce((s, r) => s + r.errors, 0) ?? 0;

  const durationMs = Date.now() - params.startedAt.getTime();

  const updated = await prisma.jobRun.update({
    where: { id: runId },
    data: {
      status: params.status,
      finishedAt: new Date(),
      durationMs,
      tenantCount: params.tenantCount,
      processed,
      skipped,
      errors,
      report: (params.reports ?? undefined) as Prisma.InputJsonValue | undefined,
      errorMessage: params.errorMessage,
    },
  });

  logger.info("job run finished", {
    job: updated.jobName,
    durationMs,
    status: updated.status,
    errors: updated.errors,
  });

  return updated;
}
