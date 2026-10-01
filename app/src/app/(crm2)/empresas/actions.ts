"use server";

import { getTenantContext } from "@/lib/auth/tenant";
import { empresa360 } from "@/lib/vendas/consultas";
import { RegraDeNegocio, type RelacionamentoEmpresa } from "@/lib/vendas/dominio";
import { executar, type Resultado } from "@/lib/vendas/resultado";

/**
 * O que a peça "Iniciar relação" precisa saber da empresa: quem são as
 * pessoas dela e o relacionamento DERIVADO (nunca o que a tela supôs).
 * Tenant sempre do servidor.
 */
export async function acaoContextoDaEmpresa(empresaId: string): Promise<Resultado<{
  nome: string;
  relacionamento: RelacionamentoEmpresa;
  pessoas: Array<{ id: string; fonte: "pessoa" | "lead"; nome: string; cargo: string | null; email: string | null; telefone: string | null }>;
}>> {
  const ctx = await getTenantContext();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("carregar empresa", async () => {
    const e = await empresa360(ctx.organizacaoId, empresaId);
    if (!e) throw new RegraDeNegocio("empresa_nao_encontrada", "Empresa não encontrada.");
    return {
      nome: e.nome,
      relacionamento: e.relacionamento,
      pessoas: e.pessoas.map(({ id, fonte, nome, cargo, email, telefone }) => ({ id, fonte, nome, cargo, email, telefone })),
    };
  });
}
