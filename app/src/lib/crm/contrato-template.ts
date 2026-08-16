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

async function escolherTemplate(organizacaoId: string, commercialModel: string) {
  const rows = await db
    .select()
    .from(contratoTemplates)
    .where(and(eq(contratoTemplates.organizacaoId, organizacaoId), eq(contratoTemplates.ativo, true), or(eq(contratoTemplates.commercialModel, commercialModel), isNull(contratoTemplates.commercialModel))));
  if (rows.length === 0) return null;
  // Template específico do modelo comercial tem prioridade sobre o genérico.
  return rows.find((r) => r.commercialModel === commercialModel) ?? rows.find((r) => r.commercialModel === null) ?? rows[0];
}

function renderizar(corpo: string, variaveis: Record<string, string>): string {
  return corpo.replace(/\{\{(\w+)\}\}/g, (_, chave) => variaveis[chave] ?? `{{${chave}}}`);
}

/**
 * Gera (cria) o contrato do grupo a partir do template ativo — chamado no
 * momento em que o grupo precisa de contrato (aceite de um grupo com
 * CONTRATO_OBRIGATORIO/CONTRATO_FIDELIDADE_OPCIONAL). Idempotente: se o
 * grupo já tem contrato, retorna o existente em vez de duplicar.
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

  const template = await escolherTemplate(proposta.organizacaoId, grupo.commercialModel);
  const variaveis: Record<string, string> = {
    empresa_nome: empresa?.nome || lead?.empresa || lead?.nome || "—",
    empresa_cnpj: empresa?.cnpj || lead?.empresaCnpj || "não informado",
    pessoa_nome: lead ? [lead.nome, lead.sobrenome].filter(Boolean).join(" ") : "—",
    pessoa_email: lead?.email || "não informado",
    itens_descricao: itensDescricao,
    valor_total: valorTotal.toLocaleString("pt-BR", { style: "currency", currency: proposta.moeda || "BRL" }),
    prazo_descricao: "conforme condições comerciais acordadas na proposta",
    condicoes_pagamento: proposta.condicoesPagamento || "conforme proposta",
  };
  const corpoGerado = template ? renderizar(template.corpoTemplate, variaveis) : `Contrato — ${itensDescricao}. Valor: ${variaveis.valor_total}.`;

  const [contrato] = await db.insert(contratos).values({
    organizacaoId: proposta.organizacaoId,
    leadId: proposta.leadId,
    negocioId: proposta.negocioId,
    grupoComercialId: grupoId,
    templateId: template?.id ?? null,
    templateVersao: template?.versao ?? null,
    variaveisPreenchidas: variaveis,
    corpoGerado,
    tipo: itensDoGrupo[0]?.nome || "proposta",
    descricao: `Gerado do grupo comercial (${grupo.commercialModel}) da proposta #P-${String(proposta.numero).padStart(3, "0")}-v${proposta.versao} — aguardando assinatura`,
    moeda: proposta.moeda || "BRL",
    mrr: mrr > 0 ? mrr.toFixed(2) : undefined,
    valorSetup: setup > 0 ? setup.toFixed(2) : undefined,
    servicos: itensDoGrupo.map((i) => i.nome),
    status: "pendente_assinatura",
    assinaturaStatus: "pendente",
    produto: await determinarProdutoProposta(itensDoGrupo),
  }).returning();

  const provider = getSignatureProvider();
  await provider.enviarParaAssinatura(contrato.id);

  return { contratoId: contrato.id };
}
