/**
 * Matriz papel × permissão (RBAC normalizado: roles, role_permissions,
 * user_roles, permissions).
 *
 * Até aqui o RBAC existia só no banco e em `lib/auth/permissoes`: o card
 * "Permissões" de Ajustes dizia "ainda não existe tela". As permissões já
 * decidem acesso de verdade (financeiro, automações, agentes, CS, teto dos
 * tokens de API), então quem administra precisava ao menos VER o que cada
 * papel pode — e poder ajustar sem abrir o psql.
 *
 * O papel `admin` é travado: tirar dele `admin.manage_users` tiraria de todo
 * administrador a única tela capaz de devolver a permissão. Travar no servidor
 * (aqui) e não só na UI, porque um POST forjado não passa pela UI.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { auditLog } from "@/lib/db/schema";
import { temPermissao } from "@/lib/auth/permissoes";

export const PAPEL_TRAVADO = "admin";

export const ERRO_ULTIMA_PERMISSAO =
  "Um papel precisa de pelo menos uma permissão; sem nenhuma, o acesso volta para a regra antiga do papel.";

/**
 * Quem pode editar a matriz: papel admin (ou super_admin) E a permissão
 * `admin.manage_users`. As duas, não uma: gerente/diretoria/operações também
 * têm `admin.manage_users` pelo seed, e deixar qualquer um deles editar a
 * matriz seria deixar a gerência se conceder `sales.approve_discount` — a
 * única permissão que o gate legado reserva ao admin.
 */
export async function podeEditarPermissoes(ctx: {
  userId: string; organizacaoId: string; userRole: string;
}): Promise<boolean> {
  if (ctx.userRole !== "admin" && ctx.userRole !== "super_admin") return false;
  return temPermissao(
    { usuarioId: ctx.userId, organizacaoId: ctx.organizacaoId, role: ctx.userRole, tipo: "HUMAN" },
    "admin.manage_users",
  );
}

export interface PapelMatriz {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  sistema: boolean;
  /** Pessoas ATIVAS da organização vinculadas a este papel em user_roles. */
  pessoas: number;
  permissoes: string[];
}

export type PermissaoMatriz = {
  codigo: string;
  dominio: string;
  descricao: string | null;
}

export async function matrizDePermissoes(organizacaoId: string): Promise<{
  papeis: PapelMatriz[];
  permissoes: PermissaoMatriz[];
}> {
  const [papeis, permissoes] = await Promise.all([
    db.execute<{
      id: string; codigo: string; nome: string; descricao: string | null; sistema: boolean;
      pessoas: number; permissoes: string[] | null;
    }>(sql`
      SELECT r.id::text, r.codigo, r.nome, r.descricao, r.sistema,
             (SELECT count(*)::int FROM user_roles ur
                JOIN usuarios u ON u.id = ur.usuario_id AND u.ativo
               WHERE ur.role_id = r.id AND ur.organizacao_id = r.organizacao_id) AS pessoas,
             -- json_agg e não array_agg: pelo db.execute cru o text[] chega
             -- como a string "{a,b}", e a matriz quebrava no .map.
             (SELECT COALESCE(json_agg(p.codigo ORDER BY p.codigo), '[]'::json) FROM role_permissions rp
                JOIN permissions p ON p.id = rp.permission_id
               WHERE rp.role_id = r.id) AS permissoes
        FROM roles r
       WHERE r.organizacao_id = ${organizacaoId}::uuid
       -- Ordem de hierarquia, não alfabética: quem lê a matriz compara
       -- vizinhos, e admin ao lado de closer não diz nada.
       ORDER BY array_position(ARRAY['admin','director','gerente','coordinator','operations','closer','sdr','leitor'], r.codigo) NULLS LAST, r.nome`),
    // `permissions` é catálogo global (não tem organizacao_id): o que pode
    // existir é igual para todos; o que cada papel tem é que é da organização.
    db.execute<PermissaoMatriz>(sql`
      SELECT codigo, dominio, descricao FROM permissions ORDER BY dominio, codigo`),
  ]);

  return {
    papeis: papeis.map((p) => ({ ...p, permissoes: p.permissoes ?? [] })),
    permissoes: [...permissoes],
  };
}

/**
 * Concede ou revoga UMA permissão de UM papel da organização.
 * Devolve `false` quando o papel não é desta organização (ou é o travado), para
 * a action responder sem revelar papel de outro tenant.
 */
export async function alterarPermissaoDoPapel(params: {
  organizacaoId: string;
  atorId: string;
  roleId: string;
  permissao: string;
  conceder: boolean;
}): Promise<{ ok: true } | { ok: false; erro: string }> {
  const { organizacaoId, atorId, roleId, permissao, conceder } = params;

  return db.transaction(async (tx) => {
    const [papel] = await tx.execute<{ codigo: string }>(sql`
      SELECT codigo FROM roles WHERE id = ${roleId}::uuid AND organizacao_id = ${organizacaoId}::uuid
         -- FOR UPDATE serializa alterações do mesmo papel: sem a trava, duas
         -- revogações simultâneas das duas últimas permissões passariam ambas
         -- na contagem abaixo e deixariam o papel vazio.
         FOR UPDATE`);
    if (!papel) return { ok: false as const, erro: "Papel não encontrado nesta organização." };
    if (papel.codigo === PAPEL_TRAVADO) {
      return { ok: false as const, erro: "O papel Administrador tem todas as permissões e não pode ser alterado." };
    }

    const [perm] = await tx.execute<{ id: string }>(sql`
      SELECT id::text FROM permissions WHERE codigo = ${permissao}`);
    if (!perm) return { ok: false as const, erro: "Permissão desconhecida." };

    if (conceder) {
      await tx.execute(sql`
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES (${roleId}::uuid, ${perm.id}::uuid)
        ON CONFLICT DO NOTHING`);
    } else {
      // Papel sem nenhuma role_permission não fica "sem acesso": permissoesEfetivas
      // (lib/auth/permissoes) cai no gate legado quando o RBAC da pessoa está
      // vazio, e o gerente volta a ter 15 permissões com a matriz mostrando 0.
      // Recusar é a única forma de a matriz continuar dizendo a verdade.
      const [{ outras }] = await tx.execute<{ outras: number }>(sql`
        SELECT count(*)::int AS outras FROM role_permissions
         WHERE role_id = ${roleId}::uuid AND permission_id <> ${perm.id}::uuid`);
      if (outras === 0) return { ok: false as const, erro: ERRO_ULTIMA_PERMISSAO };
      await tx.execute(sql`
        DELETE FROM role_permissions
         WHERE role_id = ${roleId}::uuid AND permission_id = ${perm.id}::uuid`);
    }

    // Mudança de autorização sem rastro é a pior de investigar: "quem deu
    // financeiro para o SDR?" precisa de resposta.
    await tx.insert(auditLog).values({
      organizacaoId,
      actorId: atorId,
      action: conceder ? "rbac.permission_grant" : "rbac.permission_revoke",
      entityType: "role",
      entityId: roleId,
      before: { papel: papel.codigo, permissao },
      after: { papel: papel.codigo, permissao, tem: conceder },
      source: "admin",
    });

    return { ok: true as const };
  });
}
