/**
 * Parser de lead do RD Station.
 *
 * Replica a lógica do fluxo n8n "Callface | RD Station -> Zoho CRM" (workflow
 * dVd5mywo36xGfGEa), que já roda em produção alimentando o Zoho. O RD manda um
 * payload com `body.leads[]`; o campo `traffic_source` vem codificado em base64
 * (prefixo `encoded_`) com um JSON dentro, e os UTMs reais ficam na query string
 * de `current_session.value`. Aqui a gente extrai tudo de forma tolerante a falha.
 *
 * Fonte da estrutura: navegação real no n8n + nota callface/auditoria-meta-bm.md.
 */

import { telefoneUsavel } from "@/lib/whatsapp/phone-utils";

export interface ParsedRdLead {
  nome: string;
  sobrenome?: string;
  email?: string;
  telefone?: string;
  empresa?: string;
  cargo?: string;
  tipoNegocio?: string; // "Tipo de negócio" do form (via tag "tipo:")
  tamanhoBase?: string; // "Tamanho da base" do form (via tag "base:")
  origem: string; // "Mídia Paga" | "Site" | "Instagram" | "Linkedin" | "RD Station"
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  fbclid?: string;
  /** `fb.1.<ms>.<fbclid>` — o que a Meta usa para casar a conversão com o clique. */
  fbc?: string;
  /** Cookie `_fbp` do Pixel, quando a LP o repassa. */
  fbp?: string;
  landingPage?: string;
}

type RdContent = Record<string, unknown>;
type RdOrigin = Record<string, unknown>;

interface RdLead {
  name?: string;
  email?: string;
  company?: string;
  job_title?: string;
  personal_phone?: string;
  mobile_phone?: string;
  tags?: unknown;
  custom_fields?: Record<string, unknown>;
  last_conversion?: { content?: RdContent; conversion_origin?: RdOrigin };
  first_conversion?: { content?: RdContent };
  [key: string]: unknown;
}

/**
 * `fbc` no formato que a Meta espera, derivado do `fbclid`.
 *
 * O cookie `_fbc` nunca chega aqui: o formulário da LP posta no RD Station, e o
 * RD não repassa cookie. Mas a Meta documenta que, sem o cookie, o `fbc` pode
 * ser montado como `fb.1.<timestamp do clique em ms>.<fbclid>` — e é esse campo
 * que ela usa para casar a conversão com o clique no anúncio.
 *
 * Medido em 21/10/2026: `fbc`, `fbp` e `fbclid` estavam em ZERO das 4.270 linhas
 * de `pontos_contato`. Toda a atribuição Meta do sistema era UTM, que qualquer
 * um digita. Sem isto a conversão devolvida pela CAPI chega e não casa.
 */
export function fbcDoFbclid(fbclid: string | null | undefined, quando?: Date | null): string | null {
  const id = (fbclid ?? "").trim();
  if (!id) return null;
  const ms = quando && !Number.isNaN(quando.getTime()) ? quando.getTime() : Date.now();
  return `fb.1.${ms}.${id}`;
}

/**
 * Lê o valor de uma tag no formato "prefixo: valor" (ex.: "tipo: Consultoria").
 * Prefere as tags do content (mantêm o case original) e cai pras do lead.
 */
function tagValue(
  contentTags: unknown,
  leadTags: unknown,
  prefix: string
): string | undefined {
  const norm = (t: unknown): string[] =>
    Array.isArray(t) ? t.map((x) => s(x)) : [];
  const tags = [...norm(contentTags), ...norm(leadTags)];
  const hit = tags.find((t) => t.toLowerCase().startsWith(prefix.toLowerCase()));
  if (!hit) return undefined;
  const v = hit.slice(hit.indexOf(":") + 1).trim();
  return v || undefined;
}

function s(v: unknown): string {
  return v == null ? "" : String(v);
}

function parseQS(qs: string): Record<string, string> {
  const out: Record<string, string> = {};
  s(qs)
    .split("&")
    .forEach((p) => {
      const i = p.indexOf("=");
      if (i > 0) {
        try {
          out[p.substring(0, i)] = decodeURIComponent(
            p.substring(i + 1).replace(/\+/g, " ")
          );
        } catch {
          out[p.substring(0, i)] = p.substring(i + 1);
        }
      }
    });
  return out;
}

