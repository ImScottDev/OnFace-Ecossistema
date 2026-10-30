/**
 * Regras PURAS do backfill do histórico comercial (propostas, vínculo, evidência).
 *
 * Existe porque o histórico que veio do CRM anterior (carga Marco Zero) chegou com `service_family` vazio de
 * propósito: "sem evidência fica NULL, nunca PABX". Esta camada é a evidência. Cada decisão devolve a FONTE e a
 * CONFIANÇA, para o que não casa virar lista de revisão humana em vez de palpite.
 *
 * Sem banco, sem I/O: é o que `backfill-historico-propostas.ts` chama e o que o teste prova. Reaproveita o
 * classificador que já existe (`classificarLegado`: ajuste, planilha oficial, regra por nome). Não cria segundo.
 */
import { classificarLegado } from "@/lib/crm/classificar-legado";

export const FAMILIAS = ["PABX", "CALLFACE_AI", "WHITE_LABEL"] as const;
export type Familia = (typeof FAMILIAS)[number];
const ehFamilia = (f: string | null | undefined): f is Familia => !!f && (FAMILIAS as readonly string[]).includes(f);

export type FonteFamilia = "item" | "catalogo_oficial" | "planilha_oficial" | "regra_nome" | "contexto_da_proposta";
export type ConfiancaFamilia = "CONFIRMED" | "PROBABLE";

/* ───────────────────────────── 1. Família do item e da proposta ───────────────────────────── */

export interface ItemEntrada {
  id: string;
  nome: string | null;
  subtotal: number;
  /** `proposta_itens.service_family` como está hoje (vazio ou UNKNOWN não vale como resposta). */
  familiaDoItem: string | null;
  /** `servicos_catalogo.service_family` do produto ligado ao item. */
  familiaDoCatalogo: string | null;
}

export interface ItemDecidido {
  id: string;
  familia: Familia | null;
  fonte: FonteFamilia | null;
  confianca: ConfiancaFamilia | null;
  /** Reajuste, desconto, crédito, multa, frete: não é produto, não tem família e não pesa na da proposta. */
  ajuste: boolean;
  /** true = há família nova a gravar neste item (o que já tinha família nunca é regravado). */
  gravar: boolean;
  motivo: string;
}

export type ResultadoFamilia = "unica" | "mista" | "sem_evidencia" | "so_ajuste";

export interface FamiliaDaProposta {
  itens: ItemDecidido[];
  familia: Familia | null;
  confianca: ConfiancaFamilia | null;
  resultado: ResultadoFamilia;
  /** Soma de subtotal por família, só dos itens decididos. Serve à revisão humana da proposta mista. */
  porFamilia: Partial<Record<Familia, number>>;
}

/**
 * Ordem de evidência de UM item (a primeira que responde vence):
 *   1. a família que o item já tem (nunca trocada);
 *   2. a do produto de catálogo oficial ligado ao item            -> CONFIRMED
 *   3. nome declarado na planilha oficial (time comercial)         -> CONFIRMED
 *   4. regra por nome ("linha sip", "callface ai", "white label")  -> PROBABLE
 * O que sobra é genérico ("Setup", "Starter", "Integração") e só se resolve por contexto, na proposta.
 */
function decidirItem(i: ItemEntrada): ItemDecidido {
  const base = { id: i.id, ajuste: false, gravar: false };
  if (ehFamilia(i.familiaDoItem)) {
    return { ...base, familia: i.familiaDoItem, fonte: "item", confianca: "CONFIRMED", motivo: "o item já tinha família" };
  }
  const c = classificarLegado(i.nome);
  if (c.ruleSource === "regra_ajuste") {
    return { ...base, ajuste: true, familia: null, fonte: null, confianca: null, motivo: "ajuste financeiro, não é produto" };
  }
  if (ehFamilia(i.familiaDoCatalogo)) {
    return { ...base, gravar: true, familia: i.familiaDoCatalogo, fonte: "catalogo_oficial", confianca: "CONFIRMED", motivo: "família do produto de catálogo oficial" };
  }
  if (ehFamilia(c.serviceFamily) && c.ruleSource === "planilha_oficial") {
    return { ...base, gravar: true, familia: c.serviceFamily, fonte: "planilha_oficial", confianca: "CONFIRMED", motivo: c.evidencia };
  }
  if (ehFamilia(c.serviceFamily) && c.ruleSource === "regra_nome") {
    return { ...base, gravar: true, familia: c.serviceFamily, fonte: "regra_nome", confianca: "PROBABLE", motivo: c.evidencia };
  }
  return { ...base, familia: null, fonte: null, confianca: null, motivo: c.ruleSource === "generico_ambiguo" ? "nome genérico: depende do contexto" : "sem evidência no nome" };
}

