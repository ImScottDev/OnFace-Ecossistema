/**
 * Configuração do Portal do cliente (Stripe) — parte PURA: o que o ONFACE quer,
 * como reconhecer a configuração dele na conta e o que fazer em cada situação.
 * Sem rede, sem banco, sem `process.env` escondido: o teste roda com Stripe falso.
 *
 * Por que o ONFACE tem configuração PRÓPRIA (decisão de 13/10/2026):
 *
 *   A conta Stripe é COMPARTILHADA com o SaaS Callface e só tinha duas
 *   configurações de portal. A padrão (`is_default`, feita à mão no Dashboard em
 *   jul/2025) deixa o cliente trocar o E-MAIL, e o e-mail é a identidade do
 *   Customer que casa o webhook com a empresa; não deixa trocar o documento
 *   fiscal; e qualquer pessoa com acesso ao Dashboard muda o que ela permite sem
 *   revisão e sem aviso ao ONFACE. A outra (`managed_by = callface-backend`) é do
 *   SaaS e não se toca.
 *
 * O que o portal oferece (teto do Stripe) e o que está ligado:
 *   - forma de pagamento ........ LIGADO
 *   - histórico de faturas ...... LIGADO
 *   - dados de cobrança ......... LIGADO (endereço, nome, telefone, CNPJ); e-mail FORA
 *   - cancelar assinatura ....... LIGADO, no fim do período, com motivo
 *   - trocar de plano ........... LIGADO quando há planos do catálogo para oferecer
 *     (ver `stripe-portal-planos.ts`); upgrade cobra a diferença na hora
 *     (`always_invoice`), downgrade só vale no próximo ciclo
 *   - página de login do portal . DESLIGADA: o login por e-mail procura o Customer
 *     pelo e-mail em toda a conta, e a conta é compartilhada com o SaaS
 *
 * Limite do Stripe que o código não contorna: o cliente só consegue TROCAR de plano
 * em assinatura de UM produto, cobrada no automático, fora de teste e sem uso
 * medido. As demais ele só cancela. Boleto/envio de fatura fica de fora.
 *
 * A configuração é escrita como OBJETO ANINHADO (`corpoDaConfiguracao`) e daí saem
 * as duas coisas que precisam ser a mesma: o formulário que vai ao Stripe e a
 * comparação com o que a conta tem. Não há lista de divergências escrita à mão.
 */

/** Marca da nossa configuração. Subir a versão aqui força o update/criação no Stripe. */
export const MARCA_CONFIG = "crm-cliente-360-v2";

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

/** Um produto que o cliente pode escolher na troca de plano, com os Prices permitidos. */
export interface PlanoDoPortal {
  produto: string;
  precos: string[];
}

/** Objeto aninhado no formato do corpo de `POST /v1/billing_portal/configurations`. */
export type Corpo = { [chave: string]: string | boolean | Corpo | Array<string | Corpo> };

/**
 * O que o ONFACE quer na configuração.
 *
 * `planos`: lista = troca de plano com esses produtos (vazia = desligada);
 * `null` = "não sei" (chamada sem organização): a seção `subscription_update` fica
 * FORA do corpo, e portanto não é criada nem comparada.
 */
