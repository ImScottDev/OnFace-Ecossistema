#!/bin/bash
# Deploy do ONFACE: commit do repo → servidor → imagens → ambiente → migrations → troca.
#
#   ./deploy.sh dev            # roda da raiz do repo, na máquina de quem publica
#   ./deploy.sh dev --seguir   # reata o acompanhamento de um deploy já em curso
#
# Alvos:
#   dev  → /opt/callface/crm2-dev, compose `crm2-dev`, https://dev.crm.callface.io
#
# Produção não tem alvo aqui de propósito: a virada é um procedimento à parte
# (docs/operacao/virada/) e só acontece com o OK do Kauã.
#
# Regras que este script garante, e por quê:
#   - Publica exatamente um commit (`git archive HEAD`). Rsync de pasta de
#     trabalho levava lixo local e deixava no servidor tudo que o repo apagou:
#     em 05/10 o servidor tinha 73 arquivos que o repo já não tinha, entre eles
#     uma tela que abria sem login.
#   - `--delete` espelha o repo, protegendo o que é do servidor: .env, uploads,
#     segredos do Documenso e backups (deploy nunca apaga backup).
#   - **O trabalho pesado roda DESTACADO no servidor.** Em 05/10 a conexão ssh
#     caiu no meio do `next build`: o build morreu junto e o deploy terminou
#     dizendo que estava construindo, sem ter trocado nada. Agora o cliente só
#     acompanha um log; derrubar o terminal não interrompe o deploy, e
#     `--seguir` reata.
#   - Build com --cpuset-cpus=1, uma imagem por vez: a EC2 tem 2 vCPU e
#     produção roda na mesma máquina. Sem isso o build derrubou produção (01/10).
#   - Ambiente e migrations são conferidos com a imagem NOVA, antes de trocar
#     container. Com a imagem antiga a migration nova nunca é aplicada.
#   - `.onface-release` registra o commit publicado, e só no fim: se ele não
#     mudou, o deploy não chegou ao fim.
set -euo pipefail

ALVO="${1:-}"
SEGUIR="${2:-}"
case "$ALVO" in
  dev)
    DIR=/opt/callface/crm2-dev
    PROJETO=crm2-dev
    PREFIXO_IMAGEM=crm2-dev
    CONTAINER_APP=callface-crm2-dev-app
    CONTAINER_WORKER=callface-crm2-dev-worker
    ;;
  *)
    echo "uso: ./deploy.sh dev [--seguir]" >&2
    exit 1
    ;;
esac

HOST="${DEPLOY_HOST:-ubuntu@34.204.200.52}"
CHAVE="${DEPLOY_CHAVE:-$HOME/.ssh/infra_callface.pem}"
SSH=(ssh -o ServerAliveInterval=20 -o ServerAliveCountMax=3 -o ConnectTimeout=15 -i "$CHAVE" "$HOST")

cd "$(git rev-parse --show-toplevel)"
REV="$(git rev-parse HEAD)"
LOG="/tmp/onface-deploy-$ALVO.log"
FIM="/tmp/onface-deploy-$ALVO.fim"

# Segue o log remoto até o marcador de fim aparecer. Uma queda de rede aqui só
# interrompe a LEITURA: o deploy continua no servidor.
acompanhar() {
  local linha=0 novo codigo
  while true; do
    novo="$("${SSH[@]}" "tail -n +$((linha + 1)) $LOG 2>/dev/null" 2>/dev/null || true)"
    if [ -n "$novo" ]; then
      printf '%s\n' "$novo"
      linha=$((linha + $(printf '%s\n' "$novo" | wc -l)))
    fi
    codigo="$("${SSH[@]}" "cat $FIM 2>/dev/null" 2>/dev/null || true)"
    if [ -n "$codigo" ]; then
      [ "$codigo" = 0 ] && { echo "✓ publicado: $REV"; return 0; }
      echo "✘ deploy falhou (código $codigo)" >&2
      return 1
    fi
    sleep 15
  done
}

