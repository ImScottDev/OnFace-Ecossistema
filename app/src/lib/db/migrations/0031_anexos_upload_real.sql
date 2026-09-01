-- Anexos com upload real (25/08, pedido do Kauã: anexar arquivo em nota e
-- em negócio/documentos). Diferente de anexos_legado (histórico Zoho,
-- read-only) — estes são criados pelo time, salvos em UPLOADS_DIR.
CREATE TABLE IF NOT EXISTS anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  negocio_id uuid REFERENCES negocios(id) ON DELETE CASCADE,
  nota_id uuid REFERENCES notas(id) ON DELETE CASCADE,
  nome_arquivo text NOT NULL,
  url text NOT NULL,
  tipo_mime text,
  tamanho_bytes integer,
  criado_por_id uuid REFERENCES usuarios(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_anexos_negocio ON anexos(negocio_id);
CREATE INDEX IF NOT EXISTS idx_anexos_nota ON anexos(nota_id);
CREATE INDEX IF NOT EXISTS idx_anexos_org ON anexos(organizacao_id);
