CREATE TABLE "engineerings" (
    "id" SERIAL NOT NULL,
    "imovel" VARCHAR(250) NOT NULL,
    "matricula" VARCHAR(100),
    "cidade" VARCHAR(150),
    "dataPedido" DATE,
    "valorImovel" DECIMAL(15,2),
    "valorAvaliado" DECIMAL(15,2),
    "descricao" TEXT,
    "propertyId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "engineerings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "engineerings_valorImovel_nonnegative" CHECK ("valorImovel" >= 0),
    CONSTRAINT "engineerings_valorAvaliado_nonnegative" CHECK ("valorAvaliado" >= 0)
);

CREATE INDEX "engineerings_propertyId_idx" ON "engineerings"("propertyId");
CREATE INDEX "engineerings_cidade_idx" ON "engineerings"("cidade");
CREATE INDEX "engineerings_dataPedido_id_idx" ON "engineerings"("dataPedido", "id");

ALTER TABLE "engineerings" ADD CONSTRAINT "engineerings_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
