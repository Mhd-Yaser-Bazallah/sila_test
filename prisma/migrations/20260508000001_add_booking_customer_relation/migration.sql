-- AlterTable
ALTER TABLE "BookingRequest" ADD COLUMN "customerId" UUID NOT NULL;

-- CreateIndex
CREATE INDEX "BookingRequest_customerId_idx" ON "BookingRequest"("customerId");

-- AddForeignKey
ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
