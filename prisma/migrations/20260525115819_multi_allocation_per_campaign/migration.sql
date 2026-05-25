-- DropIndex
DROP INDEX "CampaignAllocation_campaignId_key";

-- CreateIndex
CREATE INDEX "CampaignAllocation_campaignId_idx" ON "CampaignAllocation"("campaignId");
