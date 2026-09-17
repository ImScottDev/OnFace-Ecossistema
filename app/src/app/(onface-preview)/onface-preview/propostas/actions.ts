"use server";

import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/auth/tenant";
import {
  atorHumano, type Familia, type ModoFechamento, type TipoContratual,
} from "@/lib/vendas/dominio";
import { executar, type Resultado } from "@/lib/vendas/resultado";
import * as propostas from "@/lib/vendas/propostas";
import { criarPropostaComItens, type ItemEntrada } from "@/lib/crm/proposta-criacao";
import { lerLinhaDoTempo, registrarEvento, type LinhaDoTempo } from "@/lib/vendas/eventos";

const ROTA = "/onface-preview/propostas";

async function contexto() {
  const ctx = await getTenantContext();
  if (!ctx) return null;
  return { organizacaoId: ctx.organizacaoId, usuarioId: ctx.userId, ator: atorHumano(ctx.userId) };
}

/* ── Leitura ───────────────────────────────────────────────────────────── */

export interface LinhaProposta {
  id: string;
  numero: number;
  versao: number;
  status: string;
  empresa: string | null;
  oportunidade: string | null;
  negocioId: string | null;
  familia: string | null;
  modoFechamento: string | null;
  total: number | null;
  totalRecorrente: number | null;
  enviadaEm: string | null;
  validade: string | null;
  ajusteSolicitado: string | null;
}

export async function acaoListar(filtros: { status?: string | null; busca?: string | null } = {}): Promise<LinhaProposta[]> {
  const ctx = await getTenantContext();
  if (!ctx) return [];
  const busca = filtros.busca?.trim() ? `%${filtros.busca.trim().toLowerCase()}%` : null;

  const linhas = await db.execute<{
    id: string; numero: number; versao: number; status: string;
    empresa: string | null; oportunidade: string | null; negocio_id: string | null;
    familia: string | null; modo: string | null; total: string | null;
    total_recorrente: string | null; enviada_em: string | null;
    validade: string | null; ajuste: string | null;
  }>(sql`
    SELECT p.id::text, p.numero, p.versao, p.status,
           COALESCE(e.nome, l.empresa) AS empresa, n.titulo AS oportunidade, p.negocio_id::text,
           COALESCE(p.service_family, n.service_family) AS familia, p.modo_fechamento AS modo,
           p.total_geral::text AS total, p.total_recorrente::text,
           p.enviada_em::text, p.data_validade::text AS validade,
           p.ajuste_solicitado_descricao AS ajuste
      FROM propostas p
      LEFT JOIN negocios n ON n.id = p.negocio_id
      LEFT JOIN empresas e ON e.id = n.empresa_id
      LEFT JOIN leads l ON l.id = p.lead_id
     WHERE p.organizacao_id = ${ctx.organizacaoId}::uuid
       AND (${filtros.status ?? null}::text IS NULL OR p.status = ${filtros.status ?? null})
       AND (${busca}::text IS NULL OR lower(COALESCE(e.nome, l.empresa, '')) LIKE ${busca}
            OR lower(COALESCE(n.titulo, '')) LIKE ${busca} OR p.numero::text LIKE ${busca})
     ORDER BY p.created_at DESC
     LIMIT 200
  `);

  return linhas.map((l) => ({
    id: l.id, numero: l.numero, versao: l.versao, status: l.status,
    empresa: l.empresa, oportunidade: l.oportunidade, negocioId: l.negocio_id,
    familia: l.familia, modoFechamento: l.modo,
    total: l.total === null ? null : Number(l.total),
    totalRecorrente: l.total_recorrente === null ? null : Number(l.total_recorrente),
    enviadaEm: l.enviada_em, validade: l.validade, ajusteSolicitado: l.ajuste,
  }));
}

