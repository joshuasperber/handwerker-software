-- Inventar: erweiterte Entnahme-/Zugangsdaten auf StockMovement
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "employeeId" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "reason" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "purchasePriceNet" DOUBLE PRECISION;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "salePriceNet" DOUBLE PRECISION;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "supplierName" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "receiptFileName" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "receiptMimeType" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "receiptStorageKey" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "receiptSizeBytes" INTEGER;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Bestehende Zeilen: occurredAt = createdAt
UPDATE "StockMovement" SET "occurredAt" = "createdAt" WHERE "occurredAt" IS NULL OR "occurredAt" = "createdAt";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockMovement_customerId_fkey') THEN
    ALTER TABLE "StockMovement"
      ADD CONSTRAINT "StockMovement_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockMovement_employeeId_fkey') THEN
    ALTER TABLE "StockMovement"
      ADD CONSTRAINT "StockMovement_employeeId_fkey"
      FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockMovement_createdById_fkey') THEN
    ALTER TABLE "StockMovement"
      ADD CONSTRAINT "StockMovement_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "StockMovement_tenantId_occurredAt_idx" ON "StockMovement"("tenantId", "occurredAt");
CREATE INDEX IF NOT EXISTS "StockMovement_customerId_idx" ON "StockMovement"("customerId");
CREATE INDEX IF NOT EXISTS "StockMovement_employeeId_idx" ON "StockMovement"("employeeId");
