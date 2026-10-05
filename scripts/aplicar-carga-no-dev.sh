#!/bin/bash
# Leva para o DEV (dev.crm.callface.io) o banco da virada JÁ CONSTRUÍDO e
# validado no Mac.
#
# POR QUE ASSIM, e não rodando a carga lá: a EC2 tem 2 vCPU e hospeda a
# PRODUÇÃO que está no ar. Um build normal já saturou essa máquina e derrubou
# produção por ~15 min (01/10). Migrations + 11 backfills + carga são trabalho
# de CPU e I/O que não tem por que acontecer lá. Aqui o banco é construído,
# conferido e só então enviado: na EC2 sobra um `pg_restore`, que é barato.
#
# O que este script NÃO faz, de propósito:
#   - não encosta em produção (crm.callface.io). Nada. Nem leitura.
#   - não troca o DNS nem promove o DEV a produção. A virada é do Scott.
#
# Uso:
#   ./scripts/aplicar-carga-no-dev.sh                      # usa o banco padrão
#   ./scripts/aplicar-carga-no-dev.sh callface_crm_ensaio_virada
set -euo pipefail

ORIGEM_LOCAL="${1:-callface_crm_ensaio_virada}"
SSH_KEY="$HOME/.ssh/infra_callface.pem"
EC2="ubuntu@34.204.200.52"
PG_DEV="callface-crm2-dev-postgres"      # container do Postgres do DEV
DB_DEV="callface_crm_novo"               # o banco que app/api/worker usam
DB_NOVO="callface_crm_virada"            # destino da carga, criado do zero
CARIMBO="$(date +%Y%m%d-%H%M)"
DUMP_LOCAL="/Users/Scott/callface-virada/carga-para-dev-$CARIMBO.dump"
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"

ssh_ec2() { ssh -o ConnectTimeout=20 -i "$SSH_KEY" "$EC2" "$@"; }

echo "══ 1/7 · conferindo o banco de origem ($ORIGEM_LOCAL)"
# Gate: não enviar banco vazio ou meio construído. Os números são os medidos
# em 05/10; se divergirem muito, algo mudou e vale olhar antes de empurrar.
psql -U callface -h localhost -d "$ORIGEM_LOCAL" -X -q -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE n_leads int; n_aq int; n_tl int; n_com int;
BEGIN
  SELECT count(*) INTO n_leads FROM leads;
  SELECT count(*) INTO n_aq    FROM aquisicoes;
  SELECT count(*) INTO n_tl    FROM timeline_events;
  SELECT count(*) INTO n_com   FROM communications;
  RAISE NOTICE 'leads=% aquisicoes=% timeline=% communications=%', n_leads, n_aq, n_tl, n_com;
  IF n_leads < 4000 OR n_aq < 4000 OR n_tl < 25000 OR n_com < 40000 THEN
    RAISE EXCEPTION 'banco de origem parece incompleto — NÃO vou enviar';
  END IF;
END $$;
SQL

echo "══ 2/7 · dump do banco pronto"
pg_dump -U callface -h localhost -d "$ORIGEM_LOCAL" -Fc -Z6 -f "$DUMP_LOCAL"
echo "   $(du -h "$DUMP_LOCAL" | cut -f1)  $DUMP_LOCAL"

echo "══ 3/7 · BACKUP do DEV atual (o rollback mora aqui)"
# Sem isso não há volta. O DEV de hoje tem coisa que só existe nele: agentes
# NEXO/Lia, templates de contrato de 01/10, credenciais de integração.
ssh_ec2 "docker exec $PG_DEV pg_dump -U callface -d $DB_DEV -Fc -Z6 \
  > /opt/callface/backup-dev-pre-carga-$CARIMBO.dump && \
  ls -lh /opt/callface/backup-dev-pre-carga-$CARIMBO.dump"

echo "══ 4/7 · enviando o dump"
scp -i "$SSH_KEY" "$DUMP_LOCAL" "$EC2:/tmp/carga-$CARIMBO.dump"
ssh_ec2 "docker cp /tmp/carga-$CARIMBO.dump $PG_DEV:/tmp/carga.dump"

echo "══ 5/7 · restaurando num banco NOVO ($DB_NOVO), sem tocar no atual"
# O banco em uso continua intacto durante todo o restore. A troca é no passo 6,
# e é instantânea.
ssh_ec2 "docker exec $PG_DEV psql -U callface -d postgres -v ON_ERROR_STOP=1 \
    -c \"DROP DATABASE IF EXISTS $DB_NOVO\" \
    -c \"CREATE DATABASE $DB_NOVO OWNER callface\" && \
  nice -n 10 docker exec $PG_DEV pg_restore -U callface -d $DB_NOVO \
    --no-owner --no-privileges /tmp/carga.dump"

echo "══ 6/7 · conferindo o banco restaurado ANTES de trocar"
ssh_ec2 "docker exec $PG_DEV psql -U callface -d $DB_NOVO -X -c \
  \"SELECT (SELECT count(*) FROM leads) leads, (SELECT count(*) FROM aquisicoes) aquisicoes, \
           (SELECT count(*) FROM timeline_events) timeline, (SELECT count(*) FROM communications) comunicacoes, \
           (SELECT count(*) FROM clientes) clientes;\""

cat <<EOF

══ 7/7 · TROCA — não é automática, é sua

O banco novo está no ar como '$DB_NOVO', ao lado do atual. Confira os números
acima contra os do Mac. Batendo, troque:

  # parar quem escreve (só DEV; produção segue intacta)
  ssh -i $SSH_KEY $EC2
  cd /opt/callface/crm2-dev && docker compose stop app api worker

  # renomear: o atual vira _antigo, o novo assume o nome que o app procura
  docker exec $PG_DEV psql -U callface -d postgres \\
    -c "ALTER DATABASE $DB_DEV RENAME TO ${DB_DEV}_antigo_$CARIMBO" \\
    -c "ALTER DATABASE $DB_NOVO RENAME TO $DB_DEV"

  # fuso: app/api/worker rodam em UTC e o navegador em São Paulo. Sem isso,
  # depois das 21h "hoje" vira "ontem" nas telas que contam dias.
  # Acrescentar TZ=America/Sao_Paulo ao environment dos três serviços.

  docker compose up -d app api worker

ROLLBACK, se algo sair errado:
  docker compose stop app api worker
  docker exec $PG_DEV psql -U callface -d postgres \\
    -c "ALTER DATABASE $DB_DEV RENAME TO $DB_NOVO" \\
    -c "ALTER DATABASE ${DB_DEV}_antigo_$CARIMBO RENAME TO $DB_DEV"
  docker compose up -d app api worker

O backup do DEV anterior também está em
/opt/callface/backup-dev-pre-carga-$CARIMBO.dump
EOF
