/**
 * Classificação do CATÁLOGO LEGADO — camada de leitura, nunca de escrita no
 * histórico.
 *
 * Existe porque ~218 produtos antigos (Zoho/Wevy) seguem vinculados a clientes
 * ativos, e sem classificação nenhum relatório, Cliente 360, financeiro ou CS
 * consegue somar por família. O objetivo NÃO é migrar nada: é conseguir LER o
 * histórico por família, natureza de receita e produto canônico sugerido.
 *
 * A hierarquia de confiança é o ponto central deste módulo — classificar tudo
 * com a mesma cara seria pior que não classificar, porque some com o que
 * precisa de olho humano:
 *
 *   CONFIRMED  planilha_oficial  o nome legado está declarado na planilha
 *                                oficial ("Variação vinda do Zoho: X") — 189
 *                                dos 213 prices trazem isso. É o time
 *                                comercial afirmando o vínculo, não um palpite.
 *   CONFIRMED  regra_ajuste      reajuste/crédito/multa/frete/carência — não é
 *                                produto vendável, e isso é uma certeza.
 *   PROBABLE   regra_nome        bate com termo técnico de família (Fanvil,
 *                                gateway, linha SIP, 0800...). Alta chance de
 *                                estar certo, mas é inferência.
 *   AMBIGUOUS  generico_ambiguo  nome genérico que existe em toda família
 *                                ("SETUP", "TOTAL", "INTEGRAÇÃO"): precisa do
 *                                contexto do contrato pra decidir.
 *   UNRESOLVED sem_evidencia     não há evidência nenhuma. Fila de revisão.
 *
 * Reaproveita `classificar-produto.ts` (regra por nome já existente e em uso
 * no motor de fechamento) em vez de criar um segundo classificador.
 */
import { classificarProdutoPorNome, ehAjusteFinanceiro, ehNomeGenerico, type FamiliaServico } from "@/lib/crm/classificar-produto";
import snapshot from "@/lib/db/catalogo/catalogo-oficial.json";

export type Confianca = "CONFIRMED" | "PROBABLE" | "AMBIGUOUS" | "UNRESOLVED";
export type OrigemRegra = "planilha_oficial" | "regra_ajuste" | "regra_nome" | "generico_ambiguo" | "sem_evidencia";

/** Natureza de receita da camada legada. `ADJUSTMENT` só existe aqui — nunca vai pra servicos_canonicos. */
export type NaturezaLegado = "MRR" | "SETUP" | "ONE_TIME" | "USAGE" | "HARDWARE" | "ADJUSTMENT" | "UNKNOWN";

export interface ClassificacaoLegado {
  serviceFamily: FamiliaServico;
  revenueNature: NaturezaLegado;
  categoriaCrm: string | null;
  /** Produto oficial sugerido (nome). O id é resolvido por quem grava, pelo stripe_product_id. */
  canonicalName: string | null;
  canonicalStripeProductId: string | null;
  confidence: Confianca;
  ruleSource: OrigemRegra;
  /** Vendável hoje? Ajuste financeiro e legado nunca são — o catálogo oficial é o único vendável. */
  vendavel: boolean;
  evidencia: string;
}

