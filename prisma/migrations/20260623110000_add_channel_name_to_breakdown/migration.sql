-- AlterTable: make campaignId nullable, add channelName
ALTER TABLE "DailyConversionBreakdown" ADD COLUMN "channelName" TEXT;
ALTER TABLE "DailyConversionBreakdown" ALTER COLUMN "campaignId" DROP NOT NULL;

-- Backfill channelName from campaign.name for existing rows (should be empty, but safe)
UPDATE "DailyConversionBreakdown" d
SET "channelName" = c.name
FROM "Campaign" c
WHERE d."campaignId" = c.id AND d."channelName" IS NULL;

-- Make channelName NOT NULL after backfill
ALTER TABLE "DailyConversionBreakdown" ALTER COLUMN "channelName" SET NOT NULL;

-- Drop old unique constraint and index on campaignId
DROP INDEX IF EXISTS "DailyConversionBreakdown_conversionId_campaignId_key";

-- Add new unique constraint on channelName
CREATE UNIQUE INDEX "DailyConversionBreakdown_conversionId_channelName_key" ON "DailyConversionBreakdown"("conversionId", "channelName");

-- Drop old FK constraint on campaignId (cascade) and re-add as nullable (set null)
ALTER TABLE "DailyConversionBreakdown" DROP CONSTRAINT IF EXISTS "DailyConversionBreakdown_campaignId_fkey";
ALTER TABLE "DailyConversionBreakdown" ADD CONSTRAINT "DailyConversionBreakdown_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
