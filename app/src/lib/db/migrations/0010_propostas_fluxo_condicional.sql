-- Propostas — fluxo comercial condicional (pagamento direto vs contrato/assinatura)
-- Aplicado direto via psql (não via drizzle-kit generate — schema.ts já tinha
-- drift de migrations anteriores aplicadas fora do fluxo generate/migrate,
-- confirmado pelo journal.json só ter 1 entrada pra 10 arquivos .sql reais).

ALTER TABLE servicos_catalogo
  ADD COLUMN IF NOT EXISTS categoria text,
  ADD COLUMN IF NOT EXISTS requer_contrato boolean NOT NULL DEFAULT false;

ALTER TABLE propostas
  ADD COLUMN IF NOT EXISTS proximo_passo text,
  ADD COLUMN IF NOT EXISTS visualizacoes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS primeira_visualizacao_em timestamptz,
  ADD COLUMN IF NOT EXISTS ultima_visualizacao_em timestamptz,
  ADD COLUMN IF NOT EXISTS cliente_respondeu_em timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_recusa text;

ALTER TABLE contratos
  ADD COLUMN IF NOT EXISTS assinatura_status text NOT NULL DEFAULT 'nao_aplicavel',
  ADD COLUMN IF NOT EXISTS assinado_em timestamptz,
  ADD COLUMN IF NOT EXISTS assinado_nome text,
  ADD COLUMN IF NOT EXISTS assinado_ip text;

-- Backfill dos itens reais e ativos do catálogo (nenhum inventado — os 8
-- ativos hoje são todos Callface AI). PABX ainda não tem item ativo; ativamos
-- 1 plano real (já existia, importado do Zoho) pra permitir testar o fluxo B
-- ponta a ponta sem inventar produto novo.
UPDATE servicos_catalogo SET categoria = 'callface_ai', requer_contrato = false
  WHERE nome IN (
    'Callface AI - Starter', 'Callface AI - Full', 'Callface AI - Business',
    'CallPilot', 'CallPilot Plataforma', 'Agente IA', 'Report/ADM',
    'Pacote 500min Adicionais', 'Minutos adicionais Callface AI'
  );

UPDATE servicos_catalogo SET categoria = 'pabx', requer_contrato = true, ativo = true
  WHERE nome = 'PABX Starter (Compartilhado)';
