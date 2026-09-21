/**
 * Enriquecimento de CRIATIVO (utm_content) via RD Station.
 *
 * Leads de Meta Lead Ads chegam sem utm_content (o formulário não carrega UTM),
 * mas o fluxo Meta→RD grava na conversão `traffic_value = "{conjunto}@{anúncio}"`.
 * O parser do webhook já extrai isso quando o payload traz `traffic_value`
 * (lib/integrations/rd-station.ts); este job é o CINTO-E-SUSPENSÓRIO: varre leads
 * recentes que ficaram sem criativo e completa consultando a API do RD
 * (contato → eventos de conversão → traffic_value).
 *
 * Foi assim que o histórico foi backfillado em 21/07 (562 leads varridos).
 * Requer no .env: RD_CLIENT_ID, RD_CLIENT_SECRET, RD_REFRESH_TOKEN
 * (app OAuth "callface-auditoria-leads" — ver callface/credenciais-integracao.md no vault).
 */
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { and, eq, gte, isNotNull, isNull, ne, or, sql } from "drizzle-orm";

const RD_API = "https://api.rd.services";

function configurado(): boolean {
  return !!(process.env.RD_CLIENT_ID && process.env.RD_CLIENT_SECRET && process.env.RD_REFRESH_TOKEN);
}

async function rdToken(): Promise<string> {
  const r = await fetch(`${RD_API}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.RD_CLIENT_ID,
      client_secret: process.env.RD_CLIENT_SECRET,
      refresh_token: process.env.RD_REFRESH_TOKEN,
    }),
  });
  if (!r.ok) throw new Error(`RD auth ${r.status}`);
  const d = (await r.json()) as { access_token?: string };
  if (!d.access_token) throw new Error("RD auth sem access_token");
  return d.access_token;
}

async function rdGet<T>(path: string, token: string): Promise<T | null> {
  const r = await fetch(`${RD_API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  return (await r.json()) as T;
}

/** Extrai {conjunto, anuncio} da conversão de Lead Ads mais antiga do contato. */
async function buscarCriativoNoRd(email: string, token: string): Promise<{ anuncio: string; conjunto: string } | null> {
  const contato = await rdGet<{ uuid?: string }>(`/platform/contacts/email:${encodeURIComponent(email)}`, token);
  if (!contato?.uuid) return null;
  const eventos = await rdGet<Array<{ event_timestamp?: string; payload?: Record<string, unknown> }>>(
    `/platform/contacts/${contato.uuid}/events?event_type=CONVERSION`,
    token,
  );
  if (!Array.isArray(eventos)) return null;
  const cands = eventos
    .map((ev) => ({ ts: String(ev.event_timestamp ?? ""), tv: String(ev.payload?.traffic_value ?? "") }))
    .filter((c) => c.tv.includes("@"))
    .sort((a, b) => a.ts.localeCompare(b.ts));
  if (cands.length === 0) return null;
  const at = cands[0].tv.indexOf("@");
  const anuncio = cands[0].tv.slice(at + 1).trim();
  const conjunto = cands[0].tv.slice(0, at).trim();
  return anuncio ? { anuncio, conjunto } : null;
}

export interface ResultadoEnriquecimento {
  candidatos: number;
  preenchidos: number;
  semDadoNoRd: number;
  erros: number;
}

/**
 * Preenche utm_content (anúncio) e utm_term (conjunto) dos leads pagos SEM criativo
 * criados nos últimos `diasAtras` dias. Idempotente (só toca quem está vazio).
 */
export async function enriquecerCriativosRd(diasAtras = 3): Promise<ResultadoEnriquecimento> {
  const vazio: ResultadoEnriquecimento = { candidatos: 0, preenchidos: 0, semDadoNoRd: 0, erros: 0 };
  if (!configurado()) {
    console.log("[rd-criativo] RD_CLIENT_ID/SECRET/REFRESH_TOKEN não configurados — pulando");
    return vazio;
  }
  const desde = new Date(Date.now() - diasAtras * 86400000);
  const candidatos = await db
    .select({ id: leads.id, email: leads.email })
    .from(leads)
    .where(and(
      gte(leads.createdAt, desde),
      or(isNull(leads.utmContent), eq(leads.utmContent, "")),
      isNotNull(leads.email),
      ne(leads.email, ""),
      or(
        sql`lower(coalesce(${leads.utmMedium},'')) ~ '(cpc|ppc|paid)'`,
        sql`${leads.origem} IN ('Mídia Paga','meta_ads')`,
      ),
    ))
    .limit(300);

  const resultado: ResultadoEnriquecimento = { ...vazio, candidatos: candidatos.length };
  if (candidatos.length === 0) return resultado;

  const token = await rdToken();
  for (const lead of candidatos) {
    try {
      const criativo = await buscarCriativoNoRd(lead.email!, token);
      if (criativo) {
        await db.update(leads)
          .set({
            utmContent: criativo.anuncio.substring(0, 250),
            // não sobrescreve utm_term se já veio de outra fonte
            ...(criativo.conjunto ? { utmTerm: sql`COALESCE(NULLIF(${leads.utmTerm}, ''), ${criativo.conjunto.substring(0, 250)})` } : {}),
            // NÃO toca `updatedAt`. Descobrir de qual anúncio o lead veio não é
            // trabalho feito no lead: ninguém ligou, ninguém respondeu, nada
            // mudou na negociação.
            //
            // O board de Pré-vendas ordena por `l.updated_at DESC` e o badge de
            // tempo na etapa sai dele. Medido em 21/09: esta rotina alcança
            // 2.253 leads, e 2.006 deles estão parados há mais de 14 dias — todos
            // saltariam para o topo do board como se tivessem acabado de ser
            // trabalhados. Já aconteceu antes, com 216 leads, e o board passou a
            // mostrar "17min" em tudo.
          })
          .where(and(eq(leads.id, lead.id), or(isNull(leads.utmContent), eq(leads.utmContent, ""))));
        resultado.preenchidos++;
      } else {
        resultado.semDadoNoRd++;
      }
    } catch (e) {
      resultado.erros++;
      console.error(`[rd-criativo] erro no lead ${lead.id}:`, e);
    }
    await new Promise((r) => setTimeout(r, 150)); // rate limit RD
  }
  return resultado;
}
