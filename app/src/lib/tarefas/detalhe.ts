/**
 * Subtarefa, comentário e anexo da atividade (migration 0111).
 *
 * A gaveta de atividade do desenho tem checklist, conversa com @menção e
 * anexos. Antes desta porta nada disso tinha tabela, e a peça escondia os
 * blocos. As regras seguem as da rota de tarefas:
 *
 * - tudo filtra pela organização da sessão (o `Ator`), nunca do cliente;
 * - estrutura da atividade (criar, reordenar, excluir subtarefa, anexo da
 *   atividade) é do dono da atividade ou da gestão;
 * - a subtarefa também pode ser mexida por quem é responsável por ela;
 * - qualquer pessoa da organização comenta; editar/excluir comentário é do
 *   autor ou da gestão;
 * - cada mudança vira fato em `domain_events` (aggregate `tarefa`, com lead,
 *   oportunidade e empresa no payload) e aparece no feed da gaveta.
 */
import { and, asc, eq, max, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { tarefas, tarefaSubtarefas, tarefaComentarios, usuarios, notificacoes, fileLinks, fileObjects, anexos } from "@/lib/db/schema";
import { ehAgenteUsuario, SQL_EH_AGENTE } from "@/lib/agentes/eh-agente";
import { isAdminView } from "@/lib/auth/roles";
import { RegraDeNegocio } from "@/lib/vendas/dominio";
import { guardarNoAcervo, removerDoAcervo } from "@/lib/arquivos/servico";

export interface Ator { organizacaoId: string; userId: string; userRole: string }
export interface ArquivoEnviado { nome: string; mime: string; conteudo: Uint8Array }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIA = /^\d{4}-\d{2}-\d{2}$/;

const naoEncontrada = () => new RegraDeNegocio("nao_encontrado", "Não encontrei esta atividade.");
const semPermissao = (msg = "Só o responsável ou um gestor pode alterar esta atividade.") => new RegraDeNegocio("sem_permissao", msg);

type Tarefa = { id: string; usuarioId: string | null; titulo: string; leadId: string | null; negocioId: string | null; empresaId: string | null; gestor: boolean };

async function tarefaDaOrg(a: Ator, tarefaId: string): Promise<Tarefa> {
  if (!UUID.test(tarefaId)) throw naoEncontrada();
  const [t] = await db
    .select({ id: tarefas.id, usuarioId: tarefas.usuarioId, titulo: tarefas.titulo, leadId: tarefas.leadId, negocioId: tarefas.negocioId, empresaId: tarefas.empresaId })
    .from(tarefas)
    .where(and(eq(tarefas.id, tarefaId), eq(tarefas.organizacaoId, a.organizacaoId)))
    .limit(1);
  if (!t) throw naoEncontrada();
  return { ...t, gestor: t.usuarioId === a.userId || isAdminView(a.userRole) };
}

function exigirGestao(t: Tarefa) {
  if (!t.gestor) throw semPermissao();
}

async function usuarioDaOrg(a: Ator, id: string) {
  if (!UUID.test(id)) throw new RegraDeNegocio("nao_encontrado", "Responsável não encontrado nesta organização.");
  const [u] = await db.select({ id: usuarios.id }).from(usuarios)
    .where(and(eq(usuarios.id, id), eq(usuarios.organizacaoId, a.organizacaoId))).limit(1);
  if (!u) throw new RegraDeNegocio("nao_encontrado", "Responsável não encontrado nesta organização.");
}

/** Link da atividade para notificação: a lista abre a gaveta pelo `?atv=`. */
export const linkDaTarefa = (id: string) => `/tarefas?atv=p:${id}`;

async function fato(a: Ator, t: Tarefa, tipo: string, payload: Record<string, unknown>) {
  try {
    await db.execute(sql`
      INSERT INTO domain_events (organizacao_id, event_type, aggregate_type, aggregate_id, actor_type, actor_id, source, payload)
      VALUES (${a.organizacaoId}::uuid, ${tipo}, 'tarefa', ${t.id}::uuid, 'USER', ${a.userId}::uuid, 'api',
              ${JSON.stringify({ ...payload, tarefa: t.titulo, leadId: t.leadId, negocioId: t.negocioId, empresaId: t.empresaId })}::jsonb)`);
  } catch (e) {
    console.error(`[tarefas] fato ${tipo} não registrado:`, e);
  }
}

async function avisar(usuarioId: string, titulo: string, mensagem: string, link: string) {
  try {
    await db.insert(notificacoes).values({ usuarioId, tipo: titulo.startsWith("Você foi mencionado") ? "mencao" : "tarefa_atribuida", titulo, mensagem, link });
  } catch (e) {
    console.error("[tarefas] falha ao notificar:", e);
  }
}

/* ── Subtarefas ─────────────────────────────────────────────────────────── */

export interface DadosSubtarefa {
  titulo?: string;
  descricao?: string | null;
  concluida?: boolean;
  responsavelId?: string | null;
  /** Dia (AAAA-MM-DD) ou null. */
  venceEm?: string | null;
}

function validarPrazo(v: string | null | undefined) {
  if (v && !DIA.test(v)) throw new RegraDeNegocio("prazo_invalido", "Prazo inválido: use AAAA-MM-DD.");
}

export async function criarSubtarefa(a: Ator, tarefaId: string, d: DadosSubtarefa) {
  const t = await tarefaDaOrg(a, tarefaId);
  exigirGestao(t);
  const titulo = d.titulo?.trim();
  if (!titulo) throw new RegraDeNegocio("subtarefa_sem_titulo", "A subtarefa precisa de um título.");
  if (d.responsavelId) await usuarioDaOrg(a, d.responsavelId);
  validarPrazo(d.venceEm);
  const [{ ultima }] = await db.select({ ultima: max(tarefaSubtarefas.ordem) }).from(tarefaSubtarefas).where(eq(tarefaSubtarefas.tarefaId, t.id));
  const [s] = await db.insert(tarefaSubtarefas).values({
    organizacaoId: a.organizacaoId, tarefaId: t.id, titulo,
    descricao: d.descricao?.trim() || null,
    concluida: !!d.concluida, concluidaEm: d.concluida ? new Date() : null,
    ordem: ultima == null ? 0 : Number(ultima) + 1,
    responsavelId: d.responsavelId ?? null, venceEm: d.venceEm ?? null, createdBy: a.userId,
  }).returning();
  await fato(a, t, "SubtaskAdded", { subtarefaId: s.id, titulo: s.titulo, responsavelId: s.responsavelId, prazo: s.venceEm });
  if (s.responsavelId && s.responsavelId !== a.userId) await avisar(s.responsavelId, "Nova subtarefa para você", `${s.titulo} · ${t.titulo}`, linkDaTarefa(t.id));
  return s;
}

export async function alterarSubtarefa(a: Ator, tarefaId: string, subId: string, d: DadosSubtarefa) {
  const t = await tarefaDaOrg(a, tarefaId);
  if (!UUID.test(subId)) throw new RegraDeNegocio("nao_encontrado", "Subtarefa não encontrada.");
  const [s] = await db.select().from(tarefaSubtarefas)
    .where(and(eq(tarefaSubtarefas.id, subId), eq(tarefaSubtarefas.tarefaId, t.id), eq(tarefaSubtarefas.organizacaoId, a.organizacaoId))).limit(1);
  if (!s) throw new RegraDeNegocio("nao_encontrado", "Subtarefa não encontrada.");
  if (!t.gestor && s.responsavelId !== a.userId) throw semPermissao("Só o responsável pela atividade, pela subtarefa ou um gestor pode alterá-la.");

  const set: Partial<typeof tarefaSubtarefas.$inferInsert> = {};
  if (d.titulo !== undefined) {
    const titulo = d.titulo.trim();
    if (!titulo) throw new RegraDeNegocio("subtarefa_sem_titulo", "A subtarefa precisa de um título.");
    if (titulo !== s.titulo) set.titulo = titulo;
  }
  if (d.descricao !== undefined && (d.descricao?.trim() || null) !== s.descricao) set.descricao = d.descricao?.trim() || null;
  if (d.concluida !== undefined && d.concluida !== s.concluida) { set.concluida = d.concluida; set.concluidaEm = d.concluida ? new Date() : null; }
  if (d.responsavelId !== undefined && d.responsavelId !== s.responsavelId) {
    if (d.responsavelId) await usuarioDaOrg(a, d.responsavelId);
    set.responsavelId = d.responsavelId;
  }
  if (d.venceEm !== undefined && d.venceEm !== s.venceEm) { validarPrazo(d.venceEm); set.venceEm = d.venceEm; }
  if (!Object.keys(set).length) return s;

  const [n] = await db.update(tarefaSubtarefas).set(set).where(eq(tarefaSubtarefas.id, s.id)).returning();
  const de: Record<string, unknown> = {}, para: Record<string, unknown> = {};
  for (const k of Object.keys(set) as Array<keyof typeof set>) {
    if (k === "concluidaEm") continue;
    de[k] = (s as Record<string, unknown>)[k];
    para[k] = (n as Record<string, unknown>)[k];
  }
  const tipo = "concluida" in set ? (set.concluida ? "SubtaskCompleted" : "SubtaskReopened") : "SubtaskUpdated";
  await fato(a, t, tipo, { subtarefaId: s.id, titulo: n.titulo, de, para });
  if (set.responsavelId && set.responsavelId !== a.userId) await avisar(set.responsavelId, "Nova subtarefa para você", `${n.titulo} · ${t.titulo}`, linkDaTarefa(t.id));
  return n;
}

/** A ordem nova é a lista completa das subtarefas da atividade. */
export async function reordenarSubtarefas(a: Ator, tarefaId: string, ids: string[]) {
  const t = await tarefaDaOrg(a, tarefaId);
  exigirGestao(t);
  const atuais = await db.select({ id: tarefaSubtarefas.id }).from(tarefaSubtarefas).where(eq(tarefaSubtarefas.tarefaId, t.id));
  const conj = new Set(atuais.map((x) => x.id));
  if (ids.length !== conj.size || new Set(ids).size !== ids.length || ids.some((id) => !conj.has(id))) {
    throw new RegraDeNegocio("ordem_invalida", "A ordem precisa listar todas as subtarefas da atividade, uma vez cada.");
  }
  await db.transaction(async (tx) => {
    for (const [i, id] of ids.entries()) await tx.update(tarefaSubtarefas).set({ ordem: i }).where(eq(tarefaSubtarefas.id, id));
  });
  await fato(a, t, "SubtasksReordered", { ordem: ids });
  return { ok: true };
}

export async function excluirSubtarefa(a: Ator, tarefaId: string, subId: string) {
  const t = await tarefaDaOrg(a, tarefaId);
  exigirGestao(t);
  if (!UUID.test(subId)) throw new RegraDeNegocio("nao_encontrado", "Subtarefa não encontrada.");
  const [s] = await db.delete(tarefaSubtarefas)
    .where(and(eq(tarefaSubtarefas.id, subId), eq(tarefaSubtarefas.tarefaId, t.id), eq(tarefaSubtarefas.organizacaoId, a.organizacaoId)))
    .returning();
  if (!s) throw new RegraDeNegocio("nao_encontrado", "Subtarefa não encontrada.");
  await fato(a, t, "SubtaskDeleted", { subtarefaId: s.id, titulo: s.titulo });
  return { ok: true };
}

/* ── Comentários ────────────────────────────────────────────────────────── */

/** Quem o texto cita com `@Nome`, entre os usuários da organização (o autor não se avisa). */
export function mencionados<U extends { id: string; nome: string | null }>(corpo: string, equipe: U[], autorId: string): U[] {
  return equipe.filter((u) => u.id !== autorId && !!u.nome && corpo.includes(`@${u.nome}`));
}

async function equipeAtiva(a: Ator) {
  return db.select({ id: usuarios.id, nome: usuarios.nome }).from(usuarios)
    .where(and(eq(usuarios.organizacaoId, a.organizacaoId), eq(usuarios.ativo, true)));
}

async function avisarMencoes(t: Tarefa, ids: string[], corpo: string) {
  for (const id of ids) await avisar(id, "Você foi mencionado numa atividade", `${t.titulo}: ${corpo.slice(0, 120)}`, linkDaTarefa(t.id));
}

export async function comentar(a: Ator, tarefaId: string, corpoBruto: string, arquivos: ArquivoEnviado[] = []) {
  const t = await tarefaDaOrg(a, tarefaId);
  const corpo = (corpoBruto ?? "").trim();
  if (!corpo && !arquivos.length) throw new RegraDeNegocio("comentario_vazio", "Escreva o comentário ou anexe um arquivo.");
  const menc = mencionados(corpo, await equipeAtiva(a), a.userId).map((u) => u.id);
  const [c] = await db.insert(tarefaComentarios).values({
    organizacaoId: a.organizacaoId, tarefaId: t.id, autorId: a.userId, corpo, mencoes: menc,
  }).returning();
  const anexados = [];
  for (const arq of arquivos) anexados.push(await guardar(a, t, arq, c.id));
  await avisarMencoes(t, menc, corpo);
  await fato(a, t, "CommentAdded", { comentarioId: c.id, mencoes: menc, anexos: anexados.map((x) => x.id) });
  return { ...c, anexos: anexados };
}

async function comentarioDaTarefa(a: Ator, t: Tarefa, comId: string) {
  if (!UUID.test(comId)) throw new RegraDeNegocio("nao_encontrado", "Comentário não encontrado.");
  const [c] = await db.select().from(tarefaComentarios)
    .where(and(eq(tarefaComentarios.id, comId), eq(tarefaComentarios.tarefaId, t.id), eq(tarefaComentarios.organizacaoId, a.organizacaoId))).limit(1);
  if (!c) throw new RegraDeNegocio("nao_encontrado", "Comentário não encontrado.");
  if (c.autorId !== a.userId && !isAdminView(a.userRole)) throw semPermissao("Só quem escreveu o comentário ou um gestor pode mexer nele.");
  return c;
}

export async function editarComentario(a: Ator, tarefaId: string, comId: string, corpoBruto: string) {
  const t = await tarefaDaOrg(a, tarefaId);
  const c = await comentarioDaTarefa(a, t, comId);
  const corpo = (corpoBruto ?? "").trim();
  if (!corpo) throw new RegraDeNegocio("comentario_vazio", "O comentário não pode ficar vazio.");
  const menc = mencionados(corpo, await equipeAtiva(a), c.autorId ?? a.userId).map((u) => u.id);
  const [n] = await db.update(tarefaComentarios).set({ corpo, mencoes: menc, editadoEm: new Date() }).where(eq(tarefaComentarios.id, c.id)).returning();
  // Só quem foi citado agora é avisado: editar não repete o aviso de quem já sabia.
  await avisarMencoes(t, menc.filter((id) => !(c.mencoes ?? []).includes(id)), corpo);
  await fato(a, t, "CommentEdited", { comentarioId: c.id, de: c.corpo, para: corpo });
  return n;
}

export async function excluirComentario(a: Ator, tarefaId: string, comId: string) {
  const t = await tarefaDaOrg(a, tarefaId);
  const c = await comentarioDaTarefa(a, t, comId);
  const deles = await db.select({ fileObjectId: fileLinks.fileObjectId }).from(fileLinks)
    .where(and(eq(fileLinks.organizacaoId, a.organizacaoId), eq(fileLinks.entityType, "tarefa_comentario"), eq(fileLinks.entityId, c.id)));
  // Os arquivos saem antes do comentário: o vínculo do comentário é o que os acha.
  for (const f of deles) await desvincular(a, t, f.fileObjectId);
  await db.delete(tarefaComentarios).where(eq(tarefaComentarios.id, c.id));
  await fato(a, t, "CommentDeleted", { comentarioId: c.id, corpo: c.corpo });
  return { ok: true };
}

/* ── Anexos ─────────────────────────────────────────────────────────────── */

/** O arquivo entra no acervo ligado à atividade (e ao comentário, quando vem dele). */
async function guardar(a: Ator, t: Tarefa, arq: ArquivoEnviado, comentarioId: string | null) {
  const r = await guardarNoAcervo({
    organizacaoId: a.organizacaoId, nomeOriginal: arq.nome, mimeType: arq.mime, conteudo: arq.conteudo, enviadoPorId: a.userId,
    vinculos: [{ tipo: "tarefa", id: t.id, papel: "anexo" }, ...(comentarioId ? [{ tipo: "tarefa_comentario" as const, id: comentarioId, papel: "anexo" }] : [])],
    metadata: { tarefaId: t.id, comentarioId },
  });
  if (!r.ok) throw new RegraDeNegocio("arquivo_recusado", `${arq.nome}: ${r.erro}`);
  return { id: r.arquivo.id, nome: arq.nome, mime: arq.mime, url: `/api/arquivos/${r.arquivo.id}` };
}

export async function anexar(a: Ator, tarefaId: string, arq: ArquivoEnviado) {
  const t = await tarefaDaOrg(a, tarefaId);
  exigirGestao(t);
  const g = await guardar(a, t, arq, null);
  await fato(a, t, "AttachmentAdded", { fileObjectId: g.id, nome: g.nome });
  return g;
}

/** Tira o arquivo da atividade e dos comentários dela; o binário só sai se ninguém mais apontar para ele. */
async function desvincular(a: Ator, t: Tarefa, fileObjectId: string) {
  await db.delete(fileLinks).where(and(
    eq(fileLinks.organizacaoId, a.organizacaoId), eq(fileLinks.fileObjectId, fileObjectId),
    sql`(${fileLinks.entityType} = 'tarefa' AND ${fileLinks.entityId} = ${t.id}::uuid
         OR ${fileLinks.entityType} = 'tarefa_comentario' AND ${fileLinks.entityId} IN (SELECT id FROM tarefa_comentarios WHERE tarefa_id = ${t.id}::uuid))`,
  ));
  const [outroVinculo] = await db.select({ id: fileLinks.id }).from(fileLinks).where(eq(fileLinks.fileObjectId, fileObjectId)).limit(1);
  const [outroAnexo] = await db.select({ id: anexos.id }).from(anexos).where(eq(anexos.fileObjectId, fileObjectId)).limit(1);
  if (!outroVinculo && !outroAnexo) await removerDoAcervo(fileObjectId, a.organizacaoId);
}

export async function removerAnexo(a: Ator, tarefaId: string, fileObjectId: string) {
  const t = await tarefaDaOrg(a, tarefaId);
  if (!UUID.test(fileObjectId)) throw new RegraDeNegocio("nao_encontrado", "Anexo não encontrado.");
  const [l] = await db.select({ criadoPor: fileLinks.createdById, nome: fileObjects.nomeOriginal }).from(fileLinks)
    .innerJoin(fileObjects, eq(fileObjects.id, fileLinks.fileObjectId))
    .where(and(eq(fileLinks.organizacaoId, a.organizacaoId), eq(fileLinks.entityType, "tarefa"), eq(fileLinks.entityId, t.id), eq(fileLinks.fileObjectId, fileObjectId)))
    .limit(1);
  if (!l) throw new RegraDeNegocio("nao_encontrado", "Anexo não encontrado.");
  if (!t.gestor && l.criadoPor !== a.userId) throw semPermissao("Só quem anexou, o responsável pela atividade ou um gestor pode remover.");
  await desvincular(a, t, fileObjectId);
  await fato(a, t, "AttachmentRemoved", { fileObjectId, nome: l.nome });
  return { ok: true };
}

/* ── Leitura ────────────────────────────────────────────────────────────── */

const STATUS: Record<string, string> = { a_fazer: "A fazer", em_andamento: "Em andamento", aguardando: "Aguardando", concluida: "Feito", declinada: "Declinada" };
const dataBr = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10).split("-").reverse().join("/") : "sem data");

