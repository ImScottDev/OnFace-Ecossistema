/**
 * Adapter de Lead Ads da Meta (SPEC §20).
 *
 * O que isto substitui: hoje o lead de campanha paga faz
 *
 *     Meta → n8n → RD Station → webhook rd-lead → CRM
 *
 * e os IDs reais do anúncio chegam por um SEGUNDO webhook, em paralelo, sem
 * ordem garantida — a ponto de existir uma tabela de staging só para segurar o
 * que chegou antes do lead existir. Esse caminho já falhou: em julho o token do
 * n8n expirou e 125 leads pagos ficaram presos, descobertos dias depois.
 *
 * Aqui a Meta entra direto, e o anúncio chega junto com a pessoa, no mesmo
 * fato. RD Station deixa de ser trânsito obrigatório (SPEC §20) e continua
 * disponível como destino, não como caminho.
 *
 * Pacote de integração: normaliza e valida o payload do provedor. NÃO escreve
 * no banco — quem escreve é o comando de domínio, e é a fronteira que os testes
 * de arquitetura verificam.
 */

/** Campo de formulário da Meta, como ela entrega: nome e lista de valores. */
export interface CampoFormularioMeta {
  name: string;
  values: string[];
}

/** O que a Meta manda no webhook de leadgen, mais o que a Graph API devolve. */
export interface LeadAdsBruto {
  leadgen_id?: string;
  created_time?: string | number;
  ad_id?: string;
  adset_id?: string;
  campaign_id?: string;
  ad_name?: string;
  adset_name?: string;
  campaign_name?: string;
  form_id?: string;
  page_id?: string;
  platform?: string;
  field_data?: CampoFormularioMeta[];
  /** Alguns integradores entregam já achatado; aceitamos os dois formatos. */
  [chave: string]: unknown;
}

export interface LeadAdsNormalizado {
  metaLeadId: string | null;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  empresa: string | null;
  cargo: string | null;
  ocorridoEm: Date | null;
  atribuicao: {
    metaLeadId: string | null;
    adId: string | null;
    adsetId: string | null;
    campaignId: string | null;
    utmSource: string;
    utmMedium: string;
    utmCampaign: string | null;
    utmContent: string | null;
    utmTerm: string | null;
  };
  /** Campos do formulário que não são identidade, preservados como vieram. */
  respostas: Record<string, string>;
}

/**
 * Nomes que a Meta usa nos campos padrão. Formulário personalizado inventa o
 * que quiser, então o que não casa aqui vira resposta, nunca é descartado: o
 * formulário é do cliente e a pergunta dele costuma valer mais que o campo
 * padrão.
 */
const SINONIMOS: Record<keyof Pick<LeadAdsNormalizado, "nome" | "email" | "telefone" | "empresa" | "cargo">, string[]> = {
  // `first_name` NÃO entra aqui de propósito: ele é metade do nome, e tratá-lo
  // como sinônimo faz o sobrenome sumir. A junção é feita em `nomeCompleto`.
  nome: ["full_name", "nome_completo", "nome", "name"],
  email: ["email", "e-mail", "email_address"],
  telefone: ["phone_number", "telefone", "celular", "whatsapp", "phone"],
  empresa: ["company_name", "empresa", "company", "nome_da_empresa"],
  cargo: ["job_title", "cargo", "funcao", "role"],
};

function achatar(bruto: LeadAdsBruto): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const campo of bruto.field_data ?? []) {
    const valor = (campo.values ?? []).filter(Boolean).join(" ").trim();
    if (valor) campos[campo.name.toLowerCase().trim()] = valor;
  }
  // Formato achatado (integrador que já resolveu o field_data por nós).
  for (const [chave, valor] of Object.entries(bruto)) {
    if (typeof valor !== "string" || !valor.trim()) continue;
    const k = chave.toLowerCase();
    if (!(k in campos)) campos[k] = valor.trim();
  }
  return campos;
}

function primeiro(campos: Record<string, string>, nomes: string[]): string | null {
  for (const n of nomes) {
    const v = campos[n];
    if (v) return v;
  }
  return null;
}

/** Une first_name e last_name quando a Meta não mandou full_name. */
function nomeCompleto(campos: Record<string, string>): string | null {
  const direto = primeiro(campos, SINONIMOS.nome);
  if (direto) return direto;
  const partes = [campos.first_name, campos.last_name].filter(Boolean);
  return partes.length ? partes.join(" ") : null;
}

export function normalizarLeadAds(bruto: LeadAdsBruto): LeadAdsNormalizado {
  const campos = achatar(bruto);
  const usados = new Set<string>([
    ...Object.values(SINONIMOS).flat(), "first_name", "last_name",
    "leadgen_id", "created_time", "ad_id", "adset_id", "campaign_id",
    "ad_name", "adset_name", "campaign_name", "form_id", "page_id", "platform",
  ]);

  const respostas: Record<string, string> = {};
  for (const [k, v] of Object.entries(campos)) if (!usados.has(k)) respostas[k] = v;

  const criadoEm = bruto.created_time;
  const ocorridoEm = criadoEm
    ? new Date(typeof criadoEm === "number" ? criadoEm * 1000 : criadoEm)
    : null;

  return {
    metaLeadId: bruto.leadgen_id ?? null,
    nome: nomeCompleto(campos),
    email: primeiro(campos, SINONIMOS.email),
    telefone: primeiro(campos, SINONIMOS.telefone),
    empresa: primeiro(campos, SINONIMOS.empresa),
    cargo: primeiro(campos, SINONIMOS.cargo),
    ocorridoEm: ocorridoEm && !Number.isNaN(ocorridoEm.getTime()) ? ocorridoEm : null,
    atribuicao: {
      metaLeadId: bruto.leadgen_id ?? null,
      adId: bruto.ad_id ?? null,
      adsetId: bruto.adset_id ?? null,
      campaignId: bruto.campaign_id ?? null,
      // A origem é um FATO do canal, não um palpite: veio de Lead Ads.
      utmSource: "meta",
      utmMedium: "paid_social",
      utmCampaign: bruto.campaign_name ?? bruto.campaign_id ?? null,
      utmContent: bruto.ad_name ?? bruto.ad_id ?? null,
      utmTerm: bruto.adset_name ?? bruto.adset_id ?? null,
    },
    respostas,
  };
}

/**
 * Chave de idempotência do fato externo.
 *
 * A Meta reentrega o webhook quando não recebe 200 a tempo, e o mesmo lead
 * chegando de novo é o MESMO lead — não um segundo.
 */
export function chaveDeIdempotencia(n: LeadAdsNormalizado): string | null {
  if (n.metaLeadId) return `meta:leadgen:${n.metaLeadId}`;
  const identidade = n.email ?? n.telefone;
  if (!identidade) return null;
  return `meta:sem-id:${identidade.toLowerCase()}:${n.atribuicao.adId ?? "sem-anuncio"}`;
}
