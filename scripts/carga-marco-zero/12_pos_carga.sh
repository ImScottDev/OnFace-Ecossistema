#!/usr/bin/env bash
# PASSO 12 · Pos-carga (mapa secao 3, ordem 12). SO depois dos passos 1 a 11 e dos checks verdes.
#
#   1. Sweep de CS (health, riscos, renovacoes) e as tarefas de risco/renovacao, ja com
#      a Jenifer como dona (os clientes foram carregados com ela no passo 8). E o unico
#      jeito de regerar as tarefas cs_risco que nao existem em prod (P10): o sweep do
#      app e idempotente, entao rodar de novo e seguro.
#   2. Relatorio do que ficou aberto (reconciliacao_casos) e dos clientes sem dono.
#
# NAO liga o stripe-sync: ele fica desligado ate "assinatura nao cria contrato" estar no codigo.
# NAO sobe worker, nao mexe em allowlist (checklist 3.1 do handoff e do Scott).
#
# Uso: ./12_pos_carga.sh <banco_alvo>      (host/usuario do .env do app nao sao usados)
set -euo pipefail
# O run.sh passa o banco em ALVO (ambiente); chamado a mao, vale o argumento.
ALVO="${1:-${ALVO:-}}"
[ -n "$ALVO" ] || { echo "uso: $0 <banco_alvo> (ou ALVO no ambiente)" >&2; exit 1; }
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
PSQL=/opt/homebrew/bin/psql
URL="postgresql://callface@localhost:5432/$ALVO"

# Trava: o sweep ESCREVE (cs_health, riscos, tarefas). O banco de dev do Scott nao pode ser o alvo.
case "$ALVO" in
  callface_crm|audit_prod|audit_onface|audit_onface_agentes)
    echo "recusado: '$ALVO' nao e banco de carga" >&2; exit 1 ;;
esac

ORG=$($PSQL "$URL" -X -At -c "select id from organizacoes" )
[ "$(echo "$ORG" | wc -l)" -eq 1 ] || { echo "esperava 1 organizacao, achou: $ORG" >&2; exit 1; }

# tsx -e dentro do app: os aliases @/ vem do tsconfig. A saida e o ResultadoSweep em JSON.
cd "$RAIZ/app"
DATABASE_URL="$URL" ORG="$ORG" pnpm exec tsx -e '
import { rodarSweepCs } from "@/lib/cs/sweep";
rodarSweepCs(process.env.ORG!).then((r) => { console.log(JSON.stringify(r, null, 2)); process.exit(0); })
  .catch((e) => { console.error(e); process.exit(1); });'

$PSQL "$URL" -X -v ON_ERROR_STOP=1 <<'SQL'
select 'tarefas por origem' as o, origem, count(*) from tarefas group by origem order by origem;
select 'tarefas cs_risco' as o, count(*) from tarefas where tipo = 'cs_risco';
select 'clientes sem dono (esperado 0)' as o, count(*) from clientes where responsavel_id is null;
select 'reconciliacao_casos abertos' as o, tipo, count(*) from reconciliacao_casos where status = 'OPEN' group by tipo;
SQL