/** O fato do registro como frase do feed ("concluiu a subtarefa “x”"). Null = não aparece no feed. */
export function textoDoFato(tipo: string, p: Record<string, any>, nomeDe: (id: unknown) => string | null): string | null {
  const sub = `“${p.titulo ?? ""}”`;
  switch (tipo) {
    case "TaskStatusChanged": return `mudou o status para ${STATUS[p.para] ?? p.para}`;
    case "TaskReassigned": return p.para ? `passou a atividade para ${nomeDe(p.para) ?? "outra pessoa"}` : "tirou o responsável da atividade";
    case "TaskRescheduled": return `mudou o prazo para ${dataBr(p.para)}`;
    case "SubtaskAdded": return `adicionou a subtarefa ${sub}`;
    case "SubtaskCompleted": return `concluiu a subtarefa ${sub}`;
    case "SubtaskReopened": return `reabriu a subtarefa ${sub}`;
    case "SubtaskDeleted": return `excluiu a subtarefa ${sub}`;
    case "SubtasksReordered": return "reordenou as subtarefas";
    case "SubtaskUpdated": {
      const para = p.para ?? {};
      if ("responsavelId" in para) return para.responsavelId ? `atribuiu a subtarefa ${sub} a ${nomeDe(para.responsavelId) ?? "outra pessoa"}` : `tirou o responsável da subtarefa ${sub}`;
      if ("venceEm" in para) return `mudou o prazo da subtarefa ${sub} para ${dataBr(para.venceEm)}`;
      if ("titulo" in para) return `renomeou a subtarefa “${p.de?.titulo ?? ""}” para ${sub}`;
      return `editou a subtarefa ${sub}`;
    }
    case "AttachmentAdded": return `anexou ${p.nome ?? "um arquivo"}`;
    case "AttachmentRemoved": return `removeu o anexo ${p.nome ?? ""}`.trim();
    case "CommentDeleted": return "excluiu um comentário";
    default: return null; // TaskCreated vira a primeira linha do feed; comentário aparece como comentário.
  }
}

