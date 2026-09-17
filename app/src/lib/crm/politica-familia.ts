/**
 * Frente 2C.1 — POLÍTICA COMERCIAL POR FAMÍLIA: fonte única da verdade de
 * "o que fecha a venda" e "pra onde o cliente vai depois".
 *
 * Regra real (Kauã, 01/09), textual:
 *  - Callface AI  → não exige contrato; exige PAGAMENTO confirmado pra ganho.
 *  - PABX         → exige contrato; contrato ASSINADO já basta pra ganho,
 *                   mesmo com pagamento pendente.
 *  - White Label  → igual PABX; trilha de entrega própria (implantação White
 *                   Label não é implantação PABX).
 *  - Qualquer outra família sem regra clara → NUNCA ganho automático:
 *                   fica em "aceita — aguardando validação".
 *
 * Por que existe como módulo próprio: antes desta frente a mesma decisão
 * estava espalhada e DIVERGENTE em 4 lugares — `commercial-model.ts` (decide
 * contrato pelo modelo comercial do item, não pela família),
 * `won-evidence.ts` (default hardcoded exigindo pagamento sempre, porque
 * `won_evidence_policies` tinha ZERO linhas em dev e produção),
 * `fulfillment.ts` (`FAMILIAS_ONBOARDING` = AI + White Label) e
 * `analytics/inicio.ts` (Onboarding = só AI; Implantação = PABX + White
 * Label). Resultado prático da divergência: White Label não aparecia em
 * NENHUM bucket da Carteira. Agora tem um lugar só.
 *
 * O que este módulo NÃO faz: não substitui `commercial-model.ts`. O modelo
 * comercial do ITEM continua decidindo se aquele grupo passa por contrato
 * (uma negociação de Callface AI COM fidelidade existe e é legítima — ver
 * ADR-EXEC-021). A família decide qual EVIDÊNCIA fecha a venda e pra qual
 * trilha de entrega o cliente vai.
 */
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  oportunidadeItens, propostas, propostaGrupoComercial, propostaGrupoComercialItens, propostaItens, servicosCatalogo, catalogoPrecos,
} from "@/lib/db/schema";
import { classificarItensDaProposta, classificarProdutoPorNome, type FamiliaServico } from "@/lib/crm/classificar-produto";
import type { TipoEvidenciaComercial } from "@/lib/crm/won-evidence";
import { exigeContrato as exigeContratoPorModelo, type CommercialModel } from "@/lib/crm/commercial-model";

export type { FamiliaServico };

/** Trilha de entrega pós-ganho. Cada uma tem tela/fila própria hoje. */
export type TrilhaPosGanho = "onboarding" | "implantacao_pabx" | "implantacao_white_label" | "validacao_manual";

export interface RegraFamilia {
  familia: FamiliaServico;
  /** Precisa de contrato assinado antes de cobrar? (regra de família, não do item) */
  exigeContrato: boolean;
  /** Pagamento confirmado é condição pra virar ganho? */
  exigePagamentoParaGanho: boolean;
  /** Evidência que, sozinha, fecha a venda desta família. */
  evidenciaDeGanho: TipoEvidenciaComercial | null;
  /** Trilha de entrega pós-ganho. */
  trilha: TrilhaPosGanho;
  /** Rótulo da trilha pra notificação/timeline. */
  trilhaLabel: string;
  /**
   * Cria responsável + 1ª tarefa + notificação automaticamente ao materializar
   * o serviço? PABX é `false` de propósito: Implantação PABX já tem o fluxo
   * próprio dela (formulário de implantação), não deve ganhar uma tarefa
   * genérica de reunião em cima. Comportamento preservado da 25/08.
   */
  automacaoInicial: boolean;
  tarefaInicial: string | null;
}

