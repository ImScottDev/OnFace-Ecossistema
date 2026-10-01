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
import { eq, and, asc } from "drizzle-orm";
import {
  contratoTemplates, propostaGrupoComercial, propostaGrupoComercialItens, propostaItens,
  propostas, leads, empresas, contratos,
} from "@/lib/db/schema";
import { getSignatureProvider } from "@/lib/crm/signature";
import { determinarProdutoProposta } from "@/lib/crm/proposta-fluxo";
import { calcularFamiliaDoGrupo } from "@/lib/crm/politica-familia";
import { tipoDocumentoDoContratual } from "@/lib/vendas/dominio";
import { renderizarCorpo, escaparHtml } from "@/lib/crm/contrato-variaveis";

/**
 * `tipo_documento` separa contrato, aditivo e renovação dentro da MESMA
 * família. Sem ele, dois templates PABX ativos colidiam e o primeiro que
 * casasse vencia — aditivo podia ser escolhido no lugar do contrato novo.
 */
async function escolherTemplate(
  organizacaoId: string,
  commercialModel: string | null,
  serviceFamily?: string | null,
  tipoDocumento: string = "CONTRATO",
) {
  const todos = await db
    .select()
    .from(contratoTemplates)
    .where(and(
      eq(contratoTemplates.organizacaoId, organizacaoId),
      eq(contratoTemplates.ativo, true)
    ));
  const rows = todos.filter((r) => (r.tipoDocumento || "CONTRATO") === tipoDocumento);
  if (rows.length === 0) return null;
  // Família é mais específica que modelo. PABX e White Label compartilham
  // CONTRATO_OBRIGATORIO, mas possuem textos e implantação diferentes.
  return rows.find((r) => r.serviceFamily === serviceFamily && r.commercialModel === commercialModel)
    ?? rows.find((r) => r.serviceFamily === serviceFamily && r.commercialModel === null)
    ?? rows.find((r) => r.serviceFamily === null && r.commercialModel === commercialModel)
    ?? rows.find((r) => r.serviceFamily === null && r.commercialModel === null)
    ?? null;
}

/**
 * Aditivo e renovação citam o contrato que estão alterando. O número vem do
 * contrato base; sem vínculo registrado, o texto diz isso em vez de inventar
 * um número.
 */
async function numeroDoContratoBase(contratoBaseId: string | null | undefined): Promise<string> {
  if (!contratoBaseId) return "contrato principal vigente entre as PARTES";
  const [base] = await db
    .select({ variaveis: contratos.variaveisPreenchidas, id: contratos.id })
    .from(contratos)
    .where(eq(contratos.id, contratoBaseId))
    .limit(1);
  if (!base) return "contrato principal vigente entre as PARTES";
  const numero = (base.variaveis as Record<string, unknown> | null)?.contrato_numero;
  return typeof numero === "string" && numero.trim() ? numero : base.id.slice(0, 8).toUpperCase();
}

const ROTULO_DOCUMENTO: Record<string, string> = {
  CONTRATO: "Contrato",
  ADITIVO: "Termo aditivo",
  RENOVACAO: "Contrato de renovação",
};

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

function moeda(valor: number, codigo: string): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: codigo || "BRL" });
}

