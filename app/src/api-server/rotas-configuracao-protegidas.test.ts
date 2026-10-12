/**
 * Rotas de CONFIGURAÇÃO exigem permissão (SPEC §31).
 *
 * A varredura de 21/09/2026 encontrou 181 de 210 rotas de escrita sem gate de
 * autorização — só `getCtx`, que autentica e não autoriza. Nem todas são
 * problema, e por isso este teste distingue três tipos:
 *
 * **Operação** (criar lead, mover negócio, mandar WhatsApp): quem está no CRM é
 * do time comercial e trabalha. Exigir permissão granular em cada uma seria
 * paranoia que ninguém mantém, e o gate real dessas é a autenticação.
 *
 * **Pública por desenho** (aceitar proposta por link, webhook): o cliente não
 * tem login. O gate delas é token e assinatura, coberto por outros testes.
 *
 * **Configuração**: muda o que o sistema PODE fazer — credencial de provedor,
 * teto de permissão de agente, regra de automação, orçamento. Estas não podem
 * ficar abertas, e a razão é concreta: a configuração é o caminho mais curto
 * para contornar todo o resto. Quem edita a versão de um agente edita o teto de
 * permissão dele; quem cria uma automação faz por regra o que o papel não
 * permite fazer direto.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROTAS = path.resolve(import.meta.dirname, "routes");

/** Arquivos cujas rotas de escrita são todas de configuração. */
const SO_CONFIGURACAO = [
  "automacoes.ts",
  "automacoes-fluxos.ts",
  "automacoes-cadencias.ts",
  "automacoes-agentes.ts",
  "automacoes-agentes-operacao.ts",
  "automacoes-tags.ts",
  "ai-platform.ts",
  "api-tokens.ts",
];

