-- Separate links for the craft business's own legal documents and persist the
-- real completion of the booking-link onboarding step.
ALTER TABLE "Tenant"
  ADD COLUMN "termsUrl" TEXT,
  ADD COLUMN "onboardingBookingCompletedAt" TIMESTAMP(3);
