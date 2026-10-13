#!/bin/bash
# PACOTE C (NAO EXECUTADO, aguardando o Scott): marca como desqualificado,
# motivo "teste", as aquisicoes dos leads de teste antigos que ja vinham do
# legado. Nao apaga nada: e-mails, WhatsApp, ligacoes, contratos e propostas
# desses leads ficam. Ficam de fora os 5 que podem ser pessoa real (Malu Teste,
# Teste Eu, Fabrico Rufin, Mesas Mesas, Pedro Cadeiras) e os 2 ja marcados no
# Pacote B (Kaua Scott, Teste final).
# Uso: --dry (padrao, so mostra e da ROLLBACK) | --executar (COMMIT).
# Backup das linhas originais em _limpeza_testes_20261013 (acao ATUALIZAR_C).
set -euo pipefail
FIM=ROLLBACK; [ "${1:-}" = "--executar" ] && FIM=COMMIT
ssh -i "$HOME/.ssh/infra_callface.pem" ubuntu@34.204.200.52 \
  "docker exec -i callface-crm2-dev-postgres psql -U callface -d callface_crm_mz -X -v ON_ERROR_STOP=1" <<SQL
BEGIN;
CREATE TEMP TABLE alvo(lead_id uuid) ON COMMIT DROP;
INSERT INTO alvo VALUES
  ('6dee69a0-f00c-4228-a510-e1f48c3bec6f'),
  ('5d5f58f1-753a-4ff9-88ec-85da6facfefa'),
  ('69f4af74-578f-4d8c-a375-0a8a356d8229'),
  ('723719af-abfc-473e-bca0-8283133d70d5'),
  ('b5b06b2d-4e1f-4f75-a645-69d47af67f73'),
  ('04a5343c-bc19-4e30-98f5-40e40732de48'),
  ('fbd206b6-43d9-46b0-971b-a717c444ef30'),
  ('b76b801b-83fa-4da1-84bc-985b5a9a4ac3'),
  ('82a6327e-6dfd-4646-be65-f5780640232d'),
  ('476f110e-b6ad-4fef-a8c5-2b3152cc84ce'),
  ('79691212-8b2e-48fc-9626-a73b51b0f421'),
  ('450aa8e9-dbd2-4b54-8f31-67630db4f532'),
  ('490666be-a1df-4755-bafc-aba0ab1d2eb0'),
  ('d1f489e4-2ddd-4bcb-a662-4c98d9fe5351'),
  ('e2667c64-cb48-4109-a9b4-0d56eeb40b18'),
  ('68e91c87-625e-4fd3-87ee-ace87a6167dd'),
  ('2154b795-82dc-44d5-9fa0-ce2201b66db5'),
  ('abf7438e-1170-428a-9c20-a057af804513'),
  ('9003b966-fd39-430a-8c7b-c9251b646dfa'),
  ('9907f730-7d01-49d9-b606-6a668a4761d5'),
  ('7062d485-b620-4945-888e-1d8d57d7057d'),
  ('05630d43-5605-4aa2-9be0-5a308fc368fe'),
  ('4bdf0197-33f0-463f-9f54-150e66814e35'),
  ('d555fac2-1f00-427c-a08d-237b644f0e75');
INSERT INTO _limpeza_testes_20261013(acao,tabela,registro_id,linha)
  SELECT 'ATUALIZAR_C','aquisicoes',a.id::text,to_jsonb(a) FROM aquisicoes a
   WHERE a.lead_legado_id IN (SELECT lead_id FROM alvo) AND a.motivo_desqualificacao IS DISTINCT FROM 'teste';
UPDATE aquisicoes SET etapa_id=(SELECT id FROM pipeline_etapas WHERE codigo='desqualificado' AND nome='Desqualificado'),
       desqualificado_em=coalesce(desqualificado_em,now()), closed_at=coalesce(closed_at,now()),
       motivo_desqualificacao='teste', updated_at=now()
 WHERE lead_legado_id IN (SELECT lead_id FROM alvo) AND motivo_desqualificacao IS DISTINCT FROM 'teste';
SELECT count(*) AS aquisicoes_marcadas FROM _limpeza_testes_20261013 WHERE acao='ATUALIZAR_C';
$FIM;
SQL
