-- KI-Assistent: Chat-Sessions und Nachrichten

CREATE TABLE "AiChatSession" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AiChatSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiChatMessage" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AiChatMessage_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AiChatSession" ADD CONSTRAINT "AiChatSession_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiChatSession" ADD CONSTRAINT "AiChatSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiChatMessage" ADD CONSTRAINT "AiChatMessage_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "AiChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "AiChatSession_tenantId_userId_updatedAt_idx"
  ON "AiChatSession"("tenantId", "userId", "updatedAt");

CREATE INDEX "AiChatMessage_sessionId_createdAt_idx"
  ON "AiChatMessage"("sessionId", "createdAt");
