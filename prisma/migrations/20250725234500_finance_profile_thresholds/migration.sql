-- Finanzprofil: Zielwerte, Warnschwellen, Materialgroßeinkauf
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PlannedInvestmentCategory') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'PlannedInvestmentCategory' AND e.enumlabel = 'MATERIAL_BULK'
    ) THEN
      ALTER TYPE "PlannedInvestmentCategory" ADD VALUE 'MATERIAL_BULK';
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'FinanceSettings'
  ) THEN
    ALTER TABLE "FinanceSettings" ADD COLUMN IF NOT EXISTS "defaultPeriodPreset" TEXT NOT NULL DEFAULT 'current_month';
    ALTER TABLE "FinanceSettings" ADD COLUMN IF NOT EXISTS "monthlyProfitTargetNet" DOUBLE PRECISION;
    ALTER TABLE "FinanceSettings" ADD COLUMN IF NOT EXISTS "highProfitWarningThreshold" DOUBLE PRECISION DEFAULT 5000;
    ALTER TABLE "FinanceSettings" ADD COLUMN IF NOT EXISTS "profitSpikeFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.5;
    ALTER TABLE "FinanceSettings" ADD COLUMN IF NOT EXISTS "lowExpenseRatioThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.15;
    ALTER TABLE "FinanceSettings" ADD COLUMN IF NOT EXISTS "highRevenueThreshold" DOUBLE PRECISION NOT NULL DEFAULT 3000;
    ALTER TABLE "FinanceSettings" ADD COLUMN IF NOT EXISTS "lowLiquidityWarningThreshold" DOUBLE PRECISION;
  END IF;
END $$;
