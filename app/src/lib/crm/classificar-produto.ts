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
      // Ampliação 02/09 (classificação do legado): termos medidos nos nomes
      // que ficavam UNKNOWN de fato no histórico — hardware de telefonia,
      // linhas 400x, módulos e serviços de telefonia. A cobertura do
      // classificador nos 334 nomes distintos do histórico era 57,5%.
      "headset", "gateway", "nobreak", "no-break", "ata ", "atas", "openbox",
      "linha 4003", "linha 4004", "linha 3003", "4003", "4004",
      "sip", "voip", "bina", "softswitch", "siproute", "e1 ", "fxo", "fxs",
      "pesquisa de satisfacao", "pesquisa de satisfação", "controle de pausa",
      "web api", "gravacao", "gravação", "transcricao", "transcrição",
      "dashboard", "relatorio personalizado", "relatório personalizado",
      "voz ilimitad", "telefonia", "telecom", "upgrade disco", "vpn",
      "integracao teams", "integração teams", "microsoft teams", "qr code",
      "bitrix", "multidados", "assistencia em telecom", "suporte e manutencao",
      "suporte e manutenção", "callface em nuvem", "aparelho wifi",
    ],
  },
];

/**
 * Itens que NÃO são produto vendável: ajuste financeiro, crédito, reajuste,
 * cortesia, multa, frete. Vinham do Zoho como se fossem linha de produto e
 * poluíam qualquer contagem por família — classificar como PABX ou Callface AI
 * seria pior que não classificar, porque entrariam no portfólio.
 *
 * Testado ANTES das famílias de propósito: "DESCONTO EXECUTIVO - MENSAL" tem
 * "mensal" e "REAJUSTES ANUAIS" tem "anuais", mas nenhum dos dois é produto.
 */
const TERMOS_AJUSTE = [
  "reajuste", "desconto", "credito", "crédito", "retroativ", "poc",
  "carencia", "carência", "multa", "frete", "diferenca", "diferença",
  "acerto", "aditivo", "cortesia", "bonific", "estorno", "abatimento",
  "cancelamento", "ajuste",
];

/**
 * É um ajuste/lançamento financeiro em vez de produto vendável?
 * Usado pela camada de classificação do legado — não muda o comportamento de
 * `classificarProdutoPorNome`, que continua devolvendo só família.
 */
export function ehAjusteFinanceiro(nome: string | null | undefined): boolean {
  if (!nome) return false;
  const n = nome.toLowerCase().trim();
  return TERMOS_AJUSTE.some((t) => n.includes(t));
}

/**
 * Nomes genéricos que existem em QUALQUER família e por isso não podem ser
 * classificados pelo nome sozinho ("SETUP", "TOTAL", "INTEGRAÇÃO"). Já era o
 * espírito do comentário de `classificarProdutoPorNome`; agora é explícito,
 * pra a camada de legado marcar AMBIGUOUS em vez de UNRESOLVED — a diferença
 * importa: ambíguo precisa de contexto, não-resolvido precisa de gente.
 */
const NOMES_GENERICOS = [
  "setup", "total", "integracao", "integração", "servico", "serviço",
  "mensalidade", "assinatura", "plano", "pacote", "licenca", "licença",
  "implantacao", "implantação", "adicional", "outros", "diversos",
];

export function ehNomeGenerico(nome: string | null | undefined): boolean {
  if (!nome) return false;
  const n = nome.toLowerCase().trim().replace(/\s+/g, " ");
  return NOMES_GENERICOS.includes(n) || NOMES_GENERICOS.some((g) => n === `${g}s`);
}

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
