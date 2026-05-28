-- AddColumn videoUrl + hasVideo to Product
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "videoUrl" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "hasVideo" BOOLEAN NOT NULL DEFAULT false;
