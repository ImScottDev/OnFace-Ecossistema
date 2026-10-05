"use server";

import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/auth/tenant";
import { atorHumano, type Familia, type PapelPessoa } from "@/lib/vendas/dominio";
import { executar, type Resultado } from "@/lib/vendas/resultado";
import { resolverEmpresa, resolverPessoa, vincularPessoaEmpresa } from "@/lib/vendas/identidade";
import { criarLead } from "@/lib/vendas/pre-vendas";
import { criarOportunidade } from "@/lib/vendas/pipeline";
import { salvarDadosJuridicos, conferirDadosJuridicos, type DadosJuridicos } from "@/lib/vendas/propostas";
import { empresa360, type Empresa360 } from "@/lib/vendas/consultas";
import { lerLinhaDoTempo, type LinhaDoTempo } from "@/lib/vendas/eventos";

const ROTA = "/contatos";

async function contexto() {
  const ctx = await getTenantContext();
  if (!ctx) return null;
  return { organizacaoId: ctx.organizacaoId, ator: atorHumano(ctx.userId) };
}

/** Bloco 05 §15: criar Empresa NÃO cria Lead. São ações explícitas e separadas. */
export async function acaoCriarEmpresa(entrada: {
  nome: string; cnpj?: string | null; website?: string | null;
  setor?: string | null; cidade?: string | null; estado?: string | null;
}): Promise<Resultado<{ empresaId: string; jaExistia: boolean; resolvidaPor: string | null }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  if (!entrada.nome?.trim()) return { ok: false, erro: "A empresa precisa de um nome." };

  return executar("criar empresa", async () => {
    const r = await resolverEmpresa(ctx.organizacaoId, {
      nome: entrada.nome.trim(), cnpj: entrada.cnpj ?? null, website: entrada.website ?? null,
      setor: entrada.setor ?? null, cidade: entrada.cidade ?? null, estado: entrada.estado ?? null,
    }, ctx.ator);
    revalidatePath(ROTA);
    return { empresaId: r.empresaId, jaExistia: !r.criada, resolvidaPor: r.resolvidaPor };
  });
}

/** Bloco 05 §3 e §14: Pessoa pode existir sem Empresa, e criar Pessoa não cria Lead. */
export async function acaoCriarPessoa(entrada: {
  nome: string; sobrenome?: string | null; cargo?: string | null;
  email?: string | null; telefone?: string | null; whatsapp?: string | null;
  empresaId?: string | null; papel?: PapelPessoa;
}): Promise<Resultado<{ pessoaId: string; jaExistia: boolean }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  if (!entrada.nome?.trim()) return { ok: false, erro: "A pessoa precisa de um nome." };

  return executar("criar pessoa", async () => {
    const r = await resolverPessoa(ctx.organizacaoId, {
      nome: entrada.nome.trim(), sobrenome: entrada.sobrenome ?? null, cargo: entrada.cargo ?? null,
      email: entrada.email ?? null, telefone: entrada.telefone ?? null, whatsapp: entrada.whatsapp ?? null,
      empresaId: entrada.empresaId ?? null,
    }, ctx.ator);
    if (entrada.empresaId) {
      await vincularPessoaEmpresa({
        organizacaoId: ctx.organizacaoId, pessoaId: r.pessoaId, empresaId: entrada.empresaId,
        papel: entrada.papel ?? "contato_principal", principal: (entrada.papel ?? "contato_principal") === "contato_principal",
        ator: ctx.ator,
      });
    }
    revalidatePath(ROTA);
    return { pessoaId: r.pessoaId, jaExistia: !r.criada };
  });
}

/**
 * Associa a pessoa a uma empresa.
 *
 * `encerrarAnteriores` é a troca de emprego (Bloco 05 §12): o vínculo antigo é
 * encerrado com data, não apagado.
 */
export async function acaoVincularPessoa(entrada: {
  pessoaId: string; empresaId: string; papel: PapelPessoa; principal: boolean; trocaDeEmpresa: boolean;
}): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("vincular pessoa", async () => {
    await vincularPessoaEmpresa({
      organizacaoId: ctx.organizacaoId, pessoaId: entrada.pessoaId, empresaId: entrada.empresaId,
      papel: entrada.papel, principal: entrada.principal,
      encerrarAnteriores: entrada.trocaDeEmpresa, ator: ctx.ator,
    });
    revalidatePath(ROTA);
  });
}

