/**
 * Fonte ÚNICA de "Leads por canal". Antes o /growth agrupava `origem` crua e o
 * /marketing normalizava por CASE de utm_medium+origem — os rótulos não batiam
 * entre as abas (auditoria 21/07, item 5). Agora os dois consomem daqui.
 * Deriva do utm (sinal confiável) e cai pro texto de `origem` só como fallback.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export interface CanalLeads {
  origem: string;
  total: number;
}

export async function getLeadsPorCanal(orgId: string, since: Date, until: Date): Promise<CanalLeads[]> {
  const rows = await db.execute(sql`
    SELECT
      CASE
        WHEN lower(coalesce(origem,'')) = 'outbound' THEN 'Outbound'
        WHEN lower(coalesce(utm_medium,'')) ~ '(cpc|ppc|paid)' OR origem = 'Mídia Paga' OR origem = 'meta_ads' THEN 'Mídia Paga'
        WHEN lower(coalesce(utm_medium,'')) ~ 'email' OR origem ILIKE '%RD%' THEN 'Email'
        WHEN lower(coalesce(utm_medium,'')) ~ '(organic|social)' OR origem ILIKE 'Org%' OR origem = 'Instagram' THEN 'Orgânico'
        WHEN lower(coalesce(utm_source,'')) ~ 'direct' OR lower(coalesce(utm_medium,'')) ~ 'none' OR lower(coalesce(origem,'')) = 'direto' THEN 'Direto'
        WHEN origem IN ('migracao_zoho','ZohoDesk','stripe') THEN 'Base migrada'
        WHEN origem IS NULL OR origem = '' OR origem = 'NÃO DEFINIDO' THEN 'Não definido'
        ELSE coalesce(NULLIF(origem,''),'Outros')
      END AS origem,
      count(*)::int AS total
    FROM leads
    WHERE organizacao_id = ${orgId} AND created_at >= ${since.toISOString()} AND created_at < ${until.toISOString()}
    GROUP BY 1
    ORDER BY 2 DESC
  `);
  return (rows as unknown as { origem: string; total: number }[]).map((r) => ({ origem: r.origem, total: Number(r.total) }));
}
