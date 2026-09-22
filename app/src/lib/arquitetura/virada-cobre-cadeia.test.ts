/**
 * O procedimento de virada não pode envelhecer em silêncio.
 *
 * Até 22/09 o passo 6 de `entrega-final.md` dizia "resto da cadeia, 0013 a
 * 0086" — e a cadeia já ia até 0090. Seguido ao pé da letra, a virada deixaria
 * de fora `metric_catalog`, `cs_health_snapshots`, o `calendar_provider` e o
 * índice de idempotência do staging da Meta: quatro features do produto sem
 * tabela em produção.
 *
 * O script nunca teve esse teto (`migrar.ts` sem `--ate` aplica tudo), mas
 * quem lê o documento não sabe disso. Número fixo num procedimento envelhece a
 * cada migration nova, e ninguém volta para conferir.
 *
 * Esta trava cobre as duas metades: cada migration está documentada, e o passo
 * que aplica a cadeia não enumera um teto.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const RAIZ = path.join(process.cwd(), "..");
const MIGRATIONS = path.join(process.cwd(), "src", "lib", "db", "migrations");
const ENTREGA = path.join(RAIZ, "docs", "architecture", "entrega-final.md");

test("toda migration aparece na tabela da entrega", () => {
  const doc = fs.readFileSync(ENTREGA, "utf8");
  const numeros = fs.readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => f.slice(0, 4))
    .filter((n) => Number(n) >= 56); // a tabela documenta a partir da 0056
  const ausentes = numeros.filter((n) => !new RegExp(`\\|\\s*${n}\\s*\\|`).test(doc));
  assert.deepEqual(ausentes, [],
    `migrations fora da tabela de entrega-final.md: ${ausentes.join(", ")}. ` +
    `Quem executar a virada pelo documento não saberá que existem.`);
});

test("o passo que aplica a cadeia não enumera um teto", () => {
  const doc = fs.readFileSync(ENTREGA, "utf8");
  const i = doc.indexOf("**Resto da cadeia");
  assert.ok(i > 0, "o passo do resto da cadeia sumiu do procedimento");
  const passo = doc.slice(i, i + 200);
  assert.doesNotMatch(passo, /0013 a 00\d\d\b/,
    "o passo voltou a fixar um número de migration final: ele envelhece na próxima migration");
  assert.match(passo, /FIM|fim/, "o passo precisa dizer que a cadeia vai até o fim");
});

test("o ensaio de carga roda a cadeia sem teto", () => {
  // A garantia real: se o script ganhar um `--ate` no passo final, o documento
  // fica certo e a execução errada.
  const ensaio = fs.readFileSync(path.join(RAIZ, "scripts", "ensaio-carga.sh"), "utf8");
  const i = ensaio.indexOf("cadeia, resto");
  assert.ok(i > 0, "o passo 'cadeia, resto' sumiu do ensaio");
  const trecho = ensaio.slice(i, i + 260);
  assert.doesNotMatch(trecho, /--ate=/,
    "o passo final do ensaio ganhou um teto: a cadeia deixaria de aplicar as migrations novas");
});

test("o passo dos aceites chama o script, e o script cobre todos", () => {
  // O passo 9 dizia "o aceite de vendas", no singular, e nenhuma bateria rodava
  // aceite nenhum. Um deles ficou quebrado por tempo indeterminado e só
  // apareceria no dia da virada.
  const doc = fs.readFileSync(ENTREGA, "utf8");
  assert.match(doc, /rodar-aceites\.sh/,
    "o procedimento precisa chamar o script que roda TODOS os aceites");

  const script = fs.readFileSync(path.join(RAIZ, "scripts", "rodar-aceites.sh"), "utf8");
  assert.match(script, /src\/scripts\/aceite-\*\.ts/,
    "o script precisa varrer os aceites por glob: enumerar deixa o próximo de fora");
  assert.match(script, /exit "\$FALHOU"/,
    "o script precisa sair diferente de zero quando um aceite falha, senão a virada segue no vermelho");
});

test("os smokes têm runner, ele varre por glob, e o passo 9 o chama", () => {
  // Terceiro buraco da mesma família: 32 smokes e NENHUM chamador — nem
  // package.json, nem script, nem CI. O passo 9 exige "os smokes" e o único
  // caminho era a mão de alguém, um a um.
  const doc = fs.readFileSync(ENTREGA, "utf8");
  assert.match(doc, /rodar-smokes\.sh/,
    "o procedimento precisa chamar o script que roda TODOS os smokes");

  const script = fs.readFileSync(path.join(RAIZ, "scripts", "rodar-smokes.sh"), "utf8");
  assert.match(script, /src\/scripts\/smoke-\*\.ts/,
    "o runner precisa varrer os smokes por glob: enumerar deixa o próximo de fora");
  assert.match(script, /exit "\$FALHOU"/,
    "o runner precisa sair diferente de zero quando um smoke falha");
  assert.match(script, /src\/scripts\/checar-onface-\*\.ts/,
    "as checagens de tela também precisam rodar: os três saíam com exit 0 incondicional");

  // Duas mentiras que o runner contou sobre si mesmo antes de ficar assim:
  // chamava uma função que só existia no outro script — as três checagens
  // davam "command not found" e ele fechou com "✔ 32 verificações passaram" —
  // e, com um filtro que não casava nada, dizia "✔ 0 verificações passaram" e
  // saía zero. Zero executado não é sucesso.
  assert.match(script, /PASSOU\+FALHOU\)\)" -eq 0/,
    "o runner precisa recusar a rodada em que NADA foi executado");
  assert.match(script, /achou" -eq 0/,
    "o runner precisa acusar grupo cujo glob não casou arquivo nenhum");
});

test("o passo 10 tem roteiro, e o roteiro cobre as rotas do ONFACE", () => {
  // O passo 10 era uma frase: "subir o código novo e provar no navegador".
  // Sem roteiro, "provar" virou abrir a home e seguir — e a Visão Geral passou
  // semanas pintando de verde uma queda de 78%.
  const doc = fs.readFileSync(ENTREGA, "utf8");
  assert.match(doc, /checar-rotas-onface/,
    "o passo 10 precisa chamar o verificador de rotas");
  assert.match(doc, /api-server\/index\.ts/,
    "o passo precisa mandar subir o Hono: sem ele as telas respondem 200 sem dado");

  const script = fs.readFileSync(
    path.join(RAIZ, "app", "src", "scripts", "checar-rotas-onface.ts"), "utf8");
  // Cada rota do preview tem que estar na lista. Uma tela nova que ninguém
  // acrescenta aqui nunca é aberta pelo passo 10.
  const dir = path.join(RAIZ, "app", "src", "app", "(onface-preview)", "onface-preview");
  const telas = fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("[")).map((e) => e.name);
  const ausentes = telas.filter((t) => !script.includes(`/onface-preview/${t}`));
  assert.deepEqual(ausentes, [],
    `telas do preview fora do roteiro do passo 10: ${ausentes.join(", ")}`);

  assert.match(script, /startsWith\("\/login"\)/,
    "o script precisa distinguir 'caiu no login' de 'a tela quebrou' — são causas diferentes");
});

test("o aceite de CS devolve a conta real como a encontrou", () => {
  // `aceite-cs` trabalha de propósito sobre uma conta REAL da carteira — a
  // primeira com serviço no portfólio — porque o valor do teste está no dado em
  // volta. O preço disso é que tudo que ele escreve lá precisa voltar.
  //
  // Em 22/09 não voltava: a limpeza cobria cancelamentos, riscos, negócios,
  // tarefas e atividades, e NÃO `cs_marcos`. Sobraram 7 marcos e uma tarefa
  // PLAYBOOK em "Unresolved billing identity", e a tarefa foi parar na fila de
  // trabalho do CS. Mesma família do incidente de 21/09, em que um smoke semeou
  // 1.932 marcos em 276 contas reais.
  const aceite = fs.readFileSync(path.join(RAIZ, "app", "src", "scripts", "aceite-cs.ts"), "utf8");
  assert.match(aceite, /marcosPreexistentes/,
    "o aceite precisa guardar os marcos que a conta JÁ tinha, senão não sabe quais são dele");
  assert.match(aceite, /db\.delete\(csMarcos\)/,
    "o aceite semeia jornada numa conta real e precisa remover os marcos que criou");
  assert.match(aceite, /CS_MARCO:/,
    "o sweep do aceite gera tarefa de playbook a partir do marco — ela também precisa cair");
});

test("a lista de backfills do runner cobre a pasta inteira", () => {
  // Aqui a enumeração é DEFENSÁVEL — o backfill tem ordem (05, 06, 07…) e
  // deixá-la explícita no script documenta a sequência. O que ela não faz é
  // avisar quando um passo novo nasce: o 11º backfill ficaria fora em silêncio,
  // e a virada rodaria 10 de 11 sem ninguém notar. Este teste é o aviso.
  const script = fs.readFileSync(path.join(RAIZ, "scripts", "rodar-backfills.sh"), "utf8");
  const bloco = script.match(/PASSOS=\(([\s\S]*?)\)/);
  assert.ok(bloco, "a lista PASSOS sumiu de rodar-backfills.sh");
  const listados = bloco![1].split("\n").map((l) => l.trim()).filter(Boolean);
  const naPasta = fs.readdirSync(path.join(RAIZ, "app", "src", "scripts", "backfill"))
    .filter((f) => f.endsWith(".ts")).map((f) => f.replace(/\.ts$/, "")).sort();

  const faltando = naPasta.filter((f) => !listados.includes(f));
  assert.deepEqual(faltando, [],
    `backfill na pasta e fora do runner: ${faltando.join(", ")} — a virada rodaria ${listados.length} de ${naPasta.length}`);
  const sobrando = listados.filter((l) => !naPasta.includes(l));
  assert.deepEqual(sobrando, [],
    `o runner chama backfill que não existe mais: ${sobrando.join(", ")}`);
});

test("todo validador de src/scripts é chamado pela bateria da virada", () => {
  // Mesmo defeito dos aceites, um nível acima: o passo 9 pede "a validação de
  // paridade", e nem `validacao-paridade` nem `validar-catalogo-oficial` eram
  // chamados por nada. O de catálogo estava morrendo com TypeError na linha 171
  // — indexava `[0]` de uma consulta vazia — e ninguém sabia, porque ninguém
  // rodava. Enumerar aqui só os dois de hoje deixaria o terceiro órfão de novo,
  // então o teste varre o diretório.
  const script = fs.readFileSync(path.join(RAIZ, "scripts", "rodar-aceites.sh"), "utf8");
  const validadores = fs.readdirSync(path.join(RAIZ, "app", "src", "scripts"))
    .filter((f) => /^valida/.test(f) && f.endsWith(".ts"));
  assert.ok(validadores.length >= 2, `esperado ao menos 2 validadores, achei ${validadores.length}`);
  for (const v of validadores) {
    assert.ok(script.includes(v),
      `${v} não é chamado por scripts/rodar-aceites.sh — validador sem caller não roda nunca`);
  }
});
