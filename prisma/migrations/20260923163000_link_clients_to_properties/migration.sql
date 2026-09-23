-- Permite vincular o imóvel do mapa ao cliente sem remover o campo textual legado.
ALTER TABLE "clients" ADD COLUMN "propertyId" INTEGER;

CREATE INDEX "clients_propertyId_idx" ON "clients"("propertyId");

ALTER TABLE "clients"
ADD CONSTRAINT "clients_propertyId_fkey"
FOREIGN KEY ("propertyId") REFERENCES "properties"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
