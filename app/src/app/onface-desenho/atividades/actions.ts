"use server";

import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  buscarContatos, buscarEmpresas, buscarNegociosDaEmpresa,
} from "@/lib/analytics/onface-atividades";
import type { NovaAtividade, StatusAtividade } from "@/components/onface/atividades/types";

/**
 * Ações do banco de desenho: mesmas consultas, sem sessão.
 *
 * Existem só para validar o formulário de ponta a ponta em desenvolvimento,
 * onde não há login. Em produção o grupo `/onface-desenho` não existe, e a
 * versão oficial resolve o tenant pela sessão.
 */
function proibirEmProducao() {
  if (process.env.NODE_ENV === "production") throw new Error("Rota de desenho não existe em produção.");
}

async function orgDeDesenho() {
  const [org] = await db.execute<{ id: string }>(sql`
    SELECT id::text FROM organizacoes ORDER BY created_at LIMIT 1
  `);
  return org.id;
}

export async function desBuscarEmpresas(termo: string) {
  proibirEmProducao();
  return buscarEmpresas(await orgDeDesenho(), termo);
}

export async function desBuscarContatos(empresaId: string) {
  proibirEmProducao();
  return buscarContatos(await orgDeDesenho(), empresaId);
}

export async function desBuscarNegocios(empresaId: string) {
  proibirEmProducao();
  return buscarNegociosDaEmpresa(await orgDeDesenho(), empresaId);
}

export async function desResponsaveis() {
  proibirEmProducao();
  const orgId = await orgDeDesenho();
  return db.execute<{ id: string; nome: string }>(sql`
    SELECT id::text, nome FROM usuarios
     WHERE organizacao_id = ${orgId}::uuid AND ativo = true
     ORDER BY nome
  `);
}

export async function desCriarAtividade(dados: NovaAtividade) {
  proibirEmProducao();
  const orgId = await orgDeDesenho();
  const [autor] = await db.execute<{ id: string }>(sql`
    SELECT id::text FROM usuarios WHERE organizacao_id = ${orgId}::uuid ORDER BY created_at LIMIT 1
  `);

  const titulo = dados.titulo.trim();
  if (!titulo) return { ok: false as const, erro: "A atividade precisa de um título." };
  if (!dados.empresaId) return { ok: false as const, erro: "Escolha a empresa da atividade." };

  try {
    const [criada] = await db.execute<{ id: string }>(sql`
      INSERT INTO tarefas (
        organizacao_id, empresa_id, lead_id, negocio_id, usuario_id,
        titulo, descricao, tipo, prioridade, data_vencimento, vence_em, origem
      ) VALUES (
        ${orgId}::uuid, ${dados.empresaId}::uuid, ${dados.contatoId}::uuid,
        ${dados.negocioId}::uuid, ${dados.responsavelId ?? autor?.id}::uuid,
        ${titulo}, ${dados.descricao.trim() || null}, ${dados.tipo}, ${dados.prioridade},
        ${dados.vencimento}::date,
        ${dados.vencimento ? `${dados.vencimento}T12:00:00` : null}::timestamptz,
        'MANUAL'
      ) RETURNING id::text
    `);
    revalidatePath("/onface-desenho/atividades");
    return { ok: true as const, id: criada?.id ?? "" };
  } catch (erro) {
    console.error("[atividades/desenho] falha ao criar", erro);
    return { ok: false as const, erro: "Não consegui gravar a atividade." };
  }
}

export async function desMudarStatus(id: string, status: StatusAtividade) {
  proibirEmProducao();
  const orgId = await orgDeDesenho();
  await db.execute(sql`
    UPDATE tarefas SET status = ${status}
     WHERE id = ${id}::uuid AND organizacao_id = ${orgId}::uuid
  `);
  revalidatePath("/onface-desenho/atividades");
  return { ok: true as const };
}

export async function desAlternarConclusao(id: string, concluir: boolean) {
  proibirEmProducao();
  const orgId = await orgDeDesenho();
  await db.execute(sql`
    UPDATE tarefas
       SET concluida = ${concluir}, concluida_em = ${concluir ? sql`now()` : sql`NULL`}
     WHERE id = ${id}::uuid AND organizacao_id = ${orgId}::uuid
  `);
  revalidatePath("/onface-desenho/atividades");
  return { ok: true as const };
}
