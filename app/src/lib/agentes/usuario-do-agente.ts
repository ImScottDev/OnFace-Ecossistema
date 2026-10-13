/**
 * Agente de atendimento como USUÁRIO do sistema.
 *
 * O agente (ex.: "Lia") ganha uma linha em `usuarios` com `tipo = 'agente'`,
 * ligada a `ai_agents`. É isso que o deixa aparecer em todo seletor de
 * responsável e receber lead por regra: tudo que lista pessoas lê `usuarios`.
 *
 * Sem login: `senha_hash` é um valor que nenhum bcrypt aceita, o e-mail é de um
 * domínio inválido e `authorize` recusa `tipo = 'agente'` de qualquer forma.
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiAgents, aiAgentVersions, usuarios } from "@/lib/db/schema";

export const TIPO_AGENTE = "agente";
export const SENHA_INUTILIZAVEL = "!agente-sem-login";
/** Finalidades que nunca viram usuário: copiloto interno (NEXO) e orquestração (Hermes). */
const FINALIDADES_INTERNAS = new Set(["copiloto", "orquestracao"]);

/** Atende cliente por conversa? Só quem tem a ferramenta de preparar mensagem. */
export function agenteConversaComCliente(finalidade: string, tools: unknown): boolean {
  if (FINALIDADES_INTERNAS.has(finalidade)) return false;
  return Array.isArray(tools) && tools.includes("message.prepare");
}

export const emailDoAgente = (slug: string, agentId: string) => `agente.${slug}.${agentId.slice(0, 8)}@agentes.onface.invalid`;

/**
 * Cria/atualiza/desativa o usuário de cada agente da organização.
 * Idempotente; chamada na publicação, no sweep do worker e pelo botão da tela.
 */
export async function sincronizarUsuariosDosAgentes(organizacaoId: string): Promise<{ criados: number; atualizados: number; desativados: number }> {
  const agentes = await db.select({
    id: aiAgents.id, nome: aiAgents.nome, slug: aiAgents.slug, finalidade: aiAgents.finalidade, status: aiAgents.status,
    archivedAt: aiAgents.archivedAt, tools: aiAgentVersions.tools,
  }).from(aiAgents)
    .leftJoin(aiAgentVersions, eq(aiAgentVersions.id, aiAgents.publishedVersionId))
    .where(eq(aiAgents.organizacaoId, organizacaoId));
  const existentes = await db.select({ id: usuarios.id, agenteId: usuarios.agenteId, nome: usuarios.nome, ativo: usuarios.ativo })
    .from(usuarios).where(and(eq(usuarios.organizacaoId, organizacaoId), eq(usuarios.tipo, TIPO_AGENTE)));
  const porAgente = new Map(existentes.map((u) => [u.agenteId, u]));
  let criados = 0, atualizados = 0, desativados = 0;

  for (const a of agentes) {
    const qualifica = a.status === "published" && !a.archivedAt && agenteConversaComCliente(a.finalidade, a.tools);
    const atual = porAgente.get(a.id);
    if (!atual) {
      if (!qualifica) continue;
      await db.insert(usuarios).values({
        organizacaoId, nome: a.nome, email: emailDoAgente(a.slug, a.id), senhaHash: SENHA_INUTILIZAVEL,
        role: "sdr", tipo: TIPO_AGENTE, agenteId: a.id, ativo: true,
      }).onConflictDoNothing();
      // Todo usuário tem papel RBAC vinculado (senão o gate legado nunca sai): a agente nasce como sdr.
      await db.execute(sql`
        INSERT INTO user_roles (usuario_id, role_id, organizacao_id)
        SELECT u.id, r.id, r.organizacao_id
          FROM usuarios u JOIN roles r ON r.organizacao_id = u.organizacao_id AND r.codigo = 'sdr'
         WHERE u.agente_id = ${a.id}::uuid
           AND NOT EXISTS (SELECT 1 FROM user_roles x WHERE x.usuario_id = u.id)
       ON CONFLICT DO NOTHING`);
      criados++;
      continue;
    }
    if (atual.ativo !== qualifica || atual.nome !== a.nome) {
      await db.update(usuarios).set({ ativo: qualifica, nome: a.nome, updatedAt: new Date() }).where(eq(usuarios.id, atual.id));
      if (atual.ativo && !qualifica) desativados++; else atualizados++;
    }
  }
  // Agente que já era usuária antes do papel existir também precisa de vínculo RBAC (idempotente).
  await db.execute(sql`
    INSERT INTO user_roles (usuario_id, role_id, organizacao_id)
    SELECT u.id, r.id, r.organizacao_id
      FROM usuarios u JOIN roles r ON r.organizacao_id = u.organizacao_id AND r.codigo = 'sdr'
     WHERE u.organizacao_id = ${organizacaoId}::uuid AND u.tipo = ${TIPO_AGENTE}
       AND NOT EXISTS (SELECT 1 FROM user_roles x WHERE x.usuario_id = u.id)
       ON CONFLICT DO NOTHING`);
  // A tag que dispara a delegação de follow-up existe para a equipe aplicar (porta única de tag).
  if (criados || existentes.some((u) => u.ativo)) {
    await db.execute(sql`
      INSERT INTO labels (organizacao_id, nome)
      SELECT ${organizacaoId}::uuid, 'Follow-up IA'
       WHERE NOT EXISTS (SELECT 1 FROM labels WHERE organizacao_id = ${organizacaoId}::uuid AND lower(nome) = 'follow-up ia')`);
  }
  return { criados, atualizados, desativados };
}

export type UsuarioAgente = { usuarioId: string; agenteId: string; nome: string };

/** O usuário (id em `usuarios`) é um agente? Devolve o agente ou null para humano/ausente. */
export async function agenteDoUsuario(organizacaoId: string, usuarioId: string | null | undefined): Promise<UsuarioAgente | null> {
  if (!usuarioId) return null;
  const [u] = await db.select({ id: usuarios.id, agenteId: usuarios.agenteId, nome: usuarios.nome }).from(usuarios)
    .where(and(eq(usuarios.id, usuarioId), eq(usuarios.organizacaoId, organizacaoId), eq(usuarios.tipo, TIPO_AGENTE), eq(usuarios.ativo, true))).limit(1);
  return u?.agenteId ? { usuarioId: u.id, agenteId: u.agenteId, nome: u.nome } : null;
}

/** Id do usuário que representa o agente (null se ainda não sincronizado). */
export async function usuarioDoAgente(agentId: string): Promise<string | null> {
  const [u] = await db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.agenteId, agentId)).limit(1);
  return u?.id ?? null;
}

/** Agentes ativos da organização (para seletores de regra/delegação). */
export async function listarUsuariosAgente(organizacaoId: string): Promise<UsuarioAgente[]> {
  const linhas = await db.select({ id: usuarios.id, agenteId: usuarios.agenteId, nome: usuarios.nome }).from(usuarios)
    .where(and(eq(usuarios.organizacaoId, organizacaoId), eq(usuarios.tipo, TIPO_AGENTE), eq(usuarios.ativo, true), sql`${usuarios.agenteId} IS NOT NULL`))
    .orderBy(usuarios.nome);
  return linhas.map((l) => ({ usuarioId: l.id, agenteId: l.agenteId!, nome: l.nome }));
}
