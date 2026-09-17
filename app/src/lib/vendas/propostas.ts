/**
 * Motor de Propostas (Bloco 03).
 *
 * A criação de proposta com itens, o checkout e o contrato já existiam e
 * continuam sendo usados como estão (`lib/crm/proposta-criacao.ts`,
 * `enviar-proposta.ts`, `proposta-aceite.ts`). O que faltava e mora aqui são
 * as regras que a spec fechou:
 *
 *   - catálogo filtrado pela família da oportunidade (§2);
 *   - modo de fechamento escolhido ANTES do envio (§7);
 *   - dados jurídicos obrigatórios para proposta contratual (§17);
 *   - envio move a oportunidade para Proposta (§9);
 *   - versionamento: proposta enviada não se edita, cria-se revisão (§13);
 *   - aceite NÃO é ganho (§26).
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { registrarEvento } from "./eventos";
import { moverEtapa } from "./pipeline";
import {
  RegraDeNegocio, ROTULO_FAMILIA, VALIDADES_PROPOSTA, TIPOS_CONTRATUAIS_COM_BASE,
  type Ator, type Familia, type ModoFechamento, type NaturezaReceita,
  type StatusProposta, type TipoContratual,
} from "./dominio";

/* ── Catálogo filtrado pela família (Bloco 03 §2) ──────────────────────── */

export interface ItemCatalogo {
  catalogoPrecoId: string;
  servicoCatalogoId: string;
  nome: string;
  variacao: string | null;
  sku: string | null;
  valor: string;
  naturezaReceita: NaturezaReceita | "UNKNOWN";
  familia: string | null;
  exigeContrato: boolean;
}

/**
 * Catálogo comercial de uma família.
 *
 * Bloco 03 §2 e §30: mostrar o catálogo de todas as famílias ao criar proposta
 * é proibido — reduz erro comercial e mantém proposta coerente com a
 * oportunidade.
 *
 * Itens sem família no cadastro NÃO entram. É uma decisão consciente: incluir
 * o não classificado "por garantia" traria de volta exatamente a mistura que a
 * regra existe para impedir. O que falta classificar está registrado como
 * dependência em docs/reconstruction/MODULO-01-VENDAS.md.
 */
export async function catalogoDaFamilia(organizacaoId: string, familia: Familia): Promise<ItemCatalogo[]> {
  const linhas = await db.execute<{
    catalogo_preco_id: string; servico_catalogo_id: string; nome: string;
    variacao: string | null; sku: string | null; valor: string;
    revenue_nature: string; service_family: string | null; exige_contrato: boolean;
  }>(sql`
    SELECT cp.id::text AS catalogo_preco_id, sc.id::text AS servico_catalogo_id,
           sc.nome, cp.variacao, cp.sku, cp.valor::text,
           cp.revenue_nature, sc.service_family, cp.exige_contrato
      FROM catalogo_precos cp
      JOIN servicos_catalogo sc ON sc.id = cp.servico_catalogo_id
     WHERE sc.organizacao_id = ${organizacaoId}::uuid
       AND sc.service_family = ${familia}
       AND COALESCE(cp.ativo, true) = true
     ORDER BY sc.nome, cp.variacao
  `);

  return linhas.map((l) => ({
    catalogoPrecoId: l.catalogo_preco_id,
    servicoCatalogoId: l.servico_catalogo_id,
    nome: l.nome,
    variacao: l.variacao,
    sku: l.sku,
    valor: l.valor,
    naturezaReceita: (l.revenue_nature as NaturezaReceita) ?? "UNKNOWN",
    familia: l.service_family,
    exigeContrato: l.exige_contrato,
  }));
}

/* ── Dados jurídicos (Bloco 03 §17) ────────────────────────────────────── */

export const CAMPOS_JURIDICOS = [
  { campo: "razaoSocial", coluna: "razao_social", rotulo: "Razão social" },
  { campo: "cnpj", coluna: "cnpj", rotulo: "CNPJ" },
  { campo: "logradouro", coluna: "logradouro", rotulo: "Rua" },
  { campo: "numero", coluna: "numero", rotulo: "Número" },
  { campo: "bairro", coluna: "bairro", rotulo: "Bairro" },
  { campo: "cidade", coluna: "cidade", rotulo: "Cidade" },
  { campo: "estado", coluna: "estado", rotulo: "Estado" },
  { campo: "cep", coluna: "cep", rotulo: "CEP" },
] as const;

