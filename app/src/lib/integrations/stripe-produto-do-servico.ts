/**
 * Regra única do NOME DO PRODUTO de um serviço canônico (`servicos_canonicos.canonical_product`).
 *
 * Por que existe: a coluna estava vazia na maioria (243 de 286 em CALLFACE_AI, 192 de 196 em
 * PABX) e, onde preenchida, guardava NOME DE CLIENTE ou TÍTULO DE NEGÓCIO ("Natural Labs",
 * "Ttt - Novo negócio", "HUBMAISTEC | CALLFACE AI | MAYRA | STRIPE — Negócio"). Quem escrevia
 * era `lib/crm/pos-venda.ts` (`canonicalProduct: negocio.titulo`). A tela do Cliente 360 lia isso
 * e mostrava "1 × Callface AI" (a FAMÍLIA) onde devia estar o produto.
 *
 * Este arquivo é PURO (sem banco, sem rede): o sync, o backfill e os testes usam a mesma regra.
 *
 * Precedência (a primeira que resolve vence; nunca inventa):
 *   1. ASSINATURA NO ESPELHO — os itens da subscription (`assinatura_itens`), cada um com o nome do
 *      PRODUTO como o Stripe o chama. Produto antigo, fora do catálogo de hoje, aparece COMO ELE É
 *      (decisão do Scott): o catálogo novo vale só para venda nova.
 *        1a. `assinatura_itens.produto` (quando é nome, não id `prod_...`)
 *        1b. catálogo do ONFACE pelo `stripe_product_id` do item
 *        1c. catálogo do ONFACE pelo `stripe_price_id` do item
 *        1d. nome lido ao vivo do Stripe (só leitura) para ids que o espelho guardou sem nome
 *        1e. produto APAGADO no Stripe: o nome que as FATURAS dele registraram ("1 × Callface AI - Full
 *            (at R$ 179.90 / month)"), só quando pelo menos 2 assinaturas diferentes concordam e
 *            nenhuma discorda (`consolidarNomesDeFatura`)
 *      Sem nenhuma dessas: o item fica sem nome e o serviço, nulo.
 *   2. OFERTA COMERCIAL — `servicos_canonicos.oferta_comercial_id` -> `ofertas_comerciais` -> catálogo.
 *   3. ITEM DA VENDA — `oportunidade_itens.produto` ligado ao serviço (nasce do catálogo no Won),
 *      desde que passe no teste abaixo.
 *   4. VALOR ATUAL — só se NÃO parecer nome de cliente/título de negócio (`avaliarValorAtual`).
 *   5. NULO — quem exibe decide mostrar a família, DIZENDO que é a família.
 *
 * Nunca sobrescreve valor bom por nulo. Valor atual sujo e sem substituto vira nulo (LIMPAR):
 * nome de cliente na coluna de produto é pior do que vazio.
 */

/* ── normalização ─────────────────────────────────────────────────────── */

export const normalizar = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** `prod_UlpQkZB4dLK7x3`: o espelho grava o id no lugar do nome quando o produto não veio na listagem. */
export const pareceIdStripe = (s: string): boolean => /^prod_[A-Za-z0-9]{6,}$/.test(s.trim());

/* ── tipos ────────────────────────────────────────────────────────────── */

export interface ItemEspelho {
  produto: string | null;
  stripeProductId: string | null;
  stripePriceId: string | null;
  quantidade: number;
  precoUnitario: number | null;
  /** `inactive` = item que saiu da subscription; não conta. */
  status: string | null;
}

export interface Conhecimento {
  catalogoPorProdutoStripe: Map<string, string>;
  catalogoPorPrice: Map<string, string>;
  /** Nome lido ao vivo do Stripe. `null` = produto apagado (sem nome pelo produto). */
  stripeProdutos: Map<string, string | null>;
  /** Nome que as faturas registraram para um produto apagado (já consolidado: ver `consolidarNomesDeFatura`). */
  nomesDeFatura: Map<string, string>;
  /** Nomes de produto reconhecidos (normalizados): catálogo + espelho + Stripe. */
  nomesConhecidos: Set<string>;
}

