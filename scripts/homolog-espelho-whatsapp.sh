#!/bin/bash
# Liga/desliga o ESPELHO do WhatsApp recebido: o relé (container callface-wa-relay) entrega cada
# mensagem a produção (principal) e COPIA para a homologação. Ver docs/operacao/homologacao.md.
#
#   scripts/homolog-espelho-whatsapp.sh status
#   scripts/homolog-espelho-whatsapp.sh desligar    # produção segue igual; homologação deixa de receber
#   scripts/homolog-espelho-whatsapp.sh ligar
#
# Só mexe em /opt/callface/wa-relay/nginx.conf (backup antes, nginx -t antes do reload).
# O segredo do webhook nunca é impresso. O arquivo é regravado NO LUGAR (é montado no container
# como arquivo único: trocar o arquivo por outro deixaria o container com a versão antiga).
set -euo pipefail
HOST="${DEPLOY_HOST:-ubuntu@34.204.200.52}"
CHAVE="${DEPLOY_CHAVE:-$HOME/.ssh/infra_callface.pem}"
ACAO="${1:?uso: $0 status|ligar|desligar}"
[[ "$ACAO" =~ ^(status|ligar|desligar)$ ]] || { echo "uso: $0 status|ligar|desligar" >&2; exit 1; }
ssh -o ConnectTimeout=15 -i "$CHAVE" "$HOST" "bash -s" "$ACAO" <<'REMOTE'
set -euo pipefail
R=/opt/callface/wa-relay/nginx.conf
estado() { sudo grep -q '^ *mirror /mirror;' $R && echo LIGADO || echo DESLIGADO; }
case "$1" in
status) echo "espelho para a homologação: $(estado)" ;;
ligar|desligar)
  sudo cp -p $R $R.bak-espelho-$(date +%Y%m%d-%H%M%S)
  sudo cat $R | python3 -c '
import sys, re
c = sys.stdin.read()
c = re.sub(r"\n *mirror /mirror;\n *mirror_request_body on;", "", c)
if sys.argv[1] == "ligar":
    c = c.replace("    location / {\n", "    location / {\n      mirror /mirror;\n      mirror_request_body on;\n", 1)
sys.stdout.write(c)' "$1" > /tmp/wa-relay.cand
  docker run --rm -v /tmp/wa-relay.cand:/etc/nginx/nginx.conf:ro nginx:alpine nginx -t >/dev/null 2>&1 || { rm -f /tmp/wa-relay.cand; echo "config inválida; nada foi alterado" >&2; exit 1; }
  sudo sh -c "cat /tmp/wa-relay.cand > $R"; rm -f /tmp/wa-relay.cand
  docker exec callface-wa-relay nginx -t 2>&1 | tail -1
  docker exec callface-wa-relay nginx -s reload
  echo "espelho para a homologação: $(estado)" ;;
esac
REMOTE
