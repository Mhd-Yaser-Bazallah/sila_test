-- CreateEnum
CREATE TYPE "ExhibitionBookingRequestStatus" AS ENUM ('PENDING_REVIEW', 'PARTIALLY_APPROVED', 'APPROVED', 'PARTIALLY_REJECTED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExhibitionBookingItemStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ExhibitionBookingRequest" (
    "id" UUID NOT NULL,
    "exhibitionId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "customerFullName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerCompany" TEXT,
    "customerNotes" TEXT,
    "customerCompanyScope" "CustomerCompanyScope",
    "customerSector" "CustomerSector",
    "subtotalBeforeTax" DECIMAL(12,2),
    "totalTaxAmount" DECIMAL(12,2),
    "totalAfterTax" DECIMAL(12,2),
    "status" "ExhibitionBookingRequestStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ExhibitionBookingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExhibitionBookingItem" (
    "id" UUID NOT NULL,
    "bookingRequestId" UUID NOT NULL,
    "boothId" UUID NOT NULL,
    "status" "ExhibitionBookingItemStatus" NOT NULL DEFAULT 'PENDING',
    "priceSnapshot" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "partnerNotes" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExhibitionBookingItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExhibitionBookingRequest_exhibitionId_idx" ON "ExhibitionBookingRequest"("exhibitionId");

-- CreateIndex
CREATE INDEX "ExhibitionBookingRequest_companyId_idx" ON "ExhibitionBookingRequest"("companyId");

-- CreateIndex
CREATE INDEX "ExhibitionBookingRequest_customerId_idx" ON "ExhibitionBookingRequest"("customerId");

-- CreateIndex
CREATE INDEX "ExhibitionBookingRequest_status_idx" ON "ExhibitionBookingRequest"("status");

-- CreateIndex
CREATE INDEX "ExhibitionBookingItem_bookingRequestId_idx" ON "ExhibitionBookingItem"("bookingRequestId");

-- CreateIndex
CREATE INDEX "ExhibitionBookingItem_boothId_idx" ON "ExhibitionBookingItem"("boothId");

-- CreateIndex
CREATE INDEX "ExhibitionBookingItem_status_idx" ON "ExhibitionBookingItem"("status");

-- AddForeignKey
ALTER TABLE "ExhibitionBookingRequest" ADD CONSTRAINT "ExhibitionBookingRequest_exhibitionId_fkey" FOREIGN KEY ("exhibitionId") REFERENCES "Exhibition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExhibitionBookingRequest" ADD CONSTRAINT "ExhibitionBookingRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExhibitionBookingRequest" ADD CONSTRAINT "ExhibitionBookingRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExhibitionBookingItem" ADD CONSTRAINT "ExhibitionBookingItem_bookingRequestId_fkey" FOREIGN KEY ("bookingRequestId") REFERENCES "ExhibitionBookingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExhibitionBookingItem" ADD CONSTRAINT "ExhibitionBookingItem_boothId_fkey" FOREIGN KEY ("boothId") REFERENCES "ExhibitionBooth"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
