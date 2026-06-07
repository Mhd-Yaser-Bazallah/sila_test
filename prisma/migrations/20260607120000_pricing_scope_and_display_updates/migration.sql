ALTER TABLE "Billboard"
  ADD COLUMN "localPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "internationalPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "displayDurationSeconds" INTEGER;

UPDATE "Billboard"
SET
  "localPrice" = COALESCE("price", 0),
  "internationalPrice" = COALESCE("price", 0);

ALTER TABLE "ExhibitionBooth"
  ADD COLUMN "localPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "internationalPrice" DECIMAL(12,2) NOT NULL DEFAULT 0;

UPDATE "ExhibitionBooth"
SET
  "localPrice" = COALESCE("price", 0),
  "internationalPrice" = COALESCE("price", 0);

ALTER TABLE "Offer"
  ADD COLUMN "localOriginalTotalPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "internationalOriginalTotalPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "localDiscountedTotalPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "internationalDiscountedTotalPrice" DECIMAL(12,2) NOT NULL DEFAULT 0;

UPDATE "Offer"
SET
  "localOriginalTotalPrice" = "originalTotalPrice",
  "internationalOriginalTotalPrice" = "originalTotalPrice",
  "localDiscountedTotalPrice" = "discountedTotalPrice",
  "internationalDiscountedTotalPrice" = "discountedTotalPrice";

ALTER TABLE "OfferItem"
  ADD COLUMN "localPriceSnapshot" DECIMAL(12,2),
  ADD COLUMN "internationalPriceSnapshot" DECIMAL(12,2);

UPDATE "OfferItem"
SET
  "localPriceSnapshot" = "priceSnapshot",
  "internationalPriceSnapshot" = "priceSnapshot";

ALTER TABLE "BookingRequestItem"
  ADD COLUMN "selectedCustomerCompanyScope" "CustomerCompanyScope",
  ADD COLUMN "localPriceSnapshot" DECIMAL(12,2),
  ADD COLUMN "internationalPriceSnapshot" DECIMAL(12,2);

UPDATE "BookingRequestItem"
SET
  "localPriceSnapshot" = "priceSnapshot",
  "internationalPriceSnapshot" = "priceSnapshot";

ALTER TABLE "ExhibitionBookingItem"
  ADD COLUMN "localPriceSnapshot" DECIMAL(12,2),
  ADD COLUMN "internationalPriceSnapshot" DECIMAL(12,2);

UPDATE "ExhibitionBookingItem"
SET
  "localPriceSnapshot" = "priceSnapshot",
  "internationalPriceSnapshot" = "priceSnapshot";

ALTER TABLE "Exhibition"
  ADD COLUMN "secondaryHeroImageUrl" TEXT;
