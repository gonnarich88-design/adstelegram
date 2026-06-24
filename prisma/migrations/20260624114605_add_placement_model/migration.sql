-- CreateTable
CREATE TABLE "Placement" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PlacementType",
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Placement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignPlacement" (
    "campaignId" TEXT NOT NULL,
    "placementId" TEXT NOT NULL,

    CONSTRAINT "CampaignPlacement_pkey" PRIMARY KEY ("campaignId","placementId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Placement_name_key" ON "Placement"("name");

-- CreateIndex
CREATE INDEX "CampaignPlacement_placementId_idx" ON "CampaignPlacement"("placementId");

-- AddForeignKey
ALTER TABLE "CampaignPlacement" ADD CONSTRAINT "CampaignPlacement_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignPlacement" ADD CONSTRAINT "CampaignPlacement_placementId_fkey" FOREIGN KEY ("placementId") REFERENCES "Placement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
