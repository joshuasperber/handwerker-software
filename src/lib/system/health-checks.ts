import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import { isInngestEnabled } from "@/inngest/client";

export type HealthStatus = "ok" | "degraded" | "error" | "skipped";

export interface HealthCheckResult {
  status: HealthStatus;
  latencyMs?: number;
  message?: string;
}

export interface SystemHealth {
  ok: boolean;
  timestamp: string;
  checks: {
    database: HealthCheckResult;
    storage: HealthCheckResult;
    smtp: HealthCheckResult;
    cron: HealthCheckResult;
  };
    config: {
      cronSecretSet: boolean;
      s3Configured: boolean;
      smtpConfigured: boolean;
      inngestConfigured: boolean;
      sentryConfigured: boolean;
    };
  lastJobRun?: {
    jobName: string;
    status: string;
    startedAt: string;
    durationMs: number | null;
    errors: number;
  } | null;
}

function s3Configured(): boolean {
  const key = process.env.S3_ACCESS_KEY ?? process.env.S3_ACCES_KEY;
  return Boolean(process.env.S3_BUCKET && key && process.env.S3_SECRET_KEY);
}

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

export async function checkDatabase(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ok", latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: "error",
      latencyMs: Date.now() - start,
      message: err instanceof Error ? err.message : "DB unreachable",
    };
  }
}

export async function checkStorage(): Promise<HealthCheckResult> {
  if (!s3Configured()) {
    return { status: "skipped", message: "S3 nicht konfiguriert" };
  }
  const start = Date.now();
  try {
    const client = new S3Client({
      region: process.env.S3_REGION ?? "us-east-1",
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: Boolean(process.env.S3_ENDPOINT),
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY ?? process.env.S3_ACCES_KEY ?? "",
        secretAccessKey: process.env.S3_SECRET_KEY ?? "",
      },
    });
    await client.send(
      new HeadBucketCommand({ Bucket: process.env.S3_BUCKET! })
    );
    return { status: "ok", latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: "error",
      latencyMs: Date.now() - start,
      message: err instanceof Error ? err.message.slice(0, 120) : "Storage unreachable",
    };
  }
}

export function checkSmtpConfig(): HealthCheckResult {
  if (!smtpConfigured()) {
    return { status: "skipped", message: "SMTP nicht konfiguriert" };
  }
  return { status: "ok", message: "SMTP konfiguriert" };
}

export async function checkLastCronRun(): Promise<HealthCheckResult> {
  try {
    const last = await prisma.jobRun.findFirst({
      where: { jobName: "daily", trigger: "CRON" },
      orderBy: { startedAt: "desc" },
    });
    if (!last) {
      return { status: "skipped", message: "Noch kein Cron-Lauf protokolliert" };
    }
    if (last.status === "RUNNING") {
      const ageMin = (Date.now() - last.startedAt.getTime()) / 60_000;
      if (ageMin > 30) {
        return { status: "error", message: "Cron-Lauf hängt (>30 Min)" };
      }
      return { status: "ok", message: "Cron läuft gerade" };
    }
    if (last.status === "FAILED") {
      return { status: "error", message: last.errorMessage ?? "Letzter Cron fehlgeschlagen" };
    }
    if (last.status === "PARTIAL") {
      return { status: "degraded", message: "Letzter Cron mit Fehlern (PARTIAL)" };
    }
    const hoursSince = (Date.now() - (last.finishedAt ?? last.startedAt).getTime()) / 3_600_000;
    if (hoursSince > 30) {
      return { status: "degraded", message: "Kein Cron-Lauf seit >30h" };
    }
    return { status: "ok", message: "Cron kürzlich erfolgreich" };
  } catch {
    return { status: "skipped", message: "JobRun-Tabelle nicht verfügbar" };
  }
}

export async function getSystemHealth(detailed = false): Promise<SystemHealth> {
  const [database, storage, cron] = await Promise.all([
    checkDatabase(),
    detailed ? checkStorage() : Promise.resolve({ status: "skipped" as const, message: "—" }),
    detailed ? checkLastCronRun() : Promise.resolve({ status: "skipped" as const, message: "—" }),
  ]);
  const smtp = checkSmtpConfig();

  let lastJobRun = null;
  if (detailed) {
    try {
      const last = await prisma.jobRun.findFirst({
        where: { jobName: "daily" },
        orderBy: { startedAt: "desc" },
      });
      if (last) {
        lastJobRun = {
          jobName: last.jobName,
          status: last.status,
          startedAt: last.startedAt.toISOString(),
          durationMs: last.durationMs,
          errors: last.errors,
        };
      }
    } catch {
      /* schema not migrated yet */
    }
  }

  const checks = { database, storage, smtp, cron };
  const criticalFailed = database.status === "error";
  const degraded =
    storage.status === "error" ||
    cron.status === "error" ||
    cron.status === "degraded";

  return {
    ok: !criticalFailed && !degraded,
    timestamp: new Date().toISOString(),
    checks,
    config: {
      cronSecretSet: Boolean(process.env.CRON_SECRET),
      s3Configured: s3Configured(),
      smtpConfigured: smtpConfigured(),
      inngestConfigured: isInngestEnabled(),
      sentryConfigured: Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN),
    },
    lastJobRun,
  };
}
