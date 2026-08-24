-- Alinha a proteção de reconciliação prevista no domínio CRM2 com o banco.
-- NULL continua permitido e não representa um vínculo legado conhecido.
-- Aplicar somente após confirmar ausência de duplicatas não nulas.
DROP INDEX IF EXISTS idx_pessoas_lead_legado;
CREATE UNIQUE INDEX IF NOT EXISTS idx_pessoas_lead_legado
  ON pessoas (lead_id_legado);

DROP INDEX IF EXISTS idx_oportunidades_negocio_legado;
CREATE UNIQUE INDEX IF NOT EXISTS idx_oportunidades_negocio_legado
  ON oportunidades (negocio_id_legado);

CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_lead_legado
  ON clientes (lead_id_legado);
