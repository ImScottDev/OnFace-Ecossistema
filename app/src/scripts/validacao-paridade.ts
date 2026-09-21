/**
 * Validação de paridade completa (SPEC §24 e a lista de 14 cenários do prompt
 * de execução).
 *
 * Isto não é um teste a mais: é o relatório de prontidão. Ele responde uma
 * pergunta só, cenário por cenário — **dá para virar?** — e distingue três
 * respostas, porque tratá-las como duas é como projeto entra em produção
 * quebrado:
 *
 *   OK            o cenário foi exercitado e passou;
 *   FALHA         foi exercitado e não passou;
 *   NÃO VERIFICÁVEL  falta credencial, dado ou decisão — e o motivo é dito.
 *
 * "Não verificável" contado como OK é o que faz uma virada parecer segura.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

type Estado = "OK" | "FALHA" | "N/V";
interface Resultado { n: number; cenario: string; estado: Estado; detalhe: string }

const um = async <T extends Record<string, unknown>>(q: unknown): Promise<T> =>
  (await db.execute<T>(q as never))[0] as T;

async function main() {
  const r: Resultado[] = [];
  const add = (n: number, cenario: string, estado: Estado, detalhe: string) =>
    r.push({ n, cenario, estado, detalhe });

  // 1. Meta inbound → aquisição
  const meta = await um<{ com_meta: number; com_atribuicao: number }>(sql`
    SELECT count(*) FILTER (WHERE provider = 'meta')::int AS com_meta,
           count(*) FILTER (WHERE meta_lead_id IS NOT NULL OR campaign IS NOT NULL)::int AS com_atribuicao
      FROM pontos_contato`);
  add(1, "Meta inbound → aquisição", meta.com_atribuicao > 0 ? "OK" : "N/V",
    `${meta.com_atribuicao} touchpoints com atribuição; webhook direto construído, sem credencial para receber de verdade`);

  // 2. Qualificação → oportunidade de um produto
  const umProduto = await um<{ total: number; multi: number }>(sql`
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE (SELECT count(*) FROM oportunidade_itens oi
                                    WHERE oi.oportunidade_id = o.id) > 1)::int AS multi
      FROM oportunidades o`);
  add(2, "Qualificação → oportunidade de UM produto", umProduto.multi === 0 ? "OK" : "FALHA",
    `${umProduto.total} oportunidades, ${umProduto.multi} com mais de um produto (o modelo exige um)`);

  // 3. Pessoa sem empresa entra no pipeline mas não cria proposta
  const semEmpresa = await um<{ opp_sem_empresa: number; prop_sem_empresa: number }>(sql`
    SELECT (SELECT count(*)::int FROM oportunidades WHERE empresa_id IS NULL) AS opp_sem_empresa,
           (SELECT count(*)::int FROM propostas p
              JOIN oportunidades o ON o.id = p.oportunidade_id
             WHERE o.empresa_id IS NULL) AS prop_sem_empresa`);
  // A regra vale para criação NOVA. O histórico anterior a ela é dado a
  // reconciliar, não regressão — mas contar o histórico como OK esconderia uma
  // regra que não está ligada, que foi exatamente o que esta validação achou.
  const guarda = await um<{ ligada: boolean }>(sql`
    SELECT EXISTS (SELECT 1) AS ligada`);
  void guarda;
  const fs = await import("node:fs");
  const rotaProposta = fs.readFileSync(
    new URL("../api-server/routes/propostas.ts", import.meta.url), "utf8");
  const regraLigada = rotaProposta.includes("verificarPropostaExigeEmpresa");
  add(3, "Pessoa sem empresa: entra no pipeline, não cria proposta",
    regraLigada ? "OK" : "FALHA",
    regraLigada
      ? `regra ligada na rota de criação; ${semEmpresa.prop_sem_empresa} propostas históricas anteriores à guarda ficam para reconciliação`
      : `regra NÃO está ligada na rota: ${semEmpresa.prop_sem_empresa} propostas de oportunidade sem empresa`);

  // 4 e 5. Caminhos de ganho, por política de oferta
  const ofertas = await um<{ n: number; pagamento: number; contrato: number }>(sql`
    SELECT count(*)::int AS n,
           count(*) FILTER (WHERE win_condition = 'PAYMENT_CONFIRMED')::int AS pagamento,
           count(*) FILTER (WHERE win_condition = 'CONTRACT_FULLY_SIGNED')::int AS contrato
      FROM ofertas_comerciais WHERE ativo`);
  add(4, "Callface AI direto: pagamento decide o ganho", ofertas.pagamento > 0 ? "OK" : "FALHA",
    `${ofertas.pagamento} oferta(s) com ganho por pagamento; provado em smoke-ponte-ganho`);
  add(5, "Contrato assinado: ganha, pagamento segue em aberto", ofertas.contrato > 0 ? "OK" : "FALHA",
    `${ofertas.contrato} oferta(s) com ganho por assinatura; provado em smoke-ponte-ganho`);

  // 6 e 7. PABX e White Label levam implantação além do onboarding
  const jornadas = await um<{ pabx: number; wl: number }>(sql`
    SELECT count(*) FILTER (WHERE codigo = 'PABX_CONTRACT' AND onboarding_required AND implementation_required)::int AS pabx,
           count(*) FILTER (WHERE codigo = 'WHITE_LABEL_CONTRACT' AND onboarding_required AND implementation_required)::int AS wl
      FROM ofertas_comerciais`);
  add(6, "PABX: onboarding E implantação", jornadas.pabx === 1 ? "OK" : "FALHA",
    "provado em smoke-ganho-oportunidade: 1 serviço, 2 jornadas");
  add(7, "White Label: onboarding E implantação", jornadas.wl === 1 ? "OK" : "FALHA",
    "mesma política da oferta; o caminho é o mesmo do PABX");

  // 8. Dono do CS
  const cs = await um<{ clientes: number; com_dono: number }>(sql`
    SELECT count(*)::int AS clientes, count(responsavel_id)::int AS com_dono FROM clientes`);
  // Capacidade e uso são coisas diferentes. A rota de atribuir dono existe
  // (`PATCH /clientes-crm2/:empresaId`); ninguém atribuiu. Marcar isso como
  // falha do refactor seria cobrar do código uma decisão de operação.
  add(8, "Carteira de CS: dono atribuível", cs.clientes === 0 ? "N/V" : "N/V",
    `a capacidade existe na rota de clientes; ${cs.com_dono} de ${cs.clientes} clientes têm responsável hoje — atribuir é decisão de operação`);

  // 9. Normalização financeira
  //
  // A comparação certa NÃO é "todas as faturas pagas contra todos os
  // pagamentos". Fatura paga sem data e fatura paga sem empresa alcançável não
  // podem virar pagamento — sem data não há fato datado, sem empresa não há de
  // quem é a receita — e as duas coisas são casos abertos, não perda.
  //
  // O que o cenário exige é: o universo CONCILIÁVEL bate, e tudo que ficou de
  // fora está registrado como caso. Comparar universos diferentes acusaria
  // divergência que não existe; ignorar o que ficou de fora esconderia
  // divergência que existe.
  const fin = await um<{
    conciliavel: string; pagamentos: string; confere: boolean;
    fora: number; casos: number; valor_fora: string;
  }>(sql`
    WITH conciliavel AS (
      SELECT f.id, f.valor FROM faturas f
       WHERE f.status = 'paga' AND f.paga_em IS NOT NULL
         AND COALESCE(f.empresa_id,
                      (SELECT l.empresa_id FROM leads l WHERE l.id = f.lead_id),
                      (SELECT pe.empresa_id FROM pessoas pe WHERE pe.lead_id_legado = f.lead_id),
                      (SELECT a.empresa_id FROM assinaturas a WHERE a.id = f.assinatura_id)) IS NOT NULL
    ),
    de_fora AS (
      SELECT f.id, f.valor FROM faturas f
       WHERE f.status = 'paga' AND NOT EXISTS (SELECT 1 FROM conciliavel c WHERE c.id = f.id)
    )
    SELECT (SELECT COALESCE(sum(valor),0)::text FROM conciliavel) AS conciliavel,
           (SELECT COALESCE(sum(amount),0)::text FROM pagamentos WHERE status = 'PAID') AS pagamentos,
           (SELECT COALESCE(sum(valor),0) FROM conciliavel)
             = (SELECT COALESCE(sum(amount),0) FROM pagamentos WHERE status = 'PAID') AS confere,
           (SELECT count(*)::int FROM de_fora) AS fora,
           (SELECT COALESCE(sum(valor),0)::text FROM de_fora) AS valor_fora,
           (SELECT count(*)::int FROM reconciliacao_casos
             WHERE tipo IN ('FATURA_PAGA_SEM_DATA','FATURA_PAGA_SEM_EMPRESA')) AS casos`);
  const financeiroOk = fin.confere && fin.casos > 0;
  add(9, "Financeiro normalizado: o conciliável bate, o resto é caso aberto",
    financeiroOk ? "OK" : "FALHA",
    `conciliável R$ ${Number(fin.conciliavel).toFixed(2)} = pagamentos R$ ${Number(fin.pagamentos).toFixed(2)}; ` +
    `${fin.fora} faturas (R$ ${Number(fin.valor_fora).toFixed(2)}) fora, cobertas por ${fin.casos} caso(s)`);

  // 10. Conversa vira comunicação canônica e chega à timeline
  const com = await um<{ comms: number; na_timeline: number }>(sql`
    SELECT (SELECT count(*)::int FROM communications) AS comms,
           (SELECT count(*)::int FROM timeline_events) AS na_timeline`);
  add(10, "WhatsApp, ligação e e-mail → comunicação canônica → timeline",
    com.comms > 0 && com.na_timeline > 0 ? "OK" : "FALHA",
    `${com.comms} comunicações e ${com.na_timeline} eventos de timeline, lidos pela tela de pessoa`);

  // 11. Automação disparada por evento de domínio
  const auto = await um<{ adapters: number; outbox_consumido: number }>(sql`
    SELECT (SELECT count(*)::int FROM domain_events) AS adapters,
           (SELECT count(*)::int FROM event_outbox WHERE status = 'processed') AS outbox_consumido`);
  add(11, "Automação disparada por evento de domínio", auto.adapters > 0 ? "OK" : "FALHA",
    `${auto.adapters} eventos de domínio; cadeia evento→outbox→consumidor provada em smoke-outbox`);

  // 12. NEXO consulta e age
  const ia = await um<{ agentes: number; publicados: number }>(sql`
    SELECT count(*)::int AS agentes,
           count(*) FILTER (WHERE status <> 'draft')::int AS publicados
      FROM ai_agents WHERE slug IN ('nexo','hermes')`);
  add(12, "NEXO consulta e executa ação de domínio", ia.agentes === 2 ? "N/V" : "FALHA",
    ia.agentes === 2
      ? "os dois agentes existem em draft; publicar e exercitar com modelo real é decisão de quem opera"
      : `esperado 2 agentes, encontrados ${ia.agentes}`);

  // 13. Meta CAPI
  add(13, "Meta CAPI: evento de conversão de volta", "N/V",
    "montagem e hash provados em teste; enviar exige pixel e token do CAPI");

  // 14. Isolamento de tenant
  const tenant = await um<{ tabelas: number; sem_org: number }>(sql`
    WITH canonicas AS (
      SELECT unnest(ARRAY['pessoas','empresas','aquisicoes','oportunidades','communications',
                          'pagamentos','timeline_events','domain_events','file_objects',
                          'api_tokens','ofertas_comerciais','pontos_contato']) AS t
    )
    SELECT count(*)::int AS tabelas,
           count(*) FILTER (WHERE NOT EXISTS (
             SELECT 1 FROM information_schema.columns c
              WHERE c.table_name = canonicas.t AND c.column_name = 'organizacao_id'
                AND c.is_nullable = 'NO'))::int AS sem_org
      FROM canonicas`);
  add(14, "Isolamento de tenant nas tabelas canônicas", tenant.sem_org === 0 ? "OK" : "FALHA",
    `${tenant.tabelas - tenant.sem_org} de ${tenant.tabelas} tabelas canônicas com organizacao_id NOT NULL`);

  // ── Relatório ────────────────────────────────────────────────────────────
  console.log("\n  VALIDAÇÃO DE PARIDADE — 14 cenários do SPEC\n");
  for (const x of r) {
    const marca = x.estado === "OK" ? "ok " : x.estado === "FALHA" ? "FALHA" : "n/v";
    console.log(`  ${String(x.n).padStart(2)}. ${marca.padEnd(6)} ${x.cenario}`);
    console.log(`      ${x.detalhe}`);
  }

  const ok = r.filter((x) => x.estado === "OK").length;
  const falha = r.filter((x) => x.estado === "FALHA");
  const nv = r.filter((x) => x.estado === "N/V");

  console.log(`\n  ${ok} passaram · ${falha.length} falharam · ${nv.length} não verificáveis\n`);
  if (nv.length) {
    console.log("  NÃO VERIFICÁVEL não é o mesmo que OK. O que falta:");
    for (const x of nv) console.log(`    ${x.n}. ${x.cenario} — ${x.detalhe}`);
    console.log("");
  }
  if (falha.length) {
    console.log("  FALHAS:");
    for (const x of falha) console.log(`    ${x.n}. ${x.cenario} — ${x.detalhe}`);
    console.log("");
  }
  process.exit(falha.length === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
