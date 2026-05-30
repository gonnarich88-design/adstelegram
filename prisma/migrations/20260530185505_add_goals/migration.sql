-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "goalText" TEXT,
ADD COLUMN     "planText" TEXT,
ADD COLUMN     "targetDate" TIMESTAMP(3),
ADD COLUMN     "targetJoins" INTEGER;

-- CreateTable
CREATE TABLE "GlobalGoal" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalGoal_pkey" PRIMARY KEY ("id")
);
