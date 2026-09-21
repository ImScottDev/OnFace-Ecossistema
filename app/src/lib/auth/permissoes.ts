/**
 * Autorização granular (SPEC §31).
 *
 * O gate de hoje é a string `usuarios.role` lida por funções booleanas grossas
 * — `isAdminView`, `isPersonalView` — que respondem "vê o agregado?" e nada
 * mais. Não dá para dizer "pode mover oportunidade mas não aprovar desconto",
 * e é isso que o SPEC exige para o agente de IA poder agir com permissão
 * delegada sem poder exceder o que foi delegado.
 *
 * Aqui a pergunta passa a ser por CAPACIDADE, não por cargo. O papel continua
 * existindo; ele deixa de ser a resposta e vira o caminho até ela.
 *
 * O cutover é conservador de propósito: `temPermissao` cai no gate antigo
 * quando o usuário ainda não tem papel vinculado. Autorização que falha fechada
 * durante uma migração tira gente do sistema no meio do expediente.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { isAdminView, isPersonalView, isReader } from "./roles";

export type CodigoPermissao =
  | "companies.read" | "companies.write"
  | "acquisition.read" | "acquisition.manage"
  | "sales.read" | "sales.manage" | "sales.approve_discount"
  | "finance.read" | "finance.manage"
  | "cs.read" | "cs.manage"
  | "automation.manage"
  | "ai.use" | "ai.configure"
  | "integrations.manage" | "admin.manage_users";

/** Contexto de quem age. Todo comando de domínio deveria receber um (SPEC §31). */
export interface Ator {
  usuarioId: string | null;
  organizacaoId: string;
  /** Papel legado da sessão — usado só no fallback do cutover. */
  role?: string | null;
  /** Agente de IA age com permissão DELEGADA e nunca acima dela (SPEC §31). */
  tipo?: "HUMAN" | "AI" | "SYSTEM";
  permissoesDelegadas?: CodigoPermissao[];
}

/** Permissões que o usuário tem pelo RBAC normalizado. */
export async function permissoesDoUsuario(
  usuarioId: string, organizacaoId: string,
): Promise<Set<CodigoPermissao>> {
  const linhas = await db.execute<{ codigo: string }>(sql`
    SELECT DISTINCT p.codigo
      FROM user_roles ur
      JOIN role_permissions rp ON rp.role_id = ur.role_id
      JOIN permissions p ON p.id = rp.permission_id
     WHERE ur.usuario_id = ${usuarioId}::uuid
       AND ur.organizacao_id = ${organizacaoId}::uuid`);
  return new Set(linhas.map((l) => l.codigo as CodigoPermissao));
}

/**
 * Responde pelo gate ANTIGO, para o fallback e para o teste de paridade.
 *
 * Não é a regra nova: é a tradução fiel do que o sistema faz hoje, para que o
 * cutover possa ser provado sem ninguém ganhar ou perder acesso.
 */
export function permissaoPeloPapelLegado(role: string | null | undefined, codigo: CodigoPermissao): boolean {
  if (isAdminView(role)) return codigo !== "sales.approve_discount" || role === "admin" || role === "super_admin";
  if (isReader(role)) return codigo.endsWith(".read");
  if (isPersonalView(role)) {
    return [
      "acquisition.read", "acquisition.manage", "sales.read", "sales.manage",
      "companies.read", "companies.write", "cs.read", "ai.use",
    ].includes(codigo);
  }
  return false;
}

/**
 * A pergunta canônica: este ator pode fazer isto?
 *
 * Ordem: delegação da IA primeiro (teto, nunca piso), depois RBAC, depois o
 * gate legado como rede durante o cutover.
 */
export async function temPermissao(ator: Ator, codigo: CodigoPermissao): Promise<boolean> {
  if (!ator.usuarioId) return false;

  // Agente de IA não pode exceder o que lhe foi delegado NAQUELA execução, mesmo
  // que o usuário por trás possa mais (SPEC §31).
  if (ator.tipo === "AI") {
    if (!ator.permissoesDelegadas?.includes(codigo)) return false;
  }

  const doRbac = await permissoesDoUsuario(ator.usuarioId, ator.organizacaoId);
  if (doRbac.size > 0) return doRbac.has(codigo);

  // Sem papel vinculado ainda: o gate antigo responde. Some quando todo usuário
  // tiver papel — hoje são 16 de 16, mas usuário novo entra sem.
  return permissaoPeloPapelLegado(ator.role, codigo);
}

/** Versão que lança, para usar no início de uma rota ou comando. */
export async function exigirPermissao(ator: Ator, codigo: CodigoPermissao): Promise<void> {
  if (!(await temPermissao(ator, codigo))) {
    throw Object.assign(new Error(`sem permissão: ${codigo}`), { status: 403, codigo });
  }
}
