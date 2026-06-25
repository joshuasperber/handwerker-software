import { inngest } from "@/inngest/client";
import {
  notifyEmployeesAssigned,
  notifyStaffRequestCreated,
  notifyStaffRequestResponded,
} from "@/lib/scheduling/assignment-notifications";

export const assignmentNotificationFn = inngest.createFunction(
  { id: "notifications-assignment", retries: 3, triggers: [{ event: "notifications/assignment" }] },
  async ({ event }) => {
    const { tenantId, orderId, orderNumber, employeeIds, startTime, endTime, phaseName } =
      event.data as {
        tenantId: string;
        orderId: string;
        orderNumber: string;
        employeeIds: string[];
        startTime?: string | null;
        endTime?: string | null;
        phaseName?: string | null;
      };
    await notifyEmployeesAssigned({
      tenantId,
      orderId,
      orderNumber,
      employeeIds,
      startTime: startTime ? new Date(startTime) : null,
      endTime: endTime ? new Date(endTime) : null,
      phaseName,
    });
    return { sent: employeeIds.length };
  }
);

export const staffRequestCreatedFn = inngest.createFunction(
  {
    id: "notifications-staff-request-created",
    retries: 3,
    triggers: [{ event: "notifications/staff-request-created" }],
  },
  async ({ event }) => {
    await notifyStaffRequestCreated(
      event.data as Parameters<typeof notifyStaffRequestCreated>[0]
    );
    return { ok: true };
  }
);

export const staffRequestRespondedFn = inngest.createFunction(
  {
    id: "notifications-staff-request-responded",
    retries: 3,
    triggers: [{ event: "notifications/staff-request-responded" }],
  },
  async ({ event }) => {
    await notifyStaffRequestResponded(
      event.data as Parameters<typeof notifyStaffRequestResponded>[0]
    );
    return { ok: true };
  }
);
