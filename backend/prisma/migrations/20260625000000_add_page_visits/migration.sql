-- CreateTable (idempotent)
CREATE TABLE IF NOT EXISTS "PageVisit" (
    "id"        TEXT         NOT NULL,
    "page"      TEXT         NOT NULL DEFAULT '/demo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PageVisit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PageVisit_page_createdAt_idx" ON "PageVisit"("page", "createdAt");
