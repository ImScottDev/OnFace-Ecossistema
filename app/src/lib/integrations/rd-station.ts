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

export interface ParsedRdLead {
  nome: string;
  sobrenome?: string;
  email?: string;
  telefone?: string;
  empresa?: string;
  cargo?: string;
  origem: string; // "Mídia Paga" | "Site" | "Instagram" | "Linkedin" | "RD Station"
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  fbclid?: string;
  landingPage?: string;
}

type RdContent = Record<string, unknown>;
type RdOrigin = Record<string, unknown>;

interface RdLead {
  name?: string;
  email?: string;
  company?: string;
  personal_phone?: string;
  mobile_phone?: string;
  custom_fields?: Record<string, unknown>;
  last_conversion?: { content?: RdContent; conversion_origin?: RdOrigin };
  first_conversion?: { content?: RdContent };
  [key: string]: unknown;
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
  const decoded = decodeTrafficSource(s(content.traffic_source));
  if (decoded) {
    try {
      const obj = JSON.parse(decoded) as {
        current_session?: { value?: string };
      };
      const cs = s(obj.current_session?.value);
      if (cs.indexOf("utm_") !== -1) {
        const u = parseQS(cs);
        utmSource = u.utm_source || "";
        utmMedium = u.utm_medium || "";
        utmCampaign = u.utm_campaign || "";
        utmTerm = u.utm_term || "";
        utmContent = u.utm_content || "";
      }
    } catch {
      /* traffic_source não era JSON, ignora */
    }
  }
  if (!utmSource) utmSource = s(origin.source);
  if (!utmMedium) utmMedium = s(origin.medium);
  if (!utmCampaign) utmCampaign = s(origin.campaign);
  if (!utmContent) utmContent = s(origin.value);

  const telefone =
    s(content.Telefone || custom.Telefone) ||
    s(lead.personal_phone) ||
    s(lead.mobile_phone) ||
    undefined;

  const cut = (v: string) => (v ? v.substring(0, 250) : undefined);

  return {
    nome,
    sobrenome,
    email: s(lead.email) || undefined,
    telefone,
    empresa: s(lead.company || content.Empresa) || undefined,
    cargo: s(content.Cargo) || undefined,
    origem,
    utmSource: cut(utmSource),
    utmMedium: cut(utmMedium),
    utmCampaign: cut(utmCampaign),
    utmTerm: cut(utmTerm),
    utmContent: cut(utmContent),
    landingPage: s(content.form_url || content.page_title) || undefined,
  };
}
