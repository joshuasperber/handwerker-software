-- CreateEnum
CREATE TYPE "FixedPriceDisplayMode" AS ENUM ('SINGLE_LINE', 'POSITIONS_WITH_PRICES', 'DESCRIPTION_ONLY');

-- AlterTable Order
ALTER TABLE "Order" ADD COLUMN "useFixedPrice" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN "fixedPriceNet" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN "fixedPriceLabel" TEXT;
ALTER TABLE "Order" ADD COLUMN "fixedPriceDisplayMode" "FixedPriceDisplayMode" NOT NULL DEFAULT 'SINGLE_LINE';

-- AlterTable Calculation
ALTER TABLE "Calculation" ADD COLUMN "fixedPriceDisplayMode" "FixedPriceDisplayMode" NOT NULL DEFAULT 'SINGLE_LINE';
