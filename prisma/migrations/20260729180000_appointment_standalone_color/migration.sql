-- Standalone-fähige Termine: optionaler Auftrag, Titel, Farbe, Projekt/Team/Fahrzeug
ALTER TABLE "Appointment" ALTER COLUMN "orderId" DROP NOT NULL;

ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "title" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "color" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "teamId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "vehicleId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "addressText" TEXT;

CREATE INDEX IF NOT EXISTS "Appointment_projectId_idx" ON "Appointment"("projectId");
CREATE INDEX IF NOT EXISTS "Appointment_teamId_idx" ON "Appointment"("teamId");
CREATE INDEX IF NOT EXISTS "Appointment_vehicleId_idx" ON "Appointment"("vehicleId");

DO $$ BEGIN
  ALTER TABLE "Appointment"
    ADD CONSTRAINT "Appointment_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Appointment"
    ADD CONSTRAINT "Appointment_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Appointment"
    ADD CONSTRAINT "Appointment_vehicleId_fkey"
    FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Titel aus Auftrag nachziehen, wo leer
UPDATE "Appointment" a
SET "title" = COALESCE(o."title", o."orderNumber")
FROM "Order" o
WHERE a."orderId" = o."id"
  AND (a."title" IS NULL OR a."title" = '');
