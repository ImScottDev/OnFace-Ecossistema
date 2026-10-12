#!/bin/bash
# Prova que um dump do ONFACE restaura: cria um banco temporário, restaura,
# conta tabelas e linhas de leads/negocios/contatos, e apaga o temporário.
# Nunca toca o banco real.
#
#   infra/backup/testar-restauracao.sh /opt/callface/backups/onface/<arquivo>.dump
# Variáveis: PG_EXEC (padrão docker exec -i callface-crm2-dev-postgres), PGUSER
set -euo pipefail
DUMP="${1:?informe o arquivo .dump}"
PG_EXEC="${PG_EXEC-docker exec -i callface-crm2-dev-postgres}"
PGUSER="${PGUSER:-callface}"
TMP="restore_teste_$(date +%s)"

$PG_EXEC psql -U "$PGUSER" -d postgres -v ON_ERROR_STOP=1 -qc "CREATE DATABASE $TMP"
trap '$PG_EXEC psql -U "$PGUSER" -d postgres -qc "DROP DATABASE IF EXISTS $TMP" >/dev/null' EXIT
# --no-owner/--no-acl: o dono do banco de destino é quem restaura. Avisos de extensão não contam como erro.
$PG_EXEC pg_restore -U "$PGUSER" -d "$TMP" --no-owner --no-acl --exit-on-error < "$DUMP"
$PG_EXEC psql -U "$PGUSER" -d "$TMP" -Atc "
  SELECT 'tabelas=' || count(*) FROM information_schema.tables WHERE table_schema='public'
  UNION ALL SELECT 'leads=' || count(*) FROM leads
  UNION ALL SELECT 'negocios=' || count(*) FROM negocios
  UNION ALL SELECT 'contatos=' || count(*) FROM contatos
  UNION ALL SELECT 'whatsapp_mensagens=' || count(*) FROM whatsapp_mensagens"
echo "restauração ok: $(basename "$DUMP")"