export function montarConhecimento(entrada: {
  catalogoProdutos?: { stripeProductId: string | null; nome: string }[];
  catalogoPrecos?: { stripePriceId: string | null; nome: string }[];
  /** id -> nome (ou null se apagado). */
  stripeProdutos?: Record<string, string | null>;
  /** id -> nome consolidado das faturas (produto apagado). */
  nomesDeFatura?: Record<string, string>;
  /** Nomes de produto que o espelho já guarda (assinaturas.produto / assinatura_itens.produto). */
  nomesDoEspelho?: string[];
  /** Nomes do catálogo sem id Stripe (também são produto). */
  nomesDoCatalogo?: string[];
}): Conhecimento {
  const catalogoPorProdutoStripe = new Map<string, string>();
  const nomes = new Set<string>();
  const addNome = (n: string | null | undefined) => {
    if (!n) return;
    if (pareceIdStripe(n)) return;
    const k = normalizar(n);
    if (k) nomes.add(k);
  };
  for (const c of entrada.catalogoProdutos ?? []) {
    addNome(c.nome);
    if (c.stripeProductId && !catalogoPorProdutoStripe.has(c.stripeProductId)) catalogoPorProdutoStripe.set(c.stripeProductId, c.nome);
  }
  const catalogoPorPrice = new Map<string, string>();
  for (const p of entrada.catalogoPrecos ?? []) {
    if (p.stripePriceId && !catalogoPorPrice.has(p.stripePriceId)) catalogoPorPrice.set(p.stripePriceId, p.nome);
  }
  for (const n of entrada.nomesDoCatalogo ?? []) addNome(n);
  for (const n of entrada.nomesDoEspelho ?? []) addNome(n);
  const stripeProdutos = new Map<string, string | null>(Object.entries(entrada.stripeProdutos ?? {}));
  for (const v of stripeProdutos.values()) addNome(v);
  const nomesDeFatura = new Map<string, string>(Object.entries(entrada.nomesDeFatura ?? {}));
  for (const v of nomesDeFatura.values()) addNome(v);
  return { catalogoPorProdutoStripe, catalogoPorPrice, stripeProdutos, nomesDeFatura, nomesConhecidos: nomes };
}

export const conhecimentoVazio = (): Conhecimento => montarConhecimento({});

/* ── 1. nome de cada item e da assinatura ─────────────────────────────── */

export type FonteNome = "espelho" | "catalogo_produto" | "catalogo_price" | "stripe_api" | "stripe_fatura";
export type MotivoSemNome = "produto_removido_no_stripe" | "item_sem_nome" | "assinatura_sem_itens";

export function nomeDoItem(item: ItemEspelho, k: Conhecimento): { nome: string; fonte: FonteNome } | { nome: null; motivo: MotivoSemNome } {
  const produto = item.produto?.trim() || null;
  if (produto && !pareceIdStripe(produto)) return { nome: produto, fonte: "espelho" };

  const id = item.stripeProductId?.trim() || (produto && pareceIdStripe(produto) ? produto : null);
  if (id) {
    const doCatalogo = k.catalogoPorProdutoStripe.get(id);
    if (doCatalogo) return { nome: doCatalogo, fonte: "catalogo_produto" };
  }
  if (item.stripePriceId) {
    const doPreco = k.catalogoPorPrice.get(item.stripePriceId);
    if (doPreco) return { nome: doPreco, fonte: "catalogo_price" };
  }
  if (id && k.stripeProdutos.has(id)) {
    const vivo = k.stripeProdutos.get(id);
    if (vivo) return { nome: vivo, fonte: "stripe_api" };
  }
  if (id) {
    const historico = k.nomesDeFatura.get(id);
    if (historico) return { nome: historico, fonte: "stripe_fatura" };
  }
  if (id && k.stripeProdutos.has(id)) return { nome: null, motivo: "produto_removido_no_stripe" };
  return { nome: null, motivo: "item_sem_nome" };
}

export interface NomeDaAssinatura {
  produto: string | null;
  fontes: FonteNome[];
  motivo: MotivoSemNome | null;
}

/**
 * Uma subscription pode ter vários itens. O serviço canônico é UMA linha, então o nome é a união
 * dos produtos distintos ("A + B"), do item de maior valor para o de menor. Se QUALQUER item não
 * tem nome, o serviço fica sem nome: mostrar só os itens que se conhece esconderia o resto.
 */
export function nomeDaAssinatura(itens: ItemEspelho[], k: Conhecimento): NomeDaAssinatura {
  const ativos = itens.filter((i) => i.status !== "inactive");
  if (ativos.length === 0) return { produto: null, fontes: [], motivo: "assinatura_sem_itens" };

  const resolvidos = ativos.map((i, ordem) => ({ i, ordem, r: nomeDoItem(i, k) }));
  const semNome = resolvidos.filter((x) => x.r.nome === null);
  if (semNome.length > 0) {
    const removido = semNome.some((x) => x.r.nome === null && x.r.motivo === "produto_removido_no_stripe");
    return { produto: null, fontes: [], motivo: removido ? "produto_removido_no_stripe" : "item_sem_nome" };
  }
  const valor = (x: (typeof resolvidos)[number]) => (x.i.precoUnitario ?? 0) * (x.i.quantidade || 1);
  resolvidos.sort((a, b) => valor(b) - valor(a) || a.ordem - b.ordem);
  const vistos = new Set<string>();
  const nomes: string[] = [];
  const fontes = new Set<FonteNome>();
  for (const x of resolvidos) {
    if (x.r.nome === null) continue;
    fontes.add(x.r.fonte);
    const chave = normalizar(x.r.nome);
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    nomes.push(x.r.nome);
  }
  return { produto: nomes.join(" + "), fontes: [...fontes], motivo: null };
}

