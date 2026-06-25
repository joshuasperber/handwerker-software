-- Disposition, phases & monteur visibility

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TERMIN_ZUWEISUNG';

ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "orderPhaseId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "isTentative" BOOLEAN NOT NULL DEFAULT false;

DO $$ BEGIN
  ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_orderPhaseId_fkey"
    FOREIGN KEY ("orderPhaseId") REFERENCES "OrderPhase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "Appointment_orderPhaseId_idx" ON "Appointment"("orderPhaseId");