/**
 * Família de TODAS as linhas de uma proposta e a da proposta.
 *
 * Genérico ("Setup") herda a família da proposta SÓ quando os demais itens apontam uma única família. Proposta
 * com mais de uma família é MISTA: nenhuma família é gravada nela (o item leva a sua) e ela vai para revisão,
 * porque `propostas.service_family` é uma só e escolher uma arma a política de Ganho errada.
 */
export function decidirFamiliaDaProposta(itens: ItemEntrada[]): FamiliaDaProposta {
  const decididos = itens.map(decidirItem);
  const produtos = decididos.filter((d) => !d.ajuste);

  const soma = (lista: ItemDecidido[]) => {
    const por: Partial<Record<Familia, number>> = {};
    lista.forEach((d) => {
      if (!d.familia) return;
      const valor = itens.find((i) => i.id === d.id)?.subtotal ?? 0;
      por[d.familia] = (por[d.familia] ?? 0) + valor;
    });
    return por;
  };
  const distintas = (p: Partial<Record<Familia, number>>) => Object.keys(p) as Familia[];

  let por = soma(produtos);
  if (distintas(por).length === 1) {
    const unica = distintas(por)[0];
    for (const d of produtos) {
      if (d.familia) continue;
      d.familia = unica; d.fonte = "contexto_da_proposta"; d.confianca = "PROBABLE"; d.gravar = true;
      d.motivo = "genérico: os outros itens da proposta são todos da mesma família";
    }
    por = soma(produtos);
  } else if (distintas(por).length > 1) {
    for (const d of produtos) if (!d.familia) d.motivo = "genérico em proposta de mais de uma família";
  }

  const fams = distintas(por);
  if (produtos.length === 0) return { itens: decididos, familia: null, confianca: null, resultado: "so_ajuste", porFamilia: por };
  if (fams.length === 0) return { itens: decididos, familia: null, confianca: null, resultado: "sem_evidencia", porFamilia: por };
  if (fams.length > 1) return { itens: decididos, familia: null, confianca: null, resultado: "mista", porFamilia: por };

  // Proposta inteira só vale CONFIRMED se todo item com família é CONFIRMED.
  const confianca: ConfiancaFamilia = produtos.every((d) => !d.familia || d.confianca === "CONFIRMED") ? "CONFIRMED" : "PROBABLE";
  return { itens: decididos, familia: fams[0], confianca, resultado: "unica", porFamilia: por };
}

/* ───────────────────────────── 2. Proposta sem negócio: de qual venda veio? ───────────────────────────── */

export interface PropostaSoDoLead {
  criadaEm: Date;
  totalRecorrente: number;
  totalGeral: number;
}
export interface NegocioCandidato {
  id: string;
  criadoEm: Date;
  mrrFechado: number;
  mrrEstimado: number;
  valorTotal: number;
}
export type NivelVinculo = "FORTE" | "REVISAR" | "SEM_CANDIDATO";
export interface DecisaoVinculo {
  nivel: NivelVinculo;
  /** FORTE: o negócio a ligar. REVISAR: o único candidato, só como sugestão. */
  negocioId: string | null;
  motivo: string;
  candidatos: number;
}

const DIA_MS = 86_400_000;
const confere = (a: number, b: number) => b > 0 && Math.abs(a - b) < 0.01;

