import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { montarVisaoGeral } from "@/lib/analytics/onface-visao-geral";
import { VisaoGeral } from "@/components/onface/visao-geral/VisaoGeral";

export const metadata = { title: "ONFACE — Visão Geral (dado real)" };
export const dynamic = "force-dynamic";

/**
 * A mesma tela, com dado real, sem exigir sessão.
 *
 * Existe para validar o que só aparece com dado de verdade: nome de empresa
 * longo, lista vazia, campo nulo, número fora da faixa do desenho. O layout só
 * quebra nessas horas, e não dá para descobrir isso pelo mock. Usa a primeira
 * organização do banco; o grupo já bloqueia a rota fora de desenvolvimento.
 */
export default async function DesenhoVisaoGeralReal() {
  const [org] = await db.execute<{ id: string }>(sql`
    SELECT id::text FROM organizacoes ORDER BY created_at LIMIT 1
  `);
  const [user] = await db.execute<{ id: string; nome: string }>(sql`
    SELECT id::text, nome FROM usuarios WHERE organizacao_id = ${org.id}::uuid ORDER BY created_at LIMIT 1
  `);

  const dados = await montarVisaoGeral(org.id, user?.id ?? "", user?.nome ?? "");
  return <VisaoGeral dados={dados} />;
}