const GATES = /exigirCtx\(c,|getGestaoCtx\(c\)|getSuperCtx\(c\)|isAdminView/;

test("toda rota de escrita de configuração exige autorização", () => {
  const abertas: string[] = [];
  for (const arquivo of SO_CONFIGURACAO) {
    const src = fs.readFileSync(path.join(ROTAS, arquivo), "utf8");
    for (const m of src.matchAll(/app\.(post|patch|put|delete)\("([^"]*)"/g)) {
      const corpo = src.slice(m.index, m.index + 700);
      if (!GATES.test(corpo)) abertas.push(`${arquivo}: ${m[1].toUpperCase()} ${m[2] || "/"}`);
    }
  }
  assert.deepEqual(
    abertas, [],
    "rota de configuração sem autorização — é o caminho mais curto para contornar o RBAC",
  );
});

test("configurar a IA e usar a IA são permissões diferentes", () => {
  const src = fs.readFileSync(path.join(ROTAS, "ai-platform.ts"), "utf8");

  // Mexer no que o agente PODE fazer é configuração; trabalhar a fila dele é
  // uso. Dar as duas juntas faria quem só conversa com o agente poder também
  // ampliar o poder dele.
  assert.match(src, /exigirCtx\(c, "ai\.configure"\)/, "credenciais e provedores exigem ai.configure");
  assert.match(src, /exigirCtx\(c, "ai\.use"\)/, "trabalhar caso e alerta exige só ai.use");

  // A credencial de provedor é o item mais sensível do arquivo.
  const credenciais = src.slice(src.indexOf('app.post("/automacoes/ai/credentials"'));
  assert.match(
    credenciais.slice(0, 400), /exigirCtx\(c, "ai\.configure"\)/,
    "criar credencial de provedor de IA sem gate deixa qualquer um ligar um modelo por conta da empresa",
  );

  const claudeSubscription = src.slice(src.indexOf('app.get("/automacoes/ai/claude-subscription"'),
    src.indexOf('app.put("/automacoes/ai/providers/bindings'));
  assert.match(claudeSubscription, /exigirCtx\(c, "ai\.configure"\)/,
    "o estado e o teste da assinatura Claude devem ser exclusivos de quem configura IA");
  assert.match(claudeSubscription, /ClaudeSubscriptionAdapter/,
    "o botão deve testar o Agent SDK, não uma API Anthropic paralela");
  assert.doesNotMatch(claudeSubscription, /c\.req\.json\(/,
    "a tela Claude não pode receber nem persistir token OAuth pelo navegador");
});

test("a rota de token chama o teto em vez de decidir sozinha", () => {
  // Esta verificação é ESTRUTURAL de propósito, e sabe que é: a versão anterior
  // dela tentava provar a regra procurando texto, e passou com a regra apagada.
  // Quem prova o comportamento é `lib/auth/teto-de-token.test.ts`, que executa a
  // decisão. Aqui só se garante que a rota não tenha uma segunda cópia da regra.
  const src = fs.readFileSync(path.join(ROTAS, "api-tokens.ts"), "utf8");
  assert.match(src, /aplicarTetoDeToken\(/, "a rota tem que delegar a decisão à regra testada");
  assert.doesNotMatch(src, /escopos\.filter\(/, "e não reimplementar o filtro de escopo aqui");
  assert.doesNotMatch(src, /token_sha256[^;]*AS|AS[^;]*token_sha256/,
    "a listagem não pode devolver o hash do token");
});

/**
 * Rotas de escrita SEM sessão. Cada uma tem gate PRÓPRIO, verificado lendo.
 *
 * Esta lista existe porque "166 rotas sem gate de permissão" era um balde com
 * duas coisas dentro: rota de operação, onde a autenticação é o gate, e rota
 * pública por desenho, onde o gate é token ou assinatura. Misturadas, uma rota
 * nova que esquecesse a sessão entraria sem ninguém notar.
 *
 * O que cada uma usa, conferido no código:
 *
 *   apollo /webhook              segredo de ambiente
 *   whatsapp /webhook            assinatura + segredo
 *   auth-flow /esqueci           sempre 200, não revela se o e-mail existe
 *   auth-flow /definir-senha     token com prazo e consumo de uso único
 *   nps /:token                  token do convite
 *   fulfillment-formulario (2)   publicToken do formulário
 *   propostas *-publico (4)      UUID não enumerável + estado e validade
 *                                checados no domínio (proposta-aceite)
 */
const PUBLICAS_POR_DESENHO = new Set([
  "apollo.ts: POST /webhook",
  "auth-flow.ts: POST /definir-senha",
  "auth-flow.ts: POST /esqueci",
  "fulfillment-formulario-publico.ts: POST /fulfillment-formulario/:publicToken/upload",
  "fulfillment-formulario-publico.ts: POST /fulfillment-formulario/:publicToken",
  "nps.ts: POST /:token",
  "propostas.ts: POST /propostas/:id/aceitar-publico",
  "propostas.ts: POST /propostas/:id/recusar-publico",
  "propostas.ts: POST /propostas/:id/ajuste-publico",
  "propostas.ts: POST /propostas/:id/assinar-publico",
  "whatsapp.ts: POST /whatsapp/webhook",
]);

const SESSAO = /getCtx\(c\)|getTenantFromRequest\(c\)/;

test("rota de escrita sem sessão é pública por desenho, e está nomeada", () => {
  // O ponto: rota NOVA que esqueça a sessão cai aqui, em vez de se diluir num
  // contador. Quem a escreveu decide se é pública de propósito e a nomeia, ou
  // põe o gate.
  const semSessao: string[] = [];
  for (const f of fs.readdirSync(ROTAS)) {
    if (!f.endsWith(".ts") || f.endsWith(".test.ts")) continue;
    const src = fs.readFileSync(path.join(ROTAS, f), "utf8");
    for (const m of src.matchAll(/app\.(post|patch|put|delete)\("([^"]*)"/g)) {
      const corpo = src.slice(m.index, m.index + 900);
      if (GATES.test(corpo) || SESSAO.test(corpo)) continue;
      semSessao.push(`${f}: ${m[1].toUpperCase()} ${m[2] || "/"}`);
    }
  }

  const naoDeclaradas = semSessao.filter((r) => !PUBLICAS_POR_DESENHO.has(r));
  assert.deepEqual(naoDeclaradas, [],
    "rota de escrita sem sessão e sem declaração de que é pública:\n" +
    `${naoDeclaradas.join("\n")}\n` +
    "Se for pública de propósito, some à lista dizendo QUAL é o gate dela.");

  // O contrário também: nome na lista que não existe mais vira ruído e faz a
  // próxima pessoa achar que a rota está coberta.
  const obsoletas = [...PUBLICAS_POR_DESENHO].filter((r) => !semSessao.includes(r));
  assert.deepEqual(obsoletas, [],
    `estas estão declaradas como públicas e não existem mais (ou ganharam gate):\n${obsoletas.join("\n")}`);
});

test("o levantamento de rotas abertas continua visível", () => {
  // Este teste NÃO exige que as 181 sejam fechadas: exige que o número não
  // cresça em silêncio. Rota de escrita nova sem gate aparece aqui, e quem a
  // escreveu decide em qual dos três tipos ela cai.
  let escritas = 0;
  let semGate = 0;
  for (const f of fs.readdirSync(ROTAS)) {
    if (!f.endsWith(".ts") || f.endsWith(".test.ts")) continue;
    const src = fs.readFileSync(path.join(ROTAS, f), "utf8");
    for (const m of src.matchAll(/app\.(post|patch|put|delete)\("([^"]*)"/g)) {
      escritas++;
      const corpo = src.slice(m.index, m.index + 700);
      if (!GATES.test(corpo)) semGate++;
    }
  }
  assert.ok(escritas > 150, "a varredura precisa estar encontrando as rotas");
  assert.ok(
    semGate <= 180,
    `${semGate} rotas de escrita sem autorização (medido em 21/09/2026: 166 depois de fechar ` +
    "automação, agente e plataforma de IA; 171 em 05/10, com PATCH /notificacoes, " +
    "que é dado PESSOAL: o gate dele é a sessão mais o filtro por usuario_id, e " +
    "não existe permissão de papel que faça sentido aí; 174 em 05/10 com o " +
    "enriquecimento Apollo — POST /apollo/empresa/dados, /empresa/aplicar e " +
    "/empresa/contatos NÃO estão abertas: cada uma barra quem não é admin " +
    "lendo `ctx.userRole`, um estilo que o regex deste levantamento não " +
    "reconhece, e resolve a empresa por `empresaComDominio(ctx.organizacaoId, …)`, " +
    "então o id vindo do cliente nunca escapa do tenant; 178 em 08/10 com os envios de arquivo de documentos do cliente, arquivos da empresa (POST e DELETE) e do projeto, todos de operação, com sessão e filtro por organizacao_id; 183 em 08/10 com as rotas de distribuição de leads, que barram quem não é gestão lendo `ctx.userRole`, estilo que o regex não reconhece, e as de anexo e IA do Atendimento, todas com sessão e escopo de organização; 180 em 08/10: as rotas de edição de modelo de contrato e de parâmetros do contrato passaram a exigir gestão (`getGestaoCtx`) e o resto do aumento é de rotas de Atendimento e agentes, com sessão e escopo de organização). Se cresceu, uma rota " +
    "nova entrou aberta.",
  );
});

test("a tela de tokens existe e fala com as rotas certas", () => {
  // O backend de tokens ficou pronto e validado antes da tela, e API pública
  // sem forma de criar credencial é API que não existe para quem a usaria:
  // `api_tokens` tinha 0 linhas e só era escrita por script.
  //
  // Esta trava é estrutural: garante que a tela não fique órfã do backend
  // (endpoint renomeado, rota removida) sem ninguém perceber. O comportamento
  // das regras é provado em `smoke-gestao-tokens` e `teto-de-token.test.ts`.
  const tela = fs.readFileSync(
    path.join(ROTAS, "..", "..", "app", "(produto)", "ajustes", "api-tokens", "page.tsx"), "utf8");

  assert.match(tela, /\/api\/configuracoes\/api-tokens/, "a tela tem que chamar a rota de tokens");
  assert.match(tela, /method: "DELETE"/, "e ter como revogar");

  // As três regras do produto, visíveis na tela e não só no servidor.
  assert.match(tela, /não aparece de novo/, "tem que avisar que o valor aparece uma vez só");
  assert.match(tela, /corpo\?\.error/, "e mostrar a mensagem do servidor, que nomeia a permissão que falta");
  assert.match(tela, /revogado em/, "token revogado continua na lista, com a data");

  // O caminho inverso: a rota precisa existir para a tela não quebrar.
  const rota = fs.readFileSync(path.join(ROTAS, "api-tokens.ts"), "utf8");
  assert.match(rota, /app\.get\("\/configuracoes\/api-tokens"/, "listar");
  assert.match(rota, /app\.post\("\/configuracoes\/api-tokens"/, "criar");
  assert.match(rota, /app\.delete\("\/configuracoes\/api-tokens\/:id"/, "revogar");
});
