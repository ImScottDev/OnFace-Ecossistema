import { notFound, redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { clienteParaODesenho } from "@/lib/clientes/cliente-para-o-desenho";
/* A tela é o desenho do handoff, convertido por máquina. `Cf2Cliente360`
   (crm2/clientes/Cliente360) era a versão anterior e sai da rota — o
   componente continua no repo para comparação. */
import { ClienteProto, type UsoCallfaceAiDoCliente } from "@/components/onface/proto/ClienteProto";
import { usoDoCliente } from "@/lib/callface-ai/uso";
import { confirmarVinculo, removerVinculo } from "@/lib/callface-ai/vinculo-actions";

export const metadata = { title: "Cliente" };
export const dynamic = "force-dynamic";

/* Balde de reconciliação do billing, não uma empresa. Aparece em `clientes`
   porque recebe serviços sem dono; abrir um 360 dele seria mostrar uma conta
   que não existe. */
const NAO_E_CLIENTE = new Set(["101bca9d-5d84-593d-af81-74e743fed584"]);

export default async function ClienteDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");
  const { id } = await params;
  if (NAO_E_CLIENTE.has(id) || !/^[0-9a-f-]{36}$/i.test(id)) notFound();

  let cliente = await clienteParaODesenho(ctx.organizacaoId, id);
  /* O 360 é chaveado pela EMPRESA, mas a busca global (CommandPalette) e links
     antigos do CRM usam o id da tabela `clientes`. Sem este fallback, abrir um
     cliente pela busca dava 404. Resolve para a empresa e redireciona, para a
     URL ficar canônica. */
  if (!cliente) {
    const [c] = await db.execute<{ empresa_id: string | null }>(sql`
      SELECT empresa_id::text FROM clientes
       WHERE id = ${id}::uuid AND organizacao_id = ${ctx.organizacaoId}::uuid`);
    if (c?.empresa_id && c.empresa_id !== id) redirect(`/clientes/${c.empresa_id}`);
  }
  if (!cliente) notFound();

  return <ClienteProto cliente={cliente} usoCallfaceAi={await lerUsoCallfaceAi(ctx.organizacaoId, cliente)} />;
}

/* Aba "Uso da Callface AI": aparece para quem contratou Callface AI ou já tem
   vínculo/sugestão com uma organização do SaaS. Para conta só de PABX, uma
   aba dizendo "sem vínculo" seria ruído. A falha de leitura NÃO derruba o
   360: vira o estado de erro da aba. */
async function lerUsoCallfaceAi(organizacaoId: string, cliente: NonNullable<Awaited<ReturnType<typeof clienteParaODesenho>>>): Promise<UsoCallfaceAiDoCliente | undefined> {
  const acoes = { confirmar: confirmarVinculo, remover: removerVinculo };
  const contratou = cliente.servicos.some((s) => s.familia === "CALLFACE_AI");
  try {
    const uso = await usoDoCliente(organizacaoId, cliente.empresa.id);
    if (!contratou && (!uso || uso.vinculo.estado === "sem")) return undefined;
    return { uso, acoes };
  } catch (e) {
    console.error("[cliente 360] uso da Callface AI", e);
    return contratou ? { uso: null, erro: "A leitura do uso falhou no servidor. Recarregue; se continuar, o sincronizador pode estar sem tabela ou fora do ar.", acoes } : undefined;
  }
}
