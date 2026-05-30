-- CreateEnum
CREATE TYPE "ExhibitionStatus" AS ENUM ('DRAFT', 'MAP_IN_PROGRESS', 'MAP_CONFIRMED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ExhibitionBoothStatus" AS ENUM ('AVAILABLE', 'BOOKED', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "ExhibitionMapShape" AS ENUM ('RECTANGLE', 'POLYGON');

-- CreateTable
CREATE TABLE "Exhibition" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "heroImageUrl" TEXT,
    "visitorCount" INTEGER,
    "participantCount" INTEGER,
    "participationDays" INTEGER,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "venueName" TEXT,
    "country" TEXT,
    "province" TEXT,
    "city" TEXT,
    "addressText" TEXT,
    "status" "ExhibitionStatus" NOT NULL DEFAULT 'DRAFT',
    "rejectionReason" TEXT,
    "approvedAt" TIMESTAMP(3),
    "mapImageUrl" TEXT,
    "mapPdfUrl" TEXT,
    "mapConfirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Exhibition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExhibitionAboutCard" (
    "id" UUID NOT NULL,
    "exhibitionId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExhibitionAboutCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExhibitionSector" (
    "id" UUID NOT NULL,
    "exhibitionId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT,
    "imageUrl" TEXT,
    "bullets" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExhibitionSector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExhibitionParticipationFeature" (
    "id" UUID NOT NULL,
    "exhibitionId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExhibitionParticipationFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExhibitionBooth" (
    "id" UUID NOT NULL,
    "exhibitionId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "ExhibitionBoothStatus" NOT NULL DEFAULT 'AVAILABLE',
    "shape" "ExhibitionMapShape" NOT NULL,
    "coordinates" JSONB NOT NULL,
    "color" TEXT,
    "area" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ExhibitionBooth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Exhibition_slug_key" ON "Exhibition"("slug");

-- CreateIndex
CREATE INDEX "Exhibition_companyId_idx" ON "Exhibition"("companyId");

-- CreateIndex
CREATE INDEX "Exhibition_status_idx" ON "Exhibition"("status");

-- CreateIndex
CREATE INDEX "Exhibition_slug_idx" ON "Exhibition"("slug");

-- CreateIndex
CREATE INDEX "Exhibition_city_idx" ON "Exhibition"("city");

-- CreateIndex
CREATE INDEX "Exhibition_startsAt_endsAt_idx" ON "Exhibition"("startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "ExhibitionAboutCard_exhibitionId_idx" ON "ExhibitionAboutCard"("exhibitionId");

-- CreateIndex
CREATE INDEX "ExhibitionSector_exhibitionId_idx" ON "ExhibitionSector"("exhibitionId");

-- CreateIndex
CREATE INDEX "ExhibitionParticipationFeature_exhibitionId_idx" ON "ExhibitionParticipationFeature"("exhibitionId");

-- CreateIndex
CREATE INDEX "ExhibitionBooth_exhibitionId_idx" ON "ExhibitionBooth"("exhibitionId");

-- CreateIndex
CREATE INDEX "ExhibitionBooth_status_idx" ON "ExhibitionBooth"("status");

-- CreateIndex
CREATE INDEX "ExhibitionBooth_exhibitionId_code_idx" ON "ExhibitionBooth"("exhibitionId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ExhibitionBooth_exhibitionId_code_key" ON "ExhibitionBooth"("exhibitionId", "code");

-- AddForeignKey
ALTER TABLE "Exhibition" ADD CONSTRAINT "Exhibition_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExhibitionAboutCard" ADD CONSTRAINT "ExhibitionAboutCard_exhibitionId_fkey" FOREIGN KEY ("exhibitionId") REFERENCES "Exhibition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExhibitionSector" ADD CONSTRAINT "ExhibitionSector_exhibitionId_fkey" FOREIGN KEY ("exhibitionId") REFERENCES "Exhibition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExhibitionParticipationFeature" ADD CONSTRAINT "ExhibitionParticipationFeature_exhibitionId_fkey" FOREIGN KEY ("exhibitionId") REFERENCES "Exhibition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExhibitionBooth" ADD CONSTRAINT "ExhibitionBooth_exhibitionId_fkey" FOREIGN KEY ("exhibitionId") REFERENCES "Exhibition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
