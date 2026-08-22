-- CreateTable
CREATE TABLE "contracts" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "createdById" INTEGER,
    "createdByName" TEXT NOT NULL,
    "templateVersion" TEXT NOT NULL DEFAULT 'v1',
    "buyerName" TEXT NOT NULL,
    "propertyValue" DECIMAL(15,2) NOT NULL,
    "financed" DECIMAL(15,2) NOT NULL,
    "contractData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contracts_clientId_createdAt_idx" ON "contracts"("clientId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "contracts_createdById_idx" ON "contracts"("createdById");

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
