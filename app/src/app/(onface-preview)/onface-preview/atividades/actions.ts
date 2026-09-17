"use server";

import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/auth/tenant";
import {
  buscarContatos, buscarEmpresas, buscarNegociosDaEmpresa,
} from "@/lib/analytics/onface-atividades";
import type {
  ContatoOpcao, EmpresaOpcao, NegocioOpcao, NovaAtividade, StatusAtividade,
} from "@/components/onface/atividades/types";

const STATUS_PERMITIDOS = ["a_fazer", "em_andamento", "aguardando", "concluida", "declinada"] as const;

/** Busca de empresas para o vínculo. Sempre dentro da organização da sessão:
 * o tenant vem do servidor, nunca do cliente. */
export async function acaoBuscarEmpresas(termo: string): Promise<EmpresaOpcao[]> {
  const ctx = await getTenantContext();
  if (!ctx) return [];
  const linhas = await buscarEmpresas(ctx.organizacaoId, termo);
  return linhas.map((e) => ({ id: e.id, nome: e.nome, apoio: e.apoio, ehCliente: e.ehCliente }));
}

export async function acaoBuscarContatos(empresaId: string): Promise<ContatoOpcao[]> {
  const ctx = await getTenantContext();
  if (!ctx) return [];
  return buscarContatos(ctx.organizacaoId, empresaId);
}

export async function acaoBuscarNegocios(empresaId: string): Promise<NegocioOpcao[]> {
  const ctx = await getTenantContext();
  if (!ctx) return [];
  return buscarNegociosDaEmpresa(ctx.organizacaoId, empresaId);
}

export async function acaoResponsaveis(): Promise<Array<{ id: string; nome: string }>> {
  const ctx = await getTenantContext();
  if (!ctx) return [];
  return db.execute<{ id: string; nome: string }>(sql`
    SELECT id::text, nome FROM usuarios
     WHERE organizacao_id = ${ctx.organizacaoId}::uuid AND ativo = true
     ORDER BY nome
  `);
}

/**
 * Cria a atividade em `tarefas`.
 *
 * `origem = 'MANUAL'` distingue o que nasceu da mão de alguém do que veio de
 * régua automática, e é por isso que a tela consegue dizer depois quem criou o
 * item. Sem empresa não grava: atividade sem contexto é a que ninguém encontra.
 */
export async function acaoCriarAtividade(dados: NovaAtividade) {
  const ctx = await getTenantContext();
  if (!ctx) return { ok: false as const, erro: "Sessão expirada." };

  const titulo = dados.titulo.trim();
  if (!titulo) return { ok: false as const, erro: "A atividade precisa de um título." };
  if (!dados.empresaId) return { ok: false as const, erro: "Escolha a empresa da atividade." };

  try {
    const [criada] = await db.execute<{ id: string }>(sql`
      INSERT INTO tarefas (
        organizacao_id, empresa_id, lead_id, negocio_id, usuario_id,
        titulo, descricao, tipo, prioridade, data_vencimento, vence_em, origem
      ) VALUES (
        ${ctx.organizacaoId}::uuid,
        ${dados.empresaId}::uuid,
        ${dados.contatoId}::uuid,
        ${dados.negocioId}::uuid,
        ${dados.responsavelId ?? ctx.userId}::uuid,
        ${titulo},
        ${dados.descricao.trim() || null},
        ${dados.tipo},
        ${dados.prioridade},
        ${dados.vencimento}::date,
        ${dados.vencimento ? `${dados.vencimento}T12:00:00` : null}::timestamptz,
        'MANUAL'
      )
      RETURNING id::text
    `);

    revalidatePath("/onface-preview/atividades");
    return { ok: true as const, id: criada?.id ?? "" };
  } catch (erro) {
    console.error("[atividades] falha ao criar", erro);
    return { ok: false as const, erro: "Não consegui gravar a atividade." };
  }
}

/**
 * Muda o estado operacional da atividade.
 *
 * `concluida` continua sendo escrita pelo trigger do banco, então as rotinas
 * antigas do CRM seguem funcionando sem saber que existe `status`.
 */
export async function acaoMudarStatus(id: string, status: StatusAtividade) {
  const ctx = await getTenantContext();
  if (!ctx) return { ok: false as const, erro: "Sessão expirada." };
  if (!STATUS_PERMITIDOS.includes(status)) return { ok: false as const, erro: "Status inválido." };

  try {
    await db.execute(sql`
      UPDATE tarefas SET status = ${status}
       WHERE id = ${id}::uuid AND organizacao_id = ${ctx.organizacaoId}::uuid
    `);
    revalidatePath("/onface-preview/atividades");
    return { ok: true as const };
  } catch (erro) {
    console.error("[atividades] falha ao mudar status", erro);
    return { ok: false as const, erro: "Não consegui mudar o status." };
  }
}

/** Atalho de conclusão, mantido para quem só quer fechar o item. */
export async function acaoAlternarConclusao(id: string, concluir: boolean) {
  const ctx = await getTenantContext();
  if (!ctx) return { ok: false as const, erro: "Sessão expirada." };

  try {
    await db.execute(sql`
      UPDATE tarefas
         SET concluida = ${concluir},
             concluida_em = ${concluir ? sql`now()` : sql`NULL`}
       WHERE id = ${id}::uuid
         AND organizacao_id = ${ctx.organizacaoId}::uuid
    `);
    revalidatePath("/onface-preview/atividades");
    return { ok: true as const };
  } catch (erro) {
    console.error("[atividades] falha ao concluir", erro);
    return { ok: false as const, erro: "Não consegui atualizar a atividade." };
  }
}
