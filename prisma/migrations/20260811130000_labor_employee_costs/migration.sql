-- CreateEnum
CREATE TYPE "LaborInvoiceMode" AS ENUM ('INTERNAL', 'ITEMIZED', 'SUMMARIZED');

-- AlterTable Employee
ALTER TABLE "Employee" ADD COLUMN "billingHourlyRateNet" DOUBLE PRECISION;
ALTER TABLE "Employee" ADD COLUMN "defaultActivity" TEXT;

-- AlterTable Calculation
ALTER TABLE "Calculation" ADD COLUMN "laborInvoiceMode" "LaborInvoiceMode" NOT NULL DEFAULT 'ITEMIZED';

-- AlterTable LaborItem
ALTER TABLE "LaborItem" ADD COLUMN "employeeId" TEXT;
ALTER TABLE "LaborItem" ADD COLUMN "actualHours" DOUBLE PRECISION;
ALTER TABLE "LaborItem" ADD COLUMN "internalHourlyWageNet" DOUBLE PRECISION;
ALTER TABLE "LaborItem" ADD COLUMN "notes" TEXT;

-- AddForeignKey
ALTER TABLE "LaborItem" ADD CONSTRAINT "LaborItem_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "LaborItem_employeeId_idx" ON "LaborItem"("employeeId");