export interface DetalheDaTarefa {
  criadoPor: string | null;
  /** O autor da atividade é um agente de IA (selo em toda superfície que mostra o autor). */
  criadoPorEhAgente: boolean;
  subtarefas: Array<{ id: string; titulo: string; descricao: string | null; concluida: boolean; responsavelId: string | null; responsavelNome: string | null; venceEm: string | null; ordem: number }>;
  comentarios: Array<{ id: string; autorId: string | null; autorNome: string | null; autorEhAgente: boolean; corpo: string; criadoEm: string; editadoEm: string | null; anexos: Array<{ id: string; nome: string; mime: string; url: string }> }>;
  anexos: Array<{ id: string; nome: string; mime: string; url: string; autorNome: string | null; criadoEm: string }>;
  log: Array<{ autor: string | null; autorEhAgente: boolean; texto: string; em: string }>;
}

const iso = (v: Date | string | null) => (v ? new Date(v).toISOString() : null);

export async function carregarDetalhe(a: Ator, tarefaId: string): Promise<DetalheDaTarefa> {
  const t = await tarefaDaOrg(a, tarefaId);
  const [subs, coms, arqs, fatos, equipe] = await Promise.all([
    db.select({ s: tarefaSubtarefas, responsavelNome: usuarios.nome }).from(tarefaSubtarefas)
      .leftJoin(usuarios, eq(usuarios.id, tarefaSubtarefas.responsavelId))
      .where(and(eq(tarefaSubtarefas.tarefaId, t.id), eq(tarefaSubtarefas.organizacaoId, a.organizacaoId)))
      .orderBy(asc(tarefaSubtarefas.ordem), asc(tarefaSubtarefas.createdAt)),
    db.select({ c: tarefaComentarios, autorNome: usuarios.nome, autorTipo: usuarios.tipo, autorAgenteId: usuarios.agenteId }).from(tarefaComentarios)
      .leftJoin(usuarios, eq(usuarios.id, tarefaComentarios.autorId))
      .where(and(eq(tarefaComentarios.tarefaId, t.id), eq(tarefaComentarios.organizacaoId, a.organizacaoId)))
      .orderBy(asc(tarefaComentarios.createdAt)),
    db.execute<{ id: string; nome: string; mime: string; entity_type: string; entity_id: string; autor: string | null; criado_em: string }>(sql`
      SELECT fo.id::text, fo.nome_original AS nome, fo.mime_type AS mime, fl.entity_type, fl.entity_id::text,
             u.nome AS autor, fl.created_at::text AS criado_em
        FROM file_links fl
        JOIN file_objects fo ON fo.id = fl.file_object_id AND fo.deleted_at IS NULL
        LEFT JOIN usuarios u ON u.id = fl.created_by_id
       WHERE fl.organizacao_id = ${a.organizacaoId}::uuid
         AND (fl.entity_type = 'tarefa' AND fl.entity_id = ${t.id}::uuid
              OR fl.entity_type = 'tarefa_comentario' AND fl.entity_id IN (SELECT id FROM tarefa_comentarios WHERE tarefa_id = ${t.id}::uuid))
       ORDER BY fl.created_at`),
    db.execute<{ event_type: string; payload: Record<string, any>; autor: string | null; autor_ia: boolean | null; em: string }>(sql`
      SELECT de.event_type, de.payload, u.nome AS autor, ${sql.raw(SQL_EH_AGENTE("u"))} AS autor_ia, de.created_at::text AS em
        FROM domain_events de
        LEFT JOIN usuarios u ON u.id = de.actor_id
       WHERE de.organizacao_id = ${a.organizacaoId}::uuid AND de.aggregate_type = 'tarefa' AND de.aggregate_id = ${t.id}::uuid
       ORDER BY de.created_at
       LIMIT 200`),
    db.select({ id: usuarios.id, nome: usuarios.nome }).from(usuarios).where(eq(usuarios.organizacaoId, a.organizacaoId)),
  ]);
  const nomeDe = (id: unknown) => equipe.find((u) => u.id === id)?.nome ?? null;
  const url = (id: string) => `/api/arquivos/${id}`;
  const daAtividade = arqs.filter((x) => x.entity_type === "tarefa");
  return {
    criadoPor: fatos.find((f) => f.event_type === "TaskCreated")?.autor ?? null,
    criadoPorEhAgente: !!fatos.find((f) => f.event_type === "TaskCreated")?.autor_ia,
    subtarefas: subs.map(({ s, responsavelNome }) => ({
      id: s.id, titulo: s.titulo, descricao: s.descricao, concluida: s.concluida,
      responsavelId: s.responsavelId, responsavelNome, venceEm: s.venceEm, ordem: s.ordem,
    })),
    comentarios: coms.map(({ c, autorNome, autorTipo, autorAgenteId }) => ({
      id: c.id, autorId: c.autorId, autorNome, autorEhAgente: ehAgenteUsuario({ tipo: autorTipo, agenteId: autorAgenteId }), corpo: c.corpo, criadoEm: iso(c.createdAt)!, editadoEm: iso(c.editadoEm),
      anexos: arqs.filter((x) => x.entity_type === "tarefa_comentario" && x.entity_id === c.id).map((x) => ({ id: x.id, nome: x.nome, mime: x.mime, url: url(x.id) })),
    })),
    anexos: daAtividade.map((x) => ({ id: x.id, nome: x.nome, mime: x.mime, url: url(x.id), autorNome: x.autor, criadoEm: iso(x.criado_em)! })),
    log: fatos.flatMap((f) => {
      const texto = textoDoFato(f.event_type, f.payload ?? {}, nomeDe);
      return texto ? [{ autor: f.autor, autorEhAgente: !!f.autor_ia, texto, em: iso(f.em)! }] : [];
    }),
  };
}

