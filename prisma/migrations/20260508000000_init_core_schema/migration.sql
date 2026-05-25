-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'COMPANY_ADMIN', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('BILLBOARDS', 'FREELANCERS', 'MARKETING', 'EXHIBITIONS');

-- CreateEnum
CREATE TYPE "ServiceSubscriptionStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "BillboardStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BillboardType" AS ENUM ('DIGITAL', 'PRINTED');

-- CreateEnum
CREATE TYPE "PricingUnit" AS ENUM ('DAY', 'WEEK', 'MONTH', 'CUSTOM');

-- CreateEnum
CREATE TYPE "BookingRequestStatus" AS ENUM ('PENDING', 'CONTACTED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "companyId" UUID,
    "refreshTokenHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "status" "CompanyStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyServiceSubscription" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "status" "ServiceSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyServiceSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Billboard" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "country" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "addressText" TEXT,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "width" DECIMAL(10,2),
    "height" DECIMAL(10,2),
    "type" "BillboardType" NOT NULL,
    "hasLighting" BOOLEAN NOT NULL DEFAULT false,
    "price" DECIMAL(12,2),
    "pricingUnit" "PricingUnit" NOT NULL DEFAULT 'MONTH',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "BillboardStatus" NOT NULL DEFAULT 'DRAFT',
    "rejectionReason" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Billboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillboardMedia" (
    "id" UUID NOT NULL,
    "billboardId" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "type" "MediaType" NOT NULL DEFAULT 'IMAGE',
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillboardMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillboardUnavailablePeriod" (
    "id" UUID NOT NULL,
    "billboardId" UUID NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillboardUnavailablePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingRequest" (
    "id" UUID NOT NULL,
    "billboardId" UUID NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "customerFullName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerCompany" TEXT,
    "customerNotes" TEXT,
    "estimatedPrice" DECIMAL(12,2),
    "pricingUnit" "PricingUnit" NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "BookingRequestStatus" NOT NULL DEFAULT 'PENDING',
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BookingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_companyId_idx" ON "User"("companyId");

-- CreateIndex
CREATE INDEX "Company_status_idx" ON "Company"("status");

-- CreateIndex
CREATE INDEX "CompanyServiceSubscription_companyId_idx" ON "CompanyServiceSubscription"("companyId");

-- CreateIndex
CREATE INDEX "CompanyServiceSubscription_serviceType_idx" ON "CompanyServiceSubscription"("serviceType");

-- CreateIndex
CREATE INDEX "CompanyServiceSubscription_status_idx" ON "CompanyServiceSubscription"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyServiceSubscription_companyId_serviceType_key" ON "CompanyServiceSubscription"("companyId", "serviceType");

-- CreateIndex
CREATE INDEX "Billboard_companyId_idx" ON "Billboard"("companyId");

-- CreateIndex
CREATE INDEX "Billboard_status_idx" ON "Billboard"("status");

-- CreateIndex
CREATE INDEX "Billboard_city_idx" ON "Billboard"("city");

-- CreateIndex
CREATE INDEX "Billboard_type_idx" ON "Billboard"("type");

-- CreateIndex
CREATE INDEX "Billboard_latitude_longitude_idx" ON "Billboard"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "BillboardMedia_billboardId_idx" ON "BillboardMedia"("billboardId");

-- CreateIndex
CREATE INDEX "BillboardMedia_billboardId_isMain_idx" ON "BillboardMedia"("billboardId", "isMain");

-- CreateIndex
CREATE INDEX "BillboardUnavailablePeriod_billboardId_idx" ON "BillboardUnavailablePeriod"("billboardId");

-- CreateIndex
CREATE INDEX "BillboardUnavailablePeriod_billboardId_startDate_endDate_idx" ON "BillboardUnavailablePeriod"("billboardId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "BookingRequest_billboardId_idx" ON "BookingRequest"("billboardId");

-- CreateIndex
CREATE INDEX "BookingRequest_status_idx" ON "BookingRequest"("status");

-- CreateIndex
CREATE INDEX "BookingRequest_startDate_endDate_idx" ON "BookingRequest"("startDate", "endDate");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyServiceSubscription" ADD CONSTRAINT "CompanyServiceSubscription_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Billboard" ADD CONSTRAINT "Billboard_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillboardMedia" ADD CONSTRAINT "BillboardMedia_billboardId_fkey" FOREIGN KEY ("billboardId") REFERENCES "Billboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillboardUnavailablePeriod" ADD CONSTRAINT "BillboardUnavailablePeriod_billboardId_fkey" FOREIGN KEY ("billboardId") REFERENCES "Billboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_billboardId_fkey" FOREIGN KEY ("billboardId") REFERENCES "Billboard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
