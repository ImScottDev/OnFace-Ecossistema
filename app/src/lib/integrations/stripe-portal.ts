/**
 * Customer Portal do Stripe — a página hospedada onde o PRÓPRIO cliente troca
 * a forma de pagamento.
 *
 * Por que existe: hoje quem paga por boleto e quer passar para cartão não tem
 * caminho nenhum. O CRM não guarda cartão (e não deve: entraria no escopo de
 * PCI por conta própria), e o dono do produto também não consegue trocar pelo
 * Dashboard — método de pagamento é dado do cliente, só ele informa. O portal é
 * a resposta oficial do Stripe para isso: link efêmero, autenticado pela sessão,
 * onde o cliente informa o cartão novo e a assinatura passa a cobrar nele.
 *
 * Duas coisas aqui são deliberadas e opostas entre si:
 *
 *   - a CONFIGURAÇÃO (o que o portal deixa fazer) é durável e vive no código,
 *     não no Dashboard. Configuração clicada em tela não tem revisão, não tem
 *     histórico e não acompanha o deploy — e "quem ligou o cancelamento?" fica
 *     sem resposta. Por isso ela é criada/atualizada por `configurarPortal()` e
 *     reusada pelo id.
 *   - a SESSÃO é descartável: o Stripe a expira em ~5 minutos sem uso e ela é
 *     um link autenticado. Guardar em banco ou reaproveitar entre clientes seria
 *     entregar acesso ao billing de alguém. Uma sessão por clique, sempre.
 */

import { getStripeCheckoutMode } from "./stripe-checkout";

const STRIPE_API = "https://api.stripe.com/v1";
/* MESMA constante dos módulos vizinhos: duas versões de API conversando com a
   mesma conta devolvem formas diferentes do mesmo objeto. */
const STRIPE_API_VERSION = process.env.STRIPE_API_VERSION || "2026-08-26.dahlia";

/** Marca da nossa configuração. Subir a versão aqui força o update no Stripe. */
const MARCA_CONFIG = "crm-cliente-360-v1";

function chave(): string {
  const k = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY;
  if (!k) throw new Error("STRIPE_SECRET_KEY ou STRIPE_API_KEY não configurada");
  return k;
}

