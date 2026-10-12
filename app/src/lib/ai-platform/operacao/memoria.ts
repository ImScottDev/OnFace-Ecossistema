/**
 * Memória do agente (ai_memoria_fatos): fatos com fonte, data e confirmação.
 *
 * Regras que o código aplica, não o prompt:
 *  - fato confirmado traz `fonte` e `fonte_ref` (a mensagem/registro que prova);
 *  - inferência do modelo entra com `confirmado = false` e nunca sobrescreve um
 *    fato confirmado nem um dado canônico do CRM;
 *  - um fato ativo por (alvo, escopo, chave): atualizar substitui o anterior,
 *    que fica `corrigido` (histórico preservado);
 *  - pessoa autorizada corrige e exclui; exclusão é lógica (retenção).
 * Memória da conversa é `ai_sdr_contato_state.conversation_summary`; a da
 * organização é `ai_memory_*`. Aqui ficam pessoa, empresa e operação.
 */
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiMemoriaFatos } from "@/lib/db/schema";

export type EscopoMemoria = "pessoa" | "empresa" | "conversa" | "operacional";
export type TipoFato = "fato" | "preferencia" | "objecao" | "promessa" | "compromisso" | "proximo_passo" | "resumo";
export type Fato = typeof aiMemoriaFatos.$inferSelect;

export const FONTES_CONFIAVEIS = ["formulario", "humano", "crm", "ferramenta"] as const;

export interface EntradaFato {
  organizacaoId: string;
  escopo: EscopoMemoria;
  contatoId?: string | null;
  leadId?: string | null;
  empresaId?: string | null;
  tipo?: TipoFato;
  chave: string;
  valor: string;
  fonte: "mensagem" | "formulario" | "ferramenta" | "humano" | "crm";
  fonteRef?: string | null;
  confirmado?: boolean;
  confianca?: number | null;
  validoAte?: Date | null;
  agentId?: string | null;
  runId?: string | null;
  usuarioId?: string | null;
}

const normChave = (k: string) => k.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 60);

export class MemoriaRecusada extends Error {}

function alvoDe(e: Pick<EntradaFato, "contatoId" | "leadId" | "empresaId" | "escopo">) {
  if (e.contatoId) return { col: aiMemoriaFatos.contatoId, id: e.contatoId };
  if (e.leadId) return { col: aiMemoriaFatos.leadId, id: e.leadId };
  if (e.empresaId) return { col: aiMemoriaFatos.empresaId, id: e.empresaId };
  return null;
}

/** Grava ou substitui o fato. Retorna o fato ativo resultante. */
export async function lembrar(e: EntradaFato): Promise<{ fato: Fato; mudou: boolean }> {
  const chave = normChave(e.chave);
  const valor = e.valor.trim().slice(0, 1500);
  if (!chave || !valor) throw new MemoriaRecusada("chave e valor são obrigatórios");
  if (e.fonte === "mensagem" && !e.fonteRef && e.confirmado) throw new MemoriaRecusada("fato confirmado por mensagem precisa da referência da mensagem");
  const alvo = alvoDe(e);
  if (!alvo && e.escopo !== "operacional") throw new MemoriaRecusada("informe contato, lead ou empresa");

  const [atual] = await db.select().from(aiMemoriaFatos).where(and(
    eq(aiMemoriaFatos.organizacaoId, e.organizacaoId), eq(aiMemoriaFatos.escopo, e.escopo), eq(aiMemoriaFatos.chave, chave), eq(aiMemoriaFatos.status, "ativo"),
    alvo ? eq(alvo.col, alvo.id) : sql`true`,
  )).limit(1);

  const confirmado = e.confirmado ?? (e.fonte !== "mensagem");
  if (atual) {
    if (atual.valor === valor) {
      const [f] = await db.update(aiMemoriaFatos).set({ confirmado: atual.confirmado || confirmado, updatedAt: new Date() }).where(eq(aiMemoriaFatos.id, atual.id)).returning();
      return { fato: f, mudou: false };
    }
    // Inferência não derruba fato confirmado: fica de fora e quem tem autoridade decide.
    if (atual.confirmado && !confirmado) return { fato: atual, mudou: false };
    await db.update(aiMemoriaFatos).set({ status: "corrigido", updatedAt: new Date() }).where(eq(aiMemoriaFatos.id, atual.id));
  }
  const [novo] = await db.insert(aiMemoriaFatos).values({
    organizacaoId: e.organizacaoId, escopo: e.escopo, contatoId: e.contatoId ?? null, leadId: e.leadId ?? null, empresaId: e.empresaId ?? null,
    tipo: e.tipo ?? "fato", chave, valor, fonte: e.fonte, fonteRef: e.fonteRef ?? null, confirmado,
    confianca: e.confianca == null ? null : String(Math.max(0, Math.min(1, e.confianca))), validoAte: e.validoAte ?? null,
    agentId: e.agentId ?? null, runId: e.runId ?? null, usuarioId: e.usuarioId ?? null,
  }).returning();
  return { fato: novo, mudou: true };
}