function enderecoCompleto(empresa: typeof empresas.$inferSelect | undefined, lead: typeof leads.$inferSelect | undefined): string {
  return [
    empresa?.endereco,
    [empresa?.cidade || lead?.empresaCidade, empresa?.estado || lead?.empresaEstado].filter(Boolean).join(" - "),
    empresa?.cep ? `CEP ${empresa.cep}` : null,
  ].filter(Boolean).join(", ") || "não informado";
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
  variaveis: Record<string, string>,
  serviceFamily?: string | null,
  tipoDocumento: string = "CONTRATO",
): Promise<{ corpoGerado: string; templateId: string | null; templateVersao: number | null }> {
  const template = await escolherTemplate(organizacaoId, commercialModel, serviceFamily, tipoDocumento);
  const corpoGerado = template ? renderizarCorpo(template.corpoTemplate, variaveis) : `Contrato — ${variaveis.itens_descricao || "serviço"}. Valor: ${variaveis.valor_total || "—"}.`;
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
    .select({
      nome: propostaItens.nome,
      descricao: propostaItens.descricao,
      tipo: propostaItens.tipo,
      quantidade: propostaItens.quantidade,
      valorUnitario: propostaItens.valorUnitario,
      subtotal: propostaItens.subtotal,
      servicoCatalogoId: propostaItens.servicoCatalogoId,
    })
    .from(propostaGrupoComercialItens)
    .innerJoin(propostaItens, eq(propostaGrupoComercialItens.propostaItemId, propostaItens.id))
    .where(eq(propostaGrupoComercialItens.grupoId, grupoId))
    .orderBy(asc(propostaItens.ordem));

  const valorTotal = itensDoGrupo.reduce((s, i) => s + parseFloat(i.subtotal || "0"), 0);
  const mrr = itensDoGrupo.filter((i) => i.tipo === "recorrente").reduce((s, i) => s + parseFloat(i.subtotal || "0"), 0);
  const setup = itensDoGrupo.filter((i) => i.tipo === "setup").reduce((s, i) => s + parseFloat(i.subtotal || "0"), 0);
  const itensDescricao = itensDoGrupo.map((i) => `${i.nome} (${i.tipo})`).join(", ") || "—";
  const descreverItens = (tipos: string[]) => itensDoGrupo
    .filter((item) => tipos.includes(item.tipo))
    .map((item) => [
      item.nome,
      item.descricao || "—",
      `Qtd. ${Number(item.quantidade || 1).toLocaleString("pt-BR")}`,
      moeda(parseFloat(item.valorUnitario || "0"), proposta.moeda || "BRL"),
      moeda(parseFloat(item.subtotal || "0"), proposta.moeda || "BRL"),
    ].join(" | "))
    .join("\n") || "Nenhum item contratado.";
  // O contrato em HTML (base do Zoho) espera uma linha de tabela por item
  // dentro do <tbody>. O mesmo dado em texto continua existindo para os
  // templates antigos, colados de .docx.
  const descreverItensHtml = (tipos: string[]) => itensDoGrupo
    .filter((item) => tipos.includes(item.tipo))
    .map((item) => `<tr>${[
      item.nome,
      item.descricao || "—",
      Number(item.quantidade || 1).toLocaleString("pt-BR"),
      moeda(parseFloat(item.valorUnitario || "0"), proposta.moeda || "BRL"),
      moeda(parseFloat(item.subtotal || "0"), proposta.moeda || "BRL"),
    ].map((celula) => `<td>${escaparHtml(String(celula))}</td>`).join("")}</tr>`)
    .join("\n") || `<tr><td colspan="5">Nenhum item contratado.</td></tr>`;
  const signatarios = Array.isArray(proposta.signatarios)
    ? proposta.signatarios.filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    : [];
  const signatarioPrincipal = signatarios[0];
  const inicioContrato = new Date();
  const dataInicio = dataIsoUtc(inicioContrato);

  const variaveis: Record<string, string> = {
    // O quadro das partes pede razão social. `empresas.nome` costuma ser o
    // nome fantasia — era ele que ia para o contrato, e o gate de dados
    // jurídicos gravava a razão social sem ninguém usar.
    empresa_nome: empresa?.razaoSocial || empresa?.nome || lead?.empresa || lead?.nome || "—",
    empresa_razao_social: empresa?.razaoSocial || empresa?.nome || lead?.empresa || "—",
    empresa_nome_fantasia: empresa?.nome || lead?.empresa || "—",
    empresa_cnpj: empresa?.cnpj || lead?.empresaCnpj || "não informado",
    pessoa_nome: lead ? [lead.nome, lead.sobrenome].filter(Boolean).join(" ") : "—",
    pessoa_email: lead?.email || "não informado",
    itens_descricao: itensDescricao,
    empresa_endereco: enderecoCompleto(empresa, lead),
    // O contrato do Zoho cita rua, bairro, cidade, UF e CEP em campos
    // separados no quadro das partes — o endereço composto não serve lá.
    empresa_logradouro: empresa?.logradouro || empresa?.endereco || "não informado",
    empresa_numero: empresa?.numero || "s/n",
    empresa_complemento: empresa?.complemento || "",
    empresa_bairro: empresa?.bairro || "não informado",
    empresa_cidade: empresa?.cidade || lead?.empresaCidade || "não informado",
    empresa_estado: empresa?.estado || lead?.empresaEstado || "não informado",
    empresa_cep: empresa?.cep || "não informado",
    pessoa_cargo: lead?.cargo || String(signatarioPrincipal?.cargo || "não informado"),
    pessoa_cpf: String(signatarioPrincipal?.cpf || "não informado"),
    valor_total: moeda(valorTotal, proposta.moeda || "BRL"),
    itens_recorrentes: descreverItens(["recorrente", "avulso"]),
    itens_setup: descreverItens(["setup"]),
    itens_recorrentes_html: descreverItensHtml(["recorrente", "avulso"]),
    itens_setup_html: descreverItensHtml(["setup"]),
    mrr_total: moeda(mrr, proposta.moeda || "BRL"),
    setup_total: moeda(setup, proposta.moeda || "BRL"),
    prazo_meses: proposta.prazoContratoMeses ? String(proposta.prazoContratoMeses) : "não informado",
    prazo_descricao: proposta.prazoContratoMeses ? `${proposta.prazoContratoMeses} meses` : "conforme condições comerciais acordadas na proposta",
    condicoes_pagamento: proposta.condicoesPagamento || "conforme proposta",
    signatarios: signatarios.map((s) => `${String(s.nome || "")} <${String(s.email || "")}>`).join(", ") || "não informado",
    data_inicio_cobranca: dataInicio,
    data_inicio_vigencia: dataInicio,
    data_emissao: dataInicio,
    // Qualificação da CONTRATADA: estava escrita à mão dentro de cada texto.
    // Como variável, uma eventual mudança cadastral não exige reeditar os
    // cinco contratos.
    callface_razao_social: "CALLFACE SOFTWARE E SERVIÇOS LTDA.",
    callface_cnpj: "39.764.520/0001-06",
    callface_endereco: "Avenida Pierre Simon de Laplace nº 740, sala 4, Bairro Techno Park, Campinas – SP, CEP: 13.069-320",
    proposta_numero: `P-${String(proposta.numero).padStart(3, "0")}-v${proposta.versao}`,
    contrato_base_numero: await numeroDoContratoBase(proposta.contratoBaseId),
    // Não existe numeração própria de contrato: o identificador que o
    // comercial reconhece é o da proposta que o originou.
    contrato_numero: `P-${String(proposta.numero).padStart(3, "0")}-v${proposta.versao}`,
    dia_vencimento: proposta.vencimentoDias ? String(proposta.vencimentoDias) : "conforme condição comercial",
    cidade_uf: [empresa?.cidade || lead?.empresaCidade, empresa?.estado || lead?.empresaEstado].filter(Boolean).join(" - ") || "Campinas - SP",
    data_assinatura_extenso: "data registrada pela plataforma de assinatura",
    // A base PABX V2 trouxe estes campos jurídicos/operacionais, mas eles ainda
    // não possuem configuração canônica no CRM. Mantemos valores explícitos e
    // conservadores até o texto final e as políticas serem cadastrados pelo time.
    callface_representante_nome: "não informado",
    callface_representante_cargo: "não informado",
    callface_representante_cpf: "não informado",
    limite_armazenamento_gravacoes: "conforme o plano contratado",
    sla_critico_resposta: "conforme política de suporte vigente",
    sla_critico_cobertura: "conforme política de suporte vigente",
    sla_alto_resposta: "conforme política de suporte vigente",
    sla_alto_cobertura: "conforme política de suporte vigente",
    sla_medio_resposta: "conforme política de suporte vigente",
    sla_medio_cobertura: "conforme política de suporte vigente",
    sla_baixo_resposta: "conforme política de suporte vigente",
    sla_baixo_cobertura: "conforme política de suporte vigente",
    percentual_multa: "conforme condição comercial e legislação aplicável",
    juros_mora: "conforme condição comercial e legislação aplicável",
    indice_reajuste: "conforme política comercial vigente",
    prazo_devolucao_equipamentos: "conforme condição comercial do equipamento",
    limite_responsabilidade_meses: "conforme versão jurídica final",
    prazo_confidencialidade_anos: "conforme versão jurídica final",
    prazo_cura_inadimplemento: "conforme versão jurídica final",
    regra_multa_rescisoria: "conforme condição comercial e versão jurídica final",
    testemunha_1_nome: "não aplicável quando não houver testemunha",
    testemunha_1_cpf: "não informado",
    testemunha_2_nome: "não aplicável quando não houver testemunha",
    testemunha_2_cpf: "não informado",
  };
  const serviceFamily = grupo.serviceFamily ?? (await calcularFamiliaDoGrupo(grupoId));
  // Proposta marcada como aditivo/upgrade/downgrade gera termo aditivo, e não
  // um contrato novo; renovação gera o contrato de renovação. O operador já
  // escolhia o tipo contratual no envio da proposta — era só a geração do
  // documento que ignorava a escolha e usava sempre o contrato padrão.
  const tipoDocumento = tipoDocumentoDoContratual(proposta.tipoContratual);
  const { corpoGerado, templateId, templateVersao } = await resolverCorpoContrato(proposta.organizacaoId, grupo.commercialModel, variaveis, serviceFamily, tipoDocumento);
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
    // A descrição vira o título do envelope no Documenso: o cliente precisa
    // ver "Termo aditivo" quando é aditivo, não "Contrato".
    descricao: `${ROTULO_DOCUMENTO[tipoDocumento]} gerado do grupo comercial (${grupo.commercialModel}) da proposta #P-${String(proposta.numero).padStart(3, "0")}-v${proposta.versao} — aguardando assinatura`,
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
    // Frente 2C.1 — a família comercial do contrato passa a ser gravada na
    // criação. Antes ficava nula em todo contrato novo, e o gate de evidência
    // não tinha como saber que aquele contrato era de PABX/White Label.
    serviceFamily,
  }).returning();

  return { contratoId: contrato.id };
}

