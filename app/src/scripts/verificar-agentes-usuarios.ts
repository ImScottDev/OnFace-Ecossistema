/**
 * Verificação ponta a ponta de "agentes como usuários" (identidade, regra de
 * distribuição, autonomia, delegação de follow-up e handover).
 *
 * Dois modos:
 *   - LOCAL (padrão): sem token de IA. Sobe um servidor OpenAI-compatível falso
 *     (`ONFACE_AI_BASE_URL_TESTE`) que responde com chamadas de ferramenta
 *     roteirizadas; o resto (banco, ferramentas, runs, timeline, fila de envio) é real.
 *   - DEV com IA real: `VERIFICAR_COM_IA_REAL=1` usa o provider `claude_subscription`
 *     (precisa de CLAUDE_CODE_OAUTH_TOKEN no ambiente). As asserções de efeito
 *     (qualificação, tag, nota) passam a depender do que o modelo decide fazer,
 *     então o script só exige run concluído, mensagem preparada e registro no banco.
 *
 * Nunca envia a número externo: o telefone é fictício e a sessão de WhatsApp usada é
 * a primeira da organização; se estiver conectada (dev), o script ABORTA antes de
 * criar qualquer mensagem, a menos que `VERIFICAR_SESSAO_ID` aponte uma sessão
 * desconectada de teste. Tudo que cria leva o prefixo "[QA]" e é apagado no fim.
 *
 * Uso (de dentro de app/):  node --import tsx --env-file=.env src/scripts/verificar-agentes-usuarios.ts
 */
import { createServer } from "node:http";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  aiAgentRuns, aiAgents, aiAgentVersions, atividades, contatos, delegacoesAgente, leads, negocios, notificacoes, organizacoes,
  regrasDistribuicaoLeads, usuarios, whatsappMensagens, whatsappSessao, aiSdrContatoState, auditLog,
} from "@/lib/db/schema";

const REAL = process.env.VERIFICAR_COM_IA_REAL === "1";
const falhas: string[] = [];
const ok = (rotulo: string, cond: unknown, extra?: unknown) => {
  console.log(`${cond ? "ok    " : "FALHOU"} ${rotulo}${!cond && extra !== undefined ? ` -> ${JSON.stringify(extra)}` : ""}`);
  if (!cond) falhas.push(rotulo);
};

