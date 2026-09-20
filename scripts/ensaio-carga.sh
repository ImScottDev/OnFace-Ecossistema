#!/bin/bash
# Ensaio geral da virada: pega o dump de produção, restaura num banco RASCUNHO
# local, aplica os passos de carga e a cadeia de migrações de dev, e roda os
# checks de sanidade.
#
# É a mesma receita que roda em homolog (sábado) e em prod (domingo) — a única
# diferença é o banco de destino. Aqui é sempre local.
#
# NADA neste script escreve em servidor. O único acesso remoto é um pg_dump de
# leitura dentro do container de produção.
#
# Uso:
#   ./scripts/ensaio-carga.sh                   # baixa dump novo e roda tudo
#   ./scripts/ensaio-carga.sh /caminho/do.dump  # reaproveita um dump já baixado
set -euo pipefail

SSH_KEY="$HOME/.ssh/infra_callface.pem"
EC2_HOST="ubuntu@34.204.200.52"
REMOTE_CONTAINER="callface-crm-postgres"
DB_RASCUNHO="${DB_RASCUNHO:-callface_crm_ensaio}"
LOCAL_USER="callface"
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"

# Trava de segurança: este script faz `dropdb` no banco de destino. Lista de
# proibidos não serve — bastaria um typo ('callface_crm2', 'callface_crm_old')
# para destruir outro banco local. A trava é allowlist: o nome TEM que começar
# com `callface_crm_ensaio`, qualquer outra coisa aborta.
if [[ ! "$DB_RASCUNHO" =~ ^callface_crm_ensaio ]]; then
  echo "✘ DB_RASCUNHO='$DB_RASCUNHO' recusado." >&2
  echo "  Este script DROPA o banco de destino. Só aceita nome que comece com" >&2
  echo "  'callface_crm_ensaio' — assim nenhum typo alcança o banco de dev" >&2
  echo "  ('callface_crm') nem qualquer outro banco local." >&2
  exit 1
fi

DUMP="${1:-}"
if [ -z "$DUMP" ]; then
  DUMP="/tmp/callface-crm-prod-$(date +%Y%m%d-%H%M%S).dump"
  echo "[1/6] pg_dump de produção (somente leitura)…"
  ssh -i "$SSH_KEY" "$EC2_HOST" \
    "docker exec $REMOTE_CONTAINER pg_dump -U callface -d callface_crm -Fc -Z6" > "$DUMP"
else
  echo "[1/6] reaproveitando dump $DUMP"
fi
echo "      dump: $DUMP ($(du -h "$DUMP" | cut -f1))"

echo "[2/6] recriando o banco rascunho '$DB_RASCUNHO'…"
dropdb --if-exists -U "$LOCAL_USER" -h localhost "$DB_RASCUNHO"
createdb -O "$LOCAL_USER" -U "$LOCAL_USER" -h localhost "$DB_RASCUNHO"

echo "[3/6] restaurando o dump…"
pg_restore -U "$LOCAL_USER" -h localhost -d "$DB_RASCUNHO" --no-owner --no-privileges "$DUMP"

URL="postgresql://$LOCAL_USER@localhost:5432/$DB_RASCUNHO"

# Foto das contagens ANTES de qualquer escrita — é contra ela que o check de
# sanidade compara depois. Sem isso, "não perdi dado" seria só opinião.
psql "$URL" -v ON_ERROR_STOP=1 -q <<'SQL'
CREATE TABLE _carga_contagem_antes (tabela text PRIMARY KEY, linhas bigint NOT NULL);
DO $$
DECLARE r record; n bigint;
BEGIN
  FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
            WHERE ns.nspname = 'public' AND c.relkind = 'r' AND c.relname <> '_carga_contagem_antes' LOOP
    EXECUTE format('SELECT count(*) FROM %I', r.relname) INTO n;
    INSERT INTO _carga_contagem_antes VALUES (r.relname, n);
  END LOOP;
END $$;
SQL

echo "[4/6] carga, fase 1 — reconciliar o que prod tem fora do padrão…"
for passo in "$RAIZ"/app/src/lib/db/carga/1-antes-da-cadeia/*.sql; do
  echo "      → $(basename "$passo")"
  psql "$URL" -v ON_ERROR_STOP=1 -q -f "$passo"
done

echo "[5/6] cadeia de migrações de dev…"
# 0000 é a única migration não idempotente (CREATE TABLE cru) e já está aplicada
# em qualquer banco vindo de produção. Marcar como baseline evita reexecutá-la.
psql "$URL" -v ON_ERROR_STOP=1 -q <<SQL
CREATE TABLE IF NOT EXISTS _migracoes_aplicadas (
  nome text PRIMARY KEY, hash text NOT NULL,
  aplicada_em timestamptz NOT NULL DEFAULT now(),
  baseline boolean NOT NULL DEFAULT false);
INSERT INTO _migracoes_aplicadas (nome, hash, baseline)
VALUES ('0000_gifted_silver_samurai.sql',
        '$(shasum -a 256 "$RAIZ/app/src/lib/db/migrations/0000_gifted_silver_samurai.sql" | cut -d' ' -f1)',
        true)
ON CONFLICT (nome) DO NOTHING;
SQL
# A cadeia para em 0012 para o patch de drift entrar antes de 0033/0039, que
# leem colunas que nenhuma migration cria. Ver carga/2-depois-de-0012/.
( cd "$RAIZ/app" && DATABASE_URL="$URL" ./node_modules/.bin/tsx src/lib/db/migrar.ts --ate=0012 )

echo "      carga, fase 2 — drift de dev não versionado…"
for passo in "$RAIZ"/app/src/lib/db/carga/2-depois-de-0012/*.sql; do
  echo "      → $(basename "$passo")"
  psql "$URL" -v ON_ERROR_STOP=1 -q -f "$passo"
done

echo "      cadeia, resto…"
( cd "$RAIZ/app" && DATABASE_URL="$URL" ./node_modules/.bin/tsx src/lib/db/migrar.ts )

echo "[6/6] checks de sanidade…"
"$RAIZ/scripts/checar-carga.sh" "$DB_RASCUNHO"

echo "✓ ensaio concluído em '$DB_RASCUNHO' (dump: $DUMP)"
