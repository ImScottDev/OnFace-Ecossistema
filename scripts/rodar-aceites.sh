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
# OS VALIDADORES TINHAM O MESMO BURACO. O passo 9 pede "a validação de paridade,
# TODOS os aceites e os smokes", e nem `validacao-paridade` nem
# `validar-catalogo-oficial` eram chamados por nada — zero referências em
# `package.json` e em script algum. Rodados à mão em 22/09, o de catálogo morria
# com TypeError na linha 171 (indexava `[0]` de uma consulta vazia) e nunca
# chegava às seções 3, 4 e 5. Estão aqui agora, pelo mesmo motivo dos aceites.
#
# Uso: ./scripts/rodar-aceites.sh
set -uo pipefail
cd "$(dirname "$0")/../app"

FALHOU=0

rodar() {
  local nome=$1 arquivo=$2
  printf '── %s\n' "$nome"
  # `pipefail` faz o pipeline devolver a falha do tsx, não o sucesso do sed.
  if npx tsx --env-file=.env "$arquivo" 2>&1 | tail -3 | sed 's/^/     /'; then
    :
  else
    echo "     ✘ $nome FALHOU"
    FALHOU=$((FALHOU+1))
  fi
}

echo "═══ aceites de jornada"
for f in src/scripts/aceite-*.ts; do
  rodar "$(basename "$f" .ts)" "$f"
done

echo ""
echo "═══ validadores de paridade e catálogo"
for f in src/scripts/validacao-paridade.ts src/scripts/validar-catalogo-oficial.ts; do
  rodar "$(basename "$f" .ts)" "$f"
done

echo ""
if [ "$FALHOU" -eq 0 ]; then
  echo "✔ aceites e validadores passaram"
else
  echo "✘ $FALHOU verificação(ões) falharam — a virada NÃO segue com isto vermelho"
fi
exit "$FALHOU"