/* ── Modelo falso (modo local) ─────────────────────────────────────────── */
let chamadasDoModelo = 0;
function iniciarModeloFalso(): Promise<string> {
  const server = createServer((req, res) => {
    let corpo = "";
    req.on("data", (c) => (corpo += c));
    req.on("end", () => {
      chamadasDoModelo++;
      const body = JSON.parse(corpo || "{}") as { messages: Array<{ role: string; content: string }> };
      const jaChamouFerramenta = body.messages.some((m) => m.role === "tool");
      const usuario = body.messages.filter((m) => m.role === "user").at(-1)?.content ?? "";
      const tc = (name: string, args: unknown, i: number) => ({ id: `t${i}`, type: "function", function: { name, arguments: JSON.stringify(args) } });
      let tool_calls: unknown[] = [];
      if (!jaChamouFerramenta) {
        if (usuario.startsWith("Um lead novo foi atribuído")) tool_calls = [
          tc("lead_qualify", { dor: "perde ligações fora do horário", fit: "alto", proxima_acao: "agendar demonstração" }, 1),
          tc("lead_tag", { acao: "adicionar", tag: "[QA] Lead quente" }, 2),
          tc("activity_note", { titulo: "[QA] Primeiro contato feito pela agente", descricao: "Abordagem consultiva enviada." }, 3),
          tc("message_prepare", { messages: ["[QA] Oi! Aqui é a Lia, da Callface. Vi seu interesse e queria entender como vocês tratam as ligações hoje."] }, 4),
        ];
        else if (usuario.startsWith("Follow-up delegado")) tool_calls = [
          tc("task_create", { titulo: "[QA] Ligar para o cliente se não responder", prioridade: "alta" }, 1),
          tc("message_prepare", { messages: ["[QA] Oi! Passando para saber se deu para olhar a proposta. Posso tirar alguma dúvida?"] }, 2),
        ];
        else if (/desconto especial/i.test(usuario)) tool_calls = [tc("handoff_request", { motivo: "[QA] Cliente pede desconto fora da política", prioridade: "alta" }, 1)];
        else tool_calls = [tc("message_prepare", { messages: ["[QA] Claro! Posso te explicar como funciona."] }, 1)];
      }
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ choices: [{ finish_reason: tool_calls.length ? "tool_calls" : "stop", message: { content: tool_calls.length ? null : "ok", tool_calls: tool_calls.length ? tool_calls : undefined } }], usage: { prompt_tokens: 120, completion_tokens: 40 } }));
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${(server.address() as { port: number }).port}/v1`)));
}

async function main() {
  if (!REAL) {
    process.env.ONFACE_AI_BASE_URL_TESTE = await iniciarModeloFalso();
    process.env["OPENAI" + "_API_KEY"] = "stub-local"; // stub do provedor falso de teste local, nunca chave real
  }
  const { sincronizarUsuariosDosAgentes } = await import("@/lib/agentes/usuario-do-agente");
  const { salvarRegra, removerRegra, resolverPorRegra, historicoDasRegras } = await import("@/lib/agentes/distribuicao");
  const { acionarAgenteParaMensagem, iniciarLeadsNovosDaAgente, processarDelegacoesVencidas, delegarPorTag } = await import("@/lib/agentes/autonomia");
  const { delegarAAgente, devolverDelegacao } = await import("@/lib/agentes/delegacao");
  const preVendas = await import("@/lib/vendas/pre-vendas");
  const pipeline = await import("@/lib/vendas/pipeline");
  const { atorHumano } = await import("@/lib/vendas/dominio");
  const { adicionarTag } = await import("@/lib/crm/tags");

  const [org] = await db.select({ id: organizacoes.id }).from(organizacoes).limit(1);
  const orgId = org.id;
  const [scott] = await db.select().from(usuarios).where(and(eq(usuarios.organizacaoId, orgId), eq(usuarios.role, "super_admin"))).limit(1);
  const [gerente] = await db.select().from(usuarios).where(and(eq(usuarios.organizacaoId, orgId), eq(usuarios.role, "gerente"), eq(usuarios.ativo, true))).limit(1);
  const [admin2] = await db.select().from(usuarios).where(and(eq(usuarios.organizacaoId, orgId), eq(usuarios.role, "admin"), eq(usuarios.ativo, true), eq(usuarios.tipo, "humano"))).limit(1);

  // Sessão de WhatsApp: precisa estar DESCONECTADA (nenhum envio real).
  const sessoes = await db.select().from(whatsappSessao).where(eq(whatsappSessao.organizacaoId, orgId));
  const sessao = process.env.VERIFICAR_SESSAO_ID ? sessoes.find((s) => s.id === process.env.VERIFICAR_SESSAO_ID) : sessoes.find((s) => s.status !== "connected");
  if (!sessao || sessao.status === "connected") throw new Error("Sem sessão de WhatsApp desconectada para o teste. Defina VERIFICAR_SESSAO_ID com uma sessão de teste desconectada.");

  const ids = { agentId: "", versionId: "", leads: [] as string[], negocios: [] as string[], regras: [] as string[], contatos: [] as string[], usuarioAgente: "" };
  const marcaTel = "55119" + String(Math.floor(10000000 + Math.random() * 89999999)); // fictício
  const mkLead = async (nome: string, tel: string) => {
    const criado = await preVendas.criarLead({
      organizacaoId: orgId, empresa: { nome: `[QA] Empresa ${nome}` } as never,
      pessoa: { nome: `[QA] ${nome}`, telefone: tel, email: `qa-${tel}@teste.invalid` },
      touchpoint: { tipoOrigem: "manual", source: "qa" }, origem: "QA agentes",
    }, atorHumano(scott.id));
    ids.leads.push(criado.leadId);
    return criado.leadId;
  };
  const dono = async (leadId: string) => (await db.select({ r: leads.responsavelId, e: leads.estagioPreVendas, p: leads.primeiroContatoAt }).from(leads).where(eq(leads.id, leadId)))[0];

  // Resíduo de uma execução anterior interrompida: o que este script cria tem nomes fixos.
  const resid = await db.execute<{ id: string }>(sql`SELECT id::text FROM leads WHERE organizacao_id = ${orgId}::uuid AND (nome ~ '^[[]QA[]] Lead [A-E]$' OR nome IN ('[QA] Lead Manual', '[QA] Explícito'))`);
  const [lia] = await db.select({ id: aiAgents.id }).from(aiAgents).where(and(eq(aiAgents.organizacaoId, orgId), eq(aiAgents.nome, "[QA] Lia"))).limit(1);
  if (resid.length || lia) {
    const [uLia] = lia ? await db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.agenteId, lia.id)) : [];
    const negs = resid.length ? await db.execute<{ id: string }>(sql`SELECT id::text FROM negocios WHERE lead_id IN (${sql.join(resid.map((r) => sql`${r.id}::uuid`), sql`, `)})`) : [];
    const regs = await db.execute<{ id: string }>(sql`SELECT id::text FROM regras_distribuicao_leads WHERE nome LIKE '[QA]%'`);
    await limpar(orgId, { agentId: lia?.id ?? "", versionId: "", leads: resid.map((r) => r.id), negocios: negs.map((n) => n.id), regras: regs.map((r) => r.id), contatos: [], usuarioAgente: uLia?.id ?? "" });
    console.log(`resíduo anterior limpo (${resid.length} leads)`);
  }

  try {
    /* 1. Identidade ------------------------------------------------------ */
    const [agente] = await db.insert(aiAgents).values({ organizacaoId: orgId, nome: "[QA] Lia", slug: `qa-lia-${Date.now()}`, finalidade: "pre_vendas", status: "draft", prioridade: 50 }).returning();
    ids.agentId = agente.id;
    const [versao] = await db.insert(aiAgentVersions).values({
      organizacaoId: orgId, agentId: agente.id, versao: 1, status: "published", publishedAt: new Date(),
      systemPrompt: "Você é a Lia, SDR da Callface. Seja consultiva e curta.",
      provider: REAL ? "claude_subscription" : "openai", modelo: REAL ? "claude-sonnet-4-6" : "stub-model",
      tools: ["context.read_contact", "context.read_conversation", "context.read_crm", "lead.qualify", "lead.tag", "activity.note", "task.create", "lead.update_status", "deal.advance", "meeting.schedule", "message.prepare", "handoff.request"],
      triggerConfig: { events: ["conversation.message_received"] }, handoffConfig: { enabled: true, keywords: ["falar com humano"] },
      guardrailConfig: { autonomia: "autonomous", permissoes: ["acquisition.manage", "sales.manage"], horarioComercial: { ativo: false } },
      channelSessionId: sessao.id, maxSteps: 6, tokenBudget: 2000,
    }).returning();
    ids.versionId = versao.id;
    await db.update(aiAgents).set({ status: "published", publishedVersionId: versao.id }).where(eq(aiAgents.id, agente.id));

    await sincronizarUsuariosDosAgentes(orgId);
    const [uAg] = await db.select().from(usuarios).where(eq(usuarios.agenteId, agente.id));
    ok("agente publicado de atendimento virou usuário (tipo agente, ativo)", uAg?.tipo === "agente" && uAg.ativo);
    ok("usuário-agente sem senha utilizável e e-mail inválido", uAg?.senhaHash === "!agente-sem-login" && uAg.email.endsWith(".invalid"));
    ids.usuarioAgente = uAg.id;
    const bcrypt = (await import("bcryptjs")).default;
    ok("nenhuma senha digitada passa no bcrypt do usuário-agente", !(await bcrypt.compare("!agente-sem-login", uAg.senhaHash).catch(() => false)));
    await sincronizarUsuariosDosAgentes(orgId); // idempotente
    ok("sincronizar é idempotente (1 usuário por agente)", (await db.select().from(usuarios).where(eq(usuarios.agenteId, agente.id))).length === 1);

    /* 2. Regra de distribuição ------------------------------------------- */
    const humanoDev = gerente ?? admin2;
    const regra = await salvarRegra(orgId, scott.id, {
      nome: "[QA] Todos os leads para a Lia", alvoTipo: "usuario", alvoUsuarioId: uAg.id, humanoDevolucaoId: humanoDev.id, prioridade: 1,
    });
    ids.regras.push(regra.id);
    const leadA = await mkLead("Lead A", marcaTel);
    const A = await dono(leadA);
    ok("lead novo criado SEM responsável cai na Lia pela regra (criarLead)", A.r === uAg.id, A);
    const [evAtrib] = await db.execute<{ tipo: string; ctx: { regraId?: string; origemAtribuicao?: string } }>(sql`SELECT tipo, contexto AS ctx FROM vendas_eventos WHERE lead_id = ${leadA}::uuid AND tipo = 'LeadAssigned'`);
    ok("evento LeadAssigned registra a regra aplicada", evAtrib?.ctx?.regraId === regra.id && evAtrib.ctx.origemAtribuicao === "regra_distribuicao", evAtrib);
    const [aq] = await db.execute<{ r: string | null }>(sql`SELECT responsavel_id::text AS r FROM aquisicoes WHERE lead_legado_id = ${leadA}::uuid`);
    ok("aquisição canônica (board) também tem a Lia como responsável", aq?.r === uAg.id, aq);

    const atribuido = await mkLead("Lead Manual", "55119" + String(Math.floor(10000000 + Math.random() * 89999999)));
    await db.update(leads).set({ responsavelId: scott.id }).where(eq(leads.id, atribuido));
    await preVendas.atribuirResponsavel({ organizacaoId: orgId, leadId: atribuido, responsavelId: uAg.id, origemAtribuicao: "manual", ator: atorHumano(scott.id) });
    const [evOwner] = await db.execute<{ ator_tipo: string; usuario_id: string | null; para: string }>(sql`SELECT ator_tipo, usuario_id::text, contexto->>'para' AS para FROM vendas_eventos WHERE lead_id = ${atribuido}::uuid AND tipo = 'OwnerChanged' ORDER BY ocorrido_em DESC LIMIT 1`);
    ok("trocar o responsável para a agente grava OwnerChanged com ator humano", (await dono(atribuido)).r === uAg.id && evOwner?.ator_tipo === "HUMAN" && evOwner.usuario_id === scott.id && evOwner.para === uAg.id, evOwner);

    const explicito = await preVendas.criarLead({ organizacaoId: orgId, empresa: null, pessoa: { nome: "[QA] Explícito", email: `qa-expl-${Date.now()}@teste.invalid` }, touchpoint: { tipoOrigem: "manual", source: "qa" }, responsavelId: scott.id }, atorHumano(scott.id));
    ids.leads.push(explicito.leadId);
    ok("responsável escolhido na criação vence a regra", (await dono(explicito.leadId)).r === scott.id);

    await salvarRegra(orgId, scott.id, { id: regra.id, nome: regra.nome, alvoTipo: "usuario", alvoUsuarioId: uAg.id, diasSemana: [0, 1, 2, 3, 4, 5, 6], horaInicio: "00:00", horaFim: "00:01", humanoDevolucaoId: humanoDev.id, prioridade: 1 });
    ok("regra fora da janela de horário não é aplicada", (await resolverPorRegra({ organizacaoId: orgId })) === null);
    await salvarRegra(orgId, scott.id, { id: regra.id, nome: regra.nome, alvoTipo: "usuario", alvoUsuarioId: uAg.id, humanoDevolucaoId: humanoDev.id, prioridade: 1 });
    const rod = await salvarRegra(orgId, scott.id, { nome: "[QA] Rodízio", alvoTipo: "rodizio", rodizioUsuarioIds: [uAg.id, scott.id], prioridade: 0 });
    ids.regras.push(rod.id);
    const r1 = await resolverPorRegra({ organizacaoId: orgId }), r2 = await resolverPorRegra({ organizacaoId: orgId });
    ok("rodízio alterna entre agente e pessoa", r1 && r2 && r1.responsavelId !== r2.responsavelId, [r1, r2]);
    await removerRegra(orgId, scott.id, rod.id); ids.regras = ids.regras.filter((x) => x !== rod.id);
    const hist = await historicoDasRegras(orgId, 20);
    ok("histórico registra quem criou, alterou e removeu", ["criada", "alterada", "removida"].every((a) => hist.some((h) => h.acao === a && h.quem === scott.nome)), hist.map((h) => h.acao));

    /* 3. Autonomia: primeiro contato ------------------------------------- */
    const ini = await iniciarLeadsNovosDaAgente(new Date(), 50);
    ok("sweep inicia o contato do lead novo atribuído à agente", ini.iniciados >= 1, ini);
    const [runA] = await db.select().from(aiAgentRuns).where(and(eq(aiAgentRuns.leadId, leadA), eq(aiAgentRuns.agentId, agente.id)));
    ok("run live registrado em ai_agent_runs com trace", runA?.modo === "live" && runA.status === "completed" && Array.isArray(runA.trace) && runA.trace.length > 2, runA && { status: runA.status, erro: runA.erro });
    const [ctA] = await db.select().from(contatos).where(eq(contatos.leadId, leadA));
    ids.contatos.push(ctA?.id);
    const msgsA = ctA ? await db.select().from(whatsappMensagens).where(and(eq(whatsappMensagens.contatoId, ctA.id), eq(whatsappMensagens.direcao, "out"))) : [];
    ok("mensagem da agente gravada em whatsapp_mensagens pela sessão configurada", msgsA.length >= 1 && msgsA[0].sessaoId === sessao.id && (msgsA[0].dados as { aiGenerated?: boolean })?.aiGenerated === true, msgsA[0]);
    const AA = await dono(leadA);
    ok("primeiro contato registrado (SLA) e lead foi para Em contato", Boolean(AA.p) && AA.e === "em_contato", AA);
    const [fc] = await db.execute<{ ator_tipo: string; usuario_id: string | null }>(sql`SELECT ator_tipo, usuario_id::text FROM vendas_eventos WHERE lead_id = ${leadA}::uuid AND tipo = 'FirstContactMade'`);
    ok("FirstContactMade tem autor = a agente (AI_AGENT + usuário da agente)", fc?.ator_tipo === "AI_AGENT" && fc.usuario_id === uAg.id, fc);
    if (!REAL) {
      const timeline = await db.select({ titulo: atividades.titulo, usuarioId: atividades.usuarioId }).from(atividades).where(eq(atividades.leadId, leadA));
      ok("timeline do lead: nota e qualificação assinadas pela agente", timeline.filter((t) => t.usuarioId === uAg.id).length >= 2, timeline);
      const [lq] = await db.select({ cc: leads.camposCustom }).from(leads).where(eq(leads.id, leadA));
      ok("qualificação gravada no lead", JSON.stringify(lq.cc).includes("perde ligações"), lq);
      const [tag] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM entity_labels el JOIN labels l ON l.id = el.label_id WHERE el.entity_id = ${leadA}::uuid AND l.nome = '[QA] Lead quente'`);
      ok("tag aplicada pela agente", tag.n === 1);
    }
    const again = await iniciarLeadsNovosDaAgente(new Date(), 50);
    ok("não repete o primeiro contato (idempotente por lead)", (await db.select().from(aiAgentRuns).where(and(eq(aiAgentRuns.leadId, leadA), eq(aiAgentRuns.agentId, agente.id)))).length === 1, again);

    /* 4. Mensagem do cliente: responde / para / handover ------------------ */
    const msgIn = async (texto: string) => {
      const [m] = await db.insert(whatsappMensagens).values({ contatoId: ctA.id, leadId: leadA, sessaoId: ctA.sessaoId!, telefone: ctA.telefone!, direcao: "in", tipo: "text", conteudo: texto, status: "received" }).returning({ id: whatsappMensagens.id });
      return m.id;
    };
    const r = await acionarAgenteParaMensagem({ organizacaoId: orgId, contatoId: ctA.id, leadId: leadA, mensagem: "Qual o preço do plano?", sourceMessageId: await msgIn("Qual o preço do plano?") });
    ok("mensagem inbound com a agente como responsável é tratada por ela", r.tratado && (r.resultado === "respondeu" || r.resultado === "falhou"), r);
    if (!REAL) ok("e a resposta sai (respondeu)", r.tratado && r.resultado === "respondeu", r);

    const humano = await acionarAgenteParaMensagem({ organizacaoId: orgId, contatoId: ctA.id, leadId: leadA, mensagem: "Quero falar com um atendente, por favor", sourceMessageId: await msgIn("Quero falar com um atendente") });
    ok("cliente pede humano: handover imediato, sem chamar o modelo", humano.tratado && humano.resultado === "handover" && humano.motivo === "pedido_humano", humano);
    const H = await dono(leadA);
    ok("responsável volta para o humano definido na regra", H.r === humanoDev.id, { esperado: humanoDev.nome, obtido: H.r });
    const [ev] = await db.execute<{ tipo: string; ator_tipo: string }>(sql`SELECT tipo, ator_tipo FROM vendas_eventos WHERE lead_id = ${leadA}::uuid AND tipo = 'OwnerChanged' ORDER BY ocorrido_em DESC LIMIT 1`);
    ok("evento OwnerChanged do handover com autor = agente", ev?.ator_tipo === "AI_AGENT", ev);
    const notifs = await db.select().from(notificacoes).where(and(eq(notificacoes.usuarioId, humanoDev.id), eq(notificacoes.tipo, "handover_agente")));
    ok("humano recebeu notificação de handover", notifs.some((n) => (n.mensagem ?? "").includes("pediu para falar com uma pessoa")));
    const notas = await db.select({ t: atividades.titulo, u: atividades.usuarioId }).from(atividades).where(and(eq(atividades.leadId, leadA), eq(atividades.titulo, "Atendimento passado para uma pessoa")));
    ok("nota de contexto do handover assinada pela agente", notas.length === 1 && notas[0].u === uAg.id);
    const [pausa] = await db.select().from(aiSdrContatoState).where(eq(aiSdrContatoState.contatoId, ctA.id));
    ok("IA pausada na conversa após o handover", pausa?.aiAtivo === false);
    const depois = await acionarAgenteParaMensagem({ organizacaoId: orgId, contatoId: ctA.id, leadId: leadA, mensagem: "oi?" });
    ok("com humano como responsável, a agente não responde mais (fluxo antigo segue)", depois.tratado === false);

    // Assunto sensível e handoff pedido pelo próprio modelo, em leads novos.
    const leadB = await mkLead("Lead B", "55119" + String(Math.floor(10000000 + Math.random() * 89999999)));
    const ctB = (await garantirContato(leadB, sessao.id, ids)).contato;
    const sens = await acionarAgenteParaMensagem({ organizacaoId: orgId, contatoId: ctB.id, leadId: leadB, mensagem: "Vou acionar o Procon, isso é um golpe" });
    ok("assunto sensível: handover imediato com motivo", sens.tratado && sens.resultado === "handover" && sens.motivo === "assunto_sensivel", sens);
    ok("lead B voltou ao humano", (await dono(leadB)).r === humanoDev.id);

    if (!REAL) {
      await db.update(leads).set({ responsavelId: uAg.id }).where(eq(leads.id, leadB));
      await db.delete(aiSdrContatoState).where(eq(aiSdrContatoState.contatoId, ctB.id));
      const viaTool = await acionarAgenteParaMensagem({ organizacaoId: orgId, contatoId: ctB.id, leadId: leadB, mensagem: "Preciso de um desconto especial" });
      ok("agente pede handover pela ferramenta handoff_request", viaTool.tratado && viaTool.resultado === "handover", viaTool);
      ok("handover pela ferramenta também devolve o responsável", (await dono(leadB)).r === humanoDev.id);
    }

    // Taxa máxima: limite de 1 mensagem/hora.
    const leadC = await mkLead("Lead C", "55119" + String(Math.floor(10000000 + Math.random() * 89999999)));
    const ctC = (await garantirContato(leadC, sessao.id, ids)).contato;
    await db.update(aiAgentVersions).set({ guardrailConfig: { autonomia: "autonomous", permissoes: ["acquisition.manage"], horarioComercial: { ativo: false }, limites: { maxMensagensPorHora: 1 } } }).where(eq(aiAgentVersions.id, versao.id));
    await db.insert(whatsappMensagens).values({ contatoId: ctC.id, leadId: leadC, sessaoId: ctC.sessaoId!, telefone: ctC.telefone!, direcao: "out", tipo: "text", conteudo: "[QA] anterior", status: "failed", dados: { aiGenerated: true } });
    const taxa = await acionarAgenteParaMensagem({ organizacaoId: orgId, contatoId: ctC.id, leadId: leadC, mensagem: "olá" });
    ok("taxa máxima atingida: bloqueia, registra run abortado e alerta", taxa.tratado && taxa.resultado === "bloqueado" && taxa.motivo === "taxa_maxima_hora", taxa);
    await db.update(aiAgentVersions).set({ guardrailConfig: { autonomia: "autonomous", permissoes: ["acquisition.manage", "sales.manage"], horarioComercial: { ativo: false } } }).where(eq(aiAgentVersions.id, versao.id));

    /* 5. Delegar follow-up ------------------------------------------------ */
    const leadD = await mkLead("Lead D", "55119" + String(Math.floor(10000000 + Math.random() * 89999999)));
    await db.update(leads).set({ responsavelId: scott.id }).where(eq(leads.id, leadD));
    const opp = await pipeline.criarOportunidadeDoLead({ organizacaoId: orgId, leadId: leadD, familias: ["CALLFACE_AI"], responsavelId: scott.id, ator: atorHumano(scott.id) });
    const negId = opp.oportunidades[0].id;
    ids.negocios.push(negId);
    const ctD = (await garantirContato(leadD, sessao.id, ids)).contato;
    const deleg = await delegarAAgente({ organizacaoId: orgId, negocioId: negId, agenteUsuarioId: uAg.id, motivo: "[QA] Proposta enviada, acompanhar", diasSemResposta: 2, intervaloDias: 2, maxToques: 2, ator: atorHumano(scott.id) });
    const [n1] = await db.select({ r: negocios.responsavelId }).from(negocios).where(eq(negocios.id, negId));
    ok("delegar: oportunidade passa a ter a agente como responsável", n1.r === uAg.id);
    const [oa] = await db.execute<{ ator_tipo: string; usuario_id: string | null }>(sql`SELECT ator_tipo, usuario_id::text FROM vendas_eventos WHERE negocio_id = ${negId}::uuid AND tipo = 'OpportunityAssigned' ORDER BY ocorrido_em DESC LIMIT 1`);
    ok("evento OpportunityAssigned com ator humano (quem delegou)", oa?.ator_tipo === "HUMAN" && oa.usuario_id === scott.id, oa);
    ok("delegação guarda motivo, cadência e para quem devolver", deleg.motivo.startsWith("[QA]") && deleg.maxToques === 2 && deleg.humanoUsuarioId === scott.id && deleg.status === "ativa");
    let duplicou = false;
    try { await delegarAAgente({ organizacaoId: orgId, negocioId: negId, agenteUsuarioId: uAg.id, motivo: "[QA] dup", ator: atorHumano(scott.id) }); } catch { duplicou = true; }
    ok("não permite duas delegações ativas na mesma oportunidade", duplicou);

    await db.update(delegacoesAgente).set({ proximoToqueEm: new Date(Date.now() - 1000) }).where(eq(delegacoesAgente.id, deleg.id));
    const t1 = await processarDelegacoesVencidas(new Date(), 50);
    const [d1] = await db.select().from(delegacoesAgente).where(eq(delegacoesAgente.id, deleg.id));
    ok("toque vencido aciona a agente e agenda o próximo", t1.toques >= 1 && d1.toques === 1 && d1.proximoToqueEm! > new Date(), { t1, d1 });
    const runsD = await db.select().from(aiAgentRuns).where(and(eq(aiAgentRuns.leadId, leadD), eq(aiAgentRuns.agentId, agente.id)));
    ok("run do follow-up registrado (followup.delegado)", runsD.some((x) => (x.input as { eventType?: string })?.eventType === "followup.delegado"), runsD.map((x) => x.input));
    const msgsD = await db.select().from(whatsappMensagens).where(and(eq(whatsappMensagens.contatoId, ctD.id), eq(whatsappMensagens.direcao, "out")));
    ok("mensagem do follow-up registrada em whatsapp_mensagens", msgsD.length >= 1);

    // Cliente respondeu -> o toque não dispara de novo, o fluxo de mensagem recebida cuida.
    await db.insert(whatsappMensagens).values({ contatoId: ctD.id, leadId: leadD, sessaoId: ctD.sessaoId!, telefone: ctD.telefone!, direcao: "in", tipo: "text", conteudo: "vi sim, obrigado", status: "received" });
    await db.update(delegacoesAgente).set({ proximoToqueEm: new Date(Date.now() - 1000) }).where(eq(delegacoesAgente.id, deleg.id));
    const t2 = await processarDelegacoesVencidas(new Date(), 50);
    ok("cliente respondeu: toque adiado, sem novo envio", t2.adiadas >= 1 && (await db.select().from(delegacoesAgente).where(eq(delegacoesAgente.id, deleg.id)))[0].toques === 1, t2);

    // Sem resposta até o teto de toques -> volta para o humano.
    await db.update(delegacoesAgente).set({ toques: 2, ultimoToqueEm: new Date(Date.now() + 60_000), proximoToqueEm: new Date(Date.now() - 1000) }).where(eq(delegacoesAgente.id, deleg.id));
    const t3 = await processarDelegacoesVencidas(new Date(), 50);
    const [d3] = await db.select().from(delegacoesAgente).where(eq(delegacoesAgente.id, deleg.id));
    const [n3] = await db.select({ r: negocios.responsavelId }).from(negocios).where(eq(negocios.id, negId));
    ok("teto de toques sem resposta: devolve ao humano com motivo", t3.devolvidas >= 1 && d3.status === "devolvida" && n3.r === scott.id && /Sem resposta/.test(d3.devolvidaMotivo ?? ""), { t3, d3: d3.status, n3 });

    // Devolução manual + delegação por tag.
    const deleg2 = await delegarAAgente({ organizacaoId: orgId, negocioId: negId, agenteUsuarioId: uAg.id, motivo: "[QA] segunda delegação", ator: atorHumano(scott.id) });
    await devolverDelegacao({ organizacaoId: orgId, delegacaoId: deleg2.id, ator: atorHumano(scott.id), motivo: "[QA] cliente ligou" });
    const [n4] = await db.select({ r: negocios.responsavelId }).from(negocios).where(eq(negocios.id, negId));
    ok("humano devolve a delegação e volta a ser o responsável", n4.r === scott.id && (await db.select().from(delegacoesAgente).where(eq(delegacoesAgente.id, deleg2.id)))[0].status === "devolvida");

    const leadE = await mkLead("Lead E", "55119" + String(Math.floor(10000000 + Math.random() * 89999999)));
    await db.update(leads).set({ responsavelId: scott.id }).where(eq(leads.id, leadE));
    const oppE = await pipeline.criarOportunidadeDoLead({ organizacaoId: orgId, leadId: leadE, familias: ["PABX"], responsavelId: scott.id, ator: atorHumano(scott.id) });
    ids.negocios.push(oppE.oportunidades[0].id);
    await db.update(organizacoes).set({ settings: sql`jsonb_set(coalesce(settings,'{}'::jsonb), '{agentes}', ${JSON.stringify({ agenteFollowupPadraoId: uAg.id, humanoDevolucaoPadraoId: humanoDev.id })}::jsonb)` }).where(eq(organizacoes.id, orgId));
    const tagR = await adicionarTag({ organizacaoId: orgId, entityType: "negocio", entityId: oppE.oportunidades[0].id, label: "Follow-up IA", atorId: scott.id });
    ok("tag \"Follow-up IA\" existe e foi aplicada", tagR.ok, tagR);
    const nTag = await delegarPorTag();
    const [n5] = await db.select({ r: negocios.responsavelId }).from(negocios).where(eq(negocios.id, oppE.oportunidades[0].id));
    ok("tag Follow-up IA delega a oportunidade ao agente padrão", nTag >= 1 && n5.r === uAg.id, { nTag, n5 });
    const [dTag] = await db.select().from(delegacoesAgente).where(and(eq(delegacoesAgente.negocioId, oppE.oportunidades[0].id), eq(delegacoesAgente.status, "ativa")));
    ok("delegação por tag guarda gatilho e o humano de devolução", dTag?.gatilho === "tag" && dTag.humanoUsuarioId === scott.id, dTag);
  } finally {
    await limpar(orgId, ids);
    const sobras = await db.execute<{ n: number }>(sql`SELECT (SELECT count(*) FROM leads WHERE nome LIKE '[QA]%')::int AS n`);
    console.log(`limpeza concluída (sobras de leads [QA]: ${sobras[0]?.n})`);
  }
  if (falhas.length) { console.error(`\n${falhas.length} verificação(ões) falharam:\n- ${falhas.join("\n- ")}`); process.exit(1); }
  console.log("\ntudo certo");
  process.exit(0);
}

