#!/bin/bash
# Deploy do ONFACE: imagem pronta do GHCR → servidor → ambiente → migrations → troca.
#
#   ./deploy.sh homolog [<sha>]        # publica em HOMOLOGAÇÃO (sem sha: o HEAD, que tem que ser o origin/main)
#   ./deploy.sh dev --versao <sha>     # PROMOVE para produção o sha já validado em homologação (ou faz rollback)
#   ./deploy.sh dev                    # publica o HEAD direto em produção (tem que ser o origin/main)
#   ./deploy.sh <alvo> --seguir        # reata o acompanhamento de um deploy em curso
#   ./deploy.sh dev --construir-aqui   # fallback: constrói na EC2 (lento; só se o GHCR cair)
#
# Alvos (mesma imagem, mesmo código; muda só onde roda):
#   dev     → /opt/callface/crm2-dev, compose `crm2-dev`. Desde a virada (13/10/2026) é a PRODUÇÃO: https://crm.callface.io (CRM_DOMAIN no .env do servidor)
#   homolog → /opt/callface/crm2-homolog, compose `crm2-homolog`. Cópia de produção com banco próprio
#             e SEM efeito colateral (sem Stripe, e-mail, WhatsApp): https://qa.crm.callface.io
#             Fluxo e preparo: docs/operacao/homologacao.md
#
# Regras que este script garante, e por quê:
#   - **A imagem NÃO é construída na EC2.** O GitHub Actions
#     (.github/workflows/portao.yml) publica `ghcr.io/imscottdev/onface-{app,
#     backend}:<sha>` a cada push na `main`, SÓ se o portão (typecheck +
#     travas de arquitetura) passar; aqui só se faz pull. Construindo na
#     EC2 (2 vCPU, dividida com produção, build preso a 1 CPU) o deploy levava
#     ~48 min (12/10/2026).
#   - Publica exatamente um commit: a imagem é a do sha, e o compose e a infra
#     vão por `git archive` do mesmo sha. Rsync de pasta de trabalho deixava no
#     servidor tudo que o repo apagou (05/10: uma tela que abria sem login).
#   - `--delete` espelha o repo, protegendo o que é do servidor: .env, uploads,
#     segredos do Documenso e backups.
#   - O trabalho roda DESTACADO no servidor: derrubar o terminal não interrompe
#     o deploy, e `--seguir` reata.
#   - Ambiente e migrations são conferidos com a imagem NOVA, antes de trocar
#     container. Com a imagem antiga a migration nova nunca é aplicada.
#   - IMAGE_TAG fica gravado no .env do servidor: um `docker compose up` manual
#     depois sobe a versão publicada, não a `:main` do momento.
#   - `.onface-release` registra o commit publicado, e só no fim.
#   - Rollback de código com `--versao` só é seguro sobre migrations aditivas:
#     migrations não voltam.
set -euo pipefail

ALVO="${1:-}"
MODO="${2:-}"
case "$ALVO" in
  dev)
    DIR=/opt/callface/crm2-dev
    PROJETO=crm2-dev
    CONTAINER_APP=callface-crm2-dev-app
    CONTAINER_WORKER=callface-crm2-dev-worker
    ;;
  homolog)
    DIR=/opt/callface/crm2-homolog
    PROJETO=crm2-homolog
    CONTAINER_APP=callface-crm2-homolog-app
    CONTAINER_WORKER=callface-crm2-homolog-worker
    ;;
  *)
    echo "uso: ./deploy.sh homolog [<sha>] | ./deploy.sh dev [--seguir | --versao <sha> | --construir-aqui]" >&2
    exit 1
    ;;
esac

HOST="${DEPLOY_HOST:-ubuntu@34.204.200.52}"
CHAVE="${DEPLOY_CHAVE:-$HOME/.ssh/infra_callface.pem}"
SSH=(ssh -o ServerAliveInterval=20 -o ServerAliveCountMax=3 -o ConnectTimeout=15 -i "$CHAVE" "$HOST")
REGISTRO=ghcr.io/imscottdev

cd "$(git rev-parse --show-toplevel)"
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
    sleep 10
  done
}

