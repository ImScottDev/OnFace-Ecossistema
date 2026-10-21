import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { test } from "node:test";

/**
 * Conversa de WhatsApp só se lê pela PORTA (lib/whatsapp/acesso.ts).
 *
 * Em 13/10/2026 descobriu-se que o WhatsApp PESSOAL do dono do produto, conectado ao ONFACE, era
 * legível por qualquer admin: a regra de acesso estava espalhada em dez rotas, cada uma com um
 * `OR responsavel_id IS NULL` ou um `if (admin)` seu, e três delas (lista do Atendimento, link por
 * lead, resumo do NEXO) nem checavam. Esconder o botão "Equipe" não era segurança.
 *
 * Esta trava cobre quatro coisas, todas lendo arquivo (nenhuma toca banco):
 *   1. todo arquivo que LÊ `whatsapp_mensagens` ou `contatos` importa a porta, ou está na lista de
 *      exceções com o motivo escrito. Arquivo novo que leia conversa sem a porta quebra aqui;
 *   2. a lista de exceções não envelhece: exceção que passou a usar a porta tem que sair dela;
 *   3. os idiomas que causaram o vazamento não voltam (`veTodasAsConversas`, "do usuário OU sem
 *      responsável", `viewAs` por parâmetro lendo a caixa de outra pessoa);
 *   4. toda rota que recebe o id de uma conversa chama `checarAcessoContato` no próprio handler.
 */

const RAIZ = join(process.cwd(), "src");
const ACESSO = "src/lib/whatsapp/acesso.ts";

function fontes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return ["node_modules", "migrations", "scripts", "carga"].includes(e.name) ? [] : fontes(p);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
  });
}
const rel = (p: string) => relative(process.cwd(), p).split(sep).join("/");
const todas = fontes(RAIZ).map((p) => ({ arq: rel(p), src: readFileSync(p, "utf8") }));

