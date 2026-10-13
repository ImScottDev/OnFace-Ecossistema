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
  propostas, leads, empresas, contratos, servicosCatalogo,
} from "@/lib/db/schema";
import { descricaoDoItemSql } from "@/lib/catalogo/descricao-do-item";
import { getSignatureProvider } from "@/lib/crm/signature";
import { determinarProdutoProposta } from "@/lib/crm/proposta-fluxo";
import { calcularFamiliaDoGrupo } from "@/lib/crm/politica-familia";
import { tipoDocumentoDoContratual } from "@/lib/vendas/dominio";
import { linhasDeItens, moeda } from "@/lib/crm/contrato-itens";
import { politicaContratual } from "@/lib/crm/contrato-politica";
import { ehCliente } from "@/lib/crm/proposta-signatarios";
import { renderizarCorpo, variaveisFaltando } from "@/lib/crm/contrato-variaveis";

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
  return escolherTemplateDe(todos, commercialModel, serviceFamily, tipoDocumento);
}

/**
 * A escolha em si, sem banco (testável). Família é mais específica que modelo:
 * PABX e White Label compartilham CONTRATO_OBRIGATORIO, mas têm textos e
 * implantação diferentes.
 *
 * O terceiro degrau é o que faltava. O item do catálogo real nasce
 * PAGAMENTO_DIRETO (218/218), e o template PABX/Callface AI/White Label é
 * CONTRATO_OBRIGATORIO: sem o degrau "mesma família, qualquer modelo" nenhum
 * casava e TODO contrato de PABX saía com o texto genérico de seis linhas, não
 * com o contrato jurídico da família. Visto no Documenso do cliente.
 */
export function escolherTemplateDe<T extends { tipoDocumento: string | null; serviceFamily: string | null; commercialModel: string | null }>(
  todos: T[],
  commercialModel: string | null,
  serviceFamily?: string | null,
  tipoDocumento: string = "CONTRATO",
): T | null {
  const rows = todos.filter((r) => (r.tipoDocumento || "CONTRATO") === tipoDocumento);
  if (rows.length === 0) return null;
  const familia = serviceFamily && serviceFamily !== "UNKNOWN" ? serviceFamily : null;
  return (familia ? rows.find((r) => r.serviceFamily === familia && r.commercialModel === commercialModel) : undefined)
    ?? (familia ? rows.find((r) => r.serviceFamily === familia && r.commercialModel === null) : undefined)
    ?? (familia ? rows.find((r) => r.serviceFamily === familia) : undefined)
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
  DOWNGRADE: "Termo aditivo de downgrade",
  RENOVACAO: "Contrato de renovação",
};

const ROTULO_FAMILIA_DOC: Record<string, string> = { CALLFACE_AI: "Callface AI", PABX: "PABX", WHITE_LABEL: "White Label" };

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

function enderecoCompleto(empresa: typeof empresas.$inferSelect | undefined, lead: typeof leads.$inferSelect | undefined): string {
  // O gate de dados jurídicos grava rua/número/bairro em colunas próprias; o
  // `endereco` livre só existe nas empresas antigas.
  const rua = [empresa?.logradouro, empresa?.numero, empresa?.complemento].filter(Boolean).join(", ") || empresa?.endereco;
  return [
    rua,
    empresa?.bairro,
    [empresa?.cidade || lead?.empresaCidade, empresa?.estado || lead?.empresaEstado].filter(Boolean).join(" - "),
    empresa?.cep ? `CEP ${empresa.cep}` : null,
  ].filter(Boolean).join(", ");
}

const dataExtenso = (d: Date) => d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
const dataCurta = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

const FORMA_PAGAMENTO: Record<string, string> = {
  cartao: "cartão de crédito", boleto: "boleto bancário", boleto_parcelado: "boleto bancário",
};

/** Erro que carrega o que falta, em palavras do operador. A UI e o evento de falha mostram `message`. */
export class ContratoIncompletoError extends Error {
  constructor(public readonly faltando: string[]) {
    super(`Contrato não pode ser enviado: falta ${faltando.join("; ")}.`);
    this.name = "ContratoIncompletoError";
  }
}

