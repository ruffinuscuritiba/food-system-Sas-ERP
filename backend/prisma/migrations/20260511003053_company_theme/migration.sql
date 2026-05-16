-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "productionStatus" SET DEFAULT 'RECEBIDO';

-- CreateTable
CREATE TABLE "CompanyTheme" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "primaryColor" TEXT NOT NULL DEFAULT '#ef4444',
    "secondaryColor" TEXT NOT NULL DEFAULT '#0f172a',
    "backgroundColor" TEXT NOT NULL DEFAULT '#020617',
    "textColor" TEXT NOT NULL DEFAULT '#ffffff',
    "logoUrl" TEXT,
    "bannerUrl" TEXT,
    "darkMode" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyTheme_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyTheme_companyId_key" ON "CompanyTheme"("companyId");
