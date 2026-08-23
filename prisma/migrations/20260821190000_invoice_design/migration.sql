-- Rechnungsdesign und rechtliche Hinweise in den Firmeneinstellungen
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "invoiceLegalText" TEXT;
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "invoiceAccentColor" TEXT NOT NULL DEFAULT '#0d5c63';
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "invoiceLayout" TEXT NOT NULL DEFAULT 'LOGO_LEFT';
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "invoiceFontScale" TEXT NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "invoiceTemplate" TEXT NOT NULL DEFAULT 'STANDARD';
