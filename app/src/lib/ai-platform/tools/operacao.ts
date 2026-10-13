/**
 * Ferramentas de operação autônoma do agente: memória, retomada própria e agenda real.
 *
 * Nenhuma depende de cadência. `followup_schedule` cria um COMPROMISSO do próprio
 * agente (ai_agent_compromissos); no horário o runtime reconstrói o contexto e o
 * agente decide o que dizer. Toda escrita passa por serviço de domínio e confere
 * que o registro pertence ao lead/contato desta execução: o modelo não escolhe
 * IDs de outro atendimento.
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads, reunioes } from "@/lib/db/schema";
import type { AgentToolContext, AgentToolRegistration, AgentToolResult } from "./registry";
import { lembrar, MemoriaRecusada } from "../operacao/memoria";
// compromissos.ts importa o runtime (que importa este arquivo): carregado sob demanda para não fechar o ciclo.
const compromissos = () => import("../operacao/compromissos");
import { resolverCloser, sinaisDoLead } from "@/lib/crm/roteamento-closer";
import { horariosLivresEquipe } from "@/lib/calendario/disponibilidade";
import { agendarReuniao, cancelarReuniaoDoAgente, reagendarReuniao } from "@/lib/calendario/agendar-agente";

const objectSchema = (properties: Record<string, unknown> = {}, required: string[] = []) => ({ type: "object", properties, required, additionalProperties: false });
const str = (description: string) => ({ type: "string", description });

function preview(ctx: AgentToolContext, operation: string, input: Record<string, unknown>): AgentToolResult | null {
  return ctx.mode === "test" || ctx.autonomy !== "autonomous"
    ? { ok: true, data: { preview: true, approvalRequired: ctx.mode === "live" && ctx.autonomy === "approval", operation, input } } : null;
}

async function leadDoContexto(ctx: AgentToolContext) {
  if (!ctx.leadId) return null;
  const [l] = await db.select({ id: leads.id, empresaId: leads.empresaId }).from(leads).where(and(eq(leads.id, ctx.leadId), eq(leads.organizacaoId, ctx.organizacaoId))).limit(1);
  return l ?? null;
}

const exigirOutlook = (ctx: AgentToolContext) => ctx.guardrails?.agendaExigirOutlook !== false;

/**
 * Quem pode receber a reunião, pela regra comercial: regra que fixa o closer restringe a ele; rodízio abre
 * para a equipe (com a closer da vez na frente); sem closer pela regra, fila humana.
 */
async function equipeDaRegra(ctx: AgentToolContext) {
  if (!ctx.leadId) return { erro: "lead ausente" as const };
  const sinais = await sinaisDoLead(ctx.organizacaoId, ctx.leadId);
  const r = await resolverCloser({ organizacaoId: ctx.organizacaoId, familia: sinais.familia, campanha: sinais.campanha });
  if (r.tipo === "fila_humana") return { erro: `sem closer disponível pela regra: ${r.motivo}`, filaHumana: true as const };
  return {
    closer: { id: r.usuarioId, nome: r.nome }, regra: r.regra?.nome ?? null, familia: sinais.familia,
    /** undefined = toda a equipe no rodízio. */
    closerIds: r.tipo === "usuario" ? [r.usuarioId] : undefined,
  };
}

