"use server";

/**
 * Server actions do vínculo Callface AI. A organização e o ator vêm da SESSÃO
 * (`getTenantContext`), nunca do cliente. Só papéis de gestão/CS mexem em vínculo
 * (admin, gerente, director, coordinator, operations); closer, sdr e leitor não.
 * Cada ação grava em audit_log: quem, quando, antes, depois, evidência.
 *
 *   confirmarVinculo({ empresaId, candidatoId })              // sugestão pendente -> confirmado
 *   alterarVinculo({ empresaId, orgCallfaceId, motivo })      // troca para outra organização conhecida -> manual
 *   removerVinculo({ empresaId, motivo })                     // desfaz; o par não é refeito pelo sync
 */
import { getTenantContext } from "@/lib/auth/tenant";
import { isAdminView } from "@/lib/auth/roles";
import { alterarVinculoManual, confirmarVinculoPendente, removerVinculoDaEmpresa, type ResultadoVinculo } from "./vinculo-escrita";

async function ator(): Promise<{ organizacaoId: string; userId: string } | { erro: string }> {
  const ctx = await getTenantContext();
  if (!ctx) return { erro: "Sessão expirada." };
  if (!isAdminView(ctx.userRole)) return { erro: "Seu papel não pode alterar vínculos da Callface AI." };
  return { organizacaoId: ctx.organizacaoId, userId: ctx.userId };
}

export async function confirmarVinculo(input: { empresaId: string; candidatoId: string }): Promise<ResultadoVinculo> {
  const a = await ator();
  if ("erro" in a) return { ok: false, erro: a.erro };
  return confirmarVinculoPendente(a.organizacaoId, a.userId, input.empresaId, input.candidatoId);
}

export async function alterarVinculo(input: { empresaId: string; orgCallfaceId: string; motivo: string }): Promise<ResultadoVinculo> {
  const a = await ator();
  if ("erro" in a) return { ok: false, erro: a.erro };
  return alterarVinculoManual(a.organizacaoId, a.userId, input.empresaId, input.orgCallfaceId, input.motivo);
}

export async function removerVinculo(input: { empresaId: string; motivo: string }): Promise<ResultadoVinculo> {
  const a = await ator();
  if ("erro" in a) return { ok: false, erro: a.erro };
  return removerVinculoDaEmpresa(a.organizacaoId, a.userId, input.empresaId, input.motivo);
}
