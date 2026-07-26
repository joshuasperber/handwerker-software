-- Finanzübersicht: Ausgaben, Einstellungen, geplante Investitionen

CREATE TYPE "ExpenseCategory" AS ENUM (
  'MATERIAL',
  'MACHINERY',
  'TOOLS',
  'FUEL',
  'VEHICLES',
  'RENT',
  'SUBCONTRACTOR',
  'INSURANCE',
  'SOFTWARE',
  'TELECOM',
  'OTHER'
);

CREATE TYPE "ExpensePaymentStatus" AS ENUM ('OFFEN', 'BEZAHLT');

CREATE TYPE "FinanceRevenueBasis" AS ENUM ('ISSUE_DATE', 'PAYMENT_DATE');

CREATE TYPE "PlannedInvestmentCategory" AS ENUM (
  'MACHINE',
  'TOOL',
  'VEHICLE',
  'SOFTWARE',
  'OTHER'
);

CREATE TYPE "PlannedInvestmentStatus" AS ENUM (
  'PLANNED',
  'PURCHASED',
  'POSTPONED',
  'CANCELLED'
);

CREATE TABLE "FinanceSettings" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "estimatedTaxRate" DOUBLE PRECISION NOT NULL DEFAULT 30,
  "revenueBasis" "FinanceRevenueBasis" NOT NULL DEFAULT 'ISSUE_DATE',
  "includeUnpaidInvoices" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FinanceSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Expense" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "category" "ExpenseCategory" NOT NULL,
  "description" TEXT NOT NULL,
  "netAmount" DOUBLE PRECISION NOT NULL,
  "vatAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "grossAmount" DOUBLE PRECISION NOT NULL,
  "expenseDate" TIMESTAMP(3) NOT NULL,
  "paymentStatus" "ExpensePaymentStatus" NOT NULL DEFAULT 'BEZAHLT',
  "supplier" TEXT,
  "orderId" TEXT,
  "customerId" TEXT,
  "internalNote" TEXT,
  "receiptFileName" TEXT,
  "receiptMimeType" TEXT,
  "receiptStorageKey" TEXT,
  "receiptSizeBytes" INTEGER,
  "isInvestment" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlannedInvestment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "plannedAmount" DOUBLE PRECISION NOT NULL,
  "plannedDate" TIMESTAMP(3),
  "category" "PlannedInvestmentCategory" NOT NULL,
  "note" TEXT,
  "status" "PlannedInvestmentStatus" NOT NULL DEFAULT 'PLANNED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlannedInvestment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinanceSettings_tenantId_key" ON "FinanceSettings"("tenantId");

CREATE INDEX "Expense_tenantId_expenseDate_idx" ON "Expense"("tenantId", "expenseDate");
CREATE INDEX "Expense_tenantId_category_idx" ON "Expense"("tenantId", "category");
CREATE INDEX "Expense_orderId_idx" ON "Expense"("orderId");

CREATE INDEX "PlannedInvestment_tenantId_status_idx" ON "PlannedInvestment"("tenantId", "status");

ALTER TABLE "FinanceSettings"
  ADD CONSTRAINT "FinanceSettings_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PlannedInvestment"
  ADD CONSTRAINT "PlannedInvestment_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