/** Onde corrigir cada pendência: o texto vai direto para quem precisa agir. */
function dicaDaVariavel(chave: string, rotulo: string): string {
  if (chave.startsWith("empresa_")) return `${rotulo} da empresa (cadastro da Empresa, dados jurídicos)`;
  if (chave === "percentual_multa" || chave === "percentual_multa_numero") return "multa rescisória (Ajustes > Contratos > Parâmetros do contrato)";
  if (chave === "limite_armazenamento_gravacoes") return "limite de armazenamento de gravações (Ajustes > Contratos > Parâmetros do contrato)";
  if (chave === "meses_restantes_contrato_base" || chave === "valor_multa_downgrade") return "prazo restante do contrato aditado (contrato base vinculado à proposta, com início e prazo)";
  if (chave === "prazo_meses") return "prazo do contrato em meses (proposta)";
  if (chave === "dia_vencimento") return "vencimento da cobrança (condições de pagamento da proposta)";
  if (chave === "forma_pagamento_setup") return "forma de pagamento do setup (condições de pagamento da proposta)";
  if (chave.startsWith("pessoa_")) return `${rotulo} (signatário da proposta)`;
  return rotulo;
}

interface VariaveisDoGrupo {
  variaveis: Record<string, string>;
  proposta: typeof propostas.$inferSelect;
  grupo: typeof propostaGrupoComercial.$inferSelect;
  serviceFamily: string;
  tipoDocumento: string;
  itens: { nome: string; tipo: string; subtotal: string | null; servicoCatalogoId: string | null }[];
  mrr: number;
  setup: number;
}

/**
 * Todas as variáveis do contrato a partir do que o sistema sabe AGORA. Vazio é
 * vazio: nada de "não informado" que acabaria escrito no meio de uma cláusula.
 * É chamada na geração (rascunho) e de novo no envio, porque os dados jurídicos
 * da empresa costumam ser completados depois que a proposta saiu.
 */
