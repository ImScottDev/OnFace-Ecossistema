#!/bin/bash
# Deploy do ONFACE: imagem pronta do GHCR → servidor → ambiente → migrations → troca.
#
#   ./deploy.sh homolog [<sha>]          # publica em HOMOLOGAÇÃO (sem sha: o HEAD, que tem que ser o origin/main)
#   ./deploy.sh producao --versao <sha>  # PROMOVE para produção o sha já validado em homologação (ou faz rollback)
#   ./deploy.sh producao                 # publica o HEAD direto em produção (tem que ser o origin/main)
#   ./deploy.sh <alvo> --seguir          # reata o acompanhamento de um deploy em curso
#   ./deploy.sh producao --construir-aqui # fallback: constrói na EC2 (lento; só se o GHCR cair)
#
# Alvos (mesma imagem, mesmo código; muda só onde roda):
#   producao → /opt/callface/crm2-dev, compose `crm2-dev`. O nome da PILHA no servidor ainda é
#             `crm2-dev` por herança: ela nasceu como ambiente de dev e virou produção em
#             13/10/2026, sem renomear container nem volume. Renomear a pilha exige dump/restore
#             do Postgres e janela combinada; até lá o ALVO que se digita diz a verdade e a pilha
#             guarda o nome velho. `dev` segue aceito como apelido do mesmo alvo.
#             https://crm.callface.io (CRM_DOMAIN no .env do servidor)
#   homolog → /opt/callface/crm2-homolog, compose `crm2-homolog`. .env idêntico ao de produção, banco próprio
#             (cópia). Travas: WhatsApp só para a allowlist, e-mail só @callface.ai: https://dev.crm.callface.io
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
  # `producao` é o nome correto; `dev` é o apelido herdado, mantido para não quebrar
  # automação antiga (workflow `publicar`, cron, alias de shell) de um dia para o outro.
  producao|dev)
    # Canoniza o apelido: o log e o marcador de fim no servidor são nomeados por
    # $ALVO, então `--seguir` precisa cair no mesmo arquivo seja qual for o nome digitado.
    ALVO=producao
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
    echo "uso: ./deploy.sh homolog [<sha>] | ./deploy.sh producao [--seguir | --versao <sha> | --construir-aqui]" >&2
    echo "     (o alvo 'dev' é apelido de 'producao': a pilha crm2-dev é a PRODUÇÃO desde 13/10/2026)" >&2
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

# ─── 0. A imagem deste commit existe? Se não, pedir que seja montada ────────
#
# O portão NÃO monta imagem a cada push: montava, e era o que torrava a cota de
# Actions do repositório privado (19/10/2026: 8 commits num dia viraram 16
# builds, para 5 deploys de verdade — a cota acabou no meio do dia e travou
# tudo). Agora a imagem sai sob demanda, e quem pede é este script, no commit
# que de fato vai para o ar.
#
# Só pede se faltar: deploy repetido do mesmo sha (promoção, rollback) acha a
# imagem pronta e não gasta nada.
if [ "$MODO" != "--construir-aqui" ]; then
  # O token sai do ambiente quando existe (GitHub Actions passa GITHUB_TOKEN) e
  # só então do credential helper do git, que é o caso da máquina de alguém.
  #
  # O `|| true` não é descuido: dentro do runner não há credencial configurada,
  # `git credential fill` sai com 128, e com `set -euo pipefail` o deploy morria
  # na primeira linha útil (20/10/2026). Ficar sem token aqui é estado
  # conhecido — significa só que o script não vai conseguir PEDIR a imagem, e
  # logo abaixo ele segue esperando que ela apareça.
  GH_TOKEN_DEPLOY="${GH_TOKEN_DEPLOY:-${GITHUB_TOKEN:-}}"
  if [ -z "$GH_TOKEN_DEPLOY" ]; then
    GH_TOKEN_DEPLOY="$( (printf 'protocol=https\nhost=github.com\n\n' | git credential fill 2>/dev/null || true) | sed -n 's/^password=//p' || true)"
  fi
  if [ -n "$GH_TOKEN_DEPLOY" ]; then
    JA_TEM=0
    for ALVO_IMG in app backend; do
      curl -fsS -o /dev/null \
        -H "Authorization: Bearer $GH_TOKEN_DEPLOY" \
        "https://ghcr.io/v2/imscottdev/onface-$ALVO_IMG/manifests/$REV" 2>/dev/null || JA_TEM=1
    done
    if [ "$JA_TEM" = "1" ]; then
      echo "[0/2] Imagem de $REV ainda não existe — pedindo ao portão que monte..."
      curl -fsS -X POST \
        -H "Authorization: Bearer $GH_TOKEN_DEPLOY" \
        -H "Accept: application/vnd.github+json" \
        "https://api.github.com/repos/ImScottDev/OnFace-Ecossistema/actions/workflows/portao.yml/dispatches" \
        -d "{\"ref\":\"main\",\"inputs\":{\"construir_imagem\":\"true\"}}" \
        && echo "    portão disparado; a espera abaixo cuida do resto." \
        || echo "    ⚠ não consegui disparar o portão; monte a imagem pelo GitHub ou use --construir-aqui." >&2
    fi
  else
    echo "⚠ sem credencial do GitHub aqui: se a imagem de $REV não existir, monte-a pelo portão antes." >&2
  fi
