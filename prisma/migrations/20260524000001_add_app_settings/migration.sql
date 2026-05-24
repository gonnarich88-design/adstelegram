-- CreateTable
CREATE TABLE "AppSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "walletBalanceTon" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- Insert default row
INSERT INTO "AppSettings" ("id", "walletBalanceTon", "updatedAt") VALUES (1, 0, NOW());