/** Progresso e contadores da lista (uma consulta para a página toda). */
export async function contagensDasTarefas(organizacaoId: string, ids: string[]) {
  const out = new Map<string, { subtarefas: number; feitas: number; comentarios: number; anexos: number }>();
  if (!ids.length) return out;
  const linhas = await db.execute<{ id: string; subtarefas: number; feitas: number; comentarios: number; anexos: number }>(sql`
    SELECT t.id::text,
           (SELECT count(*) FROM tarefa_subtarefas s WHERE s.tarefa_id = t.id)::int AS subtarefas,
           (SELECT count(*) FROM tarefa_subtarefas s WHERE s.tarefa_id = t.id AND s.concluida)::int AS feitas,
           (SELECT count(*) FROM tarefa_comentarios c WHERE c.tarefa_id = t.id)::int AS comentarios,
           (SELECT count(*) FROM file_links fl JOIN file_objects fo ON fo.id = fl.file_object_id AND fo.deleted_at IS NULL
             WHERE fl.entity_type = 'tarefa' AND fl.entity_id = t.id)::int AS anexos
      FROM tarefas t
     WHERE t.organizacao_id = ${organizacaoId}::uuid AND t.id IN ${sql`(${sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `)})`}`);
  for (const l of linhas) out.set(l.id, { subtarefas: l.subtarefas, feitas: l.feitas, comentarios: l.comentarios, anexos: l.anexos });
  return out;
}
