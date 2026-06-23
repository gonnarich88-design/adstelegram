-- CreateTable
CREATE TABLE "DailyConversionBreakdown" (
    "id" TEXT NOT NULL,
    "conversionId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "registrations" INTEGER NOT NULL DEFAULT 0,
    "depositCount" INTEGER NOT NULL DEFAULT 0,
    "depositTxCount" INTEGER NOT NULL DEFAULT 0,
    "depositAmountThb" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyConversionBreakdown_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyConversionBreakdown_conversionId_idx" ON "DailyConversionBreakdown"("conversionId");

-- CreateIndex
CREATE INDEX "DailyConversionBreakdown_campaignId_idx" ON "DailyConversionBreakdown"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyConversionBreakdown_conversionId_campaignId_key" ON "DailyConversionBreakdown"("conversionId", "campaignId");

-- AddForeignKey
ALTER TABLE "DailyConversionBreakdown" ADD CONSTRAINT "DailyConversionBreakdown_conversionId_fkey" FOREIGN KEY ("conversionId") REFERENCES "DailyConversion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyConversionBreakdown" ADD CONSTRAINT "DailyConversionBreakdown_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
