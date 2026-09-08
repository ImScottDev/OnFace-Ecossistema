/**
 * Dry-run: para cada negócio ABERTO no pipeline, mostra em que trilha ele
 * cairia se fosse marcado como ganho agora. Não escreve nada.
 *
 * Existe pra responder "e os negócios que já existem?" com dado real em vez
 * de estimativa — a classificação depende do que cada negócio tem de proposta,
 * contrato e nome.
 */
import { db } from "@/lib/db";
import { and, eq, inArray, isNull, not } from "drizzle-orm";
import { negocios } from "@/lib/db/schema";
import { resolverFamiliaDoNegocio, regraDaFamilia } from "@/lib/crm/pos-venda";

const ABERTOS = ["reuniao_agendada", "reuniao_realizada", "trial", "proposta_apresentada", "negociacao_iniciada", "em_fechamento"];

async function main() {
  const lista = await db
    .select({ id: negocios.id, titulo: negocios.titulo, status: negocios.status })
    .from(negocios)
    .where(inArray(negocios.status, ABERTOS));

  console.log(`${lista.length} negócios abertos no pipeline\n`);

  const porTrilha = new Map<string, { n: number; exemplos: string[] }>();
  for (const neg of lista) {
    const familia = await resolverFamiliaDoNegocio(neg.id);
    const t = regraDaFamilia(familia).trilhaLabel;
    const e = porTrilha.get(t) || { n: 0, exemplos: [] };
    e.n++;
    if (e.exemplos.length < 4) e.exemplos.push(neg.titulo.slice(0, 46));
    porTrilha.set(t, e);
  }

  const total = lista.length;
  for (const [trilha, { n, exemplos }] of [...porTrilha.entries()].sort((a, b) => b[1].n - a[1].n)) {
    console.log(`${String(n).padStart(4)}  ${String(Math.round((n / total) * 100)).padStart(3)}%  ${trilha}`);
    for (const ex of exemplos) console.log(`            · ${ex}`);
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
