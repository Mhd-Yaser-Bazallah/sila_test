ALTER TABLE "Billboard"
  ADD COLUMN "localFlexPrice" DECIMAL(12,2),
  ADD COLUMN "internationalFlexPrice" DECIMAL(12,2),
  ADD COLUMN "localStandardAddedValue" DECIMAL(12,2),
  ADD COLUMN "internationalStandardAddedValue" DECIMAL(12,2);

ALTER TABLE "ExhibitionBooth"
  ADD COLUMN "setupPrice" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "ExhibitionBookingItem"
  ADD COLUMN "setupPriceSnapshot" DECIMAL(12,2);
