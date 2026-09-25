-- Investitionsrücklage: Sparmodell, virtueller Topf, Monatsentscheidung.
-- Bestehende Zeilen bleiben. Neue Spalten haben Standardwerte.

ALTER TYPE "PlannedInvestmentCategory" ADD VALUE IF NOT EXISTS 'SMARTPHONE';
ALTER TYPE "PlannedInvestmentStatus" ADD VALUE IF NOT EXISTS 'ACTIVE';
ALTER TYPE "PlannedInvestmentStatus" ADD VALUE IF NOT EXISTS 'GOAL_REACHED';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InvestmentSavingsModel') THEN
    CREATE TYPE "InvestmentSavingsModel" AS ENUM (
      'PERCENT_REVENUE',
      'FIXED_PER_ORDER',
      'FIXED_MONTHLY',
      'TARGET_SCHEDULE'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InvestmentCalculationBasis') THEN
    CREATE TYPE "InvestmentCalculationBasis" AS ENUM ('NET', 'GROSS', 'CONTRIBUTION');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InvestmentReserveStatus') THEN
    CREATE TYPE "InvestmentReserveStatus" AS ENUM (
      'CONFIRMED',
      'ADJUSTED',
      'DEFERRED',
      'IGNORED'
    );
  END IF;
END $$;

ALTER TABLE "PlannedInvestment" ADD COLUMN IF NOT EXISTS "savedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "PlannedInvestment" ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3);
ALTER TABLE "PlannedInvestment" ADD COLUMN IF NOT EXISTS "savingsModel" "InvestmentSavingsModel" NOT NULL DEFAULT 'TARGET_SCHEDULE';
ALTER TABLE "PlannedInvestment" ADD COLUMN IF NOT EXISTS "percentOfRevenue" DOUBLE PRECISION;
ALTER TABLE "PlannedInvestment" ADD COLUMN IF NOT EXISTS "amountPerOrder" DOUBLE PRECISION;
ALTER TABLE "PlannedInvestment" ADD COLUMN IF NOT EXISTS "monthlyAmount" DOUBLE PRECISION;
ALTER TABLE "PlannedInvestment" ADD COLUMN IF NOT EXISTS "calculationBasis" "InvestmentCalculationBasis" NOT NULL DEFAULT 'NET';

CREATE TABLE IF NOT EXISTS "InvestmentReserveMonth" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "investmentId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "suggestedAmount" DOUBLE PRECISION NOT NULL,
  "appliedAmount" DOUBLE PRECISION,
  "status" "InvestmentReserveStatus" NOT NULL,
  "orderCount" INTEGER NOT NULL DEFAULT 0,
  "basisAmount" DOUBLE PRECISION,
  "carryIn" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "explanation" TEXT,
  "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InvestmentReserveMonth_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InvestmentReserveMonth_investmentId_year_month_key"
  ON "InvestmentReserveMonth"("investmentId", "year", "month");
CREATE INDEX IF NOT EXISTS "InvestmentReserveMonth_tenantId_year_month_idx"
  ON "InvestmentReserveMonth"("tenantId", "year", "month");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InvestmentReserveMonth_tenantId_fkey'
  ) THEN
    ALTER TABLE "InvestmentReserveMonth"
      ADD CONSTRAINT "InvestmentReserveMonth_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InvestmentReserveMonth_investmentId_fkey'
  ) THEN
    ALTER TABLE "InvestmentReserveMonth"
      ADD CONSTRAINT "InvestmentReserveMonth_investmentId_fkey"
      FOREIGN KEY ("investmentId") REFERENCES "PlannedInvestment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