if [ "$SEGUIR" = "--seguir" ]; then
  echo "=== reatando o acompanhamento de $ALVO ==="
  acompanhar
  exit $?
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "✘ há mudança não commitada: o deploy publica só o que está no commit" >&2
  exit 1
fi

echo "=== ONFACE → $ALVO ($REV) ==="

# ─── 1. Código: o commit, espelhado no servidor ─────────────────────────────
echo "[1/2] Enviando o commit..."
STAGE="/tmp/onface-release-$REV"
git archive --format=tar HEAD | "${SSH[@]}" "rm -rf $STAGE && mkdir -p $STAGE && tar -x -C $STAGE"
"${SSH[@]}" "sudo rsync -a --delete \
  --exclude=/.env --exclude=/.env.* \
  --exclude=/uploads/ --exclude=/app/public/uploads/ \
  --exclude=/infra/documenso/.env --exclude=/infra/documenso/certs/ \
  --exclude=/.onface-release \
  --exclude='_backup*' --exclude='*.sql.gz' --exclude='*.dump' --exclude='*.bak-*' \
  $STAGE/ $DIR/ && rm -rf $STAGE"

# ─── 2. Build, migrations e troca: no servidor, destacado ───────────────────
REMOTO="/tmp/onface-deploy-$ALVO.sh"
CORPO="$(mktemp)"
cat > "$CORPO" <<REMOTE
#!/bin/bash
set -euo pipefail
cd $DIR

for SERVICO in app api worker; do
  ARQ=Dockerfile; [ "\$SERVICO" = app ] || ARQ="Dockerfile.\$SERVICO"
  echo "[build] \$SERVICO (o container antigo continua servindo)..."
  sudo env DOCKER_BUILDKIT=0 docker build --cpuset-cpus=1 --memory=4g --memory-swap=9g \
    -f "\$ARQ" -t "$PREFIXO_IMAGEM-\$SERVICO" . 2>&1 | tail -5
done

echo "[ambiente] conferindo variáveis obrigatórias..."
sudo docker compose -p $PROJETO run --rm --no-deps --entrypoint '' api node app/dist/checar-env-runtime.mjs

echo "[banco] migrations..."
if ! sudo docker compose -p $PROJETO run --rm --no-deps --entrypoint '' api \
     env MIGRATIONS_DIR=/repo/app/dist/migrations node app/dist/migrar.mjs --check; then
  sudo docker compose -p $PROJETO run --rm --no-deps --entrypoint '' api \
    env MIGRATIONS_DIR=/repo/app/dist/migrations node app/dist/migrar.mjs
fi

echo "[troca] worker, api e app..."
sudo docker compose -p $PROJETO up -d --no-deps --no-build worker api app

for i in \$(seq 1 45); do
  STATUS="\$(sudo docker inspect --format='{{.State.Health.Status}}' $CONTAINER_APP 2>/dev/null || echo starting)"
  if [ "\$STATUS" = healthy ]; then
    echo "$REV" | sudo tee $DIR/.onface-release >/dev/null
    # O worker carrega os jobs agendados e o sweep do outbox: se ele ficar
    # unhealthy, o pós-venda congela em silêncio.
    echo "✓ app saudável · worker: \$(sudo docker inspect --format='{{.State.Health.Status}}' $CONTAINER_WORKER 2>/dev/null || echo '?')"
    exit 0
  fi
  echo "  aguardando app... (\$STATUS) [\$i/45]"
  sleep 2
done
echo "⚠ o app não ficou saudável em 90s" >&2
sudo docker logs $CONTAINER_APP --tail 30 >&2
exit 1
REMOTE

"${SSH[@]}" "cat > $REMOTO && chmod +x $REMOTO && rm -f $LOG $FIM" < "$CORPO"
rm -f "$CORPO"
"${SSH[@]}" "setsid nohup bash -c '$REMOTO > $LOG 2>&1; echo \$? > $FIM' >/dev/null 2>&1 < /dev/null &"

echo "[2/2] Build, migrations e troca rodando no servidor (seguem mesmo se este terminal cair)."
echo "      Para reatar: ./deploy.sh $ALVO --seguir"
acompanhar
