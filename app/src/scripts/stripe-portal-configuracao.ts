/**
 * Mostra — e, só com --aplicar, faz — o que o ONFACE quer na configuração do Portal do cliente no Stripe.
 *
 *   # PADRÃO: só lê (GET). Não altera nada na conta.
 *   npx tsx --env-file=.env src/scripts/stripe-portal-configuracao.ts --simular
 *
 *   # cria ou atualiza A CONFIGURAÇÃO DO ONFACE (marca crm_portal) na conta LIVE. Nunca toca a padrão nem a do SaaS.
 *   npx tsx --env-file=.env src/scripts/stripe-portal-configuracao.ts --aplicar
 *
 *   # catálogo de outra organização (por padrão, a única com catálogo oficial_stripe):
 *   ... --organizacao <uuid>
 *
 * Idempotente: sem divergência, --aplicar não escreve nada; com divergência, ATUALIZA a configuração que já
 * existe (nunca cria uma segunda). Os planos da troca de plano vêm do catálogo do ONFACE no banco, conferido no
 * Stripe, sem nenhum produto do SaaS (ver lib/integrations/stripe-portal-planos.ts).
 *
 * Responde: o que muda, campo a campo, e o que falta no ambiente (STRIPE_PORTAL_PRIVACY_URL / STRIPE_PORTAL_TERMS_URL).
 */
import { montarRelatorioDoPortal } from "@/lib/integrations/stripe-portal-relatorio";
import type { ConfiguracaoDoStripe } from "@/lib/integrations/stripe-portal-config";
import type { PlanosResolvidos } from "@/lib/integrations/stripe-portal-planos";

const tem = (n: string) => process.argv.includes(`--${n}`);
const valorDe = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };

async function organizacaoDoCatalogo(): Promise<string | null> {
  const pedida = valorDe("organizacao");
  if (pedida) return pedida;
  const { db } = await import("@/lib/db");
  const { servicosCatalogo } = await import("@/lib/db/schema");
  const { eq } = await import("drizzle-orm");
  const linhas = await db.selectDistinct({ id: servicosCatalogo.organizacaoId }).from(servicosCatalogo).where(eq(servicosCatalogo.origemCatalogo, "oficial_stripe"));
  if (linhas.length > 1) throw new Error("Há mais de uma organização com catálogo oficial_stripe: informe --organizacao <uuid>.");
  return linhas[0]?.id ?? null;
}

async function main() {
  if (!(process.env.STRIPE_API_KEY || process.env.STRIPE_SECRET_KEY)) throw new Error("STRIPE_API_KEY não configurada (chave de leitura basta para --simular)");
  const { stripe, configurarPortal } = await import("@/lib/integrations/stripe-portal");
  const ler = <T>(caminho: string) => stripe<T>(caminho);

  const configuracoes = (await ler<{ data: ConfiguracaoDoStripe[] }>("billing_portal/configurations?limit=100")).data;
  const fixadoId = process.env.STRIPE_PORTAL_CONFIGURATION_ID || null;
  const politicas = { privacyUrl: process.env.STRIPE_PORTAL_PRIVACY_URL, termsUrl: process.env.STRIPE_PORTAL_TERMS_URL };

  let planos: PlanosResolvidos | null = null;
  const nomes: Record<string, string> = {};
  if (process.env.DATABASE_URL) {
    const organizacaoId = await organizacaoDoCatalogo();
    if (organizacaoId) {
      const { lerCatalogoDoOnface, conferirComOStripe } = await import("@/lib/integrations/stripe-portal-planos-db");
      const catalogo = await lerCatalogoDoOnface(organizacaoId);
      for (const p of catalogo) if (p.stripeProductId) nomes[p.stripeProductId] = p.nome;
      planos = await conferirComOStripe(catalogo, ler);
    }
  }

  for (const linha of montarRelatorioDoPortal({ configuracoes, fixadoId, politicas, planos, nomes })) console.log(linha);

  if (!tem("aplicar")) { console.log("\n(simulação: nada foi alterado. Acrescente --aplicar para criar/atualizar a configuração do ONFACE.)"); return; }
  if (fixadoId) { console.log("\n--aplicar ignorado: há STRIPE_PORTAL_CONFIGURATION_ID fixado. Remova a variável para o ONFACE gerir a própria configuração."); return; }
  if (!planos) console.log("\nAtenção: planos não resolvidos; a configuração será aplicada SEM a seção de troca de plano.");
  console.log("\nResultado:", await configurarPortal({ planos: planos ? planos.planos : null }));
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; });
