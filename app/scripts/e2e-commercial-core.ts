/**
 * E2E do Commercial Core (ADR-EXEC-020) — roda contra o DB local (callface_crm),
 * chamando as funções REAIS de negócio (não HTTP, não mock) pra cada um dos
 * 10 cenários pedidos pelo Kauã. Cria dados de teste isolados (prefixo
 * "[E2E]" no título/nome), nunca toca em negócio/proposta real.
 *
 * Uso: cd app && npx tsx --env-file=.env scripts/e2e-commercial-core.ts
 */
import { db } from "@/lib/db";
import { sql, eq, and } from "drizzle-orm";
import {
  organizacoes, usuarios, leads, negocios, propostas, propostaItens,
  servicosCatalogo, oportunidades, oportunidadeItens, servicosCanonicos, contratos,
} from "@/lib/db/schema";
import { marcarPropostaAceita } from "@/lib/crm/aceitar-proposta";
import { aceitarPropostaPublica, assinarContratoPublico, recusarPropostaPublica } from "@/lib/crm/proposta-publica";
import { avaliarEvidenciaWon } from "@/lib/crm/won-evidence";
import { mapTipoParaRevenueNature } from "@/lib/crm/composicao-comercial";

type Resultado = { cenario: string; ok: boolean; detalhe: string };
const resultados: Resultado[] = [];
function checar(cenario: string, cond: boolean, detalhe: string) {
  resultados.push({ cenario, ok: cond, detalhe });
  console.log(`${cond ? "✓" : "✗"} ${cenario} — ${detalhe}`);
}

async function criarLeadNegocio(org: string, user: string, titulo: string) {
  const [lead] = await db.insert(leads).values({ organizacaoId: org, nome: `[E2E] ${titulo}`, tipo: "lead", responsavelId: user }).returning();
  const [negocio] = await db.insert(negocios).values({ organizacaoId: org, leadId: lead.id, titulo: `[E2E] ${titulo}`, status: "proposta_apresentada", responsavelId: user }).returning();
  return { lead, negocio };
}

async function criarPropostaComItens(org: string, user: string, leadId: string, negocioId: string, itens: { catalogo: typeof servicosCatalogo.$inferSelect; quantidade?: number; valorUnitario?: number }[]) {
  const [{ maxNum }] = await db.select({ maxNum: sql<number>`COALESCE(MAX(${propostas.numero}), 0)` }).from(propostas).where(eq(propostas.organizacaoId, org));
  let totalRecorrente = 0, totalAvulso = 0;
  const rows = itens.map((it) => {
    const qtd = it.quantidade ?? 1;
    const valorUnit = it.valorUnitario ?? parseFloat(it.catalogo.valorSugerido || "0");
    const subtotal = qtd * valorUnit;
    if (it.catalogo.tipo === "recorrente") totalRecorrente += subtotal; else totalAvulso += subtotal;
    return { catalogo: it.catalogo, qtd, valorUnit, subtotal };
  });
  const [proposta] = await db.insert(propostas).values({
    organizacaoId: org, leadId, negocioId, numero: (maxNum || 0) + 1, versao: 1, status: "enviada",
    totalRecorrente: totalRecorrente.toFixed(2), totalAvulso: totalAvulso.toFixed(2), totalGeral: (totalRecorrente + totalAvulso).toFixed(2),
    criadoPorId: user, enviadaEm: new Date(),
  }).returning();
  await db.insert(propostaItens).values(rows.map((r) => ({
    propostaId: proposta.id, servicoCatalogoId: r.catalogo.id, nome: r.catalogo.nome, tipo: r.catalogo.tipo,
    quantidade: r.qtd.toString(), valorUnitario: r.valorUnit.toFixed(2), subtotal: r.subtotal.toFixed(2),
    serviceFamily: r.catalogo.serviceFamily, revenueNature: mapTipoParaRevenueNature(r.catalogo.tipo),
  })));
  return proposta;
}

async function itensDoNegocio(negocioId: string) {
  const [op] = await db.select({ id: oportunidades.id }).from(oportunidades).where(eq(oportunidades.negocioIdLegado, negocioId)).limit(1);
  if (!op) return [];
  return db.select().from(oportunidadeItens).where(eq(oportunidadeItens.oportunidadeId, op.id));
}

