/**
 * Chave de idempotência não pode carregar o relógio.
 *
 * Uma chave existe para responder "este fato já foi registrado?". Se ela inclui
 * o instante da execução, a resposta é sempre não: cada chamada gera uma chave
 * nova e nada dedupica. A idempotência vira decoração — pior que não ter, porque
 * o código diz que protege.
 *
 * Duas estavam assim em 22/09, nas rotas que mexem no dono de uma conversa:
 *
 *     `contato:${id}:${acao}:${agora.getTime()}`          // agora = new Date()
 *     `contato:${id}:assignment:${updated.updatedAt.getTime()}`
 *
 * O padrão certo já existe no projeto, em `lib/crm/tags.ts`: **publicar só
 * quando MUDOU**, com a chave descrevendo o ESTADO alcançado —
 * `tag:add:${assignment.id}`, `contato:${id}:assignment:${targetUserId}`.
 * Reprocessar a mesma transição não publica de novo; uma transição diferente
 * sim.
 *
 * O caso de `snooze` mostra a fronteira: adiar de novo, com outro prazo, É outro
 * fato — então a chave dele carrega o prazo, que é o estado, e não o momento em
 * que alguém clicou.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SRC = path.join(process.cwd(), "src");

function arquivos(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "node_modules" ? [] : arquivos(p);
    return /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name) ? [p] : [];
  });
}

/**
 * O relógio da EXECUÇÃO, e só ele: `new Date()` e `Date.now()` dentro da chave.
 *
 * `toISOString()` e `getTime()` sozinhos não bastam para condenar, porque
 * costumam ser aplicados a um campo de FATO — a data em que a resposta chegou, o
 * vencimento negociado — e aí são exatamente o que torna a chave estável. A
 * primeira versão desta trava proibia os quatro e acusou uma chave correta; uma
 * trava dogmática a ponto de recusar a decisão certa é tão ruim quanto nenhuma.
 */
const RELOGIO_DA_EXECUCAO = /(Date\.now\(\)|new Date\(\))/;

/**
 * Chaves que usam `new Date()` de propósito, com o porquê.
 *
 * Crescer esta lista é uma decisão consciente, e é isso que o teste força — o
 * mesmo desenho de `BUMP_JUSTIFICADO` em `enriquecimento-nao-bumpa`.
 */
const DATA_JUSTIFICADA: Record<string, string> = {
  "lib/cs/handoff.ts":
    "granularidade de DIA (`.slice(0, 10)`): sem id de fatura, duas falhas de " +
    "pagamento da mesma empresa no mesmo dia são deliberadamente o mesmo fato",
};

test("nenhuma chave de idempotência carrega o relógio da execução", () => {
  const infratores: string[] = [];
  let chavesExaminadas = 0;
  for (const arq of arquivos(SRC)) {
    const txt = fs.readFileSync(arq, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    // A chave e o que ela interpola, na mesma expressão.
    for (const m of txt.matchAll(/(?:idempotencyKey|chaveIdempotencia|idempotency_key)\s*:\s*`([^`]*)`/g)) {
      chavesExaminadas++;
      const rel = path.relative(SRC, arq).split(path.sep).join("/");
      if (RELOGIO_DA_EXECUCAO.test(m[1]) && !(rel in DATA_JUSTIFICADA)) {
        infratores.push(`${rel} → \`${m[1].replace(/\s+/g, " ")}\``);
      }
    }
  }
  // A conta do universo. Sem ela o teste passa verde varrendo zero, e verde de
  // varredura vazia não significa nada: provado no CP56 na trava de tenant.
  assert.ok(chavesExaminadas > 5,
    `só ${chavesExaminadas} chaves de idempotência alcançadas — o padrão de nome mudou`);
  assert.deepEqual(infratores, [],
    "estas chaves incluem o instante da execução, então nunca dedupicam:\n  " +
    infratores.join("\n  ") +
    "\nA chave tem que descrever o ESTADO alcançado (o dono novo, o prazo novo, " +
    "o id da escrita), e o evento só deve ser publicado quando algo mudou.");
});

test("as rotas de conversa publicam só quando o dono muda", () => {
  // Além da chave, a condição estava invertida em `contatos.ts`:
  // `responsavelId === targetUserId` significa que JÁ era daquela pessoa — nada
  // mudou — e publicava `ConversationClaimed`; assumir uma conversa sem dono,
  // que é o significado de claim, caía em `ConversationTransferred`.
  const contatos = fs.readFileSync(path.join(SRC, "api-server", "routes", "contatos.ts"), "utf8");
  assert.match(contatos, /if \(contato\.responsavelId !== targetUserId\)/,
    "a atribuição precisa publicar só quando o dono muda");
  assert.match(contatos, /contato\.responsavelId === null \? "ConversationClaimed"/,
    "sem dono antes é Claimed; com outro dono antes é Transferred");

  const atendimento = fs.readFileSync(path.join(SRC, "api-server", "routes", "atendimento.ts"), "utf8");
  assert.match(atendimento, /const mudou =/,
    "a ação de conversa precisa decidir se houve mudança antes de publicar");
  assert.match(atendimento, /if \(mudou\) \{/,
    "e só publicar quando houve");
});