async function stripe<T>(path: string, form?: URLSearchParams, idempotencyKey?: string): Promise<T> {
  const res = await fetch(`${STRIPE_API}/${path}`, {
    method: form ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${chave()}`,
      "Stripe-Version": STRIPE_API_VERSION,
      ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(idempotencyKey
        ? { "Idempotency-Key": idempotencyKey.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 255) }
        : {}),
    },
    ...(form ? { body: form.toString() } : {}),
  });
  if (!res.ok) {
    const corpo = await res.text();
    throw new Error(`Stripe ${path}: HTTP ${res.status} ${corpo.slice(0, 400)}`);
  }
  return res.json() as Promise<T>;
}

/* ── A configuração ───────────────────────────────────────────────────────── */

/**
 * O corpo da configuração, puro, para o teste poder travar o que importa sem
 * tocar na rede.
 *
 * `payment_method_update` é a razão de tudo isto existir — sem ele o portal
 * mostra faturas e não resolve boleto→cartão. `cancellation_reason` é pedido do
 * CS: cancelamento sem motivo registrado é churn que ninguém aprende.
 */
export function formDaConfiguracao(): URLSearchParams {
  const form = new URLSearchParams();

  // O que resolve a dor: o cliente informa o cartão novo e a assinatura passa
  // a cobrar nele, sem o CRM nunca ver o número.
  form.append("features[payment_method_update][enabled]", "true");
  // Faturas e recibos: é o que evita o pedido de "me manda a nota de março" no
  // WhatsApp do closer.
  form.append("features[invoice_history][enabled]", "true");

  /* Cadastro de cobrança. `tax_id` entra porque CNPJ errado na nota é retrabalho
     do financeiro, e o cliente é quem sabe o número certo. `email` fica FORA de
     propósito: ele é a identidade do Customer no Stripe e casa o webhook com a
     empresa no CRM — deixar o cliente trocar sozinho quebraria a conciliação. */
  form.append("features[customer_update][enabled]", "true");
  ["address", "tax_id", "name", "phone"].forEach((campo, i) =>
    form.append(`features[customer_update][allowed_updates][${i}]`, campo),
  );

  /* Cancelamento no FIM do período, nunca imediato: o cliente já pagou o mês
     corrente, e cortar na hora gera crédito/reembolso que ninguém pediu. Até a
     data do corte o CS ainda tem prazo para reverter. */
  form.append("features[subscription_cancel][enabled]", "true");
  form.append("features[subscription_cancel][mode]", "at_period_end");
  form.append("features[subscription_cancel][cancellation_reason][enabled]", "true");
  /* O Stripe exige um mínimo de opções quando o motivo está ligado, e só aceita
     as chaves do enum dele — o texto livre é o `other`. */
  ["too_expensive", "missing_features", "switched_service", "unused", "customer_service", "too_complex", "low_quality", "other"]
    .forEach((motivo, i) => form.append(`features[subscription_cancel][cancellation_reason][options][${i}]`, motivo));

  /* Criar configuração sem política de privacidade/termos é recusado pelo Stripe
     quando a conta não tem os dois no branding. Mandamos se houver no .env; se
     não houver, o erro do Stripe é claro e melhor do que um default inventado. */
  if (process.env.STRIPE_PORTAL_PRIVACY_URL) form.append("business_profile[privacy_policy_url]", process.env.STRIPE_PORTAL_PRIVACY_URL);
  if (process.env.STRIPE_PORTAL_TERMS_URL) form.append("business_profile[terms_of_service_url]", process.env.STRIPE_PORTAL_TERMS_URL);

  form.append("metadata[crm_portal]", MARCA_CONFIG);
  return form;
}

/** Memo de processo: evita relistar as configurações a cada clique. */
let idEmMemoria: string | null = null;

export interface ConfiguracaoDoPortal {
  id: string | null;
  /** `criada` na primeira vez, `atualizada` quando já existia, `mock` sem chave. */
  acao: "criada" | "atualizada" | "reusada" | "mock";
}

/**
 * Cria a configuração na primeira vez e ATUALIZA a mesma depois.
 *
 * O id é reencontrado pela metadata em vez de guardado em tabela: configuração
 * é objeto de ambiente (uma por conta Stripe), não dado de tenant, e uma coluna
 * nova para isso seria migração para guardar uma string por instalação. Quem
 * quiser fixar à mão usa `STRIPE_PORTAL_CONFIGURATION_ID`.
 */
export async function configurarPortal(): Promise<ConfiguracaoDoPortal> {
  if (getStripeCheckoutMode() === "mock") return { id: null, acao: "mock" };

  const fixado = process.env.STRIPE_PORTAL_CONFIGURATION_ID;
  if (fixado) {
    idEmMemoria = fixado;
    return { id: fixado, acao: "reusada" };
  }

  const existente = idEmMemoria ?? (await acharConfiguracao());
  const form = formDaConfiguracao();
  if (existente) {
    /* Update, não create: cada create deixa uma configuração órfã ativa na conta,
       e em pouco tempo ninguém sabe qual está em uso. */
    const r = await stripe<{ id: string }>(`billing_portal/configurations/${existente}`, form);
    idEmMemoria = r.id;
    return { id: r.id, acao: "atualizada" };
  }

  /* Idempotency-Key com a marca da versão: duas réplicas subindo juntas não
     criam duas configurações. */
  const r = await stripe<{ id: string }>("billing_portal/configurations", form, `portal-config-${MARCA_CONFIG}`);
  idEmMemoria = r.id;
  return { id: r.id, acao: "criada" };
}

async function acharConfiguracao(): Promise<string | null> {
  const r = await stripe<{ data: { id: string; metadata?: Record<string, string> | null }[] }>(
    "billing_portal/configurations?limit=100&is_active=true",
  );
  return (r.data ?? []).find((c) => c.metadata?.crm_portal === MARCA_CONFIG)?.id ?? null;
}

/* ── A sessão ─────────────────────────────────────────────────────────────── */

export interface PortalAberto {
  /** `null` só em modo mock — aí `motivo` diz por quê, e a tela não mente. */
  url: string | null;
  mocked: boolean;
  motivo?: string;
}

/**
 * O link do portal para ESTE cliente, válido por poucos minutos.
 *
 * Sem `Idempotency-Key` de propósito: aqui repetir a chamada DEVE criar uma
 * sessão nova. Reaproveitar a de ontem entregaria um link já expirado — ou, pior,
 * um link vivo que vazou.
 *
 * A `configuration` vai explícita na sessão para o portal abrir com as features
 * versionadas acima, e não com o que estiver clicado no Dashboard.
 */
export async function abrirPortal(params: {
  stripeCustomerId: string;
  /** Para onde o botão "Voltar" do portal leva — o Cliente 360 de onde veio. */
  returnUrl: string;
}): Promise<PortalAberto> {
  if (getStripeCheckoutMode() === "mock") {
    return {
      url: null,
      mocked: true,
      motivo: "Stripe em modo mock neste ambiente: nenhuma sessão de portal é criada.",
    };
  }

  const { id: configuration } = await configurarPortal();
  const form = new URLSearchParams();
  form.append("customer", params.stripeCustomerId);
  form.append("return_url", params.returnUrl);
  if (configuration) form.append("configuration", configuration);
  // pt-BR explícito: o default do Stripe segue o navegador do cliente e já
  // apareceu portal em inglês para cliente brasileiro.
  form.append("locale", "pt-BR");

  const sessao = await stripe<{ url: string }>("billing_portal/sessions", form);
  return { url: sessao.url, mocked: false };
}
