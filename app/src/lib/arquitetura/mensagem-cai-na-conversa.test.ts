import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";

/**
 * Nada escreve mensagem fora da conversa do Atendimento.
 *
 * A regra é do Scott (14/10/2026): *"cada vírgula, cada ponto tem que aparecer na
 * aba de atendimento, independente do canal"*. Mensagem gravada com
 * `contatoId: null` existe no banco e é **invisível para quem atende**.
 *
 * O caso que motivou a trava: o lembrete de reunião do INVEST BANK saiu pelo
 * WhatsApp da Mayra às 15:58, foi entregue ao cliente, e não apareceu na conversa
 * dele. Ela escreveu para o mesmo cliente às 16:41 sem saber que o sistema já
 * havia falado. Se ele respondesse, a resposta cairia numa conversa onde a
 * pergunta não existe.
 *
 * Medido no mesmo dia, em produção: **932 mensagens enviadas sem contato**, todas
 * de saída, 104 só em outubro.
 *
 * Quem precisa gravar uma mensagem de saída resolve a conversa primeiro, com
 * `conversaParaEnvio` (lib/atendimento/garantir-conversa.ts).
 */

const RAIZ = join(import.meta.dirname, "../../..");

/**
 * Arquivos de TESTE ficam de fora: eles montam cenário à mão, inclusive o cenário
 * ruim — é assim que se prova que a conversa órfã não aparece para quem não deve.
 * A regra vale para o código que roda em produção.
 */

function arquivosTs(dir: string): string[] {
  const saida: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".next") continue;
      saida.push(...arquivosTs(p));
    } else if ((e.name.endsWith(".ts") || e.name.endsWith(".tsx")) && !e.name.endsWith(".test.ts")) {
      saida.push(p);
    }
  }
  return saida;
}

/**
 * `contatoId: null` DENTRO de um insert de mensagem — e só dele.
 *
 * Procurar o texto solto no arquivo dava falso positivo: `agentes/autonomia.ts`
 * grava `contatoId: null` ao registrar execução de agente bloqueada ("lead sem
 * WhatsApp"), que não é mensagem nenhuma. A janela de 20 linhas cobre o corpo do
 * `.values({...})` sem alcançar o próximo bloco.
 */
const INSERT_MENSAGEM = /insert\s*\(\s*whatsappMensagens\s*\)[\s\S]{0,700}?\}\)/g;
const SEM_CONVERSA = /contatoId\s*:\s*null/;

test("mensagem de saída nasce dentro da conversa do Atendimento", () => {
  const furos: string[] = [];
  for (const arq of arquivosTs(join(RAIZ, "src"))) {
    const rel = relative(RAIZ, arq);
    const src = readFileSync(arq, "utf8");
    if (!src.includes("whatsappMensagens")) continue;
    const temOrfa = [...src.matchAll(INSERT_MENSAGEM)].some((m) => SEM_CONVERSA.test(m[0]));
    if (temOrfa) furos.push(rel);
  }

  assert.deepEqual(furos, [], [
    "Estes arquivos gravam mensagem com `contatoId: null` — ela some do Atendimento:",
    ...furos.map((f) => `  ${f}`),
    "",
    "Resolva a conversa antes de gravar:",
    "  const contatoId = await conversaParaEnvio(orgId, { leadId, telefone, sessaoId, usuarioId });",
    "Arquivo de teste não entra nesta varredura: ele pode montar o cenário órfão de propósito.",
  ].join("\n"));
});