case "$MODO" in
  --seguir)
    REV="(em curso)"
    echo "=== reatando o acompanhamento de $ALVO ==="
    acompanhar
    exit $?
    ;;
  --versao)
    REV="$(git rev-parse --verify "${3:?informe o sha: ./deploy.sh $ALVO --versao <sha>}^{commit}")"
    ;;
  [0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]*)
    # Atalho da homologação: ./deploy.sh homolog <sha>
    [ "$ALVO" = homolog ] || { echo "✘ para produção use: ./deploy.sh dev --versao <sha>" >&2; exit 1; }
    REV="$(git rev-parse --verify "$MODO^{commit}")"
    MODO="--versao"
    ;;
  ""|--construir-aqui)
    if ! git diff --quiet || ! git diff --cached --quiet; then
      echo "✘ há mudança não commitada: o deploy publica só o que está no commit" >&2
      exit 1
    fi
    REV="$(git rev-parse HEAD)"
    if [ -z "$MODO" ]; then
      # A imagem só existe para o commit que chegou na `main` do GitHub.
      git fetch -q origin main
      if [ "$(git rev-parse origin/main)" != "$REV" ]; then
        echo "✘ HEAD ($REV) não é o origin/main ($(git rev-parse origin/main))." >&2
        echo "  Faça push (ou pull) antes: a imagem é construída pelo GitHub a partir da main." >&2
        exit 1
      fi
    fi
    ;;
  *)
    echo "✘ modo desconhecido: $MODO" >&2
    exit 1
    ;;
esac

echo "=== ONFACE → $ALVO ($REV) ==="

# Promoção: produção deve receber o sha que a homologação já está rodando.
# Só avisa (rollback também usa --versao, com sha antigo): não bloqueia.
if [ "$ALVO" = dev ] && [ "$MODO" = "--versao" ]; then
  VALIDADO="$("${SSH[@]}" "cat /opt/callface/crm2-homolog/.onface-release 2>/dev/null" 2>/dev/null || true)"
  if [ "$VALIDADO" = "$REV" ]; then
    echo "✓ é o mesmo sha que está validado em homologação."
  else
    echo "⚠ homologação está em: ${VALIDADO:-(nada publicado)}"
    echo "  Se isto é uma promoção, o sha não passou pela homologação. Rollback: ignore. Ctrl+C em 10s para cancelar."
    sleep 10
  fi
fi

# ─── 1. Código e infra do commit, espelhados no servidor ────────────────────
echo "[1/2] Enviando o commit..."
STAGE="/tmp/onface-release-$ALVO-$REV"
git archive --format=tar "$REV" | "${SSH[@]}" "rm -rf $STAGE && mkdir -p $STAGE && tar -x -C $STAGE"
"${SSH[@]}" "sudo rsync -a --delete \
  --exclude=/.env --exclude=/.env.* \
  --exclude=/uploads/ --exclude=/app/public/uploads/ \
  --exclude=/infra/documenso/.env --exclude=/infra/documenso/certs/ \
  --exclude=/.onface-release \
  --exclude='_backup*' --exclude='*.sql.gz' --exclude='*.dump' --exclude='*.bak-*' \
  $STAGE/ $DIR/ && rm -rf $STAGE"

# ─── Acesso ao GHCR: só durante o deploy ────────────────────────────────────
# O token vem do keychain deste Mac (o mesmo do git push) e o servidor faz
# logout no fim do deploy: nenhum token fica gravado na EC2, que é dividida
# com produção, homolog e merencia.
if [ "$MODO" != "--construir-aqui" ]; then
  TOKEN_GHCR="$(printf 'protocol=https\nhost=github.com\n\n' | git credential fill 2>/dev/null | sed -n 's/^password=//p')"
  [ -n "$TOKEN_GHCR" ] || { echo "✘ sem credencial do GitHub no keychain (ver RUNBOOK-DEPLOY no vault)" >&2; exit 1; }
  printf '%s' "$TOKEN_GHCR" | "${SSH[@]}" "sudo docker login ghcr.io -u imscottdev --password-stdin >/dev/null" \
    || { echo "✘ login no GHCR recusado" >&2; exit 1; }
fi

# ─── 2. Imagens, migrations e troca: no servidor, destacado ─────────────────
REMOTO="/tmp/onface-deploy-$ALVO.sh"
CORPO="$(mktemp)"
cat > "$CORPO" <<REMOTE
#!/bin/bash
set -euo pipefail
cd $DIR
t0=\$(date +%s)
trap 'sudo docker logout ghcr.io >/dev/null 2>&1 || true' EXIT

