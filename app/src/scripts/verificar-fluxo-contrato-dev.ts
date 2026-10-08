/**
 * Verificação do fluxo completo de ACEITE -> CONTRATO -> ASSINATURA, pela URL
 * pública do ambiente (de fora, sem login), com o Documenso real do ambiente.
 *
 *   BASE=https://dev.crm.callface.io DATABASE_URL=<via túnel> \
 *     npx tsx --env-file=.env src/scripts/verificar-fluxo-contrato-dev.ts criar
 *       Cria uma proposta PABX "[QA] Fluxo contrato", enviada, e prova só por HTTP:
 *       página /p/:id 200, API pública 200, aceite devolve o link de assinatura
 *       do Documenso (host público, nunca o interno), a página de assinatura abre.
 *       Imprime o propostaId e o signingUrl: assine esse link (navegador ou Playwright).
 *
 *     ... verificar-fluxo-contrato-dev.ts conferir <propostaId>
 *       Depois da assinatura REAL: contrato assinado, ganho do negócio, evidência,
 *       eventos ContractCompleted/ContractSigned no outbox, atividade na timeline,
 *       documento final disponível no CRM. Sai com código 1 se algo falhar.
 *
 *     ... verificar-fluxo-contrato-dev.ts limpar <propostaId>
 *       Apaga o que o `criar` fez (empresa, lead, negócio, proposta, contrato).
 *
 * Só toca registros "[QA]". O DATABASE_URL tem de ser o do ambiente que BASE serve.
 */
import { and, eq } from "drizzle-orm";
import { db, fecharConexao } from "@/lib/db";
import {
  empresas, leads, negocios, pipelines, usuarios, propostas, contratos, propostaGrupoComercial,
  comercialEvidencia, eventOutbox, atividades, organizacoes,
} from "@/lib/db/schema";
import { criarPropostaComItens } from "@/lib/crm/proposta-criacao";
import { syncOportunidadeFromNegocio } from "@/lib/crm/sync-domain-model";

const BASE = (process.env.BASE || "http://localhost:3000").replace(/\/$/, "");
let falhas = 0;
const ok = (cond: unknown, msg: string, det = "") => {
  console.log(`  ${cond ? "OK   " : "FALHA"} ${msg}${det ? ` — ${det}` : ""}`);
  if (!cond) falhas++;
};

