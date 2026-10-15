"use server";

import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/app-url";
import { getTenantContext } from "@/lib/auth/tenant";
import {
  atorHumano, ehFamiliaValida, RegraDeNegocio, type Familia, type ModoFechamento, type TipoContratual,
} from "@/lib/vendas/dominio";
import { executar, type Resultado } from "@/lib/vendas/resultado";
import * as propostas from "@/lib/vendas/propostas";
import { atualizarItensDoRascunho, criarPropostaComItens, resolverContatoDaProposta, resolverFamiliaDoNegocio, type ItemEntrada } from "@/lib/crm/proposta-criacao";
import { lerLinhaDoTempo, type LinhaDoTempo } from "@/lib/vendas/eventos";
import { modeloPdfValido, type ModeloPdf } from "@/lib/propostas/modelos-pdf";
import { gravarModeloPdf } from "@/lib/propostas/familia-proposta";
import { lerAlteracoesDaProposta } from "@/lib/vendas/auditoria-comercial-registro";
import type { RegistroDeAlteracao } from "@/lib/vendas/auditoria-comercial";
import { atualizarEntregaDaOrigem, entregasDaOrigem } from "@/lib/email/entrega";
import { avisarClienteDaPropostaEnviada, type ResultadoEmail, type ResultadoWhatsapp, type ViaEmail } from "@/lib/crm/enviar-proposta";

const ROTA = "/propostas";

async function contexto() {
  const ctx = await getTenantContext();
  if (!ctx) return null;
  return { organizacaoId: ctx.organizacaoId, usuarioId: ctx.userId, usuarioNome: ctx.userName ?? null, ator: atorHumano(ctx.userId) };
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
  empresaId: string | null;
  /** Etapa REAL da oportunidade: a lista não pode tratar toda proposta como de oportunidade aberta. */
  etapa: string | null;
  familia: string | null;
  modoFechamento: string | null;
  total: number | null;
  totalRecorrente: number | null;
  enviadaEm: string | null;
  /** Última atualização real (propostas.updated_at): coluna Atualização da lista. */
  atualizadaEm: string | null;
  validade: string | null;
  /** Prazo real em dias (data_validade - envio); null quando a proposta não tem validade gravada. */
  validadeDias: number | null;
  /** Instantes reais do banco para a linha do tempo; nunca inventados. */
  eventosEm: { visualizada: string | null; ajuste: string | null; aceita: string | null; recusada: string | null; expirada: string | null };
  ajusteSolicitado: string | null;
  /** Quem responde pela oportunidade. A lista filtra por responsável. */
  responsavel: string | null;
  /** O contato da conversa — o que a linha mostra embaixo da empresa. */
  pessoa: string | null;
  /** Aceita, mas o contrato/pagamento falhou e ninguém destravou: é a mesma pendência que o detalhe mostra em "Reprocessar aceite". */
  fechamentoParado: boolean;
}

const LIMITE_LISTA_PROPOSTAS = 5000;