/** Ação explícita: abrir Pré-vendas para uma empresa do diretório. */
export async function acaoCriarLeadDaEmpresa(entrada: {
  empresaId: string; pessoaNome: string; cargo?: string | null;
  email?: string | null; telefone?: string | null; responsavelId?: string | null;
}): Promise<Resultado<{ leadId: string }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  if (!entrada.pessoaNome?.trim()) return { ok: false, erro: "Informe o contato do lead." };

  return executar("criar lead da empresa", async () => {
    const [empresa] = await db.execute<{ nome: string; cnpj: string | null; website: string | null }>(sql`
      SELECT nome, cnpj, website FROM empresas
       WHERE id = ${entrada.empresaId}::uuid AND organizacao_id = ${ctx.organizacaoId}::uuid
    `);
    if (!empresa) throw new Error("empresa não encontrada");

    const [primeiro, ...resto] = entrada.pessoaNome.trim().split(/\s+/);
    const criado = await criarLead({
      organizacaoId: ctx.organizacaoId,
      empresa: { nome: empresa.nome, cnpj: empresa.cnpj, website: empresa.website },
      pessoa: {
        nome: primeiro, sobrenome: resto.length ? resto.join(" ") : null,
        cargo: entrada.cargo ?? null, email: entrada.email ?? null, telefone: entrada.telefone ?? null,
      },
      touchpoint: { tipoOrigem: "manual", source: "diretorio" },
      origem: "Diretório",
      responsavelId: entrada.responsavelId ?? null,
    }, ctx.ator);
    revalidatePath(ROTA);
    revalidatePath("/pre-vendas");
    return { leadId: criado.leadId };
  });
}

/** Nova oportunidade a partir da empresa. Vira EXPANSION quando ela já é cliente. */
export async function acaoNovaOportunidade(entrada: {
  empresaId: string; familias: Familia[]; responsavelId: string; expansao: boolean;
}): Promise<Resultado<{ ids: string[] }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("criar oportunidade", async () => {
    const r = await criarOportunidade({
      organizacaoId: ctx.organizacaoId,
      empresaId: entrada.empresaId,
      familias: entrada.familias,
      responsavelId: entrada.responsavelId,
      sourceProcess: entrada.expansao ? "EXPANSION" : "MANUAL",
      motion: entrada.expansao ? "EXPANSION" : "NEW_BUSINESS",
    }, ctx.ator);
    revalidatePath(ROTA);
    revalidatePath("/pipeline");
    return { ids: r.oportunidades.map((o) => o.id) };
  });
}

/** Bloco 03 §17 e Bloco 05 §9: os dados jurídicos vivem na Empresa. */
export async function acaoSalvarDadosJuridicos(empresaId: string, dados: DadosJuridicos): Promise<Resultado<{ completo: boolean; faltando: string[] }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("salvar dados jurídicos", async () => {
    await salvarDadosJuridicos({ organizacaoId: ctx.organizacaoId, empresaId, dados, ator: ctx.ator });
    revalidatePath(ROTA);
    return conferirDadosJuridicos(ctx.organizacaoId, empresaId);
  });
}

export async function acaoEmpresa360(empresaId: string): Promise<Resultado<{ empresa: Empresa360 | null; timeline: LinhaDoTempo[] }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("carregar empresa", async () => {
    const [empresa, timeline] = await Promise.all([
      empresa360(ctx.organizacaoId, empresaId),
      lerLinhaDoTempo({ organizacaoId: ctx.organizacaoId, empresaId, limite: 40 }),
    ]);
    return { empresa, timeline };
  });
}

export async function acaoBuscarEmpresas(termo: string): Promise<Array<{ id: string; nome: string; apoio: string | null }>> {
  const ctx = await getTenantContext();
  if (!ctx || termo.trim().length < 2) return [];
  const linhas = await db.execute<{ id: string; nome: string; apoio: string | null }>(sql`
    SELECT id::text, nome, NULLIF(concat_ws(' · ', cnpj, cidade), '') AS apoio
      FROM empresas
     WHERE organizacao_id = ${ctx.organizacaoId}::uuid
       AND lower(nome) LIKE ${`%${termo.trim().toLowerCase()}%`}
     ORDER BY nome LIMIT 12
  `);
  return linhas.map((l) => ({ id: l.id, nome: l.nome, apoio: l.apoio }));
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
