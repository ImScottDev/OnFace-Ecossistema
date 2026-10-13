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
import {
  MARCA_CONFIG, MENSAGEM_FALTAM_POLITICAS, PortalConfigError, decidirConfiguracao, ehRecusaPorPoliticas, formDaConfiguracao,
  type ConfiguracaoDoStripe, type PoliticasPortal,
} from "./stripe-portal-config";

const STRIPE_API = "https://api.stripe.com/v1";
/* MESMA constante dos módulos vizinhos: duas versões de API conversando com a
   mesma conta devolvem formas diferentes do mesmo objeto. */
const STRIPE_API_VERSION = process.env.STRIPE_API_VERSION || "2026-08-26.dahlia";

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

/* A decisão (o que o ONFACE quer, como reconhecer a configuração dele, quando
   criar/atualizar/reusar) é pura e mora em `stripe-portal-config.ts`, com teste.
   Aqui ficam só as chamadas de rede. */
export { formDaConfiguracao, PortalConfigError } from "./stripe-portal-config";

function politicasDoAmbiente(): PoliticasPortal {
  return { privacyUrl: process.env.STRIPE_PORTAL_PRIVACY_URL, termsUrl: process.env.STRIPE_PORTAL_TERMS_URL };
}

/** Memo de processo, com validade: uma mudança feita à mão no Dashboard é percebida em minutos, sem listar a cada clique. */
let memo: { id: string; ate: number } | null = null;
const VALIDADE_MEMO_MS = 10 * 60 * 1000;

export interface ConfiguracaoDoPortal {
  id: string | null;
  /** `mock` sem chave; `fixada` quando o operador fixou o id no ambiente. */
  acao: "criada" | "atualizada" | "reusada" | "fixada" | "mock";
  /** Riscos de usar uma configuração que não é a do ONFACE (só no `fixada`). */
  riscos?: string[];
}

/**
 * Garante a configuração do ONFACE e devolve o id.
 *
 * Ordem: (1) id fixado em `STRIPE_PORTAL_CONFIGURATION_ID` — escolha explícita do
 * operador, respeitada sem rede; (2) a configuração marcada `crm_portal` — usada
 * como está, ou atualizada SÓ se divergir (antes escrevia no Stripe a cada
 * clique); (3) criar. Nunca toca a padrão da conta nem a do SaaS. Se o Stripe
 * recusar criar por falta de política/termos, lança `PortalConfigError` com o que
 * falta — a rota mostra a mensagem, não um 400 cru.
 */
export async function configurarPortal(): Promise<ConfiguracaoDoPortal> {
  if (getStripeCheckoutMode() === "mock") return { id: null, acao: "mock" };

  const fixadoId = process.env.STRIPE_PORTAL_CONFIGURATION_ID || null;
  if (fixadoId) {
    const d = decidirConfiguracao({ fixadoId });
    return { id: d.acao === "usar_fixada" ? d.id : fixadoId, acao: "fixada" };
  }

  if (memo && memo.ate > Date.now()) return { id: memo.id, acao: "reusada" };

  const lista = (await stripe<{ data: ConfiguracaoDoStripe[] }>("billing_portal/configurations?limit=100&active=true")).data ?? [];
  const politicas = politicasDoAmbiente();
  const d = decidirConfiguracao({ lista, politicas });

  if (d.acao === "reusar") { memo = { id: d.id, ate: Date.now() + VALIDADE_MEMO_MS }; return { id: d.id, acao: "reusada" }; }
  if (d.acao === "atualizar") {
    /* Update, não create: cada create deixa uma configuração órfã ativa na conta. */
    await stripe(`billing_portal/configurations/${d.id}`, formDaConfiguracao(politicas));
    memo = { id: d.id, ate: Date.now() + VALIDADE_MEMO_MS };
    return { id: d.id, acao: "atualizada" };
  }
  if (d.acao !== "criar") throw new PortalConfigError("fixada_invalida", "Configuração do portal inválida.");

  try {
    /* Idempotency-Key com a marca da versão: duas réplicas subindo juntas não criam duas configurações. */
    const r = await stripe<{ id: string }>("billing_portal/configurations", formDaConfiguracao(politicas), `portal-config-${MARCA_CONFIG}`);
    memo = { id: r.id, ate: Date.now() + VALIDADE_MEMO_MS };
    return { id: r.id, acao: "criada" };
  } catch (erro) {
    if (ehRecusaPorPoliticas(erro)) throw new PortalConfigError("faltam_politicas", MENSAGEM_FALTAM_POLITICAS);
    throw erro;
  }
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
