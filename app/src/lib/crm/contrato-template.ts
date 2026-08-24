/**
 * Commercial Core v2 (ADR-EXEC-021) — geração de Contrato a partir de
 * Template. Substitui a criação "artesanal" de contrato (campos soltos
 * montados na mão em cada call site) por: escolher o template certo pro
 * modelo comercial do grupo, resolver as variáveis reais (pessoa/empresa/
 * CNPJ/itens/valores/condições) e renderizar o texto — sem engine de
 * template pesado, só substituição de {{variavel}}.
 *
 * O template em si (texto jurídico de verdade) é decisão do Kauã — o que
 * existe aqui é a ESTRUTURA (versão, modelo comercial aplicável, resolução
 * de variável) funcionando ponta a ponta com um texto placeholder honesto.
 */
import { db } from "@/lib/db";
import { eq, and, or, isNull, asc } from "drizzle-orm";
import {
  contratoTemplates, propostaGrupoComercial, propostaGrupoComercialItens, propostaItens,
  propostas, leads, empresas, contratos,
} from "@/lib/db/schema";
import { getSignatureProvider } from "@/lib/crm/signature";
import { determinarProdutoProposta } from "@/lib/crm/proposta-fluxo";

async function escolherTemplate(organizacaoId: string, commercialModel: string | null) {
  const rows = await db
    .select()
    .from(contratoTemplates)
    .where(and(
      eq(contratoTemplates.organizacaoId, organizacaoId),
      eq(contratoTemplates.ativo, true),
      commercialModel ? or(eq(contratoTemplates.commercialModel, commercialModel), isNull(contratoTemplates.commercialModel)) : isNull(contratoTemplates.commercialModel)
    ));
  if (rows.length === 0) return null;
  // Template específico do modelo comercial tem prioridade sobre o genérico.
  return rows.find((r) => r.commercialModel === commercialModel) ?? rows.find((r) => r.commercialModel === null) ?? rows[0];
}

function dataIsoUtc(data: Date): string {
  return data.toISOString().slice(0, 10);
}

function vencimentoPorMeses(inicio: Date, meses: number | null | undefined): string | undefined {
  if (!meses || meses < 1) return undefined;
  const diaOriginal = inicio.getUTCDate();
  const vencimento = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + meses, diaOriginal));
  // Ajusta meses sem o dia original (ex.: 31/01 + 1 mês) para o último dia
  // válido do mês de destino.
  if (vencimento.getUTCDate() !== diaOriginal) vencimento.setUTCDate(0);
  return dataIsoUtc(vencimento);
}

function renderizar(corpo: string, variaveis: Record<string, string>): string {
  return corpo.replace(/\{\{(\w+)\}\}/g, (_, chave) => variaveis[chave] ?? `{{${chave}}}`);
}

/**
 * Resolve+renderiza o corpo do contrato — extraído de `gerarContratoDeTemplate`
 * (19/08) pra ser reusável por QUALQUER call site que crie contrato, não só
 * o fluxo de grupo comercial (ex: Won manual em negocios.ts, que não tem
 * grupo/commercialModel formal). Nunca retorna corpo vazio: sem template
 * configurado, cai no mesmo fallback textual honesto de sempre.
 */
export async function resolverCorpoContrato(
  organizacaoId: string,
  commercialModel: string | null,
  variaveis: Record<string, string>
): Promise<{ corpoGerado: string; templateId: string | null; templateVersao: number | null }> {
  const template = await escolherTemplate(organizacaoId, commercialModel);
  const corpoGerado = template ? renderizar(template.corpoTemplate, variaveis) : `Contrato — ${variaveis.itens_descricao || "serviço"}. Valor: ${variaveis.valor_total || "—"}.`;
  return { corpoGerado, templateId: template?.id ?? null, templateVersao: template?.versao ?? null };
}

/**
 * Gera (cria) o contrato do grupo a partir do template ativo. O padrão é
 * preparar o documento, sem notificar signatários. Isso permite que o
 * contrato exista antes do envio da proposta, como exige o fluxo comercial;
 * a distribuição só acontece depois de ProposalAccepted.
 */