const REGRAS: Record<FamiliaServico, RegraFamilia> = {
  CALLFACE_AI: {
    familia: "CALLFACE_AI",
    exigeContrato: false,
    exigePagamentoParaGanho: true,
    evidenciaDeGanho: "stripe_payment",
    trilha: "onboarding",
    trilhaLabel: "Onboarding",
    automacaoInicial: true,
    tarefaInicial: "Agendar reunião de onboarding com o cliente",
  },
  PABX: {
    familia: "PABX",
    exigeContrato: true,
    exigePagamentoParaGanho: false,
    evidenciaDeGanho: "signed_contract",
    trilha: "implantacao_pabx",
    trilhaLabel: "Implantação PABX",
    automacaoInicial: false,
    tarefaInicial: null,
  },
  WHITE_LABEL: {
    familia: "WHITE_LABEL",
    exigeContrato: true,
    exigePagamentoParaGanho: false,
    evidenciaDeGanho: "signed_contract",
    trilha: "implantacao_white_label",
    trilhaLabel: "Implantação White Label",
    // White Label entra sem dono: alguém do time precisa escolher
    // explicitamente "Definir responsável" antes do primeiro contato. Não
    // herda o comercial, porque esse nem sempre será quem executará a
    // implantação.
    automacaoInicial: false,
    tarefaInicial: null,
  },
  // Sem regra clara = sem ganho automático. Nunca chuta pagamento nem
  // contrato: alguém do time valida na mão (registrarEvidenciaManual).
  UNKNOWN: {
    familia: "UNKNOWN",
    exigeContrato: false,
    exigePagamentoParaGanho: true,
    evidenciaDeGanho: null,
    trilha: "validacao_manual",
    trilhaLabel: "Validação manual",
    automacaoInicial: false,
    tarefaInicial: null,
  },
};

export function regraDaFamilia(familia: string | null | undefined): RegraFamilia {
  if (familia && familia in REGRAS) return REGRAS[familia as FamiliaServico];
  return REGRAS.UNKNOWN;
}

/** Uma família fecha a venda só com contrato assinado? (PABX, White Label) */
export function ganhaPorContrato(familia: string | null | undefined): boolean {
  const r = regraDaFamilia(familia);
  return r.evidenciaDeGanho === "signed_contract";
}

/**
 * Este grupo precisa de contrato assinado antes da cobrança?
 *
 * A exigência da FAMÍLIA é um PISO, não um override: o catálogo/vendedor pode
 * ADICIONAR contrato onde a família não exige (Callface AI vendido com
 * fidelidade — ADR-EXEC-021), mas não pode REMOVER contrato de PABX/White
 * Label.
 *
 * Isso não é preciosismo teórico: medido no banco real, os 218 itens do
 * catálogo estão TODOS com `commercial_model_padrao = 'PAGAMENTO_DIRETO'` e
 * `requer_contrato = false`. Sem o piso, uma venda PABX seguia direto pro
 * checkout, nunca gerava contrato, e a regra "PABX fecha por assinatura"
 * nunca teria o que assinar.
 */
export function exigeContratoNoGrupo(commercialModel: string, familia: string | null | undefined): boolean {
  return exigeContratoPorModelo(commercialModel as CommercialModel) || regraDaFamilia(familia).exigeContrato;
}

/**
 * Versão que consulta o CATÁLOGO OFICIAL antes de aplicar o piso da família.
 *
 * Regra explícita do briefing de catálogo (item 7): White Label vendido como
 * LICENÇA isolada, pra quem já é cliente White Label, NÃO exige contrato — mas
 * o SETUP exige. A planilha oficial declara isso por price
 * (`catalogo_precos.exige_contrato`: 'nao' na Licença, 'sim' no Setup). O piso
 * por família, sozinho, forçaria contrato nos dois e quebraria essa venda.
 *
 * Precedência:
 *   1. modelo comercial do item (override explícito do vendedor) — se exige, exige;
 *   2. declaração do PRICE oficial — quando o grupo tem item do catálogo novo,
 *      ela é a fonte da verdade, inclusive pra dizer que NÃO exige;
 *   3. piso da família — só quando não há nenhum item oficial no grupo, que é
 *      o caso de todo item legado (sem price declarado).
 */
export async function exigeContratoNoGrupoAsync(
  grupoId: string,
  commercialModel: string,
  familia: string | null | undefined,
): Promise<boolean> {
  if (exigeContratoPorModelo(commercialModel as CommercialModel)) return true;

  const declaracoes = await db
    .select({ exigeContrato: catalogoPrecos.exigeContrato })
    .from(propostaGrupoComercialItens)
    .innerJoin(propostaItens, eq(propostaItens.id, propostaGrupoComercialItens.propostaItemId))
    .innerJoin(catalogoPrecos, eq(catalogoPrecos.id, propostaItens.catalogoPrecoId))
    .where(eq(propostaGrupoComercialItens.grupoId, grupoId));

  if (declaracoes.length > 0) return declaracoes.some((d) => d.exigeContrato);
  return regraDaFamilia(familia).exigeContrato;
}

