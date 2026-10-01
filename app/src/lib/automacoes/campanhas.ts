import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { outreachCampanhas, outreachCampanhaDestinatarios, whatsappSessao } from "@/lib/db/schema";
import { temPermissao } from "@/lib/auth/permissoes";

/**
 * Campanhas de outreach (cold e-mail / disparo de WhatsApp).
 *
 * Ciclo: rascunho → agendada → enviando → concluida (pausada congela).
 * Este arquivo cuida do lado da tela (rascunho, agendar, pausar, consultar);
 * quem envia é o worker, job `campanha-sweep` (campanhas-envio.ts). Antes da
 * migration 0091 nada lia a tabela e só existia rascunho.
 *
 * Toda query recebe `organizacaoId` e filtra por ele, inclusive o update e o
 * delete (o id sozinho nunca basta: id de outra org vira "não encontrado").
 */

export type Canal = "email" | "whatsapp";

/**
 * Escrever campanha é da gestão: mesma régua das telas irmãs de Automações
 * (cadências, fluxos) e do Hono (exigirCtx 'automation.manage'). Fica aqui,
 * num lugar só, porque as actions usam como trava e as páginas usam para
 * desabilitar os botões com o motivo.
 */
export function podeGerirCampanhas(ctx: { userId: string; organizacaoId: string; userRole: string }) {
  return temPermissao(
    { usuarioId: ctx.userId, organizacaoId: ctx.organizacaoId, role: ctx.userRole, tipo: "HUMAN" },
    "automation.manage",
  );
}

export { SEM_PERMISSAO_CAMPANHAS } from "./campanhas-permissao";

export type CampanhaLinha = {
  id: string;
  nome: string;
  canal: Canal;
  status: string;
  assunto: string | null;
  listas: string[];
  remetente: string | null;
  totalDestinatarios: number;
  totalEnviados: number;
  agendadaPara: string | null;
  iniciadaEm: string | null;
  concluidaEm: string | null;
  criadaEm: string;
  atualizadaEm: string;
};

export type CampanhaCompleta = CampanhaLinha & { corpoHtml: string | null };

export type ListaDisponivel = { nome: string; comEmail: number; comTelefone: number };

function listasDe(audiencia: unknown): string[] {
  const l = (audiencia as { listas?: unknown } | null)?.listas;
  return Array.isArray(l) ? l.filter((x): x is string => typeof x === "string") : [];
}

function mapear(r: typeof outreachCampanhas.$inferSelect): CampanhaCompleta {
  return {
    id: r.id,
    nome: r.nome,
    canal: r.canal === "whatsapp" ? "whatsapp" : "email",
    status: r.status,
    assunto: r.assunto,
    corpoHtml: r.corpoHtml,
    listas: listasDe(r.audiencia),
    remetente: r.remetente,
    totalDestinatarios: r.totalDestinatarios ?? 0,
    totalEnviados: r.totalEnviados ?? 0,
    agendadaPara: r.agendadaPara?.toISOString() ?? null,
    iniciadaEm: r.iniciadaEm?.toISOString() ?? null,
    concluidaEm: r.concluidaEm?.toISOString() ?? null,
    criadaEm: r.createdAt.toISOString(),
    atualizadaEm: r.updatedAt.toISOString(),
  };
}

export async function listarCampanhas(organizacaoId: string): Promise<CampanhaLinha[]> {
  const rows = await db
    .select()
    .from(outreachCampanhas)
    .where(eq(outreachCampanhas.organizacaoId, organizacaoId))
    .orderBy(desc(outreachCampanhas.updatedAt));
  // O corpo HTML não vai para a lista: pode ser grande e a tabela não o mostra.
  return rows.map((r) => {
    const { corpoHtml: _corpo, ...linha } = mapear(r);
    return linha;
  });
}

export async function obterCampanha(organizacaoId: string, id: string): Promise<CampanhaCompleta | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [r] = await db
    .select()
    .from(outreachCampanhas)
    .where(and(eq(outreachCampanhas.organizacaoId, organizacaoId), eq(outreachCampanhas.id, id)))
    .limit(1);
  return r ? mapear(r) : null;
}

/**
 * Listas = etiquetas (`labels`) da org, a mesma fonte que a Prospecção usa no
 * filtro "lista". Antes a audiência era texto livre e qualquer palavra virava
 * "lista" (há rascunho no banco com a lista "joao", que não existe). Contar
 * quem tem e-mail e quem tem telefone deixa o número de destinatários real.
 */
