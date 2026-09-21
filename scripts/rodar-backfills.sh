#!/bin/bash
# Roda TODOS os backfills do modelo canônico, na ordem, contra um banco.
#
# Existia um script por fase e nenhum runner: a ordem morava na cabeça de quem
# executava, e a virada não pode depender disso. Cada passo é idempotente por
# `backfill_provenance` — rodar duas vezes não duplica.
#
# O passo 16 é o que fecha a ordem: as migrations 0081/0084/0085 materializam
# etapa, estagnação e trial, mas só conseguem quando o canônico já existe. Numa
# produção virgem elas rodam com as tabelas vazias e tocam zero linhas. O 16
# roda DEPOIS dos backfills e é independente da ordem de construção do banco.
#
# Uso:
#   ./scripts/rodar-backfills.sh postgresql://callface@localhost:5432/banco
#   ./scripts/rodar-backfills.sh <url> --dry-run
set -euo pipefail

URL="${1:-}"
[ -z "$URL" ] && { echo "uso: $0 <DATABASE_URL> [--dry-run]" >&2; exit 1; }
MODO="--aplicar"
[ "${2:-}" = "--dry-run" ] && MODO=""

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
cd "$RAIZ/app"

PASSOS=(
  05-identidade
  06-aquisicao
  07-pipeline-oportunidade
  08-oferta-comercial
  09-proposta-contrato
  10-cliente-servico
  12-financeiro
  13-comunicacoes
  14-15-eventos-timeline
  16-materializacao-canonica
)

echo "banco: ${URL##*/}   modo: ${MODO:-dry-run}"
for p in "${PASSOS[@]}"; do
  echo ""
  echo "════ $p ════"
  DATABASE_URL="$URL" ./node_modules/.bin/tsx "src/scripts/backfill/$p.ts" $MODO
done
echo ""
echo "✓ backfills concluídos"
