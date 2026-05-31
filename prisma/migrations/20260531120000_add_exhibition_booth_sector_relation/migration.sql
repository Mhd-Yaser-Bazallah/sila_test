-- AlterTable
ALTER TABLE "ExhibitionBooth" ADD COLUMN "sectorId" UUID;

-- CreateIndex
CREATE INDEX "ExhibitionBooth_sectorId_idx" ON "ExhibitionBooth"("sectorId");

-- AddForeignKey
ALTER TABLE "ExhibitionBooth" ADD CONSTRAINT "ExhibitionBooth_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "ExhibitionSector"("id") ON DELETE SET NULL ON UPDATE CASCADE;
