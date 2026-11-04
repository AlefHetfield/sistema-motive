ALTER TABLE "engineerings" ADD COLUMN "valorEntradaManual" DECIMAL(15,2);

ALTER TABLE "engineerings" ADD CONSTRAINT "engineerings_valorEntradaManual_nonnegative"
    CHECK ("valorEntradaManual" >= 0);
