/**
 * Alterar a assinatura do cliente SEM sair do ONFACE: adicionar produto,
 * mudar quantidade, remover, trocar Price (upgrade/downgrade/ciclo), cancelar
 * e reativar.
 *
 * Regra do Scott (stripe-onface-definicao §3): upgrade é imediato, com
 * pró-rata; downgrade vale no próximo ciclo; usuário autorizado sobrescreve.
 *
 *  - `agora`         → `proration_behavior=always_invoice` (fatura na hora) e
 *                      `payment_behavior=error_if_incomplete` (cartão recusado
 *                      volta como erro, não como alteração pendurada).
 *  - `proximo_ciclo` → `proration_behavior=none`: troca o item sem crédito nem
 *                      cobrança agora; o ciclo (`billing_cycle_anchor`) não
 *                      muda, então o valor novo aparece na próxima renovação.
 *
 * Tudo vai num único `POST /subscriptions/{id}` (itens + metadata + proration),
 * então a alteração é atômica e tem uma só chave de idempotência.
 *
 * A conta Stripe é COMPARTILHADA com o SaaS Callface: assinatura com metadata
 * `organization_id` / `plan_id` / `user_id` é do SaaS e este módulo se recusa a
 * tocá-la.
 */
import { mrrDaAssinatura, previaDeAlteracao, stripe, type PreviaDeAlteracao } from "./stripe-assinatura";

export type AcaoDeAssinatura =
  | { tipo: "adicionar_item"; priceId: string; quantidade: number }
  | { tipo: "alterar_quantidade"; itemId: string; quantidade: number }
  | { tipo: "remover_item"; itemId: string }
  | { tipo: "trocar_price"; itemId: string; novoPriceId: string; quantidade?: number }
  | { tipo: "cancelar"; quando: "fim_periodo" | "agora" }
  | { tipo: "reativar" };

export type Efeito = "agora" | "proximo_ciclo";
export type Direcao = "upgrade" | "downgrade" | "neutra";

/** Erro que a rota devolve com o status certo, em vez de um 500 genérico. */
export class ErroDeAlteracao extends Error {
  constructor(public status: 404 | 409 | 422, mensagem: string, public extra?: Record<string, unknown>) {
    super(mensagem);
  }
}

interface PrecoStripe { id: string; active?: boolean; unit_amount?: number | null; recurring?: { interval?: string; interval_count?: number } | null }
interface ItemStripe { id: string; quantity?: number; price?: PrecoStripe }
export interface AssinaturaStripe {
  id: string;
  status: string;
  customer: string;
  cancel_at_period_end?: boolean;
  latest_invoice?: string | null;
  metadata?: Record<string, string>;
  payment_settings?: { payment_method_types?: string[] | null } | null;
  default_payment_method?: string | { id?: string; type?: string } | null;
  items: { data: ItemStripe[] };
}

/**
 * Métodos que NUNCA confirmam na hora: o cliente recebe um documento e paga
 * depois (boleto compensa em 1 a 3 dias úteis).
 */
const PAGAMENTO_ASSINCRONO = new Set(["boleto", "oxxo", "customer_balance", "sepa_debit", "konbini"]);

/**
 * A assinatura é paga por um método assíncrono?
 *
 * Decide entre `error_if_incomplete` e `allow_incomplete` — e a escolha errada
 * não é um detalhe: ver o comentário em `pedidoDoStripe`.
 */
export function pagamentoEhAssincrono(a: Pick<AssinaturaStripe, "payment_settings" | "default_payment_method">): boolean {
  if ((a.payment_settings?.payment_method_types ?? []).some((m) => PAGAMENTO_ASSINCRONO.has(m))) return true;
  const padrao = a.default_payment_method;
  return typeof padrao === "object" && padrao !== null && !!padrao.type && PAGAMENTO_ASSINCRONO.has(padrao.type);
}

/** Quem pediu e a que venda a alteração pertence. Tudo opcional menos a organização. */
export interface OrigemDaAlteracao {
  organizacaoId: string;
  usuarioId?: string | null;
  negocioId?: string | null;
  propostaId?: string | null;
}

