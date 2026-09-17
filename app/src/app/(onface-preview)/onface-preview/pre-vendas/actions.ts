"use server";

import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/auth/tenant";
import { atorHumano, type Familia, type MotivoDesqualificacao, type MotivoNutricao, type Qualificacao } from "@/lib/vendas/dominio";
import { executar, type Resultado } from "@/lib/vendas/resultado";
import * as preVendas from "@/lib/vendas/pre-vendas";
import { criarOportunidadeDoLead } from "@/lib/vendas/pipeline";
import { detalheLead, type DetalheLead } from "@/lib/vendas/consultas";
import { lerLinhaDoTempo, type LinhaDoTempo } from "@/lib/vendas/eventos";
import { resolverEmpresa } from "@/lib/vendas/identidade";

const ROTA = "/onface-preview/pre-vendas";

/** Tenant e ator vêm SEMPRE do servidor: o cliente nunca escolhe em nome de
 *  qual organização ou de qual usuário a ação acontece. */
async function contexto() {
  const ctx = await getTenantContext();
  if (!ctx) return null;
  return { organizacaoId: ctx.organizacaoId, ator: atorHumano(ctx.userId) };
}

export async function acaoMoverEtapa(leadId: string, para: "novo" | "em_contato" | "qualificacao"): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("mover etapa", async () => {
    await preVendas.moverEtapa({ organizacaoId: ctx.organizacaoId, leadId, para, ator: ctx.ator });
    revalidatePath(ROTA);
  });
}

export async function acaoQualificar(leadId: string, qualificacao: Qualificacao): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("qualificar", async () => {
    await preVendas.qualificar({ organizacaoId: ctx.organizacaoId, leadId, qualificacao, ator: ctx.ator });
    revalidatePath(ROTA);
  });
}

export async function acaoSalvarQualificacao(leadId: string, qualificacao: Qualificacao): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("salvar qualificação", async () => {
    await preVendas.salvarQualificacao({ organizacaoId: ctx.organizacaoId, leadId, qualificacao, ator: ctx.ator });
    revalidatePath(ROTA);
  });
}

export async function acaoNutrir(
  leadId: string, motivo: MotivoNutricao, retomarEm: string | null, observacao: string | null,
): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("nutrir", async () => {
    await preVendas.nutrir({ organizacaoId: ctx.organizacaoId, leadId, motivo, retomarEm, observacao, ator: ctx.ator });
    revalidatePath(ROTA);
  });
}

export async function acaoDesqualificar(
  leadId: string, motivo: MotivoDesqualificacao, detalhe: string | null,
): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("desqualificar", async () => {
    await preVendas.desqualificar({ organizacaoId: ctx.organizacaoId, leadId, motivo, detalhe, ator: ctx.ator });
    revalidatePath(ROTA);
  });
}

export async function acaoReativar(leadId: string): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("reativar", async () => {
    await preVendas.moverEtapa({
      organizacaoId: ctx.organizacaoId, leadId, para: "em_contato",
      ator: ctx.ator, motivo: "Lead retomado",
    });
    revalidatePath(ROTA);
  });
}

export async function acaoRegistrarContato(
  leadId: string, canal: "whatsapp" | "email" | "ligacao",
): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("registrar contato", async () => {
    await preVendas.registrarPrimeiroContato({ organizacaoId: ctx.organizacaoId, leadId, canal, ator: ctx.ator });
    revalidatePath(ROTA);
  });
}

export async function acaoAtribuir(leadId: string, responsavelId: string | null): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("atribuir responsável", async () => {
    await preVendas.atribuirResponsavel({
      organizacaoId: ctx.organizacaoId, leadId, responsavelId,
      origemAtribuicao: "manual", ator: ctx.ator,
    });
    revalidatePath(ROTA);
  });
}

/**
 * Handoff para o Pipeline.
 *
 * Duas famílias marcadas criam duas oportunidades irmãs — é o que a spec
 * manda, e o modal avisa isso antes de o usuário confirmar.
 */
export async function acaoCriarOportunidade(entrada: {
  leadId: string;
  familias: Familia[];
  responsavelId: string;
  reuniao?: { data: string; duracao?: number; tipo?: "call" | "presencial" | "video" } | null;
}): Promise<Resultado<{ ids: string[] }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("criar oportunidade", async () => {
    const resultado = await criarOportunidadeDoLead({
      organizacaoId: ctx.organizacaoId,
      leadId: entrada.leadId,
      familias: entrada.familias,
      responsavelId: entrada.responsavelId,
      reuniao: entrada.reuniao ?? null,
      ator: ctx.ator,
    });
    revalidatePath(ROTA);
    revalidatePath("/onface-preview/pipeline");
    return { ids: resultado.oportunidades.map((o) => o.id) };
  });
}

/** Criação manual de Lead. Empresa é obrigatória e resolvida antes (Bloco 01 §3). */
export async function acaoCriarLead(entrada: {
  empresa: string;
  cnpj?: string | null;
  website?: string | null;
  pessoaNome: string;
  cargo?: string | null;
  email?: string | null;
  telefone?: string | null;
  origem?: string | null;
  responsavelId?: string | null;
}): Promise<Resultado<{ leadId: string }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  if (!entrada.empresa?.trim()) return { ok: false, erro: "O lead precisa de uma empresa." };
  if (!entrada.pessoaNome?.trim()) return { ok: false, erro: "Informe o nome do contato." };

  return executar("criar lead", async () => {
    const [primeiro, ...resto] = entrada.pessoaNome.trim().split(/\s+/);
    const criado = await preVendas.criarLead({
      organizacaoId: ctx.organizacaoId,
      empresa: {
        nome: entrada.empresa.trim(), cnpj: entrada.cnpj ?? null,
        website: entrada.website ?? null, email: entrada.email ?? null,
      },
      pessoa: {
        nome: primeiro, sobrenome: resto.length ? resto.join(" ") : null,
        cargo: entrada.cargo ?? null, email: entrada.email ?? null, telefone: entrada.telefone ?? null,
      },
      touchpoint: { tipoOrigem: "manual", source: entrada.origem ?? "manual" },
      origem: entrada.origem ?? "Manual",
      responsavelId: entrada.responsavelId ?? null,
    }, ctx.ator);
    revalidatePath(ROTA);
    return { leadId: criado.leadId };
  });
}

/** Associa a empresa quando o lead legado só tem o nome dela em texto. */
export async function acaoAssociarEmpresa(leadId: string, nome: string, cnpj: string | null): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("associar empresa", async () => {
    const empresa = await resolverEmpresa(ctx.organizacaoId, { nome, cnpj }, ctx.ator);
    await db.execute(sql`
      UPDATE leads SET empresa_id = ${empresa.empresaId}::uuid, empresa = ${nome}, updated_at = now()
       WHERE id = ${leadId}::uuid AND organizacao_id = ${ctx.organizacaoId}::uuid
    `);
    revalidatePath(ROTA);
  });
}

export async function acaoDetalhe(leadId: string): Promise<Resultado<{ lead: DetalheLead | null; timeline: LinhaDoTempo[] }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("carregar detalhe", async () => {
    const [lead, timeline] = await Promise.all([
      detalheLead(ctx.organizacaoId, leadId),
      lerLinhaDoTempo({ organizacaoId: ctx.organizacaoId, leadId, limite: 40 }),
    ]);
    return { lead, timeline };
  });
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
