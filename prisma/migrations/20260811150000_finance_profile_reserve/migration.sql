-- AlterTable FinanceSettings (unverbindliches Finanzprofil)
ALTER TABLE "FinanceSettings" ADD COLUMN IF NOT EXISTS "reservePercent" DOUBLE PRECISION;
ALTER TABLE "FinanceSettings" ADD COLUMN IF NOT EXISTS "vatRegistered" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "FinanceSettings" ADD COLUMN IF NOT EXISTS "kleinunternehmer" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FinanceSettings" ADD COLUMN IF NOT EXISTS "hasTaxAdvisor" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FinanceSettings" ADD COLUMN IF NOT EXISTS "profileNote" TEXT;