/** Normaliza pra comparação: sem acento, sem caixa, espaço colapsado, sem pontuação de borda. */
export function normalizar(nome: string): string {
  return nome
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

interface EntradaOficial {
  familia: FamiliaServico;
  categoria: string;
  revenueNature: NaturezaLegado;
  produtoNome: string;
  stripeProductId: string;
  variacao: string;
}

/**
 * Índice nome-legado-normalizado -> price oficial, construído do snapshot da
 * planilha. Montado uma vez por processo (o snapshot é estático).
 */
const INDICE_OFICIAL: Map<string, EntradaOficial> = (() => {
  const mapa = new Map<string, EntradaOficial>();
  for (const p of snapshot.produtos as Array<Record<string, unknown>>) {
    const familia = p.serviceFamily as FamiliaServico;
    const categoria = p.categoria as string;
    const produtoNome = p.nome as string;
    const stripeProductId = p.stripeProductId as string;
    for (const pr of p.precos as Array<Record<string, unknown>>) {
      const entrada: EntradaOficial = {
        familia, categoria, produtoNome, stripeProductId,
        revenueNature: pr.revenueNature as NaturezaLegado,
        variacao: pr.variacao as string,
      };
      // Nomes legados declarados na planilha, e também a própria variação
      // (vários nomes do Zoho sobreviveram como variação: "Large", "Starter").
      const candidatos = [...((pr.nomesLegado as string[]) ?? []), pr.variacao as string];
      for (const c of candidatos) {
        const chave = normalizar(c);
        // Primeiro a declarar ganha: `nomesLegado` vem antes da variação, e
        // a ordem dos prices é a ordem comercial da planilha.
        if (chave && !mapa.has(chave)) mapa.set(chave, entrada);
      }
    }
  }
  return mapa;
})();

/** Categoria CRM -> natureza de receita, quando só a categoria é conhecida. */
const NATUREZA_POR_CATEGORIA: Record<string, NaturezaLegado> = {
  plano: "MRR", licenca: "MRR", add_on: "MRR", linha: "MRR", ramal: "MRR", canais: "MRR",
  setup: "SETUP", hardware: "HARDWARE", minutos: "MRR", uso: "USAGE",
  integracao: "MRR", servico: "ONE_TIME",
};

/**
 * Categoria CRM inferida pelo nome, quando não há match oficial. Só termos
 * inequívocos: na dúvida devolve null e a natureza fica indefinida.
 */
function categoriaPorNome(n: string): string | null {
  if (/(fanvil|headset|gateway|nobreak|no break|\bata\b|aparelho|telefone|upgrade disco|equipamento)/.test(n)) return "hardware";
  if (/(linha|0800|4003|4004|3003)/.test(n)) return "linha";
  if (/ramal/.test(n)) return "ramal";
  if (/canai|canal/.test(n)) return "canais";
  if (/(minuto|min |minutagem|pacote.*min)/.test(n)) return "minutos";
  if (/(setup|implanta)/.test(n)) return "setup";
  if (/(integracao|web api|dashboard|pesquisa de satisfacao|transcricao|gravacao|teams|bitrix|qr code|vpn|openbox)/.test(n)) return "integracao";
  if (/(suporte|manutencao|assistencia)/.test(n)) return "servico";
  if (/licenca/.test(n)) return "licenca";
  if (/(starter|medium|large|enterprise|small|growth|unlimited|plano)/.test(n)) return "plano";
  return null;
}

/**
 * Classifica UM nome de produto legado. Puro (sem I/O) — dá pra testar e pra
 * rodar em lote sem tocar o banco.
 */
export function classificarLegado(nomeBruto: string | null | undefined): ClassificacaoLegado {
  const nome = (nomeBruto ?? "").trim();
  const base: ClassificacaoLegado = {
    serviceFamily: "UNKNOWN", revenueNature: "UNKNOWN", categoriaCrm: null,
    canonicalName: null, canonicalStripeProductId: null,
    confidence: "UNRESOLVED", ruleSource: "sem_evidencia", vendavel: false,
    evidencia: "nome vazio",
  };
  if (!nome) return base;
  const n = normalizar(nome);

  // 1. Ajuste financeiro ANTES de tudo: "DESCONTO EXECUTIVO - MENSAL" contém
  //    "mensal" e casaria como recorrente, mas não é produto.
  if (ehAjusteFinanceiro(nome)) {
    return {
      serviceFamily: "UNKNOWN", revenueNature: "ADJUSTMENT", categoriaCrm: "ajuste_financeiro",
      canonicalName: null, canonicalStripeProductId: null,
      confidence: "CONFIRMED", ruleSource: "regra_ajuste", vendavel: false,
      evidencia: "lançamento financeiro (reajuste/crédito/multa/frete/carência) — não é produto vendável",
    };
  }

  // 2. Match declarado na planilha oficial — a evidência mais forte que existe.
  const oficial = INDICE_OFICIAL.get(n);
  if (oficial) {
    return {
      serviceFamily: oficial.familia,
      revenueNature: oficial.revenueNature,
      categoriaCrm: oficial.categoria,
      canonicalName: `${oficial.produtoNome} — ${oficial.variacao}`,
      canonicalStripeProductId: oficial.stripeProductId,
      confidence: "CONFIRMED", ruleSource: "planilha_oficial", vendavel: false,
      evidencia: `nome declarado na planilha oficial como variação "${oficial.variacao}" de ${oficial.produtoNome}`,
    };
  }

  // 3. Regra por nome (classificador já existente + termos ampliados).
  const familia = classificarProdutoPorNome(nome);
  if (familia !== "UNKNOWN") {
    const categoria = categoriaPorNome(n);
    return {
      serviceFamily: familia,
      revenueNature: categoria ? NATUREZA_POR_CATEGORIA[categoria] ?? "UNKNOWN" : "UNKNOWN",
      categoriaCrm: categoria,
      canonicalName: null, canonicalStripeProductId: null,
      confidence: "PROBABLE", ruleSource: "regra_nome", vendavel: false,
      evidencia: `termo técnico de ${familia} no nome${categoria ? `, categoria ${categoria}` : ""}`,
    };
  }

  // 4. Genérico: dá pra dizer a categoria, não a família.
  const categoria = categoriaPorNome(n);
  if (ehNomeGenerico(nome) || categoria) {
    return {
      serviceFamily: "UNKNOWN",
      revenueNature: categoria ? NATUREZA_POR_CATEGORIA[categoria] ?? "UNKNOWN" : "UNKNOWN",
      categoriaCrm: categoria,
      canonicalName: null, canonicalStripeProductId: null,
      confidence: "AMBIGUOUS", ruleSource: "generico_ambiguo", vendavel: false,
      evidencia: categoria
        ? `nome genérico: categoria ${categoria} identificada, família depende do contrato`
        : "nome genérico, existe em mais de uma família",
    };
  }

  return { ...base, evidencia: "nenhuma evidência no nome pra classificar" };
}

/** Quantos nomes legados a planilha oficial cobre — útil pro relatório. */
export function totalNomesLegadoIndexados(): number {
  return INDICE_OFICIAL.size;
}
