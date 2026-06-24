-- AlterTable
ALTER TABLE "ExhibitionSector" ADD COLUMN "color" TEXT,
ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ExhibitionSector_deletedAt_idx" ON "ExhibitionSector"("deletedAt");

-- CreateIndex
CREATE INDEX "ExhibitionSector_exhibitionId_deletedAt_idx" ON "ExhibitionSector"("exhibitionId", "deletedAt");
