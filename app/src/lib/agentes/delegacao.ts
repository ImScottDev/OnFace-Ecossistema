/**
 * Delegar o follow-up de um lead ou oportunidade a um agente (e devolver).
 *
 * "Fiz a proposta e quero que um agente faça o follow-up": a pessoa delega, o
 * responsável passa a ser o agente (evento com autor humano), e a delegação
 * guarda motivo, cadência (dias sem resposta, intervalo, teto de toques) e o
 * humano para quem devolver. O worker aciona o agente quando o toque vence.
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { atividades, delegacoesAgente, leads, negocios, usuarios } from "@/lib/db/schema";
import * as preVendas from "@/lib/vendas/pre-vendas";
import * as pipeline from "@/lib/vendas/pipeline";
import { RegraDeNegocio, type Ator } from "@/lib/vendas/dominio";
import { agenteDoUsuario } from "./usuario-do-agente";

export type Delegacao = typeof delegacoesAgente.$inferSelect;

const DIA = 24 * 60 * 60 * 1000;

export async function delegacaoAtiva(organizacaoId: string, alvo: { negocioId?: string | null; leadId?: string | null }): Promise<Delegacao | null> {
  const cond = alvo.negocioId ? eq(delegacoesAgente.negocioId, alvo.negocioId) : alvo.leadId ? eq(delegacoesAgente.leadId, alvo.leadId) : null;
  if (!cond) return null;
  const [d] = await db.select().from(delegacoesAgente)
    .where(and(eq(delegacoesAgente.organizacaoId, organizacaoId), eq(delegacoesAgente.status, "ativa"), cond))
    .orderBy(desc(delegacoesAgente.createdAt)).limit(1);
  return d ?? null;
}

async function donoAtual(organizacaoId: string, alvo: { negocioId?: string | null; leadId?: string | null }): Promise<{ responsavelId: string | null; leadId: string | null }> {
  if (alvo.negocioId) {
    const [n] = await db.select({ r: negocios.responsavelId, l: negocios.leadId }).from(negocios).where(and(eq(negocios.id, alvo.negocioId), eq(negocios.organizacaoId, organizacaoId))).limit(1);
    if (!n) throw new RegraDeNegocio("oportunidade_nao_encontrada", "Oportunidade não encontrada.");
    return { responsavelId: n.r, leadId: n.l };
  }
  const [l] = await db.select({ r: leads.responsavelId }).from(leads).where(and(eq(leads.id, alvo.leadId!), eq(leads.organizacaoId, organizacaoId))).limit(1);
  if (!l) throw new RegraDeNegocio("lead_nao_encontrado", "Lead não encontrado.");
  return { responsavelId: l.r, leadId: alvo.leadId! };
}

async function reatribuir(p: { organizacaoId: string; negocioId?: string | null; leadId?: string | null; para: string; ator: Ator }) {
  if (p.negocioId) await pipeline.atribuirResponsavelDaOportunidade({ organizacaoId: p.organizacaoId, negocioId: p.negocioId, responsavelId: p.para, ator: p.ator });
  else await preVendas.atribuirResponsavel({ organizacaoId: p.organizacaoId, leadId: p.leadId!, responsavelId: p.para, origemAtribuicao: "manual", ator: p.ator });
}

export interface EntradaDelegacao {
  organizacaoId: string;
  negocioId?: string | null;
  leadId?: string | null;
  agenteUsuarioId: string;
  motivo: string;
  gatilho?: "manual" | "tag" | "proposta_enviada";
  diasSemResposta?: number;
  intervaloDias?: number;
  maxToques?: number;
  /** Quem delega (humano) ou quem disparou (sistema, para a tag). */
  ator: Ator;
}

