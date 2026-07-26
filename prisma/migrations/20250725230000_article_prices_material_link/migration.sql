-- Inventar: Beschreibung + Kalkulations-/Verkaufspreis
ALTER TABLE "Article" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Article" ADD COLUMN IF NOT EXISTS "salesPriceNet" DOUBLE PRECISION;

-- Kalkulation: optionale Verknüpfung zum Inventarartikel (Preis wird nur einmal übernommen)
ALTER TABLE "MaterialItem" ADD COLUMN IF NOT EXISTS "articleId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MaterialItem_articleId_fkey'
  ) THEN
    ALTER TABLE "MaterialItem"
      ADD CONSTRAINT "MaterialItem_articleId_fkey"
      FOREIGN KEY ("articleId") REFERENCES "Article"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "MaterialItem_articleId_idx" ON "MaterialItem"("articleId");