export async function listasDisponiveis(organizacaoId: string): Promise<ListaDisponivel[]> {
  const rows = await db.execute<{ nome: string; com_email: number; com_telefone: number }>(sql`
    SELECT lb.nome,
           count(DISTINCT l.id) FILTER (WHERE coalesce(l.email, '') <> '')::int AS com_email,
           count(DISTINCT l.id) FILTER (WHERE coalesce(l.telefone, '') <> '')::int AS com_telefone
      FROM labels lb
      LEFT JOIN lead_labels ll ON ll.label_id = lb.id
      LEFT JOIN leads l ON l.id = ll.lead_id AND l.organizacao_id = lb.organizacao_id
     WHERE lb.organizacao_id = ${organizacaoId}::uuid
     GROUP BY lb.nome
     ORDER BY lb.nome
  `);
  return (rows as unknown as Array<{ nome: string; com_email: number; com_telefone: number }>).map((r) => ({
    nome: r.nome,
    comEmail: Number(r.com_email),
    comTelefone: Number(r.com_telefone),
  }));
}

/** Destinatários distintos nas listas escolhidas que o canal consegue alcançar. */
export async function contarDestinatarios(organizacaoId: string, listas: string[], canal: Canal): Promise<number> {
  if (listas.length === 0) return 0;
  const coluna = canal === "whatsapp" ? sql`l.telefone` : sql`l.email`;
  const [r] = (await db.execute<{ n: number }>(sql`
    SELECT count(DISTINCT l.id)::int AS n
      FROM labels lb
      JOIN lead_labels ll ON ll.label_id = lb.id
      JOIN leads l ON l.id = ll.lead_id AND l.organizacao_id = lb.organizacao_id
     WHERE lb.organizacao_id = ${organizacaoId}::uuid
       AND lb.nome IN (${sql.join(listas.map((x) => sql`${x}`), sql`, `)})
       AND coalesce(${coluna}, '') <> ''
  `)) as unknown as Array<{ n: number }>;
  return Number(r?.n ?? 0);
}

export type EntradaCampanha = {
  nome: string;
  canal: Canal;
  assunto: string | null;
  corpoHtml: string;
  listas: string[];
  remetente: string;
};

/** Mesmas regras do wizard antigo, agora também no servidor. */
export function validarCampanha(e: EntradaCampanha): string | null {
  if (e.nome.trim().length < 2) return "Dê um nome à campanha (mínimo 2 caracteres).";
  if (!e.corpoHtml.trim()) return "O corpo da mensagem está vazio.";
  if (e.canal === "email" && !e.assunto?.trim()) return "E-mail precisa de assunto.";
  if (e.listas.length === 0) return "Escolha ao menos uma lista de contatos.";
  if (!e.remetente.trim()) return e.canal === "whatsapp" ? "Escolha a sessão de WhatsApp que assina o disparo." : "Informe o e-mail que recebe as respostas.";
  return null;
}

export async function criarRascunho(organizacaoId: string, userId: string, e: EntradaCampanha): Promise<string> {
  const total = await contarDestinatarios(organizacaoId, e.listas, e.canal);
  const [row] = await db
    .insert(outreachCampanhas)
    .values({
      organizacaoId,
      nome: e.nome.trim(),
      canal: e.canal,
      assunto: e.canal === "email" ? e.assunto?.trim() || null : null,
      corpoHtml: e.corpoHtml,
      audiencia: { listas: e.listas },
      remetente: e.remetente.trim(),
      status: "rascunho",
      totalDestinatarios: total,
      createdBy: userId,
    })
    .returning({ id: outreachCampanhas.id });
  return row.id;
}

/** Só rascunho é editável. Retorna false se não achou (outra org ou não é rascunho). */
export async function atualizarRascunho(organizacaoId: string, id: string, e: EntradaCampanha): Promise<boolean> {
  const total = await contarDestinatarios(organizacaoId, e.listas, e.canal);
  const rows = await db
    .update(outreachCampanhas)
    .set({
      nome: e.nome.trim(),
      canal: e.canal,
      assunto: e.canal === "email" ? e.assunto?.trim() || null : null,
      corpoHtml: e.corpoHtml,
      audiencia: { listas: e.listas },
      remetente: e.remetente.trim(),
      totalDestinatarios: total,
      updatedAt: new Date(),
    })
    .where(and(
      eq(outreachCampanhas.organizacaoId, organizacaoId),
      eq(outreachCampanhas.id, id),
      eq(outreachCampanhas.status, "rascunho"),
    ))
    .returning({ id: outreachCampanhas.id });
  return rows.length > 0;
}

