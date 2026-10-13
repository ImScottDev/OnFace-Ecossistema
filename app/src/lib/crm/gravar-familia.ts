/**
 * Escrita da família no Ganho e no item da oportunidade.
 *
 * A LEITURA mora em `familiaDaOportunidade` (classificar-produto.ts) e `resolverFamiliaDoNegocio` (pos-venda.ts).
 * Aqui é o lado que faltava: quem ganha grava, para o próximo não ter de adivinhar. "Não sei" também se grava
 * (UNKNOWN): nulo deixa a pergunta aberta, UNKNOWN diz que ela foi feita. Nunca recusa nem atrasa o Ganho.
 */
import { sql } from "drizzle-orm";
import type { FamiliaServico } from "@/lib/crm/classificar-produto";

const VALIDAS = ["CALLFACE_AI", "PABX", "WHITE_LABEL"];
const valida = (f: string | null | undefined): f is Exclude<FamiliaServico, "UNKNOWN"> => !!f && VALIDAS.includes(f);

/**
 * Família de UM item da oportunidade: a do próprio item, senão a do catálogo do preço escolhido, senão a do
 * produto de catálogo. "UNKNOWN" gravado no item não vale como resposta (era ele que vencia o catálogo).
 */
export function familiaDoItem(e: {
  familiaDoItem?: string | null; familiaDoPreco?: string | null; familiaDoServico?: string | null;
}): FamiliaServico {
  return [e.familiaDoItem, e.familiaDoPreco, e.familiaDoServico].find(valida) ?? "UNKNOWN";
}

export interface DepsGravarFamilia {
  resolver: (negocioId: string) => Promise<FamiliaServico>;
  gravar: (a: { negocioId: string; organizacaoId: string; familia: FamiliaServico }) => Promise<void>;
}

async function depsReais(): Promise<DepsGravarFamilia> {
  const { db } = await import("@/lib/db");
  const { resolverFamiliaDoNegocio } = await import("@/lib/crm/pos-venda");
  return {
    resolver: resolverFamiliaDoNegocio,
    // Só preenche o que está em branco (nulo/UNKNOWN): família já declarada nunca é trocada aqui.
    gravar: async ({ negocioId, organizacaoId, familia }) => {
      await db.execute(sql`
        UPDATE negocios SET service_family = COALESCE(NULLIF(service_family, 'UNKNOWN'), ${familia})
         WHERE id = ${negocioId}::uuid AND organizacao_id = ${organizacaoId}::uuid
           AND service_family IS DISTINCT FROM COALESCE(NULLIF(service_family, 'UNKNOWN'), ${familia})`);
      await db.execute(sql`
        UPDATE oportunidades SET service_family = COALESCE(NULLIF(service_family, 'UNKNOWN'), ${familia}), updated_at = now()
         WHERE negocio_id_legado = ${negocioId}::uuid AND organizacao_id = ${organizacaoId}::uuid
           AND service_family IS DISTINCT FROM COALESCE(NULLIF(service_family, 'UNKNOWN'), ${familia})`);
    },
  };
}

/**
 * Grava a família do negócio ganho (e da oportunidade espelho). `familiaHint` é a família que quem disparou o
 * Ganho já resolveu (grupo que pagou/assinou); sem ela, vale a estrutura da oportunidade. Falha é dita no log
 * e devolvida como null; o Ganho já está gravado e não pode depender disto.
 */
export async function gravarFamiliaDoGanho(
  a: { negocioId: string; organizacaoId: string; familiaHint?: string | null },
  deps?: DepsGravarFamilia,
): Promise<FamiliaServico | null> {
  try {
    const d = deps ?? (await depsReais());
    const familia: FamiliaServico = valida(a.familiaHint) ? a.familiaHint : ((await d.resolver(a.negocioId)) ?? "UNKNOWN");
    await d.gravar({ negocioId: a.negocioId, organizacaoId: a.organizacaoId, familia });
    return familia;
  } catch (e) {
    console.error(`[gravar-familia] negócio ${a.negocioId} ganho, mas a família não foi gravada:`, e);
    return null;
  }
}
