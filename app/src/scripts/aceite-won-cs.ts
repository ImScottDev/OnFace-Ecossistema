/**
 * Aceite da jornada Won → Cliente → CS, pelos DOIS caminhos de fechamento.
 *
 * Exercita a API HTTP real (app Hono via `app.request`, com sessão NextAuth de
 * verdade) contra o banco de DEV, e confere no banco o que cada caminho de
 * Won deixou pra trás. Cria tudo com o prefixo `[ACEITE-WON]` e LIMPA no fim.
 *
 * Existe por causa de dois achados de 14/09:
 *   1. `garantirContaCs` fazia ON CONFLICT contra índice PARCIAL sem repetir o
 *      predicado — todo handoff de Won pro CS morria e ia pro dead-letter.
 *   2. O Won manual (PATCH /api/negocios/:id) era uma cópia divergente do Won
 *      automático: não registrava atividade, não materializava Pessoa e não
 *      colocava o cliente na carteira do CS.
 *
 * Uso: npm run aceite:won-cs
 */
import { encode } from "@auth/core/jwt";
import { db, fecharConexao } from "@/lib/db";
import {
  organizacoes, usuarios, empresas, leads, negocios, clientes, csMarcos,
  atividades, eventOutbox, comercialEvidencia, statusChanges, notificacoes, pessoas,
  contratos, contratoItens, fulfillments, fulfillmentItens, servicosCanonicos,
} from "@/lib/db/schema";
import { and, eq, inArray, like, or } from "drizzle-orm";
import { app } from "@/api-server/server";
import { fecharFilas } from "@/lib/queue";
import { limparCenariosDeAceite } from "./_limpeza-aceite";

const TAG = "[ACEITE-WON]";
let cookie = "";
let passou = 0;
let falhou = 0;

function ok(nome: string, condicao: boolean, detalhe = "") {
  if (condicao) { passou++; console.log(`  OK    ${nome}${detalhe ? ` — ${detalhe}` : ""}`); }
  else { falhou++; console.log(`  FALHA ${nome}${detalhe ? ` — ${detalhe}` : ""}`); }
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
  return { status: r.status, body: (json ?? {}) as Record<string, unknown>, texto };
}

interface Cenario { empresaId: string; leadId: string; negocioId: string; nome: string }

async function criarCenario(organizacaoId: string, responsavelId: string, sufixo: string): Promise<Cenario> {
  const nome = `${TAG} ${sufixo}`;
  const [empresa] = await db.insert(empresas).values({
    organizacaoId, nome: `${nome} Ltda`,
  }).returning({ id: empresas.id });

  const [lead] = await db.insert(leads).values({
    organizacaoId, nome, email: `aceite-won-${sufixo.toLowerCase()}@exemplo.invalid`,
    telefone: "11900000000", tipo: "lead", sdrStatus: "qualified",
    empresaId: empresa.id, empresa: `${nome} Ltda`, responsavelId,
  }).returning({ id: leads.id });

  const [negocio] = await db.insert(negocios).values({
    organizacaoId, leadId: lead.id, empresaId: empresa.id,
    titulo: `${nome} — oportunidade`, status: "negociacao_iniciada",
    responsavelId, mrrEstimado: "1000.00",
  }).returning({ id: negocios.id });

  return { empresaId: empresa.id, leadId: lead.id, negocioId: negocio.id, nome };
}

