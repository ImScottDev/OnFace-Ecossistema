#!/bin/bash
# Roda TODOS os smokes contra o banco apontado por DATABASE_URL (o `.env` do
# app, por padrão).
#
# POR QUE ESTE SCRIPT EXISTE. Terceiro buraco da mesma família, achado em 22/09:
# o passo 9 da virada exige "a validação de paridade, TODOS os aceites e os
# smokes", e havia **32 smokes sem nenhum chamador** — zero referências em
# `package.json`, em script, em CI. Os aceites tinham o mesmo buraco (CP32) e um
# deles estava quebrado havia tempo indeterminado; os dois validadores também
# (CP33) e um morria com TypeError. Verificador que ninguém roda não fica
# parado: apodrece, e mente que o sistema está verificado.
#
# Os smokes ESCREVEM no banco: montam o cenário, exercitam o caminho real e
# limpam no fim. Por isso não entram na bateria de todo commit.
#
# NÃO RODE ISTO JUNTO COM `npm test`. Os dois usam o mesmo banco, e os testes de
# reconciliação varrem tabelas inteiras: em 22/09, rodar os dois em paralelo fez
# `reconciliacao-backfill` acusar "3 leads sem aquisição" — eram leads
# temporários de um smoke em voo. Sozinha, a suíte dá 335/0. Falha assim é
# corrida, não regressão; confirme rodando um de cada vez antes de investigar.
#
# Uso: ./scripts/rodar-smokes.sh [padrão]
#   ./scripts/rodar-smokes.sh            # todos
#   ./scripts/rodar-smokes.sh jornada    # só os que casam com *jornada*
set -uo pipefail
cd "$(dirname "$0")/../app"

PADRAO="${1:-}"
FALHOU=0
PASSOU=0
QUEBRADOS=()

for f in src/scripts/smoke-*.ts; do
  nome=$(basename "$f" .ts)
  [ -n "$PADRAO" ] && [[ "$nome" != *"$PADRAO"* ]] && continue
  printf '── %-46s' "$nome"
  # `pipefail` faz o pipeline devolver a falha do tsx, não o sucesso do tail.
  if saida=$(npx tsx --env-file=.env "$f" 2>&1); then
    echo "ok"
    PASSOU=$((PASSOU+1))
  else
    echo "FALHOU"
    echo "$saida" | tail -6 | sed 's/^/        /'
    QUEBRADOS+=("$nome")
    FALHOU=$((FALHOU+1))
  fi
done

echo ""
if [ "$FALHOU" -eq 0 ]; then
  echo "✔ $PASSOU smokes passaram"
else
  echo "✘ $FALHOU de $((PASSOU+FALHOU)) smokes falharam — a virada NÃO segue com isto vermelho"
  printf '   %s\n' "${QUEBRADOS[@]}"
fi
exit "$FALHOU"
