-- AlterTable
ALTER TABLE "BookingRequest" ADD COLUMN "commercialRegistryUrl" TEXT;

-- AlterTable
ALTER TABLE "Company" ADD COLUMN "logoUrl" TEXT;

-- AlterTable
ALTER TABLE "ExhibitionBookingRequest" ADD COLUMN "commercialRegistryUrl" TEXT;

-- CreateTable
CREATE TABLE "BookingItemCreative" (
    "id" UUID NOT NULL,
    "bookingRequestId" UUID NOT NULL,
    "bookingRequestItemId" UUID,
    "billboardId" UUID NOT NULL,
    "creativeImageUrl" TEXT,
    "creativeFileUrl" TEXT,
    "customerNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingItemCreative_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BookingItemCreative_bookingRequestId_billboardId_key" ON "BookingItemCreative"("bookingRequestId", "billboardId");

-- CreateIndex
CREATE INDEX "BookingItemCreative_bookingRequestId_idx" ON "BookingItemCreative"("bookingRequestId");

-- CreateIndex
CREATE INDEX "BookingItemCreative_bookingRequestItemId_idx" ON "BookingItemCreative"("bookingRequestItemId");

-- CreateIndex
CREATE INDEX "BookingItemCreative_billboardId_idx" ON "BookingItemCreative"("billboardId");

-- AddForeignKey
ALTER TABLE "BookingItemCreative" ADD CONSTRAINT "BookingItemCreative_bookingRequestId_fkey" FOREIGN KEY ("bookingRequestId") REFERENCES "BookingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingItemCreative" ADD CONSTRAINT "BookingItemCreative_bookingRequestItemId_fkey" FOREIGN KEY ("bookingRequestItemId") REFERENCES "BookingRequestItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingItemCreative" ADD CONSTRAINT "BookingItemCreative_billboardId_fkey" FOREIGN KEY ("billboardId") REFERENCES "Billboard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
