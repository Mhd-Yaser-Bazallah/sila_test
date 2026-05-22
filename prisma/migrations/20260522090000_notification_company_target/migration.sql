ALTER TABLE "Notification" ADD COLUMN "companyId" UUID;

CREATE INDEX "Notification_companyId_idx" ON "Notification"("companyId");

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
