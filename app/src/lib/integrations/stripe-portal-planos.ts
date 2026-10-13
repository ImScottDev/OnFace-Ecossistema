/**
 * Quais planos o cliente pode escolher na troca de plano do Portal — parte PURA.
 *
 * O Stripe exige a lista EXPLÍCITA de produtos e Prices (`subscription_update.products`);
 * não existe "todos". E a conta é COMPARTILHADA com o SaaS Callface: se a lista nascesse
 * do Stripe ("todo produto com preço recorrente"), um plano do SaaS poderia aparecer na
 * tela de um cliente do ONFACE. Por isso a lista nasce do CATÁLOGO DO ONFACE (banco) e é
 * CONFERIDA contra o Stripe, nunca o contrário:
 *
 *   catálogo (ativo, recorrente, categoria de plano, oficial_stripe, desta organização)
 *     ∩ Stripe (produto ativo, não do SaaS; preço ativo, recorrente, simples, em BRL)
 *
 * Sem nenhum id escrito no código. Sobrou menos de 2 Prices escolhíveis → a troca de plano
 * fica desligada (não há o que trocar) e o relatório diz por quê.
 *
 * Restrições do Stripe que viram regra aqui (docs.stripe.com/customer-management):
 *   - no máximo 10 produtos na troca de plano;
 *   - não pode haver 2 Prices do mesmo produto com o mesmo intervalo ("You can't define
 *     multiple Prices with the same product and recurring.interval") — o par ambíguo sai;
 *   - assinatura com uso medido não é atualizável, então preço medido/escalonado não entra.
 *
 * Sem rede e sem banco: quem lê o catálogo e o Stripe está em `stripe-portal-planos-db.ts`.
 */

import type { PlanoDoPortal } from "./stripe-portal-config";
import { ehPrecoEscalonado } from "./stripe-catalogo";

/** Categoria do catálogo (`servicos_catalogo.categoria`) cujos produtos são PLANOS trocáveis entre si. */
export const CATEGORIA_TROCA_DE_PLANO = "plano";
/** Origem do catálogo que espelha o Stripe do ONFACE (`servicos_catalogo.origem_catalogo`). */
export const ORIGEM_CATALOGO_OFICIAL = "oficial_stripe";
/** Teto do Stripe para produtos na troca de plano. */
export const LIMITE_PRODUTOS_DO_PORTAL = 10;
/** Moeda das cobranças do ONFACE. Plano em outra moeda não entra na mesma lista. */
export const MOEDA_DO_PORTAL = "brl";

export interface PrecoDoCatalogo {
  stripePriceId: string;
  ativo: boolean;
  recorrente: boolean;
}

export interface ProdutoDoCatalogo {
  nome: string;
  stripeProductId: string | null;
  ativo: boolean;
  tipo: string;
  categoria: string | null;
  origemCatalogo: string;
  ordem: number;
  precos: PrecoDoCatalogo[];
}

export interface ProdutoDoStripe {
  id: string;
  active?: boolean;
  deleted?: boolean;
  metadata?: Record<string, string> | null;
}

export interface PrecoDoStripe {
  id: string;
  product: string;
  active?: boolean;
  type?: string;
  currency?: string;
  billing_scheme?: string;
  transform_quantity?: unknown;
  tiers_mode?: string | null;
  recurring?: { interval?: string; interval_count?: number; usage_type?: string } | null;
  metadata?: Record<string, string> | null;
}

/**
 * Objeto do SaaS Callface (conta compartilhada). Marca: `managed_by=callface-backend` ou qualquer das
 * chaves `plan_id`/`organization_id`/`user_id` — as mesmas de `ehDoSaas` (stripe-assinatura-acoes), que
 * não dá para importar aqui sem puxar o banco. Devolve o motivo, ou `null` se não é do SaaS.
 */
export function motivoDeSaaS(metadata: Record<string, string> | null | undefined): string | null {
  if (!metadata) return null;
  if (metadata.managed_by === "callface-backend") return "marcado managed_by=callface-backend (SaaS)";
  const chave = ["plan_id", "organization_id", "user_id"].find((k) => !!metadata[k]);
  return chave ? `metadata.${chave} presente (SaaS)` : null;
}

export interface PlanoExcluido {
  /** `prod_…` ou `price_…`. */
  id: string;
  motivo: string;
}

export interface PlanosResolvidos {
  /** O que vai para `features.subscription_update.products`. Vazio = troca de plano desligada. */
  planos: PlanoDoPortal[];
  excluidos: PlanoExcluido[];
  /** Por que a troca ficou desligada, quando ficou. */
  aviso: string | null;
}

/** Por que um Price do Stripe não serve para a troca de plano; `null` = serve. */
function motivoDePrecoInelegivel(p: PrecoDoStripe): string | null {
  const saas = motivoDeSaaS(p.metadata);
  if (saas) return `preço ${saas}`;
  if (p.active === false) return "preço inativo no Stripe";
  if (p.type !== "recurring" || !p.recurring) return "preço não é recorrente";
  if (p.recurring.usage_type && p.recurring.usage_type !== "licensed") return "preço de uso medido (o portal não atualiza assinatura medida)";
  if (ehPrecoEscalonado(p)) return "preço escalonado";
  if (p.transform_quantity) return "preço com divisor de quantidade";
  if ((p.currency ?? "").toLowerCase() !== MOEDA_DO_PORTAL) return `moeda ${String(p.currency).toUpperCase()} (o portal do ONFACE oferece só ${MOEDA_DO_PORTAL.toUpperCase()})`;
  return null;
}

