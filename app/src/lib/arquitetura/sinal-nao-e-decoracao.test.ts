/**
 * Cor semântica só pode sair do dado.
 *
 * O frame do Figma da Visão Geral traz os quatro cards de KPI com o MESMO selo
 * verde, porque no desenho todos os números eram inventados e positivos. Ligado
 * ao banco real, isso virou, em 22/09:
 *
 *     Receita do mês   R$ 10.143,60   [− 78%]  ← em verde
 *     Operações ativas          480   [  —  ]  ← em verde
 *     Clientes ativos           272   [  —  ]  ← em verde
 *     Leads gerados             265   [− 51%]  ← em verde
 *
 * Verde é "resultado consumado" na convenção do Design System. Uma queda de 78%
 * pintada de verde não é um detalhe de estilo: é a tela afirmando o contrário do
 * que o número diz, no primeiro lugar em que a pessoa olha.
 *
 * `ds/crm.css` já tinha o padrão certo — `.of-tendencia[data-tom]`, com ok,
 * risco e neutro — e a tela simplesmente não o usava, preferindo a cor crua do
 * export do Figma.
 *
 * Esta trava é dupla de propósito: proíbe a cor crua voltar E exige que o tom
 * saia de uma função do sinal. Só o primeiro assert passaria também se alguém
 * fixasse `data-tom="ok"` nos quatro.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const RAIZ = path.resolve(__dirname, "..", "..", "..");
const HOME = path.join(RAIZ, "src", "components", "onface", "inicio", "HomePageFigma.tsx");
const PAGE = path.join(RAIZ, "src", "app", "(onface-preview)", "onface-preview", "inicio", "page.tsx");

/** Verde do export do Figma: `#3fb950` e o `rgba(63,185,80,…)` do fundo. */
const VERDE_CRU = /#3fb950|rgba\(63,\s*185,\s*80/i;

/** Tira comentários de bloco e de linha, para o assert olhar só o que renderiza. */
const semComentarios = (fonte: string) =>
  fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("a home não pinta selo com cor crua de sucesso", () => {
  const home = fs.readFileSync(HOME, "utf8");
  assert.doesNotMatch(home, VERDE_CRU,
    "voltou a cor verde fixa do Figma nos selos — a cor tem que vir de .of-tendencia[data-tom]");
  assert.doesNotMatch(home, /data-name="badge-positive"/,
    'o selo não pode se chamar "badge-positive": o nome já decide o resultado antes de olhar o número');

  const selos = home.match(/className="of-tendencia"/g) ?? [];
  assert.equal(selos.length, 4, `esperados 4 selos no padrão do DS, achei ${selos.length}`);
});

test("o gráfico da home sai da série, não do export do Figma", () => {
  // O card central da Visão Geral era uma pilha de <img> de segmento de reta,
  // cada um girado num ângulo fixo, com os meses "Jul … Dez" escritos na
  // marcação — três deles no futuro — e o subtítulo "Crescimento consistente em
  // todas as frentes." no mesmo card em que a receita caía 78%.
  // `getEvolucaoOperacao` já devolvia doze meses reais e não era chamada.
  const home = fs.readFileSync(HOME, "utf8");
  assert.doesNotMatch(home, /imgTrendLineLayer/,
    "voltaram as camadas de linha exportadas do Figma — o gráfico tem que sair do dado");
  assert.doesNotMatch(home, /rotate-\[-?\d/,
    "segmento de reta girado em ângulo fixo é desenho, não série");
  // Só a MARCAÇÃO conta. Os comentários deste arquivo citam a frase antiga de
  // propósito, para explicar o que foi trocado — um match no arquivo inteiro
  // proibiria documentar o defeito, e foi o que aconteceu na primeira versão
  // desta trava: ela ficou vermelha por causa do próprio comentário.
  const marcacao = semComentarios(home);
  assert.doesNotMatch(marcacao, /Crescimento consistente em todas as frentes/,
    "o subtítulo voltou a afirmar crescimento sem olhar a série");
  assert.match(home, /<GraficoEvolucao pontos=\{d\.evolucao\}/,
    "o card precisa receber a série");
  assert.match(home, /d\.evolucao\.map/,
    "os rótulos de mês precisam sair da série: escritos na marcação, ficam presos em Jul–Dez");

  const page = fs.readFileSync(PAGE, "utf8");
  assert.match(page, /getEvolucaoOperacao\(/,
    "a página precisa chamar a consulta da série — ela existia e ninguém a chamava");
  assert.match(page, /resumoDaEvolucao/,
    "o subtítulo do card precisa ser derivado da série");
});

test("os cards de área dizem um número, não um elogio", () => {
  // "Em movimento", "Alta performance", "Saudável", "Excelente NPS": quatro
  // afirmações sobre a saúde do negócio, escritas na marcação, que nunca
  // olharam o banco. "Financeiro: Saudável" aparecia junto de R$ 26.729,69 em
  // cobrança com 7 vencidos, e "Excelente NPS" sem nenhuma resposta de NPS no
  // período. `montarVisaoGeral` já derivava os mesmos quatro a partir de número.
  const marcacao = semComentarios(fs.readFileSync(HOME, "utf8"));
  for (const elogio of ["Em movimento", "Alta performance", "Saudável", "Excelente NPS"]) {
    assert.ok(!marcacao.includes(elogio),
      `"${elogio}" voltou para a marcação — o card tem que dizer um número`);
  }
  for (const campo of ["d.areaOperacao", "d.areaComercial", "d.areaFinanceiro", "d.areaSuporte"]) {
    assert.ok(marcacao.includes(campo), `o card de ${campo} não lê o estado do dado`);
  }
});

test("o tom do selo é função do sinal, não constante", () => {
  const page = fs.readFileSync(PAGE, "utf8");
  assert.match(page, /tomDoDelta/,
    "o tom precisa ser derivado do delta");
  // A forma importa: precisa haver os três caminhos. Um `=> \"ok\"` fixo
  // passaria em qualquer teste que só procurasse o nome da função.
  assert.match(page, /"risco"/, "falta o caminho de queda — sem ele, número negativo volta a ficar verde");
  assert.match(page, /"neutro"/, "falta o caminho sem base: delta nulo não é bom nem ruim");

  const home = fs.readFileSync(HOME, "utf8");
  for (const campo of ["d.receita.tom", "d.leads.tom", "d.operacoesTom", "d.clientesTom"]) {
    assert.ok(home.includes(`data-tom={${campo}}`),
      `o selo de ${campo} não lê o tom do dado — está fixo na marcação`);
  }
});