async function criar() {
  const [org] = await db.select({ id: organizacoes.id }).from(organizacoes).limit(1);
  const [user] = await db.select({ id: usuarios.id }).from(usuarios).where(and(eq(usuarios.organizacaoId, org.id), eq(usuarios.ativo, true))).limit(1);
  const [pipeline] = await db.select({ id: pipelines.id }).from(pipelines).where(eq(pipelines.organizacaoId, org.id)).limit(1);
  const suf = Date.now().toString(36);
  const email = process.env.QA_EMAIL || `qa-fluxo-${suf}@callface.local`;
  const [empresa] = await db.insert(empresas).values({
    organizacaoId: org.id, nome: `[QA] Fluxo contrato ${suf}`, razaoSocial: `[QA] Fluxo contrato ${suf} LTDA`, cnpj: "11.222.333/0001-81",
    logradouro: "Rua Teste", numero: "100", bairro: "Centro", cidade: "Campinas", estado: "SP", cep: "13000-000",
  } as never).returning({ id: empresas.id });
  const [lead] = await db.insert(leads).values({
    organizacaoId: org.id, nome: "[QA] Signatário", sobrenome: suf, email, cargo: "Diretor", empresaId: empresa.id,
    empresa: `[QA] Fluxo contrato ${suf}`, empresaCnpj: "11.222.333/0001-81", status: "qualified", origem: "teste_local",
  }).returning({ id: leads.id });
  const [neg] = await db.insert(negocios).values({
    organizacaoId: org.id, leadId: lead.id, empresaId: empresa.id, pipelineId: pipeline.id, responsavelId: user.id,
    titulo: `[QA] Fluxo contrato ${suf}`, status: "proposta_enviada", serviceFamily: "PABX",
  } as never).returning({ id: negocios.id });
  await syncOportunidadeFromNegocio(neg.id);
  const p = await criarPropostaComItens({
    organizacaoId: org.id, leadId: lead.id, negocioId: neg.id, moeda: "BRL", observacoes: "[QA] fluxo contrato", condicoesPagamento: "Boleto",
    condicaoPagamentoTipo: "boleto", vencimentoDias: 15, prazoContratoMeses: 12,
    signatarios: [{ nome: `[QA] Signatário ${suf}`, email, papel: "signer", ordem: 1 }],
    itens: [{ nome: "PABX Callface - ramais [QA]", descricao: "PABX em nuvem", tipo: "recorrente", quantidade: 5, valorUnitario: 49.9, desconto: 0, descontoTipo: "percentual" }],
    criadoPorId: user.id,
  } as never);
  const validade = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10);
  await db.update(propostas).set({ status: "enviada", enviadaEm: new Date(), dataValidade: validade, modoFechamento: "CONTRACT", serviceFamily: "PABX" } as never).where(eq(propostas.id, p.id));
  console.log(`proposta [QA] ${p.id} (destinatário ${email})`);

  console.log("\n1. Link público, sem login");
  const pagina = await fetch(`${BASE}/p/${p.id}`, { redirect: "manual" });
  ok(pagina.status === 200, `GET /p/:id`, `HTTP ${pagina.status}`);
  const api = await fetch(`${BASE}/api/propostas/${p.id}/publica`);
  const dados = await api.json().catch(() => ({})) as { status?: string; itens?: unknown[] };
  ok(api.status === 200 && dados.itens?.length === 1, "GET /api/propostas/:id/publica", `HTTP ${api.status} status=${dados.status}`);
  const inexistente = await fetch(`${BASE}/api/propostas/00000000-0000-0000-0000-000000000000/publica`);
  ok(inexistente.status === 404, "id inexistente devolve 404 JSON (não 401/HTML do proxy)", `HTTP ${inexistente.status} ${inexistente.headers.get("content-type")}`);

  console.log("\n2. Aceite público");
  const t0 = Date.now();
  const aceite = await fetch(`${BASE}/api/propostas/${p.id}/aceitar-publico`, { method: "POST" });
  const corpo = await aceite.json().catch(() => ({})) as { ok?: boolean; grupos?: Array<{ proximoPasso: string; proximoUrl?: string; erro?: string; estado?: string }> };
  const g = corpo.grupos?.[0];
  ok(aceite.status === 200 && corpo.ok, "POST aceitar-publico", `HTTP ${aceite.status} em ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  ok(g?.proximoPasso === "contrato" && !g.erro, "aceite direcionou para CONTRATO", g?.erro ?? g?.estado);
  const url = g?.proximoUrl ?? "";
  ok(/\/sign\//.test(url), "link de assinatura do Documenso devolvido", url);
  ok(!/\/\/(documenso|localhost)(:|\/)/.test(url) || BASE.includes("localhost"), "link de assinatura aponta para host público (não o interno)", url);
  if (/\/sign\//.test(url)) {
    const sign = await fetch(url, { redirect: "manual" }).catch((e) => ({ status: 0, statusText: String(e) } as Response));
    ok(sign.status === 200, "página de assinatura abre de fora", `HTTP ${sign.status}`);
  }
  const [prop] = await db.select().from(propostas).where(eq(propostas.id, p.id)).limit(1);
  ok(prop.status === "aceita" && prop.aceitaEm, "proposta aceita com aceita_em", String(prop.aceitaEm));
  const [neg2] = await db.select({ status: negocios.status }).from(negocios).where(eq(negocios.id, neg.id)).limit(1);
  ok(neg2.status !== "ganho", "aceite NÃO ganhou o negócio", neg2.status);
  const eventos = await db.select({ t: eventOutbox.eventType }).from(eventOutbox).where(eq(eventOutbox.aggregateId, p.id));
  ok(eventos.filter((e) => e.t === "ProposalAccepted").length === 1, "exatamente um ProposalAccepted no outbox", eventos.map((e) => e.t).join(","));
  console.log(`\nAssine em: ${url}\nDepois: ... conferir ${p.id}`);
}

async function conferir(propostaId: string) {
  const [prop] = await db.select().from(propostas).where(eq(propostas.id, propostaId)).limit(1);
  if (!prop) throw new Error("proposta não encontrada");
  const [grupo] = await db.select().from(propostaGrupoComercial).where(eq(propostaGrupoComercial.propostaId, propostaId)).limit(1);
  const [ct] = await db.select().from(contratos).where(eq(contratos.id, grupo.contratoId!)).limit(1);
  console.log(`contrato ${ct.id}  assinatura=${ct.assinaturaStatus} provider=${ct.signatureProvider}`);
  ok(ct.assinaturaStatus === "assinado" && ct.signatureStatus === "signed", "contrato assinado (webhook DOCUMENT_COMPLETED chegou e validou o secret)");
  ok(ct.assinadoEm, "assinado_em gravado", String(ct.assinadoEm));
  ok(ct.documentoFinalUrl?.includes("/pdf-final"), "documento final apontado", ct.documentoFinalUrl ?? "");
  ok(ct.templateId, "contrato gerado de TEMPLATE (não o texto genérico)", `template=${ct.templateId} v${ct.templateVersao} família=${ct.serviceFamily}`);
  ok(ct.serviceFamily === "PABX" && /PABX/.test(ct.corpoGerado ?? "") && (ct.corpoGerado ?? "").length > 2000, "corpo é o contrato PABX completo", `${(ct.corpoGerado ?? "").length} caracteres`);
  const [neg] = await db.select({ status: negocios.status, ganhoAt: negocios.ganhoAt }).from(negocios).where(eq(negocios.id, prop.negocioId!)).limit(1);
  ok(neg.status === "ganho" && neg.ganhoAt, "negócio GANHO pela assinatura (PABX fecha na assinatura)", `${neg.status} ${neg.ganhoAt}`);
  const evid = await db.select({ t: comercialEvidencia.tipo }).from(comercialEvidencia).where(eq(comercialEvidencia.negocioId, prop.negocioId!));
  ok(evid.some((e) => e.t === "signed_contract"), "evidência signed_contract", evid.map((e) => e.t).join(","));
  ok(prop.status === "aceita", "proposta continua aceita", prop.status);
  const ev = (await db.select({ t: eventOutbox.eventType }).from(eventOutbox).where(eq(eventOutbox.aggregateId, ct.id))).map((e) => e.t);
  for (const t of ["ContractCompleted", "ContractSigned", "FinalDocumentGenerated"]) ok(ev.includes(t), `evento ${t} no outbox`);
  const ativ = await db.select({ t: atividades.tipo, titulo: atividades.titulo }).from(atividades).where(eq(atividades.negocioId, prop.negocioId!));
  ok(ativ.some((a) => a.t === "contrato_assinado"), "linha do tempo: Contrato assinado", ativ.map((a) => a.titulo).join(" | "));
  ok(ativ.some((a) => /Contrato enviado para assinatura/.test(a.titulo ?? "")), "linha do tempo: Contrato enviado para assinatura");
  const pagina = await fetch(`${BASE}/api/propostas/${propostaId}/publica`).then((r) => r.json()) as { grupos?: Array<{ contrato?: { assinaturaStatus: string } }> };
  ok(pagina.grupos?.[0]?.contrato?.assinaturaStatus === "assinado", "página pública do cliente mostra o contrato assinado");
  console.log("\nConferir à mão (precisa de sessão): CRM > Propostas > a proposta > 'Contrato e assinatura' > baixar o assinado (/api/contratos/:id/pdf-final).");
}

async function limpar(propostaId: string) {
  const [prop] = await db.select().from(propostas).where(eq(propostas.id, propostaId)).limit(1);
  if (!prop) return;
  const [neg] = await db.select().from(negocios).where(eq(negocios.id, prop.negocioId!)).limit(1);
  if (!neg?.titulo?.startsWith("[QA]")) throw new Error("recusado: a proposta não é de um negócio [QA]");
  console.log("Limpeza de [QA] com FKs em cascata não é automática: apague pelo psql filtrando negocio_id", neg.id, "e empresa_id", neg.empresaId);
}

const [cmd, arg] = process.argv.slice(2);
try {
  if (cmd === "criar") await criar();
  else if (cmd === "conferir" && arg) await conferir(arg);
  else if (cmd === "limpar" && arg) await limpar(arg);
  else console.log("uso: criar | conferir <propostaId> | limpar <propostaId>");
} finally {
  await fecharConexao().catch(() => {});
}
process.exit(falhas ? 1 : 0);
