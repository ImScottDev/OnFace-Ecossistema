-- CARGA DA VIRADA · 4-historico · passo 04 — os 1.980 anexos entram na timeline.
--
-- POR QUE EXISTE: o passo 02 levou notas (5.235), status_changes (6.212),
-- reuniões (322) e tarefas (462) para `timeline_events`, mas os anexos pararam
-- em 45 de 1.980. O INSERT de lá só ancorava
-- `entidade_tipo IN ('lead','Lead','contato','empresa','Empresa','Account')`,
-- e a distribuição real de `anexos_legado` é outra:
--
--     contrato 1164 · negocio 615 · notes 123 · empresa 44
--     desconhecido 19 · emails 14 · lead 1
--
-- Os 45 que entraram são exatamente os 44 de `empresa` mais o único de `lead`.
-- São contratos e documentos de cliente: é o que o time vai procurar na tela.
--
-- O QUE FALTAVA: âncora para os tipos polimórficos que o 02 não traduzia.
--   contrato → `contratos` (lead_id, negocio_id, empresa_id, oportunidade_id)
--   negocio  → `oportunidades.negocio_id_legado`
--   notes    → `notas` (lead_id, negocio_id, empresa_id)
--   emails   → `emails` (lead_id)
-- Daí para pessoa/aquisição pelos vínculos que os backfills já criaram
-- (`pessoas.lead_id_legado`, `aquisicoes.lead_legado_id`).
--
-- MEDIDO (banco callface_crm_ensaio_virada, 05/10/2026), e o resultado é
-- categórico: TODO anexo com `entidade_id` preenchido resolve âncora, e todo
-- anexo sem âncora tem `entidade_id` NULO. Não há meio-termo, não há match
-- aproximado a fazer.
--
--     tipo          total   entidade_id preenchido   NULO
--     contrato       1164      507 (100% resolvem)    657
--     negocio         615      556 (100% resolvem)     59
--     notes           123        0                    123
--     empresa          44       44 (já no passo 02)     0
--     desconhecido     19        0                     19
--     emails           14        0                     14
--     lead              1        1 (já no passo 02)     0
--     ─────────────────────────────────────────────────────
--     ancoráveis     1108          sem âncora          872
--
-- POR QUE OS 872 SOBRAM, NOMINALMENTE: `anexos_legado.entidade_id` é NULO
-- neles. Não é vínculo perdido na tradução — o importador do Zoho gravou o
-- arquivo (todos os 1.980 têm `storage_path`) sem gravar a que registro ele
-- pertencia. Não há a quem pendurar, e pendurar por semelhança seria inventar.
--   Conferido que não há segundo caminho: `anexos_legado.zoho_id` é o id do
--   PRÓPRIO anexo no Zoho, não o do pai. 92 dos 657 nomes de arquivo de
--   `contrato` carregam um id Zoho no nome (`SalesOrder_59380680000….pdf`) e
--   ZERO deles casa com `contratos.zoho_id` — o id do nome é da Sales Order do
--   Zoho, que não é o contrato migrado. Então nem por aí.
--
-- Ficam para revisão humana, consultáveis por:
--   SELECT entidade_tipo, categoria, nome_arquivo, storage_path, criado_em_original
--     FROM anexos_legado WHERE entidade_id IS NULL ORDER BY criado_em_original DESC;
--
-- IDEMPOTENTE pelo mesmo padrão do passo 02: `metadata->'backfill'->>'origem'`
-- = 'anexos_legado' e `->>'id'` = id do anexo. Os 45 do passo 02 usam a MESMA
-- chave, então este arquivo não os duplica — ele só completa o que faltou.

INSERT INTO timeline_events (organizacao_id, empresa_id, pessoa_id, aquisicao_id,
                             oportunidade_id, tipo, titulo, descricao, icone,
                             actor_type, occurred_at, metadata)
