-- Drop the old non-unique index and replace with a unique constraint
DROP INDEX IF EXISTS "PerformanceEntry_campaignId_date_idx";

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceEntry_campaignId_date_key" ON "PerformanceEntry"("campaignId", "date");
