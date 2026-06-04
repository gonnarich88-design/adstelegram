-- CreateTable
CREATE TABLE "GlobalGoalEntry" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "goalText" TEXT,
    "planText" TEXT,
    "targetText" TEXT,
    "deadline" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalGoalEntry_pkey" PRIMARY KEY ("id")
);
