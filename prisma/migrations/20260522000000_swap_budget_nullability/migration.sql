-- Make dailyBudgetTon required: fill existing NULLs with 0 first
UPDATE "Campaign" SET "dailyBudgetTon" = 0 WHERE "dailyBudgetTon" IS NULL;
ALTER TABLE "Campaign" ALTER COLUMN "dailyBudgetTon" SET NOT NULL;

-- Make budgetTon optional
ALTER TABLE "Campaign" ALTER COLUMN "budgetTon" DROP NOT NULL;