SELECT x.organizacao_id,
       COALESCE(emp.id, ct.empresa_id, nt.empresa_id, opc.empresa_id, opn.empresa_id,
                opt.empresa_id, lg.empresa_id, p.empresa_id),
       COALESCE(p.id, opc.pessoa_id, opn.pessoa_id, opt.pessoa_id),
       a.id,
       COALESCE(ct.oportunidade_id, opc.id, opn.id, opt.id),
       'anexo',
       COALESCE(NULLIF(x.nome_arquivo, ''), 'Documento'),
       x.categoria, 'paperclip', 'SYSTEM',
       COALESCE(x.criado_em_original, x.created_at),
       jsonb_build_object(
         'backfill', jsonb_build_object('fase','carga-4-historico','origem','anexos_legado','id',x.id),
         'storage_path', x.storage_path, 'categoria', x.categoria,
         'tamanho_bytes', x.tamanho_bytes,
         -- De onde veio a âncora. Sem isto, depurar um anexo na tela errada
         -- obriga a refazer o raciocínio inteiro deste arquivo.
         'ancora_via', x.entidade_tipo)
  FROM anexos_legado x
  -- Âncoras diretas (as que o passo 02 já cobria).
  LEFT JOIN empresas      emp ON x.entidade_tipo IN ('empresa','Empresa','Account')
                             AND emp.id = x.entidade_id
  -- contrato → o contrato leva lead, negócio, empresa e oportunidade juntos.
  LEFT JOIN contratos      ct ON x.entidade_tipo = 'contrato' AND ct.id = x.entidade_id
  LEFT JOIN oportunidades opc ON opc.negocio_id_legado = ct.negocio_id
  -- negocio → o id é o do negócio LEGADO, não o da oportunidade canônica.
  LEFT JOIN oportunidades opn ON x.entidade_tipo = 'negocio'
                             AND opn.negocio_id_legado = x.entidade_id
  -- notes → a nota carrega lead, negócio e empresa.
  LEFT JOIN notas          nt ON x.entidade_tipo = 'notes' AND nt.id = x.entidade_id
  LEFT JOIN oportunidades opt ON opt.negocio_id_legado = nt.negocio_id
  -- emails → só o lead.
  LEFT JOIN emails         em ON x.entidade_tipo = 'emails' AND em.id = x.entidade_id
  -- O lead de referência, venha de onde vier. É ele que abre pessoa e aquisição.
  LEFT JOIN LATERAL (
    SELECT COALESCE(ct.lead_id, nt.lead_id, em.lead_id,
                    CASE WHEN x.entidade_tipo IN ('lead','Lead','contato')
                         THEN x.entidade_id END) AS lead_id
  ) ref ON TRUE
  LEFT JOIN leads      lg ON lg.id = ref.lead_id
  LEFT JOIN pessoas     p ON p.lead_id_legado = ref.lead_id
  LEFT JOIN aquisicoes  a ON a.lead_legado_id = ref.lead_id
 WHERE NOT EXISTS (SELECT 1 FROM timeline_events t
                    WHERE t.metadata->'backfill'->>'origem' = 'anexos_legado'
                      AND t.metadata->'backfill'->>'id' = x.id::text)
   -- Sem nenhuma âncora o evento não apareceria em tela nenhuma e só inflaria
   -- a contagem. Mesma regra do passo 02.
   AND COALESCE(emp.id, ct.empresa_id, nt.empresa_id, opc.empresa_id, opn.empresa_id,
                opt.empresa_id, lg.empresa_id, p.empresa_id,
                p.id, a.id, ct.oportunidade_id, opc.id, opn.id, opt.id) IS NOT NULL;

-- ── relatório ────────────────────────────────────────────────────────────
DO $$
DECLARE na_timeline int; total int; sem_id int;
BEGIN
  SELECT count(*) INTO na_timeline FROM timeline_events
   WHERE metadata->'backfill'->>'origem' = 'anexos_legado';
  SELECT count(*) INTO total FROM anexos_legado;
  SELECT count(*) INTO sem_id FROM anexos_legado WHERE entidade_id IS NULL;
  RAISE NOTICE '── anexos na timeline ──';
  RAISE NOTICE '  na timeline: % de %', na_timeline, total;
  RAISE NOTICE '  sem ancora:  % (entidade_id NULO na origem: %)', total - na_timeline, sem_id;
END $$;
