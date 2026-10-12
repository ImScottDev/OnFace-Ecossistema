import { db } from "@/lib/db";
import { contatos } from "@/lib/db/schema";
import { eq, and, or, isNull, sql, SQL } from "drizzle-orm";

/**
 * Autorização de número e de conversa de WhatsApp. Regra ÚNICA: tela de
 * Atendimento, badge da casca, Início, NEXO e todas as rotas leem daqui.
 *
 * Seis papéis que não se confundem (decisão Scott, 12/10/2026):
 *  - dono do número ......... whatsapp_sessao.usuario_id (pessoa OU agente de IA,
 *                             que é usuário tipo 'agente'); nulo = compartilhado;
 *  - autorizado a usar ...... whatsapp_sessao_acesso (número compartilhado com ele);
 *  - responsável da conversa  contatos.responsavel_id;
 *  - agente que conduz ...... ai_agent_versions.channel_session_id + opt-in por conversa;
 *  - sessão técnica ......... whatsapp_sessao.session_name (wuzapi);
 *  - contato externo ........ contatos.telefone.
 *
 * Conversa é dado pessoal (decisão Kauã, 09/09): quem não é gestão só vê os
 * números que são seus ou que lhe foram compartilhados. A gestão vê a equipe:
 * admin vê a organização; gerente/coordenador vê o próprio time (membros do
 * seu `team_id` e dos times de que é `manager_id`).
 *
 * ATENÇÃO: não passe o papel por `normalizeRole()` — ela colapsa
 * "super_admin" em "admin" e derruba a regra inteira.
 */
type Ctx = { userId: string; userRole?: string | null; realRole?: string | null };

function papelReal(ctxOuRole: string | null | undefined | { userRole?: string | null; realRole?: string | null }): string | null {
  // Sempre o papel REAL: o "ver como" troca ctx.userRole pelo papel de quem
  // está sendo observado, então decidir por ele deixaria qualquer um herdar
  // super_admin apontando o cookie de view-as pra conta certa.
  if (typeof ctxOuRole === "string" || ctxOuRole == null) return ctxOuRole ?? null;
  return ctxOuRole.realRole ?? ctxOuRole.userRole ?? null;
}

export function veTodasAsConversas(
  ctxOuRole: string | null | undefined | { userRole?: string | null; realRole?: string | null },
): boolean {
  return papelReal(ctxOuRole) === "super_admin";
}

export type EscopoGestao = "organizacao" | "time" | null;

/** Até onde a gestão enxerga números e conversas alheias. */
export function escopoDeGestao(ctxOuRole: Parameters<typeof veTodasAsConversas>[0]): EscopoGestao {
  const r = papelReal(ctxOuRole);
  if (r === "super_admin" || r === "admin" || r === "director" || r === "operations") return "organizacao";
  if (r === "gerente" || r === "coordinator") return "time";
  return null;
}

/** Pode abrir "Equipe" no Atendimento e em Ajustes > WhatsApp. */
export const podeVerEquipe = (ctx: Parameters<typeof veTodasAsConversas>[0]) => escopoDeGestao(ctx) !== null;

/** Ids dos usuários do MEU time: eu, quem divide meu team_id e os times que gerencio. */
export function usuariosDoTime(userId: string): SQL {
  return sql`(SELECT u.id FROM usuarios u
               WHERE u.id = ${userId}
                  OR u.team_id IN (SELECT t.id FROM teams t WHERE t.manager_id = ${userId})
                  OR (u.team_id IS NOT NULL AND u.team_id = (SELECT me.team_id FROM usuarios me WHERE me.id = ${userId})))`;
}

/** Número que o usuário pode USAR (ver e enviar): é dono ou está autorizado. `id`/`dono` são colunas de whatsapp_sessao. */
export function sessaoMinha(userId: string, id: SQL, dono: SQL): SQL {
  return sql`(${dono} = ${userId}
    OR EXISTS (SELECT 1 FROM whatsapp_sessao_acesso wsa WHERE wsa.sessao_id = ${id} AND wsa.usuario_id = ${userId}))`;
}

/** Número que a gestão pode VER pelo escopo (organização inteira ou o time). */
export function sessaoDaGestao(ctx: Ctx, dono: SQL): SQL {
  const e = escopoDeGestao(ctx);
  if (e === "organizacao") return sql`TRUE`;
  if (e === "time") return sql`(${dono} IN ${usuariosDoTime(ctx.userId)})`;
  return sql`FALSE`;
}

/** Número visível para este usuário: seu, compartilhado com ele, ou da equipe que ele gerencia. */
export function sessaoVisivel(ctx: Ctx, id: SQL, dono: SQL): SQL {
  return sql`(${sessaoMinha(ctx.userId, id, dono)} OR ${sessaoDaGestao(ctx, dono)})`;
}

