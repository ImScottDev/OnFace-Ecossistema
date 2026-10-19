/**
 * Estado real da devolução de conversões à Meta, para a tela Ajustes › Tracking.
 *
 * DERIVADO, nunca declarado: credencial é "a variável existe no servidor" (nunca
 * o valor), entrega é o que `meta_capi_entregas` registrou, e o mapeamento de
 * eventos é a própria `POLITICA_EVENTOS` que o worker usa. A tela antiga gravava
 * campos que nenhum processo lia; esta só mostra o que de fato roda.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { POLITICA_EVENTOS, credenciaisCapi, credenciaisLeadAds } from "@onface/integrations-meta";

export interface EventoTracking {
  eventoOnface: string;
  nomeMeta: string;
  padrao: boolean;
  comValor: boolean;
  porque: string;
  /** Vezes que o fato aconteceu no outbox (tudo, qualquer origem). */
  ocorreu: number;
  entregues: number;
  falhas: number;
  ultimaEntrega: string | null;
}

export interface EstadoTracking {
  credenciais: {
    datasetId: boolean; tokenCapi: boolean; tokenLeads: boolean; segredoApp: boolean;
    /** Com código de teste, a Meta recebe o evento na aba Test Events e NÃO conta como conversão. */
    modoTeste: boolean;
  };
  leads: { total30d: number; ultimo: string | null };
  eventos: EventoTracking[];
  falhasRecentes: Array<{ evento: string; motivo: string | null; detalhe: string | null; quando: string }>;
}

export async function estadoDoTracking(organizacaoId: string): Promise<EstadoTracking> {
  const capi = credenciaisCapi();
  const leadsCred = credenciaisLeadAds();
  const org = sql`${organizacaoId}::uuid`;

  const entregas = await db.execute<{
    event_type: string; entregues: number; falhas: number; ultima: string | null;
  }>(sql`
    SELECT event_type,
           count(*) FILTER (WHERE entregue)::int AS entregues,
           count(*) FILTER (WHERE NOT entregue)::int AS falhas,
           max(criado_em) FILTER (WHERE entregue)::text AS ultima
      FROM meta_capi_entregas WHERE organizacao_id = ${org} GROUP BY event_type`);

  const tipos = Object.keys(POLITICA_EVENTOS);
  const ocorrencias = await db.execute<{ event_type: string; n: number }>(sql`
    SELECT event_type, count(*)::int AS n FROM event_outbox
     WHERE organizacao_id = ${org} AND event_type IN (${sql.join(tipos.map((t) => sql`${t}`), sql`, `)})
     GROUP BY event_type`);

  const [leads] = await db.execute<{ n: number; ultimo: string | null }>(sql`
    SELECT count(*)::int AS n, max(created_at)::date::text AS ultimo
      FROM leads WHERE organizacao_id = ${org} AND meta_ad_id IS NOT NULL
       AND created_at > now() - interval '30 days'`);

  const falhas = await db.execute<{ event_name: string | null; motivo: string | null; detalhe: string | null; quando: string }>(sql`
    SELECT event_name, motivo, left(detalhe, 200) AS detalhe, criado_em::text AS quando
      FROM meta_capi_entregas WHERE organizacao_id = ${org} AND NOT entregue
     ORDER BY criado_em DESC LIMIT 5`);

  const porTipo = new Map(entregas.map((e) => [e.event_type, e]));
  const nOutbox = new Map(ocorrencias.map((o) => [o.event_type, o.n]));

  return {
    credenciais: {
      datasetId: Boolean(capi.datasetId),
      tokenCapi: Boolean(capi.accessToken),
      tokenLeads: Boolean(leadsCred.accessToken),
      segredoApp: Boolean(leadsCred.appSecret),
      modoTeste: Boolean(capi.testEventCode),
    },
    leads: { total30d: leads?.n ?? 0, ultimo: leads?.ultimo ?? null },
    eventos: Object.entries(POLITICA_EVENTOS).map(([tipo, r]) => ({
      eventoOnface: tipo, nomeMeta: r.nomeMeta, padrao: r.padrao, comValor: r.comValor, porque: r.porque,
      ocorreu: nOutbox.get(tipo) ?? 0,
      entregues: porTipo.get(tipo)?.entregues ?? 0,
      falhas: porTipo.get(tipo)?.falhas ?? 0,
      ultimaEntrega: porTipo.get(tipo)?.ultima ?? null,
    })),
    falhasRecentes: falhas.map((f) => ({ evento: f.event_name ?? "—", motivo: f.motivo, detalhe: f.detalhe, quando: f.quando })),
  };
}