export interface DadosJuridicos {
  razaoSocial?: string | null;
  cnpj?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
}

/** Devolve os campos que faltam na Empresa para uma proposta contratual. */
export async function conferirDadosJuridicos(
  organizacaoId: string, empresaId: string,
): Promise<{ completo: boolean; faltando: string[] }> {
  const [empresa] = await db.execute<Record<string, string | null>>(sql`
    SELECT razao_social, cnpj, logradouro, numero, bairro, cidade, estado, cep
      FROM empresas WHERE id = ${empresaId}::uuid AND organizacao_id = ${organizacaoId}::uuid
  `);
  if (!empresa) throw new RegraDeNegocio("empresa_nao_encontrada", "Empresa não encontrada.");

  const faltando = CAMPOS_JURIDICOS
    .filter(({ coluna }) => !empresa[coluna]?.toString().trim())
    .map(({ rotulo }) => rotulo);

  return { completo: faltando.length === 0, faltando };
}

/**
 * Grava os dados jurídicos na EMPRESA.
 *
 * Bloco 03 §17 é explícito: os dados preenchidos atualizam a Empresa, não
 * ficam dentro da proposta. É isso que os deixa disponíveis para as próximas
 * propostas e contratos, em vez de serem redigitados toda vez.
 */
export async function salvarDadosJuridicos(params: {
  organizacaoId: string;
  empresaId: string;
  dados: DadosJuridicos;
  ator: Ator;
}): Promise<void> {
  const { dados } = params;
  await db.execute(sql`
    UPDATE empresas SET
      razao_social = COALESCE(${dados.razaoSocial ?? null}, razao_social),
      cnpj = COALESCE(${dados.cnpj ?? null}, cnpj),
      logradouro = COALESCE(${dados.logradouro ?? null}, logradouro),
      numero = COALESCE(${dados.numero ?? null}, numero),
      complemento = COALESCE(${dados.complemento ?? null}, complemento),
      bairro = COALESCE(${dados.bairro ?? null}, bairro),
      cidade = COALESCE(${dados.cidade ?? null}, cidade),
      estado = COALESCE(${dados.estado ?? null}, estado),
      cep = COALESCE(${dados.cep ?? null}, cep),
      updated_at = now()
    WHERE id = ${params.empresaId}::uuid AND organizacao_id = ${params.organizacaoId}::uuid
  `);
}

/* ── Leitura de apoio ──────────────────────────────────────────────────── */

interface PropostaInterna extends Record<string, unknown> {
  id: string;
  organizacao_id: string;
  negocio_id: string | null;
  lead_id: string | null;
  empresa_id: string | null;
  numero: number;
  versao: number;
  status: StatusProposta;
  modo_fechamento: ModoFechamento | null;
  service_family: string | null;
  etapa_oportunidade: string | null;
  familia_oportunidade: string | null;
}

async function carregarProposta(organizacaoId: string, propostaId: string): Promise<PropostaInterna> {
  const [p] = await db.execute<PropostaInterna>(sql`
    SELECT p.id::text, p.organizacao_id::text, p.negocio_id::text, p.lead_id::text,
           n.empresa_id::text AS empresa_id, p.numero, p.versao, p.status,
           p.modo_fechamento, p.service_family,
           n.etapa AS etapa_oportunidade, n.service_family AS familia_oportunidade
      FROM propostas p
      LEFT JOIN negocios n ON n.id = p.negocio_id
     WHERE p.id = ${propostaId}::uuid AND p.organizacao_id = ${organizacaoId}::uuid
  `);
  if (!p) throw new RegraDeNegocio("proposta_nao_encontrada", "Proposta não encontrada.");
  return p;
}

/* ── Envio (Bloco 03 §3, §6, §7, §9) ───────────────────────────────────── */

export interface EnvioDeProposta {
  organizacaoId: string;
  propostaId: string;
  modoFechamento: ModoFechamento;
  validadeDias: number;
  tipoContratual?: TipoContratual | null;
  contratoBaseId?: string | null;
  ator: Ator;
}

