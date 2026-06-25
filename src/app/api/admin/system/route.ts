import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api";
import { getSystemHealth } from "@/lib/system/health-checks";

export async function GET() {
  const auth = await requireAuth("notifications.manage");
  if (auth instanceof Response) return auth;

  const health = await getSystemHealth(true);

  const recentRuns = await prisma.jobRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 20,
    select: {
      id: true,
      jobName: true,
      trigger: true,
      status: true,
      startedAt: true,
      finishedAt: true,
      durationMs: true,
      tenantCount: true,
      processed: true,
      skipped: true,
      errors: true,
      errorMessage: true,
    },
  });

  return apiSuccess({ health, recentRuns });
}
