-- CARGA DA VIRADA · histórico, passo 05 — resgata anexos de contrato pelo
-- código canônico.
--
-- O passo 04 ancorou os anexos por `entidade_id`. Sobraram centenas de
-- `entidade_tipo='contrato'` cujo id não resolve, e eles foram dados como
-- irrecuperáveis. Não são: existe uma segunda chave, e ela é determinística.
--
-- `contratos.descricao` guarda o código do contrato no formato
-- "CT - NNN - MM/AAAA", e o nome dos arquivos guarda o mesmo código:
--
--   SO_CT - 042 - 02_2024 - CMO Construtora Ltda
--   CONTRATO ID 212 - 06_2025 - CONCESSIONARIA RIO PAX S_A
--
-- Exigindo que NÚMERO e MÊS/ANO batam ao mesmo tempo, 147 anexos casam com
-- exatamente um contrato e nenhum fica ambíguo. Só o número não serve: ele se
-- repete entre anos.
--
-- Por que vale a pena: são documentos assinados (`categoria='documento_assinado'`)
-- — contrato de cliente. É o que alguém abre a ficha para procurar.
--
-- Achado do verificador adversarial da frente C, 05/10/2026.
--
-- IDEMPOTENTE pelo mesmo padrão dos outros: metadata->'backfill'->>'origem' + 'id'.

INSERT INTO timeline_events (organizacao_id, empresa_id, pessoa_id, aquisicao_id,
                             oportunidade_id, tipo, titulo, descricao, icone,
                             actor_type, occurred_at, metadata)
SELECT x.organizacao_id,
       COALESCE(ct.empresa_id, o.empresa_id, p.empresa_id),
       p.id, a.id, o.id,
       'anexo',
       COALESCE(NULLIF(x.nome_arquivo, ''), 'Documento'),
       COALESCE(x.categoria, 'documento de contrato'), 'paperclip', 'SYSTEM',
       COALESCE(x.criado_em_original, x.created_at),
       jsonb_build_object(
         'backfill', jsonb_build_object('fase','carga-4-historico','origem','anexos_legado','id',x.id),
         'storage_path', x.storage_path,
         'categoria', x.categoria,
         'ancora', 'codigo_contrato',
         'contrato_id', ct.id)
  FROM anexos_legado x
  JOIN LATERAL (
    SELECT (regexp_match(x.nome_arquivo, '(?:CT|CONTRATO ID)\s*-?\s*(\d+)\s*-\s*(\d{2})[/_](\d{4})')) AS m
  ) cod ON cod.m IS NOT NULL
  -- O JOIN é por número E mês/ano juntos. Só pelo número casaria contrato de
  -- anos diferentes, que é exatamente o erro que faria o documento de um
  -- cliente aparecer na ficha de outro.
  JOIN contratos ct
    ON ct.descricao ~ ('CT\s*-\s*' || cod.m[1] || '\s*-\s*' || cod.m[2] || '[/_]' || cod.m[3])
  LEFT JOIN oportunidades o ON o.negocio_id_legado = ct.negocio_id
  LEFT JOIN pessoas       p ON p.lead_id_legado    = ct.lead_id
  LEFT JOIN aquisicoes    a ON a.lead_legado_id    = ct.lead_id
 WHERE x.entidade_tipo = 'contrato'
   AND NOT EXISTS (SELECT 1 FROM timeline_events t
                    WHERE t.metadata->'backfill'->>'origem' = 'anexos_legado'
                      AND t.metadata->'backfill'->>'id' = x.id::text)
   -- só o casamento inequívoco entra; ambiguidade fica de fora e é reportada
   AND (SELECT count(*) FROM contratos c2
         WHERE c2.descricao ~ ('CT\s*-\s*' || cod.m[1] || '\s*-\s*' || cod.m[2] || '[/_]' || cod.m[3])) = 1;

DO $$
DECLARE total int; migrados int;
BEGIN
  SELECT count(*) INTO total FROM anexos_legado;
  SELECT count(*) INTO migrados FROM timeline_events
   WHERE metadata->'backfill'->>'origem' = 'anexos_legado';
  RAISE NOTICE '── anexos na timeline: % de % (sem âncora: %)', migrados, total, total - migrados;
END $$;