/**
 * "Minhas conversas": é minha a conversa que (1) chegou por um número meu ou
 * compartilhado comigo, (2) está atribuída a mim, ou (3) está sem dono e sem
 * número — a fila aberta da organização. Conversa sem dono num número de OUTRA
 * pessoa não é minha; num número compartilhado, só é minha se eu estou autorizado.
 *
 * `resp` e `sessao` são as colunas de `contatos`: no Drizzle passe
 * `contatos.responsavelId`/`contatos.sessaoId`; em SQL cru com alias, `sql`c.responsavel_id``.
 */
export function condicaoMinhasConversas(
  userId: string,
  resp: SQL | typeof contatos.responsavelId = contatos.responsavelId,
  sessao: SQL | typeof contatos.sessaoId = contatos.sessaoId,
): SQL {
  return sql`(
    ${resp} = ${userId}
    OR EXISTS (SELECT 1 FROM whatsapp_sessao ws_m WHERE ws_m.id = ${sessao} AND ${sessaoMinha(userId, sql`ws_m.id`, sql`ws_m.usuario_id`)})
    OR (${resp} IS NULL AND ${sessao} IS NULL)
  )`;
}

/** "Equipe": as minhas mais as do escopo de gestão (organização ou time). Sem gestão, só as minhas. */
export function condicaoEquipe(
  ctx: Ctx,
  resp: SQL | typeof contatos.responsavelId = contatos.responsavelId,
  sessao: SQL | typeof contatos.sessaoId = contatos.sessaoId,
): SQL {
  const e = escopoDeGestao(ctx);
  if (e === "organizacao") return sql`TRUE`;
  if (e === "time") {
    const time = usuariosDoTime(ctx.userId);
    return sql`(${condicaoMinhasConversas(ctx.userId, resp, sessao)}
      OR ${resp} IN ${time}
      OR EXISTS (SELECT 1 FROM whatsapp_sessao ws_e WHERE ws_e.id = ${sessao} AND ws_e.usuario_id IN ${time}))`;
  }
  return condicaoMinhasConversas(ctx.userId, resp, sessao);
}

/** Condição SQL de acesso, pra listas. Não-atribuído fica visível (fila aberta). */
export function condicaoAcessoConversa(ctx: { userId: string; userRole?: string | null; realRole?: string | null }): SQL | undefined {
  if (veTodasAsConversas(ctx)) return undefined;
  return or(eq(contatos.responsavelId, ctx.userId), isNull(contatos.responsavelId));
}

export type AcessoConversa =
  | { ok: true; contato: { id: string; telefone: string | null; leadId: string | null; responsavelId: string | null; sessaoId: string | null } }
  | { ok: false; motivo: "nao_encontrado" | "sem_permissao" };

/**
 * Checa se o usuário pode abrir UM contato. Usa sempre isto antes de devolver
 * mensagem, enviar, reagir ou apagar — o filtro de organização sozinho não
 * separa nada: todo o time vive na mesma org.
 */
export async function checarAcessoContato(
  ctx: { userId: string; userRole?: string | null; realRole?: string | null; organizacaoId: string },
  contatoId: string,
): Promise<AcessoConversa> {
  const [contato] = await db
    .select({
      id: contatos.id,
      telefone: contatos.telefone,
      leadId: contatos.leadId,
      responsavelId: contatos.responsavelId,
      sessaoId: contatos.sessaoId,
      daEquipe: sql<boolean>`${condicaoEquipe(ctx)}`,
    })
    .from(contatos)
    .where(and(eq(contatos.id, contatoId), eq(contatos.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!contato) return { ok: false, motivo: "nao_encontrado" };
  const { daEquipe, ...dados } = contato;
  if (veTodasAsConversas(ctx)) return { ok: true, contato: dados };
  // Fila aberta: sem dono e sem número é de quem pegar primeiro.
  if (dados.responsavelId === null && dados.sessaoId === null) return { ok: true, contato: dados };
  // Minha (atribuída, do meu número, compartilhada comigo) ou da equipe que gerencio.
  if (daEquipe) return { ok: true, contato: dados };
  return { ok: false, motivo: "sem_permissao" };
}

/**
 * O número por onde a mensagem vai sair tem que ser autorizado para quem envia:
 * dono, autorizado no compartilhado, ou gestão do dono. Vale para pessoa e para
 * agente (o agente envia como o usuário tipo 'agente' dono do número).
 */
export async function sessaoAutorizadaParaEnvio(
  ctx: { userId: string; userRole?: string | null; realRole?: string | null; organizacaoId: string },
  sessaoId: string,
): Promise<boolean> {
  const [r] = await db.execute<{ ok: boolean }>(sql`
    SELECT ${sessaoVisivel(ctx, sql`s.id`, sql`s.usuario_id`)} AS ok
      FROM whatsapp_sessao s
     WHERE s.id = ${sessaoId}::uuid AND s.organizacao_id = ${ctx.organizacaoId}::uuid`);
  return r?.ok === true;
}

/** Resposta padrão — 404 pra não confirmar a existência de conversa alheia. */
export function respostaSemAcesso() {
  return Response.json({ error: "Conversa nao encontrada" }, { status: 404 });
}
