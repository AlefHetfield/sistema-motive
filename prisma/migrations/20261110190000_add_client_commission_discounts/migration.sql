ALTER TABLE "clients"
    ADD COLUMN "visitaDiego" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "descontosComissao" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "clients" ADD CONSTRAINT "clients_descontosComissao_array"
    CHECK (jsonb_typeof("descontosComissao") = 'array');