fi

# ─── 1. Código e infra do commit, espelhados no servidor ────────────────────
echo "[1/2] Enviando o commit..."
STAGE="/tmp/onface-release-$ALVO-$REV"
git archive --format=tar "$REV" | "${SSH[@]}" "rm -rf $STAGE && mkdir -p $STAGE && tar -x -C $STAGE"
# `/backups/` é do SERVIDOR, como .env e uploads. Os dumps lá dentro já eram
# protegidos um a um, e era justamente isso que travava: o rsync tentava apagar
# o diretório (ele não existe no repo), não conseguia por estar cheio de arquivo
# protegido, e derrubava o deploy inteiro (20/10/2026).
"${SSH[@]}" "sudo rsync -a --delete \
  --exclude=/.env --exclude=/.env.* \
  --exclude=/uploads/ --exclude=/app/public/uploads/ \
  --exclude=/infra/documenso/.env --exclude=/infra/documenso/certs/ \
  --exclude=/.onface-release \
  --exclude='_backup*' --exclude='*.sql.gz' --exclude='*.dump' --exclude='*.bak-*' \
  --exclude=/backups/ \
  $STAGE/ $DIR/ && rm -rf $STAGE"

# ─── Acesso ao GHCR: só durante o deploy ────────────────────────────────────
# O token vem do ambiente (GitHub Actions) ou do keychain de quem publica, e o
# servidor faz logout no fim do deploy: nenhum token fica gravado na EC2, que é
# dividida com produção, homolog e merencia.
#
# Reaproveita o token já resolvido lá em cima: o `git credential fill` solto
# aqui saía com 128 dentro de um runner, e derrubava o deploy DEPOIS de já ter
# enviado o código para o servidor (20/10/2026).
if [ "$MODO" != "--construir-aqui" ]; then
  TOKEN_GHCR="${GH_TOKEN_DEPLOY:-}"
  if [ -z "$TOKEN_GHCR" ]; then
    TOKEN_GHCR="$( (printf 'protocol=https\nhost=github.com\n\n' | git credential fill 2>/dev/null || true) | sed -n 's/^password=//p' || true)"
  fi
  [ -n "$TOKEN_GHCR" ] || { echo "✘ sem token do GitHub: no runner, passe GITHUB_TOKEN; na máquina, confira o keychain (RUNBOOK-DEPLOY no vault)" >&2; exit 1; }
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
# repassa o ambiente), e um 'up' manual depois não troca de versão.
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
    # Um teste seguido de && com bloco devolve 1 quando a condição é falsa, e
    # sob set -e isso MATAVA o roteiro na primeira volta: o deploy só funcionava
    # quando a imagem já estava publicada, e nunca esperava de fato por ela.
    if [ \$i = 120 ]; then
      echo "✘ imagens não apareceram no GHCR em 20 min (portão vermelho ou build falhou: veja o workflow 'portão' no GitHub)" >&2
      exit 1
    fi
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

if [ "$ALVO" = dev ] && ! sudo grep -q '^AREAS_EM_BREVE=' .env; then
  # Sem a variável a área abre (padrão do código). Em produção isso tem que ser decisão escrita.
  echo "✘ falta AREAS_EM_BREVE no .env de produção. Defina (AREAS_EM_BREVE=automacoes fecha Automações; vazio abre tudo) e rode de novo." >&2
  exit 1
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
    # Só camadas órfãs. Nunca '-a': a caixa é dividida com produção.
    sudo docker image prune -f >/dev/null 2>&1 || true
    # O cache de build nunca era podado e chegou a 9,4 GB com a caixa em 96%
    # (14/10/2026). As imagens vêm prontas do GHCR, então aqui ele só ocupa disco.
    sudo docker builder prune -f --filter until=168h >/dev/null 2>&1 || true
    # Nada de "teste && echo": com set -e, a condição falsa derruba o roteiro
    # inteiro — e aqui ela é falsa justamente quando está TUDO BEM com o disco.
    LIVRE=\$(df -BG --output=avail / | tail -1 | tr -dc 0-9)
    if [ "\${LIVRE:-99}" -lt 10 ]; then
      echo "⚠ disco da caixa com \${LIVRE}G livres — podar imagem antiga"
    fi
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