/**
 * Cruza o catálogo do ONFACE com o Stripe e devolve os planos oferecíveis, na ordem do catálogo.
 * Qualquer dúvida exclui — e o motivo aparece em `excluidos`.
 */
export function resolverPlanosDoPortal(entrada: {
  catalogo: ProdutoDoCatalogo[];
  produtosStripe: ProdutoDoStripe[];
  precosStripe: PrecoDoStripe[];
}): PlanosResolvidos {
  const excluidos: PlanoExcluido[] = [];
  const produtoPorId = new Map(entrada.produtosStripe.map((p) => [p.id, p]));
  const precoPorId = new Map(entrada.precosStripe.map((p) => [p.id, p]));

  const doCatalogo = entrada.catalogo
    .filter((c) => c.ativo && c.tipo === "recorrente" && c.categoria === CATEGORIA_TROCA_DE_PLANO && c.origemCatalogo === ORIGEM_CATALOGO_OFICIAL && !!c.stripeProductId)
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));

  const planos: PlanoDoPortal[] = [];
  const vistos = new Set<string>();
  for (const item of doCatalogo) {
    const produtoId = item.stripeProductId as string;
    if (vistos.has(produtoId)) continue;
    vistos.add(produtoId);

    const produto = produtoPorId.get(produtoId);
    if (!produto || produto.deleted) { excluidos.push({ id: produtoId, motivo: `${item.nome}: produto não existe no Stripe` }); continue; }
    const saasProduto = motivoDeSaaS(produto.metadata);
    if (saasProduto) { excluidos.push({ id: produtoId, motivo: `${item.nome}: produto ${saasProduto}` }); continue; }
    if (produto.active === false) { excluidos.push({ id: produtoId, motivo: `${item.nome}: produto inativo no Stripe` }); continue; }

    // Prices que o catálogo vende E que o Stripe ainda tem em condição de ser o destino de uma troca.
    const elegiveis: PrecoDoStripe[] = [];
    for (const cp of item.precos) {
      if (!cp.ativo || !cp.recorrente) continue;
      const sp = precoPorId.get(cp.stripePriceId);
      if (!sp) { excluidos.push({ id: cp.stripePriceId, motivo: `${item.nome}: preço do catálogo não existe no Stripe` }); continue; }
      if (sp.product !== produtoId) { excluidos.push({ id: cp.stripePriceId, motivo: `${item.nome}: preço pertence a outro produto no Stripe (${sp.product})` }); continue; }
      const m = motivoDePrecoInelegivel(sp);
      if (m) { excluidos.push({ id: sp.id, motivo: `${item.nome}: ${m}` }); continue; }
      elegiveis.push(sp);
    }

    // Dois Prices do mesmo produto com o mesmo intervalo: o Stripe recusa a configuração inteira.
    const porIntervalo = new Map<string, PrecoDoStripe[]>();
    for (const p of elegiveis) {
      const k = `${p.recurring?.interval}:${p.recurring?.interval_count ?? 1}`;
      porIntervalo.set(k, [...(porIntervalo.get(k) ?? []), p]);
    }
    const precos: string[] = [];
    for (const [k, grupo] of porIntervalo) {
      if (grupo.length === 1) { precos.push(grupo[0].id); continue; }
      for (const p of grupo) excluidos.push({ id: p.id, motivo: `${item.nome}: ${grupo.length} preços com o mesmo intervalo (${k}); o Stripe recusa — desative os extras no catálogo` });
    }
    if (precos.length === 0) { excluidos.push({ id: produtoId, motivo: `${item.nome}: nenhum preço elegível` }); continue; }
    planos.push({ produto: produtoId, precos: precos.sort() });
  }

  let aviso: string | null = null;
  let finais = planos;
  if (finais.length > LIMITE_PRODUTOS_DO_PORTAL) {
    for (const p of finais.slice(LIMITE_PRODUTOS_DO_PORTAL)) excluidos.push({ id: p.produto, motivo: `acima do limite de ${LIMITE_PRODUTOS_DO_PORTAL} produtos do Stripe (vale a ordem do catálogo)` });
    finais = finais.slice(0, LIMITE_PRODUTOS_DO_PORTAL);
  }
  const totalDePrecos = finais.reduce((n, p) => n + p.precos.length, 0);
  if (totalDePrecos < 2) {
    aviso = totalDePrecos === 0
      ? "nenhum plano do catálogo está em condição de ser oferecido: troca de plano fica DESLIGADA"
      : "só há 1 preço escolhível, e trocar exige pelo menos 2: troca de plano fica DESLIGADA";
    finais = [];
  }
  return { planos: finais, excluidos, aviso };
}
