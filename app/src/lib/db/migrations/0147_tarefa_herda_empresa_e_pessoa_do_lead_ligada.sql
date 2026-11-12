-- 0147 — Atividade herda a empresa, e a pessoa que nasceu de um lead fica ligada à empresa dele.
--
-- 1. TAREFA SEM EMPRESA. Oito caminhos gravam em `tarefas` (rota da tela, NEXO, cadência,
--    pré-vendas, pipeline, pós-venda, integração Callface, CS) e só alguns preenchem
--    `empresa_id`. Medido em produção em 12/11/2026: as 31 atividades MANUAIS da semana
--    nasceram sem empresa, embora 38 de 40 tivessem lead ligado a uma empresa. A gaveta da
--    atividade e a tela de Atividades leem a coluna, então a atividade aparecia solta, sem
--    empresa nem Cliente 360. Corrigir oito chamadores deixaria o nono quebrado: o gatilho
--    resolve na escrita, para todos, e nunca sobrescreve empresa que já veio preenchida.
--
-- 2. PESSOA FANTASMA. A pessoa criada a partir de um lead ficava com `empresa_id` NULL e sem
--    vínculo, enquanto o lead dela estava ligado à empresa. O Cliente 360 esconde o lead
--    (porque já virou pessoa) e não mostra a pessoa (porque não está ligada): o contato some
--    dos dois lados. 28 clientes em produção, ex.: Bernard Malta / Negócios Profissionais.
--    O vínculo vai para `pessoa_empresa_vinculos`, nunca para `pessoas.empresa_id`.
--
-- Aditiva e idempotente: o gatilho é CREATE OR REPLACE, os backfills só preenchem vazio,
-- o vínculo usa ON CONFLICT DO NOTHING. Não apaga nada e não toca valor de venda.
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS trg_tarefas_herda_empresa ON tarefas;
--   DROP FUNCTION IF EXISTS tarefas_herda_empresa();
--   (os backfills preenchem o vínculo correto e não precisam voltar)

CREATE OR REPLACE FUNCTION tarefas_herda_empresa() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.empresa_id IS NULL THEN
    NEW.empresa_id := COALESCE(
      (SELECT COALESCE(e.canonical_empresa_id, e.id)
         FROM leads l JOIN empresas e ON e.id = l.empresa_id
        WHERE l.id = NEW.lead_id AND e.organizacao_id = NEW.organizacao_id),
      (SELECT COALESCE(e.canonical_empresa_id, e.id)
         FROM negocios n JOIN empresas e ON e.id = n.empresa_id
        WHERE n.id = NEW.negocio_id AND e.organizacao_id = NEW.organizacao_id));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_tarefas_herda_empresa ON tarefas;
CREATE TRIGGER trg_tarefas_herda_empresa
  BEFORE INSERT OR UPDATE OF lead_id, negocio_id ON tarefas
  FOR EACH ROW EXECUTE FUNCTION tarefas_herda_empresa();

-- Backfill das tarefas existentes, pela mesma regra.
UPDATE tarefas t
   SET empresa_id = COALESCE(
         (SELECT COALESCE(e.canonical_empresa_id, e.id)
            FROM leads l JOIN empresas e ON e.id = l.empresa_id
           WHERE l.id = t.lead_id AND e.organizacao_id = t.organizacao_id),
         (SELECT COALESCE(e.canonical_empresa_id, e.id)
            FROM negocios n JOIN empresas e ON e.id = n.empresa_id
           WHERE n.id = t.negocio_id AND e.organizacao_id = t.organizacao_id))
 WHERE t.empresa_id IS NULL
   AND (t.lead_id IS NOT NULL OR t.negocio_id IS NOT NULL);

-- Pessoa sem empresa e sem vínculo, cujo lead (não mesclado) está ligado a uma empresa.
INSERT INTO pessoa_empresa_vinculos (organizacao_id, pessoa_id, empresa_id, papel, principal)
SELECT DISTINCT ON (p.id) p.organizacao_id, p.id, COALESCE(e.canonical_empresa_id, e.id), 'contato_principal', false
  FROM pessoas p
  JOIN leads l ON l.id = p.lead_id_legado AND l.canonical_lead_id IS NULL
  JOIN empresas e ON e.id = l.empresa_id AND e.organizacao_id = p.organizacao_id
 WHERE p.empresa_id IS NULL
   AND NOT EXISTS (SELECT 1 FROM pessoa_empresa_vinculos v WHERE v.pessoa_id = p.id AND v.encerrado_em IS NULL)
 ORDER BY p.id
ON CONFLICT DO NOTHING;
