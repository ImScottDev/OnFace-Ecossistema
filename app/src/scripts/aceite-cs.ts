/**
 * Aceite do módulo CS — os 12 testes da spec, exercitados pela API HTTP real
 * (app Hono via `app.request`), com sessão NextAuth de verdade emitida aqui.
 *
 * Vai contra o banco real e LIMPA o que criou no final. Os testes que só
 * leem não sujam nada; os que escrevem usam uma empresa marcada e desfazem.
 */
import { encode } from "@auth/core/jwt";
import { db } from "@/lib/db";
import { organizacoes, usuarios, empresas, clientes, servicosCanonicos, csMarcos, csRiscos, csCancelamentos, negocios, tarefas, atividades, csRenovacoes, contratos, oportunidades } from "@/lib/db/schema";
import { and, eq, sql, desc, inArray } from "drizzle-orm";
import { app } from "@/api-server/server";
import { marcosDoCiclo } from "@/lib/cs/playbooks";


let cookie = "";
let passou = 0;
let falhou = 0;

function ok(n: string, cond: boolean, detalhe = "") {
  if (cond) { passou++; console.log(`  OK   ${n}${detalhe ? ` — ${detalhe}` : ""}`); }
  else { falhou++; console.log(`  FALHA ${n}${detalhe ? ` — ${detalhe}` : ""}`); }
}