/* ── 1e. nome de produto apagado, pelas faturas ───────────────────────── */

/**
 * "1 × Callface AI - Full (at R$ 179.90 / month)" -> "Callface AI - Full". Texto gerado pelo Stripe a
 * partir do nome do produto no momento da fatura. Qualquer outra forma (descrição escrita à mão,
 * proration "Unused time on ...", faixas) devolve null: na dúvida, não afirma nada.
 */
export function nomeDaDescricaoDeLinha(descricao: string | null | undefined): string | null {
  const m = /^\d+(?:[.,]\d+)?\s*[×x]\s*(.+?)\s*\(at\s[^()]*\)\s*$/.exec((descricao ?? "").trim());
  const nome = m?.[1]?.trim();
  if (!nome || /^(unused|remaining) time on/i.test(nome) || /\btier\b/i.test(nome)) return null;
  return nome;
}

/**
 * Consolida o que as faturas dizem de cada produto: só vira nome se PELO MENOS 2 assinaturas diferentes
 * viram o mesmo nome (comparado sem acento/caixa) e NENHUMA viu outro. Divergência = sem nome.
 */
export function consolidarNomesDeFatura(
  observacoes: { productId: string; nome: string; assinatura: string }[],
  minimoDeAssinaturas = 2,
): Record<string, string> {
  const porProduto = new Map<string, { nomes: Map<string, string>; assinaturas: Map<string, Set<string>> }>();
  for (const o of observacoes) {
    const e = porProduto.get(o.productId) ?? { nomes: new Map(), assinaturas: new Map() };
    const chave = normalizar(o.nome);
    if (!e.nomes.has(chave)) e.nomes.set(chave, o.nome.trim());
    const subs = e.assinaturas.get(chave) ?? new Set<string>();
    subs.add(o.assinatura);
    e.assinaturas.set(chave, subs);
    porProduto.set(o.productId, e);
  }
  const out: Record<string, string> = {};
  for (const [productId, e] of porProduto) {
    if (e.nomes.size !== 1) continue;
    const [chave, nome] = [...e.nomes.entries()][0];
    if ((e.assinaturas.get(chave)?.size ?? 0) >= minimoDeAssinaturas) out[productId] = nome;
  }
  return out;
}

/* ── 4. o valor que já está na coluna parece produto? ─────────────────── */

export type RazaoSuja =
  | "vazio"
  | "tem_barra"
  | "titulo_de_negocio"
  | "contem_nome_da_empresa"
  | "nao_e_produto_conhecido";

/**
 * Critério de "parece nome de cliente / título de negócio" (qualquer um reprova):
 *   - vazio;
 *   - contém "|" (título composto do tipo "EMPRESA | CALLFACE AI | VENDEDOR | STRIPE");
 *   - contém "negócio" ("Novo negócio", "— Negócio") ou "via Callface" (títulos do Pré-vendas);
 *   - contém, ou está contido, no nome da empresa do serviço (comparação sem acento e caixa);
 *   - NÃO é um nome de produto conhecido (catálogo do ONFACE, espelho do Stripe ou Stripe ao vivo).
 * O último é a rede de segurança: nome de cliente que o texto não entrega ("Brobot", "Laster")
 * só passa se for um produto que existe.
 */
export function avaliarValorAtual(
  valor: string | null | undefined,
  ctx: { empresaNomes: string[]; conhecimento: Conhecimento },
): { ok: true } | { ok: false; razao: RazaoSuja } {
  const bruto = (valor ?? "").trim();
  if (!bruto) return { ok: false, razao: "vazio" };
  if (bruto.includes("|")) return { ok: false, razao: "tem_barra" };
  if (/neg[oó]cio/i.test(bruto) || /\bvia\s+callface\b/i.test(bruto)) return { ok: false, razao: "titulo_de_negocio" };

  const v = normalizar(bruto);
  for (const nome of ctx.empresaNomes) {
    const e = normalizar(nome);
    if (e.length < 4 || v.length < 4) continue;
    if (v.includes(e) || e.includes(v)) return { ok: false, razao: "contem_nome_da_empresa" };
  }
  if (!ctx.conhecimento.nomesConhecidos.has(v)) return { ok: false, razao: "nao_e_produto_conhecido" };
  return { ok: true };
}

