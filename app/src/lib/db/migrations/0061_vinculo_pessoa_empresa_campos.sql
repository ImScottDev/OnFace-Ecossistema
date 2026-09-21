-- Completa `pessoa_empresa_vinculos` com os campos do SPEC §6.3 (fase 05).
--
-- A tabela existe desde o modelo V2 mas nasceu sem `cargo` e sem `updated_at`.
-- `cargo` importa porque o papel na empresa ("contato_principal") e o cargo da
-- pessoa ("Diretor de TI") são coisas diferentes, e hoje só o primeiro cabe.
--
-- Os nomes `iniciado_em` / `encerrado_em` ficam como estão. O SPEC chama de
-- `inicio_em` / `fim_em`, mas a semântica é idêntica e renomear coluna é CONTRACT,
-- não EXPAND: entra na fase de contração, junto com os demais renames, para não
-- quebrar leitor existente no meio do backfill.

BEGIN;

ALTER TABLE pessoa_empresa_vinculos ADD COLUMN IF NOT EXISTS cargo      text;
ALTER TABLE pessoa_empresa_vinculos ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Uma pessoa não se vincula duas vezes à mesma empresa. Sem isso, reexecutar o
-- backfill duplicaria vínculo (o script já checa, mas a garantia tem que estar
-- no banco: o script não é o único escritor possível).
CREATE UNIQUE INDEX IF NOT EXISTS uq_pessoa_empresa_vinculo
  ON pessoa_empresa_vinculos (pessoa_id, empresa_id);

COMMIT;
