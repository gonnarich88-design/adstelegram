/*
  Warnings:

  - You are about to drop the column `campaignScope` on the `GlobalGoalEntry` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "GlobalGoalEntry" DROP COLUMN "campaignScope";

-- CreateTable
CREATE TABLE "GlobalGoalEntryCampaign" (
    "entryId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,

    CONSTRAINT "GlobalGoalEntryCampaign_pkey" PRIMARY KEY ("entryId","campaignId")
);

-- AddForeignKey
ALTER TABLE "GlobalGoalEntryCampaign" ADD CONSTRAINT "GlobalGoalEntryCampaign_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "GlobalGoalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlobalGoalEntryCampaign" ADD CONSTRAINT "GlobalGoalEntryCampaign_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