/**
 * Só é FORTE quando três coisas batem ao mesmo tempo: o lead da proposta tem UM só negócio na vida, esse negócio
 * existia na data da proposta (até 1 dia depois, por fuso) e o valor dele é o da proposta. Qualquer coisa a menos
 * é sugestão para um humano, nunca ligação: ligar por proximidade seria inventar de qual venda a proposta veio.
 */
export function decidirVinculo(p: PropostaSoDoLead, candidatos: NegocioCandidato[]): DecisaoVinculo {
  if (candidatos.length === 0) return { nivel: "SEM_CANDIDATO", negocioId: null, motivo: "o lead não tem negócio", candidatos: 0 };
  if (candidatos.length > 1) {
    return { nivel: "REVISAR", negocioId: null, motivo: `o lead tem ${candidatos.length} negócios: não dá para saber qual`, candidatos: candidatos.length };
  }
  const [n] = candidatos;
  if (n.criadoEm.getTime() > p.criadaEm.getTime() + DIA_MS) {
    return { nivel: "REVISAR", negocioId: n.id, motivo: "o único negócio do lead nasceu depois da proposta", candidatos: 1 };
  }
  const valorBate = confere(n.mrrFechado, p.totalRecorrente) || confere(n.mrrEstimado, p.totalRecorrente) || confere(n.valorTotal, p.totalGeral);
  if (!valorBate) return { nivel: "REVISAR", negocioId: n.id, motivo: "o único negócio do lead existia, mas o valor não confere com a proposta", candidatos: 1 };
  return { nivel: "FORTE", negocioId: n.id, motivo: "único negócio do lead, anterior à proposta, com o mesmo valor", candidatos: 1 };
}

/* ───────────────────────────── 3. Evidência dos ganhos históricos ───────────────────────────── */

export type TipoEvidenciaHistorica = "stripe_subscription" | "stripe_payment" | "manual_contract";

export interface FatosDoGanho {
  ganhoEm: Date | null;
  contratos: { id: string; stripeSubscriptionId: string | null; criadoEm: Date }[];
  /** Assinaturas do Stripe que EXISTEM no espelho (`assinaturas`). Contrato apontando para assinatura que não existe não prova nada. */
  assinaturasNoEspelho: string[];
  faturasPagasNoStripe: { id: string; externalId: string | null; pagaEm: Date | null }[];
}
export interface EvidenciaHistorica {
  tipo: TipoEvidenciaHistorica;
  sourceRef: string;
  verificadoEm: Date | null;
  origem: string;
}

/**
 * Só vira linha em `comercial_evidencia` o que tem DOCUMENTO por trás: assinatura viva no Stripe, fatura paga no
 * Stripe, contrato registrado. Aceite de proposta NÃO é evidência (Bloco 03 §26), e `financial_attestation` só
 * nasce por pessoa autorizada, auditada. Ganho que só tem aceite ou que não tem nada devolve lista vazia: vai
 * para a revisão, onde um humano atesta ou desfaz.
 */
export function evidenciasDoGanho(f: FatosDoGanho): EvidenciaHistorica[] {
  const out: EvidenciaHistorica[] = [];
  const subs = new Set(f.assinaturasNoEspelho);
  for (const c of f.contratos) {
    if (c.stripeSubscriptionId && subs.has(c.stripeSubscriptionId)) {
      out.push({ tipo: "stripe_subscription", sourceRef: c.stripeSubscriptionId, verificadoEm: c.criadoEm, origem: "contrato_com_assinatura_no_stripe" });
    } else {
      out.push({ tipo: "manual_contract", sourceRef: c.id, verificadoEm: c.criadoEm, origem: "contrato_registrado_no_crm_anterior" });
    }
  }
  for (const fa of f.faturasPagasNoStripe) {
    out.push({ tipo: "stripe_payment", sourceRef: fa.externalId ?? fa.id, verificadoEm: fa.pagaEm ?? f.ganhoEm, origem: "fatura_paga_no_stripe" });
  }
  // Duas linhas com a mesma chave (tipo + ref) colapsam: é a chave única da tabela.
  const vistos = new Set<string>();
  return out.filter((e) => (vistos.has(`${e.tipo}|${e.sourceRef}`) ? false : (vistos.add(`${e.tipo}|${e.sourceRef}`), true)));
}