/**
 * Prepara e envia a proposta.
 *
 * A validação acontece ANTES de qualquer efeito: a spec pede que o envio seja
 * bloqueado quando faltar dado, com a mensagem e a etapa de completar os
 * dados. Enviar primeiro e corrigir depois deixaria o cliente com uma proposta
 * que não pode virar contrato.
 *
 * O envio move a oportunidade para Proposta automaticamente quando ela está em
 * etapa anterior (§9) — e é o único caminho que pode furar o gate de etapa,
 * porque aqui a proposta existe de verdade.
 */
export async function enviarProposta(envio: EnvioDeProposta): Promise<{ propostaId: string }> {
  const proposta = await carregarProposta(envio.organizacaoId, envio.propostaId);

  if (proposta.status !== "rascunho") {
    throw new RegraDeNegocio(
      "proposta_ja_enviada",
      "Esta proposta já foi enviada. Para mudar a oferta, crie uma revisão.",
      { rotulo: "Criar revisão", tipo: "criar_revisao" },
    );
  }
  if (!VALIDADES_PROPOSTA.includes(envio.validadeDias as (typeof VALIDADES_PROPOSTA)[number])) {
    throw new RegraDeNegocio("validade_invalida", "Escolha uma validade entre 7, 14, 22 ou 30 dias.");
  }
  if (!proposta.negocio_id) {
    throw new RegraDeNegocio("proposta_sem_oportunidade", "Proposta precisa estar vinculada a uma oportunidade.");
  }

  const [temItens] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM proposta_itens WHERE proposta_id = ${envio.propostaId}::uuid
  `);
  if ((temItens?.n ?? 0) === 0) {
    throw new RegraDeNegocio("proposta_sem_itens", "A proposta precisa de pelo menos um item.");
  }

  if (envio.modoFechamento === "CONTRACT") {
    if (!proposta.empresa_id) {
      throw new RegraDeNegocio("proposta_sem_empresa", "Proposta contratual exige uma Empresa vinculada.");
    }
    const juridicos = await conferirDadosJuridicos(envio.organizacaoId, proposta.empresa_id);
    if (!juridicos.completo) {
      throw new RegraDeNegocio(
        "dados_juridicos_incompletos",
        `Para seguir com uma proposta contratual, complete os dados jurídicos e de endereço da empresa. Falta: ${juridicos.faltando.join(", ")}.`,
        { rotulo: "Completar dados da empresa", tipo: "completar_dados_empresa" },
      );
    }
    if (envio.tipoContratual && TIPOS_CONTRATUAIS_COM_BASE.includes(envio.tipoContratual) && !envio.contratoBaseId) {
      throw new RegraDeNegocio(
        "contrato_base_obrigatorio",
        `${envio.tipoContratual} precisa referenciar o contrato existente que está sendo alterado.`,
      );
    }
  }

  const validade = new Date();
  validade.setDate(validade.getDate() + envio.validadeDias);

  await db.execute(sql`
    UPDATE propostas SET
      status = 'enviada',
      modo_fechamento = ${envio.modoFechamento},
      validade_dias = ${envio.validadeDias},
      data_validade = ${validade.toISOString().slice(0, 10)}::date,
      enviada_em = now(),
      tipo_contratual = ${envio.tipoContratual ?? null},
      contrato_base_id = ${envio.contratoBaseId ?? null}::uuid,
      service_family = COALESCE(service_family, ${proposta.familia_oportunidade ?? null}),
      updated_at = now()
     WHERE id = ${envio.propostaId}::uuid
  `);

  await registrarEvento({
    organizacaoId: envio.organizacaoId, tipo: "ProposalSent", ator: envio.ator,
    propostaId: envio.propostaId, negocioId: proposta.negocio_id, leadId: proposta.lead_id,
    empresaId: proposta.empresa_id,
    contexto: {
      modoFechamento: envio.modoFechamento, validadeDias: envio.validadeDias,
      tipoContratual: envio.tipoContratual ?? null,
      familia: proposta.familia_oportunidade,
    },
    timeline: {
      tipo: "nota", titulo: `Proposta #${proposta.numero} enviada`,
      descricao: `Validade de ${envio.validadeDias} dias · ${envio.modoFechamento === "CONTRACT" ? "Contrato" : "Pré-pago"}`,
    },
  });

  // Bloco 03 §9: se a oportunidade estiver em Entrada ou Diagnóstico, o avanço
  // é automático. Em Negociação ela fica onde está — enviar uma revisão não
  // deve puxar a negociação para trás.
  if (proposta.etapa_oportunidade === "entrada" || proposta.etapa_oportunidade === "diagnostico") {
    await moverEtapa({
      organizacaoId: envio.organizacaoId, negocioId: proposta.negocio_id,
      para: "proposta", ator: envio.ator, motivo: "Proposta enviada",
      ignorarGateDeProposta: true,
    });
  }

  return { propostaId: envio.propostaId };
}