export interface ConsultaMemoria { organizacaoId: string; contatoId?: string | null; leadId?: string | null; empresaId?: string | null; limite?: number }

/** Fatos ativos e ainda válidos dos alvos, mais recentes primeiro. */
export async function recordar(q: ConsultaMemoria): Promise<Fato[]> {
  const alvos = [
    q.contatoId ? eq(aiMemoriaFatos.contatoId, q.contatoId) : null,
    q.leadId ? eq(aiMemoriaFatos.leadId, q.leadId) : null,
    q.empresaId ? eq(aiMemoriaFatos.empresaId, q.empresaId) : null,
  ].filter((x) => x !== null);
  if (!alvos.length) return [];
  return db.select().from(aiMemoriaFatos).where(and(
    eq(aiMemoriaFatos.organizacaoId, q.organizacaoId), eq(aiMemoriaFatos.status, "ativo"),
    sql`(${sql.join(alvos, sql` OR `)})`, sql`(${aiMemoriaFatos.validoAte} IS NULL OR ${aiMemoriaFatos.validoAte} > now())`,
  )).orderBy(desc(aiMemoriaFatos.updatedAt)).limit(q.limite ?? 40);
}

/** Pessoa autorizada corrige: o antigo vira `corrigido`, o novo nasce confirmado por humano. */
export async function corrigirFato(p: { organizacaoId: string; fatoId: string; valor: string; usuarioId: string }): Promise<Fato> {
  const [f] = await db.select().from(aiMemoriaFatos).where(and(eq(aiMemoriaFatos.id, p.fatoId), eq(aiMemoriaFatos.organizacaoId, p.organizacaoId))).limit(1);
  if (!f) throw new MemoriaRecusada("fato não encontrado");
  const { fato } = await lembrar({
    organizacaoId: p.organizacaoId, escopo: f.escopo as EscopoMemoria, contatoId: f.contatoId, leadId: f.leadId, empresaId: f.empresaId,
    tipo: f.tipo as TipoFato, chave: f.chave, valor: p.valor, fonte: "humano", confirmado: true, usuarioId: p.usuarioId,
  });
  return fato;
}

export async function excluirFato(p: { organizacaoId: string; fatoId: string; usuarioId: string }): Promise<boolean> {
  const r = await db.update(aiMemoriaFatos).set({ status: "excluido", usuarioId: p.usuarioId, updatedAt: new Date() })
    .where(and(eq(aiMemoriaFatos.id, p.fatoId), eq(aiMemoriaFatos.organizacaoId, p.organizacaoId), inArray(aiMemoriaFatos.status, ["ativo"]))).returning({ id: aiMemoriaFatos.id });
  return r.length > 0;
}

/** Linha curta e rastreável para o contexto do agente. */
export const formatarFato = (f: Fato) =>
  `- ${f.chave.replace(/_/g, " ")}: ${f.valor} [${f.confirmado ? "confirmado" : "inferência"}; ${f.fonte}${f.fonteRef ? ` ${f.fonteRef.slice(0, 8)}` : ""}; ${f.updatedAt.toISOString().slice(0, 10)}]`;
