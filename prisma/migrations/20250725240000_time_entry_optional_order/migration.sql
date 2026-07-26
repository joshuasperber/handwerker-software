-- Stundenzettel: Auftrag optional, Tätigkeit, Status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TimeEntryStatus') THEN
    CREATE TYPE "TimeEntryStatus" AS ENUM ('OPEN', 'REVIEWED', 'APPROVED');
  END IF;
END $$;

ALTER TABLE "TimeEntry" ALTER COLUMN "orderId" DROP NOT NULL;

ALTER TABLE "TimeEntry" ADD COLUMN IF NOT EXISTS "activity" TEXT;
ALTER TABLE "TimeEntry" ADD COLUMN IF NOT EXISTS "status" "TimeEntryStatus" NOT NULL DEFAULT 'OPEN';
ALTER TABLE "TimeEntry" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- FK: Cascade → SetNull (nur wenn Constraint existiert)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TimeEntry_orderId_fkey'
  ) THEN
    ALTER TABLE "TimeEntry" DROP CONSTRAINT "TimeEntry_orderId_fkey";
  END IF;
  ALTER TABLE "TimeEntry"
    ADD CONSTRAINT "TimeEntry_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "TimeEntry_employeeId_startTime_idx" ON "TimeEntry"("employeeId", "startTime");
CREATE INDEX IF NOT EXISTS "TimeEntry_status_idx" ON "TimeEntry"("status");
