/**
 * Classificação de produto vendido → família de serviço (30/08).
 *
 * Por que isso existe como LÓGICA e não como backfill de dado: o banco de dev
 * é reconstruído a cada `refresh-dev-db.sh` a partir de produção, onde
 * `proposta_itens.service_family`, `negocios.service_family` e
 * `servicos_catalogo.service_family` estão TODOS nulos/UNKNOWN. Qualquer
 * classificação gravada some no refresh seguinte. Como regra de código ela
 * sobrevive ao refresh e sobe junto com o resto quando o CRM2 for pra
 * produção.
 *
 * A ordem de prioridade importa: "White Label - Callface AI" é White Label,
 * não Callface AI — por isso white label é testado primeiro.
 *
 * Isto NÃO substitui `servicos_canonicos.service_family` (que é a fonte
 * autoritativa quando existe) — é o fallback pra quando o serviço canônico
 * não foi materializado, que hoje é a esmagadora maioria dos contratos.
 */

export type FamiliaServico = "CALLFACE_AI" | "PABX" | "WHITE_LABEL" | "UNKNOWN";

/** Termos extraídos dos nomes REAIS de itens de proposta aceita em produção. */
const REGRAS: { familia: Exclude<FamiliaServico, "UNKNOWN">; termos: string[] }[] = [
  // White Label primeiro: "white label - callface ai" contém "callface ai".
  { familia: "WHITE_LABEL", termos: ["white label", "whitelabel"] },
  {
    familia: "CALLFACE_AI",
    termos: ["callface ai", "callpilot", "agente ia", "agente de ia", "agente bdr", "cold calling"],
  },
  {
    familia: "PABX",
    termos: [
      "ramal", "linha sip", "linha 0800", "0800", "yeastar", "pabx", "3cx",
      "fanvil", "aparelho ip", "telefone", "media gateway", "portabilidade",
      "canais", "minutagem", "minutos", "min adicionais", "linha adicional",
      "ligações", "ligacoes", "discador", "tronco", "ura",
    ],
  },
];

/**
 * Classifica UM item pelo nome. Devolve UNKNOWN pra nomes genéricos que
 * existem em qualquer venda ("Setup", "Starter", "Small/Medium/Large",
 * "Integração") — esses são resolvidos por contexto em
 * `classificarItensDaProposta`, nunca chutados aqui.
 */
export function classificarProdutoPorNome(nome: string | null | undefined): FamiliaServico {
  if (!nome) return "UNKNOWN";
  const n = nome.toLowerCase().trim();
  for (const regra of REGRAS) {
    if (regra.termos.some((t) => n.includes(t))) return regra.familia;
  }
  return "UNKNOWN";
}

/**
 * Classifica os itens de UMA proposta, resolvendo os genéricos por contexto:
 * um "Setup" numa proposta que também vende "Callface AI - Full" é setup DE
 * Callface AI. O desempate usa a família de maior valor entre os itens já
 * classificados da mesma proposta — se nenhum item deu pra classificar, todos
 * ficam UNKNOWN em vez de receberem um palpite.
 */
export function classificarItensDaProposta<T extends { nome: string | null; valor: number }>(
  itens: T[],
): (T & { familia: FamiliaServico })[] {
  const comFamilia = itens.map((i) => ({ ...i, familia: classificarProdutoPorNome(i.nome) }));

  const porFamilia = new Map<FamiliaServico, number>();
  for (const i of comFamilia) {
    if (i.familia === "UNKNOWN") continue;
    porFamilia.set(i.familia, (porFamilia.get(i.familia) ?? 0) + i.valor);
  }
  if (porFamilia.size === 0) return comFamilia;

  const dominante = [...porFamilia.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return comFamilia.map((i) => (i.familia === "UNKNOWN" ? { ...i, familia: dominante } : i));
}