async function api(metodo: string, caminho: string, corpo?: unknown) {
  const r = await app.request(`http://local${caminho}`, {
    method: metodo,
    headers: { cookie, "content-type": "application/json" },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await r.text();
  let json: unknown = null;
  try { json = JSON.parse(texto); } catch { /* resposta não-JSON */ }
  return { status: r.status, body: json as Record<string, unknown>, texto };
}

async function main() {
  const [org] = await db.select().from(organizacoes).limit(1);
  const [admin] = await db.select().from(usuarios)
    .where(and(eq(usuarios.organizacaoId, org.id), eq(usuarios.role, "admin"), eq(usuarios.ativo, true))).limit(1);

  const token = await encode({
    token: { id: admin.id, name: admin.nome, email: admin.email, role: admin.role, organizacaoId: org.id, organizacaoSlug: org.slug ?? "" },
    secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "",
    salt: "authjs.session-token",
  });
  cookie = `authjs.session-token=${token}`;

  const auth = await api("GET", "/api/cs/pulso");
  if (auth.status !== 200) { console.error("Sessão não autenticou:", auth.status, auth.texto.slice(0, 200)); process.exit(1); }
  console.log(`Autenticado como ${admin.nome} (${admin.role}) na org ${org.nome}\n`);

  // Empresa de trabalho: a que tem serviço no portfólio e mais dado em volta.
  const [alvo] = await db.select({ id: empresas.id, nome: empresas.nome })
    .from(empresas)
    .innerJoin(servicosCanonicos, eq(servicosCanonicos.empresaId, empresas.id))
    .where(and(eq(empresas.organizacaoId, org.id), eq(servicosCanonicos.portfolioIncluded, true)))
    .limit(1);
  console.log(`Cliente de teste: ${alvo.nome} (${alvo.id})\n`);

  const criado = { negocios: [] as string[], riscos: [] as string[], tarefas: [] as string[], cancelamentos: [] as string[], atividades: [] as string[] };

  // ── TESTE 1 — abrir CS e ver quem precisa de ação ──
  console.log("TESTE 1 — fila de ação");
  const fila = await api("GET", "/api/cs/fila");
  const itens = (fila.body?.itens ?? []) as Array<Record<string, unknown>>;
  ok("fila responde", fila.status === 200);
  ok("todo item tem motivo explicável", itens.length === 0 || itens.every((i) => !!i.detalhe && !!i.rotulo), `${itens.length} itens`);
  ok("fila vem ordenada por urgência", itens.length < 2 || Number(itens[0].ordem) <= Number(itens[itens.length - 1].ordem));

  // ── TESTE 2 — minha carteira ──
  console.log("\nTESTE 2 — escopos da carteira");
  const minha = await api("GET", "/api/cs/pulso?responsavel=me");
  const todos = await api("GET", "/api/cs/pulso");
  ok("pulso 'minha carteira' responde", minha.status === 200, `${minha.body?.clientesAtivos} clientes meus de ${todos.body?.clientesAtivos}`);
  ok("filtro realmente restringe", Number(minha.body?.clientesAtivos) <= Number(todos.body?.clientesAtivos));

  // ── TESTE 3 — Cliente 360 completo ──
  console.log("\nTESTE 3 — Cliente 360");
  const c360 = await api("GET", `/api/clientes-crm2/${alvo.id}`);
  const campos = ["servicos", "currentMrr", "contratos", "pessoas", "atividadesRecentes", "timelineEventos", "proximasAcoes", "responsavel", "statusFinanceiro"];
  for (const campo of campos) ok(`360 traz ${campo}`, c360.body?.[campo] !== undefined);
  const jornada = await api("GET", `/api/cs/clientes/${alvo.id}/jornada`);
  ok("360 traz jornada", jornada.status === 200 && Array.isArray(jornada.body?.marcos));
  const riscosResp = await api("GET", `/api/cs/clientes/${alvo.id}/riscos`);
  ok("360 traz riscos", riscosResp.status === 200);

  // ── TESTE 4 — criar tarefa, concluir, ver na timeline ──
  console.log("\nTESTE 4 — tarefa → conclusão → timeline");
  const novaTarefa = await api("POST", `/api/cs/clientes/${alvo.id}/tarefas`, {
    titulo: "[ACEITE] Ligar para validar uso", prioridade: "alta",
    venceEm: new Date(Date.now() + 86_400_000).toISOString(),
  });
  ok("tarefa criada", novaTarefa.status === 201 && !!novaTarefa.body?.id);
  const tarefaId = String(novaTarefa.body?.id ?? "");
  criado.tarefas.push(tarefaId);

  const concl = await api("POST", `/api/cs/tarefas/${tarefaId}/concluir`, { nota: "[ACEITE] cliente atendeu" });
  ok("tarefa concluída", concl.status === 200 && concl.body?.concluida === true);

  const timeline = await db.select({ id: atividades.id, titulo: atividades.titulo })
    .from(atividades)
    .where(and(eq(atividades.empresaId, alvo.id), sql`${atividades.titulo} LIKE '%[ACEITE]%'`))
    .orderBy(desc(atividades.createdAt));
  ok("conclusão apareceu na timeline", timeline.length > 0, timeline[0]?.titulo ?? "");
  criado.atividades.push(...timeline.map((t) => t.id));

  // ── TESTE 5 — novo cliente gera marcos ──
  console.log("\nTESTE 5 — jornada automática");
  // O alvo é uma conta REAL da carteira, escolhida de propósito por ter dado em
  // volta. Semear a jornada nela é escrita de verdade: em 22/09 sobraram 7
  // marcos e uma tarefa PLAYBOOK em "Unresolved billing identity", porque a
  // limpeza cobria riscos, negócios, tarefas e atividades — e não `cs_marcos`.
  // A tarefa apareceu na fila de trabalho do CS. Guardar o que já existia é o
  // que separa "o que o aceite criou" do que é da conta.
  const marcosPreexistentes = new Set(
    (await db.select({ id: csMarcos.id }).from(csMarcos).where(eq(csMarcos.empresaId, alvo.id))).map((m) => m.id),
  );
  const jornadaAntes = await api("GET", `/api/cs/clientes/${alvo.id}/jornada`);
  const marcosAntes = ((jornadaAntes.body?.marcos ?? []) as unknown[]).length;
  const iniciar = await api("POST", `/api/cs/clientes/${alvo.id}/jornada/iniciar`);
  ok("iniciar jornada responde", iniciar.status === 200);
  const jornadaDepois = await api("GET", `/api/cs/clientes/${alvo.id}/jornada`);
  const marcosDepois = ((jornadaDepois.body?.marcos ?? []) as unknown[]).length;
  const esperadosCiclo1 = marcosDoCiclo(1).length;
  ok("marcos existem", marcosDepois >= esperadosCiclo1, `${marcosDepois} marcos`);

  // ── TESTE 6 — marco gera tarefa exatamente uma vez ──
  console.log("\nTESTE 6 — idempotência do marco");
  // Comparado ao playbook, não a um número fixo: acrescentar um marco novo
  // (o M12 entrou em 08/09) deve fazer a conta ganhá-lo, não falhar o teste.
  const terceira = await api("POST", `/api/cs/clientes/${alvo.id}/jornada/iniciar`);
  const jornadaFinal = await api("GET", `/api/cs/clientes/${alvo.id}/jornada`);
  const marcosFinal = ((jornadaFinal.body?.marcos ?? []) as unknown[]).length;
  ok("semear de novo não duplica", marcosFinal === marcosDepois && Number(terceira.body?.criados) === 0,
    `${marcosAntes} → ${marcosDepois} → ${marcosFinal}`);
  ok("um marco por código do playbook", marcosDepois % esperadosCiclo1 === 0, `${marcosDepois} para ${esperadosCiclo1} códigos`);
  const sweep1 = await api("POST", "/api/cs/sweep");
  const sweep2 = await api("POST", "/api/cs/sweep");
  ok("sweep responde", sweep1.status === 200);
  ok("segundo sweep é no-op", Number(sweep2.body?.tarefasDeMarco) === 0 && Number(sweep2.body?.tarefasDeRisco) === 0 && Number(sweep2.body?.riscosAbertos) === 0,
    JSON.stringify({ marco: sweep2.body?.tarefasDeMarco, risco: sweep2.body?.tarefasDeRisco, novos: sweep2.body?.riscosAbertos }));

  const dupTarefas = await db.execute<{ n: string }>(sql`
    SELECT COUNT(*)::text AS n FROM (
      SELECT chave_idempotencia FROM tarefas
       WHERE organizacao_id = ${org.id} AND chave_idempotencia IS NOT NULL
       GROUP BY chave_idempotencia HAVING COUNT(*) > 1) x`);
  ok("nenhuma tarefa automática duplicada", Number(dupTarefas[0]?.n) === 0);

  // ── TESTE 7 — falha de pagamento vira ação ──
  console.log("\nTESTE 7 — billing → CS");
  const { registrarFalhaPagamento } = await import("@/lib/cs/handoff");
  await registrarFalhaPagamento(org.id, { empresaId: alvo.id, motivo: "[ACEITE] cartão recusado", invoiceId: "aceite-inv-1" });
  const riscosPos = await api("GET", `/api/cs/clientes/${alvo.id}/riscos`);
  const rlist = (riscosPos.body?.riscos ?? []) as Array<Record<string, unknown>>;
  const rPag = rlist.find((r) => r.tipo === "PAGAMENTO_FALHOU" && r.status === "ABERTO");
  ok("risco de pagamento aberto", !!rPag, String(rPag?.motivo ?? ""));
  if (rPag) criado.riscos.push(String(rPag.id));
  const tPag = await db.select({ id: tarefas.id }).from(tarefas)
    .where(and(eq(tarefas.empresaId, alvo.id), eq(tarefas.origem, "BILLING")));
  ok("tarefa de cobrança criada", tPag.length > 0);
  criado.tarefas.push(...tPag.map((t) => t.id));

  // repetir o mesmo evento não pode duplicar
  await registrarFalhaPagamento(org.id, { empresaId: alvo.id, motivo: "[ACEITE] cartão recusado", invoiceId: "aceite-inv-1" });
  const tPag2 = await db.select({ id: tarefas.id }).from(tarefas)
    .where(and(eq(tarefas.empresaId, alvo.id), eq(tarefas.origem, "BILLING")));
  ok("evento repetido não duplica tarefa", tPag2.length === tPag.length, `${tPag.length} → ${tPag2.length}`);

  // ── TESTE 8 — risco manual com motivo e resolução ──
  console.log("\nTESTE 8 — risco manual");
  const rm = await api("POST", `/api/cs/clientes/${alvo.id}/riscos`, {
    severidade: "EM_RISCO", motivo: "[ACEITE] cliente reclamou da qualidade das chamadas",
  });
  ok("risco manual criado", rm.status === 201);
  const riscoId = String(rm.body?.id ?? "");
  criado.riscos.push(riscoId);
  const semResolucao = await api("POST", `/api/cs/riscos/${riscoId}/resolver`, {});
  ok("resolver sem descrição é recusado", semResolucao.status === 400);
  const res = await api("POST", `/api/cs/riscos/${riscoId}/resolver`, { resolucao: "[ACEITE] rota de saída trocada" });
  ok("risco resolvido com histórico", res.status === 200 && res.body?.status === "RESOLVIDO");
  const histRisco = await db.select().from(csRiscos).where(eq(csRiscos.id, riscoId));
  ok("histórico preservado (não apagado)", histRisco.length === 1 && !!histRisco[0].resolucao);

  // ── TESTE 9 — renovação como processo ──
  console.log("\nTESTE 9 — renovação");
  const renovs = await api("GET", "/api/cs/renovacoes");
  ok("listagem de renovações responde", renovs.status === 200);
  const lista = (renovs.body?.renovacoes ?? []) as Array<{ renovacao: { id: string } }>;
  if (lista.length > 0) {
    const rid = lista[0].renovacao.id;
    const semData = await api("PATCH", `/api/cs/renovacoes/${rid}`, { status: "RENOVADA" });
    ok("renovar sem nova data é recusado", semData.status === 400, String(semData.body?.error ?? ""));
    const neg = await api("PATCH", `/api/cs/renovacoes/${rid}`, { status: "EM_NEGOCIACAO", observacoes: "[ACEITE]" });
    ok("renovação vai para negociação", neg.status === 200 && neg.body?.status === "EM_NEGOCIACAO");
    // Devolve ao estado que o sweep calcularia: FUTURA enquanto o
    // vencimento estiver fora da janela de 90 dias.
    const [orig] = await db.select({ vencimento: csRenovacoes.vencimento }).from(csRenovacoes).where(eq(csRenovacoes.id, rid));
    const dentroDaJanela = new Date(`${orig.vencimento}T12:00:00`).getTime() - Date.now() <= 90 * 86_400_000;
    await db.update(csRenovacoes)
      .set({ status: dentroDaJanela ? "ABERTA" : "FUTURA", observacoes: null, decididoEm: null, decididoPor: null })
      .where(eq(csRenovacoes.id, rid));
  } else {
    console.log("  (sem renovação na base — só 1 contrato ativo tem vencimento ligado a serviço)");
  }

  // ── TESTE 10 — expansão a partir do Cliente 360 ──
  console.log("\nTESTE 10 — expansão");
  const [servAlvo] = await db.select({ id: servicosCanonicos.id }).from(servicosCanonicos)
    .where(and(eq(servicosCanonicos.empresaId, alvo.id), eq(servicosCanonicos.portfolioIncluded, true))).limit(1);
  const exp = await api("POST", `/api/cs/clientes/${alvo.id}/expansao`, {
    titulo: "[ACEITE] +10 ramais", tipo: "usuarios", servicoOrigemId: servAlvo?.id ?? null, valorEstimado: "500.00",
  });
  ok("expansão criada", exp.status === 201);
  const negocioExp = (exp.body?.negocio ?? {}) as Record<string, unknown>;
  criado.negocios.push(String(negocioExp.id));
  ok("virou oportunidade comercial", negocioExp.commercialMotion === "EXPANSION");
  ok("ligada ao serviço de origem", !servAlvo || negocioExp.servicoOrigemId === servAlvo.id);
  const listaExp = await api("GET", "/api/cs/expansoes");
  ok("aparece na visão de expansão", ((listaExp.body?.expansoes ?? []) as Array<{ id: string }>).some((e) => e.id === negocioExp.id));

  // ── TESTE 11 — cancelamento sem apagar histórico ──
  console.log("\nTESTE 11 — cancelamento");
  const semDetalhe = await api("POST", `/api/cs/clientes/${alvo.id}/cancelamentos`, { motivo: "outro" });
  ok('motivo "outro" exige detalhe', semDetalhe.status === 400);
  const canc = await api("POST", `/api/cs/clientes/${alvo.id}/cancelamentos`, {
    motivo: "preco", motivoDetalhe: "[ACEITE] achou caro", servicoCanonicoId: servAlvo?.id ?? null, canal: "ligação",
  });
  ok("pedido registrado", canc.status === 201);
  const cancId = String(canc.body?.id ?? "");
  criado.cancelamentos.push(cancId);
  ok("checagens levantadas automaticamente", canc.body?.pendenciaFinanceira !== undefined);
  const efetivarSemMotivo = await api("PATCH", `/api/cs/cancelamentos/${cancId}`, { status: "EFETIVADO" });
  ok("efetivar sem motivo final é recusado", efetivarSemMotivo.status === 400);
  const retido = await api("PATCH", `/api/cs/cancelamentos/${cancId}`, { status: "RETIDO", tentativaRetencao: "[ACEITE] desconto de 10%" });
  ok("retenção registrada", retido.status === 200 && retido.body?.decisao === "RETIDO");
  const servDepois = servAlvo ? await db.select({ lc: servicosCanonicos.commercialLifecycle }).from(servicosCanonicos).where(eq(servicosCanonicos.id, servAlvo.id)) : [];
  ok("serviço intacto após retenção", !servAlvo || servDepois[0]?.lc === "ACTIVE");
  const empresaViva = await db.select({ id: empresas.id }).from(empresas).where(eq(empresas.id, alvo.id));
  ok("cliente nunca apagado", empresaViva.length === 1);

  // ── TESTE 12 — múltiplos serviços, MRR sem setup/hardware ──
  console.log("\nTESTE 12 — múltiplos serviços e MRR");
  const [multi] = await db.execute<{ empresa_id: string; n: string }>(sql`
    SELECT empresa_id, COUNT(*)::text AS n FROM servicos_canonicos
     WHERE organizacao_id = ${org.id} AND portfolio_included = true AND empresa_id IS NOT NULL
     GROUP BY empresa_id HAVING COUNT(*) > 1 ORDER BY COUNT(*) DESC LIMIT 1`);
  if (multi) {
    const r360 = await api("GET", `/api/clientes-crm2/${multi.empresa_id}`);
    const servs = (r360.body?.servicos ?? []) as Array<Record<string, unknown>>;
    ok("cada serviço listado separadamente", servs.length >= 2, `${servs.length} serviços`);
    const somaMrr = servs.filter((s) => s.revenueNature === "MRR" && s.portfolioIncluded).reduce((a, s) => a + Number(s.currentRecurringValue || 0), 0);
    ok("MRR só soma natureza MRR", Math.abs(somaMrr - Number(r360.body?.currentMrr || 0)) < 0.01,
      `soma=${somaMrr.toFixed(2)} vs currentMrr=${r360.body?.currentMrr}`);
    const naoMrr = servs.filter((s) => s.revenueNature !== "MRR");
    ok("setup/hardware fora do MRR", naoMrr.every((s) => Number(s.currentRecurringValue || 0) === 0), `${naoMrr.length} serviços não-MRR`);
  } else {
    console.log("  (nenhuma empresa com 2+ serviços no portfólio)");
  }

  // ── limpeza ──
  console.log("\n── limpando dados de teste ──");
  if (criado.cancelamentos.length) await db.delete(csCancelamentos).where(inArray(csCancelamentos.id, criado.cancelamentos));
  if (criado.riscos.length) await db.delete(csRiscos).where(inArray(csRiscos.id, criado.riscos));
  if (criado.negocios.length) {
    // A oportunidade canônica ANTES do negócio legado.
    //
    // `oportunidades.negocio_id_legado` referencia `negocios.id` e a FK não
    // cascateia. Enquanto o espelho não existia, apagar o negócio bastava;
    // depois que a ponte de Ganho passou a criar a oportunidade, esta limpeza
    // ficou para trás e o aceite inteiro morria no final com
    // `oportunidades_negocio_id_legado_fkey` — depois de os 12 testes passarem,
    // o que faz a falha parecer de outro lugar.
    await db.delete(oportunidades).where(inArray(oportunidades.negocioIdLegado, criado.negocios));
    await db.delete(negocios).where(inArray(negocios.id, criado.negocios));
  }
  // Cobre as 3 origens que os testes criam: título marcado, tarefa de
  // cobrança do evento de pagamento, e as derivadas de risco/cancelamento —
  // essas duas últimas só se identificam pela chave de idempotência.
  await db.delete(tarefas).where(and(
    eq(tarefas.empresaId, alvo.id),
    sql`(${tarefas.titulo} LIKE '%[ACEITE]%'
         OR ${tarefas.origem} = 'BILLING'
         OR ${tarefas.chaveIdempotencia} LIKE 'CS_RISCO:%'
         OR ${tarefas.chaveIdempotencia} LIKE 'CS_CANCEL:%')`,
  ));
  await db.delete(atividades).where(and(eq(atividades.empresaId, alvo.id), sql`${atividades.descricao} LIKE '%[ACEITE]%' OR ${atividades.titulo} LIKE '%[ACEITE]%'`));

  // Os marcos que o TESTE 5 semeou na conta real, e só eles. A ordem importa:
  // `cs_marcos.tarefa_id` referencia `tarefas`, então o marco cai primeiro e a
  // tarefa de playbook depois — o contrário é recusado pela FK.
  const marcosDoAceite = (await db.select({ id: csMarcos.id }).from(csMarcos).where(eq(csMarcos.empresaId, alvo.id)))
    .map((m) => m.id).filter((id) => !marcosPreexistentes.has(id));
  if (marcosDoAceite.length) {
    await db.delete(csMarcos).where(inArray(csMarcos.id, marcosDoAceite));
    await db.delete(tarefas).where(and(
      eq(tarefas.empresaId, alvo.id),
      inArray(tarefas.chaveIdempotencia, marcosDoAceite.map((id) => `CS_MARCO:${id}`)),
    ));
    console.log(`  ${marcosDoAceite.length} marcos do aceite removidos da conta real`);
  }
  console.log("  limpo");

  console.log(`\n═══ ${passou} passaram, ${falhou} falharam ═══`);
  process.exit(falhou > 0 ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