export interface DetalheProposta {
  id: string;
  numero: number;
  versao: number;
  status: string;
  empresa: { id: string | null; nome: string | null; dadosJuridicosCompletos: boolean; faltando: string[] };
  /** Por quem se fala com o cliente. Alimenta o elo com o Atendimento: sem
   *  telefone nem e-mail, a tela não oferece canal que não funciona. */
  contato: { leadId: string | null; nome: string | null; telefone: string | null; email: string | null } | null;
  /** Campos já preenchidos na Empresa, para o diálogo de dados jurídicos
   *  abrir preenchido em vez de pedir tudo de novo. */
  juridicos: {
    razaoSocial: string | null; cnpj: string | null; logradouro: string | null;
    numero: string | null; complemento: string | null; bairro: string | null;
    cidade: string | null; estado: string | null; cep: string | null;
  } | null;
  oportunidade: { id: string | null; titulo: string | null; familia: string | null; etapa: string | null };
  modoFechamento: string | null;
  validadeDias: number | null;
  dataValidade: string | null;
  tipoContratual: string | null;
  itens: Array<{ id: string; nome: string; tipo: string; natureza: string | null; quantidade: number; valorUnitario: number; desconto: number; subtotal: number }>;
  composicao: propostas.ComposicaoFinanceira;
  tracking: { enviadaEm: string | null; primeiraVisualizacao: string | null; aceitaEm: string | null; recusadaEm: string | null; ajusteEm: string | null; ajusteDescricao: string | null };
  timeline: LinhaDoTempo[];
}

export async function acaoDetalhe(propostaId: string): Promise<Resultado<DetalheProposta | null>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };

  return executar("carregar proposta", async () => {
    const [p] = await db.execute<{
      id: string; proposta_numero: number; versao: number; status: string;
      empresa_id: string | null; empresa: string | null; negocio_id: string | null;
      oportunidade: string | null; familia: string | null; etapa: string | null;
      modo: string | null; validade_dias: number | null; data_validade: string | null;
      tipo_contratual: string | null; enviada_em: string | null; primeira_vis: string | null;
      aceita_em: string | null; recusada_em: string | null;
      ajuste_em: string | null; ajuste_desc: string | null;
      lead_id: string | null; contato_nome: string | null;
      contato_telefone: string | null; contato_email: string | null;
      razao_social: string | null; cnpj: string | null; logradouro: string | null;
      endereco_numero: string | null; complemento: string | null; bairro: string | null;
      cidade: string | null; estado: string | null; cep: string | null;
    }>(sql`
      SELECT p.id::text, p.numero AS proposta_numero, p.versao, p.status,
             n.empresa_id::text, e.nome AS empresa, p.negocio_id::text,
             p.lead_id::text,
             NULLIF(trim(concat_ws(' ', l.nome, l.sobrenome)), '') AS contato_nome,
             COALESCE(l.whatsapp, l.telefone) AS contato_telefone, l.email AS contato_email,
             e.razao_social, e.cnpj, e.logradouro, e.numero AS endereco_numero, e.complemento,
             e.bairro, e.cidade, e.estado, e.cep,
             n.titulo AS oportunidade, COALESCE(p.service_family, n.service_family) AS familia, n.etapa,
             p.modo_fechamento AS modo, p.validade_dias, p.data_validade::text,
             p.tipo_contratual, p.enviada_em::text, p.primeira_visualizacao_em::text AS primeira_vis,
             p.aceita_em::text, p.recusada_em::text,
             p.ajuste_solicitado_em::text AS ajuste_em, p.ajuste_solicitado_descricao AS ajuste_desc
        FROM propostas p
        LEFT JOIN negocios n ON n.id = p.negocio_id
        LEFT JOIN empresas e ON e.id = n.empresa_id
        LEFT JOIN leads l ON l.id = p.lead_id
       WHERE p.id = ${propostaId}::uuid AND p.organizacao_id = ${ctx.organizacaoId}::uuid
    `);
    if (!p) return null;

    const itens = await db.execute<{
      id: string; nome: string; tipo: string; natureza: string | null;
      quantidade: string; valor_unitario: string; desconto: string; subtotal: string;
    }>(sql`
      SELECT id::text, nome, tipo, revenue_nature AS natureza, quantidade::text,
             valor_unitario::text, desconto::text, subtotal::text
        FROM proposta_itens WHERE proposta_id = ${propostaId}::uuid ORDER BY ordem
    `);

    const juridicos = p.empresa_id
      ? await propostas.conferirDadosJuridicos(ctx.organizacaoId, p.empresa_id)
      : { completo: false, faltando: ["Empresa não vinculada"] };

    return {
      id: p.id, numero: p.proposta_numero, versao: p.versao, status: p.status,
      empresa: {
        id: p.empresa_id, nome: p.empresa,
        dadosJuridicosCompletos: juridicos.completo, faltando: juridicos.faltando,
      },
      contato: p.lead_id ? {
        leadId: p.lead_id, nome: p.contato_nome,
        telefone: p.contato_telefone, email: p.contato_email,
      } : null,
      juridicos: p.empresa_id ? {
        razaoSocial: p.razao_social, cnpj: p.cnpj, logradouro: p.logradouro,
        numero: p.endereco_numero, complemento: p.complemento, bairro: p.bairro,
        cidade: p.cidade, estado: p.estado, cep: p.cep,
      } : null,
      oportunidade: { id: p.negocio_id, titulo: p.oportunidade, familia: p.familia, etapa: p.etapa },
      modoFechamento: p.modo,
      validadeDias: p.validade_dias,
      dataValidade: p.data_validade,
      tipoContratual: p.tipo_contratual,
      itens: itens.map((i) => ({
        id: i.id, nome: i.nome, tipo: i.tipo, natureza: i.natureza,
        quantidade: Number(i.quantidade), valorUnitario: Number(i.valor_unitario),
        desconto: Number(i.desconto), subtotal: Number(i.subtotal),
      })),
      composicao: await propostas.composicaoDaProposta(propostaId),
      tracking: {
        enviadaEm: p.enviada_em, primeiraVisualizacao: p.primeira_vis,
        aceitaEm: p.aceita_em, recusadaEm: p.recusada_em,
        ajusteEm: p.ajuste_em, ajusteDescricao: p.ajuste_desc,
      },
      timeline: await lerLinhaDoTempo({ organizacaoId: ctx.organizacaoId, limite: 30, negocioId: p.negocio_id ?? undefined }),
    };
  });
}

