-- Messaging-Kanal, Versandstatus, Kundeneinwilligung für Terminerinnerungen

DO $$ BEGIN
  CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('SENT', 'FAILED', 'NO_CONTACT', 'INVALID_PHONE', 'DISABLED', 'ALREADY_SENT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "CustomerContactPreference" AS ENUM ('AUTO', 'EMAIL', 'SMS', 'PHONE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "NotificationChannel" ADD VALUE IF NOT EXISTS 'WHATSAPP';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "contactAllowed" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "appointmentRemindersEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "preferredContactChannel" "CustomerContactPreference" NOT NULL DEFAULT 'AUTO';

ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "reminderStatus" "NotificationDeliveryStatus";
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "reminderError" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "reminderChannel" "NotificationChannel";

ALTER TABLE "NotificationLog" ADD COLUMN IF NOT EXISTS "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'SENT';
ALTER TABLE "NotificationLog" ADD COLUMN IF NOT EXISTS "errorMessage" TEXT;
ALTER TABLE "NotificationLog" ADD COLUMN IF NOT EXISTS "retryable" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "NotificationSettings" ADD COLUMN IF NOT EXISTS "messagingMode" TEXT NOT NULL DEFAULT 'SMS';
ALTER TABLE "NotificationSettings" ADD COLUMN IF NOT EXISTS "reminderSmsTemplate" TEXT;
ALTER TABLE "NotificationSettings" ADD COLUMN IF NOT EXISTS "messagingLastTestAt" TIMESTAMP(3);
ALTER TABLE "NotificationSettings" ADD COLUMN IF NOT EXISTS "messagingLastTestStatus" TEXT;
ALTER TABLE "NotificationSettings" ADD COLUMN IF NOT EXISTS "messagingLastTestError" TEXT;
ALTER TABLE "NotificationSettings" ADD COLUMN IF NOT EXISTS "messagingLastTestChannel" TEXT;

CREATE INDEX IF NOT EXISTS "NotificationLog_tenantId_type_status_idx"
  ON "NotificationLog"("tenantId", "type", "status");
