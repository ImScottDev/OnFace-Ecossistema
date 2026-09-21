-- 0078 — anexo aponta para o acervo canônico de arquivos (SPEC §32).
--
-- O acervo já existia inteiro: `file_objects`, `file_links`, o serviço, os
-- adaptadores e os testes. Nada em runtime o chamava, e as duas rotas de upload
-- continuavam gravando com `fs.writeFileSync` no disco da máquina. Em container
-- isso significa anexo que morre no próximo deploy e não existe para a segunda
-- réplica.
--
-- Esta coluna é a ponte: o anexo continua sendo a linha que a tela lê, e o
-- binário passa a ter metadado canônico, checksum e chave com a organização
-- dentro. EXPAND: nullable de propósito, porque anexo antigo não tem acervo e
-- não se inventa checksum de arquivo que não se leu.

ALTER TABLE anexos
  ADD COLUMN IF NOT EXISTS file_object_id uuid REFERENCES file_objects(id);

CREATE INDEX IF NOT EXISTS idx_anexos_file_object ON anexos (file_object_id)
  WHERE file_object_id IS NOT NULL;

COMMENT ON COLUMN anexos.file_object_id IS
  'Acervo canônico do binário (SPEC §32). NULL = anexo gravado antes da virada, binário no disco local.';
