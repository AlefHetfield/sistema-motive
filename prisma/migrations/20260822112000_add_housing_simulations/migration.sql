-- CreateTable
CREATE TABLE "housing_simulations" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "createdById" INTEGER,
    "createdByName" TEXT NOT NULL,
    "bank" TEXT NOT NULL,
    "program" TEXT NOT NULL,
    "system" TEXT NOT NULL,
    "propertyValue" DECIMAL(15,2) NOT NULL,
    "financed" DECIMAL(15,2) NOT NULL,
    "requiredEntry" DECIMAL(15,2) NOT NULL,
    "firstInstallment" DECIMAL(15,2) NOT NULL,
    "term" INTEGER NOT NULL,
    "effectiveRate" DECIMAL(8,4) NOT NULL,
    "quota" DECIMAL(8,4) NOT NULL,
    "inputSnapshot" JSONB NOT NULL,
    "resultSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "housing_simulations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "housing_simulations_clientId_createdAt_idx" ON "housing_simulations"("clientId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "housing_simulations_createdById_idx" ON "housing_simulations"("createdById");

-- AddForeignKey
ALTER TABLE "housing_simulations" ADD CONSTRAINT "housing_simulations_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "housing_simulations" ADD CONSTRAINT "housing_simulations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
