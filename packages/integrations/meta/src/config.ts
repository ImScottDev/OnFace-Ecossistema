/**
 * Configuração central da Meta (SPEC §20).
 *
 * Existe porque a versão da Graph API estava escrita em dois lugares, com
 * valores diferentes e desatualizados (`v21.0` em `meta-insights.ts` e em
 * `conversions-api.ts`). Versão de API espalhada é a garantia de que um dia
 * metade do sistema fala com uma e metade com outra.
 *
 * ## A versão foi medida, não presumida
 *
 * Em 21/09/2026, contra a Graph API real: `v26.0` responde com erro de
 * permissão (a versão existe e o caminho é válido), e `v27.0` em diante
 * respondem "Unknown path components" (a versão não existe). Logo, **v26.0 é a
 * atual**.
 *
 * ## As credenciais são TRÊS, não uma
 *
 * Também medido: o token da CAPI é System User do app "Conversions API
 * Application", com escopo único `read_ads_dataset_quality` restrito ao dataset
 * 1287198026352166. Ao tentar ler insights da conta de anúncios com ele, a Meta
 * responde erro 200: *"Ad account owner has NOT grant ads_management or
 * ads_read permission"*.
 *
 * Então **não dá para reaproveitar um token para tudo**, e tratar isso como
 * detalhe faria a integração de insights falhar em produção com um erro que
 * parece de configuração de conta.
 *
 *   CAPI            enviar conversão      `META_CAPI_ACCESS_TOKEN`
 *   Lead Ads        ler lead do form      `META_LEADS_ACCESS_TOKEN` (+ página)
 *   Ads Insights    ler gasto e resultado `META_ADS_ACCESS_TOKEN`
 *
 * ## Pixel ou Dataset?
 *
 * O mesmo identificador, e o mesmo endpoint `/{id}/events`. A Meta renomeou o
 * conceito para "dataset" (daí o nome do escopo `read_ads_dataset_quality`),
 * mas não separou o recurso. Criar duas variáveis para o mesmo número só
 * produziria a chance de elas divergirem. Uma variável, com o nome que já
 * existe no ambiente.
 */

/** Versão da Graph API, validada contra a Meta em 21/09/2026. */
export const META_API_VERSION_PADRAO = "v26.0";

export function metaApiVersion(env: NodeJS.ProcessEnv = process.env): string {
  return env.META_API_VERSION || META_API_VERSION_PADRAO;
}

export function metaGraphUrl(caminho: string, env: NodeJS.ProcessEnv = process.env): string {
  const limpo = caminho.startsWith("/") ? caminho.slice(1) : caminho;
  return `https://graph.facebook.com/${metaApiVersion(env)}/${limpo}`;
}

export interface CredenciaisCapi {
  /** Pixel/Dataset ID: o mesmo número, o mesmo endpoint. */
  datasetId: string | null;
  accessToken: string | null;
  /** Manda o evento para a aba Test Events em vez da produção. */
  testEventCode: string | null;
}

export function credenciaisCapi(env: NodeJS.ProcessEnv = process.env): CredenciaisCapi {
  return {
    datasetId: env.META_PIXEL_ID || env.META_DATASET_ID || null,
    accessToken: env.META_CAPI_ACCESS_TOKEN || null,
    testEventCode: env.META_CAPI_TEST_EVENT_CODE || null,
  };
}

export interface CredenciaisLeadAds {
  pageId: string | null;
  accessToken: string | null;
  appSecret: string | null;
  verifyToken: string | null;
}

export function credenciaisLeadAds(env: NodeJS.ProcessEnv = process.env): CredenciaisLeadAds {
  return {
    pageId: env.META_PAGE_ID || null,
    accessToken: env.META_LEADS_ACCESS_TOKEN || null,
    appSecret: env.META_APP_SECRET || null,
    verifyToken: env.META_WEBHOOK_VERIFY_TOKEN || null,
  };
}

export interface CredenciaisAds {
  adAccountId: string | null;
  accessToken: string | null;
}

export function credenciaisAds(env: NodeJS.ProcessEnv = process.env): CredenciaisAds {
  const bruto = env.META_AD_ACCOUNT_ID || "";
  return {
    // A Meta aceita o id com ou sem o prefixo; normalizar aqui evita que cada
    // chamador lembre (ou esqueça) de colocar.
    adAccountId: bruto ? (bruto.startsWith("act_") ? bruto : `act_${bruto}`) : null,
    // `META_ADS_ACCESS_TOKEN` é o nome novo; `META_ACCESS_TOKEN` é o que já
    // existia no ambiente e continua valendo.
    accessToken: env.META_ADS_ACCESS_TOKEN || env.META_ACCESS_TOKEN || null,
  };
}

/** O que está configurado, para diagnóstico. Nunca devolve valor de segredo. */
export function diagnosticoMeta(env: NodeJS.ProcessEnv = process.env): Record<string, boolean | string> {
  const capi = credenciaisCapi(env);
  const leads = credenciaisLeadAds(env);
  const ads = credenciaisAds(env);
  return {
    apiVersion: metaApiVersion(env),
    capiPronta: Boolean(capi.datasetId && capi.accessToken),
    capiEmTeste: Boolean(capi.testEventCode),
    webhookPronto: Boolean(leads.appSecret && leads.verifyToken),
    leadRetrievalPronto: Boolean(leads.pageId && leads.accessToken),
    adsInsightsPronto: Boolean(ads.adAccountId && ads.accessToken),
  };
}