/* ── decisão por serviço ──────────────────────────────────────────────── */

export type Acao = "PREENCHER" | "CORRIGIR" | "MANTER" | "LIMPAR" | "SEM_RESOLVER";
export type FonteProduto = FonteNome | "catalogo_oferta" | "item_da_venda" | "valor_atual";

export interface EntradaServico {
  atual: string | null;
  /** `current_subscription_id` preenchido. */
  temAssinatura: boolean;
  /** Essa subscription existe em `assinaturas`. */
  assinaturaNoEspelho: boolean;
  itens: ItemEspelho[];
  ofertaCatalogoNome: string | null;
  itemDaVenda: string | null;
  empresaNomes: string[];
}

export interface Decisao {
  acao: Acao;
  antes: string | null;
  depois: string | null;
  fonte: string | null;
  motivo: string | null;
}

export function decidirProdutoDoServico(e: EntradaServico, k: Conhecimento): Decisao {
  const atual = e.atual?.trim() ? e.atual : null;
  const ctx = { empresaNomes: e.empresaNomes, conhecimento: k };

  let candidato: string | null = null;
  let fonte: string | null = null;
  let semCandidato: string | null = null;

  if (e.temAssinatura) {
    if (!e.assinaturaNoEspelho) semCandidato = "assinatura_fora_do_espelho";
    else {
      const r = nomeDaAssinatura(e.itens, k);
      if (r.produto) { candidato = r.produto; fonte = r.fontes.join("+"); }
      else semCandidato = r.motivo;
    }
  } else {
    semCandidato = "sem_assinatura_stripe";
  }
  if (!candidato && e.ofertaCatalogoNome?.trim()) { candidato = e.ofertaCatalogoNome.trim(); fonte = "catalogo_oferta"; }
  if (!candidato && e.itemDaVenda?.trim() && avaliarValorAtual(e.itemDaVenda, ctx).ok) { candidato = e.itemDaVenda.trim(); fonte = "item_da_venda"; }

  const av = atual ? avaliarValorAtual(atual, ctx) : null;

  if (candidato) {
    if (!atual) return { acao: "PREENCHER", antes: null, depois: candidato, fonte, motivo: null };
    if (normalizar(atual) === normalizar(candidato)) return { acao: "MANTER", antes: atual, depois: atual, fonte, motivo: "ja_correto" };
    if (av && av.ok) return { acao: "MANTER", antes: atual, depois: atual, fonte: "valor_atual", motivo: "valido_diverge_da_fonte" };
    return { acao: "CORRIGIR", antes: atual, depois: candidato, fonte, motivo: av && !av.ok ? `atual_${av.razao}` : null };
  }
  if (!atual) return { acao: "SEM_RESOLVER", antes: null, depois: null, fonte: null, motivo: semCandidato };
  if (av && av.ok) return { acao: "MANTER", antes: atual, depois: atual, fonte: "valor_atual", motivo: "atual_valido" };
  return { acao: "LIMPAR", antes: atual, depois: null, fonte: null, motivo: `atual_${av && !av.ok ? av.razao : "vazio"}|${semCandidato ?? "sem_fonte"}` };
}

/* ── uso do sync ──────────────────────────────────────────────────────── */

/**
 * Nome do produto de uma subscription a partir do que o sync acabou de ler do Stripe.
 * `nomePorProduto` é o catálogo `price.product -> name` que o sync já busca (produto apagado não vem
 * nele). Devolve `null` quando algum item não tem nome: o sync então NÃO grava nada.
 */
export function produtoDaSubscriptionDoSync(
  itens: { productId: string | null; priceId: string | null; quantidade: number; precoUnitario: number | null }[],
  nomePorProduto: Map<string, string>,
): string | null {
  const k = conhecimentoVazio();
  const mapa: ItemEspelho[] = itens.map((i) => {
    const nome = i.productId ? nomePorProduto.get(i.productId) : undefined;
    return {
      produto: nome && nome !== i.productId ? nome : null,
      stripeProductId: i.productId,
      stripePriceId: i.priceId,
      quantidade: i.quantidade,
      precoUnitario: i.precoUnitario,
      status: null,
    };
  });
  return nomeDaAssinatura(mapa, k).produto;
}

/** Marca em `evidence.produto_canonico` de quem escreveu automaticamente (o sync só atualiza o que é automático). */
export const MARCA_AUTOMATICA = "automatico";
