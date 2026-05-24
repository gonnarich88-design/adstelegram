-- DropTable
DROP TABLE "AppSettings";

-- CreateTable
CREATE TABLE "WalletDeposit" (
    "id" TEXT NOT NULL,
    "amountTon" DECIMAL(18,8) NOT NULL,
    "tonPriceUsd" DECIMAL(18,8) NOT NULL,
    "usdThbRate" DECIMAL(18,8) NOT NULL,
    "depositedAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletDeposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignAllocation" (
    "id" TEXT NOT NULL,
    "depositId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "amountTon" DECIMAL(18,8) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CampaignAllocation_campaignId_key" ON "CampaignAllocation"("campaignId");

-- AddForeignKey
ALTER TABLE "CampaignAllocation" ADD CONSTRAINT "CampaignAllocation_depositId_fkey" FOREIGN KEY ("depositId") REFERENCES "WalletDeposit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignAllocation" ADD CONSTRAINT "CampaignAllocation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
