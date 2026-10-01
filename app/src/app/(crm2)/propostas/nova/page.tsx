import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
/* O Builder é o desenho do handoff, convertido por máquina.
   Ver docs/design/PLANO-HANDOFF.md. */
import { PropostaProto } from "@/components/onface/proto/PropostaProto";
import { acaoCatalogo, acaoCriar, acaoEnviar } from "../actions";
import { PropostasPage } from "../page";
import type { Familia } from "@/lib/vendas/dominio";

export const metadata = { title: "Nova proposta" };
export const dynamic = "force-dynamic";

const FAMILIAS: Familia[] = ["CALLFACE_AI", "PABX", "WHITE_LABEL"];

/**
 * O compositor de proposta.
 *
 * Proposta NASCE de uma oportunidade — é dela que vêm empresa, contato e
 * família, e é nela que o valor passa a existir. Sem `?oportunidade=`, a tela
 * não tem o que compor, então a rota devolve a lista em vez de abrir um
 * formulário que não fecha em lugar nenhum.
 */
export default async function NovaPropostaPage({ searchParams }: {
  searchParams: Promise<{ oportunidade?: string; proposta?: string; acao?: "enviar" | "juridicos" | "revisar" }>;
}) {
  const params = await searchParams;
  if (!params.oportunidade) return <PropostasPage searchParams={searchParams} abrirComposer />;

  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const [negocio] = await db.execute<{
    id: string; titulo: string; etapa: string | null; familia: string | null;
    empresa_id: string | null; empresa: string | null; responsavel: string | null;
    lead_id: string | null; lead_nome: string | null; lead_cargo: string | null;
    source_process: string | null;
  }>(sql`
    SELECT n.id::text, n.titulo, n.etapa,
           COALESCE(n.service_family, o.service_family) AS familia,
           n.empresa_id::text, COALESCE(e.nome, l.empresa) AS empresa,
           u.nome AS responsavel, n.lead_id::text, l.nome AS lead_nome, l.cargo AS lead_cargo,
           COALESCE(n.source_process, o.source_process) AS source_process
      FROM negocios n
      LEFT JOIN empresas e ON e.id = n.empresa_id
      LEFT JOIN leads l ON l.id = n.lead_id
      LEFT JOIN usuarios u ON u.id = n.responsavel_id
      LEFT JOIN oportunidades o ON o.negocio_id_legado = n.id
     WHERE n.id = ${params.oportunidade}::uuid
       AND n.organizacao_id = ${ctx.organizacaoId}::uuid
  `);
  if (!negocio) redirect("/propostas");

  // O comitê da empresa: é dele que sai quem recebe a proposta.
  const contatos = negocio.empresa_id ? await db.execute<{
    id: string; nome: string; cargo: string | null; email: string | null; telefone: string | null;
  }>(sql`
    SELECT id::text, COALESCE(nome, 'Sem nome') AS nome, cargo, email, telefone
      FROM pessoas
     WHERE empresa_id = ${negocio.empresa_id}::uuid
       AND organizacao_id = ${ctx.organizacaoId}::uuid
     ORDER BY nome LIMIT 50
  `) : [];

  const propostas = await db.execute<{ numero: number; versao: number; status: string }>(sql`
    SELECT numero, versao, status FROM propostas
     WHERE negocio_id = ${params.oportunidade}::uuid
     ORDER BY numero, versao
  `);

  /* As três famílias de uma vez: o Builder deixa trocar a família no passo 0,
     e buscar sob demanda a cada troca daria uma tela que pisca. São 55 preços
     no total — cabe numa carga só. */
  const catalogo = Object.fromEntries(
    await Promise.all(FAMILIAS.map(async (f) => [f, await acaoCatalogo(f)] as const)),
  );

  return (
    <PropostaProto
      oportunidade={{
        id: negocio.id,
        empresa: negocio.empresa?.trim() || "Empresa não informada",
        empresaId: negocio.empresa_id,
        pessoa: negocio.lead_nome ?? "Sem contato",
        cargo: negocio.lead_cargo ?? "",
        familia: negocio.familia,
        etapa: negocio.etapa ?? "entrada",
        resp: negocio.responsavel,
        leadId: negocio.lead_id,
        origem: negocio.source_process,
        pessoas: contatos.map((c) => ({
          id: c.id, nome: c.nome, papel: c.cargo ?? "Contato",
          email: c.email, telefone: c.telefone,
        })),
        propostas: propostas.map((p) => ({
          codigo: String(p.numero), versao: p.versao, status: p.status,
        })),
      }}
      catalogo={catalogo}
      acoes={{ criar: acaoCriar, enviar: acaoEnviar }}
    />
  );
}