/** Quando a conversão aconteceu, se o RD disser. Senão, null (cai em "agora"). */
function dataDaConversao(content: RdContent): Date | null {
  for (const chave of ["created_at", "conversion_date", "event_timestamp", "date"]) {
    const bruto = s(content[chave]);
    if (!bruto) continue;
    const d = new Date(bruto);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function decodeTrafficSource(raw: string): string {
  if (!raw) return "";
  if (raw.startsWith("encoded_")) {
    try {
      return Buffer.from(raw.replace("encoded_", ""), "base64").toString("utf-8");
    } catch {
      return raw;
    }
  }
  return raw;
}

/**
 * Filtra leads que são da Callface (o RD do grupo Wevy recebe leads de vários
 * produtos). Mesma heurística do n8n: procura "callface"/"ticky" ou prefixo
 * cf- nos identificadores da conversão.
 */
export function isCallfaceLead(lead: RdLead): boolean {
  const c = lead.last_conversion?.content || {};
  const fc = lead.first_conversion?.content || {};
  const ev = s(c.event_identifier).toLowerCase();
  const cv = s(c.conversion_identifier).toLowerCase();
  const idf = s(c.identificador || fc.identificador).toLowerCase();
  const url = s(
    c.form_url || fc.form_url || c.page_title || fc.page_title
  ).toLowerCase();
  const blob = [ev, cv, idf, url].join(" ");
  return (
    blob.includes("callface") ||
    blob.includes("call face") ||
    blob.includes("ticky") ||
    [ev, cv, idf].some((x) => x.startsWith("cf-") || x.startsWith("cf_"))
  );
}

export function parseRdLead(lead: RdLead): ParsedRdLead {
  const content = lead.last_conversion?.content || {};
  const origin = lead.last_conversion?.conversion_origin || {};
  const custom = lead.custom_fields || {};

  // Nome / sobrenome
  const rdName = s(lead.name).trim();
  const sobren = s(content.Sobrenome || custom.Sobrenome).trim();
  let nome = "";
  let sobrenome: string | undefined;
  if (sobren) {
    nome = rdName || s(lead.email) || "Lead";
    sobrenome = sobren;
  } else {
    const parts = rdName.split(" ").filter(Boolean);
    if (parts.length > 1) {
      nome = parts[0];
      sobrenome = parts.slice(1).join(" ");
    } else {
      nome = rdName || s(lead.email) || "Lead";
    }
  }

  // Origem (derivada do conversion_origin), mesma lógica do n8n
  const medium = s(origin.medium).toLowerCase();
  const source = s(origin.source).toLowerCase();
  let origem = "RD Station";
  if (medium === "cpc") origem = "Mídia Paga";
  else if (
    source.includes("organic") ||
    source.includes("direct") ||
    source.includes("google") ||
    source.includes("unknown")
  )
    origem = "Site";
  else if (medium.includes("social")) {
    if (source === "ig" || source === "instagram") origem = "Instagram";
    else if (source === "lk" || source === "linkedin") origem = "Linkedin";
  }

  // UTMs: parseia current_session.value (query string) do traffic_source;
  // fallback no conversion_origin (que o RD já parseia).
  let utmSource = "";
  let utmMedium = "";
  let utmCampaign = "";
  let utmTerm = "";
  let utmContent = "";
  /* O `fbclid` é o clique no anúncio, e viaja na MESMA query string dos UTMs.
     Ele era jogado fora duas vezes: a sessão só era lida quando continha
     "utm_" (anúncio sem UTM caía fora inteiro) e, mesmo lida, só os `utm_*`
     eram extraídos. `ParsedRdLead` já declarava o campo `fbclid` e nada o
     preenchia — campo fantasma desde que a interface existe. */
  let fbclid = "";
  // `fbc`/`fbp` do cookie do Pixel, quando a LP os manda: é o valor que a Meta
  // escreveu, melhor que o `fbc` derivado abaixo.
  let fbcReal = "";
  let fbp = "";
  const decoded = decodeTrafficSource(s(content.traffic_source));
  if (decoded) {
    try {
      const obj = JSON.parse(decoded) as {
        current_session?: { value?: string };
        first_session?: { value?: string };
      };
      // Sessão atual manda; a primeira serve de rede quando a atual veio vazia.
      for (const qs of [s(obj.current_session?.value), s(obj.first_session?.value)]) {
        if (!qs) continue;
        const u = parseQS(qs);
        if (!utmSource && u.utm_source) {
          utmSource = u.utm_source;
          utmMedium = u.utm_medium || utmMedium;
          utmCampaign = u.utm_campaign || utmCampaign;
          utmTerm = u.utm_term || utmTerm;
          utmContent = u.utm_content || utmContent;
        }
        if (!fbclid && u.fbclid) fbclid = u.fbclid;
        if (!fbcReal && u.fbc) fbcReal = u.fbc;
        if (!fbp && u.fbp) fbp = u.fbp;
      }
    } catch {
      /* traffic_source não era JSON, ignora */
    }
  }
  /* A URL do formulário também carrega o clique: a LP recebe ?fbclid= e o RD
     grava a URL inteira em `form_url`. É o caminho que sobra quando o lead
     chega sem traffic_source. */
  if (!fbclid) {
    for (const bruto of [s(content.form_url), s(content.fbclid), s(custom.fbclid)]) {
      if (!bruto) continue;
      if (bruto.indexOf("?") === -1 && bruto.indexOf("=") === -1) { fbclid = bruto; break; }
      const i = bruto.indexOf("?");
      const achado = parseQS(i >= 0 ? bruto.slice(i + 1) : bruto).fbclid;
      if (achado) { fbclid = achado; break; }
    }
  }
  if (!utmSource) utmSource = s(origin.source);
  if (!utmMedium) utmMedium = s(origin.medium);
  if (!utmCampaign) utmCampaign = s(origin.campaign);
  // Criativo do Meta Lead Ads: o fluxo Meta→RD grava traffic_value = "{conjunto}@{anúncio}"
  // na conversão. É o ÚNICO lugar de onde dá pra tirar o criativo do lead de formulário
  // (o payload não traz utm_content) — sem isso o relatório de Mídia Paga não consegue
  // atribuir lead/venda a criativo (auditoria 21/07). utm_content = anúncio; utm_term = conjunto.
  if (!utmContent) {
    const tv = s(content.traffic_value || custom.traffic_value);
    if (tv.includes("@")) {
      const at = tv.indexOf("@");
      utmContent = tv.slice(at + 1).trim();
      if (!utmTerm) utmTerm = tv.slice(0, at).trim();
    }
  }
  if (!utmContent) utmContent = s(origin.value);

  // telefoneUsavel descarta lixo ("undefined", "-", vazio) ANTES de virar dado:
  // esse valor também é chave de dedup no webhook, e lixo lá engole lead novo.
  const telefone =
    telefoneUsavel(s(content.Telefone || content.Celular || custom.Telefone)) ||
    telefoneUsavel(s(lead.mobile_phone)) ||
    telefoneUsavel(s(lead.personal_phone)) ||
    undefined;

  // Campos de qualificação do form viajam nas tags ("tipo: X", "base: Y").
  const tipoNegocio = tagValue(content.tags, lead.tags, "tipo:");
  const tamanhoBase = tagValue(content.tags, lead.tags, "base:");

  const cut = (v: string) => (v ? v.substring(0, 250) : undefined);

  return {
    nome,
    sobrenome,
    email: s(lead.email) || undefined,
    telefone,
    empresa: s(lead.company || content.Empresa) || undefined,
    cargo: s(content.Cargo || lead.job_title) || undefined,
    tipoNegocio: cut(s(tipoNegocio)),
    tamanhoBase: cut(s(tamanhoBase)),
    origem,
    utmSource: cut(utmSource),
    utmMedium: cut(utmMedium),
    utmCampaign: cut(utmCampaign),
    utmTerm: cut(utmTerm),
    utmContent: cut(utmContent),
    fbclid: cut(fbclid),
    // O horário do clique que a gente tem é o da conversão; é o que a Meta
    // aceita como timestamp do `fbc` quando o cookie não existe.
    fbc: cut(fbcReal) ?? fbcDoFbclid(fbclid, dataDaConversao(content)) ?? undefined,
    fbp: cut(fbp),
    landingPage: s(content.form_url || content.page_title) || undefined,
  };
}