export interface Plano {
  assinatura: AssinaturaStripe;
  direcao: Direcao;
  efeitoPadrao: Efeito;
  efeito: Efeito;
  mrrAntes: number;
  mrrDepois: number;
  /** Itens no formato do `invoices/create_preview`; vazio para cancelar/reativar. */
  itensDaPrevia: { id?: string; price?: string; quantity?: number; deleted?: boolean }[];
}

/** Assinatura do SaaS Callface: tem estes ids na metadata. Nunca tocamos. */
export function ehDoSaas(metadata: Record<string, string> | undefined): boolean {
  return !!metadata && ["organization_id", "plan_id", "user_id"].some((k) => !!metadata[k]);
}

export async function lerAssinatura(subscriptionId: string): Promise<AssinaturaStripe> {
  /* `default_payment_method` expandido porque é ele que diz se o cliente paga
     por boleto — sem expandir vem só o id e `pagamentoEhAssincrono` erra. */
  const sub = await stripe<AssinaturaStripe>(`subscriptions/${subscriptionId}?expand[]=items.data.price&expand[]=default_payment_method`);
  if (ehDoSaas(sub.metadata)) {
    throw new ErroDeAlteracao(409, "Esta assinatura pertence ao SaaS Callface (conta Stripe compartilhada). O ONFACE não altera.");
  }
  return sub;
}

function acharItem(sub: AssinaturaStripe, itemId: string): ItemStripe {
  const item = sub.items.data.find((i) => i.id === itemId);
  if (!item) throw new ErroDeAlteracao(404, "Esse item não pertence a esta assinatura.");
  return item;
}

async function lerPreco(priceId: string): Promise<PrecoStripe> {
  const p = await stripe<PrecoStripe>(`prices/${priceId}`);
  if (p.active === false) throw new ErroDeAlteracao(409, "Esse Price está arquivado no Stripe.");
  return p;
}

const direcaoDe = (antes: number, depois: number): Direcao =>
  depois > antes + 0.005 ? "upgrade" : depois < antes - 0.005 ? "downgrade" : "neutra";

/**
 * Lê o Stripe, valida e diz o que vai acontecer. Não altera nada — é a base
 * tanto da prévia quanto da aplicação, para as duas nunca divergirem.
 */
