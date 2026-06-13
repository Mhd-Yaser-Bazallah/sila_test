ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'INSTALLER';

CREATE TYPE "InstallationUnitStatus" AS ENUM (
  'PENDING_CREATIVE',
  'READY_FOR_ASSIGNMENT',
  'ASSIGNED',
  'IN_PROGRESS',
  'SUBMITTED',
  'REVISION_REQUIRED',
  'APPROVED',
  'CANCELLED'
);

CREATE TYPE "InstallationAssignmentStatus" AS ENUM (
  'ASSIGNED',
  'IN_PROGRESS',
  'SUBMITTED',
  'REVISION_REQUIRED',
  'APPROVED',
  'CANCELLED'
);

CREATE TYPE "InstallationEvidenceType" AS ENUM (
  'IMAGE',
  'FILE'
);

CREATE TABLE "BillboardInstallationUnit" (
  "id" UUID NOT NULL,
  "bookingRequestItemId" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "billboardId" UUID NOT NULL,
  "status" "InstallationUnitStatus" NOT NULL DEFAULT 'PENDING_CREATIVE',
  "creativeImageUrl" TEXT,
  "creativeFileUrl" TEXT,
  "customerNotes" TEXT,
  "companyNotes" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "BillboardInstallationUnit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillboardInstallationAssignment" (
  "id" UUID NOT NULL,
  "installationUnitId" UUID NOT NULL,
  "installerId" UUID NOT NULL,
  "assignedByUserId" UUID NOT NULL,
  "status" "InstallationAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
  "notes" TEXT,
  "startedAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "revisionRequestedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BillboardInstallationAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillboardInstallationEvidence" (
  "id" UUID NOT NULL,
  "assignmentId" UUID NOT NULL,
  "uploadedByUserId" UUID NOT NULL,
  "url" TEXT NOT NULL,
  "type" "InstallationEvidenceType" NOT NULL DEFAULT 'IMAGE',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BillboardInstallationEvidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillboardInstallationUnit_bookingRequestItemId_billboardId_key" ON "BillboardInstallationUnit"("bookingRequestItemId", "billboardId");
CREATE INDEX "BillboardInstallationUnit_bookingRequestItemId_idx" ON "BillboardInstallationUnit"("bookingRequestItemId");
CREATE INDEX "BillboardInstallationUnit_companyId_idx" ON "BillboardInstallationUnit"("companyId");
CREATE INDEX "BillboardInstallationUnit_billboardId_idx" ON "BillboardInstallationUnit"("billboardId");
CREATE INDEX "BillboardInstallationUnit_status_idx" ON "BillboardInstallationUnit"("status");

CREATE UNIQUE INDEX "BillboardInstallationAssignment_installationUnitId_installerId_key" ON "BillboardInstallationAssignment"("installationUnitId", "installerId");
CREATE INDEX "BillboardInstallationAssignment_installationUnitId_idx" ON "BillboardInstallationAssignment"("installationUnitId");
CREATE INDEX "BillboardInstallationAssignment_installerId_idx" ON "BillboardInstallationAssignment"("installerId");
CREATE INDEX "BillboardInstallationAssignment_status_idx" ON "BillboardInstallationAssignment"("status");

CREATE INDEX "BillboardInstallationEvidence_assignmentId_idx" ON "BillboardInstallationEvidence"("assignmentId");
CREATE INDEX "BillboardInstallationEvidence_uploadedByUserId_idx" ON "BillboardInstallationEvidence"("uploadedByUserId");

ALTER TABLE "BillboardInstallationUnit" ADD CONSTRAINT "BillboardInstallationUnit_bookingRequestItemId_fkey" FOREIGN KEY ("bookingRequestItemId") REFERENCES "BookingRequestItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BillboardInstallationUnit" ADD CONSTRAINT "BillboardInstallationUnit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillboardInstallationUnit" ADD CONSTRAINT "BillboardInstallationUnit_billboardId_fkey" FOREIGN KEY ("billboardId") REFERENCES "Billboard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BillboardInstallationAssignment" ADD CONSTRAINT "BillboardInstallationAssignment_installationUnitId_fkey" FOREIGN KEY ("installationUnitId") REFERENCES "BillboardInstallationUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BillboardInstallationAssignment" ADD CONSTRAINT "BillboardInstallationAssignment_installerId_fkey" FOREIGN KEY ("installerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillboardInstallationAssignment" ADD CONSTRAINT "BillboardInstallationAssignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BillboardInstallationEvidence" ADD CONSTRAINT "BillboardInstallationEvidence_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "BillboardInstallationAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BillboardInstallationEvidence" ADD CONSTRAINT "BillboardInstallationEvidence_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
