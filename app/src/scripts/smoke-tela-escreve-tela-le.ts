/**
 * Fase 25: a tela não pode ler canônico e escrever legado como duas verdades.
 *
 * Pergunta única: **depois de a tela executar a ação, a mesma tela mostra o
 * resultado?** É a pergunta que board e detalhe respondem separado, e que
 * nenhum teste fazia — porque teste de escrita confere a escrita, e teste de
 * leitura confere a leitura.
 *
 * Percorre as ações do board de pré-vendas e do pipeline pela MESMA função que
 * a server action chama, e relê pela MESMA consulta que a página usa.
 *
 *     pnpm tsx --env-file=.env src/scripts/smoke-tela-escreve-tela-le.ts
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { criarLead, moverEtapa, nutrir, qualificar } from "@/lib/vendas/pre-vendas";
import { criarOportunidadeDoLead, definirProximaAcao, iniciarTrial, encerrarTrial, marcarEstagnacao } from "@/lib/vendas/pipeline";
import { boardPreVendas, detalheLead, detalheOportunidade } from "@/lib/vendas/consultas";
import { atorHumano } from "@/lib/vendas/dominio";
import { negociosRoutes } from "@/api-server/routes/negocios";
import { sessaoDeSmoke } from "./_sessao-de-smoke";

const ok = (cond: unknown, msg: string) => {
  console.log(`${cond ? "  ok    " : "  FALHA "}${msg}`);
  if (!cond) process.exitCode = 1;
};

const PREFIXO = "smoke-duas-verdades-%";
const marca = `smoke-duas-verdades-${Date.now()}`;
let leadId: string | null = null;
let negocioId: string | null = null;

async function limpar() {
  if (!leadId) return;
  // A ordem é a das chaves estrangeiras: quem aponta morre antes de quem é
  // apontado. Uma rodada que falhava no meio deixava ponto de contato preso na
  // pessoa, a pessoa presa na empresa, e a limpeza seguinte não via nada disso
  // porque filtrava pela marca da rodada, não pelo prefixo.
  const dasMinhas = sql`(SELECT id FROM pessoas WHERE nome LIKE ${PREFIXO})`;
  const empresasMinhas = sql`(SELECT id FROM empresas WHERE nome LIKE ${PREFIXO})`;
  for (const q of [
    sql`DELETE FROM reunioes WHERE negocio_id = ${negocioId ?? null}::uuid OR titulo LIKE ${PREFIXO}`,
    sql`DELETE FROM tarefas WHERE lead_id = ${leadId}::uuid OR negocio_id = ${negocioId ?? null}::uuid`,
    sql`DELETE FROM comercial_evidencia WHERE negocio_id = ${negocioId ?? null}::uuid`,
    sql`DELETE FROM vendas_eventos WHERE lead_id = ${leadId}::uuid OR negocio_id = ${negocioId ?? null}::uuid`,
    sql`DELETE FROM atividades WHERE lead_id = ${leadId}::uuid OR negocio_id = ${negocioId ?? null}::uuid`,
    sql`DELETE FROM status_changes WHERE lead_id = ${leadId}::uuid`,
    sql`DELETE FROM timeline_events WHERE aquisicao_id IN (SELECT id FROM aquisicoes WHERE lead_legado_id = ${leadId}::uuid)
         OR pessoa_id IN ${dasMinhas} OR empresa_id IN ${empresasMinhas}`,
    sql`DELETE FROM pontos_contato WHERE lead_id_legado = ${leadId}::uuid
         OR pessoa_id IN ${dasMinhas} OR empresa_id IN ${empresasMinhas}`,
    sql`DELETE FROM oportunidades WHERE negocio_id_legado = ${negocioId ?? null}::uuid
         OR lead_id = ${leadId}::uuid OR empresa_id IN ${empresasMinhas}`,
    sql`DELETE FROM negocios WHERE id = ${negocioId ?? null}::uuid OR lead_id = ${leadId}::uuid
         OR empresa_id IN ${empresasMinhas}`,
    sql`DELETE FROM aquisicoes WHERE lead_legado_id = ${leadId}::uuid
         OR pessoa_id IN ${dasMinhas} OR empresa_id IN ${empresasMinhas}`,
    sql`DELETE FROM event_outbox WHERE payload ->> 'lead_legado_id' = ${leadId}`,
    sql`DELETE FROM domain_events WHERE payload ->> 'lead_legado_id' = ${leadId}`,
    sql`DELETE FROM pessoa_empresa_vinculos WHERE pessoa_id IN ${dasMinhas} OR empresa_id IN ${empresasMinhas}`,
    sql`DELETE FROM pessoas WHERE lead_id_legado = ${leadId}::uuid OR nome LIKE ${PREFIXO}`,
    sql`DELETE FROM leads WHERE id = ${leadId}::uuid OR nome LIKE ${PREFIXO}`,
    sql`DELETE FROM empresas WHERE nome LIKE ${PREFIXO}`,
  ]) await db.execute(q).catch(() => undefined);
  await db.execute(sql`
    DELETE FROM backfill_provenance bp WHERE bp.metodo = 'PONTE_CUTOVER'
      AND bp.entidade_canonica = 'aquisicao'
      AND NOT EXISTS (SELECT 1 FROM aquisicoes a WHERE a.id = bp.id_canonico)`).catch(() => undefined);
}

/** A etapa que o board da TELA mostra para este lead, não a do banco. */
async function etapaNoBoard(orgId: string): Promise<string | null> {
  const board = await boardPreVendas(orgId, { aba: "ativos" });
  const card = Object.values(board.colunas).flatMap((c) => c.cards).find((c) => c.leadId === leadId);
  return card?.etapa ?? null;
}