/** Catálogo filtrado pela família da oportunidade (Bloco 03 §2). */
export async function acaoCatalogo(familia: Familia): Promise<propostas.ItemCatalogo[]> {
  const ctx = await getTenantContext();
  if (!ctx) return [];
  return propostas.catalogoDaFamilia(ctx.organizacaoId, familia);
}

/** Oportunidades abertas que podem receber proposta. */
export async function acaoOportunidadesAbertas(termo: string): Promise<Array<{
  id: string; titulo: string; familia: string | null; empresa: string | null;
}>> {
  const ctx = await getTenantContext();
  if (!ctx) return [];
  const busca = termo.trim() ? `%${termo.trim().toLowerCase()}%` : null;
  const linhas = await db.execute<{ id: string; titulo: string; familia: string | null; empresa: string | null }>(sql`
    SELECT n.id::text, n.titulo, n.service_family AS familia, e.nome AS empresa
      FROM negocios n LEFT JOIN empresas e ON e.id = n.empresa_id
     WHERE n.organizacao_id = ${ctx.organizacaoId}::uuid
       AND n.etapa IN ('entrada','diagnostico','proposta','negociacao')
       AND (${busca}::text IS NULL OR lower(n.titulo) LIKE ${busca} OR lower(COALESCE(e.nome, '')) LIKE ${busca})
     ORDER BY n.etapa_desde DESC NULLS LAST LIMIT 20
  `);
  return linhas.map((l) => ({ id: l.id, titulo: l.titulo, familia: l.familia, empresa: l.empresa }));
}

/* ── Escrita ───────────────────────────────────────────────────────────── */

/**
 * Cria a proposta em rascunho, com os itens escolhidos.
 *
 * Reaproveita `criarPropostaComItens`, que já resolve preço oficial, família e
 * natureza a partir do catálogo — o cliente manda o id do preço, nunca o valor.
 */
