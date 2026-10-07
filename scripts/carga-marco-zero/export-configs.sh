#!/usr/bin/env bash
# Exporta as configs do ONFACE (agentes, automacoes, cadencias, templates,
# contrato_templates, scripts_atendimento) de audit_onface_agentes para
# configs/*.json, ja deduplicadas. SO LEITURA: a sessao roda com
# default_transaction_read_only=on, entao nada aqui consegue escrever no banco.
#
# A carga (11_configs_onface.sql) le estes arquivos, nunca o banco de dev. Assim a
# virada nao depende de UPDATE manual nem de o banco de dev continuar de pe.
#
# Uso: ./export-configs.sh [banco_origem]   (padrao: audit_onface_agentes)
#
# Regras (mapa secao 5):
#  - dedup por (organizacao_id, nome), mantendo a linha MAIS ANTIGA (lote 03:03);
#    o lote das 04:34/04:35 e duplicata e cai fora;
#  - automacao sem versao ('Boas-vindas ao lead novo', 2 linhas) cai fora;
#  - toda coluna que aponta para usuarios sai do JSON (os qa.* nao existem no
#    destino) e credential_id/channel_session_id tambem: o loader decide o dono.
set -euo pipefail
cd "$(dirname "$0")"
DB="${1:-audit_onface_agentes}"
export PGOPTIONS='-c default_transaction_read_only=on'
PSQL=/opt/homebrew/bin/psql
URL="postgresql://callface@localhost:5432/$DB"

# exporta <arquivo> <consulta que devolve linhas com alias t, ja ordenadas por t.k>
exporta() {
  local out="$1" q="$2"
  $PSQL "$URL" -X -At -v ON_ERROR_STOP=1 -c \
    "select coalesce(jsonb_pretty(jsonb_agg(j order by k)), '[]') from ($q) x" > "configs/$out.tmp"
  mv "configs/$out.tmp" "configs/$out"
  echo "$out: $(jq length "configs/$out") linhas"
}

# Agentes: os 5 (NEXO, Hermes, SDR Assistente, Copiloto de CS, Organizador de Pipeline).
exporta ai_agents.json "select slug k, to_jsonb(t) - 'created_by_id' - 'published_version_id' j from ai_agents t"
exporta ai_agent_versions.json "select a.slug||':'||t.versao k, to_jsonb(t) - 'created_by_id' - 'credential_id' - 'channel_session_id' j from ai_agent_versions t join ai_agents a on a.id=t.agent_id"

# Automacoes: so as que tem versao; dedup por nome mantendo a mais antiga.
AUTO="(select distinct on (organizacao_id, nome) * from automacoes where current_version_id is not null order by organizacao_id, nome, created_at, id)"
exporta automacoes.json "select nome k, to_jsonb(t) - 'created_by_id' j from $AUTO t"
exporta automacao_versoes.json "select a.nome||':'||v.version k, to_jsonb(v) - 'created_by_id' j from automacao_versoes v join $AUTO a on a.id=v.automacao_id"

# Cadencias: dedup por nome (hoje 4 definicoes, 8 versoes, 4 ponteiros; enrollments ficam vazios).
CAD="(select distinct on (organizacao_id, nome) * from cadence_definitions order by organizacao_id, nome, created_at, id)"
exporta cadence_definitions.json "select nome k, to_jsonb(t) j from $CAD t"
exporta cadence_versions.json "select d.nome||':'||v.version_number k, to_jsonb(v) - 'created_by_id' j from cadence_versions v join $CAD d on d.id=v.cadence_definition_id"
exporta cadence_definition_pointers.json "select d.nome k, to_jsonb(p) j from cadence_definition_pointers p join $CAD d on d.id=p.cadence_definition_id"

# Templates e scripts: dedup por nome (a template de prod, de 14/09, e a mais antiga e fica).
for par in "whatsapp_templates nome" "email_templates nome" "scripts_atendimento titulo"; do
  set -- $par
  exporta "$1.json" "select t.$2 k, to_jsonb(t) j from (select distinct on (organizacao_id, $2) * from $1 order by organizacao_id, $2, created_at, id) t"
done
exporta contrato_templates.json "select t.nome||':'||t.versao k, to_jsonb(t) j from (select distinct on (organizacao_id, nome, versao) * from contrato_templates order by organizacao_id, nome, versao, created_at, id) t"