export async function delegarAAgente(e: EntradaDelegacao): Promise<Delegacao> {
  const motivo = e.motivo?.trim();
  if (!motivo) throw new RegraDeNegocio("motivo_obrigatorio", "Diga o motivo da delegação: o agente e a equipe leem isso depois.");
  if (!e.negocioId && !e.leadId) throw new RegraDeNegocio("alvo_obrigatorio", "Escolha a oportunidade ou o lead a delegar.");
  const agente = await agenteDoUsuario(e.organizacaoId, e.agenteUsuarioId);
  if (!agente) throw new RegraDeNegocio("agente_invalido", "Escolha um agente de IA publicado e ativo.");
  if (await delegacaoAtiva(e.organizacaoId, e)) throw new RegraDeNegocio("ja_delegada", "Já existe uma delegação ativa para este registro. Devolva-a antes de delegar de novo.");

  const dono = await donoAtual(e.organizacaoId, e);
  // Volta para o dono atual quando ele é uma pessoa; senão para quem delegou.
  const donoEhHumano = dono.responsavelId ? !(await agenteDoUsuario(e.organizacaoId, dono.responsavelId)) : false;
  const humano = donoEhHumano ? dono.responsavelId : e.ator.usuarioId;
  const dias = Math.max(0, Math.min(60, e.diasSemResposta ?? 2));

  await reatribuir({ organizacaoId: e.organizacaoId, negocioId: e.negocioId, leadId: e.leadId, para: agente.usuarioId, ator: e.ator });
  const [d] = await db.insert(delegacoesAgente).values({
    organizacaoId: e.organizacaoId, leadId: dono.leadId, negocioId: e.negocioId ?? null, agenteUsuarioId: agente.usuarioId, humanoUsuarioId: humano ?? null,
    motivo, gatilho: e.gatilho ?? "manual", diasSemResposta: dias, intervaloDias: Math.max(1, Math.min(30, e.intervaloDias ?? 2)),
    maxToques: Math.max(1, Math.min(10, e.maxToques ?? 4)), delegadoPor: e.ator.usuarioId,
    proximoToqueEm: new Date(Date.now() + dias * DIA),
  }).returning();
  await db.insert(atividades).values({
    organizacaoId: e.organizacaoId, leadId: dono.leadId, negocioId: e.negocioId ?? null, usuarioId: e.ator.usuarioId, tipo: "nota",
    titulo: `Follow-up delegado a ${agente.nome}`, descricao: `Motivo: ${motivo}\nPrimeiro toque em ${dias === 0 ? "instantes" : `${dias} dia(s) sem resposta`}, a cada ${d.intervaloDias} dia(s), até ${d.maxToques} toques.`,
    dados: { delegacaoId: d.id, agenteUsuarioId: agente.usuarioId, gatilho: d.gatilho },
  });
  return d;
}

/** A pessoa pede o registro de volta (ou o worker encerra por falta de resposta). */
export async function devolverDelegacao(p: { organizacaoId: string; delegacaoId: string; ator: Ator; motivo?: string }): Promise<Delegacao> {
  const [d] = await db.select().from(delegacoesAgente).where(and(eq(delegacoesAgente.id, p.delegacaoId), eq(delegacoesAgente.organizacaoId, p.organizacaoId))).limit(1);
  if (!d) throw new RegraDeNegocio("delegacao_nao_encontrada", "Delegação não encontrada.");
  if (d.status !== "ativa") throw new RegraDeNegocio("delegacao_encerrada", "Esta delegação já foi devolvida.");
  const [h] = d.humanoUsuarioId ? await db.select({ id: usuarios.id }).from(usuarios).where(and(eq(usuarios.id, d.humanoUsuarioId), eq(usuarios.ativo, true))).limit(1) : [];
  const para = h?.id ?? p.ator.usuarioId;
  if (!para) throw new RegraDeNegocio("sem_destino", "Não há pessoa para receber de volta. Atribua um responsável manualmente.");
  const motivo = p.motivo?.trim() || "Devolvido ao responsável";
  const dono = await donoAtual(p.organizacaoId, d);
  if (dono.responsavelId === d.agenteUsuarioId) await reatribuir({ organizacaoId: p.organizacaoId, negocioId: d.negocioId, leadId: d.leadId, para, ator: p.ator });
  const [nova] = await db.update(delegacoesAgente).set({ status: "devolvida", devolvidaEm: new Date(), devolvidaMotivo: motivo }).where(eq(delegacoesAgente.id, d.id)).returning();
  await db.insert(atividades).values({
    organizacaoId: p.organizacaoId, leadId: d.leadId, negocioId: d.negocioId, usuarioId: p.ator.usuarioId, tipo: "nota",
    titulo: "Follow-up devolvido à pessoa", descricao: motivo, dados: { delegacaoId: d.id },
  });
  return nova;
}

export async function listarDelegacoes(organizacaoId: string, alvo: { negocioId?: string | null; leadId?: string | null }) {
  const cond = alvo.negocioId ? eq(delegacoesAgente.negocioId, alvo.negocioId) : eq(delegacoesAgente.leadId, alvo.leadId!);
  return db.select({ d: delegacoesAgente, agente: usuarios.nome }).from(delegacoesAgente)
    .innerJoin(usuarios, eq(usuarios.id, delegacoesAgente.agenteUsuarioId))
    .where(and(eq(delegacoesAgente.organizacaoId, organizacaoId), cond)).orderBy(desc(delegacoesAgente.createdAt)).limit(10);
}
