-- Tarefas precisam pertencer a uma organização.
--
-- Correção de integridade multi-tenant: tarefas antigas foram gravadas sem
-- organizacao_id. A API sempre filtra por organização, então essas tarefas
-- existiam no banco mas eram invisíveis para a equipe.
--
-- A migração só infere a organização pelos vínculos já existentes
-- (lead, negócio ou empresa). Ela para antes de escrever se houver conflito
-- entre esses vínculos ou se algum registro não tiver fonte confiável.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM tarefas t
      LEFT JOIN leads l ON l.id = t.lead_id
      LEFT JOIN negocios n ON n.id = t.negocio_id
      LEFT JOIN empresas e ON e.id = t.empresa_id
     WHERE t.organizacao_id IS NULL
       AND (
         (l.organizacao_id IS NOT NULL AND n.organizacao_id IS NOT NULL AND l.organizacao_id <> n.organizacao_id)
         OR (l.organizacao_id IS NOT NULL AND e.organizacao_id IS NOT NULL AND l.organizacao_id <> e.organizacao_id)
         OR (n.organizacao_id IS NOT NULL AND e.organizacao_id IS NOT NULL AND n.organizacao_id <> e.organizacao_id)
       )
  ) THEN
    RAISE EXCEPTION 'tarefas sem organizacao com vínculos de organizações diferentes; correção manual necessária';
  END IF;
END $$;

UPDATE tarefas t
   SET organizacao_id = COALESCE(
     (SELECT l.organizacao_id FROM leads l WHERE l.id = t.lead_id),
     (SELECT n.organizacao_id FROM negocios n WHERE n.id = t.negocio_id),
     (SELECT e.organizacao_id FROM empresas e WHERE e.id = t.empresa_id)
   )
 WHERE t.organizacao_id IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM tarefas WHERE organizacao_id IS NULL) THEN
    RAISE EXCEPTION 'existem tarefas sem organizacao sem vínculo confiável; migration não pode tornar organizacao obrigatória';
  END IF;
END $$;

ALTER TABLE tarefas
  ALTER COLUMN organizacao_id SET NOT NULL;
