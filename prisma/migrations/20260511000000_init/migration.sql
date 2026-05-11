-- CreateEnum
CREATE TYPE "TargetType" AS ENUM ('CHANNEL', 'BOT');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DONE');

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetType" "TargetType" NOT NULL,
    "targetName" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "budgetTon" DECIMAL(18,8) NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceEntry" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "spendTon" DECIMAL(18,8) NOT NULL,
    "dailyBudgetTon" DECIMAL(18,8) NOT NULL,
    "tonPriceUsd" DECIMAL(18,8) NOT NULL,
    "usdThbRate" DECIMAL(18,8) NOT NULL,
    "impressions" INTEGER NOT NULL,
    "views" INTEGER NOT NULL,
    "clicks" INTEGER NOT NULL,
    "joins" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerformanceEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PerformanceEntry_campaignId_idx" ON "PerformanceEntry"("campaignId");

-- CreateIndex
CREATE INDEX "PerformanceEntry_campaignId_date_idx" ON "PerformanceEntry"("campaignId", "date");

-- AddForeignKey
ALTER TABLE "PerformanceEntry" ADD CONSTRAINT "PerformanceEntry_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