export async function excluirRascunho(organizacaoId: string, id: string): Promise<boolean> {
  const rows = await db
    .delete(outreachCampanhas)
    .where(and(
      eq(outreachCampanhas.organizacaoId, organizacaoId),
      eq(outreachCampanhas.id, id),
      eq(outreachCampanhas.status, "rascunho"),
    ))
    .returning({ id: outreachCampanhas.id });
  return rows.length > 0;
}

// ─── Envio (o worker executa; aqui só a mudança de estado pedida na tela) ───

export type SessaoWhatsapp = { id: string; nome: string; telefone: string | null; conectada: boolean };

/** Sessões da org para assinar o disparo; o id fica em `remetente`. */
export async function sessoesWhatsapp(organizacaoId: string): Promise<SessaoWhatsapp[]> {
  const rows = await db.select().from(whatsappSessao).where(eq(whatsappSessao.organizacaoId, organizacaoId));
  return rows
    .map((r) => ({
      id: r.id,
      nome: (r.label || r.sessionName).trim(),
      telefone: r.phoneNumber ? r.phoneNumber.split(":")[0] : null,
      conectada: r.status === "connected",
    }))
    .sort((a, b) => Number(b.conectada) - Number(a.conectada) || a.nome.localeCompare(b.nome, "pt-BR"));
}

/**
 * Rascunho → agendada. `quando` nulo = assim que o worker passar (até 1 min).
 * Só sai de rascunho; o update casa org + id + status, então id alheio ou
 * campanha já agendada voltam false.
 */
export async function agendarCampanha(organizacaoId: string, id: string, quando: Date | null): Promise<boolean> {
  const rows = await db.update(outreachCampanhas)
    .set({ status: "agendada", agendadaPara: quando ?? new Date(), updatedAt: new Date() })
    .where(and(eq(outreachCampanhas.organizacaoId, organizacaoId), eq(outreachCampanhas.id, id), eq(outreachCampanhas.status, "rascunho")))
    .returning({ id: outreachCampanhas.id });
  return rows.length > 0;
}

/** Transições permitidas a partir da tela. Envio em curso não volta a rascunho: já há quem recebeu. */
const TRANSICOES = {
  cancelar: { de: "agendada", para: "rascunho" },
  pausar: { de: "enviando", para: "pausada" },
  retomar: { de: "pausada", para: "enviando" },
} as const;
export type Transicao = keyof typeof TRANSICOES;

export async function transicionarCampanha(organizacaoId: string, id: string, t: Transicao): Promise<boolean> {
  const { de, para } = TRANSICOES[t];
  const rows = await db.update(outreachCampanhas)
    .set({ status: para, updatedAt: new Date(), ...(t === "cancelar" ? { agendadaPara: null } : {}) })
    .where(and(eq(outreachCampanhas.organizacaoId, organizacaoId), eq(outreachCampanhas.id, id), eq(outreachCampanhas.status, de)))
    .returning({ id: outreachCampanhas.id });
  return rows.length > 0;
}

export type StatusDestinatario = "pendente" | "enviando" | "enviado" | "bloqueado" | "falhou";
export type DestinatarioLinha = {
  id: string; nome: string | null; destino: string; status: StatusDestinatario;
  erro: string | null; enviadoEm: string | null; leadId: string | null;
};

export async function destinatariosDaCampanha(organizacaoId: string, campanhaId: string): Promise<{
  linhas: DestinatarioLinha[]; contagem: Record<StatusDestinatario, number>;
}> {
  const rows = await db.select().from(outreachCampanhaDestinatarios)
    .where(and(eq(outreachCampanhaDestinatarios.organizacaoId, organizacaoId), eq(outreachCampanhaDestinatarios.campanhaId, campanhaId)))
    .orderBy(outreachCampanhaDestinatarios.createdAt);
  const contagem: Record<StatusDestinatario, number> = { pendente: 0, enviando: 0, enviado: 0, bloqueado: 0, falhou: 0 };
  const linhas = rows.map((r) => {
    const status = (r.status in contagem ? r.status : "falhou") as StatusDestinatario;
    contagem[status]++;
    return {
      id: r.id, nome: r.nome, destino: r.destino, status, erro: r.erro,
      enviadoEm: r.enviadoEm?.toISOString() ?? null, leadId: r.leadId,
    };
  });
  return { linhas, contagem };
}
