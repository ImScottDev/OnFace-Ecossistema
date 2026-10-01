import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/auth/tenant";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* O protótipo abre a empresa pelo LEAD (`?lead=`), e a ficha real é chaveada
   pela empresa. A ponte precisa do banco, então mora aqui no servidor — com o
   tenant da sessão, para um id de outra organização não abrir nada. Lead sem
   empresa cadastrada vai para o diretório, que é onde se vincula uma. */
export default async function EmpresaDoPrototipo({ searchParams }: {
  searchParams: Promise<{ lead?: string }>;
}) {
  const { lead } = await searchParams;
  if (!lead || !UUID.test(lead)) redirect("/contatos");
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const [linha] = await db.execute<{ empresa_id: string | null }>(sql`
    SELECT empresa_id::text FROM leads
     WHERE id = ${lead}::uuid AND organizacao_id = ${ctx.organizacaoId}::uuid
  `);
  redirect(linha?.empresa_id ? `/empresas/${linha.empresa_id}` : "/contatos");
}