/* ── Interação do cliente (Bloco 03 §11-12, §24-26) ────────────────────── */

/**
 * Registra a resposta do cliente na proposta pública.
 *
 * **Não decide nada.** Quem decide — se pode aceitar, se a validade venceu, se
 * forma grupo comercial, se dispara contrato ou checkout — continua sendo
 * `lib/crm/proposta-aceite.ts` e `lib/crm/proposta-publica.ts`, que já estavam
 * sólidos e são o único caminho da página pública. A spec manda reaproveitar,
 * não criar um segundo fluxo.
 *
 * O que esta função faz é o que faltava: gravar os campos novos do domínio
 * (`aceita_em`, `recusada_em`, `ajuste_solicitado_*`, status `visualizada`) e
 * pôr o evento na linha do tempo comercial. Sem isso, a resposta do cliente
 * existiria no fluxo antigo e sumiria da tela nova.
 */
export async function registrarRespostaDoCliente(params: {
  organizacaoId: string;
  propostaId: string;
  tipo: "visualizada" | "aceita" | "recusada" | "ajuste_solicitado";
  descricao?: string | null;
  contatoNome?: string | null;
  metadados?: Record<string, unknown> | null;
}): Promise<void> {
  const proposta = await carregarProposta(params.organizacaoId, params.propostaId);

  switch (params.tipo) {
    case "visualizada":
      // Só a primeira visualização muda o status; abrir o link de novo não é
      // uma resposta nova do cliente.
      await db.execute(sql`
        UPDATE propostas SET status = 'visualizada', updated_at = now()
         WHERE id = ${params.propostaId}::uuid AND status = 'enviada'
      `);
      break;
    case "aceita":
      await db.execute(sql`
        UPDATE propostas SET aceita_em = COALESCE(aceita_em, now()), updated_at = now()
         WHERE id = ${params.propostaId}::uuid
      `);
      break;
    case "recusada":
      await db.execute(sql`
        UPDATE propostas SET recusada_em = COALESCE(recusada_em, now()), updated_at = now()
         WHERE id = ${params.propostaId}::uuid
      `);
      break;
    case "ajuste_solicitado":
      await db.execute(sql`
        UPDATE propostas SET
          ajuste_solicitado_em = now(),
          ajuste_solicitado_descricao = ${params.descricao ?? null},
          updated_at = now()
         WHERE id = ${params.propostaId}::uuid
      `);
      break;
  }

  const gatePendente = proposta.modo_fechamento === "CONTRACT" ? "Contrato pendente" : "Pagamento pendente";

  const tipoEvento = params.tipo === "visualizada" ? "ProposalViewed"
    : params.tipo === "aceita" ? "ProposalAccepted"
    : params.tipo === "recusada" ? "ProposalRejected"
    : "ProposalAdjustmentRequested";

  const timeline = params.tipo === "visualizada" ? null : {
    tipo: "nota",
    titulo: params.tipo === "aceita" ? `Proposta #${proposta.numero} aceita`
      : params.tipo === "recusada" ? `Proposta #${proposta.numero} recusada`
      : `Cliente pediu ajuste na proposta #${proposta.numero}`,
    descricao: params.tipo === "aceita"
      // Bloco 03 §26: o aceite não fecha a venda. A timeline diz o que falta.
      ? `${gatePendente} — a oportunidade só fecha com a evidência.`
      : params.tipo === "recusada"
        ? "A oportunidade continua aberta: perder exige decisão e motivo."
        : params.descricao ?? null,
  };

  await registrarEvento({
    organizacaoId: params.organizacaoId,
    tipo: tipoEvento,
    ator: { tipo: "SYSTEM", usuarioId: null, ref: "proposta-publica" },
    propostaId: params.propostaId,
    negocioId: proposta.negocio_id,
    leadId: proposta.lead_id,
    empresaId: proposta.empresa_id,
    contexto: {
      versao: proposta.versao,
      contato: params.contatoNome ?? null,
      modoFechamento: proposta.modo_fechamento,
      ...(params.tipo === "aceita" ? { gatePendente } : {}),
      ...(params.descricao ? { descricao: params.descricao } : {}),
      ...(params.metadados ?? {}),
    },
    timeline,
  });
}

