/**
 * Porta de domínio das tarefas (atividades) para quem não é a rota HTTP.
 *
 * As regras são as de `api-server/routes/tarefas.ts` (POST/PATCH/DELETE): mesma
 * validação de organização, mesma regra "dono ou gestão", mesmo fato em
 * `domain_events` (de → para) e o mesmo aviso ao novo responsável. A diferença
 * é o ator: quem usa esta porta passa `via` ("nexo"), que vai para `source` e
 * para o payload, para o relatório separar o que a pessoa fez do que pediu ao NEXO.
 * ponytail: a rota ainda tem a cópia dela; apontar a rota para cá quando a frente de Atividades liberar o arquivo.
 */
import { and, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { tarefas, leads, negocios, empresas, usuarios, notificacoes } from "@/lib/db/schema";
import { isAdminView } from "@/lib/auth/roles";
import { RegraDeNegocio } from "@/lib/vendas/dominio";

export const TIPOS_TAREFA = ["follow_up", "ligar", "enviar_proposta", "diagnostico", "renovacao", "nps", "upsell", "geral"] as const;
export const PRIORIDADES_TAREFA = ["baixa", "media", "alta", "urgente"] as const;
export const STATUS_TAREFA = ["a_fazer", "em_andamento", "aguardando", "concluida", "declinada"] as const;

export interface AtorTarefa { organizacaoId: string; userId: string; userRole: string; via: string; runId?: string | null }

type Fato = "TaskCreated" | "TaskStatusChanged" | "TaskReassigned" | "TaskRescheduled" | "TaskDeleted";

async function registrarFato(a: AtorTarefa, tarefaId: string, tipo: Fato, payload: Record<string, unknown>) {
  try {
    await db.execute(sql`
      INSERT INTO domain_events (organizacao_id, event_type, aggregate_type, aggregate_id, actor_type, actor_id, source, payload)
      VALUES (${a.organizacaoId}::uuid, ${tipo}, 'tarefa', ${tarefaId}::uuid, 'USER', ${a.userId}::uuid, ${a.via},
              ${JSON.stringify({ ...payload, via: a.via, runId: a.runId ?? null })}::jsonb)`);
  } catch (e) {
    console.error(`[tarefas] fato ${tipo} não registrado:`, e);
  }
}

const hrefDaTarefa = (t: { leadId: string | null; negocioId: string | null; empresaId: string | null }) =>
  t.leadId ? `/pessoas/${t.leadId}` : t.negocioId ? `/pipeline/${t.negocioId}` : t.empresaId ? `/empresas/${t.empresaId}` : "/tarefas";

async function avisarResponsavel(a: AtorTarefa, usuarioId: string, t: typeof tarefas.$inferSelect) {
  if (usuarioId === a.userId) return;
  try {
    await db.insert(notificacoes).values({ usuarioId, tipo: "tarefa_atribuida", titulo: "Nova tarefa para você", mensagem: t.titulo, link: hrefDaTarefa(t) });
  } catch (e) { console.error("[tarefas] falha ao notificar responsável:", e); }
}

async function daOrg<T extends { id: string }>(consulta: Promise<T[]>, msg: string): Promise<void> {
  if (!(await consulta).length) throw new RegraDeNegocio("nao_encontrado", msg);
}

export interface NovaTarefa {
  titulo: string; descricao?: string | null; tipo?: (typeof TIPOS_TAREFA)[number];
  prioridade?: (typeof PRIORIDADES_TAREFA)[number]; venceEm?: string | null;
  responsavelId?: string | null; leadId?: string | null; negocioId?: string | null; empresaId?: string | null;
}

export async function criarTarefa(a: AtorTarefa, d: NovaTarefa) {
  const titulo = d.titulo?.trim();
  if (!titulo) throw new RegraDeNegocio("tarefa_sem_titulo", "A atividade precisa de um título.");
  const org = a.organizacaoId;
  if (d.leadId) await daOrg(db.select({ id: leads.id }).from(leads).where(and(eq(leads.id, d.leadId), eq(leads.organizacaoId, org))).limit(1), "Lead não encontrado.");
  if (d.negocioId) await daOrg(db.select({ id: negocios.id }).from(negocios).where(and(eq(negocios.id, d.negocioId), eq(negocios.organizacaoId, org))).limit(1), "Oportunidade não encontrada.");
  if (d.empresaId) await daOrg(db.select({ id: empresas.id }).from(empresas).where(and(eq(empresas.id, d.empresaId), eq(empresas.organizacaoId, org))).limit(1), "Empresa não encontrada.");
  let responsavel = a.userId;
  if (d.responsavelId && d.responsavelId !== a.userId) {
    await daOrg(db.select({ id: usuarios.id }).from(usuarios).where(and(eq(usuarios.id, d.responsavelId), eq(usuarios.organizacaoId, org), eq(usuarios.ativo, true))).limit(1), "Responsável não encontrado nesta organização.");
    responsavel = d.responsavelId;
  }
  const venceEm = d.venceEm ? new Date(d.venceEm) : null;
  if (venceEm && Number.isNaN(venceEm.getTime())) throw new RegraDeNegocio("prazo_invalido", "Prazo inválido: use data e hora ISO.");
  const [t] = await db.insert(tarefas).values({
    organizacaoId: org, leadId: d.leadId ?? null, negocioId: d.negocioId ?? null, empresaId: d.empresaId ?? null,
    usuarioId: responsavel, titulo, descricao: d.descricao ?? null, tipo: d.tipo ?? "follow_up", prioridade: d.prioridade ?? "media",
    dataVencimento: venceEm ? venceEm.toISOString().slice(0, 10) : null, venceEm,
    origem: a.via === "nexo" ? "NEXO" : "MANUAL", motivo: a.via === "nexo" ? "Pedido do usuário ao NEXO" : null,
  }).returning();
  await avisarResponsavel(a, responsavel, t);
  await registrarFato(a, t.id, "TaskCreated", { titulo: t.titulo, tipo: t.tipo, status: t.status, responsavelId: t.usuarioId, leadId: t.leadId, negocioId: t.negocioId, empresaId: t.empresaId, prazo: t.venceEm ?? t.dataVencimento });
  return { tarefa: t, href: hrefDaTarefa(t) };
}

export interface MudancaTarefa {
  titulo?: string; descricao?: string | null; prioridade?: (typeof PRIORIDADES_TAREFA)[number];
  status?: (typeof STATUS_TAREFA)[number]; venceEm?: string | null; responsavelId?: string;
}

async function carregarEditavel(a: AtorTarefa, id: string) {
  const [t] = await db.select().from(tarefas).where(and(eq(tarefas.id, id), eq(tarefas.organizacaoId, a.organizacaoId))).limit(1);
  if (!t) throw new RegraDeNegocio("tarefa_nao_encontrada", "Atividade não encontrada.");
  // Mesma regra da rota: o dono sempre; outra pessoa só gestão.
  if (t.usuarioId !== a.userId && !isAdminView(a.userRole)) throw new RegraDeNegocio("sem_permissao", "Esta atividade é de outra pessoa e o seu papel não edita atividade alheia.");
  return t;
}

export async function alterarTarefa(a: AtorTarefa, id: string, m: MudancaTarefa) {
  const antes = await carregarEditavel(a, id);
  const set: Partial<typeof tarefas.$inferInsert> = {};
  if (m.titulo !== undefined) set.titulo = m.titulo.trim();
  if (m.descricao !== undefined) set.descricao = m.descricao;
  if (m.prioridade) set.prioridade = m.prioridade;
  if (m.status) { set.status = m.status; set.concluidaEm = m.status === "concluida" ? new Date() : null; }
  if (m.venceEm !== undefined) {
    const v = m.venceEm ? new Date(m.venceEm) : null;
    if (v && Number.isNaN(v.getTime())) throw new RegraDeNegocio("prazo_invalido", "Prazo inválido: use data e hora ISO.");
    set.venceEm = v; set.dataVencimento = v ? v.toISOString().slice(0, 10) : null;
  }
  if (m.responsavelId) {
    await daOrg(db.select({ id: usuarios.id }).from(usuarios).where(and(eq(usuarios.id, m.responsavelId), eq(usuarios.organizacaoId, a.organizacaoId), eq(usuarios.ativo, true))).limit(1), "Responsável não encontrado nesta organização.");
    set.usuarioId = m.responsavelId;
  }
  if (!Object.keys(set).length) throw new RegraDeNegocio("nada_a_alterar", "Nada para alterar.");
  const [t] = await db.update(tarefas).set(set).where(eq(tarefas.id, id)).returning();
  if (t.status !== antes.status) await registrarFato(a, id, "TaskStatusChanged", { de: antes.status, para: t.status, titulo: t.titulo });
  if (t.usuarioId !== antes.usuarioId) { await registrarFato(a, id, "TaskReassigned", { de: antes.usuarioId, para: t.usuarioId, titulo: t.titulo }); if (t.usuarioId) await avisarResponsavel(a, t.usuarioId, t); }
  const p = (v: Date | string | null) => (v ? new Date(v).toISOString() : null);
  if (p(t.venceEm) !== p(antes.venceEm)) await registrarFato(a, id, "TaskRescheduled", { de: antes.venceEm ?? antes.dataVencimento, para: t.venceEm ?? t.dataVencimento, titulo: t.titulo });
  return { tarefa: t, href: hrefDaTarefa(t) };
}

export async function excluirTarefa(a: AtorTarefa, id: string) {
  const t = await carregarEditavel(a, id);
  await db.delete(tarefas).where(eq(tarefas.id, id));
  await registrarFato(a, id, "TaskDeleted", { titulo: t.titulo, status: t.status, responsavelId: t.usuarioId });
  return { titulo: t.titulo };
}