export async function gerarContratoDeTemplate(grupoId: string): Promise<{ contratoId: string }> {
  const [grupo] = await db.select().from(propostaGrupoComercial).where(eq(propostaGrupoComercial.id, grupoId)).limit(1);
  if (!grupo) throw new Error(`Grupo comercial ${grupoId} não encontrado`);
  if (grupo.contratoId) return { contratoId: grupo.contratoId };

  const [proposta] = await db.select().from(propostas).where(eq(propostas.id, grupo.propostaId)).limit(1);
  if (!proposta) throw new Error(`Proposta ${grupo.propostaId} não encontrada`);

  const [lead] = await db.select().from(leads).where(eq(leads.id, proposta.leadId)).limit(1);
  const empresa = lead?.empresaId ? (await db.select().from(empresas).where(eq(empresas.id, lead.empresaId)).limit(1))[0] : undefined;

  const itensDoGrupo = await db
    .select({ nome: propostaItens.nome, tipo: propostaItens.tipo, subtotal: propostaItens.subtotal, servicoCatalogoId: propostaItens.servicoCatalogoId })
    .from(propostaGrupoComercialItens)
    .innerJoin(propostaItens, eq(propostaGrupoComercialItens.propostaItemId, propostaItens.id))
    .where(eq(propostaGrupoComercialItens.grupoId, grupoId))
    .orderBy(asc(propostaItens.ordem));

  const valorTotal = itensDoGrupo.reduce((s, i) => s + parseFloat(i.subtotal || "0"), 0);
  const mrr = itensDoGrupo.filter((i) => i.tipo === "recorrente").reduce((s, i) => s + parseFloat(i.subtotal || "0"), 0);
  const setup = itensDoGrupo.filter((i) => i.tipo === "setup").reduce((s, i) => s + parseFloat(i.subtotal || "0"), 0);
  const itensDescricao = itensDoGrupo.map((i) => `${i.nome} (${i.tipo})`).join(", ") || "—";

  const variaveis: Record<string, string> = {
    empresa_nome: empresa?.nome || lead?.empresa || lead?.nome || "—",
    empresa_cnpj: empresa?.cnpj || lead?.empresaCnpj || "não informado",
    pessoa_nome: lead ? [lead.nome, lead.sobrenome].filter(Boolean).join(" ") : "—",
    pessoa_email: lead?.email || "não informado",
    itens_descricao: itensDescricao,
    valor_total: valorTotal.toLocaleString("pt-BR", { style: "currency", currency: proposta.moeda || "BRL" }),
    prazo_meses: proposta.prazoContratoMeses ? String(proposta.prazoContratoMeses) : "não informado",
    prazo_descricao: proposta.prazoContratoMeses ? `${proposta.prazoContratoMeses} meses` : "conforme condições comerciais acordadas na proposta",
    condicoes_pagamento: proposta.condicoesPagamento || "conforme proposta",
    signatarios: (Array.isArray(proposta.signatarios) ? proposta.signatarios : [])
      .map((s) => `${s.nome} <${s.email}>`).join(", ") || "não informado",
  };
  const { corpoGerado, templateId, templateVersao } = await resolverCorpoContrato(proposta.organizacaoId, grupo.commercialModel, variaveis);
  const inicioContrato = new Date();

  const [contrato] = await db.insert(contratos).values({
    organizacaoId: proposta.organizacaoId,
    leadId: proposta.leadId,
    negocioId: proposta.negocioId,
    grupoComercialId: grupoId,
    templateId,
    templateVersao,
    variaveisPreenchidas: variaveis,
    signatarios: Array.isArray(proposta.signatarios) ? proposta.signatarios : [],
    corpoGerado,
    tipo: itensDoGrupo[0]?.nome || "proposta",
    descricao: `Gerado do grupo comercial (${grupo.commercialModel}) da proposta #P-${String(proposta.numero).padStart(3, "0")}-v${proposta.versao} — aguardando assinatura`,
    moeda: proposta.moeda || "BRL",
    mrr: mrr > 0 ? mrr.toFixed(2) : undefined,
    valorSetup: setup > 0 ? setup.toFixed(2) : undefined,
    inicio: dataIsoUtc(inicioContrato),
    vencimento: vencimentoPorMeses(inicioContrato, proposta.prazoContratoMeses),
    prazoMeses: proposta.prazoContratoMeses || undefined,
    servicos: itensDoGrupo.map((i) => i.nome),
    status: "pendente_assinatura",
    assinaturaStatus: "pendente",
    signatureStatus: "contract_created",
    produto: await determinarProdutoProposta(itensDoGrupo),
  }).returning();

  return { contratoId: contrato.id };
}

/** Distribui o contrato previamente preparado aos signatários após o aceite. */
export async function enviarContratoParaAssinatura(contratoId: string): Promise<void> {
  const [contrato] = await db.select().from(contratos).where(eq(contratos.id, contratoId)).limit(1);
  if (!contrato) throw new Error(`Contrato ${contratoId} não encontrado`);
  if (contrato.signatureStatus === "signed") return;
  const provider = getSignatureProvider();
  await provider.enviarParaAssinatura(contrato.id, {
    signatarios: Array.isArray(contrato.signatarios) ? contrato.signatarios : [],
    titulo: contrato.descricao || `Contrato Callface ${contrato.id.slice(0, 8)}`,
  });
}
