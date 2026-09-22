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

rodar() {
  local nome=$1 arquivo=$2 saida
  printf '── %-46s' "$nome"
  if saida=$(npx tsx --env-file=.env "$arquivo" 2>&1); then
    echo "ok"
    PASSOU=$((PASSOU+1))
  else
    echo "FALHOU"
    echo "$saida" | tail -6 | sed 's/^/        /'
    QUEBRADOS+=("$nome")
    FALHOU=$((FALHOU+1))
  fi
}

# Glob que não casa nada devolve o padrão literal, e `npx tsx` sobre um arquivo
# inexistente falharia com uma mensagem que não diz o que aconteceu. Pior: um
# diretório renomeado passaria como "0 falhas". Conferir a existência é o que
# separa "rodou e passou" de "não rodou".
rodar_grupo() {
  local padrao=$1 rotulo=$2 achou=0
  for f in $padrao; do
    [ -f "$f" ] || continue
    achou=$((achou+1))
    nome=$(basename "$f" .ts)
    [ -n "$PADRAO" ] && [[ "$nome" != *"$PADRAO"* ]] && continue
    rodar "$nome" "$f"
  done
  if [ "$achou" -eq 0 ]; then
    echo "✘ nenhum arquivo em $padrao — $rotulo não foi verificado"
    FALHOU=$((FALHOU+1))
    QUEBRADOS+=("$rotulo (nenhum arquivo)")
  fi
}

echo "── smokes ──"
rodar_grupo "src/scripts/smoke-*.ts" "smokes"

{
  echo ""
  echo "── checagens de tela ──"
  # `checar-onface-*` roda as consultas de uma tela e confere que ela não fica em
  # branco com o banco cheio. Os três também saíam com `process.exit(0)`
  # incondicional até 22/09: imprimiam os números, listavam os blocos vazios que
  # eles mesmos calculavam, e diziam OK. Relatório, não verificador.
  rodar_grupo "src/scripts/checar-onface-*.ts" "checagens de tela"
}

{
  echo ""
  echo "── verificadores fora da bateria até o CP59 ──"
  # `checar-env` e os dois `checar-vendas-*` tinham chamador só em npm script
  # (`check:env`, `check:vendas`), que nenhuma bateria executa. `checar-env`
  # estava VERMELHO e ninguém sabia: acusava 6 variáveis lidas pelo código e
  # ausentes do `.env.example`, e listava 23 como "candidatas a remoção" —
  # entre elas as sete da Meta, cuja entrega o CP57 tinha acabado de provar que
  # funciona. Quem seguisse o conselho apagaria credencial em uso.
  rodar_grupo "src/scripts/checar-env.ts" "conferência de ambiente"
  rodar_grupo "src/scripts/checar-vendas-*.ts" "checagens de vendas"
  # `checar-pre-deploy` diz se o banco aceita as migrations do refactor, e é o
  # que responde "pode subir?". Nunca tinha rodado com sucesso: o comando npm
  # chamava `tsx` SEM `--env-file`, então ele morria em `DATABASE_URL não
  # definida` antes da primeira consulta. O verificador que autoriza a virada
  # não conseguia nem conectar no banco.
  rodar_grupo "src/scripts/checar-pre-deploy.ts" "prontidão para migrations"
}

# A higiene POR ÚLTIMO, e depois de todos.
#
# Cada script limpa as tabelas que ELE escreve, e é aí que escapa: a limpeza
# envelhece quando a escrita cresce por baixo (a ponte canônica passou a criar
# oportunidade; o evento passou a ir para o outbox). Três episódios em dois dias
# — CP49, CP56 e CP58 — e nos três o resíduo apareceu longe da causa, num teste
# de outra fase. Verificar uma vez, no fim, olhando o banco inteiro, é o que
# põe a culpa perto do culpado.
#
# Só roda quando a bateria inteira rodou: com filtro, o que ficou de fora pode
# ser justamente quem sujou.
if [ -z "$PADRAO" ]; then
  echo ""
  echo "── higiene do banco ──"
  rodar_grupo "src/scripts/checar-residuo-de-teste.ts" "higiene do banco"
fi

echo ""
# Zero verificação executada NÃO é sucesso. Com um filtro que não casa nada, o
# script dizia "✔ 0 verificações passaram" e saía zero — a mesma mentira que
# esta bateria existe para pegar, cometida por ela mesma.
if [ "$((PASSOU+FALHOU))" -eq 0 ]; then
  echo "✘ nenhuma verificação casou \"$PADRAO\" — nada foi executado"
  exit 1
fi
if [ "$FALHOU" -eq 0 ]; then
  echo "✔ $PASSOU verificações passaram"
else
  echo "✘ $FALHOU de $((PASSOU+FALHOU)) verificações falharam — a virada NÃO segue com isto vermelho"
  printf '   %s\n' "${QUEBRADOS[@]}"
fi
exit "$FALHOU"
