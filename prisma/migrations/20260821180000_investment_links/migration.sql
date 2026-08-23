-- Optionaler Bezug geplanter Investitionen zu Maschine, Material oder Projekt
ALTER TABLE "PlannedInvestment" ADD COLUMN IF NOT EXISTS "machineId" TEXT;
ALTER TABLE "PlannedInvestment" ADD COLUMN IF NOT EXISTS "articleId" TEXT;
ALTER TABLE "PlannedInvestment" ADD COLUMN IF NOT EXISTS "projectId" TEXT;

CREATE INDEX IF NOT EXISTS "PlannedInvestment_machineId_idx" ON "PlannedInvestment"("machineId");
CREATE INDEX IF NOT EXISTS "PlannedInvestment_articleId_idx" ON "PlannedInvestment"("articleId");
CREATE INDEX IF NOT EXISTS "PlannedInvestment_projectId_idx" ON "PlannedInvestment"("projectId");

ALTER TABLE "PlannedInvestment"
  DROP CONSTRAINT IF EXISTS "PlannedInvestment_machineId_fkey";
ALTER TABLE "PlannedInvestment"
  ADD CONSTRAINT "PlannedInvestment_machineId_fkey"
  FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PlannedInvestment"
  DROP CONSTRAINT IF EXISTS "PlannedInvestment_articleId_fkey";
ALTER TABLE "PlannedInvestment"
  ADD CONSTRAINT "PlannedInvestment_articleId_fkey"
  FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PlannedInvestment"
  DROP CONSTRAINT IF EXISTS "PlannedInvestment_projectId_fkey";
ALTER TABLE "PlannedInvestment"
  ADD CONSTRAINT "PlannedInvestment_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
