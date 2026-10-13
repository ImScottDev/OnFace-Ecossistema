/**
 * Decisão de fechamento ITEM A ITEM: contrato ou pagamento (PURO).
 *
 * P1-13. Uma proposta pode misturar linhas com exigências opostas (Callface AI
 * Full, que se paga direto, com PABX, que se fecha por contrato). Decidir pela
 * proposta inteira — ou pelo grupo, olhando só a família de maior valor — faz
 * uma das linhas seguir o caminho errado: ou o cliente paga um PABX sem
 * contrato, ou assina contrato por um plano que se compra no cartão.
 *
 * Aqui cada LINHA tem o seu caminho, na ordem de precedência que já valia para
 * o grupo (`exigeContratoNoGrupoAsync`), agora aplicada por item:
 *
 *   1. modelo comercial da linha pede contrato (negociação com fidelidade);
 *   2. proposta em modo CONTRATO e a linha é Callface AI (Callface AI também se
 *      vende por contrato — o modo foi escolhido ANTES do envio);
 *   3. o PRICE declara se exige contrato (`catalogo_precos.exige_contrato`),
 *      mas só para ENDURECER: a família manda o piso, o price nunca o rebaixa;
 *   4. sem Price (linha legada): o piso da família (PABX e White Label exigem).
 *
 * Depois agrupa as linhas que seguem o mesmo caminho, com o mesmo modelo e a
 * mesma família: cada grupo vira UM contrato ou UM checkout, nunca dois, e uma
 * linha nunca cai num grupo que a obriga ao caminho errado.
 *
 * Aceite NÃO é ganho: nada aqui decide Ganho. A evidência que fecha a venda
 * continua sendo a política da oferta (`won-evidence.ts`).
 */

export type CaminhoDeFechamento = "contrato" | "pagamento";

export type MotivoDoCaminho = "modelo_comercial" | "modo_da_proposta" | "preco" | "familia";

export interface ItemParaDecisao {
  id: string;
  commercialModel: string;
  /** Família da linha (já resolvida: linha, catálogo ou nome). null/UNKNOWN = sem família. */
  familia: string | null;
  /** `catalogo_precos.exige_contrato` do Price da linha; null = a linha não tem Price. */
  exigeContratoDoPreco: boolean | null;
  subtotal: number;
}

export interface ContextoDaDecisao {
  /** `propostas.modo_fechamento`: PREPAID | CONTRACT | null. */
  modoFechamento: string | null;
  /** O piso da família: PABX e White Label exigem contrato. Injetado para este módulo não conhecer banco. */
  familiaExigeContrato: (familia: string | null) => boolean;
}

const MODELOS_COM_CONTRATO = ["CONTRATO_OBRIGATORIO", "CONTRATO_FIDELIDADE_OPCIONAL"];

export function caminhoDoItem(item: ItemParaDecisao, ctx: ContextoDaDecisao): { caminho: CaminhoDeFechamento; motivo: MotivoDoCaminho } {
  if (MODELOS_COM_CONTRATO.includes(item.commercialModel)) return { caminho: "contrato", motivo: "modelo_comercial" };
  if (ctx.modoFechamento === "CONTRACT" && item.familia === "CALLFACE_AI") return { caminho: "contrato", motivo: "modo_da_proposta" };
  // Regra de negócio: a FAMÍLIA manda o piso (PABX e White Label exigem contrato); o PRICE só endurece.
  // `exigeContratoDoPreco === false` NÃO rebaixa uma família que exige: a licença White Label sozinha
  // ia para pagamento, o contrato nunca existia e a política WHITE_LABEL (contrato assinado) impedia o Ganho.
  // Família que não exige + price que exige = contrato.
  const piso = ctx.familiaExigeContrato(item.familia);
  if (item.exigeContratoDoPreco === true) return { caminho: "contrato", motivo: "preco" };
  if (piso) return { caminho: "contrato", motivo: "familia" };
  return { caminho: "pagamento", motivo: item.exigeContratoDoPreco === false ? "preco" : "familia" };
}

export interface GrupoDeFechamento {
  chave: string;
  caminho: CaminhoDeFechamento;
  commercialModel: string;
  /** UNKNOWN quando nenhuma linha do grupo tem família: o grupo vai para validação manual. */
  familia: string;
  itensIds: string[];
}

const conhecida = (f: string | null): f is string => !!f && f !== "UNKNOWN";

/**
 * Agrupa as linhas pelo caminho, modelo e família.
 *
 * Linha sem família (item genérico, como "Setup") herda a família de MAIOR
 * valor entre as linhas classificadas que seguem o mesmo caminho e modelo, a
 * mesma régua de desempate de `calcularFamiliaDoGrupo`. Sem nenhuma, o grupo
 * fica UNKNOWN e vai para validação manual: nunca um palpite.
 */
export function decidirGrupos(itens: ItemParaDecisao[], ctx: ContextoDaDecisao): GrupoDeFechamento[] {
  const decididos = itens.map((i) => ({ i, ...caminhoDoItem(i, ctx) }));

  // Família dominante por (caminho, modelo), só entre as linhas classificadas.
  const dominante = new Map<string, string>();
  const somas = new Map<string, Map<string, number>>();
  for (const d of decididos) {
    if (!conhecida(d.i.familia)) continue;
    const k = `${d.caminho}|${d.i.commercialModel}`;
    const m = somas.get(k) ?? new Map<string, number>();
    m.set(d.i.familia, (m.get(d.i.familia) ?? 0) + Math.round(d.i.subtotal * 100));
    somas.set(k, m);
  }
  for (const [k, m] of somas) dominante.set(k, [...m.entries()].sort((a, b) => b[1] - a[1])[0][0]);

  const grupos = new Map<string, GrupoDeFechamento>();
  for (const d of decididos) {
    const familia = conhecida(d.i.familia) ? d.i.familia : (dominante.get(`${d.caminho}|${d.i.commercialModel}`) ?? "UNKNOWN");
    const chave = `${d.caminho}|${d.i.commercialModel}|${familia}`;
    const g = grupos.get(chave) ?? { chave, caminho: d.caminho, commercialModel: d.i.commercialModel, familia, itensIds: [] };
    g.itensIds.push(d.i.id);
    grupos.set(chave, g);
  }
  return [...grupos.values()];
}

/**
 * O que a timeline diz que falta depois do aceite, POR GRUPO. Uma venda mista não tem "o" requisito:
 * tem contrato num grupo e pagamento no outro, e dizer só "Pagamento pendente" esconde a assinatura.
 */
export function textoDoGate(
  grupos: Array<{ caminho: CaminhoDeFechamento; familia: string | null }>,
  rotuloFamilia: (familia: string) => string,
): string {
  const nomes = (lista: typeof grupos) => [...new Set(lista.map((g) => (g.familia && g.familia !== "UNKNOWN" ? rotuloFamilia(g.familia) : "")).filter(Boolean))].join(", ");
  const contrato = grupos.filter((g) => g.caminho === "contrato");
  const pagamento = grupos.filter((g) => g.caminho === "pagamento");
  if (contrato.length === 0) return "Pagamento pendente";
  if (pagamento.length === 0) return "Contrato pendente";
  const c = nomes(contrato), p = nomes(pagamento);
  return `Contrato pendente${c ? ` (${c})` : ""} e pagamento pendente${p ? ` (${p})` : ""}`;
}
