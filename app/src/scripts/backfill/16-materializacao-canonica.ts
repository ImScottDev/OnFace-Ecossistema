/**
 * Backfill 16 — materializa no canônico o que as migrations 0081, 0084 e 0085
 * só conseguem materializar quando o canônico JÁ existe.
 *
 * O PROBLEMA QUE ISTO RESOLVE, medido no ensaio com dump fresco de 21/09:
 *
 * Aquelas três migrations carregam um UPDATE de materialização junto da
 * mudança de schema. No banco de dev isso funcionou, porque lá `aquisicoes` e
 * `oportunidades` já estavam populadas quando elas rodaram. Numa produção
 * virgem a ordem é outra: a cadeia de migrations roda ANTES dos backfills, as
 * duas tabelas ainda estão vazias, e o UPDATE toca zero linhas. Depois os
 * backfills criam as linhas — sem etapa, sem estagnação e sem trial.
 *
 *     3.991 aquisições com etapa_id NULL
 *         0 estagnações canônicas, contra 229 no legado
 *         0 trials canônicos, contra 17 no legado
 *
 * A correção NÃO é apagar o fallback de leitura: a derivação continua viva
 * como fallback, de propósito. A correção é este passo, que roda DEPOIS dos
 * backfills e é independente da ordem em que o banco foi construído.
 *
 * IDEMPOTENTE por desenho: cada bloco só toca linha cujo destino ainda está
 * NULL. Rodar num banco onde as migrations já fizeram o trabalho encontra zero
 * linhas e não reescreve nada — inclusive não sobrescreve etapa que alguém
 * moveu na tela depois.
 *
 *     pnpm tsx --env-file=.env src/scripts/backfill/16-materializacao-canonica.ts
 *     pnpm tsx --env-file=.env src/scripts/backfill/16-materializacao-canonica.ts --aplicar
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

const APLICAR = process.argv.includes("--aplicar");

async function conta(q: unknown): Promise<number> {
  const r = await db.execute<{ n: number }>(q as never);
  return Number(r[0]?.n ?? 0);
}

async function main() {
  console.log(`\n  BACKFILL 16 — materialização canônica ${APLICAR ? "(APLICANDO)" : "(dry-run)"}\n`);

  // ── 0. Vínculo com o lead legado (0069) ─────────────────────────────────
  // PRIMEIRO, porque o cálculo da etapa depende dele: o refinamento de
  // "qualificacao" lê leads.estagio_pre_vendas pelo lead_legado_id.
  //
  // A 0069 preenche esta coluna a partir de backfill_provenance. Numa produção
  // virgem a provenance ainda não existe quando a migration roda, então ela
  // toca zero linhas — e as 3.991 aquisições nascem sem vínculo com o lead.
  // O board então cai no id da aquisição como id do card, e abrir o detalhe do
  // lead deixa de funcionar. Medido no ensaio com dump fresco: 3.991 de 3.991.
  const semVinculo = await conta(sql`
    SELECT count(*)::int AS n FROM aquisicoes a
     WHERE a.lead_legado_id IS NULL
       AND EXISTS (SELECT 1 FROM backfill_provenance bp
                    WHERE bp.entidade_canonica = 'aquisicao' AND bp.tabela_origem = 'leads'
                      AND bp.id_canonico = a.id)`);
  console.log(`  0. aquisições sem vínculo com o lead ..... ${semVinculo}`);

  if (APLICAR && semVinculo > 0) {
    await db.execute(sql`
      UPDATE aquisicoes a
         SET lead_legado_id = bp.id_origem::uuid, updated_at = a.updated_at
        FROM backfill_provenance bp
       WHERE bp.entidade_canonica = 'aquisicao'
         AND bp.tabela_origem = 'leads'
         AND bp.id_canonico = a.id
         AND a.lead_legado_id IS NULL`);
  }

  // ── 1. Etapa da aquisição (0081) ────────────────────────────────────────
  // A MESMA expressão da migration e do board: etapa gravada quando existe,
  // derivação dos fatos quando não. Duas cópias divergiriam em silêncio, então
  // a ordem das condições aqui é conferida por teste contra o arquivo da 0081.
  const semEtapa = await conta(sql`
    SELECT count(*)::int AS n FROM aquisicoes WHERE etapa_id IS NULL`);
  console.log(`  1. aquisições sem etapa canônica ......... ${semEtapa}`);

  if (APLICAR && semEtapa > 0) {
    const r = await db.execute<{ codigo: string; n: number }>(sql`
      WITH etapa_calculada AS (
        SELECT a.id AS aquisicao_id,
               CASE
                 WHEN a.desqualificado_em IS NOT NULL THEN 'desqualificado'
                 WHEN COALESCE(a.nutricao_status, '') <> '' THEN 'nutricao'
                 WHEN EXISTS (SELECT 1 FROM oportunidades o
                               WHERE o.organizacao_id = a.organizacao_id
                                 AND (o.pessoa_id = a.pessoa_id OR o.empresa_id = a.empresa_id)
                                 AND o.ganho_at IS NULL AND o.perdido_at IS NULL) THEN 'oportunidade'
                 WHEN a.qualificado THEN 'qualificado'
                 WHEN l.estagio_pre_vendas = 'qualificacao' THEN 'qualificacao'
                 WHEN a.last_touch_at IS NOT NULL AND a.first_touch_at IS NOT NULL
                      AND a.last_touch_at > a.first_touch_at THEN 'em_contato'
                 ELSE 'novo'
               END AS codigo
          FROM aquisicoes a
          LEFT JOIN leads l ON l.id = a.lead_legado_id
         WHERE a.etapa_id IS NULL
      ), aplicado AS (
        UPDATE aquisicoes a
           SET pipeline_id = p.id, etapa_id = pe.id, updated_at = a.updated_at
          FROM etapa_calculada ec
          JOIN pipelines p ON p.slug = 'aquisicao'
          JOIN pipeline_etapas pe ON pe.pipeline_id = p.id AND pe.codigo = ec.codigo
         WHERE a.id = ec.aquisicao_id AND p.organizacao_id = a.organizacao_id
        RETURNING pe.codigo
      )
      SELECT codigo, count(*)::int AS n FROM aplicado GROUP BY codigo ORDER BY 2 DESC`);
    for (const l of r) console.log(`       ${String(l.codigo).padEnd(16)} ${l.n}`);
  }

  // ── 2. Estagnação (0084) ────────────────────────────────────────────────
  const estagnacaoPendente = await conta(sql`
    SELECT count(*)::int AS n FROM oportunidades o JOIN negocios n ON n.id = o.negocio_id_legado
     WHERE n.motivo_estagnacao IS NOT NULL AND o.motivo_estagnacao IS NULL
       AND o.ganho_at IS NULL AND o.perdido_at IS NULL`);
  console.log(`  2. estagnações a materializar ............ ${estagnacaoPendente}`);

  if (APLICAR && estagnacaoPendente > 0) {
    await db.execute(sql`
      UPDATE oportunidades o
         SET motivo_estagnacao = n.motivo_estagnacao,
             estagnado_em = n.estagnado_em,
             updated_at = o.updated_at
        FROM negocios n
       WHERE o.negocio_id_legado = n.id
         AND n.motivo_estagnacao IS NOT NULL
         AND o.ganho_at IS NULL AND o.perdido_at IS NULL
         AND o.motivo_estagnacao IS NULL`);
  }

  // ── 3. Trial (0085) ─────────────────────────────────────────────────────
  const trialPendente = await conta(sql`
    SELECT count(*)::int AS n FROM oportunidades o JOIN negocios n ON n.id = o.negocio_id_legado
     WHERE n.trial_iniciado_em IS NOT NULL AND o.trial_iniciado_em IS NULL`);
  console.log(`  3. trials a materializar ................. ${trialPendente}`);

  if (APLICAR && trialPendente > 0) {
    await db.execute(sql`
      UPDATE oportunidades o
         SET trial_iniciado_em = n.trial_iniciado_em,
             trial_encerrado_em = n.trial_encerrado_em,
             updated_at = o.updated_at
        FROM negocios n
       WHERE o.negocio_id_legado = n.id
         AND n.trial_iniciado_em IS NOT NULL
         AND o.trial_iniciado_em IS NULL`);
  }

  // ── 4. Capacidade de trial da oferta (0083) ─────────────────────────────
  //
  // Mesma família dos blocos acima, e a que tinha passado despercebida. A 0083
  // liga permite_trial nas ofertas CALLFACE_AI lendo os pipelines já
  // configurados, mas roda na cadeia de migrations, quando ofertas_comerciais
  // ainda está VAZIA: o backfill 08 é que a cria. O UPDATE toca zero linhas e
  // as quatro ofertas nascem com o default false.
  //
  // O efeito medido em 23/09: nenhuma oferta permitia trial, e iniciarTrial
  // recusava com trial_exige_oferta toda oportunidade Callface AI — inclusive
  // as certas. O legado tem 19 negócios em trial e o canônico preservou os 19,
  // então a operação usa trial de verdade; só a capacidade tinha sumido.
  //
  // A condição é a mesma da migration, sem palpite: a oferta entra se o
  // pipeline da família tem a etapa trial. Hoje "Callface AI" tem, "PABX" não.
  const trialSemCapacidade = await conta(sql`
    SELECT count(*)::int AS n FROM ofertas_comerciais oc
     WHERE oc.codigo LIKE 'CALLFACE_AI%' AND oc.ativo AND oc.permite_trial = false
       AND EXISTS (
         SELECT 1 FROM pipelines p
           JOIN pipeline_etapas pe ON pe.pipeline_id = p.id AND pe.codigo = 'trial'
          WHERE p.organizacao_id = oc.organizacao_id AND p.nome = 'Callface AI')`);
  console.log(`  4. ofertas sem a capacidade de trial ..... ${trialSemCapacidade}`);

  if (APLICAR && trialSemCapacidade > 0) {
    await db.execute(sql`
      UPDATE ofertas_comerciais oc
         SET permite_trial = true, updated_at = oc.updated_at
       WHERE oc.codigo LIKE 'CALLFACE_AI%' AND oc.ativo AND oc.permite_trial = false
         AND EXISTS (
           SELECT 1 FROM pipelines p
             JOIN pipeline_etapas pe ON pe.pipeline_id = p.id AND pe.codigo = 'trial'
            WHERE p.organizacao_id = oc.organizacao_id AND p.nome = 'Callface AI')`);
  }

  // ── 5. Etapa da oportunidade ────────────────────────────────────────────
  //
  // Décimo caso do mesmo padrão. O backfill 07 grava `etapa` como TEXTO
  // ('entrada', 'proposta', 'ganho'…) e deixa `etapa_id` nulo. A etapa canônica
  // mora em `pipeline_etapas` (SPEC §8.2), igual à da aquisição, e o teste
  // `cobertura.test.ts` cobra exatamente isso.
  //
  // Medido em 23/09 com produção carregada: 6 de 1.577 oportunidades com
  // `etapa_id`. As etapas existem nos pipelines Callface AI e PABX com os
  // mesmos códigos — só faltava ligar.
  //
  // Casa por pipeline_id + codigo, nunca por codigo sozinho: 'ganho' existe nos
  // dois pipelines, e ignorar o pipeline apontaria metade das oportunidades
  // para a etapa da família errada.
  const oportunidadeSemEtapa = await conta(sql`
    SELECT count(*)::int AS n FROM oportunidades o
     WHERE o.etapa_id IS NULL AND o.etapa IS NOT NULL AND o.pipeline_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM pipeline_etapas pe
                    WHERE pe.pipeline_id = o.pipeline_id AND pe.codigo = o.etapa)`);
  console.log(`  5. oportunidades sem etapa canônica ..... ${oportunidadeSemEtapa}`);

  if (APLICAR && oportunidadeSemEtapa > 0) {
    await db.execute(sql`
      UPDATE oportunidades o
         SET etapa_id = pe.id, updated_at = o.updated_at
        FROM pipeline_etapas pe
       WHERE pe.pipeline_id = o.pipeline_id AND pe.codigo = o.etapa
         AND o.etapa_id IS NULL`);
  }

  // Oportunidade SEM pipeline: a família diz qual é.
  //
  // Quatro oportunidades chegaram do legado sem `pipeline_id` (3 com
  // service_family CALLFACE_AI, 1 sem família nenhuma). Sem pipeline não há
  // como escolher entre a etapa 'ganho' do Callface AI e a do PABX — são duas
  // linhas distintas com o mesmo código.
  //
  // A família resolve três delas. A quarta, sem família, fica sem etapa de
  // propósito: o SPEC §42 proíbe inventar, e um pipeline chutado é pior que um
  // campo vazio que a tela sabe representar.
  const semPipeline = await conta(sql`
    SELECT count(*)::int AS n FROM oportunidades
     WHERE etapa_id IS NULL AND pipeline_id IS NULL AND service_family IS NOT NULL`);
  console.log(`  5b. oportunidades sem pipeline, com família ${semPipeline}`);

  if (APLICAR && semPipeline > 0) {
    await db.execute(sql`
      UPDATE oportunidades o
         SET pipeline_id = pe.pipeline_id, etapa_id = pe.id, updated_at = o.updated_at
        FROM pipeline_etapas pe
        JOIN pipelines p ON p.id = pe.pipeline_id AND p.tipo = 'SALES'
       WHERE o.etapa_id IS NULL AND o.pipeline_id IS NULL
         AND o.service_family IS NOT NULL
         AND pe.codigo = o.etapa
         AND upper(replace(p.nome, ' ', '_')) = upper(o.service_family)`);
  }

  // ── 6. Setup da oportunidade (0073) ─────────────────────────────────────
  //
  // Mesmo padrão: a migration 0073 criou `setup_estimado` para separar receita
  // de implantação da recorrente, e o backfill 07 nunca preencheu a coluna.
  //
  // Efeito medido em 23/09: o relatório de ganhos mostrava R$ 0,00 de setup
  // contra R$ 76.628,87 no legado — receita de implantação simplesmente sumia
  // da leitura canônica. O `cobertura.test.ts` cobra a paridade e pegou.
  const semSetup = await conta(sql`
    SELECT count(*)::int AS n FROM oportunidades o
      JOIN negocios n ON n.id = o.negocio_id_legado
     WHERE o.setup_estimado IS NULL AND n.valor_setup IS NOT NULL AND n.valor_setup <> 0`);
  console.log(`  6. oportunidades sem setup materializado  ${semSetup}`);

  if (APLICAR && semSetup > 0) {
    await db.execute(sql`
      UPDATE oportunidades o
         SET setup_estimado = n.valor_setup, updated_at = o.updated_at
        FROM negocios n
       WHERE n.id = o.negocio_id_legado
         AND o.setup_estimado IS NULL AND n.valor_setup IS NOT NULL AND n.valor_setup <> 0`);
  }
  // ── Reconciliação: o legado e o canônico têm que bater ──────────────────
  console.log(`\n  RECONCILIAÇÃO\n`);
  const linhas = await db.execute<{ o_que: string; legado: number; canonico: number }>(sql`
    SELECT 'aquisições sem vínculo' AS o_que, 0 AS legado,
           (SELECT count(*)::int FROM aquisicoes a WHERE a.lead_legado_id IS NULL
             AND EXISTS (SELECT 1 FROM backfill_provenance bp
                          WHERE bp.entidade_canonica = 'aquisicao' AND bp.tabela_origem = 'leads'
                            AND bp.id_canonico = a.id)) AS canonico
    UNION ALL
    SELECT 'aquisições sem etapa', 0,
           (SELECT count(*)::int FROM aquisicoes WHERE etapa_id IS NULL)
    UNION ALL
    SELECT 'estagnações',
           (SELECT count(*)::int FROM negocios WHERE motivo_estagnacao IS NOT NULL),
           (SELECT count(*)::int FROM oportunidades WHERE motivo_estagnacao IS NOT NULL)
    UNION ALL
    SELECT 'trials',
           (SELECT count(*)::int FROM negocios WHERE trial_iniciado_em IS NOT NULL),
           (SELECT count(*)::int FROM oportunidades WHERE trial_iniciado_em IS NOT NULL)`);
  let divergencias = 0;
  for (const l of linhas) {
    const bate = l.o_que.startsWith("aquisições sem") ? l.canonico === 0 : l.legado === l.canonico;
    if (!bate) divergencias++;
    console.log(`  ${bate ? "ok   " : "FALHA"} ${l.o_que.padEnd(24)} legado ${String(l.legado).padStart(5)}  canônico ${String(l.canonico).padStart(5)}`);
  }

  // Estagnação em oportunidade FECHADA não é divergência: a migration e este
  // passo só materializam as abertas, porque o motivo descrevia uma parada que
  // o fechamento já resolveu.
  const fechadasComEstagnacao = await conta(sql`
    SELECT count(*)::int AS n FROM negocios n JOIN oportunidades o ON o.negocio_id_legado = n.id
     WHERE n.motivo_estagnacao IS NOT NULL AND (o.ganho_at IS NOT NULL OR o.perdido_at IS NOT NULL)`);
  if (fechadasComEstagnacao > 0) {
    console.log(`\n  nota: ${fechadasComEstagnacao} estagnação(ões) em oportunidade já fechada ficam de fora, de propósito.`);
  }

  if (!APLICAR) console.log(`\n  dry-run. Use --aplicar para escrever.`);
  process.exit(divergencias > 0 && APLICAR ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
