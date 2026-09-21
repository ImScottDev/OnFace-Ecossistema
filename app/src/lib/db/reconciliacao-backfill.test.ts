/**
 * Testes de reconciliação de backfill — SPEC §50.2.
 *
 * "No silent loss." Estes testes rodam contra o banco e falham se um backfill
 * tiver perdido, inventado ou duplicado dado. São a diferença entre "o script
 * rodou" e "o script rodou certo".
 *
 * Pulam sozinhos quando o backfill ainda não rodou, para não quebrar a suíte
 * em máquina limpa.
 */
import { test, skip } from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

async function conta(q: ReturnType<typeof sql>): Promise<number> {
  const r = await db.execute<{ n: string }>(q);
  return Number(r[0]?.n ?? 0);
}

const backfillRodou = async () =>
  (await conta(sql`SELECT count(*) AS n FROM backfill_provenance WHERE fase = '05'`)) > 0;

test("fase 05: toda pessoa nasceu de uma linha de origem rastreável", async (t) => {
  if (!(await backfillRodou())) return t.skip("backfill da fase 05 ainda não rodou");
  const orfas = await conta(sql`
    SELECT count(*) AS n FROM pessoas p
    WHERE NOT EXISTS (SELECT 1 FROM backfill_provenance b
                      WHERE b.entidade_canonica = 'pessoa' AND b.id_canonico = p.id)`);
  assert.equal(orfas, 0, `${orfas} pessoas sem provenance: apareceram do nada e ninguém sabe de onde`);
});

test("fase 05: nenhum lead ficou para trás", async (t) => {
  if (!(await backfillRodou())) return t.skip("backfill da fase 05 ainda não rodou");
  const perdidos = await conta(sql`
    SELECT count(*) AS n FROM leads l
    WHERE NOT EXISTS (SELECT 1 FROM backfill_provenance b
                      WHERE b.tabela_origem = 'leads' AND b.id_origem = l.id::text)`);
  assert.equal(perdidos, 0, `${perdidos} leads sem destino canônico: perda silenciosa`);
});

test("fase 05: e-mail de pessoa existe em alguma linha de origem", async (t) => {
  if (!(await backfillRodou())) return t.skip("backfill da fase 05 ainda não rodou");
  const inventados = await conta(sql`
    SELECT count(*) AS n FROM pessoas p
    WHERE p.email IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM backfill_provenance b JOIN leads l ON l.id::text = b.id_origem
      WHERE b.entidade_canonica = 'pessoa' AND b.id_canonico = p.id
        AND lower(trim(l.email)) = lower(trim(p.email)))`);
  assert.equal(inventados, 0, `${inventados} pessoas com e-mail que não veio de nenhuma origem: dado fabricado`);
});

test("fase 05: nenhuma origem foi mapeada para dois destinos", async (t) => {
  if (!(await backfillRodou())) return t.skip("backfill da fase 05 ainda não rodou");
  const duplicados = await conta(sql`
    SELECT count(*) AS n FROM (
      SELECT tabela_origem, id_origem FROM backfill_provenance
      WHERE entidade_canonica = 'pessoa'
      GROUP BY 1, 2 HAVING count(DISTINCT id_canonico) > 1) x`);
  assert.equal(duplicados, 0, `${duplicados} linhas de origem apontando para mais de uma pessoa`);
});

test("fase 05: vínculo pessoa-empresa não aponta para empresa inexistente", async (t) => {
  if (!(await backfillRodou())) return t.skip("backfill da fase 05 ainda não rodou");
  const orfaos = await conta(sql`
    SELECT count(*) AS n FROM pessoa_empresa_vinculos v
    WHERE NOT EXISTS (SELECT 1 FROM empresas e WHERE e.id = v.empresa_id)`);
  assert.equal(orfaos, 0, `${orfaos} vínculos órfãos`);
});