// `communications` é a CÓPIA da mensagem (conteúdo e resumo): ler dela é ler a conversa.
const LE_CONVERSA = /\.(?:from|innerJoin|leftJoin|rightJoin)\(\s*(?:whatsappMensagens|contatos|communications)\b|\b(?:FROM|JOIN)\s+(?:public\.)?(?:whatsapp_mensagens|contatos|communications)\b/i;
const USA_A_PORTA = /whatsapp\/acesso["']/;

/**
 * Leituras que NÃO passam pela porta, e por quê. Cada entrada é uma decisão: ou a leitura não é da
 * conversa de um usuário (motor que age por regra da organização), ou mostra só identidade/contagem.
 */
const SEM_A_PORTA: Record<string, string> = {
  // Identidade do contato, nunca a conversa.
  "src/api-server/routes/automacoes-cadencias.ts": "nome/e-mail/telefone do contato inscrito na cadência (identidade, não conversa)",
  "src/api-server/routes/automacoes-tags.ts": "confere que o contato existe na organização antes de etiquetar a ENTIDADE",
  "src/api-server/routes/carol.ts": "contatos com responsável = o próprio usuário",
  "src/api-server/routes/contatos-unified.ts": "só os canais (badges) dos contatos de um lead",
  "src/api-server/routes/leads.ts": "avatar e id do contato de UM lead; envio e leitura de mensagem não passam por aqui",
  "src/lib/automacoes/contexto.ts": "motor de automação monta variáveis por regra da organização",
  "src/lib/automacoes/execucoes.ts": "nome do contato na lista de execuções da automação",
  "src/lib/automacoes/fluxos-servico.ts": "busca de alvo e nome de entidade do fluxo (identidade)",
  "src/lib/cs/health.ts": "dias sem interação com a EMPRESA (max da data), sem texto",
  "src/app/(produto)/contatos/actions.ts": "mescla de pessoas: apaga as comunicações do duplicado, não as lê",
  "src/lib/relatorios/performance.ts": "contagem agregada de mensagens enviadas por pessoa, sem texto",
  "src/lib/vendas/consultas.ts": "data do último toque no cartão (max da data), sem texto — mesma natureza de cs/health.ts",
  // Agentes de IA: o contato vem do evento que acordou o agente, nunca de parâmetro do usuário.
  "src/lib/agentes/handover.ts": "runtime de agente: handover da conversa que ele conduz",
  "src/lib/ai-platform/contexto/builder.ts": "contexto do agente: a conversa dele, mais o histórico do lead SEM os contatos de número privado (filtro `wp.privado` no próprio SQL)",
  "src/lib/ai-platform/midia/transcrever.ts": "runtime de agente: transcrição da mídia da conversa que ele conduz",
  "src/lib/ai-platform/observabilidade.ts": "observabilidade do agente: só as mensagens que o AGENTE escreveu (aiRunId)",
  "src/lib/ai-platform/operacao/acionar.ts": "operação de agente sobre a conversa atribuída a ele",
  "src/lib/ai-platform/operacao/numero-do-agente.ts": "conversa que chegou no número do próprio agente (nunca privado): lead, nome e telefone para cadastrar quem escreveu",
  "src/lib/ai-platform/operacao/runs-presas.ts": "varredura do motor: a última mensagem da conversa que a execução interrompida deixou sem resposta, para saber se há vácuo a preencher",
  "src/lib/ai-platform/operacao/alvo.ts": "resolve o alvo (contato) da atribuição do agente",
  "src/lib/ai-platform/operacao/atribuicoes.ts": "atribuição de agente à conversa",
  "src/lib/ai-platform/operacao/compromissos.ts": "retomada que o próprio agente agendou",
  "src/lib/ai-platform/operacao/politica-canal.ts": "política de canal do agente na conversa que ele conduz",
  "src/lib/ai-platform/runtime/execute-agent.ts": "runtime de agente",
  "src/lib/ai-platform/tools/operacao.ts": "ferramenta de agente: a conversa é a do contexto da execução (ctx.contatoId), não um argumento do modelo",
  "src/lib/ai-platform/tools/registry.ts": "ferramenta de agente: lê só a conversa do contexto da execução (ctx.contatoId)",
  "src/lib/atendimento/ia-conversa.ts": "estado da IA; as duas rotas que o chamam checam a porta antes",
  "src/lib/atendimento/lead-da-conversa.ts": "casamento por telefone e checagem da conversa irmã do lead (identidade, nunca o texto da conversa)",
  // Ingestão: `src/worker/index.ts` saiu desta lista em 20/10/2026 — o rodízio de
  // número compartilhado passou a chamar `atendentesDoNumero` da porta.
  // vendas/**: a ficha do prospect e a linha do tempo passaram pela porta em 14/10
  // (sessaoPrivada e condicaoComunicacaoNaoPrivada). Esta última só lê data.
  "src/lib/vendas/prospeccao.ts": "só a data da última mensagem recebida do lead (sem texto)",
};

test("todo arquivo que LÊ conversa de WhatsApp passa pela porta, ou está na lista com motivo", () => {
  const furos = todas
    .filter((f) => f.arq !== ACESSO && LE_CONVERSA.test(f.src) && !USA_A_PORTA.test(f.src) && !(f.arq in SEM_A_PORTA))
    .map((f) => f.arq);
  assert.deepEqual(furos, [],
    `Estes arquivos leem whatsapp_mensagens/contatos sem importar lib/whatsapp/acesso:\n  ${furos.join("\n  ")}\n` +
    `Use condicaoConversa/checarAcessoContato (a regra é uma só). Se a leitura NÃO é de conversa de usuário ` +
    `(motor, identidade, contagem), registre em SEM_A_PORTA com o motivo.`);
});

test("a lista de exceções não envelhece", () => {
  const porArq = new Map(todas.map((f) => [f.arq, f.src]));
  const problemas: string[] = [];
  for (const arq of Object.keys(SEM_A_PORTA)) {
    const src = porArq.get(arq);
    if (src === undefined) problemas.push(`${arq}: o arquivo não existe mais`);
    else if (USA_A_PORTA.test(src)) problemas.push(`${arq}: passou a usar a porta; tire da lista`);
    else if (!LE_CONVERSA.test(src)) problemas.push(`${arq}: não lê mais conversa; tire da lista`);
  }
  assert.deepEqual(problemas, []);
});

test("os idiomas que vazaram o WhatsApp pessoal não voltam", () => {
  const ruins: string[] = [];
  for (const f of todas) {
    if (f.arq === ACESSO) continue;
    // "do usuário OU sem responsável": a conversa sem dono num número alheio virava de todo mundo.
    if (/or\(\s*eq\(\s*contatos\.responsavelId[\s\S]{0,120}?isNull\(\s*contatos\.responsavelId/.test(f.src)) ruins.push(`${f.arq}: "responsável OU sem responsável" em contatos`);
    if (/c\.responsavel_id\s*=\s*\$\{[^}]+\}\s+OR\s+c\.responsavel_id\s+IS\s+NULL/i.test(f.src)) ruins.push(`${f.arq}: "responsável OU sem responsável" em SQL cru`);
    // Funções de poder por cargo que a regra antiga exportava.
    if (/\b(?:veTodasAsConversas|condicaoAcessoConversa|sessaoDaGestao)\b/.test(f.src)) ruins.push(`${f.arq}: usa regra de acesso por cargo que foi removida`);
  }
  assert.deepEqual(ruins, []);
});

test("viewAs por parâmetro não escolhe a caixa de WhatsApp de outra pessoa", () => {
  const whatsapp = todas.find((f) => f.arq === "src/api-server/routes/whatsapp.ts")!;
  // As rotas de WhatsApp só podem LER o parâmetro para recusá-lo.
  const usos = [...whatsapp.src.matchAll(/c\.req\.query\("viewAs"\)/g)];
  for (const u of usos) {
    const trecho = whatsapp.src.slice(Math.max(0, u.index! - 5), u.index! + 120);
    assert.match(trecho, /if \(c\.req\.query\("viewAs"\)\) return c\.json\([^)]*400\)/, "viewAs deveria ser recusado com 400, não obedecido");
  }
  assert.doesNotMatch(whatsapp.src, /const viewAs\b/, "whatsapp.ts voltou a ler viewAs para trocar o usuário efetivo");
  // No Atendimento o parâmetro ainda serve e-mail/ligação, mas nunca o WhatsApp.
  const atend = todas.find((f) => f.arq === "src/api-server/routes/atendimento.ts")!;
  const buscar = atend.src.slice(atend.src.indexOf("async function buscarWhatsapp"), atend.src.indexOf("const acaoConversaSchema"));
  assert.doesNotMatch(buscar, /effectiveUserId|viewAs/, "buscarWhatsapp voltou a obedecer o id pedido na URL");
});

/** Handlers `app.<método>("<rota>", ...)` de um arquivo: rota + texto até o próximo handler. */
function handlers(src: string): Array<{ rota: string; corpo: string }> {
  const re = /app\.(?:get|post|put|patch|delete)\(\s*(?:"([^"]+)"|`([^`]+)`)/g;
  const marcas = [...src.matchAll(re)].map((m) => ({ rota: m[1] ?? m[2], i: m.index! }));
  return marcas.map((m, k) => ({ rota: m.rota, corpo: src.slice(m.i, marcas[k + 1]?.i ?? src.length) }));
}

test("toda rota que recebe o id de uma conversa checa a porta no próprio handler", () => {
  // [arquivo, padrão da rota que carrega um contato/conversa por id]
  const exigem: Array<[string, RegExp]> = [
    ["src/api-server/routes/atendimento.ts", /^\/atendimento\/conversas\/:id\//],
    ["src/api-server/routes/ai-sdr.ts", /^\/contatos\/:id\//],
    ["src/api-server/routes/contatos.ts", /^\/contatos\/:id\/(?:atribuir|criar-lead|desvincular|vincular-lead)$/],
    ["src/api-server/routes/whatsapp.ts", /^\/whatsapp\/(?:messages\/:leadId|send)$/],
  ];
  const sem: string[] = [];
  for (const [arq, padrao] of exigem) {
    const f = todas.find((x) => x.arq === arq)!;
    const alvo = handlers(f.src).filter((h) => padrao.test(h.rota));
    assert.ok(alvo.length > 0, `${arq}: nenhuma rota casou com ${padrao} (a trava envelheceu?)`);
    for (const h of alvo) if (!/checarAcessoContato\(/.test(h.corpo)) sem.push(`${arq} ${h.rota}`);
  }
  assert.deepEqual(sem, [], "estas rotas recebem o id de uma conversa e não chamam checarAcessoContato");
});

test("rotas de escrita recusam o 'ver como' (é leitura)", () => {
  const f = todas.find((x) => x.arq === "src/api-server/routes/whatsapp.ts")!;
  for (const rota of ["/whatsapp/send", "/whatsapp/actions", "/whatsapp/status"]) {
    const h = handlers(f.src).filter((x) => x.rota === rota && /\.post\(/.test(x.corpo.slice(0, 12)));
    assert.equal(h.length, 1, rota);
    assert.match(h[0].corpo, /ctx\.isViewingAs/, `${rota} aceita escrita no "ver como"`);
  }
});

test("a mídia de conversa passa pela porta antes de sair", () => {
  const up = todas.find((x) => x.arq === "src/api-server/routes/uploads.ts")!;
  const n = [...up.src.matchAll(/autorizarMidiaWhatsapp\(/g)].length;
  assert.ok(n >= 3, "as rotas /arquivos/:id e /uploads/* precisam consultar autorizarMidiaWhatsapp");
});
