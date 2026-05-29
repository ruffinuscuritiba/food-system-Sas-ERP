-- WhatsApp IA Module — idempotent migration

CREATE TABLE IF NOT EXISTS "WhatsappConnection" (
  "id"            TEXT NOT NULL PRIMARY KEY,
  "companyId"     TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "provider"      TEXT NOT NULL DEFAULT 'EVOLUTION',
  "instanceName"  TEXT,
  "apiUrl"        TEXT,
  "apiToken"      TEXT,
  "phoneNumberId" TEXT,
  "webhookToken"  TEXT,
  "phoneNumber"   TEXT,
  "isActive"      BOOLEAN NOT NULL DEFAULT true,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsappConnection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "WhatsappConnection_companyId_idx" ON "WhatsappConnection"("companyId");

CREATE TABLE IF NOT EXISTS "WhatsappAiSettings" (
  "id"                  TEXT NOT NULL PRIMARY KEY,
  "connectionId"        TEXT NOT NULL,
  "companyId"           TEXT NOT NULL,
  "aiProvider"          TEXT NOT NULL DEFAULT 'GEMINI',
  "aiModel"             TEXT NOT NULL DEFAULT 'gemini-1.5-flash',
  "attendantName"       TEXT NOT NULL DEFAULT 'Atendente',
  "systemPrompt"        TEXT,
  "greetingMessage"     TEXT,
  "offlineMessage"      TEXT,
  "transferKeywords"    TEXT,
  "mode"                TEXT NOT NULL DEFAULT 'AUTO',
  "typingDelay"         INTEGER NOT NULL DEFAULT 1500,
  "messageDelay"        INTEGER NOT NULL DEFAULT 800,
  "useEmojis"           BOOLEAN NOT NULL DEFAULT true,
  "businessHoursStart"  TEXT NOT NULL DEFAULT '08:00',
  "businessHoursEnd"    TEXT NOT NULL DEFAULT '22:00',
  "businessDays"        TEXT NOT NULL DEFAULT '1,2,3,4,5,6',
  "isActive"            BOOLEAN NOT NULL DEFAULT true,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsappAiSettings_connectionId_key" UNIQUE ("connectionId"),
  CONSTRAINT "WhatsappAiSettings_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "WhatsappConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "WhatsappAiSettings_companyId_idx" ON "WhatsappAiSettings"("companyId");

CREATE TABLE IF NOT EXISTS "WhatsappConversation" (
  "id"            TEXT NOT NULL PRIMARY KEY,
  "connectionId"  TEXT NOT NULL,
  "companyId"     TEXT NOT NULL,
  "customerPhone" TEXT NOT NULL,
  "customerName"  TEXT,
  "status"        TEXT NOT NULL DEFAULT 'ACTIVE',
  "mode"          TEXT NOT NULL DEFAULT 'AI',
  "context"       JSONB,
  "orderId"       TEXT,
  "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsappConversation_connectionId_customerPhone_key" UNIQUE ("connectionId", "customerPhone"),
  CONSTRAINT "WhatsappConversation_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "WhatsappConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "WhatsappConversation_companyId_idx" ON "WhatsappConversation"("companyId");
CREATE INDEX IF NOT EXISTS "WhatsappConversation_connectionId_idx" ON "WhatsappConversation"("connectionId");

CREATE TABLE IF NOT EXISTS "WhatsappMessage" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "conversationId" TEXT NOT NULL,
  "companyId"      TEXT NOT NULL,
  "role"           TEXT NOT NULL,
  "content"        TEXT NOT NULL,
  "externalId"     TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsappMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "WhatsappConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "WhatsappMessage_conversationId_idx" ON "WhatsappMessage"("conversationId");
CREATE INDEX IF NOT EXISTS "WhatsappMessage_companyId_idx" ON "WhatsappMessage"("companyId");