export async function planejarAlteracao(
  subscriptionId: string,
  acao: AcaoDeAssinatura,
  opcoes: { efeito?: Efeito; sobrescrever?: boolean } = {},
): Promise<Plano> {
  const sub = await lerAssinatura(subscriptionId);
  const viva = sub.status === "active" || sub.status === "trialing";
  if (!viva) throw new ErroDeAlteracao(409, `A assinatura está '${sub.status}'; só assinatura ativa ou em teste pode ser alterada.`);

  const mrrAntes = mrrDaAssinatura(sub);
  let finais: { quantity?: number; price?: PrecoStripe }[] = sub.items.data;
  let itensDaPrevia: Plano["itensDaPrevia"] = [];
  let efeitoPedidoPelaAcao: Efeito | undefined;

  switch (acao.tipo) {
    case "adicionar_item": {
      if (sub.items.data.some((i) => i.price?.id === acao.priceId)) {
        throw new ErroDeAlteracao(409, "Esse Price já está na assinatura — use 'Alterar quantidade'.");
      }
      const preco = await lerPreco(acao.priceId);
      finais = [...sub.items.data, { quantity: acao.quantidade, price: preco }];
      itensDaPrevia = [{ price: acao.priceId, quantity: acao.quantidade }];
      break;
    }
    case "alterar_quantidade": {
      const item = acharItem(sub, acao.itemId);
      if (acao.quantidade === (item.quantity ?? 1)) throw new ErroDeAlteracao(409, "A quantidade já é essa.");
      finais = sub.items.data.map((i) => (i.id === item.id ? { ...i, quantity: acao.quantidade } : i));
      itensDaPrevia = [{ id: item.id, quantity: acao.quantidade }];
      break;
    }
    case "remover_item": {
      const item = acharItem(sub, acao.itemId);
      if (sub.items.data.length <= 1) throw new ErroDeAlteracao(409, "É o único item da assinatura — para encerrar, use 'Cancelar'.");
      finais = sub.items.data.filter((i) => i.id !== item.id);
      itensDaPrevia = [{ id: item.id, deleted: true }];
      break;
    }
    case "trocar_price": {
      const item = acharItem(sub, acao.itemId);
      if (item.price?.id === acao.novoPriceId) throw new ErroDeAlteracao(409, "A assinatura já está nesse Price.");
      const preco = await lerPreco(acao.novoPriceId);
      // Trocar o Price sem reenviar a quantidade a reseta para 1 (pegadinha do Stripe).
      const quantity = acao.quantidade ?? item.quantity ?? 1;
      finais = sub.items.data.map((i) => (i.id === item.id ? { quantity, price: preco } : i));
      itensDaPrevia = [{ id: item.id, price: acao.novoPriceId, quantity }];
      break;
    }
    case "cancelar":
      if (sub.cancel_at_period_end && acao.quando === "fim_periodo") throw new ErroDeAlteracao(409, "Já está marcada para cancelar no fim do período.");
      finais = acao.quando === "agora" ? [] : sub.items.data;
      efeitoPedidoPelaAcao = acao.quando === "agora" ? "agora" : "proximo_ciclo";
      break;
    case "reativar":
      if (!sub.cancel_at_period_end) throw new ErroDeAlteracao(409, "Essa assinatura não está marcada para cancelar.");
      efeitoPedidoPelaAcao = "agora";
      break;
  }

  const mrrDepois = acao.tipo === "cancelar" && acao.quando === "fim_periodo" ? mrrAntes : mrrDaAssinatura({ items: { data: finais } });
  // Cancelar é sempre redução; reativar desfaz uma redução já marcada.
  const direcao: Direcao = acao.tipo === "cancelar" ? "downgrade" : acao.tipo === "reativar" ? "neutra" : direcaoDe(mrrAntes, mrrDepois);
  const efeitoPadrao: Efeito = acao.tipo === "cancelar" ? "proximo_ciclo" : direcao === "downgrade" ? "proximo_ciclo" : "agora";
  const efeito = efeitoPedidoPelaAcao ?? opcoes.efeito ?? efeitoPadrao;
  if (efeito !== efeitoPadrao && !opcoes.sobrescrever) {
    throw new ErroDeAlteracao(
      422,
      `Pela regra, ${direcao === "downgrade" ? "downgrade vale no próximo ciclo" : "upgrade é imediato, com pró-rata"}. Para mudar isso, confirme a exceção.`,
      { efeitoPadrao, precisaSobrescrever: true },
    );
  }
  return { assinatura: sub, direcao, efeitoPadrao, efeito, mrrAntes, mrrDepois, itensDaPrevia };
}

