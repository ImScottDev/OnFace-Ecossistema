import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export type EntregaAgregada = {
  evento: string;
  motivo: string;
  entregue: boolean;
  quantidade: number;
  atualizado_em: string | null;
};
export type SaudeCapi = ReturnType<typeof resumirSaudeCapi>;

const EXCLUIDOS = new Set(["sem_mapeamento", "sem_touchpoint_meta"]);
const BLOQUEADOS = new Set(["sem_identidade", "sem_credencial", "recusado", "transitorio"]);

/** Evento aceito pelo adapter != evento atribuído ou otimizado no Meta Events Manager. */
export function resumirSaudeCapi(linhas: EntregaAgregada[]) {
  let total = 0, entregues = 0, excluidos = 0, bloqueados = 0, aguardando = 0;
  let ultimaAtualizacao: string | null = null;
  const eventos = new Map<string, { nome: string; entregues: number; total: number }>();
  const motivos = new Map<string, number>();
  for (const l of linhas) {
    const n = Number(l.quantidade);
    if (!Number.isFinite(n) || n <= 0) continue;
    total += n;
    if (l.atualizado_em && (!ultimaAtualizacao || l.atualizado_em > ultimaAtualizacao)) ultimaAtualizacao = l.atualizado_em;
    const e = eventos.get(l.evento) ?? { nome: l.evento, entregues: 0, total: 0 };
    e.total += n;
    if (l.entregue) { entregues += n; e.entregues += n; }
    else if (EXCLUIDOS.has(l.motivo)) excluidos += n;
    else if (BLOQUEADOS.has(l.motivo)) bloqueados += n;
    else aguardando += n;
    eventos.set(l.evento,e);
    if (!l.entregue) motivos.set(l.motivo || "sem_estado", (motivos.get(l.motivo || "sem_estado") ?? 0) + n);
  }
  const elegiveis = total - excluidos;
  return {
    total, entregues, excluidos, bloqueados, aguardando, elegiveis,
    taxaEntrega: elegiveis ? Math.round(1000 * entregues / elegiveis) / 10 : null,
    ultimaAtualizacao,
    porEvento: [...eventos.values()].sort((a,b) => b.entregues - a.entregues || a.nome.localeCompare(b.nome)),
    motivos: [...motivos].map(([motivo,quantidade])=>({motivo,quantidade})).sort((a,b)=>b.quantidade-a.quantidade),
  };
}
export async function consultarSaudeCapi(organizacaoId: string, desde: Date, ate: Date) {
  const rows = await db.execute<EntregaAgregada>(sql`
    SELECT COALESCE(event_name,'Sem mapeamento') AS evento,
           COALESCE(motivo,'') AS motivo, entregue,
           count(*)::int AS quantidade,
           max(atualizado_em)::text AS atualizado_em
      FROM meta_capi_entregas
     WHERE organizacao_id = ${organizacaoId}::uuid
       AND criado_em >= ${desde.toISOString()}::timestamptz
       AND criado_em < ${ate.toISOString()}::timestamptz
     GROUP BY event_name,motivo,entregue
  `);
  return resumirSaudeCapi([...rows]);
}