async function montarVariaveisDoGrupo(grupoId: string): Promise<VariaveisDoGrupo> {
  const [grupo] = await db.select().from(propostaGrupoComercial).where(eq(propostaGrupoComercial.id, grupoId)).limit(1);
  if (!grupo) throw new Error(`Grupo comercial ${grupoId} não encontrado`);

  const [proposta] = await db.select().from(propostas).where(eq(propostas.id, grupo.propostaId)).limit(1);
  if (!proposta) throw new Error(`Proposta ${grupo.propostaId} não encontrada`);

  const [lead] = await db.select().from(leads).where(eq(leads.id, proposta.leadId)).limit(1);
  const empresaId = proposta.empresaId ?? lead?.empresaId;
  const empresa = empresaId ? (await db.select().from(empresas).where(eq(empresas.id, empresaId)).limit(1))[0] : undefined;

  const itensDoGrupo = await db
    .select({
      nome: propostaItens.nome,
      descricao: descricaoDoItemSql,
      tipo: propostaItens.tipo,
      quantidade: propostaItens.quantidade,
      valorUnitario: propostaItens.valorUnitario,
      subtotal: propostaItens.subtotal,
      servicoCatalogoId: propostaItens.servicoCatalogoId,
    })
    .from(propostaGrupoComercialItens)
    .innerJoin(propostaItens, eq(propostaGrupoComercialItens.propostaItemId, propostaItens.id))
    .leftJoin(servicosCatalogo, eq(servicosCatalogo.id, propostaItens.servicoCatalogoId))
    .where(eq(propostaGrupoComercialItens.grupoId, grupoId))
    .orderBy(asc(propostaItens.ordem));

  const serviceFamily = grupo.serviceFamily ?? (await calcularFamiliaDoGrupo(grupoId));
  const tipoDocumento = tipoDocumentoDoContratual(proposta.tipoContratual);
  const politica = await politicaContratual(proposta.organizacaoId);
  const codigoMoeda = proposta.moeda || "BRL";

  const valorTotal = itensDoGrupo.reduce((s, i) => s + parseFloat(i.subtotal || "0"), 0);
  const mrr = itensDoGrupo.filter((i) => i.tipo === "recorrente").reduce((s, i) => s + parseFloat(i.subtotal || "0"), 0);
  const setup = itensDoGrupo.filter((i) => i.tipo === "setup").reduce((s, i) => s + parseFloat(i.subtotal || "0"), 0);
  const itensDescricao = itensDoGrupo.map((i) => `${i.nome} (${i.tipo})`).join(", ");
  const doTipo = (tipos: string[]) => itensDoGrupo.filter((item) => tipos.includes(item.tipo));
  const descreverItens = (tipos: string[]) => doTipo(tipos)
    .map((item) => [
      item.nome,
      item.descricao || "—",
      `Qtd. ${Number(item.quantidade || 1).toLocaleString("pt-BR")}`,
      moeda(parseFloat(item.valorUnitario || "0"), codigoMoeda),
      moeda(parseFloat(item.subtotal || "0"), codigoMoeda),
    ].join(" | "))
    .join("\n");
  const linhas = (tipos: string[], comRecorrencia: boolean) => linhasDeItens(itensDoGrupo, tipos, { comRecorrencia, familia: serviceFamily, moeda: codigoMoeda });

  const signatarios = Array.isArray(proposta.signatarios)
    ? proposta.signatarios.filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    : [];
  // Quem assina pelo cliente vem primeiro; a Callface (representante, testemunhas) é lida por papel.
  const doCliente = signatarios.filter((s) => ehCliente(s));
  const principal = doCliente[0];
  const testemunha = (papel: string) => signatarios.find((s) => s.papel === papel);
  const editor = (proposta.editor ?? {}) as { ct?: Record<string, unknown> };
  const multaDaProposta = Number(String(editor.ct?.multa ?? "").replace(",", "."));
  const multa = multaDaProposta > 0 ? multaDaProposta : politica.multaRescisoriaPct;
  const hoje = new Date();
  const numeroProposta = `P-${String(proposta.numero).padStart(3, "0")}-v${proposta.versao}`;
  const tipoPag = proposta.condicaoPagamentoTipo ? FORMA_PAGAMENTO[proposta.condicaoPagamentoTipo] : undefined;
  const parcelas = proposta.parcelas && proposta.parcelas > 1 ? proposta.parcelas : 1;
  const formaSetup = setup <= 0 ? "Sem setup"
    : tipoPag ? (parcelas > 1 ? `Em ${parcelas}x, ${tipoPag}` : `À vista, ${tipoPag}`)
    : (proposta.condicoesPagamento || "").trim();
  const cidade = empresa?.cidade || lead?.empresaCidade || "";
  const estado = empresa?.estado || lead?.empresaEstado || "";

  // Downgrade: multa = percentual × valor reduzido × meses que faltam do contrato
  // principal (cláusula 8.9 do contrato: "valor reduzido considerando-o
  // mensalmente até o tempo restante do contrato").
  let mesesRestantes = "";
  let multaDowngrade = "";
  if (tipoDocumento === "DOWNGRADE" && proposta.contratoBaseId && politica.multaRescisoriaPct) {
    const [base] = await db.select({ inicio: contratos.inicio, prazo: contratos.prazoMeses, vencimento: contratos.vencimento }).from(contratos).where(eq(contratos.id, proposta.contratoBaseId)).limit(1);
    const fim = base?.vencimento ? new Date(base.vencimento) : base?.inicio && base.prazo ? new Date(vencimentoPorMeses(new Date(base.inicio), base.prazo) ?? "") : null;
    if (fim && !isNaN(fim.getTime())) {
      const meses = Math.max(0, (fim.getUTCFullYear() - hoje.getUTCFullYear()) * 12 + (fim.getUTCMonth() - hoje.getUTCMonth()) + (fim.getUTCDate() > hoje.getUTCDate() ? 1 : 0));
      mesesRestantes = String(meses);
      multaDowngrade = moeda((politica.multaRescisoriaPct / 100) * mrr * meses, codigoMoeda);
    }
  }

  const variaveis: Record<string, string> = {
    // O quadro das partes pede razão social. `empresas.nome` costuma ser o fantasia.
    empresa_nome: empresa?.razaoSocial || "",
    empresa_razao_social: empresa?.razaoSocial || "",
    empresa_nome_fantasia: empresa?.nome || lead?.empresa || "",
    empresa_cnpj: empresa?.cnpj || lead?.empresaCnpj || "",
    pessoa_nome: String(principal?.nome || "") || (lead ? [lead.nome, lead.sobrenome].filter(Boolean).join(" ") : ""),
    pessoa_email: String(principal?.email || "") || lead?.email || "",
    itens_descricao: itensDescricao,
    empresa_endereco: enderecoCompleto(empresa, lead),
    empresa_logradouro: empresa?.logradouro || empresa?.endereco || "",
    empresa_numero: empresa?.numero || "",
    empresa_complemento: empresa?.complemento || "",
    empresa_bairro: empresa?.bairro || "",
    empresa_cidade: cidade,
    empresa_estado: estado,
    empresa_cep: empresa?.cep || "",
    pessoa_cargo: String(principal?.cargo || "") || lead?.cargo || "",
    pessoa_cpf: String(principal?.cpf || ""),
    valor_total: moeda(valorTotal, codigoMoeda),
    itens_recorrentes: descreverItens(["recorrente", "avulso"]),
    itens_setup: descreverItens(["setup"]),
    itens_recorrentes_html: linhas(["recorrente", "avulso"], false),
    itens_licencas_html: linhas(["recorrente", "avulso"], true),
    itens_setup_html: linhas(["setup"], false),
    mrr_total: moeda(mrr, codigoMoeda),
    setup_total: moeda(setup, codigoMoeda),
    forma_pagamento_setup: formaSetup,
    prazo_meses: proposta.prazoContratoMeses ? String(proposta.prazoContratoMeses) : "",
    prazo_descricao: proposta.prazoContratoMeses ? `${proposta.prazoContratoMeses} meses` : "",
    condicoes_pagamento: (proposta.condicoesPagamento || "").trim(),
    signatarios: doCliente.map((s) => `${String(s.nome || "")} <${String(s.email || "")}>`).join(", "),
    data_inicio_cobranca: dataCurta(hoje),
    data_inicio_vigencia: dataCurta(hoje),
    data_emissao: dataExtenso(hoje),
    // Qualificação da CONTRATADA, uma vez só: mudança cadastral não exige reeditar os modelos.
    callface_razao_social: "CALLFACE SOFTWARE E SERVIÇOS LTDA.",
    callface_cnpj: "39.764.520/0001-06",
    callface_endereco: "Avenida Pierre Simon de Laplace nº 740, sala 4, Bairro Techno Park, Campinas – SP, CEP: 13.069-320",
    proposta_numero: numeroProposta,
    contrato_base_numero: await numeroDoContratoBase(proposta.contratoBaseId),
    // Não existe numeração própria de contrato: o código que o comercial reconhece é o da proposta.
    contrato_numero: numeroProposta,
    dia_vencimento: proposta.vencimentoDias ? `${proposta.vencimentoDias} dias após a emissão da cobrança` : "",
    cidade_uf: [cidade, estado].filter(Boolean).join(" - "),
    // A multa digitada na proposta (modal "Dados do contrato") ganha do padrão de Ajustes > Contratos.
    percentual_multa: multa ? `${multa.toLocaleString("pt-BR")}%` : "",
    percentual_multa_numero: multa ? multa.toLocaleString("pt-BR") : "",
    meses_restantes_contrato_base: mesesRestantes,
    valor_multa_downgrade: multaDowngrade,
    limite_armazenamento_gravacoes: politica.limiteGravacoes ?? "",
    testemunha_1_nome: String(testemunha("testemunha_vendedor")?.nome || ""), testemunha_1_cpf: String(testemunha("testemunha_vendedor")?.cpf || ""),
    testemunha_2_nome: String(testemunha("testemunha_2")?.nome || ""), testemunha_2_cpf: String(testemunha("testemunha_2")?.cpf || ""),
  };
  return { variaveis, proposta, grupo, serviceFamily, tipoDocumento, itens: itensDoGrupo, mrr, setup };
}