/** Confere no banco tudo que um Won precisa ter deixado, independente do caminho. */
async function conferirEfeitos(cenario: Cenario, rotulo: string) {
  console.log(`\n── Efeitos do Won (${rotulo}) ──`);

  const [negocio] = await db.select().from(negocios).where(eq(negocios.id, cenario.negocioId)).limit(1);
  ok(`${rotulo}: negócio ficou 'ganho'`, negocio?.status === "ganho", `status=${negocio?.status}`);
  ok(`${rotulo}: ganhoAt preenchido`, !!negocio?.ganhoAt);

  const [lead] = await db.select().from(leads).where(eq(leads.id, cenario.leadId)).limit(1);
  ok(`${rotulo}: lead virou cliente`, lead?.tipo === "cliente", `tipo=${lead?.tipo}`);

  const [pessoa] = await db.select({ id: pessoas.id }).from(pessoas)
    .where(or(eq(pessoas.leadIdLegado, cenario.leadId), eq(pessoas.empresaId, cenario.empresaId))).limit(1);
  ok(`${rotulo}: Pessoa materializada no modelo canônico`, !!pessoa, pessoa ? `id=${pessoa.id}` : "NÃO CRIADA");

  const [cliente] = await db.select().from(clientes).where(eq(clientes.empresaId, cenario.empresaId)).limit(1);
  ok(`${rotulo}: conta de CS criada em 'clientes'`, !!cliente, cliente ? `id=${cliente.id}` : "NÃO CRIADA");
  ok(`${rotulo}: conta entrou na carteira com data`, !!cliente?.entrouCarteiraEm);
  ok(`${rotulo}: status financeiro 'ativo'`, cliente?.statusFinanceiro === "ativo", `status=${cliente?.statusFinanceiro}`);

  const marcos = await db.select({ id: csMarcos.id, codigo: csMarcos.codigo })
    .from(csMarcos).where(eq(csMarcos.empresaId, cenario.empresaId));
  ok(`${rotulo}: jornada de CS semeada`, marcos.length > 0, `${marcos.length} marcos (${marcos.map((m) => m.codigo).join(", ")})`);

  const ativs = await db.select({ tipo: atividades.tipo })
    .from(atividades).where(and(eq(atividades.negocioId, cenario.negocioId), eq(atividades.tipo, "negocio_ganho")));
  ok(`${rotulo}: atividade 'negocio_ganho' na timeline`, ativs.length === 1, `${ativs.length} registro(s)`);

  const mudancas = await db.select({ para: statusChanges.paraStatus })
    .from(statusChanges).where(and(eq(statusChanges.negocioId, cenario.negocioId), eq(statusChanges.paraStatus, "ganho")));
  ok(`${rotulo}: histórico com uma única transição pra 'ganho'`, mudancas.length === 1, `${mudancas.length} registro(s)`);

  const eventos = await db.select({ tipo: eventOutbox.eventType })
    .from(eventOutbox)
    .where(or(
      and(eq(eventOutbox.aggregateType, "negocio"), eq(eventOutbox.aggregateId, cenario.negocioId)),
      and(eq(eventOutbox.aggregateType, "lead"), eq(eventOutbox.aggregateId, cenario.leadId)),
    ));
  const tipos = eventos.map((e) => e.tipo);
  ok(`${rotulo}: evento DealWon publicado`, tipos.filter((t) => t === "DealWon").length === 1, tipos.join(", ") || "nenhum");
  ok(`${rotulo}: evento CustomerCreated publicado`, tipos.filter((t) => t === "CustomerCreated").length === 1);
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

  const sessao = await api("GET", "/api/me");
  if (sessao.status !== 200) {
    console.error("Sessão não autenticou:", sessao.status, sessao.texto.slice(0, 200));
    process.exit(1);
  }
  console.log(`Autenticado como ${admin.nome} (${admin.role}) · org ${org.nome}`);

  const cenarios: Cenario[] = [];
  try {
    // ── Caminho 1: Won MANUAL (PATCH /api/negocios/:id) ───────────────────
    console.log("\n═══ Caminho 1: Won manual pelo board ═══");
    const manual = await criarCenario(org.id, admin.id, "MANUAL");
    cenarios.push(manual);

    const semEvidencia = await api("PATCH", `/api/negocios/${manual.negocioId}`, { status: "ganho" });
    ok("gate de evidência barra ganho sem evidência", semEvidencia.status === 400, `HTTP ${semEvidencia.status}`);

    const evid = await api("POST", `/api/negocios/${manual.negocioId}/evidencia-manual`, {
      tipo: "financial_attestation", nota: `${TAG} venda fechada fora do fluxo de proposta`,
    });
    ok("evidência manual aceita", evid.status === 200 || evid.status === 201, `HTTP ${evid.status}`);

    const ganho = await api("PATCH", `/api/negocios/${manual.negocioId}`, { status: "ganho", mrrFechado: "1000.00" });
    ok("PATCH status=ganho aceito", ganho.status === 200, `HTTP ${ganho.status} ${ganho.texto.slice(0, 120)}`);
    await conferirEfeitos(manual, "manual");

    // Idempotência: repetir o PATCH não pode duplicar efeito.
    await api("PATCH", `/api/negocios/${manual.negocioId}`, { status: "ganho" });
    const ativsDepois = await db.select({ id: atividades.id })
      .from(atividades).where(and(eq(atividades.negocioId, manual.negocioId), eq(atividades.tipo, "negocio_ganho")));
    ok("manual: repetir o ganho não duplica a timeline", ativsDepois.length === 1, `${ativsDepois.length} registro(s)`);

    // ── Caminho 2: Won AUTOMÁTICO (marcarNegocioGanhoSeAindaNao) ──────────
    console.log("\n═══ Caminho 2: Won automático por evidência ═══");
    const auto = await criarCenario(org.id, admin.id, "AUTO");
    cenarios.push(auto);

    const { registrarEvidencia, marcarNegocioGanhoSeAindaNao } = await import("@/lib/crm/won-evidence");
    await registrarEvidencia({
      negocioId: auto.negocioId, organizacaoId: org.id, tipo: "stripe_payment",
      sourceRef: `${TAG}-sessao`, metadata: { origem: "aceite" },
    });
    await marcarNegocioGanhoSeAindaNao(auto.negocioId, org.id, { familiaHint: "CALLFACE_AI" });
    await conferirEfeitos(auto, "automático");

    // ── Os dois caminhos produzem o MESMO estado ──────────────────────────
    console.log("\n── Paridade entre os caminhos ──");
    const [cManual] = await db.select().from(clientes).where(eq(clientes.empresaId, manual.empresaId)).limit(1);
    const [cAuto] = await db.select().from(clientes).where(eq(clientes.empresaId, auto.empresaId)).limit(1);
    ok("ambos criaram conta de CS", !!cManual && !!cAuto);
    ok("ambos com o mesmo status financeiro", cManual?.statusFinanceiro === cAuto?.statusFinanceiro,
      `manual=${cManual?.statusFinanceiro} auto=${cAuto?.statusFinanceiro}`);

    const marcosManual = await db.select({ id: csMarcos.id }).from(csMarcos).where(eq(csMarcos.empresaId, manual.empresaId));
    const marcosAuto = await db.select({ id: csMarcos.id }).from(csMarcos).where(eq(csMarcos.empresaId, auto.empresaId));
    ok("ambos semearam a mesma jornada de CS", marcosManual.length === marcosAuto.length && marcosManual.length > 0,
      `manual=${marcosManual.length} auto=${marcosAuto.length}`);
  } finally {
    if (process.env.ACEITE_MANTER === "1") {
      console.log("\nACEITE_MANTER=1 — cenários preservados no banco para inspeção.");
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