async function main() {
  const [org] = await db.execute<{ id: string }>(sql`SELECT id::text FROM organizacoes LIMIT 1`);
  const [u] = await db.execute<{ id: string }>(sql`SELECT id::text FROM usuarios WHERE ativo = true LIMIT 1`);
  const ator = atorHumano(u.id);

  const criado = await criarLead({
    organizacaoId: org.id,
    empresa: { nome: `${marca} Ltda` },
    pessoa: { nome: marca, email: `${marca}@teste.local` },
    touchpoint: { tipoOrigem: "organica", source: "smoke" },
    origem: "site", responsavelId: u.id,
  } as never, { tipo: "HUMAN", usuarioId: u.id });
  leadId = criado.leadId;

  console.log("\n═══ board de pré-vendas: mover o card ═══");
  ok(await etapaNoBoard(org.id) === "novo", "o lead nasce em Novo no board");

  await moverEtapa({ organizacaoId: org.id, leadId: leadId!, para: "em_contato", ator });
  const b1 = await etapaNoBoard(org.id);
  ok(b1 === "em_contato", `mover para Em contato move o card no board (board diz "${b1}")`);
  const d1 = await detalheLead(org.id, leadId!);
  ok(d1?.etapa === "em_contato", `e o detalhe concorda (detalhe diz "${d1?.etapa}")`);

  await moverEtapa({ organizacaoId: org.id, leadId: leadId!, para: "qualificacao", ator });
  const b2 = await etapaNoBoard(org.id);
  ok(b2 === "qualificacao", `mover para Qualificação move o card (board diz "${b2}")`);

  await moverEtapa({ organizacaoId: org.id, leadId: leadId!, para: "novo", ator });
  const b3 = await etapaNoBoard(org.id);
  ok(b3 === "novo", `voltar para Novo volta o card (board diz "${b3}")`);

  console.log("\n═══ nutrição: ida e volta ═══");
  await nutrir({
    organizacaoId: org.id, leadId: leadId!, motivo: "sem_orcamento",
    retomarEm: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10), observacao: null, ator,
  });
  const nutridos = await boardPreVendas(org.id, { aba: "nutricao" });
  ok(Object.values(nutridos.colunas).flatMap((c) => c.cards).some((c) => c.leadId === leadId),
     "nutrir leva o card para a aba Nutrição");
  ok(await etapaNoBoard(org.id) === null, "e tira dos ativos");

  await moverEtapa({ organizacaoId: org.id, leadId: leadId!, para: "em_contato", ator, motivo: "Lead retomado" });
  const b4 = await etapaNoBoard(org.id);
  ok(b4 === "em_contato", `reativar devolve o card para Em contato (board diz "${b4}")`);

  console.log("\n═══ oportunidade: próxima ação ═══");
  // Qualificar antes: criar oportunidade exige lead qualificado.
  await qualificar({ organizacaoId: org.id, leadId: leadId!, ator });
  const op = await criarOportunidadeDoLead({
    organizacaoId: org.id, leadId: leadId!, familias: ["CALLFACE_AI"],
    responsavelId: u.id, titulo: `${marca} op`, ator,
  });
  negocioId = op.oportunidades[0]?.id ?? null;
  ok(Boolean(negocioId), "a oportunidade é criada pela tela");

  if (negocioId) {
    const quando = new Date(Date.now() + 86_400_000).toISOString();
    await definirProximaAcao({
      organizacaoId: org.id, negocioId, descricao: "Ligar para o decisor",
      quando, ator,
    });
    const det = await detalheOportunidade(org.id, negocioId);
    ok(det?.proximaAcao.descricao === "Ligar para o decisor",
       `o detalhe mostra a próxima ação ("${det?.proximaAcao.descricao ?? "nada"}")`);
    ok(!det?.badges.includes("Sem próxima ação"),
       `e o selo "Sem próxima ação" some (selos: ${det?.badges.join(", ") || "nenhum"})`);

    // Next Action = Task (§23). A próxima ação precisa existir como tarefa, que
    // é onde o resto do produto a enxerga: fila do vendedor, CS, relatório.
    const [t] = await db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM tarefas
       WHERE negocio_id = ${negocioId}::uuid AND status IN ('a_fazer','em_andamento','aguardando')`);
    ok(t.n === 1, `a próxima ação existe como tarefa canônica (${t.n})`);
  }


  console.log("\n═══ no-show: estado da reunião, não perda do negócio ═══");
  if (negocioId) {
    const sessao = await sessaoDeSmoke();
    const [r] = await db.execute<{ id: string }>(sql`
      INSERT INTO reunioes (organizacao_id, negocio_id, lead_id, titulo, data, status, responsavel_id)
      VALUES (${org.id}::uuid, ${negocioId}::uuid, ${leadId}::uuid, ${marca + " reunião"},
              now() - interval '1 hour', 'agendada', ${u.id}::uuid)
      RETURNING id::text`);

    const resp = await negociosRoutes.request(`http://local/negocios/${negocioId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: sessao.cookie },
      body: JSON.stringify({ status: "no_show" }),
    });
    ok(resp.status === 200, `a rota aceita o no-show (HTTP ${resp.status})`);

    const [depois] = await db.execute<{ status: string }>(sql`
      SELECT status FROM reunioes WHERE id = ${r.id}::uuid`);
    ok(depois?.status === "no_show", `a reunião passa a no-show (status "${depois?.status}")`);

    const [neg] = await db.execute<{ etapa: string; perdido: string | null }>(sql`
      SELECT n.etapa, o.perdido_at::text AS perdido FROM negocios n
        LEFT JOIN oportunidades o ON o.negocio_id_legado = n.id
       WHERE n.id = ${negocioId}::uuid`);
    ok(neg?.etapa !== "perdido" && !neg?.perdido,
       `e o negócio NÃO vira perdido (etapa "${neg?.etapa}")`);

    const det = await detalheOportunidade(org.id, negocioId);
    ok(det?.badges.includes("No-show"), `o detalhe mostra o selo No-show (${det?.badges.join(", ") || "nenhum"})`);
    ok(Boolean(det?.noShow.em), "e a data do no-show vem da reunião");
  }


  console.log("\n═══ trial: capacidade da oferta, não botão livre ═══");
  if (negocioId) {
    // A oportunidade nasceu CALLFACE_AI, cuja oferta admite trial.
    await iniciarTrial({ organizacaoId: org.id, negocioId, ator });
    const comTrial = await detalheOportunidade(org.id, negocioId);
    ok(comTrial?.badges.includes("Trial ativo"), `Callface AI entra em trial (${comTrial?.badges.join(", ")})`);
    const [canon] = await db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM oportunidades
       WHERE negocio_id_legado = ${negocioId}::uuid AND trial_iniciado_em IS NOT NULL`);
    ok(canon.n === 1, `e o trial chega ao canônico (${canon.n})`);

    await encerrarTrial({ organizacaoId: org.id, negocioId, ator });
    const semTrial = await detalheOportunidade(org.id, negocioId);
    ok(!semTrial?.badges.includes("Trial ativo"), "encerrar tira o selo");

    // PABX é venda por contrato com implantação: a oferta não admite trial.
    await db.execute(sql`UPDATE negocios SET service_family = 'PABX' WHERE id = ${negocioId}::uuid`);
    await db.execute(sql`UPDATE oportunidades SET service_family = 'PABX', oferta_comercial_id = NULL
                          WHERE negocio_id_legado = ${negocioId}::uuid`);
    let recusou = "";
    await iniciarTrial({ organizacaoId: org.id, negocioId, ator })
      .catch((e: { message?: string }) => { recusou = e?.message ?? "erro"; });
    ok(recusou.includes("não admite"), `PABX é recusado ("${recusou || "aceitou"}")`);

    await db.execute(sql`UPDATE negocios SET service_family = NULL WHERE id = ${negocioId}::uuid`);
    await db.execute(sql`UPDATE oportunidades SET service_family = NULL WHERE negocio_id_legado = ${negocioId}::uuid`);
    let semFamilia = "";
    await iniciarTrial({ organizacaoId: org.id, negocioId, ator })
      .catch((e: { message?: string }) => { semFamilia = e?.message ?? "erro"; });
    ok(semFamilia.includes("família"), `sem família é recusado ("${semFamilia || "aceitou"}")`);
  }

  console.log("\n═══ estagnação: o canônico também sabe ═══");
  if (negocioId) {
    await marcarEstagnacao({ organizacaoId: org.id, negocioId, motivo: "sem_retorno", ator });
    const [canon] = await db.execute<{ motivo: string | null }>(sql`
      SELECT motivo_estagnacao AS motivo FROM oportunidades WHERE negocio_id_legado = ${negocioId}::uuid`);
    ok(canon?.motivo === "sem_retorno", `a estagnação chega ao canônico ("${canon?.motivo}")`);
    const det = await detalheOportunidade(org.id, negocioId);
    ok(det?.motivoEstagnacao === "sem_retorno", `e o detalhe mostra ("${det?.motivoEstagnacao}")`);
  }

  await limpar();
  const [resto] = await db.execute<{ n: number }>(sql`
    SELECT ((SELECT count(*) FROM leads WHERE nome LIKE 'smoke-duas-verdades-%')
          + (SELECT count(*) FROM empresas WHERE nome LIKE 'smoke-duas-verdades-%')
          + (SELECT count(*) FROM pessoas WHERE nome LIKE 'smoke-duas-verdades-%'))::int AS n`);
  ok(resto.n === 0, `o smoke não deixa resíduo (${resto.n})`);

  console.log(process.exitCode ? "\nescreve-e-lê: FALHOU\n" : "\nescreve-e-lê: ok\n");
}

main().catch(async (e) => {
  console.error(e);
  await limpar().catch(() => undefined);
  process.exitCode = 1;
}).finally(() => process.exit(process.exitCode ?? 0));
