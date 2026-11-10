ALTER TABLE "clients" ADD COLUMN "comissaoEstimada" DECIMAL(15,2);

ALTER TABLE "clients" ADD CONSTRAINT "clients_comissaoEstimada_nonnegative"
    CHECK ("comissaoEstimada" >= 0);
