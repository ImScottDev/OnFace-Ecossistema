#!/bin/bash
# Roda TODOS os aceites de jornada, na ordem, contra o banco apontado por
# DATABASE_URL (o `.env` do app, por padrão).
#
# POR QUE ESTE SCRIPT EXISTE. O passo 9 do procedimento de virada exige "rodar
# o aceite de vendas", e nenhuma bateria rodava os aceites — só a mão. Em
# 22/09 o `aceite-contrato-assinado` estava QUEBRADO havia tempo indeterminado:
# criava o negócio sem família comercial, e a regra que exige família antes da
# proposta entrou depois dele. Ninguém viu, porque ninguém rodava.
#
# Os aceites ESCREVEM no banco: criam o cenário, exercitam a jornada e limpam
# no fim. Por isso não entram na bateria de todo commit — entram aqui, que é o
# que a virada chama.
#
# Uso: ./scripts/rodar-aceites.sh
set -uo pipefail
cd "$(dirname "$0")/../app"

FALHOU=0
for f in src/scripts/aceite-*.ts; do
  nome=$(basename "$f" .ts)
  printf '── %s\n' "$nome"
  if npx tsx --env-file=.env "$f" 2>&1 | tail -3 | sed 's/^/     /'; then
    :
  else
    echo "     ✘ $nome FALHOU"
    FALHOU=$((FALHOU+1))
  fi
done

echo ""
if [ "$FALHOU" -eq 0 ]; then
  echo "✔ todos os aceites passaram"
else
  echo "✘ $FALHOU aceite(s) falharam — a virada NÃO segue com isto vermelho"
fi
exit "$FALHOU"
