/**
 * Configuração do Portal do cliente (Stripe) — parte PURA: o que o ONFACE quer,
 * como reconhecer a configuração dele na conta e o que fazer em cada situação.
 * Sem rede, sem banco, sem `process.env` escondido: o teste roda com Stripe falso.
 *
 * Por que o ONFACE tem configuração PRÓPRIA (decisão de 13/10/2026):
 *
 *   A conta Stripe é COMPARTILHADA com o SaaS Callface e só tem duas
 *   configurações de portal. A padrão (`is_default`, feita à mão no Dashboard em
 *   jul/2025) deixa o cliente trocar o E-MAIL, e o e-mail é a identidade do
 *   Customer que casa o webhook com a empresa; não deixa trocar o documento
 *   fiscal; e qualquer pessoa com acesso ao Dashboard muda o que ela permite sem
 *   revisão e sem aviso ao ONFACE. A outra (`managed_by = callface-backend`) é do
 *   SaaS e não se toca. Reusar a padrão "resolvia o sintoma" mas deixava o
 *   comportamento do portal nas mãos de quem não sabe que o ONFACE depende dele.
 *
 * Mudança de plano NÃO está ligada no portal de propósito: upgrade é imediato
 * com pró-rata, downgrade vale no próximo ciclo e o CS pode sobrescrever (regras
 * do Cliente 360); o portal só rebaixa entre Prices do MESMO Product, não opera
 * assinatura com vários itens, com teste ou com cobrança por boleto/envio de
 * fatura — que é boa parte da carteira. Deixar o cliente trocar plano lá
 * criaria um segundo caminho comercial fora das portas de `lib/vendas`.
 */

/** Marca da nossa configuração. Subir a versão aqui força o update no Stripe. */
export const MARCA_CONFIG = "crm-cliente-360-v1";

/** Campo do cadastro que o cliente pode editar no portal. `email` fica FORA (ver acima). */
export const CAMPOS_EDITAVEIS = ["address", "tax_id", "name", "phone"] as const;

/** O Stripe só aceita estas chaves de motivo de cancelamento; `other` é o texto livre. */
export const MOTIVOS_CANCELAMENTO = [
  "too_expensive", "missing_features", "switched_service", "unused", "customer_service", "too_complex", "low_quality", "other",
] as const;

export interface PoliticasPortal {
  privacyUrl?: string | null;
  termsUrl?: string | null;
}

/** O corpo da configuração. Puro: as URLs de política entram por parâmetro. */
export function formDaConfiguracao(politicas: PoliticasPortal = {}): URLSearchParams {
  const form = new URLSearchParams();

  // O que resolve a dor: o cliente informa o cartão novo e a assinatura passa a
  // cobrar nele, sem o ONFACE nunca ver o número (fora do escopo de PCI).
  form.append("features[payment_method_update][enabled]", "true");
  form.append("features[invoice_history][enabled]", "true");

  form.append("features[customer_update][enabled]", "true");
  CAMPOS_EDITAVEIS.forEach((campo, i) => form.append(`features[customer_update][allowed_updates][${i}]`, campo));

  /* Cancelamento no FIM do período, nunca imediato: o cliente já pagou o mês
     corrente, e cortar na hora gera crédito/reembolso que ninguém pediu. Até o
     corte o CS ainda tem prazo para reverter — e é por isso que o webhook de
     cancelamento AGENDADO avisa a equipe (ver stripe-webhook-processor). */
  form.append("features[subscription_cancel][enabled]", "true");
  form.append("features[subscription_cancel][mode]", "at_period_end");
  form.append("features[subscription_cancel][cancellation_reason][enabled]", "true");
  MOTIVOS_CANCELAMENTO.forEach((m, i) => form.append(`features[subscription_cancel][cancellation_reason][options][${i}]`, m));

  // Troca de plano/quantidade: fora do portal. Explícito, para o drift enxergar.
  form.append("features[subscription_update][enabled]", "false");

  if (politicas.privacyUrl) form.append("business_profile[privacy_policy_url]", politicas.privacyUrl);
  if (politicas.termsUrl) form.append("business_profile[terms_of_service_url]", politicas.termsUrl);

  form.append("metadata[crm_portal]", MARCA_CONFIG);
  return form;
}

/* ── O que a conta tem hoje ───────────────────────────────────────────── */

export interface ConfiguracaoDoStripe {
  id: string;
  active?: boolean;
  is_default?: boolean;
  metadata?: Record<string, string> | null;
  business_profile?: { privacy_policy_url?: string | null; terms_of_service_url?: string | null } | null;
  features?: {
    customer_update?: { enabled?: boolean; allowed_updates?: string[] };
    invoice_history?: { enabled?: boolean };
    payment_method_update?: { enabled?: boolean };
    subscription_cancel?: { enabled?: boolean; mode?: string; cancellation_reason?: { enabled?: boolean } };
    subscription_update?: { enabled?: boolean };
  };
}

export const ehDoSaaS = (c: Pick<ConfiguracaoDoStripe, "metadata">) => c.metadata?.managed_by === "callface-backend";
export const ehDoOnface = (c: Pick<ConfiguracaoDoStripe, "metadata">) => c.metadata?.crm_portal === MARCA_CONFIG;

