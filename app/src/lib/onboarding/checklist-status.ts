import { db } from "@/lib/db";
import { onboardingChecklist, ligacoes } from "@/lib/db/schema";
import { eq, inArray, sql, and } from "drizzle-orm";
import { itensParaProduto, ITENS_AUTOMATICOS, JANELA_TTV_DIAS } from "./checklist-config";

export interface StatusItemChecklist {
  item: string;
  concluido: boolean;
  automatico: boolean;
  dentroDoPrazo?: boolean; // só relevante pro item automático (primeiro_uso_real)
}

/** Status do checklist de 1 negócio — usado no PATCH de gate e no card individual. */
export async function statusChecklist(
  negocioId: string,
  produto: string | null | undefined,
  ganhoAt: Date | null,
): Promise<StatusItemChecklist[]> {
  const itensEsperados = itensParaProduto(produto);

  const manuais = await db
    .select({ item: onboardingChecklist.item, concluidoEm: onboardingChecklist.concluidoEm })
    .from(onboardingChecklist)
    .where(eq(onboardingChecklist.negocioId, negocioId));
  const manualConcluido = new Set(manuais.filter((m) => m.concluidoEm).map((m) => m.item));

  let primeiraLigacao: Date | null = null;
  if (itensEsperados.includes("primeiro_uso_real")) {
    const [r] = await db
      .select({ min: sql<string>`min(${ligacoes.callDate})` })
      .from(ligacoes)
      .where(eq(ligacoes.negocioId, negocioId));
    primeiraLigacao = r?.min ? new Date(r.min) : null;
  }

  return itensEsperados.map((item) => {
    if (ITENS_AUTOMATICOS.has(item) && item === "primeiro_uso_real") {
      const dentroDoPrazo = !!(primeiraLigacao && ganhoAt &&
        (primeiraLigacao.getTime() - ganhoAt.getTime()) <= JANELA_TTV_DIAS * 24 * 60 * 60 * 1000);
      return { item, concluido: !!primeiraLigacao, automatico: true, dentroDoPrazo };
    }
    return { item, concluido: manualConcluido.has(item), automatico: false };
  });
}

/** Versão em lote pro board (evita N+1) — 1 query de checklist manual + 1 de ligações pra todos os negócios. */
export async function statusChecklistEmLote(
  negocios: { id: string; produto: string | null; ganhoAt: Date | null }[],
): Promise<Map<string, StatusItemChecklist[]>> {
  const ids = negocios.map((n) => n.id);
  if (ids.length === 0) return new Map();

  const manuais = ids.length
    ? await db
        .select({ negocioId: onboardingChecklist.negocioId, item: onboardingChecklist.item, concluidoEm: onboardingChecklist.concluidoEm })
        .from(onboardingChecklist)
        .where(inArray(onboardingChecklist.negocioId, ids))
    : [];
  const manualPorNegocio = new Map<string, Set<string>>();
  for (const m of manuais) {
    if (!m.concluidoEm) continue;
    if (!manualPorNegocio.has(m.negocioId)) manualPorNegocio.set(m.negocioId, new Set());
    manualPorNegocio.get(m.negocioId)!.add(m.item);
  }

  const primeiraLigacaoPorNegocio = new Map<string, Date>();
  const precisamDeLigacao = negocios.filter((n) => itensParaProduto(n.produto).includes("primeiro_uso_real")).map((n) => n.id);
  if (precisamDeLigacao.length > 0) {
    const rows = await db
      .select({ negocioId: ligacoes.negocioId, min: sql<string>`min(${ligacoes.callDate})` })
      .from(ligacoes)
      .where(and(inArray(ligacoes.negocioId, precisamDeLigacao), sql`${ligacoes.negocioId} is not null`))
      .groupBy(ligacoes.negocioId);
    for (const r of rows) {
      if (r.negocioId && r.min) primeiraLigacaoPorNegocio.set(r.negocioId, new Date(r.min));
    }
  }

  const resultado = new Map<string, StatusItemChecklist[]>();
  for (const n of negocios) {
    const itensEsperados = itensParaProduto(n.produto);
    const manualConcluido = manualPorNegocio.get(n.id) ?? new Set<string>();
    const primeiraLigacao = primeiraLigacaoPorNegocio.get(n.id) ?? null;
    resultado.set(
      n.id,
      itensEsperados.map((item) => {
        if (item === "primeiro_uso_real") {
          const dentroDoPrazo = !!(primeiraLigacao && n.ganhoAt &&
            (primeiraLigacao.getTime() - n.ganhoAt.getTime()) <= JANELA_TTV_DIAS * 24 * 60 * 60 * 1000);
          return { item, concluido: !!primeiraLigacao, automatico: true, dentroDoPrazo };
        }
        return { item, concluido: manualConcluido.has(item), automatico: false };
      }),
    );
  }
  return resultado;
}