/**
 * Modelo + variáveis do grupo, e o que falta para o contrato poder sair.
 * `faltando` vazio = pode enviar. Mensagens já em palavras de quem vai corrigir.
 */
async function conferirGrupo(grupoId: string) {
  const dados = await montarVariaveisDoGrupo(grupoId);
  const template = await escolherTemplate(dados.proposta.organizacaoId, dados.grupo.commercialModel, dados.serviceFamily, dados.tipoDocumento);
  const faltando: string[] = [];
  // Modelo genérico (sem família) é o texto de seis linhas que o cliente viu no Documenso.
  // Contrato real nunca sai com ele: sem modelo da família, bloqueia.
  if (!template || template.serviceFamily === null) {
    const rotulo = `${ROTULO_DOCUMENTO[dados.tipoDocumento] ?? "Contrato"}${ROTULO_FAMILIA_DOC[dados.serviceFamily] ? ` ${ROTULO_FAMILIA_DOC[dados.serviceFamily]}` : ""}`;
    faltando.push(`modelo "${rotulo}" cadastrado em Ajustes > Contratos`);
  } else {
    for (const f of variaveisFaltando(template.corpoTemplate, dados.variaveis)) faltando.push(dicaDaVariavel(f.chave, f.rotulo));
  }
  return { dados, template, faltando: [...new Set(faltando)] };
}

