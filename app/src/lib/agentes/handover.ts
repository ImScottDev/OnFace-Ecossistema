/**
 * Handover: a agente passa o atendimento para uma pessoa.
 *
 * O responsável volta para o humano definido (delegação > regra de distribuição
 * > padrão em Ajustes > último recurso: gerente/admin), com notificação e nota
 * de contexto na timeline assinada pela agente. A IA fica pausada na conversa.
 */
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  atividades, auditLog, contatos, delegacoesAgente, negocios, notificacoes, organizacoes, regrasDistribuicaoLeads,
  usuarios, whatsappMensagens, aiSdrContatoState, leads,
} from "@/lib/db/schema";
import * as preVendas from "@/lib/vendas/pre-vendas";
import * as pipeline from "@/lib/vendas/pipeline";
import type { Ator } from "@/lib/vendas/dominio";

export const atorDaAgente = (agenteUsuarioId: string | null, agentId: string): Ator => ({ tipo: "AI_AGENT", usuarioId: agenteUsuarioId, ref: agentId });

type Settings = { agentes?: { humanoDevolucaoPadraoId?: string; agenteFollowupPadraoId?: string } };

export async function lerPadroesDeAgentes(organizacaoId: string) {
  const [org] = await db.select({ settings: organizacoes.settings }).from(organizacoes).where(eq(organizacoes.id, organizacaoId)).limit(1);
  return ((org?.settings as Settings | null)?.agentes) ?? {};
}

async function humanoAtivo(organizacaoId: string, id: string | null | undefined): Promise<string | null> {
  if (!id) return null;
  const [u] = await db.select({ id: usuarios.id }).from(usuarios)
    .where(and(eq(usuarios.id, id), eq(usuarios.organizacaoId, organizacaoId), eq(usuarios.ativo, true), eq(usuarios.tipo, "humano"))).limit(1);
  return u?.id ?? null;
}

/** Para quem o atendimento volta: delegação ativa > regra do agente > padrão da org > gerente/admin. */
export async function resolverHumanoDeDevolucao(p: { organizacaoId: string; agenteUsuarioId: string; leadId?: string | null; negocioId?: string | null }): Promise<{ id: string | null; origem: "delegacao" | "regra" | "padrao" | "gestor" | "nenhum" }> {
  const alvos = [p.negocioId ? eq(delegacoesAgente.negocioId, p.negocioId) : undefined, p.leadId ? eq(delegacoesAgente.leadId, p.leadId) : undefined].filter(Boolean);
  if (alvos.length) {
    const [d] = await db.select({ h: delegacoesAgente.humanoUsuarioId }).from(delegacoesAgente)
      .where(and(eq(delegacoesAgente.organizacaoId, p.organizacaoId), eq(delegacoesAgente.status, "ativa"), eq(delegacoesAgente.agenteUsuarioId, p.agenteUsuarioId), sql`(${sql.join(alvos as never[], sql` OR `)})`))
      .orderBy(desc(delegacoesAgente.createdAt)).limit(1);
    const h = await humanoAtivo(p.organizacaoId, d?.h);
    if (h) return { id: h, origem: "delegacao" };
  }
  const regras = await db.select().from(regrasDistribuicaoLeads)
    .where(and(eq(regrasDistribuicaoLeads.organizacaoId, p.organizacaoId), eq(regrasDistribuicaoLeads.ativo, true)))
    .orderBy(regrasDistribuicaoLeads.prioridade);
  for (const r of regras) {
    const doAgente = r.alvoUsuarioId === p.agenteUsuarioId || r.rodizioUsuarioIds.includes(p.agenteUsuarioId);
    const h = doAgente ? await humanoAtivo(p.organizacaoId, r.humanoDevolucaoId) : null;
    if (h) return { id: h, origem: "regra" };
  }
  const padroes = await lerPadroesDeAgentes(p.organizacaoId);
  const padrao = await humanoAtivo(p.organizacaoId, padroes.humanoDevolucaoPadraoId);
  if (padrao) return { id: padrao, origem: "padrao" };
  const [gestor] = await db.select({ id: usuarios.id }).from(usuarios)
    .where(and(eq(usuarios.organizacaoId, p.organizacaoId), eq(usuarios.ativo, true), eq(usuarios.tipo, "humano"), inArray(usuarios.role, ["gerente", "admin"])))
    .orderBy(sql`CASE ${usuarios.role} WHEN 'gerente' THEN 0 ELSE 1 END`, usuarios.createdAt).limit(1);
  return gestor ? { id: gestor.id, origem: "gestor" } : { id: null, origem: "nenhum" };
}

export interface ResultadoHandover { humanoId: string | null; origem: string; leadReatribuido: boolean; negociosReatribuidos: number }