export function corpoDaConfiguracao(politicas: PoliticasPortal = {}, planos: PlanoDoPortal[] | null = null): Corpo {
  const features: Corpo = {
    // O que resolve a dor original: o cliente informa o cartão novo e a assinatura passa a
    // cobrar nele, sem o ONFACE nunca ver o número (fora do escopo de PCI).
    payment_method_update: { enabled: true },
    invoice_history: { enabled: true },
    customer_update: { enabled: true, allowed_updates: [...CAMPOS_EDITAVEIS] },
    /* Cancelamento no FIM do período, nunca imediato: o cliente já pagou o mês corrente,
       e cortar na hora gera crédito/reembolso que ninguém pediu. Até o corte o CS ainda
       tem prazo para reverter — e é por isso que o webhook de cancelamento AGENDADO avisa
       a equipe (ver stripe-webhook-processor). `none` = nenhum crédito gerado. */
    subscription_cancel: {
      enabled: true,
      mode: "at_period_end",
      proration_behavior: "none",
      cancellation_reason: { enabled: true, options: [...MOTIVOS_CANCELAMENTO] },
    },
  };

  if (planos !== null) {
    features.subscription_update = planos.length === 0
      ? { enabled: false }
      : {
        enabled: true,
        products: planos.map((p) => ({ product: p.produto, prices: [...p.precos] })),
        // Só o PLANO. Quantidade (usuários) muda a cobrança de um jeito que o comercial negocia; cupom idem.
        default_allowed_updates: ["price"],
        // Upgrade: o Stripe fatura a diferença AGORA (pró-rata). Quem sobe de plano paga ao subir.
        proration_behavior: "always_invoice",
        // Downgrade (valor menor) e encurtar intervalo só valem no próximo ciclo: sem crédito a devolver.
        schedule_at_period_end: { conditions: [{ type: "decreasing_item_amount" }, { type: "shortening_interval" }] },
        /* Não há `restrictions.on_open_invoices` aqui de propósito: bloquear a troca com fatura
           em aberto seria o certo, mas a versão de API desta conta recusa o parâmetro
           ("unknown parameter", conferido na conta live em 13/10/2026) e o POST inteiro falha.
           Enquanto o Stripe não aceitar, quem está devendo consegue trocar de plano pelo portal. */
        // O ciclo de cobrança não é reiniciado pela troca.
        billing_cycle_anchor: "unchanged",
        // Quem está em teste não perde o teste ao escolher plano.
        trial_update_behavior: "continue_trial",
      };
  }

  const corpo: Corpo = {
    features,
    // Sem página de login hospedada: a sessão sai SEMPRE do servidor, por Customer já resolvido.
    login_page: { enabled: false },
    metadata: { crm_portal: MARCA_CONFIG },
  };
  const bp: Corpo = {};
  if (politicas.privacyUrl) bp.privacy_policy_url = politicas.privacyUrl;
  if (politicas.termsUrl) bp.terms_of_service_url = politicas.termsUrl;
  if (Object.keys(bp).length) corpo.business_profile = bp;
  return corpo;
}

/** Serializa o corpo no formato de formulário do Stripe (`a[b][0][c]=…`). */
export function formDoCorpo(corpo: Corpo): URLSearchParams {
  const form = new URLSearchParams();
  const visitar = (valor: Corpo[string], caminho: string) => {
    if (Array.isArray(valor)) valor.forEach((v, i) => visitar(v, `${caminho}[${i}]`));
    else if (typeof valor === "object") for (const [k, v] of Object.entries(valor)) visitar(v, `${caminho}[${k}]`);
    else form.append(caminho, String(valor));
  };
  for (const [k, v] of Object.entries(corpo)) visitar(v, k);
  return form;
}

/** O corpo da configuração em formulário. Puro: as URLs de política e os planos entram por parâmetro. */
export function formDaConfiguracao(politicas: PoliticasPortal = {}, planos: PlanoDoPortal[] | null = null): URLSearchParams {
  return formDoCorpo(corpoDaConfiguracao(politicas, planos));
}

/* ── O que a conta tem hoje ───────────────────────────────────────────── */

/** O objeto `billing_portal.configuration` como o Stripe devolve (só o que lemos). */
export interface ConfiguracaoDoStripe {
  id: string;
  active?: boolean;
  is_default?: boolean;
  metadata?: Record<string, string> | null;
  business_profile?: { privacy_policy_url?: string | null; terms_of_service_url?: string | null; headline?: string | null } | null;
  login_page?: { enabled?: boolean; url?: string | null } | null;
  features?: Record<string, unknown> & {
    customer_update?: { enabled?: boolean; allowed_updates?: string[] };
    invoice_history?: { enabled?: boolean };
    payment_method_update?: { enabled?: boolean };
    subscription_cancel?: { enabled?: boolean; mode?: string; cancellation_reason?: { enabled?: boolean } };
    subscription_update?: { enabled?: boolean };
  };
}

export const ehDoSaaS = (c: Pick<ConfiguracaoDoStripe, "metadata">) => c.metadata?.managed_by === "callface-backend";
export const ehDoOnface = (c: Pick<ConfiguracaoDoStripe, "metadata">) => c.metadata?.crm_portal === MARCA_CONFIG;

/* ── Comparação campo a campo ─────────────────────────────────────────── */

export interface DiferencaDeCampo {
  campo: string;
  /** O que a conta tem (`null` = ausente). */
  atual: string | null;
  desejado: string;
}

/** Valor comparável de um item de lista: `products` vira `prod:price1,price2`, `conditions` vira o tipo. */
function itemCanonico(caminho: string, item: unknown): string {
  if (item && typeof item === "object") {
    const o = item as Record<string, unknown>;
    if (caminho.endsWith(".products")) return `${String(o.product)}:${[...((o.prices as unknown[]) ?? [])].map(String).sort().join(",")}`;
    if (caminho.endsWith(".conditions")) return String(o.type);
    return JSON.stringify(o);
  }
  return String(item);
}

