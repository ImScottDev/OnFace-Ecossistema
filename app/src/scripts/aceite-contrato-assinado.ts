/**
 * Aceite da jornada que fecha por CONTRATO (PABX e White Label), pelo caminho
 * REAL de produção: o webhook do Documenso.
 *
 * Por que existe: `simular-fechamento-2c1.ts` cobre Callface AI ponta a ponta,
 * mas trava nas famílias contrato-first — ele chama `assinarContratoPublico`,
 * e o provider Documenso recusa confirmação direta ("Documenso confirma
 * assinaturas pelo webhook DOCUMENT_SIGNED/DOCUMENT_COMPLETED"). Resultado: as
 * duas famílias que fecham NA ASSINATURA não tinham nenhuma verificação
 * automática de ponta a ponta (achado 14/09).
 *
 * Este aceite entrega o evento `DOCUMENT_COMPLETED` no endpoint real, com o
 * segredo real, e confere o que a assinatura tem que produzir:
 *   contrato assinado → Won SEM pagamento → serviço canônico → fulfillment na
 *   trilha certa → conta de CS → pendência financeira registrada.
 *
 * Cria tudo com o prefixo `[ACEITE-CONTRATO]` e limpa no fim.
 *
 * Uso: npm run aceite:contrato
 */
import { and, eq, inArray } from "drizzle-orm";
import { db, fecharConexao } from "@/lib/db";
import {
  organizacoes, usuarios, empresas, leads, negocios, propostas, propostaGrupoComercial,
  contratos, servicosCanonicos, fulfillments, faturas, clientes, csMarcos, eventOutbox,
  comercialEvidencia,
} from "@/lib/db/schema";
import { criarPropostaComItens } from "@/lib/crm/proposta-criacao";
import { daLinha, precoOficial } from "./_preco-oficial";
import { processarAceiteDaProposta } from "@/lib/crm/proposta-aceite";
import { processarEventosPendentes } from "@/lib/events/consumer";
import { limparCenariosDeAceite } from "./_limpeza-aceite";
import { fecharFilas } from "@/lib/queue";
import { POST as webhookDocumenso } from "@/app/api/webhooks/documenso/route";
import { NextRequest } from "next/server";

const TAG = "[ACEITE-CONTRATO]";
let passou = 0;
let falhou = 0;

function ok(nome: string, condicao: boolean, detalhe = "") {
  if (condicao) { passou++; console.log(`  OK    ${nome}${detalhe ? ` — ${detalhe}` : ""}`); }
  else { falhou++; console.log(`  FALHA ${nome}${detalhe ? ` — ${detalhe}` : ""}`); }
}

/** Entrega o evento no endpoint REAL do webhook, com o segredo real. */
async function entregarWebhook(contratoId: string) {
  const corpo = {
    event: "DOCUMENT_COMPLETED",
    createdAt: new Date().toISOString(),
    payload: {
      id: 12345,
      externalId: `callface-contrato-${contratoId}`,
      status: "COMPLETED",
      completedAt: new Date().toISOString(),
      recipients: [{ name: `${TAG} Signatário`, email: "signatario@exemplo.invalid", role: "SIGNER", signingStatus: "SIGNED", signedAt: new Date().toISOString() }],
      signedDocumentUrl: "https://assinatura.exemplo.invalid/doc.pdf",
    },
  };
  const req = new NextRequest("http://local/api/webhooks/documenso", {
    method: "POST",
    headers: { "content-type": "application/json", "x-documenso-secret": process.env.DOCUMENSO_WEBHOOK_SECRET ?? "" },
    body: JSON.stringify(corpo),
  });
  const res = await webhookDocumenso(req);
  return { status: res.status, corpo: await res.json().catch(() => ({})) };
}