export async function devolverAoHumano(p: {
  organizacaoId: string; agenteUsuarioId: string; agentId: string;
  leadId?: string | null; negocioId?: string | null; contatoId?: string | null;
  motivo: string; resumo?: string | null; prioridade?: string | null;
}): Promise<ResultadoHandover> {
  const ator = atorDaAgente(p.agenteUsuarioId, p.agentId);
  let leadId = p.leadId ?? null;
  let contatoId = p.contatoId ?? null;
  if (!leadId && contatoId) leadId = (await db.select({ l: contatos.leadId }).from(contatos).where(eq(contatos.id, contatoId)).limit(1))[0]?.l ?? null;
  if (!leadId && p.negocioId) leadId = (await db.select({ l: negocios.leadId }).from(negocios).where(eq(negocios.id, p.negocioId)).limit(1))[0]?.l ?? null;
  if (!contatoId && leadId) contatoId = (await db.select({ id: contatos.id }).from(contatos).where(and(eq(contatos.leadId, leadId), eq(contatos.organizacaoId, p.organizacaoId))).orderBy(desc(contatos.ultimaMsgAt)).limit(1))[0]?.id ?? null;

  const alvo = await resolverHumanoDeDevolucao({ organizacaoId: p.organizacaoId, agenteUsuarioId: p.agenteUsuarioId, leadId, negocioId: p.negocioId });
  const humanoId = alvo.id;
  let leadReatribuido = false, negociosReatribuidos = 0;

  if (humanoId && leadId) {
    const [l] = await db.select({ r: leads.responsavelId }).from(leads).where(and(eq(leads.id, leadId), eq(leads.organizacaoId, p.organizacaoId))).limit(1);
    if (l?.r === p.agenteUsuarioId) {
      await preVendas.atribuirResponsavel({ organizacaoId: p.organizacaoId, leadId, responsavelId: humanoId, origemAtribuicao: "agente", ator });
      await db.insert(auditLog).values({ organizacaoId: p.organizacaoId, actorId: p.agenteUsuarioId, action: "lead.responsavel_alterado", entityType: "lead", entityId: leadId, before: { responsavelId: p.agenteUsuarioId }, after: { responsavelId: humanoId, handover: true }, source: "system" });
      leadReatribuido = true;
    }
  }
  if (humanoId) {
    const abertos = await db.select({ id: negocios.id }).from(negocios)
      .where(and(eq(negocios.organizacaoId, p.organizacaoId), eq(negocios.responsavelId, p.agenteUsuarioId),
        p.negocioId ? eq(negocios.id, p.negocioId) : leadId ? eq(negocios.leadId, leadId) : sql`false`));
    for (const n of abertos) {
      await pipeline.atribuirResponsavelDaOportunidade({ organizacaoId: p.organizacaoId, negocioId: n.id, responsavelId: humanoId, ator });
      negociosReatribuidos++;
    }
  }
  // A conversa do Atendimento acompanha o responsável (índice único lead+responsável: conflito é ignorado).
  if (humanoId && contatoId) {
    await db.update(contatos).set({ responsavelId: humanoId, updatedAt: new Date() }).where(and(eq(contatos.id, contatoId), eq(contatos.responsavelId, p.agenteUsuarioId))).catch(() => undefined);
  }

  // Nota de contexto na timeline, assinada pela agente.
  const ultima = contatoId
    ? (await db.select({ c: whatsappMensagens.conteudo }).from(whatsappMensagens).where(and(eq(whatsappMensagens.contatoId, contatoId), eq(whatsappMensagens.direcao, "in"))).orderBy(desc(whatsappMensagens.createdAt)).limit(1))[0]?.c
    : null;
  const descricao = [p.resumo, `Motivo: ${p.motivo}`, ultima ? `Última mensagem do cliente: "${ultima.slice(0, 280)}"` : null,
    humanoId ? null : "Nenhum humano de devolução configurado: defina em Ajustes > Leads."].filter(Boolean).join("\n");
  if (leadId || p.negocioId) {
    await db.insert(atividades).values({
      organizacaoId: p.organizacaoId, leadId, negocioId: p.negocioId ?? null, usuarioId: p.agenteUsuarioId,
      tipo: "nota_agente", titulo: "Atendimento passado para uma pessoa", descricao,
      dados: { handover: true, motivo: p.motivo, para: humanoId, origemDoDestino: alvo.origem, agentId: p.agentId },
    });
  }

  // Pausa a IA nesta conversa e marca quem assumiu.
  if (contatoId) {
    await db.insert(aiSdrContatoState).values({ contatoId, organizacaoId: p.organizacaoId, aiAtivo: false, handoffStatus: "human_required", handoffAt: new Date(), handoffMotivo: p.motivo, handoffUsuarioId: humanoId })
      .onConflictDoUpdate({ target: aiSdrContatoState.contatoId, set: { aiAtivo: false, handoffStatus: "human_required", handoffAt: new Date(), handoffMotivo: p.motivo, handoffUsuarioId: humanoId, updatedAt: new Date() } });
  }

  // Delegação ativa termina aqui: o humano voltou a ser o dono.
  const alvosDeleg = [p.negocioId ? eq(delegacoesAgente.negocioId, p.negocioId) : undefined, leadId ? eq(delegacoesAgente.leadId, leadId) : undefined].filter(Boolean);
  if (alvosDeleg.length) {
    await db.update(delegacoesAgente).set({ status: "devolvida", devolvidaEm: new Date(), devolvidaMotivo: p.motivo })
      .where(and(eq(delegacoesAgente.organizacaoId, p.organizacaoId), eq(delegacoesAgente.status, "ativa"), eq(delegacoesAgente.agenteUsuarioId, p.agenteUsuarioId), sql`(${sql.join(alvosDeleg as never[], sql` OR `)})`));
  }

  // Aviso ao humano (ou ao gestor): sem isso o handover vira lead parado.
  if (humanoId) {
    const link = p.negocioId ? `/pipeline/${p.negocioId}` : contatoId ? `/atendimento?contatoId=${contatoId}` : leadId ? `/pre-vendas?lead=${leadId}` : "/";
    await db.insert(notificacoes).values({
      usuarioId: humanoId, tipo: "handover_agente",
      titulo: p.prioridade === "urgente" ? "Atendimento urgente passado pela IA" : "Atendimento passado pela IA",
      mensagem: p.motivo.slice(0, 280), link,
    });
  }
  return { humanoId, origem: alvo.origem, leadReatribuido, negociosReatribuidos };
}
