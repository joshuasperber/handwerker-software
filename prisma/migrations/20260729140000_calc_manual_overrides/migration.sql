-- Kalkulation: manuelle Overrides für Gemeinkosten und Fahrtkosten
ALTER TABLE "Calculation" ADD COLUMN IF NOT EXISTS "overheadPercentOverride" DOUBLE PRECISION;
ALTER TABLE "Calculation" ADD COLUMN IF NOT EXISTS "overheadAmountOverride" DOUBLE PRECISION;

ALTER TABLE "TravelCost" ADD COLUMN IF NOT EXISTS "totalIsManual" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TravelCost" ADD COLUMN IF NOT EXISTS "manualTotalNet" DOUBLE PRECISION;