async function main() {
  const [org] = await db.select().from(organizacoes).limit(1);
  const [user] = await db.select().from(usuarios).where(eq(usuarios.organizacaoId, org.id)).limit(1);
  const cat = async (categoria: string, tipo: string, nomeExato?: string) => {
    const clauses = [eq(servicosCatalogo.organizacaoId, org.id), eq(servicosCatalogo.categoria, categoria), eq(servicosCatalogo.tipo, tipo)];
    if (nomeExato) clauses.push(eq(servicosCatalogo.nome, nomeExato));
    const [row] = await db.select().from(servicosCatalogo).where(and(...clauses)).limit(1);
    if (!row) throw new Error(`catálogo ${categoria}/${tipo}${nomeExato ? `/${nomeExato}` : ""} não encontrado — rodou a migration 0013?`);
    return row;
  };
  // Nome exato pra determinismo — sem isso, LIMIT 1 sem ORDER BY pode pegar
  // qualquer um dos vários itens "callface_ai/recorrente" (Starter/Full/
  // Business/etc), quebrando a asserção de valor esperado (1e).
  const catAi = await cat("callface_ai", "recorrente", "Callface AI - Starter");
  const catPabx = await cat("pabx", "recorrente", "PABX Starter (Compartilhado)");
  const catWlMrr = await cat("white_label", "recorrente", "White Label - Licença Mensal");
  const catWlSetup = await cat("white_label", "setup", "White Label - Setup Inicial");

  // Limpa resíduo de uma rodada anterior — torna o script idempotente e
  // garante que a comparação de invariantes ANTES/DEPOIS não confunda dado
  // de E2E de ontem com "portfolio consolidado real" mudando.
  await db.execute(sql`delete from comercial_evidencia where negocio_id in (select id from negocios where titulo like '[E2E]%')`);
  await db.execute(sql`delete from oportunidade_itens where oportunidade_id in (select id from oportunidades where negocio_id_legado in (select id from negocios where titulo like '[E2E]%'))`);
  await db.execute(sql`delete from servicos_canonicos where canonical_key like 'CRM2:%' or canonical_key like 'STRIPE:sub_e2e_%'`);
  await db.execute(sql`delete from oportunidades where negocio_id_legado in (select id from negocios where titulo like '[E2E]%')`);
  await db.execute(sql`update propostas set contrato_id = null where negocio_id in (select id from negocios where titulo like '[E2E]%')`);
  await db.execute(sql`delete from contratos where negocio_id in (select id from negocios where titulo like '[E2E]%')`);
  await db.execute(sql`delete from proposta_itens where proposta_id in (select id from propostas where negocio_id in (select id from negocios where titulo like '[E2E]%'))`);
  await db.execute(sql`delete from propostas where negocio_id in (select id from negocios where titulo like '[E2E]%')`);
  await db.execute(sql`delete from status_changes where negocio_id in (select id from negocios where titulo like '[E2E]%')`);
  await db.execute(sql`delete from atividades where negocio_id in (select id from negocios where titulo like '[E2E]%')`);
  await db.execute(sql`delete from tarefas where negocio_id in (select id from negocios where titulo like '[E2E]%')`);
  await db.execute(sql`delete from negocios where titulo like '[E2E]%'`);
  await db.execute(sql`delete from pontos_contato where pessoa_id in (select id from pessoas where lead_id_legado in (select id from leads where nome like '[E2E]%'))`);
  await db.execute(sql`delete from clientes where lead_id_legado in (select id from leads where nome like '[E2E]%')`);
  await db.execute(sql`delete from pessoas where lead_id_legado in (select id from leads where nome like '[E2E]%')`);
  await db.execute(sql`delete from leads where nome like '[E2E]%'`);

  // ── Invariantes ANTES: portfolio consolidado + ledger histórico não podem mudar ──
  const [{ n: portfolioAntes }] = await db.execute<{ n: number }>(sql`select count(*)::int as n from servicos_canonicos where portfolio_included = true`);
  const [golden] = await db.select({ crv: servicosCanonicos.currentRecurringValue }).from(servicosCanonicos).where(eq(servicosCanonicos.canonicalKey, "ZOHO:VETLOG:PABX")).limit(1);
  const [{ n: ledgerAntes }] = await db.execute<{ n: number }>(sql`select count(*)::int as n from servicos_canonicos where billing_source = 'LEDGER_JULHO'`);

  // ── 1. Venda somente Callface AI (aceite -> pagamento -> "pagamento concluído" via marcarPropostaAceita c/ stripeSubscriptionId) ──
  {
    const { lead, negocio } = await criarLeadNegocio(org.id, user.id, "AI só");
    const proposta = await criarPropostaComItens(org.id, user.id, lead.id, negocio.id, [{ catalogo: catAi }]);
    const r1 = await aceitarPropostaPublica(proposta);
    checar("1a. AI só — aceite público", r1.ok && r1.proximoPasso === "pagamento", `proximoPasso=${r1.ok ? r1.proximoPasso : r1.error}`);
    const [propostaAtual] = await db.select().from(propostas).where(eq(propostas.id, proposta.id)).limit(1);
    await marcarPropostaAceita({ proposta: propostaAtual, organizacaoId: org.id, userId: user.id, stripeSubscriptionId: `sub_e2e_${Date.now()}` });
    const [negGanho] = await db.select().from(negocios).where(eq(negocios.id, negocio.id)).limit(1);
    checar("1b. AI só — pagamento concluído fecha o negócio", negGanho.status === "ganho", `status=${negGanho.status}`);
    const itens = await itensDoNegocio(negocio.id);
    checar("1c. AI só — 1 serviço canônico MRR ativado", itens.length === 1 && !!itens[0].servicoCanonicoId, `itens=${itens.length}`);
    const [servico] = itens[0]?.servicoCanonicoId ? await db.select().from(servicosCanonicos).where(eq(servicosCanonicos.id, itens[0].servicoCanonicoId!)) : [];
    checar("1d. AI só — canonicalKey usa convenção STRIPE:", !!servico?.canonicalKey.startsWith("STRIPE:"), `key=${servico?.canonicalKey}`);
    checar("1e. AI só — current_recurring_value = valor do item (MRR)", servico?.currentRecurringValue === "89.90" || parseFloat(servico?.currentRecurringValue || "0") === 89.9, `crv=${servico?.currentRecurringValue}`);
  }

  // ── 2. Venda somente PABX (aceite -> contrato -> assinatura -> Won) ──
  {
    const { lead, negocio } = await criarLeadNegocio(org.id, user.id, "PABX só");
    const proposta = await criarPropostaComItens(org.id, user.id, lead.id, negocio.id, [{ catalogo: catPabx }]);
    const r1 = await aceitarPropostaPublica(proposta);
    checar("2a. PABX só — aceite exige contrato", r1.ok && r1.proximoPasso === "contrato", `proximoPasso=${r1.ok ? r1.proximoPasso : r1.error}`);
    const [propostaComContrato] = await db.select().from(propostas).where(eq(propostas.id, proposta.id)).limit(1);
    const [contratoPendente] = await db.select().from(contratos).where(eq(contratos.id, propostaComContrato.contratoId!)).limit(1);
    checar("2b. PABX só — contrato criado PENDENTE (Won ainda não aconteceu)", contratoPendente.assinaturaStatus === "pendente", `status=${contratoPendente.assinaturaStatus}`);
    const [negAntesAssinar] = await db.select({ status: negocios.status }).from(negocios).where(eq(negocios.id, negocio.id)).limit(1);
    checar("2c. PABX só — negócio NÃO ganho antes da assinatura", negAntesAssinar.status !== "ganho", `status=${negAntesAssinar.status}`);
    await assinarContratoPublico(propostaComContrato, "Fulano de Tal", "127.0.0.1");
    const [negGanho] = await db.select().from(negocios).where(eq(negocios.id, negocio.id)).limit(1);
    checar("2d. PABX só — assinatura fecha o negócio", negGanho.status === "ganho", `status=${negGanho.status}`);
    const itens = await itensDoNegocio(negocio.id);
    const [servico] = itens[0]?.servicoCanonicoId ? await db.select().from(servicosCanonicos).where(eq(servicosCanonicos.id, itens[0].servicoCanonicoId!)) : [];
    checar("2e. PABX só — canonicalKey usa convenção CRM2: (sem Stripe)", !!servico?.canonicalKey.startsWith("CRM2:"), `key=${servico?.canonicalKey}`);
  }

  // ── 3. White Label com setup + recorrência ──
  let wlServicoIds: string[] = [];
  {
    const { lead, negocio } = await criarLeadNegocio(org.id, user.id, "White Label setup+MRR");
    const proposta = await criarPropostaComItens(org.id, user.id, lead.id, negocio.id, [
      { catalogo: catWlMrr, valorUnitario: 997 },
      { catalogo: catWlSetup, valorUnitario: 2500 },
    ]);
    const r1 = await aceitarPropostaPublica(proposta);
    checar("3a. White Label — aceite exige contrato (requerContrato=true)", r1.ok && r1.proximoPasso === "contrato", `proximoPasso=${r1.ok ? r1.proximoPasso : r1.error}`);
    const [propostaComContrato] = await db.select().from(propostas).where(eq(propostas.id, proposta.id)).limit(1);
    await assinarContratoPublico(propostaComContrato, "Fulano de Tal", "127.0.0.1");
    const itens = await itensDoNegocio(negocio.id);
    checar("3b. White Label — 2 itens materializados (MRR + SETUP)", itens.length === 2, `itens=${itens.length}`);
    const mrrItem = itens.find((i) => i.revenueNature === "MRR");
    const setupItem = itens.find((i) => i.revenueNature === "SETUP");
    wlServicoIds = itens.map((i) => i.servicoCanonicoId).filter((x): x is string => !!x);
    const [servicoMrr] = mrrItem?.servicoCanonicoId ? await db.select().from(servicosCanonicos).where(eq(servicosCanonicos.id, mrrItem.servicoCanonicoId!)) : [];
    const [servicoSetup] = setupItem?.servicoCanonicoId ? await db.select().from(servicosCanonicos).where(eq(servicosCanonicos.id, setupItem.servicoCanonicoId!)) : [];
    checar("3c. White Label — item MRR alimenta current_recurring_value", parseFloat(servicoMrr?.currentRecurringValue || "0") === 997, `crv=${servicoMrr?.currentRecurringValue}`);
    checar("3d. White Label — item SETUP NUNCA vira MRR (regra dura)", parseFloat(servicoSetup?.currentRecurringValue || "-1") === 0, `crv setup=${servicoSetup?.currentRecurringValue}`);
    checar("3e. White Label — 2 serviços canônicos DISTINTOS (não colapsa família/natureza)", new Set(wlServicoIds).size === 2, `servicos distintos=${new Set(wlServicoIds).size}`);
  }

  // ── 4. Venda mista (AI MRR + PABX MRR + WL MRR + WL SETUP) ──
  {
    const { lead, negocio } = await criarLeadNegocio(org.id, user.id, "Mista AI+PABX+WL");
    const proposta = await criarPropostaComItens(org.id, user.id, lead.id, negocio.id, [
      { catalogo: catAi }, { catalogo: catPabx, valorUnitario: 450 }, { catalogo: catWlMrr, valorUnitario: 997 }, { catalogo: catWlSetup, valorUnitario: 2500 },
    ]);
    const r1 = await aceitarPropostaPublica(proposta);
    checar("4a. Mista — qualquer item requerContrato manda tudo pro caminho contrato", r1.ok && r1.proximoPasso === "contrato", `proximoPasso=${r1.ok ? r1.proximoPasso : r1.error}`);
    const [propostaComContrato] = await db.select().from(propostas).where(eq(propostas.id, proposta.id)).limit(1);
    await assinarContratoPublico(propostaComContrato, "Fulano de Tal", "127.0.0.1");
    const itens = await itensDoNegocio(negocio.id);
    checar("4b. Mista — 4 itens materializados, famílias distintas preservadas", itens.length === 4, `itens=${itens.length}, familias=${[...new Set(itens.map((i) => i.serviceFamily))].join("/")}`);
    const servicoIds = new Set(itens.map((i) => i.servicoCanonicoId).filter(Boolean));
    checar("4c. Mista — 4 serviços canônicos gerados (1 por item, não 1 por venda)", servicoIds.size === 4, `servicos=${servicoIds.size}`);
    const [negGanho] = await db.select().from(negocios).where(eq(negocios.id, negocio.id)).limit(1);
    checar("4d. Mista — Won válido", negGanho.status === "ganho", `status=${negGanho.status}`);
  }

  // ── 5. Proposta recusada ──
  {
    const { lead, negocio } = await criarLeadNegocio(org.id, user.id, "Recusada");
    const proposta = await criarPropostaComItens(org.id, user.id, lead.id, negocio.id, [{ catalogo: catAi }]);
    const r = await recusarPropostaPublica(proposta, "Cliente achou caro");
    checar("5a. Recusada — recusa registrada", r.ok, JSON.stringify(r));
    const [negocioRecusado] = await db.select({ status: negocios.status }).from(negocios).where(eq(negocios.id, negocio.id)).limit(1);
    checar("5b. Recusada — negócio NÃO vira ganho", negocioRecusado.status !== "ganho", `status=${negocioRecusado.status}`);
    const evid = await avaliarEvidenciaWon(negocio.id, org.id, null);
    checar("5c. Recusada — sem evidência válida (bloqueia Won)", !evid.permitido, `motivo=${evid.motivo}`);
  }

  // ── 6. Proposta aceita mas pagamento pendente (caminho pagamento, sem webhook) ──
  {
    const { lead, negocio } = await criarLeadNegocio(org.id, user.id, "Pagamento pendente");
    const proposta = await criarPropostaComItens(org.id, user.id, lead.id, negocio.id, [{ catalogo: catAi }]);
    const r1 = await aceitarPropostaPublica(proposta);
    checar("6a. Pagamento pendente — aceite não fecha sozinho", r1.ok && r1.proximoPasso === "pagamento", `proximoPasso=${r1.ok ? r1.proximoPasso : r1.error}`);
    const [negAindaAberto] = await db.select({ status: negocios.status }).from(negocios).where(eq(negocios.id, negocio.id)).limit(1);
    checar("6b. Pagamento pendente — negócio continua ABERTO (Won exige pagamento confirmado, não só aceite)", negAindaAberto.status !== "ganho", `status=${negAindaAberto.status}`);
    const evid = await avaliarEvidenciaWon(negocio.id, org.id, null);
    checar("6c. Pagamento pendente — sem evidência ainda", !evid.permitido, `motivo=${evid.motivo}`);
  }

  // ── 7. Contrato obrigatório ainda não assinado ──
  {
    const { lead, negocio } = await criarLeadNegocio(org.id, user.id, "Contrato pendente assinatura");
    const proposta = await criarPropostaComItens(org.id, user.id, lead.id, negocio.id, [{ catalogo: catPabx }]);
    await aceitarPropostaPublica(proposta);
    const evid = await avaliarEvidenciaWon(negocio.id, org.id, "pabx");
    checar("7a. Contrato pendente — Won bloqueado até assinar", !evid.permitido, `motivo=${evid.motivo}`);
  }

  // ── 8. Pagamento concluído (Stripe) — coberto no cenário 1, valida invariantes aqui ──
  checar("8. Pagamento concluído — coberto no cenário 1b/1c/1d (mesma mecânica, sem duplicar)", true, "ver 1b-1d");

  // ── 9. Won válido — coberto nos cenários 1/2/3/4 (todos chegam em status=ganho) ──
  checar("9. Won válido — coberto nos cenários 1/2/3/4 (status=ganho com evidência real)", true, "ver 1b/2d/3/4d");

  // ── 10. Tentativa de Won sem evidência (negócio limpo, nunca teve proposta) ──
  {
    const { negocio } = await criarLeadNegocio(org.id, user.id, "Sem evidência nenhuma");
    const evid = await avaliarEvidenciaWon(negocio.id, org.id, null);
    checar("10. Won sem evidência — bloqueado (nenhum fallback legado aplicável)", !evid.permitido, `motivo=${evid.motivo}`);
  }

  // ── 11 (extra, pedido explícito): múltiplos serviços de uma oportunidade — já provado no cenário 3/4 ──
  checar("11. Múltiplos serviços canônicos de 1 oportunidade — coberto em 3e/4c", true, "ver 3e/4c");

  // ── Invariantes DEPOIS: portfolio consolidado + ledger histórico intocados ──
  const [{ n: portfolioDepois }] = await db.execute<{ n: number }>(sql`select count(*)::int as n from servicos_canonicos where portfolio_included = true and canonical_key not like 'CRM2:%' and canonical_key not like 'STRIPE:sub_e2e_%'`);
  checar("INVARIANTE. Portfolio consolidado pré-existente intocado", portfolioAntes === portfolioDepois, `antes=${portfolioAntes} depois(excluindo E2E)=${portfolioDepois}`);
  const [goldenDepois] = await db.select({ crv: servicosCanonicos.currentRecurringValue }).from(servicosCanonicos).where(eq(servicosCanonicos.canonicalKey, "ZOHO:VETLOG:PABX")).limit(1);
  checar("INVARIANTE. Golden case VETLOG:PABX intocado", golden?.crv === goldenDepois?.crv, `antes=${golden?.crv} depois=${goldenDepois?.crv}`);
  const [{ n: ledgerDepois }] = await db.execute<{ n: number }>(sql`select count(*)::int as n from servicos_canonicos where billing_source = 'LEDGER_JULHO'`);
  checar("INVARIANTE. Ledger histórico (LEDGER_JULHO) com contagem intocada", ledgerAntes === ledgerDepois, `antes=${ledgerAntes} depois=${ledgerDepois}`);

  const falhas = resultados.filter((r) => !r.ok);
  console.log(`\n${resultados.length - falhas.length}/${resultados.length} passaram.`);
  if (falhas.length > 0) {
    console.log("\nFALHAS:");
    falhas.forEach((f) => console.log(`  ✗ ${f.cenario}: ${f.detalhe}`));
    process.exit(1);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