async function garantirContato(leadId: string, sessaoId: string, ids: { contatos: string[] }) {
  const [l] = await db.select().from(leads).where(eq(leads.id, leadId));
  let [c] = await db.select().from(contatos).where(eq(contatos.leadId, leadId));
  if (!c) [c] = await db.insert(contatos).values({ organizacaoId: l.organizacaoId, canal: "whatsapp", nome: l.nome, telefone: l.telefone!.replace(/\D/g, ""), sessaoId, responsavelId: l.responsavelId, leadId }).returning();
  ids.contatos.push(c.id);
  return { contato: c };
}

/** Apaga só o que o script criou (por id), na ordem das chaves estrangeiras. */
async function limpar(orgId: string, ids: { agentId: string; versionId: string; leads: string[]; negocios: string[]; regras: string[]; contatos: string[]; usuarioAgente: string }) {
  const L = ids.leads.length ? ids.leads : ["00000000-0000-0000-0000-000000000000"];
  const N = ids.negocios.length ? ids.negocios : ["00000000-0000-0000-0000-000000000000"];
  const C = ids.contatos.filter(Boolean).length ? ids.contatos.filter(Boolean) : ["00000000-0000-0000-0000-000000000000"];
  const tentar = async (rotulo: string, fn: () => Promise<unknown>) => { try { await fn(); } catch (e) { console.warn(`limpeza: ${rotulo}: ${(e as Error).message.slice(0, 140)}`); } };
  const lista = (a: string[]) => sql.join(a.map((x) => sql`${x}::uuid`), sql`, `);
  await tentar("settings", () => db.execute(sql`UPDATE organizacoes SET settings = settings - 'agentes' WHERE id = ${orgId}::uuid AND settings ? 'agentes'`));
  await tentar("runs", async () => { if (ids.agentId) { await db.execute(sql`DELETE FROM ai_cases WHERE agent_id = ${ids.agentId}::uuid`); await db.execute(sql`DELETE FROM ai_alerts WHERE body LIKE ${"%" + ids.agentId + "%"} OR ref_id IN (${lista(C)})`); await db.delete(aiAgentRuns).where(eq(aiAgentRuns.agentId, ids.agentId)); } });
  // Contatos também nascem sozinhos quando o responsável muda; apaga por lead, não só pelos ids que o script criou.
  const doLead = sql`(SELECT id FROM contatos WHERE lead_id IN (${lista(L)}))`;
  await tentar("mensagens", () => db.execute(sql`DELETE FROM whatsapp_mensagens WHERE contato_id IN (${lista(C)}) OR contato_id IN ${doLead} OR lead_id IN (${lista(L)})`));
  await tentar("estado ia", () => db.execute(sql`DELETE FROM ai_sdr_contato_state WHERE contato_id IN (${lista(C)}) OR contato_id IN ${doLead}`));
  await tentar("runs dos contatos", () => db.execute(sql`DELETE FROM ai_agent_runs WHERE contato_id IN ${doLead} OR lead_id IN (${lista(L)})`));
  await tentar("delegacoes", () => db.execute(sql`DELETE FROM delegacoes_agente WHERE lead_id IN (${lista(L)}) OR negocio_id IN (${lista(N)})`));
  await tentar("contatos", () => db.execute(sql`DELETE FROM contatos WHERE id IN (${lista(C)}) OR lead_id IN (${lista(L)})`));
  await tentar("tarefas", () => db.execute(sql`DELETE FROM tarefas WHERE lead_id IN (${lista(L)}) OR negocio_id IN (${lista(N)})`));
  await tentar("notificacoes", () => db.execute(sql`DELETE FROM notificacoes WHERE mensagem LIKE '[QA]%' OR link LIKE ANY (SELECT '%' || x || '%' FROM unnest(ARRAY[${lista(L)}]::uuid[]) x)`));
  await tentar("labels dos alvos", async () => { await db.execute(sql`DELETE FROM entity_labels WHERE entity_id IN (${lista([...L, ...N])})`); await db.execute(sql`DELETE FROM lead_labels WHERE lead_id IN (${lista(L)})`); await db.execute(sql`DELETE FROM negocio_labels WHERE negocio_id IN (${lista(N)})`); await db.execute(sql`DELETE FROM labels WHERE nome LIKE '[QA]%'`); });
  await tentar("eventos", async () => {
    for (const t of ["vendas_eventos", "atividades", "status_changes"]) {
      await db.execute(sql`DELETE FROM ${sql.raw(t)} WHERE lead_id IN (${lista(L)}) OR negocio_id IN (${lista(N)})`);
    }
  });
  await tentar("eventos canônicos", async () => {
    await db.execute(sql`DELETE FROM event_outbox WHERE aggregate_id IN (${lista([...L, ...N])})`);
    await db.execute(sql`DELETE FROM domain_events WHERE aggregate_id IN (${lista([...L, ...N])})`);
    await db.delete(auditLog).where(and(eq(auditLog.organizacaoId, orgId), inArray(auditLog.entityId, [...ids.leads, ...ids.negocios, ...ids.regras])));
  });
  await tentar("oportunidades", async () => { await db.execute(sql`DELETE FROM oportunidades WHERE negocio_id_legado IN (${lista(N)})`); await db.execute(sql`DELETE FROM negocios WHERE id IN (${lista(N)})`); });
  await tentar("aquisicoes", () => db.execute(sql`DELETE FROM aquisicoes WHERE lead_legado_id IN (${lista(L)})`));
  await tentar("pessoas", async () => { await db.execute(sql`DELETE FROM timeline_events WHERE pessoa_id IN (SELECT id FROM pessoas WHERE lead_id_legado IN (${lista(L)}))`); await db.execute(sql`DELETE FROM pessoas WHERE lead_id_legado IN (${lista(L)})`); });
  await tentar("leads", () => db.execute(sql`DELETE FROM leads WHERE id IN (${lista(L)})`));
  await tentar("empresas", async () => {
    const emp = sql`(SELECT id FROM empresas WHERE nome LIKE '[QA] Empresa Lead %')`;
    for (const t of ["vendas_eventos", "atividades", "timeline_events", "tarefas"]) await db.execute(sql`DELETE FROM ${sql.raw(t)} WHERE empresa_id IN ${emp}`);
    await db.execute(sql`DELETE FROM empresas WHERE nome LIKE '[QA] Empresa Lead %'`);
  });
  await tentar("regras", async () => { if (ids.regras.length) await db.delete(regrasDistribuicaoLeads).where(inArray(regrasDistribuicaoLeads.id, ids.regras)); await db.execute(sql`DELETE FROM audit_log WHERE entity_type = 'regra_distribuicao' AND organizacao_id = ${orgId}::uuid AND (after->>'nome' LIKE '[QA]%' OR before->>'nome' LIKE '[QA]%')`); });
  await tentar("agente", async () => {
    if (!ids.agentId) return;
    await db.execute(sql`DELETE FROM audit_log WHERE actor_id = ${ids.usuarioAgente}::uuid`);
    await db.execute(sql`UPDATE ai_agents SET published_version_id = NULL WHERE id = ${ids.agentId}::uuid`);
    await db.execute(sql`DELETE FROM usuarios WHERE agente_id = ${ids.agentId}::uuid`);
    await db.delete(aiAgentVersions).where(eq(aiAgentVersions.agentId, ids.agentId));
    await db.delete(aiAgents).where(eq(aiAgents.id, ids.agentId));
  });
}

main().catch((e) => { console.error(e instanceof Error ? e.stack : e); process.exit(1); });
