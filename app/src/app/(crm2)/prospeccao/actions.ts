"use server";

import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/auth/tenant";
import { atorHumano, type Familia, type MotivoDescarte } from "@/lib/vendas/dominio";
import { executar, type Resultado } from "@/lib/vendas/resultado";
import * as prospeccao from "@/lib/vendas/prospeccao";

const ROTA = "/prospeccao";

async function contexto() {
  const ctx = await getTenantContext();
  if (!ctx) return null;
  return { organizacaoId: ctx.organizacaoId, ator: atorHumano(ctx.userId) };
}

export async function acaoAdicionarProspect(entrada: {
  empresa: string;
  cnpj?: string | null;
  website?: string | null;
  pessoaNome?: string | null;
  cargo?: string | null;
  email?: string | null;
  telefone?: string | null;
  fonte?: string | null;
  lista?: string | null;
  responsavelId?: string | null;
}): Promise<Resultado<{ leadId: string; jaExistia: boolean }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  if (!entrada.empresa?.trim()) return { ok: false, erro: "O prospect precisa de uma empresa." };

  return executar("adicionar prospect", async () => {
    const [primeiro, ...resto] = (entrada.pessoaNome ?? "").trim().split(/\s+/).filter(Boolean);
    const r = await prospeccao.adicionarProspect({
      organizacaoId: ctx.organizacaoId,
      empresa: { nome: entrada.empresa.trim(), cnpj: entrada.cnpj ?? null, website: entrada.website ?? null, email: entrada.email ?? null },
      // Bloco 05 §2: empresa pode entrar sem pessoa, e em outbound isso é o
      // caso normal — enriquecer depois é parte do processo.
      pessoa: primeiro
        ? { nome: primeiro, sobrenome: resto.length ? resto.join(" ") : null, cargo: entrada.cargo ?? null, email: entrada.email ?? null, telefone: entrada.telefone ?? null }
        : null,
      fonte: entrada.fonte ?? null,
      lista: entrada.lista ?? null,
      responsavelId: entrada.responsavelId ?? null,
    }, ctx.ator);
    revalidatePath(ROTA);
    return { leadId: r.leadId, jaExistia: r.jaExistia };
  });
}

export async function acaoInscreverEmCadencia(leadId: string, cadenceDefinitionId: string): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("inscrever em cadência", async () => {
    await prospeccao.inscreverEmCadencia({ organizacaoId: ctx.organizacaoId, leadId, cadenceDefinitionId, ator: ctx.ator });
    revalidatePath(ROTA);
  });
}

export async function acaoPausarCadencia(leadId: string, motivo: string): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("pausar cadência", async () => {
    await prospeccao.pausarCadencia({ organizacaoId: ctx.organizacaoId, leadId, motivo, ator: ctx.ator });
    revalidatePath(ROTA);
  });
}

export async function acaoRegistrarResposta(leadId: string, canal: string | null): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("registrar resposta", async () => {
    await prospeccao.registrarResposta({ organizacaoId: ctx.organizacaoId, leadId, canal, ator: ctx.ator });
    revalidatePath(ROTA);
  });
}

export async function acaoMarcarSemResposta(leadId: string): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("marcar sem resposta", async () => {
    await prospeccao.marcarSemResposta({ organizacaoId: ctx.organizacaoId, leadId, ator: ctx.ator });
    revalidatePath(ROTA);
  });
}

/** Saída 1 do outbound: entrega para a jornada formal de Pré-vendas. */
export async function acaoPreQualificar(leadId: string): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("pré-qualificar", async () => {
    await prospeccao.preQualificar({ organizacaoId: ctx.organizacaoId, leadId, ator: ctx.ator });
    revalidatePath(ROTA);
    revalidatePath("/pre-vendas");
  });
}

/** Saída 2 do outbound: oportunidade direta, sem fingir passagem por Pré-vendas. */
export async function acaoOportunidadeDireta(
  leadId: string, familias: Familia[], responsavelId: string,
): Promise<Resultado<{ ids: string[] }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("criar oportunidade direta", async () => {
    const r = await prospeccao.criarOportunidadeDireta({
      organizacaoId: ctx.organizacaoId, leadId, familias, responsavelId, ator: ctx.ator,
    });
    revalidatePath(ROTA);
    revalidatePath("/pipeline");
    return { ids: r.oportunidades.map((o) => o.id) };
  });
}

export async function acaoDescartar(leadId: string, motivo: MotivoDescarte): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("descartar prospect", async () => {
    await prospeccao.descartar({ organizacaoId: ctx.organizacaoId, leadId, motivo, ator: ctx.ator });
    revalidatePath(ROTA);
  });
}

export async function acaoAtribuirProspect(leadId: string, responsavelId: string | null): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("atribuir prospect", async () => {
    await prospeccao.atribuirProspect({
      organizacaoId: ctx.organizacaoId, leadId, responsavelId, origemAtribuicao: "manual", ator: ctx.ator,
    });
    revalidatePath(ROTA);
  });
}

/** Ação em massa: mesma regra, aplicada item a item, com o resultado somado.
 *  Um item que falha não derruba os outros — e a tela diz quantos falharam. */
export async function acaoAtribuirEmMassa(
  leadIds: string[], responsavelId: string | null,
): Promise<Resultado<{ aplicados: number; falhas: number }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  let aplicados = 0;
  let falhas = 0;
  for (const leadId of leadIds) {
    try {
      await prospeccao.atribuirProspect({
        organizacaoId: ctx.organizacaoId, leadId, responsavelId, origemAtribuicao: "manual", ator: ctx.ator,
      });
      aplicados += 1;
    } catch (erro) {
      console.error("[prospeccao] falha ao atribuir em massa", leadId, erro);
      falhas += 1;
    }
  }
  revalidatePath(ROTA);
  return { ok: true, dados: { aplicados, falhas } };
}

export async function acaoCadencias(): Promise<Array<{ id: string; nome: string }>> {
  const ctx = await getTenantContext();
  if (!ctx) return [];
  const linhas = await db.execute<{ id: string; nome: string }>(sql`
    SELECT id::text, nome FROM cadence_definitions
     WHERE organizacao_id = ${ctx.organizacaoId}::uuid AND ativo = true AND entity_type = 'lead'
     ORDER BY nome
  `);
  return linhas.map((l) => ({ id: l.id, nome: l.nome }));
}

export async function acaoResponsaveis(): Promise<Array<{ id: string; nome: string }>> {
  const ctx = await getTenantContext();
  if (!ctx) return [];
  const linhas = await db.execute<{ id: string; nome: string }>(sql`
    SELECT id::text, nome FROM usuarios
     WHERE organizacao_id = ${ctx.organizacaoId}::uuid AND ativo = true ORDER BY nome
  `);
  return linhas.map((l) => ({ id: l.id, nome: l.nome }));
}
