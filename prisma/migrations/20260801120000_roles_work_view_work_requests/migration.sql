-- AlterEnum: neue Rollen
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'TEAMLEITER';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'AUSHILFE';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "WorkRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'CONVERTED', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "WorkRequestType" AS ENUM ('ZUSATZARBEIT', 'NEUE_ANFRAGE', 'MATERIAL_FEHLT', 'SCHADEN', 'RUECKFRAGE', 'SONSTIGES');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "canManageRoles" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "WorkRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "WorkRequestType" NOT NULL DEFAULT 'ZUSATZARBEIT',
    "status" "WorkRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "urgency" "OrderPriority" NOT NULL DEFAULT 'NORMAL',
    "estimatedHours" DOUBLE PRECISION,
    "materialNotes" TEXT,
    "addressNote" TEXT,
    "orderId" TEXT,
    "customerId" TEXT,
    "createdById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "convertedOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WorkRequest_tenantId_status_createdAt_idx" ON "WorkRequest"("tenantId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "WorkRequest_createdById_idx" ON "WorkRequest"("createdById");
CREATE INDEX IF NOT EXISTS "WorkRequest_orderId_idx" ON "WorkRequest"("orderId");

DO $$ BEGIN
  ALTER TABLE "WorkRequest" ADD CONSTRAINT "WorkRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "WorkRequest" ADD CONSTRAINT "WorkRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "WorkRequest" ADD CONSTRAINT "WorkRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "WorkRequest" ADD CONSTRAINT "WorkRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "WorkRequest" ADD CONSTRAINT "WorkRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
