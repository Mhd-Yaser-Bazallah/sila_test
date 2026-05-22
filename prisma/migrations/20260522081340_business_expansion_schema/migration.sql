-- CreateEnum
CREATE TYPE "PrintedSubtype" AS ENUM ('FLEX', 'STANDARD');

-- CreateEnum
CREATE TYPE "BillboardDirection" AS ENUM ('GOING', 'RETURNING', 'BOTH', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CustomerCompanyScope" AS ENUM ('LOCAL', 'INTERNATIONAL');

-- CreateEnum
CREATE TYPE "CustomerSector" AS ENUM ('PRIVATE', 'PUBLIC');

-- CreateEnum
CREATE TYPE "BookingRequestItemStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BookingItemType" AS ENUM ('BILLBOARD', 'ROAD_PACKAGE', 'OFFER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BillboardType" ADD VALUE 'CAR_AD';
ALTER TYPE "BillboardType" ADD VALUE 'THREE_D';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PricingUnit" ADD VALUE 'HOUR';
ALTER TYPE "PricingUnit" ADD VALUE 'YEAR';

-- AlterTable
ALTER TABLE "Billboard" ADD COLUMN     "direction" "BillboardDirection" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "isPackageOnly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lightingPrice" DECIMAL(12,2),
ADD COLUMN     "printedSubtype" "PrintedSubtype",
ADD COLUMN     "roadPackageId" UUID,
ADD COLUMN     "taxRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "BookingRequest" ADD COLUMN     "customerCompanyScope" "CustomerCompanyScope",
ADD COLUMN     "customerSector" "CustomerSector",
ADD COLUMN     "subtotalBeforeTax" DECIMAL(12,2),
ADD COLUMN     "totalAfterDiscount" DECIMAL(12,2),
ADD COLUMN     "totalAfterTax" DECIMAL(12,2),
ADD COLUMN     "totalBeforeDiscount" DECIMAL(12,2),
ADD COLUMN     "totalTaxAmount" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "RoadBillboardPackage" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startLatitude" DECIMAL(10,7) NOT NULL,
    "startLongitude" DECIMAL(10,7) NOT NULL,
    "endLatitude" DECIMAL(10,7) NOT NULL,
    "endLongitude" DECIMAL(10,7) NOT NULL,
    "billboardsCount" INTEGER NOT NULL,
    "distanceBetweenBoards" DECIMAL(10,2),
    "direction" "BillboardDirection" NOT NULL,
    "status" "BillboardStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "RoadBillboardPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "originalTotalPrice" DECIMAL(12,2) NOT NULL,
    "discountedTotalPrice" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "BillboardStatus" NOT NULL DEFAULT 'DRAFT',
    "rejectionReason" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferItem" (
    "id" UUID NOT NULL,
    "offerId" UUID NOT NULL,
    "billboardId" UUID NOT NULL,
    "priceSnapshot" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfferItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingRequestItem" (
    "id" UUID NOT NULL,
    "bookingRequestId" UUID NOT NULL,
    "billboardId" UUID,
    "roadPackageId" UUID,
    "offerId" UUID,
    "companyId" UUID NOT NULL,
    "itemType" "BookingItemType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "BookingRequestItemStatus" NOT NULL DEFAULT 'PENDING',
    "priceSnapshot" DECIMAL(12,2),
    "pricingUnit" "PricingUnit" NOT NULL,
    "currency" TEXT NOT NULL,
    "taxRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2),
    "totalBeforeTax" DECIMAL(12,2),
    "totalAfterTax" DECIMAL(12,2),
    "discountAmount" DECIMAL(12,2),
    "partnerNotes" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoadBillboardPackage_companyId_idx" ON "RoadBillboardPackage"("companyId");

-- CreateIndex
CREATE INDEX "RoadBillboardPackage_status_idx" ON "RoadBillboardPackage"("status");

-- CreateIndex
CREATE INDEX "RoadBillboardPackage_direction_idx" ON "RoadBillboardPackage"("direction");

-- CreateIndex
CREATE INDEX "Offer_companyId_idx" ON "Offer"("companyId");

-- CreateIndex
CREATE INDEX "Offer_status_idx" ON "Offer"("status");

-- CreateIndex
CREATE INDEX "OfferItem_offerId_idx" ON "OfferItem"("offerId");

-- CreateIndex
CREATE INDEX "OfferItem_billboardId_idx" ON "OfferItem"("billboardId");

-- CreateIndex
CREATE UNIQUE INDEX "OfferItem_offerId_billboardId_key" ON "OfferItem"("offerId", "billboardId");

-- CreateIndex
CREATE INDEX "BookingRequestItem_bookingRequestId_idx" ON "BookingRequestItem"("bookingRequestId");

-- CreateIndex
CREATE INDEX "BookingRequestItem_companyId_idx" ON "BookingRequestItem"("companyId");

-- CreateIndex
CREATE INDEX "BookingRequestItem_billboardId_idx" ON "BookingRequestItem"("billboardId");

-- CreateIndex
CREATE INDEX "BookingRequestItem_roadPackageId_idx" ON "BookingRequestItem"("roadPackageId");

-- CreateIndex
CREATE INDEX "BookingRequestItem_offerId_idx" ON "BookingRequestItem"("offerId");

-- CreateIndex
CREATE INDEX "BookingRequestItem_status_idx" ON "BookingRequestItem"("status");

-- CreateIndex
CREATE INDEX "BookingRequestItem_startDate_endDate_idx" ON "BookingRequestItem"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "Billboard_status_city_type_pricingUnit_idx" ON "Billboard"("status", "city", "type", "pricingUnit");

-- CreateIndex
CREATE INDEX "Billboard_roadPackageId_idx" ON "Billboard"("roadPackageId");

-- CreateIndex
CREATE INDEX "Billboard_direction_idx" ON "Billboard"("direction");

-- AddForeignKey
ALTER TABLE "Billboard" ADD CONSTRAINT "Billboard_roadPackageId_fkey" FOREIGN KEY ("roadPackageId") REFERENCES "RoadBillboardPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadBillboardPackage" ADD CONSTRAINT "RoadBillboardPackage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferItem" ADD CONSTRAINT "OfferItem_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferItem" ADD CONSTRAINT "OfferItem_billboardId_fkey" FOREIGN KEY ("billboardId") REFERENCES "Billboard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRequestItem" ADD CONSTRAINT "BookingRequestItem_bookingRequestId_fkey" FOREIGN KEY ("bookingRequestId") REFERENCES "BookingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRequestItem" ADD CONSTRAINT "BookingRequestItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRequestItem" ADD CONSTRAINT "BookingRequestItem_billboardId_fkey" FOREIGN KEY ("billboardId") REFERENCES "Billboard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRequestItem" ADD CONSTRAINT "BookingRequestItem_roadPackageId_fkey" FOREIGN KEY ("roadPackageId") REFERENCES "RoadBillboardPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRequestItem" ADD CONSTRAINT "BookingRequestItem_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