/** Distribui o contrato previamente preparado aos signatários após o aceite. */
export async function enviarContratoParaAssinatura(contratoId: string): Promise<void> {
  const [contrato] = await db.select().from(contratos).where(eq(contratos.id, contratoId)).limit(1);
  if (!contrato) throw new Error(`Contrato ${contratoId} não encontrado`);
  if (contrato.signatureStatus === "signed") return;
  const provider = getSignatureProvider();
  const resultado = await provider.enviarParaAssinatura(contrato.id, {
    signatarios: Array.isArray(contrato.signatarios) ? contrato.signatarios : [],
    titulo: contrato.descricao || `Contrato Callface ${contrato.id.slice(0, 8)}`,
  });
  // Frente 2C.1 — campos provider-agnósticos preenchidos aqui (contrato_provider
  // e sent_at do pedido). `signature_public_url` fica pro provider que tiver URL
  // externa de verdade: no aceite eletrônico simples o link é a própria página
  // pública do CRM, não uma URL de terceiro, e inventar uma seria mentir.
  // Só existe URL pública real quando o provider é externo e devolveu uma
  // (Documenso grava em signatarios[].signingUrl). Fica null no aceite
  // eletrônico simples, onde o link é a própria página pública do CRM.
  const [aposEnvio] = await db.select({ signatarios: contratos.signatarios }).from(contratos).where(eq(contratos.id, contrato.id)).limit(1);
  const primeiroLink = (Array.isArray(aposEnvio?.signatarios) ? aposEnvio.signatarios : [])
    .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>).signingUrl : null))
    .find((url): url is string => typeof url === "string" && url.length > 0) ?? null;

  await db.update(contratos).set({
    signatureProvider: provider.nome,
    signatureEnviadoEm: new Date(),
    signatureProviderRef: resultado.providerRef,
    signaturePublicUrl: primeiroLink,
    updatedAt: new Date(),
  }).where(eq(contratos.id, contrato.id));
}