export const FERRAMENTAS_OPERACAO: AgentToolRegistration[] = [
  {
    id: "memory.remember", name: "memory_remember", category: "operation", mutates: true,
    description: "Guarda um fato sobre a pessoa, a empresa, a conversa ou a operação, com a fonte. Use confirmado=true só se o contato disse isso explicitamente; deduções entram como inferência.",
    parameters: objectSchema({
      escopo: { type: "string", enum: ["pessoa", "empresa", "conversa", "operacional"] },
      tipo: { type: "string", enum: ["fato", "preferencia", "objecao", "promessa", "compromisso", "proximo_passo", "resumo"] },
      chave: str("Nome curto do fato (ex.: volume_de_ligacoes, crm_utilizado, decisor)"),
      valor: str("O fato, nas palavras do contato quando possível"),
      confirmado: { type: "boolean", description: "true só quando o contato afirmou" },
    }, ["escopo", "chave", "valor"]),
    execute: async (ctx, input) => {
      const simulated = preview(ctx, "memory.remember", input); if (simulated) return simulated;
      if ((ctx.guardrails?.memoria as { ativa?: boolean } | undefined)?.ativa === false) return { ok: false, error: "a memória está desligada para este agente" };
      const lead = await leadDoContexto(ctx);
      if (!ctx.contatoId && !lead) return { ok: false, error: "sem contato ou lead para ancorar a memória" };
      const escopo = String(input.escopo) as "pessoa" | "empresa" | "conversa" | "operacional";
      if (escopo === "empresa" && !lead?.empresaId) return { ok: false, error: "lead sem empresa vinculada" };
      let fonteRef = ctx.sourceMessageId ?? null;
      if (!fonteRef && ctx.contatoId) {
        const [m] = await db.execute<{ id: string }>(sql`SELECT id::text FROM whatsapp_mensagens WHERE contato_id = ${ctx.contatoId}::uuid AND direcao = 'in' ORDER BY created_at DESC LIMIT 1`);
        fonteRef = m?.id ?? null;
      }
      try {
        const { fato, mudou } = await lembrar({
          organizacaoId: ctx.organizacaoId, escopo,
          // Memória da pessoa deve sobreviver à troca de número e conversa.
          // Empresa não fica subordinada ao lead: várias pessoas compartilham o mesmo fato.
          contatoId: escopo === "empresa" || ((escopo === "pessoa" || escopo === "operacional") && lead?.id) ? null : ctx.contatoId ?? null,
          leadId: escopo === "empresa" ? null : lead?.id ?? null,
          empresaId: escopo === "empresa" ? lead?.empresaId ?? null : null,
          tipo: input.tipo ? String(input.tipo) as "fato" : "fato", chave: String(input.chave), valor: String(input.valor),
          fonte: "mensagem", fonteRef, confirmado: input.confirmado === true && Boolean(ctx.sourceMessageId), agentId: ctx.agentId, runId: ctx.runId,
        });
        return { ok: true, data: { id: fato.id, chave: fato.chave, confirmado: fato.confirmado, mudou, mantidoPorSerConfirmado: !mudou && fato.valor !== String(input.valor).trim() } };
      } catch (e) {
        return { ok: false, error: e instanceof MemoriaRecusada ? e.message : String(e) };
      }
    },
  },
  {
    id: "followup.schedule", name: "followup_schedule", category: "operation", mutates: true,
    description: "Agenda uma retomada SUA para o horário combinado com o contato (ex.: 'me chama quinta'). No horário você recebe o contexto atualizado e decide o que dizer; não escreva a mensagem agora. Informe data/hora ISO com fuso (America/Sao_Paulo é -03:00) em `quando`.",
    parameters: objectSchema({
      quando: str("Data e hora ISO 8601 com fuso, ex.: 2026-10-15T10:00:00-03:00"),
      motivo: str("O que o contato combinou, em uma frase"),
      instrucao: str("O que fazer na retomada (objetivo, o que já foi dito, o que perguntar)"),
    }, ["quando", "motivo"]),
    execute: async (ctx, input) => {
      const simulated = preview(ctx, "followup.schedule", input); if (simulated) return simulated;
      if (!ctx.contatoId) return { ok: false, error: "retomada precisa de uma conversa (contato)" };
      const { criarCompromisso, CompromissoRecusado } = await compromissos();
      // Limites de follow-up da versão (tentativas máximas e horizonte), aplicados aqui e não só no prompt.
      const cfg = (ctx.guardrails?.followup && typeof ctx.guardrails.followup === "object" ? ctx.guardrails.followup : {}) as Record<string, unknown>;
      const maxRetomadas = typeof cfg.maxRetomadas === "number" ? cfg.maxRetomadas : 5;
      const janelaDias = typeof cfg.janelaDias === "number" ? cfg.janelaDias : 30;
      const maxDias = typeof cfg.maxDiasRetomada === "number" ? cfg.maxDiasRetomada : 90;
      const quando = new Date(String(input.quando));
      if (!Number.isNaN(quando.getTime()) && quando.getTime() > Date.now() + maxDias * 86_400_000) return { ok: false, error: `retomada além de ${maxDias} dias não é permitida para este agente` };
      const [uso] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM ai_agent_compromissos WHERE contato_id = ${ctx.contatoId}::uuid AND agent_id = ${ctx.agentId}::uuid AND status NOT IN ('cancelado') AND tipo = 'retomada' AND created_at > now() - ${janelaDias}::int * interval '1 day'`);
      const [pendente] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM ai_agent_compromissos WHERE contato_id = ${ctx.contatoId}::uuid AND agent_id = ${ctx.agentId}::uuid AND status = 'pendente' AND tipo = 'retomada'`);
      // Reagendar a retomada pendente não consome tentativa nova; criar outra sim.
      if ((uso?.n ?? 0) >= maxRetomadas && (pendente?.n ?? 0) === 0) return { ok: false, error: `limite de ${maxRetomadas} retomadas em ${janelaDias} dias atingido: encerre o atendimento ou passe para uma pessoa` };
      try {
        const c = await criarCompromisso({
          organizacaoId: ctx.organizacaoId, agentId: ctx.agentId, atribuicaoId: ctx.atribuicaoId ?? null, contatoId: ctx.contatoId, leadId: ctx.leadId ?? null,
          dueAt: new Date(String(input.quando)), motivo: String(input.motivo), instrucao: input.instrucao ? String(input.instrucao) : null,
          origemRunId: ctx.runId, origemMensagemId: ctx.sourceMessageId ?? null,
        });
        const label = c.dueAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
        return { ok: true, data: { compromissoId: c.id, retomadaEm: c.dueAt.toISOString(), retomadaEmLabel: label, reagendado: Boolean(c.reagendadoDe) } };
      } catch (e) {
        return { ok: false, error: e instanceof CompromissoRecusado ? e.message : String(e) };
      }
    },
  },
  {
    id: "followup.resume_cancel", name: "followup_resume_cancel", category: "operation", mutates: true,
    description: "Cancela uma retomada sua que deixou de fazer sentido (ex.: o contato resolveu agora).",
    parameters: objectSchema({ compromisso_id: str("ID da retomada"), motivo: str("Por que cancelou") }, ["compromisso_id", "motivo"]),
    execute: async (ctx, input) => {
      const simulated = preview(ctx, "followup.resume_cancel", input); if (simulated) return simulated;
      const { cancelarCompromisso } = await compromissos();
      const ok = await cancelarCompromisso({ organizacaoId: ctx.organizacaoId, compromissoId: String(input.compromisso_id), motivo: String(input.motivo), contatoId: ctx.contatoId ?? null, agentId: ctx.agentId });
      return ok ? { ok: true, data: { cancelado: true } } : { ok: false, error: "retomada não encontrada neste atendimento" };
    },
  },
  {
    id: "agenda.slots", name: "agenda_slots", category: "operation", mutates: false,
    description: "Consulta horários livres REAIS (agenda do CRM + Outlook) da equipe comercial, já na regra de roteamento e no rodízio: cada horário traz a closer (`closer_id`). Só ofereça ao contato horários devolvidos aqui. Se `verificado` vier false ou houver erro, não ofereça horário: avise que vai confirmar e peça uma pessoa.",
    parameters: objectSchema({ duracao: { type: "integer", minimum: 15, maximum: 120 } }),
    execute: async (ctx, input) => {
      const alvo = await equipeDaRegra(ctx);
      if ("erro" in alvo) return { ok: false, error: alvo.erro, data: { filaHumana: Boolean(alvo.filaHumana) } };
      const d = await horariosLivresEquipe({ organizacaoId: ctx.organizacaoId, closerIds: alvo.closerIds, preferidoId: alvo.closer.id, duracaoMin: Number(input.duracao ?? 30), exigirOutlook: exigirOutlook(ctx) });
      if (!d.verificado && exigirOutlook(ctx)) return { ok: false, error: `agenda não verificada: ${d.closers.find((c) => c.motivo)?.motivo ?? "Outlook indisponível"}`, data: { verificado: false } };
      return { ok: true, data: { regra: alvo.regra, verificado: d.verificado, fuso: d.fuso, slots: d.slots.map((s) => ({ inicioISO: s.inicioISO, fimISO: s.fimISO, label: s.label, closer_id: s.closerId, closer: s.closerNome })) } };
    },
  },
  {
    id: "meeting.schedule", name: "meeting_schedule", category: "operation", mutates: true,
    description: "Confirma uma reunião no horário escolhido pelo contato: revalida a agenda, cria o evento no Outlook, a reunião e a oportunidade, e avisa a closer. Use apenas um `inicio` devolvido por agenda_slots. Só declare a reunião confirmada se esta ferramenta devolver ok.",
    parameters: objectSchema({
      inicio: str("Início ISO exatamente como devolvido por agenda_slots"), duracao: { type: "integer", minimum: 15, maximum: 120 },
      closer_id: str("`closer_id` do horário escolhido, como devolvido por agenda_slots"),
      titulo: str("Título opcional"), resumo_para_closer: str("Resumo útil: contexto, dor, volume, decisor, objeções, o que o contato espera da reunião"),
    }, ["inicio", "resumo_para_closer"]),
    execute: async (ctx, input) => {
      const simulated = preview(ctx, "meeting.schedule", input); if (simulated) return simulated;
      if (!ctx.leadId) return { ok: false, error: "lead ausente" };
      const alvo = await equipeDaRegra(ctx);
      if ("erro" in alvo) return { ok: false, error: alvo.erro };
      // Regra que fixa o closer manda; no rodízio vale a closer do horário escolhido.
      const escolhida = input.closer_id ? String(input.closer_id) : null;
      if (escolhida && alvo.closerIds && !alvo.closerIds.includes(escolhida)) return { ok: false, error: "esse horário não é de uma closer que a regra comercial permite para este lead" };
      const r = await agendarReuniao({
        organizacaoId: ctx.organizacaoId, leadId: ctx.leadId, closerId: escolhida ?? alvo.closer.id, inicioISO: String(input.inicio), duracaoMin: Number(input.duracao ?? 30),
        titulo: input.titulo ? String(input.titulo) : undefined, resumoParaCloser: String(input.resumo_para_closer), exigirOutlook: exigirOutlook(ctx), usuarioId: ctx.agenteUsuarioId ?? null,
      });
      return r.ok ? { ok: true, data: r } : { ok: false, error: r.erro, data: { codigo: r.codigo } };
    },
  },
  {
    id: "meeting.reschedule", name: "meeting_reschedule", category: "operation", mutates: true,
    description: "Remarca uma reunião deste lead para um novo horário devolvido por agenda_slots.",
    parameters: objectSchema({ reuniao_id: str("ID da reunião"), novo_inicio: str("Novo início ISO de agenda_slots") }, ["reuniao_id", "novo_inicio"]),
    execute: async (ctx, input) => {
      const simulated = preview(ctx, "meeting.reschedule", input); if (simulated) return simulated;
      if (!(await reuniaoDoLead(ctx, String(input.reuniao_id)))) return { ok: false, error: "reunião não pertence a este atendimento" };
      const r = await reagendarReuniao({ organizacaoId: ctx.organizacaoId, reuniaoId: String(input.reuniao_id), novoInicioISO: String(input.novo_inicio), exigirOutlook: exigirOutlook(ctx) });
      return r.ok ? { ok: true, data: r } : { ok: false, error: r.erro };
    },
  },
  {
    id: "meeting.cancel", name: "meeting_cancel", category: "operation", mutates: true,
    description: "Cancela uma reunião deste lead (evento do Outlook e reunião do CRM).",
    parameters: objectSchema({ reuniao_id: str("ID da reunião"), motivo: str("Motivo") }, ["reuniao_id", "motivo"]),
    execute: async (ctx, input) => {
      const simulated = preview(ctx, "meeting.cancel", input); if (simulated) return simulated;
      if (!(await reuniaoDoLead(ctx, String(input.reuniao_id)))) return { ok: false, error: "reunião não pertence a este atendimento" };
      const r = await cancelarReuniaoDoAgente({ organizacaoId: ctx.organizacaoId, reuniaoId: String(input.reuniao_id), motivo: String(input.motivo) });
      return r.ok ? { ok: true, data: r } : { ok: false, error: r.erro };
    },
  },
];

async function reuniaoDoLead(ctx: AgentToolContext, reuniaoId: string): Promise<boolean> {
  if (!ctx.leadId || !/^[0-9a-f-]{36}$/i.test(reuniaoId)) return false;
  const [r] = await db.select({ id: reunioes.id }).from(reunioes).where(and(eq(reunioes.id, reuniaoId), eq(reunioes.organizacaoId, ctx.organizacaoId), eq(reunioes.leadId, ctx.leadId))).limit(1);
  return Boolean(r);
}