/** Pré-checagem para o envio da proposta: o contrato pronto não pode depender de dado que ainda não existe. */
export async function conferirContratoDoGrupo(grupoId: string): Promise<string[]> {
  return (await conferirGrupo(grupoId)).faltando;
}

/**
 * Resolve+renderiza o corpo do contrato. Nunca retorna corpo vazio: sem
 * template configurado, cai no texto mínimo (só para o Won manual de
 * negocios.ts, que não passa por assinatura — o envio é bloqueado por `conferirGrupo`).
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

/** Título legível do envelope e do arquivo: "Contrato White Label · Empresa · P-123-v1". */
export function tituloDoDocumento(tipoDocumento: string, serviceFamily: string | null | undefined, empresa: string, numero: string): string {
  return [`${ROTULO_DOCUMENTO[tipoDocumento] ?? "Contrato"}${serviceFamily && ROTULO_FAMILIA_DOC[serviceFamily] ? ` ${ROTULO_FAMILIA_DOC[serviceFamily]}` : ""}`, empresa, numero]
    .filter(Boolean).join(" · ");
}

/**
 * Gera (cria) o contrato do grupo a partir do template ativo. O padrão é
 * preparar o documento, sem notificar signatários. Isso permite que o
 * contrato exista antes do envio da proposta, como exige o fluxo comercial;
 * a distribuição só acontece depois de ProposalAccepted.
 */
