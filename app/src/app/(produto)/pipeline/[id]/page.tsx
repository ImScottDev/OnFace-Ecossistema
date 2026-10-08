import { notFound, redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/auth/tenant";
/* A tela é o desenho do handoff, convertido por máquina
   (ver docs/design/COMO-LIGAR-UMA-TELA.md). */
import { OportunidadeProto } from "@/components/onface/proto/OportunidadeProto";
import { acaoDetalhe, acaoMoverEtapa, acaoPerder, acaoTentarGanhar, acaoDefinirProximaAcao, acaoCriarOportunidade, acaoAlterarFamilia, acaoAtribuirResponsavel, acaoSalvarResumo } from "../actions";
import { acaoExcluirRascunho, acaoRecusar } from "../../propostas/actions";

export default async function OportunidadePorId({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ definir?: string }>;
}) {
  const { id } = await params;
  const { definir } = await searchParams;
  const resultado = await acaoDetalhe(id);
  if (!resultado.ok || !resultado.dados?.oportunidade) {
    // O cartão leva o id do negócio, mas oportunidade sem negócio legado leva o
    // da própria oportunidade, e o detalhe só conhece negócio. Link salvo ou
    // aberto em navegação dura com esse id dava 404; traduzir e redirecionar.
    const ctx = await getTenantContext();
    if (ctx && /^[0-9a-f-]{36}$/i.test(id)) {
      const [o] = await db.execute<{ negocio_id: string | null }>(sql`
        SELECT negocio_id_legado::text AS negocio_id FROM oportunidades
         WHERE id = ${id}::uuid AND organizacao_id = ${ctx.organizacaoId}::uuid`);
      if (o?.negocio_id && o.negocio_id !== id) redirect(`/pipeline/${o.negocio_id}${definir ? `?definir=${definir}` : ""}`);
    }
    notFound();
  }

  /* Equipe real da organização: o menu de @menção e o seletor de responsável
     listavam só o responsável atual + o usuário logado. Vem do banco agora. */
  const ctxEquipe = await getTenantContext();
  const equipe = ctxEquipe
    ? (await db.execute<{ nome: string }>(sql`
        SELECT nome FROM usuarios
         WHERE organizacao_id = ${ctxEquipe.organizacaoId}::uuid AND ativo = true
         ORDER BY nome`)).map((u) => u.nome)
    : [];

  return (
    <OportunidadeProto
      oportunidade={resultado.dados.oportunidade}
      timeline={resultado.dados.timeline}
      equipe={equipe}
      abrirDefinirFamilia={definir === "familia"}
      acoes={{
        moverEtapa: acaoMoverEtapa,
        perder: acaoPerder,
        tentarGanhar: acaoTentarGanhar,
        definirProximaAcao: acaoDefinirProximaAcao,
        criarOportunidade: acaoCriarOportunidade,
        alterarFamilia: acaoAlterarFamilia,
        atribuirResponsavel: acaoAtribuirResponsavel,
        salvarResumo: acaoSalvarResumo,
        recusarProposta: acaoRecusar,
        excluirRascunho: acaoExcluirRascunho,
      }}
    />
  );
}