/** Diferenças entre o que o ONFACE quer e o que está na conta. Vazio = nada a atualizar. */
export function divergenciasDaConfiguracao(c: ConfiguracaoDoStripe): string[] {
  const f = c.features ?? {};
  const d: string[] = [];
  if (!ehDoOnface(c)) d.push(`marca crm_portal ausente ou de outra versão (esperado ${MARCA_CONFIG})`);
  if (f.payment_method_update?.enabled !== true) d.push("troca de forma de pagamento desligada");
  if (f.invoice_history?.enabled !== true) d.push("histórico de faturas desligado");
  if (f.customer_update?.enabled !== true) d.push("edição de cadastro desligada");
  const permitidos = [...(f.customer_update?.allowed_updates ?? [])].sort().join(",");
  const esperados = [...CAMPOS_EDITAVEIS].sort().join(",");
  if (permitidos !== esperados) d.push(`campos editáveis: ${permitidos || "(nenhum)"} em vez de ${esperados}`);
  if (f.subscription_cancel?.enabled !== true) d.push("cancelamento desligado");
  if (f.subscription_cancel?.mode !== "at_period_end") d.push(`cancelamento ${f.subscription_cancel?.mode ?? "?"} em vez de no fim do período`);
  if (f.subscription_cancel?.cancellation_reason?.enabled !== true) d.push("motivo de cancelamento desligado");
  if (f.subscription_update?.enabled === true) d.push("troca de plano ligada (decisão: plano muda pelo Cliente 360)");
  return d;
}

/** Riscos de USAR uma configuração que não é a do ONFACE (a padrão da conta, fixada à mão). */
export function riscosDeConfiguracaoAlheia(c: ConfiguracaoDoStripe): string[] {
  const r: string[] = [];
  if (c.is_default) r.push("é a configuração PADRÃO da conta: qualquer pessoa com Dashboard muda o portal sem revisão");
  if (c.features?.customer_update?.allowed_updates?.includes("email")) r.push("deixa o cliente trocar o e-mail, que é a identidade do Customer no webhook");
  if (c.features?.customer_update?.enabled && !c.features.customer_update.allowed_updates?.includes("tax_id")) r.push("não deixa o cliente corrigir o documento fiscal");
  if (c.features?.subscription_cancel?.mode === "immediately") r.push("cancela na hora, com crédito/reembolso do mês pago");
  return r;
}

/* ── A decisão ────────────────────────────────────────────────────────── */

export type DecisaoDoPortal =
  | { acao: "usar_fixada"; id: string; riscos: string[] }
  | { acao: "recusar_fixada"; id: string; motivo: string }
  | { acao: "reusar"; id: string }
  | { acao: "atualizar"; id: string; diferencas: string[] }
  | { acao: "criar"; semPoliticas: boolean };

/**
 * O que fazer, dado o que a conta tem. `lista` pode ser `undefined` quando há
 * id fixado e ninguém quer pagar uma chamada de rede só para validar.
 */
export function decidirConfiguracao(entrada: { fixadoId?: string | null; lista?: ConfiguracaoDoStripe[]; politicas?: PoliticasPortal }): DecisaoDoPortal {
  const { fixadoId, lista = [], politicas = {} } = entrada;
  if (fixadoId) {
    const c = lista.find((x) => x.id === fixadoId);
    if (c && ehDoSaaS(c)) return { acao: "recusar_fixada", id: fixadoId, motivo: "a configuração fixada é do SaaS Callface (managed_by=callface-backend); o ONFACE não usa nem altera objeto do SaaS" };
    if (c && c.active === false) return { acao: "recusar_fixada", id: fixadoId, motivo: "a configuração fixada está inativa no Stripe" };
    return { acao: "usar_fixada", id: fixadoId, riscos: c && !ehDoOnface(c) ? riscosDeConfiguracaoAlheia(c) : [] };
  }
  // Só olha o que é do ONFACE E está ativo. Nunca a padrão, nunca a do SaaS.
  const nossa = lista.find((c) => ehDoOnface(c) && c.active !== false && !ehDoSaaS(c));
  if (nossa) {
    const diferencas = divergenciasDaConfiguracao(nossa);
    return diferencas.length ? { acao: "atualizar", id: nossa.id, diferencas } : { acao: "reusar", id: nossa.id };
  }
  return { acao: "criar", semPoliticas: !politicas.privacyUrl || !politicas.termsUrl };
}

/* ── Erro honesto ─────────────────────────────────────────────────────── */

export type CodigoErroPortal = "faltam_politicas" | "fixada_invalida";

export class PortalConfigError extends Error {
  constructor(readonly codigo: CodigoErroPortal, mensagem: string) {
    super(mensagem);
    this.name = "PortalConfigError";
  }
}

export const MENSAGEM_FALTAM_POLITICAS =
  "O Portal do cliente ainda não tem configuração própria do ONFACE no Stripe, e o Stripe recusou criá-la sem política de privacidade " +
  "e termos de uso. Para liberar: defina STRIPE_PORTAL_PRIVACY_URL e STRIPE_PORTAL_TERMS_URL no .env do servidor (o ONFACE cria a " +
  "configuração sozinho no primeiro uso), ou cadastre os dois em Stripe > Configurações > Dados públicos. Enquanto isso o botão " +
  "fica indisponível.";

/** Reconhece, na resposta do Stripe, a recusa por falta de política/termos. */
export function ehRecusaPorPoliticas(erro: unknown): boolean {
  const texto = erro instanceof Error ? erro.message : String(erro);
  return /privacy|terms of service|terms_of_service|política|termos/i.test(texto) && /HTTP 4\d\d/.test(texto);
}
