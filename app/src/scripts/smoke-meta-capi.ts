/**
 * Smoke da cadeia Meta, ponta a ponta (SPEC §20).
 *
 * Percorre o ciclo de vida inteiro que volta para a Meta, na ordem em que
 * acontece de verdade, e verifica o que cada etapa produz:
 *
 *     AcquisitionCreated    → Lead
 *     AcquisitionQualified  → QualifiedLead     (o que mais importa)
 *     MeetingScheduled      → Schedule
 *     OpportunityCreated    → OpportunityCreated
 *     ProposalSent          → ProposalSent
 *     ProposalAccepted      → ProposalAccepted
 *     OpportunityWon        → OpportunityWon
 *     PaymentConfirmed      → Purchase          (com value e currency)
 *
 * Com `META_CAPI_TEST_EVENT_CODE` configurado, os eventos aparecem na aba Test
 * Events do gerenciador em vez de contarem como conversão real — é como se
 * confere isto sem sujar a campanha.
 *
 * Também prova as duas regras que mudam o resultado: o mesmo fato reenviado
 * gera o MESMO event_id (a Meta deduplica), e um fato sem touchpoint Meta NÃO
 * é devolvido.
 *
 *     pnpm tsx src/scripts/smoke-meta-capi.ts          # só valida, não envia
 *     pnpm tsx src/scripts/smoke-meta-capi.ts --enviar # envia de verdade
 */
import {
  POLITICA_EVENTOS, regraDoEvento, veioDaMeta, idDeterministicoDoEvento,
  montarEventoCapi, enviarParaCapi, credenciaisCapi, diagnosticoMeta,
  type EventoDominioMeta,
} from "@onface/integrations-meta";

const ENVIAR = process.argv.includes("--enviar");

const ORDEM: EventoDominioMeta[] = [
  "AcquisitionCreated", "AcquisitionQualified", "MeetingScheduled",
  "OpportunityCreated", "ProposalSent", "ProposalAccepted",
  "OpportunityWon", "PaymentConfirmed",
];

async function main() {
  const cred = credenciaisCapi();
  const diag = diagnosticoMeta();
  console.log("\n  CONFIGURAÇÃO");
  for (const [k, v] of Object.entries(diag)) console.log(`    ${k.padEnd(22)} ${v}`);

  // Um "lead" fictício com touchpoint Meta, como um lead real de Lead Ads teria.
  const agora = Math.floor(Date.now() / 1000);
  const marca = `smoke-${Date.now()}`;
  const atribuicao = { metaLeadId: `lead-${marca}`, fbc: "fb.1.1700000000.AbCdEf", fbp: "fb.1.1700000000.123456" };

  console.log("\n  CICLO DE VIDA → META");
  const eventos = ORDEM.map((tipo, i) => {
    const regra = regraDoEvento(tipo)!;
    const domainEventId = `${marca}-${i}`;
    const evento = {
      eventName: regra.nomeMeta,
      // Cada fato com o tempo DELE, espaçado: é assim que a jornada real
      // acontece, e a Meta usa isso para atribuir.
      eventTime: agora - (ORDEM.length - i) * 600,
      eventId: idDeterministicoDoEvento(domainEventId, regra.nomeMeta),
      leadId: atribuicao.metaLeadId,
      email: `${marca}@exemplo.local`,
      telefone: "11955554444",
      fbc: atribuicao.fbc,
      fbp: atribuicao.fbp,
      valor: regra.comValor ? 1490.0 : null,
      moeda: "BRL",
      actionSource: "system_generated" as const,
    };
    const corpo = montarEventoCapi(evento);
    const temValor = Boolean((corpo.custom_data as { value?: number } | undefined)?.value);
    console.log(`    ${tipo.padEnd(21)} → ${regra.nomeMeta.padEnd(19)} ${regra.padrao ? "padrão" : "custom"}${temValor ? "  R$ 1.490,00" : ""}`);
    return evento;
  });

  console.log("\n  REGRAS");
  const checagens: [string, boolean, string][] = [
    ["com touchpoint", veioDaMeta(atribuicao), "lead da Meta volta para a Meta"],
    ["sem touchpoint", !veioDaMeta({}), "outbound puro NÃO volta como conversão"],
    ["Purchase com valor", Boolean(montarEventoCapi(eventos[7]).custom_data), "pagamento leva value e currency"],
    ["Lead sem valor", !montarEventoCapi(eventos[0]).custom_data, "formulário preenchido não tem valor"],
    ["QualifiedLead", POLITICA_EVENTOS.AcquisitionQualified.nomeMeta === "QualifiedLead", "o evento de otimização existe"],
    ["reenvio dedupe", idDeterministicoDoEvento(`${marca}-7`, "Purchase") === eventos[7].eventId, "o mesmo fato gera o mesmo event_id"],
  ];
  let ok = true;
  for (const [nome, passou, desc] of checagens) {
    if (!passou) ok = false;
    console.log(`    ${nome.padEnd(20)} ${passou ? "ok" : "FALHOU"}  (${desc})`);
  }

  if (!ENVIAR) {
    console.log(`\n  ${ok ? "SMOKE PASSOU (validação local)" : "SMOKE FALHOU"}`);
    console.log("  Para enviar de verdade: pnpm tsx src/scripts/smoke-meta-capi.ts --enviar");
    if (!cred.testEventCode) {
      console.log("  Configure META_CAPI_TEST_EVENT_CODE antes, senão os eventos contam como conversão real.\n");
    } else {
      console.log(`  Test Events ligado — os eventos aparecem na aba de teste do gerenciador.\n`);
    }
    process.exit(ok ? 0 : 1);
  }

  console.log("\n  ENVIANDO");
  if (!cred.testEventCode) {
    console.log("    AVISO: sem META_CAPI_TEST_EVENT_CODE, estes eventos contam como conversão REAL.");
  }
  const r = await enviarParaCapi(eventos, cred);
  console.log(`    resultado: ok=${r.ok} recebidos=${r.enviados ?? 0}${r.traceId ? ` trace=${r.traceId}` : ""}`);
  if (!r.ok) console.log(`    erro: ${r.erro}`);

  // Reenvio do MESMO fato: a Meta aceita e deduplica por event_id.
  const reenvio = await enviarParaCapi([eventos[7]], cred);
  console.log(`    reenvio do Purchase: ok=${reenvio.ok} recebidos=${reenvio.enviados ?? 0}`);
  console.log("    (a Meta aceita o reenvio e deduplica por event_id — conta uma vez só)");

  ok = ok && r.ok && reenvio.ok;
  console.log(`\n  ${ok ? "SMOKE PASSOU: a cadeia inteira chega na Meta" : "SMOKE FALHOU"}\n`);
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
