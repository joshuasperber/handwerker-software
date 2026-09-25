-- Festpreis bleibt der Kundenpreis. Interne Engine-Werte und Nachträge sind getrennt.
-- Bestehende Kalkulationen und Rechnungen bleiben unverändert.

ALTER TABLE "Calculation" ADD COLUMN IF NOT EXISTS "engineNetSalesPrice" DOUBLE PRECISION;

CREATE TABLE IF NOT EXISTS "FixedPricePosition" (
  "id" TEXT NOT NULL,
  "calculationId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "unitPriceNet" DOUBLE PRECISION,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "FixedPricePosition_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FixedPricePosition_calculationId_idx"
  ON "FixedPricePosition"("calculationId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FixedPricePosition_calculationId_fkey'
  ) THEN
    ALTER TABLE "FixedPricePosition"
      ADD CONSTRAINT "FixedPricePosition_calculationId_fkey"
      FOREIGN KEY ("calculationId") REFERENCES "Calculation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "OrderAddendum" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "occurredOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "materialNote" TEXT,
  "extraHours" DOUBLE PRECISION,
  "extraPriceNet" DOUBLE PRECISION,
  "note" TEXT,
  "employeeName" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrderAddendum_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OrderAddendum_tenantId_orderId_idx"
  ON "OrderAddendum"("tenantId", "orderId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OrderAddendum_tenantId_fkey'
  ) THEN
    ALTER TABLE "OrderAddendum"
      ADD CONSTRAINT "OrderAddendum_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OrderAddendum_orderId_fkey'
  ) THEN
    ALTER TABLE "OrderAddendum"
      ADD CONSTRAINT "OrderAddendum_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
