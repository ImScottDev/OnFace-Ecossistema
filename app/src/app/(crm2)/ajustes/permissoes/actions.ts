"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth/tenant";
import { executar, type Resultado } from "@/lib/vendas/resultado";
import { alterarPermissaoDoPapel, podeEditarPermissoes } from "@/lib/ajustes/permissoes";

export async function acaoAlterarPermissao(
  roleId: string, permissao: string, conceder: boolean,
): Promise<Resultado> {
  const ctx = await getTenantContext();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  // "Ver como" é para enxergar, não para agir: a auditoria registraria a
  // mudança no nome da pessoa visualizada, não de quem de fato clicou.
  if (ctx.isViewingAs) return { ok: false, erro: "Saia do modo \"ver como\" para alterar permissões." };
  if (!(await podeEditarPermissoes(ctx))) {
    return { ok: false, erro: "Só administradores podem alterar permissões." };
  }

  const r = await executar("alterar permissão", () => alterarPermissaoDoPapel({
    organizacaoId: ctx.organizacaoId,
    atorId: ctx.userId,
    roleId: String(roleId),
    permissao: String(permissao),
    conceder: Boolean(conceder),
  }));
  if (!r.ok) return r;
  if (r.dados && !r.dados.ok) return { ok: false, erro: r.dados.erro };
  revalidatePath("/ajustes/permissoes");
  return { ok: true };
}
