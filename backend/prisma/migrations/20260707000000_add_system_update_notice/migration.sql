-- Aviso de atualização do sistema (idempotente)
CREATE TABLE IF NOT EXISTS "SystemUpdateNotice" (
    "id" TEXT NOT NULL,
    "buildId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "recipients" INTEGER NOT NULL DEFAULT 0,
    "summary" JSONB,

    CONSTRAINT "SystemUpdateNotice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SystemUpdateNotice_buildId_key" ON "SystemUpdateNotice"("buildId");
