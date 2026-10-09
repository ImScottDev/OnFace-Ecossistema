"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth/tenant";
import { limparCacheDoInicio } from "@/lib/inicio/montar";

/** "Atualizar" do Início: descarta a leitura guardada da própria pessoa e deixa
 *  o servidor refazer. Só a ela: o cache dos outros não é seu para limpar. */
export async function atualizarInicio() {
  const ctx = await getTenantContext();
  if (!ctx) return;
  limparCacheDoInicio(ctx.organizacaoId, ctx.userId);
  revalidatePath("/inicio");
}