test("ambiguidade virou caso aberto, não palpite", async (t) => {
  if (!(await backfillRodou())) return t.skip("backfill da fase 05 ainda não rodou");
  // Pessoa com mais de um vínculo e nenhum marcado principal só é aceitável se
  // houver caso de reconciliação registrado para ela. Senão o backfill deixou
  // a decisão no limbo em vez de expô-la.
  const semCaso = await conta(sql`
    SELECT count(*) AS n FROM (
      SELECT v.pessoa_id FROM pessoa_empresa_vinculos v
      GROUP BY v.pessoa_id
      HAVING count(*) > 1 AND bool_and(NOT v.principal)) x
    WHERE NOT EXISTS (SELECT 1 FROM reconciliacao_casos c WHERE c.fase = '05' AND c.tipo = 'IDENTIDADE_MULTIPLA_EMPRESA')`);
  assert.equal(semCaso, 0, `${semCaso} pessoas com vínculo ambíguo e nenhum caso aberto`);
});

const fase06Rodou = async () =>
  (await conta(sql`SELECT count(*) AS n FROM backfill_provenance WHERE fase = '06'`)) > 0;

test("fase 06: todo lead virou aquisição", async (t) => {
  if (!(await fase06Rodou())) return t.skip("backfill da fase 06 ainda não rodou");
  const perdidos = await conta(sql`
    SELECT count(*) AS n FROM leads l
    WHERE NOT EXISTS (SELECT 1 FROM backfill_provenance b
                      WHERE b.entidade_canonica = 'aquisicao' AND b.tabela_origem = 'leads' AND b.id_origem = l.id::text)`);
  assert.equal(perdidos, 0, `${perdidos} leads sem aquisição correspondente`);
});

test("fase 06: nenhuma aquisição sem empresa nem pessoa", async (t) => {
  if (!(await fase06Rodou())) return t.skip("backfill da fase 06 ainda não rodou");
  const invalidas = await conta(sql`SELECT count(*) AS n FROM aquisicoes WHERE empresa_id IS NULL AND pessoa_id IS NULL`);
  assert.equal(invalidas, 0, `${invalidas} aquisições sem identidade (a constraint deveria ter barrado)`);
});

test("fase 06: touchpoint aponta para aquisição existente", async (t) => {
  if (!(await fase06Rodou())) return t.skip("backfill da fase 06 ainda não rodou");
  const orfaos = await conta(sql`
    SELECT count(*) AS n FROM pontos_contato p
    WHERE p.aquisicao_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM aquisicoes a WHERE a.id = p.aquisicao_id)`);
  assert.equal(orfaos, 0, `${orfaos} touchpoints órfãos`);
});

test("fase 06: atribuição não foi inventada", async (t) => {
  if (!(await fase06Rodou())) return t.skip("backfill da fase 06 ainda não rodou");
  // Todo touchpoint criado pelo backfill tem que ter pelo menos um sinal real
  // vindo do lead de origem. Linha de atribuição vazia é ruído que polui
  // relatório de campanha.
  // A lista tem que cobrir TODOS os sinais que o backfill considera, senão o
  // teste acusa touchpoint legítimo. Foi o que aconteceu na primeira versão:
  // 87 linhas com utm_term e utm_content foram marcadas como vazias porque o
  // teste só olhava oito dos treze campos.
  const vazios = await conta(sql`
    SELECT count(*) AS n FROM pontos_contato
    WHERE lead_id_legado IS NOT NULL
      AND coalesce(source,'') = '' AND coalesce(medium,'') = '' AND coalesce(campaign,'') = ''
      AND coalesce(term,'') = '' AND coalesce(content,'') = ''
      AND coalesce(landing_page,'') = '' AND coalesce(referrer,'') = ''
      AND gclid IS NULL AND fbclid IS NULL AND fbc IS NULL AND fbp IS NULL
      AND campaign_id IS NULL AND adset_id IS NULL AND ad_id IS NULL`);
  assert.equal(vazios, 0, `${vazios} touchpoints sem nenhum sinal de atribuição`);
});

const fase07Rodou = async () =>
  (await conta(sql`SELECT count(*) AS n FROM backfill_provenance WHERE fase = '07'`)) > 0;

test("fase 07: família nunca foi chutada", async (t) => {
  if (!(await fase07Rodou())) return t.skip("backfill da fase 07 ainda não rodou");
  // Toda oportunidade COM família tem que ter um método de evidência no
  // provenance. Se aparecer família com método NAO_RESOLVIDO, alguém preencheu
  // por palpite, que é o que o SPEC §42 proíbe.
  const chutes = await conta(sql`
    SELECT count(*) AS n FROM oportunidades o
    JOIN backfill_provenance b ON b.entidade_canonica = 'oportunidade' AND b.id_canonico = o.id
    WHERE o.service_family IS NOT NULL AND b.metodo = 'NAO_RESOLVIDO'`);
  assert.equal(chutes, 0, `${chutes} oportunidades com família preenchida sem evidência`);
});

