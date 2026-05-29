-- CreateEnum
CREATE TYPE "PlacementType" AS ENUM ('CHANNEL', 'BOT', 'SEARCH');

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "placementType" "PlacementType";
