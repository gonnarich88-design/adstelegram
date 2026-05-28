-- CreateTable
CREATE TABLE "DailyConversion" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "registrations" INTEGER NOT NULL,
    "depositCount" INTEGER NOT NULL,
    "depositAmountThb" DECIMAL(18,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyConversion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyConversion_date_key" ON "DailyConversion"("date");
