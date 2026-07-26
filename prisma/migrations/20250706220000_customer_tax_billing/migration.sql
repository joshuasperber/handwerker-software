-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('PRIVAT', 'GEWERBLICH');

-- CreateEnum
CREATE TYPE "TaxTreatmentType" AS ENUM ('STANDARD_VAT', 'REVERSE_CHARGE', 'BUILDING_EXEMPTION', 'MANUAL_REVIEW');

-- AlterTable Customer
ALTER TABLE "Customer" ADD COLUMN "customerType" "CustomerType" NOT NULL DEFAULT 'PRIVAT';
ALTER TABLE "Customer" ADD COLUMN "contactPerson" TEXT;
ALTER TABLE "Customer" ADD COLUMN "vatId" TEXT;
ALTER TABLE "Customer" ADD COLUMN "taxNumber" TEXT;
ALTER TABLE "Customer" ADD COLUMN "billingStreet" TEXT;
ALTER TABLE "Customer" ADD COLUMN "billingZipCode" TEXT;
ALTER TABLE "Customer" ADD COLUMN "billingCity" TEXT;
ALTER TABLE "Customer" ADD COLUMN "taxNotes" TEXT;

-- CreateTable TaxExemptionCertificate
CREATE TABLE "TaxExemptionCertificate" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "hasCertificate" BOOLEAN NOT NULL DEFAULT false,
    "issuingTaxOffice" TEXT,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "certificateNumber" TEXT,
    "documentStorageKey" TEXT,
    "documentFileName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxExemptionCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaxExemptionCertificate_customerId_key" ON "TaxExemptionCertificate"("customerId");

-- AddForeignKey
ALTER TABLE "TaxExemptionCertificate" ADD CONSTRAINT "TaxExemptionCertificate_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable VATSettings
ALTER TABLE "VATSettings" ADD COLUMN "taxTreatment" "TaxTreatmentType" NOT NULL DEFAULT 'STANDARD_VAT';
ALTER TABLE "VATSettings" ADD COLUMN "reverseChargeConfirmed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "VATSettings" ADD COLUMN "includeSection13bNote" BOOLEAN NOT NULL DEFAULT true;

-- Migrate existing reverseCharge flags to taxTreatment (best-effort, non-destructive)
UPDATE "VATSettings" SET "taxTreatment" = 'REVERSE_CHARGE' WHERE "reverseCharge" = true;