export async function gerarContratoDeTemplate(grupoId: string): Promise<{ contratoId: string }> {
  const [existente] = await db.select({ contratoId: propostaGrupoComercial.contratoId }).from(propostaGrupoComercial).where(eq(propostaGrupoComercial.id, grupoId)).limit(1);
  if (!existente) throw new Error(`Grupo comercial ${grupoId} não encontrado`);
  if (existente.contratoId) return { contratoId: existente.contratoId };

  const { variaveis, proposta, grupo, serviceFamily, tipoDocumento, itens, mrr, setup } = await montarVariaveisDoGrupo(grupoId);
  const { corpoGerado, templateId, templateVersao } = await resolverCorpoContrato(proposta.organizacaoId, grupo.commercialModel, variaveis, serviceFamily, tipoDocumento);
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
    tipo: itens[0]?.nome || "proposta",
    // A descrição vira o título do envelope no Documenso e o nome do arquivo.
    descricao: tituloDoDocumento(tipoDocumento, serviceFamily, variaveis.empresa_nome_fantasia || variaveis.empresa_razao_social, variaveis.contrato_numero),
    moeda: proposta.moeda || "BRL",
    mrr: mrr > 0 ? mrr.toFixed(2) : undefined,
    valorSetup: setup > 0 ? setup.toFixed(2) : undefined,
    inicio: dataIsoUtc(inicioContrato),
    vencimento: vencimentoPorMeses(inicioContrato, proposta.prazoContratoMeses),
    prazoMeses: proposta.prazoContratoMeses || undefined,
    servicos: itens.map((i) => i.nome),
    status: "pendente_assinatura",
    assinaturaStatus: "pendente",
    signatureStatus: "contract_created",
    produto: await determinarProdutoProposta(itens),
    // Frente 2C.1 — a família comercial do contrato é gravada na criação: o
    // gate de evidência precisa saber que aquele contrato é de PABX/White Label.
    serviceFamily,
  }).returning();

  return { contratoId: contrato.id };
}

/**
 * Antes de ir ao provedor: refaz variáveis e modelo com o que o sistema sabe
 * agora, confere o que falta e regrava o corpo. O rascunho foi gerado quando a
 * proposta saiu; entre isso e o aceite o cliente pode ter completado a empresa,
 * e o modelo pode ter ganhado versão. Sem esta passada o contrato ia com o
 * retrato antigo.
 */
export async function prepararContratoParaEnvio(contratoId: string): Promise<void> {
  const [contrato] = await db.select().from(contratos).where(eq(contratos.id, contratoId)).limit(1);
  if (!contrato) throw new Error(`Contrato ${contratoId} não encontrado`);
  if (!contrato.grupoComercialId) throw new ContratoIncompletoError(["vínculo com o grupo comercial da proposta (contrato criado fora do fluxo de propostas)"]);
  const { dados, template, faltando } = await conferirGrupo(contrato.grupoComercialId);
  if (faltando.length > 0 || !template) throw new ContratoIncompletoError(faltando);
  await db.update(contratos).set({
    templateId: template.id,
    templateVersao: template.versao,
    variaveisPreenchidas: dados.variaveis,
    corpoGerado: renderizarCorpo(template.corpoTemplate, dados.variaveis),
    descricao: tituloDoDocumento(dados.tipoDocumento, dados.serviceFamily, dados.variaveis.empresa_nome_fantasia || dados.variaveis.empresa_razao_social, dados.variaveis.contrato_numero),
    updatedAt: new Date(),
  }).where(eq(contratos.id, contratoId));
}

/** Distribui o contrato previamente preparado aos signatários após o aceite. */
export async function enviarContratoParaAssinatura(contratoId: string): Promise<void> {
  const [antes] = await db.select().from(contratos).where(eq(contratos.id, contratoId)).limit(1);
  if (!antes) throw new Error(`Contrato ${contratoId} não encontrado`);
  if (antes.signatureStatus === "signed") return;
  // Já enviado ao provedor: reenviar abriria um SEGUNDO documento para o cliente assinar (retomada de aceite,
  // duplo clique, retry). O link e o estado do que já foi enviado seguem valendo.
  if (antes.signatureProviderRef) return;
  await prepararContratoParaEnvio(contratoId);
  const [contrato] = await db.select().from(contratos).where(eq(contratos.id, contratoId)).limit(1);
  const provider = getSignatureProvider();
  const resultado = await provider.enviarParaAssinatura(contrato.id, {
    signatarios: Array.isArray(contrato.signatarios) ? contrato.signatarios : [],
    titulo: contrato.descricao || `Contrato Callface ${contrato.id.slice(0, 8)}`,
  });
  // Frente 2C.1 — campos provider-agnósticos preenchidos aqui (contrato_provider
  // e sent_at do pedido). `signature_public_url` fica pro provider que tiver URL
  // externa de verdade: no aceite eletrônico simples o link é a própria página
  // pública do CRM, e inventar uma seria mentir.
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