/** O que o Stripe recebe. Pura: dá para testar sem rede. */
export function pedidoDoStripe(
  plano: Plano,
  acao: AcaoDeAssinatura,
  origem: OrigemDaAlteracao,
): { path: string; form: URLSearchParams; metodo?: "DELETE" } {
  const subId = plano.assinatura.id;
  const form = new URLSearchParams();

  // Metadata só com valor: string vazia APAGA a chave no Stripe, e a ideia é
  // preservar o que já está lá (crm_* e ids anteriores).
  const meta: Record<string, string | null | undefined> = {
    crm_organization_id: origem.organizacaoId,
    crm_negocio_id: origem.negocioId,
    crm_proposal_id: origem.propostaId,
    crm_alterado_por: origem.usuarioId,
    crm_motion: plano.direcao === "upgrade" ? "EXPANSION" : undefined,
  };
  const comMeta = (prefixo: string) => {
    for (const [k, v] of Object.entries(meta)) if (v) form.append(`${prefixo}[${k}]`, v.slice(0, 500));
  };

  if (acao.tipo === "cancelar" && acao.quando === "agora") {
    form.append("invoice_now", "false");
    form.append("prorate", "false");
    return { path: `subscriptions/${subId}`, form, metodo: "DELETE" };
  }

  comMeta("metadata");
  if (acao.tipo === "cancelar") form.append("cancel_at_period_end", "true");
  else if (acao.tipo === "reativar") form.append("cancel_at_period_end", "false");
  else {
    plano.itensDaPrevia.forEach((it, i) => {
      if (it.id) form.append(`items[${i}][id]`, it.id);
      if (it.price) form.append(`items[${i}][price]`, it.price);
      if (it.quantity !== undefined) form.append(`items[${i}][quantity]`, String(it.quantity));
      if (it.deleted) form.append(`items[${i}][deleted]`, "true");
      if (!it.id) comMeta(`items[${i}][metadata]`); // item novo nasce com a origem
    });
    if (plano.efeito === "agora") {
      form.append("proration_behavior", "always_invoice");
      /* `error_if_incomplete` só serve para quem paga na hora.

         Com boleto o pagamento é assíncrono por definição: o Stripe emite o
         documento, o PaymentIntent fica em `requires_action` e o
         `error_if_incomplete` entende isso como "não completou" — desfaz a
         alteração, apaga a fatura do pró-rata e devolve erro. O boleto, esse,
         fica de pé: válido, no nome do cliente, órfão de fatura e por isso
         impossível de cancelar pela API ("You cannot cancel PaymentIntents
         created by invoices"). Pago, o dinheiro entra e não entrega nada.

         Aconteceu duas vezes com a mesma venda (Maíra cred, proposta #1581,
         21 e 23/10/2026: R$ 149,07 e R$ 139,22 em boleto vivo, assinatura
         intacta em 1 usuário). A retentativa não conserta — o Stripe passa a
         recusar a alteração enquanto o boleto não expirar, e ao expirar o
         ciclo recomeça igual.

         Para esses, `allow_incomplete`: a alteração entra, a fatura do
         pró-rata fica em aberto e o cliente paga o boleto dela. É o mesmo
         pós-pago que vale para venda por contrato. */
      form.append(
        "payment_behavior",
        pagamentoEhAssincrono(plano.assinatura)
          ? "allow_incomplete"
          : "error_if_incomplete",
      );
    } else {
      form.append("proration_behavior", "none");
    }
  }
  return { path: `subscriptions/${subId}`, form };
}

/** Quanto o cliente paga agora. `null` quando a ação não gera cobrança (cancelar, reativar). */
export async function previaDaAlteracao(plano: Plano): Promise<PreviaDeAlteracao | null> {
  if (!plano.itensDaPrevia.length) return null;
  return previaDeAlteracao({
    stripeSubscriptionId: plano.assinatura.id,
    stripeCustomerId: plano.assinatura.customer,
    itens: plano.itensDaPrevia,
    prorationBehavior: plano.efeito === "agora" ? "always_invoice" : "none",
  });
}

export interface ResultadoDaAlteracao {
  stripeSubscriptionId: string;
  faturaId: string | null;
  status: string;
  cancelaNoFimDoPeriodo: boolean;
  mrrAntes: number;
  mrrDepois: number;
}

/**
 * Aplica. `chave` é estável por INTENÇÃO (a tela gera uma ao abrir a modal):
 * clique duplo e reenvio caem na mesma chave e o Stripe devolve a mesma
 * resposta em vez de alterar de novo.
 */
export async function aplicarAlteracao(
  plano: Plano,
  acao: AcaoDeAssinatura,
  origem: OrigemDaAlteracao,
  chave: string,
): Promise<ResultadoDaAlteracao> {
  const { path, form, metodo } = pedidoDoStripe(plano, acao, origem);
  const depois = await stripe<AssinaturaStripe>(path, form, `onface-assin-${chave}`, metodo);
  return {
    stripeSubscriptionId: plano.assinatura.id,
    faturaId: depois.latest_invoice ?? null,
    status: depois.status,
    cancelaNoFimDoPeriodo: !!depois.cancel_at_period_end,
    mrrAntes: plano.mrrAntes,
    mrrDepois: plano.mrrDepois,
  };
}
