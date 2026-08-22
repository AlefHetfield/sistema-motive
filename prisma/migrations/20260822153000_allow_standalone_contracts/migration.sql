-- Permite gerar contratos sem vincular um cliente previamente cadastrado.
ALTER TABLE "contracts" ALTER COLUMN "clientId" DROP NOT NULL;
