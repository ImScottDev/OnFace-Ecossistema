#!/bin/bash
# Muda UMA variável do .env de PRODUÇÃO (/opt/callface/crm2-dev) e recria os
# containers que estiverem de pé.
#
#   scripts/producao-env.sh ver CHAVE          # diz se existe e a impressão digital, nunca o valor
#   scripts/producao-env.sh set CHAVE=valor    # grava e recria api, app e worker
#
# É o irmão de `scripts/homolog-servidor.sh env`, para o ambiente onde o time
# está trabalhando. Por isso, três cuidados que o de homologação não precisa ter:
#
#   1. Faz backup do .env antes de escrever, com data e hora no nome.
#   2. `ver` mostra impressão digital (sha256 curto), nunca o valor. Serve para
#      conferir se dois ambientes têm o mesmo segredo sem expor nenhum dos dois.
#   3. Recusa valor com espaço ou aspas, como o de homologação, para não quebrar
#      o arquivo com uma linha malformada.
#
# O valor passa por este terminal, então um segredo colado aqui fica no
# histórico do shell. Para segredo novo, prefira gerar NO servidor.
set -euo pipefail
HOST="${DEPLOY_HOST:-ubuntu@34.204.200.52}"
CHAVE="${DEPLOY_CHAVE:-$HOME/.ssh/infra_callface.pem}"
SSH=(ssh -o ConnectTimeout=15 -i "$CHAVE" "$HOST")
DIR=/opt/callface/crm2-dev

case "${1:-}" in
ver)
  CH="${2:?uso: scripts/producao-env.sh ver CHAVE}"
  "${SSH[@]}" "bash -s" "$CH" <<'REMOTE'
set -euo pipefail
cd /opt/callface/crm2-dev
V="$(sudo grep "^$1=" .env | head -1 | cut -d= -f2-)"
if [ -z "$V" ]; then echo "$1: AUSENTE"; else
  echo "$1: definido, impressão digital $(printf %s "$V" | sha256sum | cut -c1-12)"
fi
REMOTE
  ;;
set)
  PAR="${2:?uso: scripts/producao-env.sh set CHAVE=valor}"
  [[ "$PAR" =~ ^[A-Z0-9_]+=[A-Za-z0-9_.,:/@-]*$ ]] || { echo "formato: CHAVE=valor (sem espaço nem aspas)" >&2; exit 1; }
  "${SSH[@]}" "bash -s" "$PAR" <<'REMOTE'
set -euo pipefail
cd /opt/callface/crm2-dev
CH="${1%%=*}"
sudo cp .env ".env.bak-$(date +%Y%m%d-%H%M%S)"
sudo sed -i "/^$CH=/d" .env && echo "$1" | sudo tee -a .env >/dev/null
RODANDO="$(sudo docker compose -p crm2-dev ps --status running --services | grep -E '^(worker|api|app)$' | tr '\n' ' ' || true)"
[ -z "$RODANDO" ] || sudo docker compose -p crm2-dev up -d --no-deps --force-recreate $RODANDO
echo "OK $CH atualizado${RODANDO:+ (recriados: $RODANDO)}"
REMOTE
  ;;
*)
  echo "uso: scripts/producao-env.sh ver CHAVE | set CHAVE=valor" >&2
  exit 1
  ;;
esac
