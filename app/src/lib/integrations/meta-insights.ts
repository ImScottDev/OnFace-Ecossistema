/**
 * Meta (Facebook) Marketing API — insights de campanha (gasto, CPL, leads).
 * Cruza com o tracking do CRM por utm_campaign (matching por nome normalizado).
 *
 * Requer no .env:
 *   META_ACCESS_TOKEN     — token long-lived com escopo ads_read (System User do BM, ideal)
 *   META_AD_ACCOUNT_ID    — id da conta de anúncios, formato act_123456789 (ou só o número)
 *   META_API_VERSION      — opcional, default v21.0
 */

const LEAD_ACTIONS = new Set([
  "lead",
  "onsite_conversion.lead_grouped",
  "offsite_conversion.fb_pixel_lead",
  "onsite_web_lead",
]);

/**
 * Conta leads de um insight da Meta SEM duplicar. A Meta reporta o MESMO lead sob
 * vários action_types (lead, onsite_conversion.lead_grouped, offsite_conversion.fb_pixel_lead,
 * onsite_web_lead) — SOMAR triplica o número. Usa o "lead" canônico (é o resultado
 * oficial da Meta); se ausente, cai no MAIOR dos aliases.
 */
function countLeads(actions: Array<{ action_type: string; value: string }>): number {
  const canonical = actions.find((a) => a.action_type === "lead");
  if (canonical) return parseFloat(canonical.value) || 0;
  const vals = actions
    .filter((a) => LEAD_ACTIONS.has(a.action_type))
    .map((a) => parseFloat(a.value) || 0);
  return vals.length ? Math.max(...vals) : 0;
}

export interface MetaCampanha {
  campaignId: string;
  campaignName: string;
  gasto: number;
  impressoes: number;
  cliques: number;
  leads: number;
  cpl: number | null;
}

export function metaConfigured(): boolean {
  return !!(process.env.META_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID);
}

/** Normaliza nome de campanha p/ casar Meta x utm_campaign. */
export function normCampanha(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

export interface MetaCriativo {
  adId: string;
  adName: string;
  campaignName: string;
  adsetId: string;
  adsetName: string;
  gasto: number;
  impressoes: number;
  cliques: number;
  leads: number;
  cpl: number | null;
}

/** Insights por CRIATIVO (level=ad) — pra ver qual anúncio performa. */
export async function fetchMetaAdInsights(
  since: string,
  until: string
): Promise<MetaCriativo[]> {
  const token = process.env.META_ACCESS_TOKEN;
  const raw = process.env.META_AD_ACCOUNT_ID || "";
  if (!token || !raw) return [];
  const version = process.env.META_API_VERSION || "v21.0";
  const accts = raw.split(",").map((a) => a.trim()).filter(Boolean)
    .map((a) => (a.startsWith("act_") ? a : `act_${a}`));

  const out: MetaCriativo[] = [];
  for (const acct of accts) {
    const params = new URLSearchParams({
      level: "ad",
      fields: "ad_id,ad_name,campaign_name,adset_id,adset_name,spend,impressions,clicks,actions",
      time_range: JSON.stringify({ since, until }),
      limit: "500",
      access_token: token,
    });
    let url: string | null = `https://graph.facebook.com/${version}/${acct}/insights?${params}`;
    for (let page = 0; page < 20 && url; page++) {
      const r: Response = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!r.ok) {
        const body = await r.text();
        throw new Error(`Meta ad insights ${acct} HTTP ${r.status}: ${body.slice(0, 200)}`);
      }
      const json: {
        data?: Array<Record<string, unknown>>;
        paging?: { next?: string };
      } = await r.json();
      for (const row of json.data ?? []) {
        const actions = (row.actions as Array<{ action_type: string; value: string }>) ?? [];
        const leads = countLeads(actions);
        const gasto = parseFloat(String(row.spend ?? "0")) || 0;
        out.push({
          adId: String(row.ad_id ?? ""),
          adName: String(row.ad_name ?? ""),
          campaignName: String(row.campaign_name ?? ""),
          adsetId: String(row.adset_id ?? ""),
          adsetName: String(row.adset_name ?? ""),
          gasto,
          impressoes: parseInt(String(row.impressions ?? "0")) || 0,
          cliques: parseInt(String(row.clicks ?? "0")) || 0,
          leads,
          cpl: leads > 0 ? gasto / leads : null,
        });
      }
      url = json.paging?.next ?? null;
    }
  }
  return out;
}

