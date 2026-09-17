/**
 * Criação de tarefa e registro de interação no eixo do CS (empresa).
 *
 * Todas as tarefas automáticas passam por aqui com `chaveIdempotencia`:
 * o sweep horário reavalia a base inteira toda hora e não pode empilhar
 * cópias da mesma tarefa. A chave é determinística (marco, sinal, janela
 * de renovação), nunca um uuid novo.
 */
import { db } from "@/lib/db";
import { tarefas, atividades, clientes, leads, empresas } from "@/lib/db/schema";
import { and, eq, desc, isNull } from "drizzle-orm";

export type OrigemTarefa =
  | "MANUAL" | "PLAYBOOK" | "BILLING" | "ONBOARDING" | "IMPLANTACAO"
  | "RENOVACAO" | "RISCO" | "EXPANSAO" | "AUTOMACAO";

export interface NovaTarefaCs {
  organizacaoId: string;
  empresaId: string;
  titulo: string;
  tipo: string;
  origem: OrigemTarefa;
  descricao?: string | null;
  motivo?: string | null;
  prioridade?: "alta" | "media" | "baixa";
  venceEm?: Date | null;
  servicoCanonicoId?: string | null;
  usuarioId?: string | null;
  /** Presente = tarefa automática, criada no máximo uma vez. */
  chaveIdempotencia?: string | null;
}

/**
 * Resolve quem é o dono da tarefa quando o call site não sabe: o CS owner
 * da conta. Sem owner definido, a tarefa nasce sem responsável e cai no
 * filtro "Sem responsável" — atribuir a um admin aleatório só esconderia
 * o buraco (foi o que o job legado de renovação fazia).
 */
export async function ownerDaConta(empresaId: string): Promise<string | null> {
  const [c] = await db.select({ responsavelId: clientes.responsavelId })
    .from(clientes).where(eq(clientes.empresaId, empresaId)).limit(1);
  return c?.responsavelId ?? null;
}

/** Lead representativo da empresa — só pra manter compatibilidade com as telas que ainda leem tarefa por lead. */
async function leadDaEmpresa(empresaId: string): Promise<string | null> {
  const [l] = await db.select({ id: leads.id }).from(leads)
    .where(eq(leads.empresaId, empresaId)).orderBy(desc(leads.updatedAt)).limit(1);
  return l?.id ?? null;
}

/**
 * Cria a tarefa. Com `chaveIdempotencia`, a segunda chamada não cria nada
 * e devolve `{ criada: false }` com o id existente — quem chama pode
 * distinguir "já existia" de "acabei de criar" sem consultar antes.
 */
export async function criarTarefaCs(input: NovaTarefaCs): Promise<{ id: string | null; criada: boolean }> {
  if (input.chaveIdempotencia) {
    const [existente] = await db.select({ id: tarefas.id }).from(tarefas)
      .where(and(
        eq(tarefas.organizacaoId, input.organizacaoId),
        eq(tarefas.chaveIdempotencia, input.chaveIdempotencia),
      )).limit(1);
    if (existente) return { id: existente.id, criada: false };
  }

  const usuarioId = input.usuarioId ?? (await ownerDaConta(input.empresaId));
  const leadId = await leadDaEmpresa(input.empresaId);

  const [criada] = await db.insert(tarefas).values({
    organizacaoId: input.organizacaoId,
    empresaId: input.empresaId,
    servicoCanonicoId: input.servicoCanonicoId ?? null,
    leadId,
    usuarioId,
    titulo: input.titulo,
    descricao: input.descricao ?? null,
    motivo: input.motivo ?? null,
    tipo: input.tipo,
    origem: input.origem,
    prioridade: input.prioridade ?? "media",
    venceEm: input.venceEm ?? null,
    dataVencimento: input.venceEm ? input.venceEm.toISOString().slice(0, 10) : null,
    chaveIdempotencia: input.chaveIdempotencia ?? null,
  })
    // Corrida entre dois workers no mesmo sweep: o índice único resolve,
    // e o SELECT abaixo devolve quem ganhou.
    .onConflictDoNothing()
    .returning({ id: tarefas.id });

  if (criada) return { id: criada.id, criada: true };

  if (input.chaveIdempotencia) {
    const [existente] = await db.select({ id: tarefas.id }).from(tarefas)
      .where(and(
        eq(tarefas.organizacaoId, input.organizacaoId),
        eq(tarefas.chaveIdempotencia, input.chaveIdempotencia),
      )).limit(1);
    return { id: existente?.id ?? null, criada: false };
  }
  return { id: null, criada: false };
}

export interface NovaInteracao {
  organizacaoId: string;
  empresaId: string;
  tipo: string;              // ligacao | reuniao | whatsapp | email | nota
  titulo?: string | null;
  descricao?: string | null;
  usuarioId?: string | null;
  dados?: Record<string, unknown> | null;
}

/**
 * Registra interação de CS em `atividades` — a MESMA tabela da timeline
 * comercial, de propósito: o Cliente 360 mostra uma linha do tempo única.
 * Escreve `empresaId` (novo em 08/09) e também o lead representativo,
 * pra que as telas que ainda leem por lead continuem vendo o registro.
 */
export async function registrarInteracao(input: NovaInteracao): Promise<{ id: string }> {
  const leadId = await leadDaEmpresa(input.empresaId);
  const [row] = await db.insert(atividades).values({
    organizacaoId: input.organizacaoId,
    empresaId: input.empresaId,
    leadId,
    usuarioId: input.usuarioId ?? null,
    tipo: input.tipo,
    titulo: input.titulo ?? null,
    descricao: input.descricao ?? null,
    dados: input.dados ?? null,
  }).returning({ id: atividades.id });
  return { id: row.id };
}

/** Empresas da carteira sem CS owner — visão "Sem responsável". */
export async function contasSemOwner(organizacaoId: string) {
  return db.select({ empresaId: clientes.empresaId, nome: empresas.nome })
    .from(clientes)
    .innerJoin(empresas, eq(empresas.id, clientes.empresaId))
    .where(and(eq(clientes.organizacaoId, organizacaoId), isNull(clientes.responsavelId)));
}