/* ── Versionamento (Bloco 03 §13, §28) ─────────────────────────────────── */

/**
 * Cria a revisão de uma proposta já enviada.
 *
 * A anterior vira `substituida` e deixa de poder ser aceita (§1 e §30); ela
 * continua no histórico, que é o ponto do versionamento. Editar em silêncio
 * uma proposta que o cliente já recebeu está entre as proibições.
 *
 * Copia itens, condições e modo de fechamento — quem revisa quase sempre muda
 * um item ou um desconto, não recomeça do zero.
 */
export async function criarRevisao(params: {
  organizacaoId: string;
  propostaId: string;
  ator: Ator;
}): Promise<{ propostaId: string; versao: number }> {
  const proposta = await carregarProposta(params.organizacaoId, params.propostaId);

  if (proposta.status === "rascunho") {
    throw new RegraDeNegocio("proposta_em_rascunho", "Esta proposta ainda é rascunho: edite-a diretamente.");
  }
  if (proposta.status === "aceita") {
    throw new RegraDeNegocio(
      "proposta_aceita",
      "A versão aceita é preservada. Uma renegociação posterior gera uma proposta nova.",
    );
  }

  const [nova] = await db.execute<{ id: string; versao: number }>(sql`
    INSERT INTO propostas (
      organizacao_id, lead_id, negocio_id, numero, versao, proposta_original_id,
      moeda, status, data_emissao, observacoes, condicoes_pagamento,
      condicao_pagamento_tipo, parcelas, vencimento_dias, prazo_contrato_meses,
      signatarios, total_recorrente, total_avulso, total_geral, criado_por_id,
      modo_fechamento, validade_dias, tipo_contratual, contrato_base_id, service_family
    )
    SELECT organizacao_id, lead_id, negocio_id, numero, versao + 1,
           COALESCE(proposta_original_id, id),
           moeda, 'rascunho', CURRENT_DATE, observacoes, condicoes_pagamento,
           condicao_pagamento_tipo, parcelas, vencimento_dias, prazo_contrato_meses,
           signatarios, total_recorrente, total_avulso, total_geral,
           ${params.ator.usuarioId ?? null}::uuid,
           modo_fechamento, validade_dias, tipo_contratual, contrato_base_id, service_family
      FROM propostas WHERE id = ${params.propostaId}::uuid
    RETURNING id::text, versao
  `);

  await db.execute(sql`
    INSERT INTO proposta_itens (
      proposta_id, servico_catalogo_id, nome, descricao, tipo, moeda, quantidade,
      valor_unitario, desconto, desconto_tipo, subtotal, ordem, commercial_model,
      catalogo_preco_id, stripe_product_id, stripe_price_id, sku_preco, variacao,
      valor_tabela, service_family, revenue_nature
    )
    SELECT ${nova.id}::uuid, servico_catalogo_id, nome, descricao, tipo, moeda, quantidade,
           valor_unitario, desconto, desconto_tipo, subtotal, ordem, commercial_model,
           catalogo_preco_id, stripe_product_id, stripe_price_id, sku_preco, variacao,
           valor_tabela, service_family, revenue_nature
      FROM proposta_itens WHERE proposta_id = ${params.propostaId}::uuid
  `);

  await db.execute(sql`
    UPDATE propostas SET
      status = 'substituida', substituida_em = now(), substituida_por_id = ${nova.id}::uuid, updated_at = now()
     WHERE id = ${params.propostaId}::uuid
  `);

  await registrarEvento({
    organizacaoId: params.organizacaoId, tipo: "ProposalSuperseded", ator: params.ator,
    propostaId: params.propostaId, negocioId: proposta.negocio_id,
    contexto: { novaPropostaId: nova.id, novaVersao: nova.versao },
    timeline: {
      tipo: "nota", titulo: `Proposta #${proposta.numero} revisada`,
      descricao: `v${proposta.versao} substituída pela v${nova.versao}`,
    },
  });

  await registrarEvento({
    organizacaoId: params.organizacaoId, tipo: "ProposalCreated", ator: params.ator,
    propostaId: nova.id, negocioId: proposta.negocio_id,
    contexto: { versao: nova.versao, revisaoDe: params.propostaId },
  });

  return { propostaId: nova.id, versao: nova.versao };
}

