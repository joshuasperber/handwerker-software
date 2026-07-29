-- ProjectCost: Abrechnungsstatus für Doppel-Rechnungen vermeiden
ALTER TABLE "ProjectCost" ADD COLUMN IF NOT EXISTS "invoicedAt" TIMESTAMP(3);
ALTER TABLE "ProjectCost" ADD COLUMN IF NOT EXISTS "invoicedCalculationId" TEXT;
CREATE INDEX IF NOT EXISTS "ProjectCost_invoicedCalculationId_idx" ON "ProjectCost"("invoicedCalculationId");