export async function acaoListar(filtros: { status?: string | null; busca?: string | null } = {}): Promise<LinhaProposta[]> {
  const ctx = await getTenantContext();
  if (!ctx) return [];
  const busca = filtros.busca?.trim() ? `%${filtros.busca.trim().toLowerCase()}%` : null;

  const linhas = await db.execute<{
    id: string; numero: number; versao: number; status: string;
    empresa: string | null; oportunidade: string | null; negocio_id: string | null;
    familia: string | null; modo: string | null; total: string | null;
    total_recorrente: string | null; enviada_em: string | null; atualizada_em: string | null;
    validade: string | null; ajuste: string | null;
    validade_dias: number | null;
    vis_em: string | null; ajuste_em: string | null; aceita_em: string | null; recusada_em: string | null; expirada_em: string | null;
    responsavel: string | null; pessoa: string | null; empresa_id: string | null; etapa: string | null;
    fechamento_parado: boolean;
  }>(sql`
    SELECT p.id::text, p.numero, p.versao, p.status, n.empresa_id::text AS empresa_id, n.etapa,
           COALESCE(e.nome, l.empresa) AS empresa, n.titulo AS oportunidade, p.negocio_id::text,
           -- Cadeia de familia: proposta, negocio, oportunidade canonica.
           --
           -- 1.548 das 1.550 propostas nao tem familia propria nem no negocio,
           -- e em 467 delas a oportunidade canonica SABE qual e, deduzida no
           -- backfill. A tela mostrava vazio para proposta de produto conhecido.
           --
           -- A ordem e do mais especifico para o mais geral: o que foi decidido
           -- na proposta manda, depois o que foi decidido no negocio, e a
           -- deducao entra so quando ninguem decidiu.
           COALESCE(p.service_family, n.service_family, o.service_family) AS familia,
           p.modo_fechamento AS modo,
           -- O valor vem das LINHAS, a mesma conta do detalhe e do 360; o total gravado na proposta
           -- só vale quando ela não tem linha (7 aceitas importadas tinham os dois diferentes).
           COALESCE(it.total, p.total_geral)::text AS total, COALESCE(it.recorrente, p.total_recorrente)::text AS total_recorrente,
           p.enviada_em::text, p.updated_at::text AS atualizada_em, p.data_validade::text AS validade,
           p.ajuste_solicitado_descricao AS ajuste,
           (p.data_validade - p.enviada_em::date)::int AS validade_dias,
           p.primeira_visualizacao_em::text AS vis_em, p.ajuste_solicitado_em::text AS ajuste_em,
           COALESCE(p.aceita_em, CASE WHEN p.status = 'aceita' THEN p.cliente_respondeu_em END)::text AS aceita_em,
           p.recusada_em::text, p.expirada_em::text,
           -- O responsável e o contato: a lista filtra por um e mostra o outro,
           -- e sem eles o filtro de responsável vinha vazio na tela.
           COALESCE(u.nome, uo.nome) AS responsavel,
           -- O contato vem do LEAD: a tabela negocios não tem pessoa_id, e o
           -- lead é quem guarda com quem a conversa começou.
           l.nome AS pessoa,
           -- Aceite que parou com erro registrado (mesmo critério de lerPendenciasDoAceite): não pode esperar alguém perguntar.
           (p.status = 'aceita' AND EXISTS (
              SELECT 1 FROM proposta_grupo_comercial g
               WHERE g.proposta_id = p.id AND g.contrato_assinado_em IS NULL AND g.checkout_id IS NULL
                 AND g.fechamento_erro IS NOT NULL AND g.status <> 'aguardando_validacao_manual')) AS fechamento_parado
      FROM propostas p
      LEFT JOIN negocios n ON n.id = p.negocio_id
      LEFT JOIN empresas e ON e.id = n.empresa_id
      LEFT JOIN leads l ON l.id = COALESCE(p.lead_id, n.lead_id)
      LEFT JOIN usuarios u ON u.id = n.responsavel_id
      LEFT JOIN oportunidades o ON o.negocio_id_legado = n.id
      LEFT JOIN usuarios uo ON uo.id = o.responsavel_id
      LEFT JOIN LATERAL (
        SELECT sum(i.subtotal) AS total, COALESCE(sum(i.subtotal) FILTER (WHERE i.tipo = 'recorrente'), 0) AS recorrente
          FROM proposta_itens i WHERE i.proposta_id = p.id HAVING count(*) > 0
      ) it ON TRUE
     WHERE p.organizacao_id = ${ctx.organizacaoId}::uuid
       AND (${filtros.status ?? null}::text IS NULL OR p.status = ${filtros.status ?? null})
       AND (${busca}::text IS NULL OR lower(COALESCE(e.nome, l.empresa, '')) LIKE ${busca}
            OR lower(COALESCE(n.titulo, '')) LIKE ${busca} OR p.numero::text LIKE ${busca})
     ORDER BY p.created_at DESC
     LIMIT ${LIMITE_LISTA_PROPOSTAS}
  `);
  // LIMIT 200 cortava 1.550 propostas e a tela contava 200 como se fosse tudo
  // (e o filtro por status só enxergava os 200 mais novos). A lista é leve, então
  // o teto sobe acima do universo; passar dele é aviso, não corte silencioso.
  // ponytail: sem paginação; vira paginação por cursor se passar de ~5 mil propostas.
  if (linhas.length >= LIMITE_LISTA_PROPOSTAS) console.warn(`[propostas] lista cortada em ${LIMITE_LISTA_PROPOSTAS}`);

  return linhas.map((l) => ({
    id: l.id, numero: l.numero, versao: l.versao, status: l.status,
    empresa: l.empresa, oportunidade: l.oportunidade, negocioId: l.negocio_id,
    empresaId: l.empresa_id, etapa: l.etapa,
    familia: l.familia, modoFechamento: l.modo,
    total: l.total === null ? null : Number(l.total),
    totalRecorrente: l.total_recorrente === null ? null : Number(l.total_recorrente),
    enviadaEm: l.enviada_em, atualizadaEm: l.atualizada_em, validade: l.validade, ajusteSolicitado: l.ajuste,
    validadeDias: l.validade_dias,
    eventosEm: { visualizada: l.vis_em, ajuste: l.ajuste_em, aceita: l.aceita_em, recusada: l.recusada_em, expirada: l.expirada_em },
    responsavel: l.responsavel, pessoa: l.pessoa, fechamentoParado: l.fechamento_parado === true,
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
  /** Qual dos modelos de PDF esta proposta usa. `padrao` é o de sempre (coluna NULL). */
  modeloPdf: ModeloPdf;
  itens: Array<{ id: string; nome: string; tipo: string; natureza: string | null; quantidade: number; valorUnitario: number; desconto: number; subtotal: number }>;
  composicao: propostas.ComposicaoFinanceira;
  tracking: { enviadaEm: string | null; primeiraVisualizacao: string | null; aceitaEm: string | null; recusadaEm: string | null; ajusteEm: string | null; ajusteDescricao: string | null };
  /** Contratos que o aceite gerou (um por grupo comercial que exige). Vazio antes do aceite. */
  contratos: Array<{
    id: string; documento: string; assinaturaStatus: string; signatureStatus: string | null;
    assinadoEm: string | null; signatarios: string[]; pdfFinalDisponivel: boolean;
  }>;
  timeline: LinhaDoTempo[];
  /** E-mails desta proposta e dos contratos dela, com o estado de entrega DO PROVEDOR (não o "enviado" presumido). */
  entregas: Array<{
    id: string; para: string; assunto: string; via: "conta" | "resend"; de: string;
    estado: string; detalhe: string | null; texto: string; falhou: boolean; enviadoEm: string;
  }>;
  /** Grupos aceitos cujo próximo passo (contrato ou pagamento) não andou. Vazio = nada parado. */
  pendenciasDoAceite: Array<{ grupoId: string; passo: "contrato" | "pagamento"; erro: string | null; tentativas: number; ultimaTentativaEm: string | null }>;
  /** Auditoria comercial desta proposta: quem mudou o quê (de → para), quando e por quê. */
  alteracoes: RegistroDeAlteracao[];
  /** Onde o cliente paga esta venda. O vendedor precisa ver (e copiar) o mesmo link que o cliente. */
  linksDePagamento: Array<{ grupoId: string; url: string; tipo: "checkout" | "fatura"; pago: boolean }>;
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
      modelo_pdf: string | null;
    }>(sql`
      SELECT p.id::text, p.numero AS proposta_numero, p.versao, p.status,
             n.empresa_id::text, e.nome AS empresa, p.negocio_id::text,
             p.lead_id::text,
             NULLIF(trim((CASE WHEN COALESCE(trim(l.sobrenome),'')='' THEN trim(l.nome) WHEN lower(trim(l.sobrenome))=lower(trim(l.nome)) OR lower(trim(l.sobrenome)) LIKE lower(trim(l.nome))||' %' THEN trim(l.sobrenome) WHEN lower(trim(l.nome)) LIKE '% '||lower(trim(l.sobrenome)) THEN trim(l.nome) ELSE trim(l.nome)||' '||trim(l.sobrenome) END)), '') AS contato_nome,
             COALESCE(l.whatsapp, l.telefone) AS contato_telefone, l.email AS contato_email,
             e.razao_social, e.cnpj, e.logradouro, e.numero AS endereco_numero, e.complemento,
             e.bairro, e.cidade, e.estado, e.cep,
             n.titulo AS oportunidade,
             COALESCE(p.service_family, n.service_family, o.service_family) AS familia, n.etapa,
             p.modo_fechamento AS modo, p.validade_dias, p.data_validade::text,
             p.tipo_contratual, p.enviada_em::text, p.primeira_visualizacao_em::text AS primeira_vis,
             p.aceita_em::text, p.recusada_em::text,
             p.ajuste_solicitado_em::text AS ajuste_em, p.ajuste_solicitado_descricao AS ajuste_desc,
             p.modelo_pdf
        FROM propostas p
        LEFT JOIN negocios n ON n.id = p.negocio_id
        LEFT JOIN empresas e ON e.id = n.empresa_id
        LEFT JOIN leads l ON l.id = p.lead_id
        LEFT JOIN oportunidades o ON o.negocio_id_legado = n.id
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
      modeloPdf: modeloPdfValido(p.modelo_pdf) ?? "padrao",
      itens: itens.map((i) => ({
        id: i.id, nome: i.nome, tipo: i.tipo, natureza: i.natureza,
        quantidade: Number(i.quantidade), valorUnitario: Number(i.valor_unitario),
        desconto: Number(i.desconto), subtotal: Number(i.subtotal),
      })),
      composicao: await propostas.composicaoDaProposta(propostaId),
      contratos: (await db.execute<{
        id: string; descricao: string | null; assinatura_status: string; signature_status: string | null;
        assinado_em: string | null; signatarios: unknown; assinado: boolean;
      }>(sql`
        SELECT c.id::text, c.descricao, c.assinatura_status, c.signature_status, c.assinado_em::text, c.signatarios,
               (c.assinatura_status = 'assinado' AND c.signature_provider_ref IS NOT NULL) AS assinado
          FROM contratos c
          JOIN proposta_grupo_comercial g ON g.contrato_id = c.id
         WHERE g.proposta_id = ${propostaId}::uuid
         ORDER BY c.created_at
      `)).map((c) => ({
        id: c.id,
        documento: /aditivo/i.test(c.descricao ?? "") ? "Termo aditivo" : /renova/i.test(c.descricao ?? "") ? "Contrato de renovação" : "Contrato",
        assinaturaStatus: c.assinatura_status, signatureStatus: c.signature_status, assinadoEm: c.assinado_em,
        signatarios: (Array.isArray(c.signatarios) ? c.signatarios : [])
          .map((x) => (x && typeof x === "object" ? String((x as Record<string, unknown>).name ?? (x as Record<string, unknown>).nome ?? "") : ""))
          .filter(Boolean),
        pdfFinalDisponivel: c.assinado,
      })),
      tracking: {
        enviadaEm: p.enviada_em, primeiraVisualizacao: p.primeira_vis,
        aceitaEm: p.aceita_em, recusadaEm: p.recusada_em,
        ajusteEm: p.ajuste_em, ajusteDescricao: p.ajuste_desc,
      },
      timeline: await lerLinhaDoTempo({ organizacaoId: ctx.organizacaoId, limite: 30, negocioId: p.negocio_id ?? undefined }),
      entregas: await lerEntregasDaProposta(ctx.organizacaoId, propostaId, p.negocio_id),
      pendenciasDoAceite: p.status === "aceita" ? await lerPendenciasDoAceite(ctx.organizacaoId, propostaId) : [],
      linksDePagamento: await lerLinksDePagamento(ctx.organizacaoId, propostaId),
      alteracoes: await lerAlteracoesDaProposta(ctx.organizacaoId, propostaId),
    };
  });
}

/**
 * Entrega dos e-mails da proposta e dos contratos dela. Sem webhook do Resend, o estado é CONSULTADO aqui,
 * na leitura da ficha (no máximo uma consulta por e-mail a cada 60 s). Falha de consulta não promove nada a "entregue".
 */
async function lerEntregasDaProposta(organizacaoId: string, propostaId: string, negocioId: string | null): Promise<DetalheProposta["entregas"]> {
  const contratoIds = (await db.execute<{ id: string }>(sql`
    SELECT c.id::text FROM contratos c JOIN proposta_grupo_comercial g ON g.contrato_id = c.id
     WHERE g.proposta_id = ${propostaId}::uuid AND g.organizacao_id = ${organizacaoId}::uuid`)).map((c) => c.id);
  const origens = [{ tipo: "proposta" as const, id: propostaId, rotulo: "da proposta" }, ...contratoIds.map((id) => ({ tipo: "contrato" as const, id, rotulo: "do contrato" }))];
  for (const o of origens) {
    await atualizarEntregaDaOrigem(organizacaoId, { tipo: o.tipo, id: o.id }, { negocioId, rotulo: o.rotulo });
  }
  const todas = (await Promise.all(origens.map((o) => entregasDaOrigem(organizacaoId, { tipo: o.tipo, id: o.id })))).flat();
  return todas.sort((a, b) => b.enviadoEm.localeCompare(a.enviadoEm));
}

/**
 * O link onde o cliente paga, para o vendedor ver e reenviar.
 *
 * Duas formas, porque são duas vendas diferentes: cliente novo paga por
 * CHECKOUT (a ponte `/checkout/{id}`); quem já tem assinatura paga a FATURA do
 * pró-rata que o Stripe emite ao somar os itens — e esse link fica guardado na
 * evidência da expansão, que é onde a venda registrou que cobrou.
 *
 * Sem isto o vendedor via "aceita" e não tinha o que mandar para o cliente que
 * fechou a compra.
 */
async function lerLinksDePagamento(organizacaoId: string, propostaId: string): Promise<DetalheProposta["linksDePagamento"]> {
  const base = appUrl();
  const doCheckout = await db.execute<{ grupo: string; id: string; status: string }>(sql`
    SELECT g.id::text AS grupo, c.id::text AS id, c.status
      FROM proposta_grupo_comercial g
      JOIN checkouts c ON c.id = g.checkout_id
     WHERE g.proposta_id = ${propostaId}::uuid AND g.organizacao_id = ${organizacaoId}::uuid`);

  const daExpansao = await db.execute<{ grupo: string; url: string | null }>(sql`
    SELECT ev.grupo_comercial_id::text AS grupo, ev.metadata->>'faturaUrl' AS url
      FROM comercial_evidencia ev
     WHERE ev.organizacao_id = ${organizacaoId}::uuid
       AND ev.source_ref LIKE 'expansao:%'
       AND ev.metadata->>'faturaUrl' IS NOT NULL
       AND ev.grupo_comercial_id IN (SELECT id FROM proposta_grupo_comercial WHERE proposta_id = ${propostaId}::uuid)`);

  return [
    ...doCheckout.map((c) => ({ grupoId: c.grupo, url: `${base}/checkout/${c.id}`, tipo: "checkout" as const, pago: c.status === "pago" })),
    ...daExpansao.filter((e) => e.url).map((e) => ({ grupoId: e.grupo, url: e.url as string, tipo: "fatura" as const, pago: false })),
  ];
}

async function lerPendenciasDoAceite(organizacaoId: string, propostaId: string): Promise<DetalheProposta["pendenciasDoAceite"]> {
  const linhas = await db.execute<{ id: string; caminho: string | null; modelo: string; erro: string | null; tentativas: number; ultima: string | null }>(sql`
    SELECT g.id::text, g.caminho_fechamento AS caminho, g.commercial_model AS modelo, g.fechamento_erro AS erro,
           g.fechamento_tentativas AS tentativas, g.fechamento_ultima_tentativa_em::text AS ultima
      FROM proposta_grupo_comercial g
     WHERE g.proposta_id = ${propostaId}::uuid AND g.organizacao_id = ${organizacaoId}::uuid
       AND g.contrato_assinado_em IS NULL AND g.checkout_id IS NULL
       AND (g.fechamento_erro IS NOT NULL OR g.status IN ('aguardando_contrato', 'aguardando_checkout'))
       AND g.status <> 'aguardando_validacao_manual'`);
  return linhas.map((g) => ({
    grupoId: g.id, passo: g.caminho === "pagamento" || (!g.caminho && g.modelo === "PAGAMENTO_DIRETO") ? "pagamento" : "contrato",
    erro: g.erro, tentativas: g.tentativas, ultimaTentativaEm: g.ultima,
  }));
}

/**
 * Reprocessa o aceite de uma proposta aceita: tenta de novo o contrato ou o pagamento que não andou.
 * Seguro de repetir: não aceita de novo, não gera segundo contrato, não reenvia o que já foi enviado nem cria
 * outra cobrança (ver `retomada-aceite.ts`). Nunca marca Ganho.
 */
export async function acaoReprocessarAceite(propostaId: string): Promise<Resultado<{ resultado: "andou" | "ainda_parado" | "nada_a_fazer"; detalhes: string[] }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("reprocessar aceite da proposta", async () => {
    const { processarAceiteDaProposta } = await import("@/lib/crm/proposta-aceite");
    const r = await processarAceiteDaProposta({ propostaId, organizacaoId: ctx.organizacaoId, origem: "manual", retomar: true });
    if (!r.ok) throw new RegraDeNegocio("reprocessar_recusado", r.error);
    revalidatePath(ROTA);
    const falhas = r.grupos.filter((g) => g.erro);
    const andando = r.grupos.filter((g) => g.emAndamento);
    const detalhes = [
      ...falhas.map((g) => `${g.serviceFamily ?? g.commercialModel}: ${g.erro}`),
      ...andando.map(() => "Outra tentativa já está em andamento para este item; aguarde alguns minutos."),
    ];
    return { resultado: falhas.length ? "ainda_parado" as const : andando.length ? "nada_a_fazer" as const : "andou" as const, detalhes };
  });
}

/** Catálogo filtrado pela família da oportunidade (Bloco 03 §2). */
/**
 * Escolhe o modelo de PDF desta proposta. É o que o cliente recebe no e-mail e baixa
 * na página pública, então muda o documento: `padrao` volta ao PDF de sempre.
 */
export async function acaoSalvarModeloPdf(propostaId: string, modelo: string): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  const m = modeloPdfValido(modelo);
  if (!m) return { ok: false, erro: "Modelo de PDF desconhecido." };
  return executar("escolher o modelo do PDF", async () => {
    await gravarModeloPdf(propostaId, ctx.organizacaoId, m);
    revalidatePath("/propostas");
    revalidatePath(`/propostas/${propostaId}`);
  });
}

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
    SELECT n.id::text, n.titulo,
           COALESCE(n.service_family, o.service_family) AS familia, e.nome AS empresa
      FROM negocios n
      LEFT JOIN empresas e ON e.id = n.empresa_id
      LEFT JOIN oportunidades o ON o.negocio_id_legado = n.id
     WHERE n.organizacao_id = ${ctx.organizacaoId}::uuid
       AND n.etapa IN ('entrada','diagnostico','proposta','negociacao')
       AND (${busca}::text IS NULL OR lower(n.titulo) LIKE ${busca} OR lower(COALESCE(e.nome, '')) LIKE ${busca})
     ORDER BY n.etapa_desde DESC NULLS LAST LIMIT 20
  `);
  return linhas.map((l) => ({ id: l.id, titulo: l.titulo, familia: l.familia, empresa: l.empresa }));
}

/**
 * O que o assistente "Nova proposta" oferece, vindo do banco.
 *
 * Carrega sob demanda (quando o assistente abre): são oportunidades abertas,
 * a carteira de clientes e a base de empresas e contatos. O assistente antigo
 * lia isto de um store local e mostrava "0 clientes".
 */
export interface BaseNovaProposta {
  equipe: Array<{ id: string; nome: string }>;
  /** Oportunidades abertas, com as propostas vivas dentro. */
  abertas: Array<{
    negocioId: string; empresaId: string | null; empresa: string; pessoa: string; familia: string | null;
    etapa: string; responsavel: string | null;
    propostas: Array<{ id: string; numero: number; versao: number; status: string }>;
  }>;
  /** A carteira: empresas que já são clientes (tabela `clientes`). */
  clientes: Array<{ empresaId: string; empresa: string; pessoa: string; familia: string | null }>;
  /** Contatos da base, uma linha por pessoa; empresa sem contato vem com pessoa null. */
  contatos: Array<{ empresaId: string; empresa: string; pessoaId: string | null; leadId: string | null; pessoa: string | null; cargo: string | null; email: string | null }>;
}

export async function acaoBaseNovaProposta(): Promise<BaseNovaProposta> {
  const ctx = await getTenantContext();
  const vazio: BaseNovaProposta = { equipe: [], abertas: [], clientes: [], contatos: [] };
  if (!ctx) return vazio;
  const org = ctx.organizacaoId;

  const [equipe, abertas, vivas, clientes, contatos] = await Promise.all([
    db.execute<{ id: string; nome: string }>(sql`
      SELECT id::text, nome FROM usuarios WHERE organizacao_id = ${org}::uuid AND ativo = true ORDER BY nome`),
    db.execute<{ id: string; empresa_id: string | null; empresa: string | null; pessoa: string | null; familia: string | null; etapa: string; resp: string | null }>(sql`
      SELECT n.id::text, n.empresa_id::text, COALESCE(e.nome, l.empresa) AS empresa,
             NULLIF(trim((CASE WHEN COALESCE(trim(l.sobrenome),'')='' THEN trim(l.nome) WHEN lower(trim(l.sobrenome))=lower(trim(l.nome)) OR lower(trim(l.sobrenome)) LIKE lower(trim(l.nome))||' %' THEN trim(l.sobrenome) WHEN lower(trim(l.nome)) LIKE '% '||lower(trim(l.sobrenome)) THEN trim(l.nome) ELSE trim(l.nome)||' '||trim(l.sobrenome) END)), '') AS pessoa,
             COALESCE(n.service_family, o.service_family) AS familia, n.etapa, u.nome AS resp
        FROM negocios n
        LEFT JOIN empresas e ON e.id = n.empresa_id
        LEFT JOIN leads l ON l.id = n.lead_id
        LEFT JOIN usuarios u ON u.id = n.responsavel_id
        LEFT JOIN oportunidades o ON o.negocio_id_legado = n.id
       WHERE n.organizacao_id = ${org}::uuid AND n.etapa IN ('entrada','diagnostico','proposta','negociacao')
       ORDER BY n.etapa_desde DESC NULLS LAST LIMIT 1000`),
    db.execute<{ id: string; negocio_id: string; numero: number; versao: number; status: string }>(sql`
      SELECT p.id::text, p.negocio_id::text, p.numero, p.versao, p.status FROM propostas p
        JOIN negocios n ON n.id = p.negocio_id
       WHERE p.organizacao_id = ${org}::uuid AND n.etapa IN ('entrada','diagnostico','proposta','negociacao')
         AND p.status IN ('rascunho','enviada','visualizada','ajuste_solicitado')`),
    db.execute<{ empresa_id: string; empresa: string; pessoa: string | null; familia: string | null }>(sql`
      SELECT c.empresa_id::text, e.nome AS empresa,
             NULLIF(trim((CASE WHEN COALESCE(trim(p.sobrenome),'')='' THEN trim(p.nome) WHEN lower(trim(p.sobrenome))=lower(trim(p.nome)) OR lower(trim(p.sobrenome)) LIKE lower(trim(p.nome))||' %' THEN trim(p.sobrenome) WHEN lower(trim(p.nome)) LIKE '% '||lower(trim(p.sobrenome)) THEN trim(p.nome) ELSE trim(p.nome)||' '||trim(p.sobrenome) END)), '') AS pessoa,
             (SELECT COALESCE(n.service_family, o.service_family) FROM negocios n
                LEFT JOIN oportunidades o ON o.negocio_id_legado = n.id
               WHERE n.empresa_id = c.empresa_id AND n.etapa = 'ganho'
               ORDER BY n.updated_at DESC LIMIT 1) AS familia
        FROM clientes c
        JOIN empresas e ON e.id = c.empresa_id
        LEFT JOIN pessoas p ON p.id = c.pessoa_principal_id
       WHERE c.organizacao_id = ${org}::uuid ORDER BY e.nome`),
    db.execute<{ empresa_id: string; empresa: string; pessoa_id: string | null; lead_id: string | null; pessoa: string | null; cargo: string | null; email: string | null }>(sql`
      SELECT e.id::text AS empresa_id, e.nome AS empresa, p.id::text AS pessoa_id, p.lead_id_legado::text AS lead_id,
             NULLIF(trim((CASE WHEN COALESCE(trim(p.sobrenome),'')='' THEN trim(p.nome) WHEN lower(trim(p.sobrenome))=lower(trim(p.nome)) OR lower(trim(p.sobrenome)) LIKE lower(trim(p.nome))||' %' THEN trim(p.sobrenome) WHEN lower(trim(p.nome)) LIKE '% '||lower(trim(p.sobrenome)) THEN trim(p.nome) ELSE trim(p.nome)||' '||trim(p.sobrenome) END)), '') AS pessoa, p.cargo, p.email
        FROM empresas e LEFT JOIN pessoas p ON p.empresa_id = e.id
       WHERE e.organizacao_id = ${org}::uuid AND e.nome IS NOT NULL AND trim(e.nome) <> ''
       ORDER BY e.nome, p.nome`),
  ]);

  const propsPorNegocio = new Map<string, BaseNovaProposta["abertas"][number]["propostas"]>();
  for (const v of vivas) {
    const l = propsPorNegocio.get(v.negocio_id) ?? [];
    l.push({ id: v.id, numero: v.numero, versao: v.versao, status: v.status });
    propsPorNegocio.set(v.negocio_id, l);
  }

  return {
    equipe,
    abertas: abertas.map((o) => ({
      negocioId: o.id, empresaId: o.empresa_id, empresa: o.empresa?.trim() || "Empresa não informada",
      pessoa: o.pessoa ?? "", familia: o.familia, etapa: o.etapa, responsavel: o.resp,
      propostas: (propsPorNegocio.get(o.id) ?? []).sort((a, b) => a.versao - b.versao),
    })),
    clientes: clientes.map((c) => ({ empresaId: c.empresa_id, empresa: c.empresa, pessoa: c.pessoa ?? "", familia: c.familia })),
    contatos: contatos.map((c) => ({
      empresaId: c.empresa_id, empresa: c.empresa, pessoaId: c.pessoa_id, leadId: c.lead_id,
      pessoa: c.pessoa, cargo: c.cargo, email: c.email,
    })),
  };
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
  /** Contato que recebe a proposta, quando a oportunidade não tem um definido. */
  leadId?: string | null;
  itens: Array<{ catalogoPrecoId: string; nome: string; descricao?: string | null; tipo: "recorrente" | "avulso" | "setup"; quantidade: number; valorUnitario: number; desconto: number }>;
  observacoes?: string | null;
  prazoContratoMeses?: number | null;
  parcelasSetup?: number | null;
  /** Quem assina, dos dois lados, e o estado do editor: ver `salvarEditorDaProposta`. */
  signatarios?: unknown;
  editor?: unknown;
}): Promise<Resultado<{ propostaId: string }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  if (entrada.itens.length === 0) return { ok: false, erro: "Escolha ao menos um item do catálogo." };

  return executar("criar proposta", async () => {
    // Mesma resolução do núcleo e da edição: contato da oportunidade ou o escolhido (da mesma empresa).
    const leadId = await resolverContatoDaProposta({ organizacaoId: ctx.organizacaoId, negocioId: entrada.negocioId, leadId: entrada.leadId });
    // Mesma resolução de família do núcleo e da edição (negócio, depois oportunidade canônica).
    const { familia } = await resolverFamiliaDoNegocio(ctx.organizacaoId, entrada.negocioId);

    const itens: ItemEntrada[] = entrada.itens.map((i, ordem) => ({
      catalogoPrecoId: i.catalogoPrecoId,
      nome: i.nome,
      // Vazia, o núcleo grava a descrição do catálogo (comercial do ONFACE, senão a do Stripe).
      descricao: i.descricao ?? null,
      tipo: i.tipo,
      quantidade: i.quantidade,
      valorUnitario: i.valorUnitario,
      desconto: i.desconto,
      // O desconto que chega aqui é em REAIS (total do item): `itensParaCriar`
      // já converte o % do desenho em valor. Gravar como "percentual" lia R$ 100
      // de desconto como 100% e zerava o item (e R$ 50 virava 50% de desconto).
      descontoTipo: "valor",
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
      UPDATE propostas SET service_family = ${familia} WHERE id = ${proposta.id}::uuid
    `);
    if (entrada.signatarios !== undefined || entrada.editor !== undefined) {
      await propostas.salvarEditorDaProposta({
        organizacaoId: ctx.organizacaoId, propostaId: proposta.id, signatarios: entrada.signatarios, editor: entrada.editor,
      });
    }

    // ProposalCreated (com os itens, preços e descontos) é gravado pelo núcleo, na mesma transação da proposta.

    revalidatePath(ROTA);
    return { propostaId: proposta.id as string };
  });
}

/**
 * Edita o rascunho: os itens, as observações e as condições.
 *
 * O builder abre o rascunho com as linhas dele (antes abria vazio e "salvar"
 * criava OUTRA proposta). Linha de proposta legada, sem preço no catálogo,
 * volta com `itemExistenteId` e é mantida; linha nova exige preço do catálogo.
 */
export async function acaoAtualizarRascunho(entrada: {
  propostaId: string;
  itens: Array<{
    catalogoPrecoId?: string | null; itemExistenteId?: string | null; nome: string; descricao?: string | null;
    tipo: "recorrente" | "avulso" | "setup"; quantidade: number; valorUnitario: number; desconto: number;
  }>;
  observacoes?: string | null;
  prazoContratoMeses?: number | null;
  parcelasSetup?: number | null;
  signatarios?: unknown;
  editor?: unknown;
  /** Contato que recebe a proposta (da mesma empresa). Ausente = mantém o atual. */
  leadId?: string | null;
  /** Motivo opcional da alteração: vai no registro de auditoria. */
  motivo?: string | null;
}): Promise<Resultado<{ propostaId: string }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  if (entrada.itens.length === 0) return { ok: false, erro: "A proposta precisa de pelo menos um item." };

  return executar("editar rascunho da proposta", async () => {
    // Catálogo, família, moeda, contato e conta são validados no núcleo; a auditoria (de → para) sai de lá, na mesma transação.

    await atualizarItensDoRascunho({
      organizacaoId: ctx.organizacaoId,
      propostaId: entrada.propostaId,
      ator: ctx.ator,
      motivo: entrada.motivo,
      leadId: entrada.leadId,
      itens: entrada.itens.map((i, ordem) => ({
        catalogoPrecoId: i.catalogoPrecoId ?? null, itemExistenteId: i.itemExistenteId ?? null,
        nome: i.nome, descricao: i.descricao ?? null, tipo: i.tipo, quantidade: i.quantidade, valorUnitario: i.valorUnitario,
        // Em REAIS (total do item), como em `acaoCriar`.
        desconto: i.desconto, descontoTipo: "valor", ordem,
      })),
      // Sem o campo = mantém; null = limpa (a tela manda o formulário inteiro).
      observacoes: entrada.observacoes,
      prazoContratoMeses: entrada.prazoContratoMeses,
      parcelas: entrada.parcelasSetup,
    });

    if (entrada.signatarios !== undefined || entrada.editor !== undefined) {
      await propostas.salvarEditorDaProposta({
        organizacaoId: ctx.organizacaoId, propostaId: entrada.propostaId, signatarios: entrada.signatarios, editor: entrada.editor,
      });
    }

    revalidatePath(ROTA);
    revalidatePath("/pipeline");
    return { propostaId: entrada.propostaId };
  });
}

/** O que REALMENTE saiu no envio: a tela e o registro dizem isto, não o que estava marcado. */
export interface AvisoDoEnvio {
  link: string;
  email: ResultadoEmail;
  destinatario: string | null;
  /** "conta" = caixa de quem enviou; "resend" = e-mail do sistema (sem caixa conectada). */
  emailVia: ViaEmail | null;
  emailDe: string | null;
  avisoEmail: string | null;
  whatsapp: ResultadoWhatsapp;
  whatsappErro: string | null;
}

export async function acaoEnviar(entrada: {
  propostaId: string;
  modoFechamento: ModoFechamento;
  validadeDias: number;
  tipoContratual?: TipoContratual | null;
  contratoBaseId?: string | null;
  /** Escolha explícita do vendedor: true manda e-mail, false é só o link (nada sai). */
  enviarEmail: boolean;
  /** E-mail escolhido no fluxo; só vale com `enviarEmail`. Vazio = e-mail do contato. */
  destinatarioEmail?: string | null;
  /** Escolha explícita, como o e-mail: sai pelo número de WhatsApp de QUEM clica em enviar. */
  enviarWhatsapp?: boolean;
  telefoneWhatsapp?: string | null;
  mensagemWhatsapp?: string | null;
}): Promise<Resultado<AvisoDoEnvio>> {
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
    // O envio já aconteceu (status, validade, evento). Agora o link chega ao cliente.
    const aviso = await avisarClienteDaPropostaEnviada({
      propostaId: entrada.propostaId, organizacaoId: ctx.organizacaoId, userId: ctx.usuarioId,
      userName: ctx.usuarioNome,
      enviarEmail: entrada.enviarEmail === true, destinatarioEmail: entrada.destinatarioEmail ?? null,
      enviarWhatsapp: entrada.enviarWhatsapp === true, telefoneWhatsapp: entrada.telefoneWhatsapp ?? null, mensagemWhatsapp: entrada.mensagemWhatsapp ?? null,
    });
    revalidatePath(ROTA);
    revalidatePath("/pipeline");
    return {
      link: aviso.link, email: aviso.email, destinatario: aviso.destinatario,
      emailVia: aviso.emailVia, emailDe: aviso.emailDe, avisoEmail: aviso.avisoEmail,
      whatsapp: aviso.whatsapp, whatsappErro: aviso.whatsappErro,
    };
  });
}

export async function acaoRecusar(propostaId: string, motivo: string): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("registrar recusa da proposta", async () => {
    await propostas.registrarRecusaInterna({ organizacaoId: ctx.organizacaoId, propostaId, motivo, ator: ctx.ator });
    revalidatePath(ROTA); revalidatePath("/pipeline");
  });
}

export async function acaoExcluirRascunho(propostaId: string): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("excluir rascunho da proposta", async () => {
    await propostas.excluirRascunho({ organizacaoId: ctx.organizacaoId, propostaId, ator: ctx.ator });
    revalidatePath(ROTA); revalidatePath("/pipeline");
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


/**
 * Grava no modal "Dados do contrato" o que ele promete: os dados da EMPRESA e
 * do CONTATO que assina, para qualquer outra proposta da mesma empresa já vir
 * preenchida. Só chega aqui o que o usuário mudou. O endereço é um campo só na
 * tela ("Rua, número e complemento") e se separa nas colunas da empresa.
 */
export async function acaoSalvarDadosDoContrato(entrada: {
  empresaId: string;
  empresa?: { razao?: string; cnpj?: string; rua?: string; bairro?: string; cep?: string; cidade?: string; uf?: string };
  pessoa?: { pessoaId?: string | null; nome: string; cargo?: string; email?: string; telefone?: string; cpf?: string };
}): Promise<Resultado<{ pessoaSalva: boolean; pessoaId: string | null }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("salvar dados do contrato", async () => {
    const r = await propostas.salvarDadosDoContrato({ organizacaoId: ctx.organizacaoId, ator: ctx.ator, ...entrada });
    revalidatePath(ROTA);
    return r;
  });
}

/**
 * As assinaturas vivas do cliente desta proposta, para o vendedor escolher
 * onde o upgrade entra — na própria oportunidade, sem sair para o Cliente 360.
 *
 * Só aparece quando há mais de uma: com uma só, o aceite resolve sozinho.
 */
export async function acaoAssinaturasParaUpgrade(propostaId: string): Promise<Resultado<Array<{
  id: string; produto: string | null; quantidade: number | null; mrr: string | null;
}>>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("listar assinaturas do cliente", async () => {
    const [linha] = await db.execute<{ empresa_id: string | null }>(sql`
      SELECT n.empresa_id::text AS empresa_id
        FROM propostas p JOIN negocios n ON n.id = p.negocio_id
       WHERE p.id = ${propostaId}::uuid AND p.organizacao_id = ${ctx.organizacaoId}::uuid`);
    if (!linha?.empresa_id) return [];
    const { assinaturasVivasDaEmpresa } = await import("@/lib/crm/expansao-assinatura");
    const vivas = await assinaturasVivasDaEmpresa(ctx.organizacaoId, linha.empresa_id);
    return vivas.map((a) => ({ id: a.id, produto: a.produto, quantidade: a.quantidade, mrr: a.mrr }));
  });
}

/**
 * Cobra o upgrade na assinatura que o vendedor escolheu, e devolve o link.
 *
 * É o mesmo caminho do aceite automático — só com a dúvida resolvida por
 * alguém. Nada de assinatura nova: os itens entram na que o cliente já tem e o
 * Stripe emite a fatura do proporcional.
 */
export async function acaoCobrarUpgradeNaAssinatura(
  propostaId: string,
  assinaturaId: string,
): Promise<Resultado<{ url: string | null; itens: number }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("cobrar upgrade na assinatura", async () => {
    const [g] = await db.execute<{ id: string }>(sql`
      SELECT g.id::text FROM proposta_grupo_comercial g
       WHERE g.proposta_id = ${propostaId}::uuid AND g.organizacao_id = ${ctx.organizacaoId}::uuid
         AND g.checkout_id IS NULL
       ORDER BY g.created_at LIMIT 1`);
    if (!g) throw new RegraDeNegocio("grupo_nao_encontrado", "Esta proposta não tem grupo aguardando pagamento.");
    const { criarCheckoutParaGrupo } = await import("@/lib/crm/checkout");
    const r = await criarCheckoutParaGrupo({
      grupoId: g.id, origem: "manual_vendedor", criadoPorId: ctx.usuarioId, assinaturaEscolhidaId: assinaturaId,
    });
    if (!r.ok) throw new RegraDeNegocio("upgrade_recusado", r.error);
    revalidatePath(ROTA);
    if ("expansao" in r) return { url: r.faturaUrl, itens: r.itensAplicados };
    return { url: r.url, itens: 0 };
  });
}
