-- Performance indexes for common dashboard and scheduling queries.

CREATE INDEX IF NOT EXISTS "Order_tenantId_scheduledStart_status_idx"
  ON "Order"("tenantId", "scheduledStart", "status");

CREATE INDEX IF NOT EXISTS "OrderService_orderId_idx"
  ON "OrderService"("orderId");

CREATE INDEX IF NOT EXISTS "Appointment_tenantId_status_startTime_idx"
  ON "Appointment"("tenantId", "status", "startTime");

CREATE INDEX IF NOT EXISTS "Appointment_orderId_idx"
  ON "Appointment"("orderId");

CREATE INDEX IF NOT EXISTS "TimeEntry_orderId_idx"
  ON "TimeEntry"("orderId");

CREATE INDEX IF NOT EXISTS "CalculationDocument_documentType_status_dueDate_idx"
  ON "CalculationDocument"("documentType", "status", "dueDate");