# A versão vai no .env ANTES de tudo: o compose lê IMAGE_TAG dele (sudo não
# repassa o ambiente), e um `up` manual depois não troca de versão.
sudo cp -p .env .env.bak-deploy
sudo sed -i '/^IMAGE_TAG=/d' .env
echo "IMAGE_TAG=$REV" | sudo tee -a .env >/dev/null
# Falhou antes da troca (pull, ambiente, migration): o .env volta a apontar
# para a versão que está rodando.
trap 'sudo cp -p .env.bak-deploy .env' ERR
etapa() { echo "[\$(( \$(date +%s) - t0 ))s] \$*"; }

if [ "$MODO" = "--construir-aqui" ]; then
  # Fallback. BuildKit num builder próprio preso a 1 CPU: a EC2 tem 2 vCPU e
  # produção roda nela (sem o limite o build derrubou produção em 01/10).
  sudo docker buildx inspect onface-lento >/dev/null 2>&1 || \
    sudo docker buildx create --name onface-lento --driver docker-container \
      --driver-opt cpuset-cpus=1 --driver-opt memory=4g --driver-opt memory-swap=9g >/dev/null
  for ALVO_IMG in backend app; do
    etapa "[build] \$ALVO_IMG na EC2 (o container antigo continua servindo)..."
    sudo docker buildx build --builder onface-lento --load --target \$ALVO_IMG \
      -t $REGISTRO/onface-\$ALVO_IMG:$REV . 2>&1 | tail -5
  done
else
  etapa "[imagens] esperando $REGISTRO/onface-{app,backend}:$REV no GHCR..."
  for i in \$(seq 1 120); do
    if sudo docker manifest inspect $REGISTRO/onface-app:$REV >/dev/null 2>&1 && \
       sudo docker manifest inspect $REGISTRO/onface-backend:$REV >/dev/null 2>&1; then
      break
    fi
    [ \$i = 120 ] && { echo "✘ imagens não apareceram no GHCR em 20 min (portão vermelho ou build falhou: veja o workflow 'portão' no GitHub)" >&2; exit 1; }
    sleep 10
  done
  etapa "[imagens] pull..."
  sudo docker compose -p $PROJETO pull -q worker api app
fi

if [ "$ALVO" = homolog ]; then
  # Banco e Redis da homologação sobem aqui se ainda não estiverem de pé
  # (no-op quando já estão). Em produção ficam como estão.
  sudo docker compose -p $PROJETO up -d --no-recreate postgres redis
fi

etapa "[ambiente] conferindo variáveis obrigatórias..."
sudo docker compose -p $PROJETO run --rm --no-deps --entrypoint '' api node app/dist/checar-env-runtime.mjs

etapa "[banco] migrations..."
if ! sudo docker compose -p $PROJETO run --rm --no-deps --entrypoint '' api \
     env MIGRATIONS_DIR=/repo/app/dist/migrations node app/dist/migrar.mjs --check; then
  sudo docker compose -p $PROJETO run --rm --no-deps --entrypoint '' api \
    env MIGRATIONS_DIR=/repo/app/dist/migrations node app/dist/migrar.mjs
fi

etapa "[troca] worker, api e app..."
sudo docker compose -p $PROJETO up -d --no-deps --no-build worker api app
trap - ERR

for i in \$(seq 1 45); do
  STATUS="\$(sudo docker inspect --format='{{.State.Health.Status}}' $CONTAINER_APP 2>/dev/null || echo starting)"
  if [ "\$STATUS" = healthy ]; then
    echo "$REV" | sudo tee $DIR/.onface-release >/dev/null
    # O worker carrega os jobs agendados e o sweep do outbox: se ele ficar
    # unhealthy, o pós-venda congela em silêncio.
    etapa "✓ app saudável · worker: \$(sudo docker inspect --format='{{.State.Health.Status}}' $CONTAINER_WORKER 2>/dev/null || echo '?')"
    # Só camadas órfãs. Nunca `-a`: a caixa é dividida com produção.
    sudo docker image prune -f >/dev/null 2>&1 || true
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

echo "[2/2] Imagens, migrations e troca rodando no servidor (seguem mesmo se este terminal cair)."
echo "      Para reatar: ./deploy.sh $ALVO --seguir"
acompanhar
