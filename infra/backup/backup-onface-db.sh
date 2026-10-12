#!/bin/bash
# Backup diário do Postgres do ONFACE (banco callface_crm_mz no container
# callface-crm2-dev-postgres), formato custom do pg_dump (-Fc), retenção de 14 dias.
#
# Instalação na EC2 (cron do usuário ubuntu), uma linha:
#   30 2 * * * /usr/bin/flock -n /tmp/backup_onface.lock /opt/callface/crm2-dev/infra/backup/backup-onface-db.sh >> /opt/callface/backups/onface/backup.log 2>&1
#
# Teste de restauração (prova que o dump serve): infra/backup/testar-restauracao.sh <dump>
#
# Variáveis (todas com padrão do servidor; para rodar local, PG_EXEC="" e PGUSER/PGDATABASE do .env):
#   PG_EXEC        prefixo do comando (padrão: docker exec callface-crm2-dev-postgres)
#   PGUSER, PGDATABASE, BACKUP_DIR, RETENCAO_DIAS
set -euo pipefail

PG_EXEC="${PG_EXEC-docker exec callface-crm2-dev-postgres}"
PGUSER="${PGUSER:-callface}"
PGDATABASE="${PGDATABASE:-callface_crm_mz}"
BACKUP_DIR="${BACKUP_DIR:-/opt/callface/backups/onface}"
RETENCAO_DIAS="${RETENCAO_DIAS:-14}"

mkdir -p "$BACKUP_DIR"
ARQ="$BACKUP_DIR/${PGDATABASE}-$(date +%Y%m%d-%H%M%S).dump"

# O dump vai direto para o arquivo (sem pipe); qualquer falha apaga o parcial.
if ! $PG_EXEC pg_dump -U "$PGUSER" -Fc --no-owner --no-acl "$PGDATABASE" > "$ARQ"; then
  echo "ERRO: pg_dump falhou" >&2; rm -f "$ARQ"; exit 1
fi
if [ ! -s "$ARQ" ]; then echo "ERRO: dump vazio" >&2; rm -f "$ARQ"; exit 1; fi
# Cabeçalho do formato custom começa com PGDMP: dump truncado ou de texto não passa.
if ! head -c 5 "$ARQ" | grep -q PGDMP; then echo "ERRO: arquivo não é um dump custom válido" >&2; rm -f "$ARQ"; exit 1; fi

# Poda só depois de provar que o de hoje existe.
find "$BACKUP_DIR" -name "${PGDATABASE}-*.dump" -mtime +"$RETENCAO_DIAS" -delete
echo "$(date +%FT%T) backup ok: $(basename "$ARQ") ($(du -h "$ARQ" | cut -f1))"