test("fase 07: toda oportunidade sem família tem caso de reconciliação", async (t) => {
  if (!(await fase07Rodou())) return t.skip("backfill da fase 07 ainda não rodou");
  const semCaso = await conta(sql`
    SELECT count(*) AS n FROM oportunidades o
    WHERE o.service_family IS NULL
      AND NOT EXISTS (SELECT 1 FROM reconciliacao_casos c
                      WHERE c.fase = '07' AND c.entidade_alvo = 'oportunidade:' || o.id)`);
  assert.equal(semCaso, 0, `${semCaso} oportunidades sem família e sem caso: ambiguidade escondida`);
});

test("fase 07: nenhuma oportunidade guarda UNKNOWN como se fosse família", async (t) => {
  if (!(await fase07Rodou())) return t.skip("backfill da fase 07 ainda não rodou");
  const unknown = await conta(sql`SELECT count(*) AS n FROM oportunidades WHERE service_family = 'UNKNOWN'`);
  assert.equal(unknown, 0, `${unknown} oportunidades com 'UNKNOWN' gravado: NULL e UNKNOWN não são a mesma coisa`);
});

test("fase 07: etapa de pipeline tem fechamento declarado", async (t) => {
  if (!(await fase07Rodou())) return t.skip("backfill da fase 07 ainda não rodou");
  const invalidas = await conta(sql`
    SELECT count(*) AS n FROM pipeline_etapas
    WHERE tipo_fechamento NOT IN ('OPEN','WON','LOST','DISQUALIFIED')`);
  assert.equal(invalidas, 0, `${invalidas} etapas com fechamento fora do vocabulário`);
});

test("fase 07: ganho e perda não coexistem na mesma oportunidade", async (t) => {
  if (!(await fase07Rodou())) return t.skip("backfill da fase 07 ainda não rodou");
  const ambas = await conta(sql`SELECT count(*) AS n FROM oportunidades WHERE ganho_at IS NOT NULL AND perdido_at IS NOT NULL`);
  assert.equal(ambas, 0, `${ambas} oportunidades marcadas como ganhas E perdidas`);
});

test("coluna de negócio não guarda marcador de carga", async () => {
  // O backfill 07 gravou 'BACKFILL_07' em `oportunidades.source_process`, que é
  // a coluna que a tela mostra como "Origem". No card o rótulo caía no default
  // e mostrava "—"; na página da oportunidade o valor era exibido cru, então
  // lia-se "Origem: BACKFILL_07" em 1.560 de 1.561 registros — enquanto 1.497
  // delas tinham a origem de verdade (PRE_SALES) no negócio legado.
  //
  // Proveniência tem tabela própria (`backfill_provenance`, com as 1.561
  // linhas da fase 07). Marcador de carga em coluna de produto é processo
  // interno ocupando campo de negócio.
  const [r] = await db.execute<{ n: number }>(sql`
    SELECT (
      (SELECT count(*) FROM oportunidades WHERE source_process LIKE 'BACKFILL%')
    + (SELECT count(*) FROM oportunidades WHERE service_family LIKE 'BACKFILL%')
    + (SELECT count(*) FROM aquisicoes WHERE origem LIKE 'BACKFILL%')
    + (SELECT count(*) FROM aquisicoes WHERE tipo LIKE 'BACKFILL%'))::int AS n`);
  assert.equal(r?.n ?? 0, 0,
    "coluna de negócio com marcador de backfill: a proveniência vai em backfill_provenance");
});

test("a proveniência do backfill continua registrada", async () => {
  // O contraponto do teste acima: tirar o marcador da coluna de negócio não
  // pode significar perder de onde o registro veio.
  const [r] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM backfill_provenance
     WHERE fase = '07' AND entidade_canonica = 'oportunidade'`);
  assert.ok((r?.n ?? 0) > 1500,
    `a proveniência da fase 07 deveria cobrir as oportunidades migradas (tem ${r?.n})`);
});

