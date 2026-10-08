import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
/* O Builder é o desenho do handoff, convertido por máquina
   (ver docs/design/COMO-LIGAR-UMA-TELA.md). */
import { PropostaProto } from "@/components/onface/proto/PropostaProto";
import { acaoAtualizarRascunho, acaoCatalogo, acaoCriar, acaoCriarRevisao, acaoEnviar } from "../actions";
import { PropostasPage } from "../page";
import type { Familia } from "@/lib/vendas/dominio";

export const metadata = { title: "Nova proposta" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  /* Link com só `?proposta=`: a proposta sabe a oportunidade dela. */
  if (!params.oportunidade && params.proposta && UUID.test(params.proposta)) {
    const [p] = await db.execute<{ negocio_id: string | null }>(sql`
      SELECT negocio_id::text FROM propostas
       WHERE id = ${params.proposta}::uuid AND organizacao_id = ${ctx.organizacaoId}::uuid`);
    if (p?.negocio_id) redirect(`/propostas/nova?oportunidade=${p.negocio_id}&proposta=${params.proposta}`);
    redirect(`/propostas/${params.proposta}`);
  }
  if (!params.oportunidade) return <PropostasPage searchParams={searchParams} abrirComposer />;

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

  /* As propostas da oportunidade COM os itens: o builder abre o rascunho com as
     linhas dele em vez de abrir vazio. Linha de proposta legada não tem preço no
     catálogo; `preco` vai como "item:<id>" e a ação mantém a linha. */
  const propostas = await db.execute<{
    id: string; numero: number; versao: number; status: string; modo: string | null; validade_dias: number | null;
    observacoes: string | null; prazo: number | null; parcelas: number | null;
    itens: Array<{ id: string; preco: string | null; prod: string | null; nome: string; descricao: string | null; natureza: string | null; tipo: string;
      quantidade: string; valor_unitario: string; desconto: string; desconto_tipo: string }> | null;
  }>(sql`
    SELECT p.id::text, p.numero, p.versao, p.status, p.modo_fechamento AS modo, p.validade_dias,
           p.observacoes, p.prazo_contrato_meses AS prazo, p.parcelas,
           (SELECT json_agg(json_build_object(
                     'id', i.id, 'preco', i.catalogo_preco_id, 'prod', i.servico_catalogo_id, 'nome', i.nome,
                     'descricao', i.descricao, 'natureza', i.revenue_nature, 'tipo', i.tipo,
                     'quantidade', i.quantidade, 'valor_unitario', i.valor_unitario,
                     'desconto', i.desconto, 'desconto_tipo', i.desconto_tipo) ORDER BY i.ordem, i.created_at)
              FROM proposta_itens i WHERE i.proposta_id = p.id) AS itens
      FROM propostas p
     WHERE p.negocio_id = ${params.oportunidade}::uuid AND p.organizacao_id = ${ctx.organizacaoId}::uuid
     ORDER BY p.numero, p.versao
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
          id: p.id, codigo: String(p.numero), versao: p.versao, status: p.status,
          modo: p.modo, validade: p.validade_dias ?? 30,
          editor: { obs: p.observacoes ?? "", prazo: String(p.prazo ?? 0), parcelas: String(p.parcelas ?? 1) },
          itens: (p.itens ?? []).map((i) => ({
            prod: i.prod ?? undefined,
            preco: i.preco ?? `item:${i.id}`,
            nome: i.nome, desc: i.descricao ?? "",
            natureza: i.natureza ?? (i.tipo === "recorrente" ? "MRR" : i.tipo === "setup" ? "SETUP" : "ONE_TIME"),
            valor: Number(i.valor_unitario), qtd: Number(i.quantidade) || 1,
            descTipo: i.desconto_tipo === "valor" ? "valor" : "pct",
            descVal: Number(i.desconto) ? String(Number(i.desconto)).replace(".", ",") : "",
          })),
        })),
      }}
      catalogo={catalogo}
      acoes={{ criar: acaoCriar, enviar: acaoEnviar, atualizar: acaoAtualizarRascunho, revisar: acaoCriarRevisao }}
    />
  );
}