export function trilhaPosGanho(familia: string | null | undefined): TrilhaPosGanho {
  return regraDaFamilia(familia).trilha;
}

/** Famílias que caem em cada trilha — usado por rotas/telas pra filtrar sem duplicar a regra. */
export const FAMILIAS_POR_TRILHA: Record<TrilhaPosGanho, FamiliaServico[]> = {
  onboarding: (Object.values(REGRAS).filter((r) => r.trilha === "onboarding").map((r) => r.familia)),
  implantacao_pabx: (Object.values(REGRAS).filter((r) => r.trilha === "implantacao_pabx").map((r) => r.familia)),
  implantacao_white_label: (Object.values(REGRAS).filter((r) => r.trilha === "implantacao_white_label").map((r) => r.familia)),
  validacao_manual: (Object.values(REGRAS).filter((r) => r.trilha === "validacao_manual").map((r) => r.familia)),
};

/**
 * Resolve a família comercial de UM grupo, em ordem decrescente de confiança:
 *
 *  1. `proposta_grupo_comercial.service_family` — já resolvido e persistido
 *     no aceite (cache; nunca recalcula depois pra não mudar a regra de um
 *     negócio em curso se o catálogo for editado no meio).
 *  2. `oportunidade_itens.service_family` do grupo — fonte autoritativa do
 *     Commercial Core quando o dual-write funcionou.
 *  3. `servicos_catalogo.service_family` declarado dos itens da proposta.
 *  4. `classificarItensDaProposta` (regra de código por nome) — último
 *     recurso, porque em produção o catálogo está quase todo UNKNOWN.
 *
 * Em qualquer um dos passos, o desempate é por VALOR: a família de maior
 * receita dentro do grupo é a família do grupo. Grupo é por modelo comercial,
 * não por família, então tecnicamente ele PODE ter famílias mistas — e nesse
 * caso a de maior valor é a que manda (mesma régua que a proposta já usa pra
 * "família principal"). Retorna UNKNOWN quando não há sinal nenhum, nunca um
 * palpite.
 */
export async function resolverFamiliaDoGrupo(grupoId: string): Promise<FamiliaServico> {
  const [grupo] = await db
    .select({ serviceFamily: propostaGrupoComercial.serviceFamily, propostaId: propostaGrupoComercial.propostaId })
    .from(propostaGrupoComercial)
    .where(eq(propostaGrupoComercial.id, grupoId))
    .limit(1);
  if (!grupo) return "UNKNOWN";
  if (grupo.serviceFamily && grupo.serviceFamily !== "UNKNOWN") return grupo.serviceFamily as FamiliaServico;

  const familia = await calcularFamiliaDoGrupo(grupoId);
  // Persiste o resultado (cache + auditoria de qual regra valeu pra este grupo).
  if (familia !== "UNKNOWN") {
    await db.update(propostaGrupoComercial).set({ serviceFamily: familia, updatedAt: new Date() }).where(eq(propostaGrupoComercial.id, grupoId));
  }
  return familia;
}

/** O cálculo puro, sem cache — separado pra poder ser chamado no aceite (quando o cache ainda não existe). */
export async function calcularFamiliaDoGrupo(grupoId: string): Promise<FamiliaServico> {
  // 2. oportunidade_itens (Commercial Core)
  const itensOportunidade = await db
    .select({ serviceFamily: oportunidadeItens.serviceFamily, valorTotal: oportunidadeItens.valorTotal })
    .from(oportunidadeItens)
    .where(eq(oportunidadeItens.grupoComercialId, grupoId));
  const porOportunidade = dominante(itensOportunidade.map((i) => ({ familia: i.serviceFamily, valor: num(i.valorTotal) })));
  if (porOportunidade !== "UNKNOWN") return porOportunidade;

  // 3./4. itens da proposta: catálogo declarado, depois regra por nome.
  const itensProposta = await db
    .select({
      nome: propostaItens.nome,
      subtotal: propostaItens.subtotal,
      familiaItem: propostaItens.serviceFamily,
      familiaCatalogo: servicosCatalogo.serviceFamily,
    })
    .from(propostaGrupoComercialItens)
    .innerJoin(propostaItens, eq(propostaGrupoComercialItens.propostaItemId, propostaItens.id))
    .leftJoin(servicosCatalogo, eq(propostaItens.servicoCatalogoId, servicosCatalogo.id))
    .where(eq(propostaGrupoComercialItens.grupoId, grupoId));
  if (itensProposta.length === 0) return "UNKNOWN";

  const declarada = dominante(itensProposta.map((i) => ({ familia: i.familiaItem || i.familiaCatalogo, valor: num(i.subtotal) })));
  if (declarada !== "UNKNOWN") return declarada;

  const classificados = classificarItensDaProposta(itensProposta.map((i) => ({ nome: i.nome, valor: num(i.subtotal) })));
  return dominante(classificados.map((i) => ({ familia: i.familia, valor: i.valor })));
}

