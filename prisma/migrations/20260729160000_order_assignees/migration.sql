-- Many-to-Many: Auftrag ↔ Mitarbeiter (Zuweisung unabhängig vom Kalendertermin)
CREATE TABLE IF NOT EXISTS "OrderAssignee" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderAssignee_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrderAssignee_orderId_employeeId_key"
  ON "OrderAssignee"("orderId", "employeeId");

CREATE INDEX IF NOT EXISTS "OrderAssignee_employeeId_idx" ON "OrderAssignee"("employeeId");
CREATE INDEX IF NOT EXISTS "OrderAssignee_orderId_idx" ON "OrderAssignee"("orderId");

DO $$ BEGIN
  ALTER TABLE "OrderAssignee"
    ADD CONSTRAINT "OrderAssignee_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "OrderAssignee"
    ADD CONSTRAINT "OrderAssignee_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Bestehende Termin-Zuweisungen → Assignees (ohne Stornos, nur mit Mitarbeiter)
INSERT INTO "OrderAssignee" ("id", "orderId", "employeeId", "createdAt")
SELECT
  md5(a."orderId" || ':' || a."employeeId")::text,
  a."orderId",
  a."employeeId",
  MIN(a."createdAt")
FROM "Appointment" a
WHERE a."employeeId" IS NOT NULL
  AND a."status" <> 'STORNIERT'
GROUP BY a."orderId", a."employeeId"
ON CONFLICT ("orderId", "employeeId") DO NOTHING;

-- Phasen-Zuweisungen ergänzen
INSERT INTO "OrderAssignee" ("id", "orderId", "employeeId", "createdAt")
SELECT
  md5(p."orderId" || ':' || p."assignedEmployeeId")::text,
  p."orderId",
  p."assignedEmployeeId",
  COALESCE(p."createdAt", CURRENT_TIMESTAMP)
FROM "OrderPhase" p
WHERE p."assignedEmployeeId" IS NOT NULL
ON CONFLICT ("orderId", "employeeId") DO NOTHING;