async function cenario(familia: "PABX" | "WHITE_LABEL", nomeServico: string, trilhaEsperada: string) {
  console.log(`\n═══ ${familia} — fecha na assinatura ═══`);

  const [org] = await db.select().from(organizacoes).limit(1);
  const [user] = await db.select().from(usuarios)
    .where(and(eq(usuarios.organizacaoId, org.id), eq(usuarios.role, "admin"), eq(usuarios.ativo, true))).limit(1);

  const rotulo = `${TAG} ${familia}`;
  const [empresa] = await db.insert(empresas).values({ organizacaoId: org.id, nome: `${rotulo} Ltda`, cnpj: null }).returning({ id: empresas.id });
  const [lead] = await db.insert(leads).values({
    organizacaoId: org.id, nome: rotulo, email: `aceite-${familia.toLowerCase()}@exemplo.invalid`,
    telefone: "11900001111", tipo: "lead", empresaId: empresa.id, empresa: `${rotulo} Ltda`, responsavelId: user.id,
  }).returning({ id: leads.id });
  const [negocio] = await db.insert(negocios).values({
    organizacaoId: org.id, leadId: lead.id, empresaId: empresa.id, titulo: `${rotulo} — oportunidade`,
    status: "proposta_apresentada", responsavelId: user.id, mrrEstimado: "2500.00",
    // A família precisa estar definida ANTES da proposta: `criarPropostaComItens`
    // recusa oportunidade sem ela desde que a regra entrou, e este aceite
    // criava o negócio sem nenhuma. O cenário é exatamente sobre a família que
    // fecha na assinatura, então deixá-la implícita nunca fez sentido aqui.
    serviceFamily: familia,
  }).returning({ id: negocios.id });

  // 1. Proposta com item da família (o Price é o do catálogo; o nome e o valor negociado são do cenário)
  const preco = await precoOficial(org.id, familia, { tipos: ["recorrente"] });
  const proposta = await criarPropostaComItens({
    organizacaoId: org.id, leadId: lead.id, negocioId: negocio.id, criadoPorId: user.id, moeda: "BRL",
    itens: [{ ...daLinha(preco), nome: nomeServico, descricao: `${rotulo} item`, tipo: "recorrente", quantidade: 1, valorUnitario: 2500, desconto: 0, descontoTipo: "valor" }],
  });
  const propostaId = proposta.id;
  await db.update(propostas).set({ status: "enviada" }).where(eq(propostas.id, propostaId));
  ok("proposta criada e enviada", !!propostaId);

  // 2. Aceite: a família contrato-first tem que parar em "aguardando contrato"
  const aceite = await processarAceiteDaProposta({ propostaId, organizacaoId: org.id, origem: "manual" });
  const grupoInfo = "ok" in aceite && aceite.ok ? aceite.grupos[0] : null;
  ok("aceite direcionou pra CONTRATO", grupoInfo?.proximoPasso === "contrato", `proximoPasso=${grupoInfo?.proximoPasso} familia=${grupoInfo?.serviceFamily}`);

  const [negocioAposAceite] = await db.select({ status: negocios.status }).from(negocios).where(eq(negocios.id, negocio.id)).limit(1);
  ok("aceite NÃO marcou ganho (aceite não é evidência)", negocioAposAceite?.status !== "ganho", `status=${negocioAposAceite?.status}`);

  const [contrato] = await db.select().from(contratos).where(eq(contratos.negocioId, negocio.id)).limit(1);
  ok("contrato gerado pelo aceite", !!contrato, contrato ? `id=${contrato.id}` : "NÃO GERADO");
  if (!contrato) return { empresaId: empresa.id };

  // 3. Assinatura pelo caminho REAL: webhook do Documenso
  const resp = await entregarWebhook(contrato.id);
  ok("webhook do Documenso aceito", resp.status === 200, `HTTP ${resp.status}`);

  const [contratoDepois] = await db.select().from(contratos).where(eq(contratos.id, contrato.id)).limit(1);
  ok("contrato marcado como assinado", contratoDepois?.assinaturaStatus === "assinado", `assinatura=${contratoDepois?.assinaturaStatus} signature=${contratoDepois?.signatureStatus}`);
  ok("documento final apontando pra rota pública do PDF", !!contratoDepois?.documentoFinalUrl?.includes("/pdf-final"), contratoDepois?.documentoFinalUrl ?? "");

  // 4. Consequências: Won sem pagamento, serviço, entrega, CS, pendência
  const [negocioFinal] = await db.select().from(negocios).where(eq(negocios.id, negocio.id)).limit(1);
  ok("negócio GANHO pela assinatura, sem pagamento", negocioFinal?.status === "ganho", `status=${negocioFinal?.status}`);

  const evid = await db.select({ tipo: comercialEvidencia.tipo }).from(comercialEvidencia).where(eq(comercialEvidencia.negocioId, negocio.id));
  ok("evidência signed_contract registrada", evid.some((e) => e.tipo === "signed_contract"), evid.map((e) => e.tipo).join(", "));

  // O serviço nasce no sweep do Event Outbox, não inline.
  const sweep = await processarEventosPendentes(100);
  console.log(`    Event Outbox: ${sweep.processados} processados, ${sweep.falhados} falhados`);

  const servicos = await db.select().from(servicosCanonicos).where(eq(servicosCanonicos.empresaId, empresa.id));
  ok("serviço canônico materializado", servicos.length > 0, servicos.map((s) => `${s.serviceFamily}/${s.currentRecurringValue}`).join(", "));

  const entregas = servicos.length
    ? await db.select().from(fulfillments).where(inArray(fulfillments.servicoCanonicoId, servicos.map((s) => s.id)))
    : [];
  ok(`entrega criada na trilha ${trilhaEsperada}`, entregas.length > 0 && entregas[0].serviceFamily === familia,
    entregas.map((f) => `${f.serviceFamily}/${f.status}`).join(", ") || "NENHUMA");

  const [cliente] = await db.select().from(clientes).where(eq(clientes.empresaId, empresa.id)).limit(1);
  ok("cliente entrou na carteira do CS", !!cliente, cliente ? `entrouEm=${cliente.entrouCarteiraEm?.toISOString().slice(0, 10)}` : "NÃO ENTROU");

  const marcos = await db.select({ id: csMarcos.id }).from(csMarcos).where(eq(csMarcos.empresaId, empresa.id));
  ok("jornada de CS semeada", marcos.length > 0, `${marcos.length} marcos`);

  const pend = await db.select({ id: faturas.id, valor: faturas.valor, status: faturas.status })
    .from(faturas).where(eq(faturas.negocioId, negocio.id));
  ok("pendência financeira registrada (ganhou sem pagar)", pend.length > 0, pend.map((f) => `${f.status} R$${f.valor}`).join(", ") || "NENHUMA");

  const eventos = await db.select({ tipo: eventOutbox.eventType }).from(eventOutbox)
    .where(inArray(eventOutbox.aggregateId, [contrato.id, negocio.id, ...(grupoInfo ? [grupoInfo.grupoId] : [])]));
  const tipos = new Set(eventos.map((e) => e.tipo));
  ok("eventos da assinatura publicados", tipos.has("ContractCompleted") && tipos.has("DealWon"), [...tipos].join(", "));

  // 5. Idempotência: reentrega do mesmo webhook não pode duplicar nada
  const repeticao = await entregarWebhook(contrato.id);
  const servicosDepois = await db.select({ id: servicosCanonicos.id }).from(servicosCanonicos).where(eq(servicosCanonicos.empresaId, empresa.id));
  ok("reentrega do webhook é no-op", servicosDepois.length === servicos.length, `HTTP ${repeticao.status}, serviços ${servicos.length}→${servicosDepois.length}`);

  return { empresaId: empresa.id };
}

async function main() {
  if (!process.env.DOCUMENSO_WEBHOOK_SECRET) {
    console.error("DOCUMENSO_WEBHOOK_SECRET não definida — o webhook é fail-closed e recusaria a entrega.");
    process.exit(1);
  }

  console.log("=== ACEITE: jornada que fecha por CONTRATO (webhook do Documenso) ===");
  try {
    await cenario("PABX", "Plano PABX Corporativo", "implantacao_pabx");
    await cenario("WHITE_LABEL", "White Label Callface", "implantacao_white_label");
  } finally {
    if (process.env.ACEITE_MANTER === "1") {
      console.log("\nACEITE_MANTER=1 — cenários preservados.");
    } else {
      const r = await limparCenariosDeAceite(TAG);
      console.log(`\nLimpeza: ${r.empresas} empresa(s), ${r.leads} lead(s), ${r.negocios} negócio(s), ${r.servicos} serviço(s).`);
    }
  }

  console.log(`\n${passou} passaram, ${falhou} falharam.`);
  await fecharFilas();
  await fecharConexao();
  process.exit(falhou > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await fecharConexao().catch(() => {});
  process.exit(1);
});