/** Achata em `caminho → texto comparável`. Lista vira itens ordenados, porque a ordem não muda o sentido. */
function achatar(valor: unknown, caminho: string, saida: Map<string, string>): void {
  if (Array.isArray(valor)) {
    saida.set(caminho, valor.map((i) => itemCanonico(caminho, i)).sort().join(" | "));
    return;
  }
  if (valor && typeof valor === "object") {
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) achatar(v, caminho ? `${caminho}.${k}` : k, saida);
    return;
  }
  saida.set(caminho, valor === null || valor === undefined ? "" : String(valor));
}

/**
 * Cada campo que o ONFACE pede e a conta não tem igual. Só olha as chaves do `desejado`: o que o
 * Stripe devolve a mais (pausa, feedback_options, nulls) não é divergência. `atual = null` = ausente.
 */
export function diferencasDaConfiguracao(desejado: Corpo, atual: ConfiguracaoDoStripe | null): DiferencaDeCampo[] {
  const quer = new Map<string, string>();
  achatar(desejado, "", quer);
  const tem = new Map<string, string>();
  if (atual) achatar(atual, "", tem);

  const diferencas: DiferencaDeCampo[] = [];
  for (const [campo, valor] of quer) {
    const t = tem.get(campo);
    if (t === undefined) diferencas.push({ campo, atual: null, desejado: valor });
    else if (t !== valor) diferencas.push({ campo, atual: t === "" ? "(vazio)" : t, desejado: valor });
  }
  return diferencas;
}

const rotuloDaDiferenca = (d: DiferencaDeCampo) => `${d.campo}: ${d.atual ?? "(ausente)"} → ${d.desejado}`;

/** Diferenças entre o que o ONFACE quer e o que está na conta, em texto. Vazio = nada a atualizar. */
export function divergenciasDaConfiguracao(c: ConfiguracaoDoStripe, politicas: PoliticasPortal = {}, planos: PlanoDoPortal[] | null = null): string[] {
  // A marca (`metadata.crm_portal`) é um campo como os outros: ausente ou de outra versão aparece na lista.
  return diferencasDaConfiguracao(corpoDaConfiguracao(politicas, planos), c).map(rotuloDaDiferenca);
}

/** Riscos de USAR uma configuração que não é a do ONFACE (a padrão da conta, fixada à mão). */
export function riscosDeConfiguracaoAlheia(c: ConfiguracaoDoStripe): string[] {
  const r: string[] = [];
  if (c.is_default) r.push("é a configuração PADRÃO da conta: qualquer pessoa com Dashboard muda o portal sem revisão");
  if (c.features?.customer_update?.allowed_updates?.includes("email")) r.push("deixa o cliente trocar o e-mail, que é a identidade do Customer no webhook");
  if (c.features?.customer_update?.enabled && !c.features.customer_update.allowed_updates?.includes("tax_id")) r.push("não deixa o cliente corrigir o documento fiscal");
  if (c.features?.subscription_cancel?.mode === "immediately") r.push("cancela na hora, com crédito/reembolso do mês pago");
  if (c.login_page?.enabled) r.push("tem página de login hospedada: o e-mail digitado procura o Customer em toda a conta, que é compartilhada com o SaaS");
  if (!c.features?.subscription_update?.enabled) r.push("não deixa o cliente trocar de plano");
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
export function decidirConfiguracao(entrada: {
  fixadoId?: string | null; lista?: ConfiguracaoDoStripe[]; politicas?: PoliticasPortal; planos?: PlanoDoPortal[] | null;
}): DecisaoDoPortal {
  const { fixadoId, lista = [], politicas = {}, planos = null } = entrada;
  if (fixadoId) {
    const c = lista.find((x) => x.id === fixadoId);
    if (c && ehDoSaaS(c)) return { acao: "recusar_fixada", id: fixadoId, motivo: "a configuração fixada é do SaaS Callface (managed_by=callface-backend); o ONFACE não usa nem altera objeto do SaaS" };
    if (c && c.active === false) return { acao: "recusar_fixada", id: fixadoId, motivo: "a configuração fixada está inativa no Stripe" };
    return { acao: "usar_fixada", id: fixadoId, riscos: c && !ehDoOnface(c) ? riscosDeConfiguracaoAlheia(c) : [] };
  }
  // Só olha o que é do ONFACE E está ativo. Nunca a padrão, nunca a do SaaS.
  const nossa = lista.find((c) => ehDoOnface(c) && c.active !== false && !ehDoSaaS(c));
  if (nossa) {
    const diferencas = divergenciasDaConfiguracao(nossa, politicas, planos);
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
