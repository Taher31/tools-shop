-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('not_configured', 'ready', 'error');

-- CreateEnum
CREATE TYPE "IntegrationLogLevel" AS ENUM ('info', 'warning', 'error');

-- CreateTable
CREATE TABLE "Integration" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "encryptedCredentials" TEXT,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "status" "IntegrationStatus" NOT NULL DEFAULT 'not_configured',
    "lastCheckedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationLog" (
    "id" UUID NOT NULL,
    "integrationId" UUID NOT NULL,
    "level" "IntegrationLogLevel" NOT NULL,
    "action" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "productId" UUID,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Integration_code_key" ON "Integration"("code");

-- CreateIndex
CREATE INDEX "IntegrationLog_integrationId_createdAt_idx" ON "IntegrationLog"("integrationId", "createdAt");

-- AddForeignKey
ALTER TABLE "IntegrationLog" ADD CONSTRAINT "IntegrationLog_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
