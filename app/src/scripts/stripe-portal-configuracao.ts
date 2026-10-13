/**
 * Mostra o que o ONFACE faria com a configuração do Portal do cliente no Stripe.
 *
 *   # PADRÃO: só lê (GET /v1/billing_portal/configurations). Não altera nada.
 *   npx tsx --env-file=.env src/scripts/stripe-portal-configuracao.ts --simular
 *
 *   # cria ou atualiza A CONFIGURAÇÃO DO ONFACE (marca crm_portal) na conta LIVE. Nunca toca a padrão nem a do SaaS.
 *   npx tsx --env-file=.env src/scripts/stripe-portal-configuracao.ts --aplicar
 *
 * Responde: qual configuração o portal vai usar, se ela diverge do que o código quer
 * e o que falta no ambiente (STRIPE_PORTAL_PRIVACY_URL / STRIPE_PORTAL_TERMS_URL) para criar a própria.
 */
import {
  decidirConfiguracao, divergenciasDaConfiguracao, ehDoOnface, ehDoSaaS, riscosDeConfiguracaoAlheia, type ConfiguracaoDoStripe,
} from "@/lib/integrations/stripe-portal-config";

const tem = (n: string) => process.argv.includes(`--${n}`);

async function listar(): Promise<ConfiguracaoDoStripe[]> {
  const key = process.env.STRIPE_API_KEY || process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_API_KEY não configurada (chave de leitura basta)");
  const r = await fetch("https://api.stripe.com/v1/billing_portal/configurations?limit=100", { headers: { Authorization: `Bearer ${key}` } });
  if (!r.ok) throw new Error(`Stripe GET billing_portal/configurations: HTTP ${r.status} ${(await r.text()).slice(0, 300)}`);
  return ((await r.json()) as { data: ConfiguracaoDoStripe[] }).data;
}

async function main() {
  const lista = await listar();
  const fixadoId = process.env.STRIPE_PORTAL_CONFIGURATION_ID || null;
  const politicas = { privacyUrl: process.env.STRIPE_PORTAL_PRIVACY_URL, termsUrl: process.env.STRIPE_PORTAL_TERMS_URL };

  console.log(`${lista.length} configuração(ões) na conta:`);
  for (const c of lista) {
    const dono = ehDoSaaS(c) ? "SaaS (intocável)" : ehDoOnface(c) ? "ONFACE" : c.is_default ? "padrão da conta (Dashboard)" : "sem dono";
    console.log(`  ${c.id}  ${c.active === false ? "inativa" : "ativa"}  ${dono}`);
    if (!ehDoSaaS(c) && !ehDoOnface(c)) for (const r of riscosDeConfiguracaoAlheia(c)) console.log(`      risco: ${r}`);
    if (ehDoOnface(c)) for (const d of divergenciasDaConfiguracao(c)) console.log(`      diverge: ${d}`);
  }

  const d = decidirConfiguracao({ fixadoId, lista, politicas });
  console.log(`\nSTRIPE_PORTAL_CONFIGURATION_ID=${fixadoId ?? "(não definido)"}`);
  console.log(`STRIPE_PORTAL_PRIVACY_URL/TERMS_URL=${politicas.privacyUrl && politicas.termsUrl ? "definidos" : "FALTAM"}`);
  switch (d.acao) {
    case "usar_fixada":
      console.log(`Decisão: usar a configuração FIXADA ${d.id} (escolha explícita do operador).`);
      for (const r of d.riscos) console.log(`  risco: ${r}`);
      if (d.riscos.length) console.log("  Para trocar pela do ONFACE: defina as URLs de política, remova STRIPE_PORTAL_CONFIGURATION_ID e rode com --aplicar.");
      break;
    case "recusar_fixada": console.log(`Decisão: RECUSAR a fixada ${d.id}: ${d.motivo}.`); break;
    case "reusar": console.log(`Decisão: usar a configuração do ONFACE ${d.id} (sem divergência).`); break;
    case "atualizar": console.log(`Decisão: ATUALIZAR ${d.id} (${d.diferencas.length} divergência(s)).`); break;
    case "criar":
      console.log("Decisão: CRIAR a configuração do ONFACE.");
      if (d.semPoliticas) console.log("  Atenção: sem as URLs de política o Stripe pode recusar; nesse caso o botão do Cliente 360 mostra o que falta (422), não um 400.");
      break;
  }
  if (!tem("aplicar")) { console.log("\n(simulação: nada foi alterado. Acrescente --aplicar para criar/atualizar a configuração do ONFACE.)"); return; }
  if (fixadoId) { console.log("\n--aplicar ignorado: há STRIPE_PORTAL_CONFIGURATION_ID fixado. Remova a variável para o ONFACE gerir a própria configuração."); return; }
  const { configurarPortal } = await import("@/lib/integrations/stripe-portal");
  console.log("\nResultado:", await configurarPortal());
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; });