export async function acaoCriar(entrada: {
  negocioId: string;
  itens: Array<{ catalogoPrecoId: string; nome: string; tipo: "recorrente" | "avulso" | "setup"; quantidade: number; valorUnitario: number; desconto: number }>;
  observacoes?: string | null;
  prazoContratoMeses?: number | null;
  parcelasSetup?: number | null;
}): Promise<Resultado<{ propostaId: string }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  if (entrada.itens.length === 0) return { ok: false, erro: "Escolha ao menos um item do catálogo." };

  return executar("criar proposta", async () => {
    const [negocio] = await db.execute<{ lead_id: string | null; familia: string | null; empresa_id: string | null }>(sql`
      SELECT lead_id::text, service_family AS familia, empresa_id::text FROM negocios
       WHERE id = ${entrada.negocioId}::uuid AND organizacao_id = ${ctx.organizacaoId}::uuid
    `);
    if (!negocio) throw new Error("oportunidade não encontrada");

    // `propostas.lead_id` é NOT NULL no schema legado. Quando a oportunidade
    // nasceu sem lead (criação manual ou outbound direto), é preciso um lead de
    // referência — usa-se o contato principal da empresa, que é a identidade
    // que a proposta realmente representa.
    let leadId = negocio.lead_id;
    if (!leadId && negocio.empresa_id) {
      const [contato] = await db.execute<{ id: string }>(sql`
        SELECT id::text FROM leads
         WHERE empresa_id = ${negocio.empresa_id}::uuid AND organizacao_id = ${ctx.organizacaoId}::uuid
         ORDER BY created_at LIMIT 1
      `);
      leadId = contato?.id ?? null;
    }
    if (!leadId) {
      throw new Error("a oportunidade não tem contato vinculado para receber a proposta");
    }

    const itens: ItemEntrada[] = entrada.itens.map((i, ordem) => ({
      catalogoPrecoId: i.catalogoPrecoId,
      nome: i.nome,
      tipo: i.tipo,
      quantidade: i.quantidade,
      valorUnitario: i.valorUnitario,
      desconto: i.desconto,
      descontoTipo: "percentual",
      ordem,
    }));

    const proposta = await criarPropostaComItens({
      organizacaoId: ctx.organizacaoId,
      leadId,
      negocioId: entrada.negocioId,
      moeda: "BRL",
      observacoes: entrada.observacoes ?? undefined,
      prazoContratoMeses: entrada.prazoContratoMeses ?? null,
      parcelas: entrada.parcelasSetup ?? 1,
      itens,
      criadoPorId: ctx.usuarioId,
    });

    await db.execute(sql`
      UPDATE propostas SET service_family = ${negocio.familia} WHERE id = ${proposta.id}::uuid
    `);

    await registrarEvento({
      organizacaoId: ctx.organizacaoId, tipo: "ProposalCreated", ator: ctx.ator,
      propostaId: proposta.id, negocioId: entrada.negocioId, leadId,
      contexto: { familia: negocio.familia, itens: itens.length },
      timeline: { tipo: "nota", titulo: `Proposta #${proposta.numero} criada` },
    });

    revalidatePath(ROTA);
    return { propostaId: proposta.id as string };
  });
}

export async function acaoEnviar(entrada: {
  propostaId: string;
  modoFechamento: ModoFechamento;
  validadeDias: number;
  tipoContratual?: TipoContratual | null;
  contratoBaseId?: string | null;
}): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("enviar proposta", async () => {
    await propostas.enviarProposta({
      organizacaoId: ctx.organizacaoId,
      propostaId: entrada.propostaId,
      modoFechamento: entrada.modoFechamento,
      validadeDias: entrada.validadeDias,
      tipoContratual: entrada.tipoContratual ?? null,
      contratoBaseId: entrada.contratoBaseId ?? null,
      ator: ctx.ator,
    });
    revalidatePath(ROTA);
    revalidatePath("/onface-preview/pipeline");
  });
}

export async function acaoCriarRevisao(propostaId: string): Promise<Resultado<{ propostaId: string; versao: number }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("criar revisão", async () => {
    const r = await propostas.criarRevisao({ organizacaoId: ctx.organizacaoId, propostaId, ator: ctx.ator });
    revalidatePath(ROTA);
    return r;
  });
}

export async function acaoExpirarVencidas(): Promise<Resultado<{ expiradas: number }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("expirar propostas vencidas", async () => {
    const expiradas = await propostas.expirarPropostasVencidas(ctx.organizacaoId);
    revalidatePath(ROTA);
    return { expiradas };
  });
}

/**
 * Grava os dados jurídicos da Empresa sem sair da Proposta.
 *
 * O gate `dados_juridicos_incompletos` bloqueia o envio aqui, então a ação que
 * o destrava tem de terminar aqui. Devolve o estado recalculado para a tela
 * saber, na mesma resposta, se o envio já está liberado.
 */
export async function acaoSalvarJuridicos(
  empresaId: string,
  dados: propostas.DadosJuridicos,
): Promise<Resultado<{ completo: boolean; faltando: string[] }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("salvar dados jurídicos", async () => {
    await propostas.salvarDadosJuridicos({
      organizacaoId: ctx.organizacaoId, empresaId, dados, ator: ctx.ator,
    });
    revalidatePath(ROTA);
    return propostas.conferirDadosJuridicos(ctx.organizacaoId, empresaId);
  });
}
