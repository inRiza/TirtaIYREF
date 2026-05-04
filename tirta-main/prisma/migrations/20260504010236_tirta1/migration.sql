-- CreateEnum
CREATE TYPE "ZoneRiskLevel" AS ENUM ('SANGAT_RAWAN', 'RAWAN', 'TIDAK_RAWAN', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DrainageQuality" AS ENUM ('BAIK', 'SEDANG', 'BURUK', 'TIDAK_ADA');

-- CreateEnum
CREATE TYPE "GarbageCategory" AS ENUM ('RINGAN', 'SEDANG', 'BANYAK');

-- CreateEnum
CREATE TYPE "RoadType" AS ENUM ('ASPAL', 'BETON', 'PAVING', 'TANAH', 'LAINNYA');

-- CreateEnum
CREATE TYPE "VegetationDensity" AS ENUM ('RINGAN', 'SEDANG', 'BANYAK', 'TIDAK_ADA');

-- CreateEnum
CREATE TYPE "PhotoCategory" AS ENUM ('DRAINAGE', 'VEGETATION', 'ROAD', 'GENERAL');

-- CreateEnum
CREATE TYPE "RiskCategory" AS ENUM ('TINGGI', 'SEDANG', 'RENDAH');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "photoURL" TEXT,
    "firebaseUID" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FloodZone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "boundary" JSONB NOT NULL,
    "centerLat" DOUBLE PRECISION NOT NULL,
    "centerLng" DOUBLE PRECISION NOT NULL,
    "riskCategory" "ZoneRiskLevel" NOT NULL DEFAULT 'UNKNOWN',
    "lastPredictedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FloodZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FloodAreaHistory" (
    "id" TEXT NOT NULL,
    "areaName" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "areaM2" DOUBLE PRECISION NOT NULL,
    "totalIncidents" INTEGER NOT NULL,
    "source" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FloodAreaHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "zoneId" TEXT,
    "title" TEXT,
    "description" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "address" TEXT,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "drainageQuality" "DrainageQuality",
    "garbageCategory" "GarbageCategory",
    "roadType" "RoadType",
    "vegetationDensity" "VegetationDensity",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportFloodHistory" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportFloodHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportPhoto" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "photoURL" TEXT NOT NULL,
    "category" "PhotoCategory" NOT NULL DEFAULT 'GENERAL',
    "description" TEXT,
    "detectedObjects" JSONB,
    "measuredLengthM" DOUBLE PRECISION,
    "hasVegetation" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportAnalysis" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "surfaceType" TEXT,
    "drainageStatus" TEXT,
    "cleanliness" TEXT,
    "vegetation" TEXT,
    "drainageLengthM" DOUBLE PRECISION,
    "vegetationLengthM" DOUBLE PRECISION,
    "zoneIncidentCount" INTEGER,
    "floodRiskScore" DOUBLE PRECISION NOT NULL,
    "riskLevel" "ZoneRiskLevel" NOT NULL,
    "categoryLevel" "RiskCategory" NOT NULL,
    "recommendation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_firebaseUID_key" ON "User"("firebaseUID");

-- CreateIndex
CREATE INDEX "FloodAreaHistory_latitude_longitude_idx" ON "FloodAreaHistory"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "UserReport_latitude_longitude_idx" ON "UserReport"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "UserReport_userId_idx" ON "UserReport"("userId");

-- CreateIndex
CREATE INDEX "UserReport_zoneId_idx" ON "UserReport"("zoneId");

-- CreateIndex
CREATE INDEX "UserReport_reportedAt_idx" ON "UserReport"("reportedAt");

-- CreateIndex
CREATE INDEX "ReportFloodHistory_reportId_idx" ON "ReportFloodHistory"("reportId");

-- CreateIndex
CREATE INDEX "ReportPhoto_reportId_idx" ON "ReportPhoto"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportAnalysis_reportId_key" ON "ReportAnalysis"("reportId");

-- AddForeignKey
ALTER TABLE "UserReport" ADD CONSTRAINT "UserReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserReport" ADD CONSTRAINT "UserReport_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "FloodZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportFloodHistory" ADD CONSTRAINT "ReportFloodHistory_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "UserReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportPhoto" ADD CONSTRAINT "ReportPhoto_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "UserReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportAnalysis" ADD CONSTRAINT "ReportAnalysis_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "UserReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
