UPDATE "properties"
SET "status" = CASE
    WHEN "status" = 'Reservado' THEN 'Em negociação'
    WHEN "status" = 'Vendido' THEN 'Indisponível'
    WHEN "status" = 'Confirmar disponibilidade' THEN 'Confirmando disponibilidade'
    ELSE "status"
END
WHERE "status" IN ('Reservado', 'Vendido', 'Confirmar disponibilidade');
