-- CreateEnum
CREATE TYPE "DepositType" AS ENUM ('DEPOSIT', 'REFUND');

-- AlterEnum
ALTER TYPE "CampaignStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "WalletDeposit" ADD COLUMN     "refundCampaignId" TEXT,
ADD COLUMN     "type" "DepositType" NOT NULL DEFAULT 'DEPOSIT';

-- AddForeignKey
ALTER TABLE "WalletDeposit" ADD CONSTRAINT "WalletDeposit_refundCampaignId_fkey" FOREIGN KEY ("refundCampaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
