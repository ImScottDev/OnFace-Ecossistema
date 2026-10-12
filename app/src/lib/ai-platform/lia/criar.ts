/**
 * Cria (idempotente) a Lia SDR em rascunho, carrega a base de conhecimento governada e semeia o
 * roteamento inicial das closers. Nada é publicado aqui: publicar é decisão humana, com prontidão.
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiAgents, aiAgentVersions, roteamentoComercialRegras, usuarios } from "@/lib/db/schema";
import { carregarBaseGovernada } from "../conhecimento/base-governada";
import { LIA_AGENTE, LIA_SLUG, LIA_VERSAO } from "./definicao";

const sem = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export interface ResultadoCriacaoLia { agentId: string; versionId: string; criouAgente: boolean; criouVersao: boolean; conhecimento: { criadas: number; atualizadas: number; iguais: number }; roteamento: string[] }

export async function criarLiaSdr(organizacaoId: string, criadoPorId?: string | null): Promise<ResultadoCriacaoLia> {
  let criouAgente = false;
  let criouVersao = false;
  let [agente] = await db.select().from(aiAgents).where(and(eq(aiAgents.organizacaoId, organizacaoId), eq(aiAgents.slug, LIA_SLUG))).limit(1);
  if (!agente) {
    [agente] = await db.insert(aiAgents).values({ organizacaoId, ...LIA_AGENTE, createdById: criadoPorId ?? null }).returning();
    criouAgente = true;
  }
  let [versao] = await db.select().from(aiAgentVersions).where(eq(aiAgentVersions.agentId, agente.id)).orderBy(sql`${aiAgentVersions.versao} DESC`).limit(1);
  if (!versao) {
    [versao] = await db.insert(aiAgentVersions).values({
      organizacaoId, agentId: agente.id, versao: 1, status: "draft", createdById: criadoPorId ?? null,
      ...LIA_VERSAO, costBudget: null,
    }).returning();
    criouVersao = true;
  }
  const conhecimento = await carregarBaseGovernada(organizacaoId);
  const roteamento = await semearRoteamentoInicial(organizacaoId, criadoPorId ?? null);
  return { agentId: agente.id, versionId: versao.id, criouAgente, criouVersao, conhecimento, roteamento };
}

/** Roteamento inicial pedido pelo comercial; só se a organização ainda não tem regra nenhuma. Destino por ID de usuário. */
export async function semearRoteamentoInicial(organizacaoId: string, criadoPor: string | null): Promise<string[]> {
  const [existe] = await db.select({ id: roteamentoComercialRegras.id }).from(roteamentoComercialRegras).where(eq(roteamentoComercialRegras.organizacaoId, organizacaoId)).limit(1);
  if (existe) return ["já existem regras: nada semeado"];
  const closers = await db.select({ id: usuarios.id, nome: usuarios.nome }).from(usuarios).where(and(eq(usuarios.organizacaoId, organizacaoId), eq(usuarios.ativo, true), eq(usuarios.role, "closer")));
  const achar = (nome: string) => closers.find((c) => sem(c.nome) === sem(nome));
  const plano: { nome: string; familia: string; destino: string; prioridade: number }[] = [
    { nome: "Callface AI → Mayra", familia: "CALLFACE_AI", destino: "Mayra Schincariol", prioridade: 100 },
    { nome: "White Label → Mayara", familia: "WHITE_LABEL", destino: "Mayara Anjos", prioridade: 100 },
  ];
  const log: string[] = [];
  for (const p of plano) {
    const u = achar(p.destino);
    if (!u) { log.push(`${p.nome}: closer "${p.destino}" não encontrada/ativa; regra não criada`); continue; }
    await db.insert(roteamentoComercialRegras).values({ organizacaoId, nome: p.nome, familia: p.familia, prioridade: p.prioridade, destinoUsuarioId: u.id, fallback: "fila_humana", criadoPor });
    log.push(`${p.nome}: criada`);
  }
  return log;
}