export interface MetaConjunto {
  adsetId: string;
  adsetName: string;
  campaignId: string;
  campaignName: string;
  gasto: number;
  impressoes: number;
  cliques: number;
  leads: number;
  cpl: number | null;
}

/** Insights por CONJUNTO DE ANÚNCIOS (level=adset) — público/orçamento intermediário entre campanha e criativo. */
export async function fetchMetaAdsetInsights(
  since: string,
  until: string
): Promise<MetaConjunto[]> {
  const token = process.env.META_ACCESS_TOKEN;
  const raw = process.env.META_AD_ACCOUNT_ID || "";
  if (!token || !raw) return [];
  const version = process.env.META_API_VERSION || "v21.0";
  const accts = raw.split(",").map((a) => a.trim()).filter(Boolean)
    .map((a) => (a.startsWith("act_") ? a : `act_${a}`));

  const out: MetaConjunto[] = [];
  for (const acct of accts) {
    const params = new URLSearchParams({
      level: "adset",
      fields: "adset_id,adset_name,campaign_id,campaign_name,spend,impressions,clicks,actions",
      time_range: JSON.stringify({ since, until }),
      limit: "500",
      access_token: token,
    });
    let url: string | null = `https://graph.facebook.com/${version}/${acct}/insights?${params}`;
    for (let page = 0; page < 20 && url; page++) {
      const r: Response = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!r.ok) {
        const body = await r.text();
        throw new Error(`Meta adset insights ${acct} HTTP ${r.status}: ${body.slice(0, 200)}`);
      }
      const json: {
        data?: Array<Record<string, unknown>>;
        paging?: { next?: string };
      } = await r.json();
      for (const row of json.data ?? []) {
        const actions = (row.actions as Array<{ action_type: string; value: string }>) ?? [];
        const leads = countLeads(actions);
        const gasto = parseFloat(String(row.spend ?? "0")) || 0;
        out.push({
          adsetId: String(row.adset_id ?? ""),
          adsetName: String(row.adset_name ?? ""),
          campaignId: String(row.campaign_id ?? ""),
          campaignName: String(row.campaign_name ?? ""),
          gasto,
          impressoes: parseInt(String(row.impressions ?? "0")) || 0,
          cliques: parseInt(String(row.clicks ?? "0")) || 0,
          leads,
          cpl: leads > 0 ? gasto / leads : null,
        });
      }
      url = json.paging?.next ?? null;
    }
  }
  return out;
}

export async function fetchMetaCampaignInsights(
  since: string,
  until: string
): Promise<MetaCampanha[]> {
  const token = process.env.META_ACCESS_TOKEN;
  const raw = process.env.META_AD_ACCOUNT_ID || "";
  if (!token || !raw) return [];
  const version = process.env.META_API_VERSION || "v21.0";
  // suporta múltiplas contas separadas por vírgula (Callface, CC, CC2...)
  const accts = raw.split(",").map((a) => a.trim()).filter(Boolean)
    .map((a) => (a.startsWith("act_") ? a : `act_${a}`));

  const out: MetaCampanha[] = [];
  for (const acct of accts) {
    const params = new URLSearchParams({
      level: "campaign",
      fields: "campaign_id,campaign_name,spend,impressions,clicks,actions",
      time_range: JSON.stringify({ since, until }),
      limit: "500",
      access_token: token,
    });
    let url: string | null = `https://graph.facebook.com/${version}/${acct}/insights?${params}`;
    for (let page = 0; page < 20 && url; page++) {
      const r: Response = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!r.ok) {
        const body = await r.text();
        throw new Error(`Meta insights ${acct} HTTP ${r.status}: ${body.slice(0, 200)}`);
      }
      const json: {
        data?: Array<Record<string, unknown>>;
        paging?: { next?: string };
      } = await r.json();
      for (const row of json.data ?? []) {
        const actions = (row.actions as Array<{ action_type: string; value: string }>) ?? [];
        const leads = countLeads(actions);
        const gasto = parseFloat(String(row.spend ?? "0")) || 0;
        out.push({
          campaignId: String(row.campaign_id ?? ""),
          campaignName: String(row.campaign_name ?? ""),
          gasto,
          impressoes: parseInt(String(row.impressions ?? "0")) || 0,
          cliques: parseInt(String(row.clicks ?? "0")) || 0,
          leads,
          cpl: leads > 0 ? gasto / leads : null,
        });
      }
      url = json.paging?.next ?? null;
    }
  }
  return out;
}