/**
 * Propaga a família resolvida pros `oportunidade_itens` do grupo que ainda
 * estão UNKNOWN. Sem isso o serviço canônico nasce UNKNOWN e o fulfillment vem
 * SEM CHECKLIST (achado real na simulação da 2C.1: os 3 cenários criaram
 * serviço UNKNOWN com 0 itens de checklist, porque `composicao-comercial.ts`
 * deriva a família do catálogo — que está UNKNOWN em 218/218 itens).
 *
 * Nunca sobrescreve uma família já declarada: só preenche o que está vazio.
 * Cada item é classificado pelo próprio nome primeiro; só cai na família
 * dominante do grupo quando o nome dele não diz nada (o caso dos itens
 * genéricos tipo "Setup", "Starter").
 */
export async function propagarFamiliaNosItensDoGrupo(grupoId: string, familiaDominante: FamiliaServico): Promise<number> {
  const itens = await db
    .select({ id: oportunidadeItens.id, produto: oportunidadeItens.produto, serviceFamily: oportunidadeItens.serviceFamily })
    .from(oportunidadeItens)
    .where(eq(oportunidadeItens.grupoComercialId, grupoId));

  let atualizados = 0;
  for (const item of itens) {
    if (item.serviceFamily && item.serviceFamily !== "UNKNOWN") continue;
    const porNome = classificarProdutoPorNome(item.produto);
    const familia = porNome !== "UNKNOWN" ? porNome : familiaDominante;
    if (familia === "UNKNOWN") continue;
    await db.update(oportunidadeItens).set({ serviceFamily: familia, updatedAt: new Date() }).where(eq(oportunidadeItens.id, item.id));
    atualizados++;
  }
  return atualizados;
}

/** A família de MAIOR valor entre as informadas; UNKNOWN se nenhuma é classificável. */
function dominante(itens: { familia: string | null | undefined; valor: number }[]): FamiliaServico {
  const soma = new Map<FamiliaServico, number>();
  for (const i of itens) {
    const f = i.familia;
    if (!f || f === "UNKNOWN" || !(f in REGRAS)) continue;
    soma.set(f as FamiliaServico, (soma.get(f as FamiliaServico) ?? 0) + i.valor);
  }
  if (soma.size === 0) return "UNKNOWN";
  return [...soma.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : parseFloat(v) || 0;
}

/**
 * Data de vencimento do pagamento pendente de um grupo, quando existir de
 * verdade. Deriva de `propostas.vencimento_dias` (condição de pagamento
 * estruturada, já preenchida no builder) contado da assinatura. Sem esse dado
 * retorna null — pendência sem vencimento é registrada honestamente como "sem
 * vencimento definido", nunca com uma data inventada.
 */
export async function resolverVencimentoDoGrupo(grupoId: string, base: Date): Promise<Date | null> {
  const [row] = await db
    .select({ vencimentoDias: propostas.vencimentoDias })
    .from(propostaGrupoComercial)
    .innerJoin(propostas, eq(propostas.id, propostaGrupoComercial.propostaId))
    .where(eq(propostaGrupoComercial.id, grupoId))
    .limit(1);
  const dias = row?.vencimentoDias;
  if (!dias || dias <= 0) return null;
  return new Date(base.getTime() + dias * 24 * 60 * 60 * 1000);
}
