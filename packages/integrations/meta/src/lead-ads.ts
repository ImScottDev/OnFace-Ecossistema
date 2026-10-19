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

/** "número_do_whatsapp" → "numero_do_whatsapp": acento não pode separar campo. */
const semAcento = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Parece telefone? Oito dígitos é o mínimo de um fixo sem DDD. */
const temCaraDeTelefone = (v: string) => (v.match(/\d/g) ?? []).length >= 8;

/**
 * O campo do formulário CONTÉM o sinônimo — "número_do_whatsapp",
 * "telefone_para_contato", "whatsapp_comercial".
 *
 * O casamento era só por igualdade exata, e formulário personalizado nunca
 * usa o nome exato: a campanha White Label pergunta "número_do_whatsapp" e o
 * telefone ficava parado em `campos_custom`, com o lead entrando sem telefone
 * nenhum (medido em 19/10/2026).
 *
 * Só roda DEPOIS da igualdade exata, que continua mandando, e nunca toma um
 * campo que outro papel já levou — é o que impede "nome_da_empresa" de virar
 * nome. O valor ainda precisa ter cara do que se procura.
 */
function porAproximacao(
  campos: Record<string, string>,
  nomes: string[],
  jaUsados: Set<string>,
  valorServe: (v: string) => boolean = () => true,
): string | null {
  for (const [chave, valor] of Object.entries(campos)) {
    if (jaUsados.has(chave)) continue;
    const k = semAcento(chave);
    if (!nomes.some((n) => k.includes(semAcento(n)))) continue;
    if (!valorServe(valor)) continue;
    jaUsados.add(chave);
    return valor;
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
    "id", "is_organic", "partner_name",
  ]);

  const respostas: Record<string, string> = {};
  for (const [k, v] of Object.entries(campos)) if (!usados.has(k)) respostas[k] = v;

  const criadoEm = bruto.created_time;
  const ocorridoEm = criadoEm
    ? new Date(typeof criadoEm === "number" ? criadoEm * 1000 : criadoEm)
    : null;

  /* A ordem importa: quem é mais específico escolhe primeiro, para que
     "nome_da_empresa" seja empresa e não nome. `tomados` guarda o que já foi
     levado, e a aproximação nunca repete um campo. */
  const tomados = new Set<string>();
  const email = primeiro(campos, SINONIMOS.email)
    ?? porAproximacao(campos, SINONIMOS.email, tomados, (v) => v.includes("@"));
  const telefone = primeiro(campos, SINONIMOS.telefone)
    ?? porAproximacao(campos, SINONIMOS.telefone, tomados, temCaraDeTelefone);
  const empresa = primeiro(campos, SINONIMOS.empresa)
    ?? porAproximacao(campos, SINONIMOS.empresa, tomados);
  const cargo = primeiro(campos, SINONIMOS.cargo) ?? porAproximacao(campos, SINONIMOS.cargo, tomados);
  const nome = nomeCompleto(campos) ?? porAproximacao(campos, SINONIMOS.nome, tomados);

  return {
    metaLeadId: bruto.leadgen_id ?? null,
    nome,
    email,
    telefone,
    empresa,
    cargo,
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


/**
 * Tudo que a Meta informa sobre COMO o lead chegou (anúncio, conjunto, campanha,
 * formulário, plataforma, id do lead e data), em chaves `meta_*` próprias para
 * ficarem separadas das RESPOSTAS do formulário em `leads.campos_custom`.
 * Uma só função para o webhook (lead novo) e para a importação histórica, para
 * o lead de ontem e o de hoje ficarem com o mesmo rastreio.
 */
export function camposRastreioMeta(
  bruto: LeadAdsBruto,
  extra?: { formNome?: string | null },
): Record<string, string> {
  const out: Record<string, string> = {};
  const set = (k: string, v: unknown) => {
    if (v === undefined || v === null) return;
    const t = String(v).trim();
    if (t) out[k] = t;
  };
  set("meta_leadgen_id", bruto.leadgen_id ?? (bruto as Record<string, unknown>).id);
  set("meta_ad_id", bruto.ad_id);
  set("meta_ad_nome", bruto.ad_name);
  set("meta_conjunto_id", bruto.adset_id);
  set("meta_conjunto_nome", bruto.adset_name);
  set("meta_campanha_id", bruto.campaign_id);
  set("meta_campanha_nome", bruto.campaign_name);
  set("meta_formulario_id", bruto.form_id);
  set("meta_formulario_nome", extra?.formNome);
  set("meta_plataforma", bruto.platform);
  set("meta_pagina_id", bruto.page_id);
  const org = (bruto as Record<string, unknown>).is_organic;
  if (typeof org === "boolean") out.meta_organico = org ? "sim" : "nao";
  const t = bruto.created_time;
  if (t) {
    const d = new Date(typeof t === "number" ? t * 1000 : t);
    if (!Number.isNaN(d.getTime())) out.meta_criado_em = d.toISOString();
  }
  return out;
}
