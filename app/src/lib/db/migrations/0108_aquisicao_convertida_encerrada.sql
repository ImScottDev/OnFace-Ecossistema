-- Aquisição que virou oportunidade (handoff) é encerrada como convertida (13/10/2026).
--
-- O handoff Pré-vendas -> Oportunidade movia a etapa da aquisição mas não gravava
-- `closed_at`, então ela seguia "aberta" em Relações em andamento ao lado da
-- oportunidade. O código passou a encerrar na mesma transação; aqui o histórico.
--
-- Alvo: aquisição ainda aberta cuja etapa já é `oportunidade`, ou cujo lead já
-- registra o handoff (estagio_pre_vendas = 'oportunidade' ou convertido_at), e
-- que não foi desqualificada. Backup do estado anterior em _relacoes_conversao_20261013.
-- Idempotente: depois de fechada, a aquisição sai do alvo.

CREATE TABLE IF NOT EXISTS _relacoes_conversao_20261013 (
  aquisicao_id uuid PRIMARY KEY,
  etapa_id uuid,
  closed_at timestamptz,
  qualificado boolean,
  salvo_em timestamptz NOT NULL DEFAULT now()
);

INSERT INTO _relacoes_conversao_20261013 (aquisicao_id, etapa_id, closed_at, qualificado)
SELECT a.id, a.etapa_id, a.closed_at, a.qualificado
  FROM aquisicoes a
  LEFT JOIN pipeline_etapas pe ON pe.id = a.etapa_id
 WHERE a.closed_at IS NULL
   AND a.desqualificado_em IS NULL
   AND (pe.codigo = 'oportunidade'
        OR EXISTS (SELECT 1 FROM leads l WHERE l.id = a.lead_legado_id
                      AND (l.estagio_pre_vendas = 'oportunidade' OR l.convertido_at IS NOT NULL)))
ON CONFLICT (aquisicao_id) DO NOTHING;

UPDATE aquisicoes a
   SET etapa_id = COALESCE((SELECT pe2.id FROM pipeline_etapas pe2 JOIN pipelines p ON p.id = pe2.pipeline_id
                             WHERE p.organizacao_id = a.organizacao_id AND p.slug = 'aquisicao' AND pe2.codigo = 'oportunidade'),
                           a.etapa_id),
       qualificado = true,
       closed_at = COALESCE((SELECT l.convertido_at FROM leads l WHERE l.id = a.lead_legado_id), now()),
       updated_at = now()
 WHERE a.id IN (SELECT a.id
  FROM aquisicoes a
  LEFT JOIN pipeline_etapas pe ON pe.id = a.etapa_id
 WHERE a.closed_at IS NULL
   AND a.desqualificado_em IS NULL
   AND (pe.codigo = 'oportunidade'
        OR EXISTS (SELECT 1 FROM leads l WHERE l.id = a.lead_legado_id
                      AND (l.estagio_pre_vendas = 'oportunidade' OR l.convertido_at IS NOT NULL))));
