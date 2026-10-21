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
    // "copilot" junto de "callpilot": o catálogo do Stripe vende "Callface Copilot",
    // que caía em UNKNOWN e a ficha mostrava "Não classificado" com o nome do
    // produto escrito ao lado (14 assinaturas ativas em 21/10/2026).
    termos: ["callface ai", "callpilot", "copilot", "agente ia", "agente de ia", "agente bdr", "cold calling"],
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
  // Família declarada no começo do nome do catálogo ("PABX - Linhas") manda sobre termo solto no resto
  // ("PABX - Integração Callface AI" é PABX): a ordem das regras abaixo só desempata nome sem prefixo.
  if (/^pabx\b/.test(n) && !REGRAS[0].termos.some((t) => n.includes(t))) return "PABX";
  for (const regra of REGRAS) {
    if (regra.termos.some((t) => n.includes(t))) return regra.familia;
  }
  return "UNKNOWN";
}

/**
 * Família de um contrato. `contratos.produto` vale 'ai' por PADRÃO (a rota de contrato e a de lead gravam
 * "ai" sem olhar o que foi vendido): é ausência de informação, não evidência, e foi assim que contrato de
 * PABX virava Callface AI. O nome do que foi contratado vem primeiro; 'pabx' explícito vale; 'ai' sozinho não.
 */
export function familiaDoContrato(c: { produto?: string | null; servicos?: string[] | null; tipo?: string | null }): FamiliaServico {
  const porNome = classificarProdutoPorNome([...(c.servicos ?? []), c.tipo ?? ""].join(" "));
  if (porNome !== "UNKNOWN") return porNome;
  return c.produto === "pabx" ? "PABX" : "UNKNOWN";
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

/* ── A família de um negócio ganho: vem da ESTRUTURA DA OPORTUNIDADE ────────────────────────────────
 * Decisão do dono do produto: "se aquela oportunidade dá Ganho, a gente já sabe qual é a família".
 * Fonte, em ordem (a primeira que responde vence; nunca o Stripe, nunca `contratos.produto`):
 *   1. `negocios.service_family` / `oportunidades.service_family` (declarada na oportunidade);
 *   2. `oportunidade_itens.service_family`, ou a do catálogo do preço do item (a família é do ITEM, ADR-EXEC-019);
 *   3. a oferta comercial da oportunidade -> catálogo;
 *   4. `negocios.campos_custom.produto`, escolha explícita da qualificação;
 *   5. ÚLTIMO RECURSO, por texto: itens da proposta, contrato, título.
 * O funil NÃO é fonte: hoje todos os negócios moram no funil "Callface AI", então ele diria Callface AI para tudo.
 */
export interface EvidenciaDaOportunidade {
  familiaDoNegocio?: string | null;
  familiaDaOportunidade?: string | null;
  itens?: { familia?: string | null; familiaDoCatalogo?: string | null; valor: number }[];
  familiaDaOferta?: string | null;
  produtoCamposCustom?: string | null;
  itensDaProposta?: { nome: string | null; valor: number }[];
  contrato?: { produto?: string | null; servicos?: string[] | null; tipo?: string | null } | null;
  titulo?: string | null;
}

const FAMILIAS: string[] = ["CALLFACE_AI", "PABX", "WHITE_LABEL"];
const valida = (f: string | null | undefined): f is Exclude<FamiliaServico, "UNKNOWN"> => !!f && FAMILIAS.includes(f);

export function familiaDaOportunidade(e: EvidenciaDaOportunidade): { familia: FamiliaServico; fonte: string } {
  for (const [fonte, f] of [["negocio", e.familiaDoNegocio], ["oportunidade", e.familiaDaOportunidade]] as const) {
    if (valida(f)) return { familia: f, fonte };
  }
  const soma = new Map<FamiliaServico, number>();
  for (const i of e.itens ?? []) {
    const f = valida(i.familia) ? i.familia : valida(i.familiaDoCatalogo) ? i.familiaDoCatalogo : null;
    if (f) soma.set(f, (soma.get(f) ?? 0) + i.valor);
  }
  if (soma.size) return { familia: [...soma.entries()].sort((a, b) => b[1] - a[1])[0][0], fonte: "itens_da_oportunidade" };
  if (valida(e.familiaDaOferta)) return { familia: e.familiaDaOferta, fonte: "oferta" };
  const custom = e.produtoCamposCustom === "pabx" ? "PABX" : e.produtoCamposCustom === "ai" ? "CALLFACE_AI" : e.produtoCamposCustom === "white_label" ? "WHITE_LABEL" : null;
  if (custom) return { familia: custom, fonte: "qualificacao" };

  // Último recurso: texto.
  const porProposta = classificarItensDaProposta((e.itensDaProposta ?? []).map((i) => ({ nome: i.nome, valor: i.valor })));
  const s2 = new Map<FamiliaServico, number>();
  for (const c of porProposta) if (c.familia !== "UNKNOWN") s2.set(c.familia, (s2.get(c.familia) ?? 0) + c.valor);
  if (s2.size) return { familia: [...s2.entries()].sort((a, b) => b[1] - a[1])[0][0], fonte: "texto_proposta" };
  if (e.contrato) {
    const c = familiaDoContrato(e.contrato);
    if (c !== "UNKNOWN") return { familia: c, fonte: "texto_contrato" };
  }
  const t = classificarProdutoPorNome(e.titulo);
  if (t !== "UNKNOWN") return { familia: t, fonte: "texto_titulo" };
  return { familia: "UNKNOWN", fonte: "nenhuma" };
}
