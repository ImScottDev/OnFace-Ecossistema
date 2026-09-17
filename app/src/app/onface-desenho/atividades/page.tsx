import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { montarAtividades } from "@/lib/analytics/onface-atividades";
import { Atividades } from "@/components/onface/atividades/Atividades";
import {
  desAlternarConclusao, desBuscarContatos, desBuscarEmpresas,
  desBuscarNegocios, desCriarAtividade, desMudarStatus, desResponsaveis,
} from "./actions";

export const metadata = { title: "ONFACE — Atividades (dado real)" };
export const dynamic = "force-dynamic";

/**
 * Atividades com dado real, sem exigir sessão. Só existe em desenvolvimento
 * (o layout do grupo bloqueia em produção) e serve para validar a tela com
 * volume e texto de verdade. As ações de escrita continuam exigindo sessão:
 * elas resolvem o tenant no servidor e recusam sem ele.
 */
export default async function DesenhoAtividades() {
  const [org] = await db.execute<{ id: string }>(sql`
    SELECT id::text FROM organizacoes ORDER BY created_at LIMIT 1
  `);
  const dados = await montarAtividades(org.id);

  return (
    <Atividades
      dados={dados}
      acoes={{
        buscarEmpresas: desBuscarEmpresas,
        buscarContatos: desBuscarContatos,
        buscarNegocios: desBuscarNegocios,
        responsaveis: desResponsaveis,
        criar: desCriarAtividade,
        alternarConclusao: desAlternarConclusao,
        mudarStatus: desMudarStatus,
      }}
    />
  );
}
