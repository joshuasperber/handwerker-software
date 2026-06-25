import { inngest, isInngestEnabled } from "@/inngest/client";
import {
  notifyEmployeesAssigned,
  notifyStaffRequestCreated,
  notifyStaffRequestResponded,
} from "@/lib/scheduling/assignment-notifications";
import { logger } from "@/lib/logger";

type AssignmentParams = Parameters<typeof notifyEmployeesAssigned>[0];

export async function queueAssignmentNotification(params: AssignmentParams) {
  if (!params.employeeIds.length) return;

  if (isInngestEnabled()) {
    await inngest.send({
      name: "notifications/assignment",
      data: {
        tenantId: params.tenantId,
        orderId: params.orderId,
        orderNumber: params.orderNumber,
        employeeIds: params.employeeIds,
        startTime: params.startTime?.toISOString() ?? null,
        endTime: params.endTime?.toISOString() ?? null,
        phaseName: params.phaseName ?? null,
      },
    });
    logger.info("queued assignment notification", {
      job: "notifications/assignment",
      tenantId: params.tenantId,
    });
    return;
  }

  await notifyEmployeesAssigned(params);
}

export async function queueStaffRequestCreated(
  params: Parameters<typeof notifyStaffRequestCreated>[0]
) {
  if (isInngestEnabled()) {
    await inngest.send({
      name: "notifications/staff-request-created",
      data: params,
    });
    return;
  }
  await notifyStaffRequestCreated(params);
}

export async function queueStaffRequestResponded(
  params: Parameters<typeof notifyStaffRequestResponded>[0]
) {
  if (isInngestEnabled()) {
    await inngest.send({
      name: "notifications/staff-request-responded",
      data: params,
    });
    return;
  }
  await notifyStaffRequestResponded(params);
}

export async function queueDailyJobs(params: {
  tenantId?: string;
  jobs?: ("reminders" | "dunning" | "reorder")[];
  trigger?: "CRON" | "MANUAL";
}) {
  if (isInngestEnabled()) {
    await inngest.send({
      name: "jobs/daily-run",
      data: {
        tenantId: params.tenantId,
        jobs: params.jobs,
        trigger: params.trigger ?? "MANUAL",
      },
    });
    return true;
  }
  return false;
}
