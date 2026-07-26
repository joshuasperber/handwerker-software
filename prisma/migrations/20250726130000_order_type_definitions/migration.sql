-- Manageable order types per tenant (replaces fixed enum usage in the UI).

CREATE TABLE IF NOT EXISTS "OrderTypeDefinition" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isOther" BOOLEAN NOT NULL DEFAULT false,
    "legacyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrderTypeDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrderTypeDefinition_tenantId_name_key" ON "OrderTypeDefinition"("tenantId", "name");
CREATE INDEX IF NOT EXISTS "OrderTypeDefinition_tenantId_isActive_sortOrder_idx" ON "OrderTypeDefinition"("tenantId", "isActive", "sortOrder");
CREATE INDEX IF NOT EXISTS "OrderTypeDefinition_tenantId_legacyKey_idx" ON "OrderTypeDefinition"("tenantId", "legacyKey");

DO $$ BEGIN
  ALTER TABLE "OrderTypeDefinition" ADD CONSTRAINT "OrderTypeDefinition_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "orderTypeId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "orderTypeLabel" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "orderTypeCustom" TEXT;

CREATE INDEX IF NOT EXISTS "Order_orderTypeId_idx" ON "Order"("orderTypeId");

DO $$ BEGIN
  ALTER TABLE "Order" ADD CONSTRAINT "Order_orderTypeId_fkey" FOREIGN KEY ("orderTypeId") REFERENCES "OrderTypeDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
