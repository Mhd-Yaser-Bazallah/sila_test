ALTER TABLE "BookingRequest" ALTER COLUMN "status" DROP DEFAULT;

CREATE TYPE "BookingRequestStatus_new" AS ENUM (
  'PENDING_REVIEW',
  'PARTIALLY_APPROVED',
  'APPROVED',
  'PARTIALLY_REJECTED',
  'REJECTED',
  'CANCELLED'
);

ALTER TABLE "BookingRequest"
ALTER COLUMN "status" TYPE "BookingRequestStatus_new"
USING (
  CASE
    WHEN "status"::text IN ('PENDING', 'CONTACTED') THEN 'PENDING_REVIEW'
    ELSE "status"::text
  END::"BookingRequestStatus_new"
);

ALTER TYPE "BookingRequestStatus" RENAME TO "BookingRequestStatus_old";
ALTER TYPE "BookingRequestStatus_new" RENAME TO "BookingRequestStatus";
DROP TYPE "BookingRequestStatus_old";

ALTER TABLE "BookingRequest" ALTER COLUMN "status" SET DEFAULT 'PENDING_REVIEW';

-- Legacy single-billboard fields stay available but are nullable for grouped bookings.
ALTER TABLE "BookingRequest" ALTER COLUMN "billboardId" DROP NOT NULL;
ALTER TABLE "BookingRequest" ALTER COLUMN "pricingUnit" DROP NOT NULL;
ALTER TABLE "BookingRequest" ALTER COLUMN "currency" DROP NOT NULL;
