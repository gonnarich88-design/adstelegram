-- CreateTable
CREATE TABLE "CampaignChangeLog" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "note" TEXT,

    CONSTRAINT "CampaignChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampaignChangeLog_campaignId_idx" ON "CampaignChangeLog"("campaignId");

-- AddForeignKey
ALTER TABLE "CampaignChangeLog" ADD CONSTRAINT "CampaignChangeLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
