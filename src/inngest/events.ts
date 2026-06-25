export type InngestEvents = {
  "notifications/assignment": {
    data: {
      tenantId: string;
      orderId: string;
      orderNumber: string;
      employeeIds: string[];
      startTime?: string | null;
      endTime?: string | null;
      phaseName?: string | null;
    };
  };
  "notifications/staff-request-created": {
    data: {
      tenantId: string;
      orderId: string;
      orderNumber: string;
      employeeId: string;
      message?: string | null;
    };
  };
  "notifications/staff-request-responded": {
    data: {
      tenantId: string;
      requestedById: string;
      orderNumber: string;
      employeeName: string;
      accepted: boolean;
    };
  };
  "jobs/daily-run": {
    data: {
      tenantId?: string;
      jobs?: ("reminders" | "dunning" | "reorder")[];
      trigger: "CRON" | "MANUAL";
    };
  };
};