/**
 * Expira as propostas vencidas.
 *
 * Bloco 03 §6 e §14: expirar não perde a oportunidade. Só a proposta muda de
 * estado; a decisão de perder continua sendo humana e com motivo.
 */
export async function expirarPropostasVencidas(organizacaoId: string): Promise<number> {
  const vencidas = await db.execute<{ id: string; negocio_id: string | null; numero: number }>(sql`
    UPDATE propostas SET status = 'expirada', expirada_em = now(), updated_at = now()
     WHERE organizacao_id = ${organizacaoId}::uuid
       AND status IN ('enviada','visualizada','ajuste_solicitado')
       AND data_validade IS NOT NULL
       AND data_validade < CURRENT_DATE
    RETURNING id::text, negocio_id::text, numero
  `);

  for (const p of vencidas) {
    await registrarEvento({
      organizacaoId, tipo: "ProposalExpired",
      ator: { tipo: "SYSTEM", usuarioId: null, ref: "expiracao-automatica" },
      propostaId: p.id, negocioId: p.negocio_id,
      timeline: {
        tipo: "nota", titulo: `Proposta #${p.numero} expirou`,
        descricao: "A oportunidade continua aberta.",
      },
    });
  }

  return vencidas.length;
}

/* ── Composição financeira (Bloco 02 §14, Bloco 03 §5) ─────────────────── */

export interface ComposicaoFinanceira {
  recorrenteMensal: number;
  naoRecorrente: number;
  porNatureza: Array<{ natureza: string; total: number }>;
  /** Só existe quando há prazo contratual. Sem prazo, não se inventa TCV. */
  tcv: number | null;
  prazoMeses: number | null;
}

/**
 * Composição da proposta por natureza econômica.
 *
 * Bloco 03 §5 e §30: somar recorrência com setup e chamar de "valor total" é
 * proibido, porque engana. O recorrente e o não recorrente ficam separados, e
 * o TCV só aparece quando existe prazo contratual para multiplicar.
 */
export async function composicaoDaProposta(propostaId: string): Promise<ComposicaoFinanceira> {
  const itens = await db.execute<{ natureza: string | null; tipo: string; subtotal: string }>(sql`
    SELECT revenue_nature AS natureza, tipo, subtotal::text
      FROM proposta_itens WHERE proposta_id = ${propostaId}::uuid
  `);
  const [proposta] = await db.execute<{ prazo: number | null }>(sql`
    SELECT prazo_contrato_meses AS prazo FROM propostas WHERE id = ${propostaId}::uuid
  `);

  let recorrenteMensal = 0;
  let naoRecorrente = 0;
  const porNatureza = new Map<string, number>();

  for (const item of itens) {
    const valor = Number(item.subtotal) || 0;
    // A natureza do catálogo manda; `tipo` é o campo legado e só entra quando
    // a natureza não foi classificada.
    const natureza = item.natureza ?? (item.tipo === "recorrente" ? "MRR" : item.tipo === "setup" ? "SETUP" : "ONE_TIME");
    porNatureza.set(natureza, (porNatureza.get(natureza) ?? 0) + valor);
    if (natureza === "MRR") recorrenteMensal += valor;
    else naoRecorrente += valor;
  }

  const prazoMeses = proposta?.prazo ?? null;
  const tcv = prazoMeses && prazoMeses > 0 ? recorrenteMensal * prazoMeses + naoRecorrente : null;

  return {
    recorrenteMensal: Math.round(recorrenteMensal * 100) / 100,
    naoRecorrente: Math.round(naoRecorrente * 100) / 100,
    porNatureza: [...porNatureza.entries()].map(([natureza, total]) => ({
      natureza, total: Math.round(total * 100) / 100,
    })),
    tcv: tcv === null ? null : Math.round(tcv * 100) / 100,
    prazoMeses,
  };
}

/** Rótulo da família para as telas, sem cada uma reimplementar o mapa. */
export function rotuloFamilia(familia: string | null | undefined): string {
  if (!familia) return ROTULO_FAMILIA.UNKNOWN;
  return ROTULO_FAMILIA[familia as keyof typeof ROTULO_FAMILIA] ?? familia;
}
