/**
 * Prova no NAVEGADOR (somente leitura) do card "Relações em andamento":
 *  - lead em Pré-vendas mostra Aquisição (não "Nada em andamento");
 *  - pessoa e empresa de CLIENTE ATIVO mostram o acesso ao Cliente 360 e abrem /clientes/<empresa>;
 *  - ganho sem serviço ativo não aparece como "Cliente ativo".
 * Evidências em .tmp-relacoes/*.png. Não grava nada.
 *
 * BASE=http://localhost:3000 npx tsx --env-file=.env src/scripts/provar-relacoes-da-ficha.ts
 */
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessaoDeSmoke } from "./_sessao-de-smoke";

const BASE = process.env.BASE || "http://localhost:3000";
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PW = process.env.PLAYWRIGHT_CORE || join(homedir(), ".npm/_npx/e41f203b7505f1fb/node_modules/playwright-core");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { chromium } = createRequire(`${process.cwd()}/`)(PW) as any;
const OUT = ".tmp-relacoes";

async function main() {
  mkdirSync(OUT, { recursive: true });
  const s = await sessaoDeSmoke({ role: "admin" });
  const org = s.organizacaoId;
  const um = async (q: ReturnType<typeof sql>) => (await db.execute<{ id: string; empresa_id: string | null }>(q))[0];

  const preVendas = await um(sql`
    SELECT l.id::text, l.empresa_id::text FROM leads l
     WHERE l.organizacao_id = ${org}::uuid AND l.estagio_pre_vendas IN ('novo','em_contato','qualificacao')
       AND NOT EXISTS (SELECT 1 FROM servicos_canonicos s WHERE s.empresa_id = l.empresa_id)
       AND NOT EXISTS (SELECT 1 FROM oportunidades o WHERE o.lead_id = l.id)
       AND l.empresa_id IS NOT NULL
       -- Lead de verdade em Pré-vendas tem aquisição aberta; o inserido cru por outro teste não tem e não é o que se prova aqui.
       AND EXISTS (SELECT 1 FROM aquisicoes a WHERE a.lead_legado_id = l.id AND a.closed_at IS NULL)
     ORDER BY l.created_at DESC LIMIT 1`);
  const cliente = await um(sql`
    SELECT l.id::text, l.empresa_id::text FROM leads l
     WHERE l.organizacao_id = ${org}::uuid AND l.empresa_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM servicos_canonicos s WHERE s.empresa_id = l.empresa_id AND s.commercial_lifecycle = 'ACTIVE')
       AND EXISTS (SELECT 1 FROM clientes c WHERE c.empresa_id = l.empresa_id)
     LIMIT 1`);
  const ganhoSemServico = await um(sql`
    SELECT l.id::text, l.empresa_id::text FROM leads l
     WHERE l.organizacao_id = ${org}::uuid AND l.empresa_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM oportunidades o WHERE o.lead_id = l.id AND o.etapa = 'ganho')
       AND NOT EXISTS (SELECT 1 FROM servicos_canonicos s WHERE s.empresa_id = l.empresa_id AND s.commercial_lifecycle = 'ACTIVE')
     LIMIT 1`);

  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addCookies([{ name: "authjs.session-token", value: s.cookie.split("=").slice(1).join("="), url: BASE }]);
  const page = await ctx.newPage();
  const falhas: string[] = [];
  const card = async (rota: string, nome: string) => {
    await page.goto(`${BASE}${rota}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(800);
    const texto = await page.locator("body").innerText();
    await page.screenshot({ path: `${OUT}/${nome}.png` });
    return texto;
  };
  const confere = (ok: boolean, msg: string) => { console.log(`${ok ? "OK " : "FALHA"} ${msg}`); if (!ok) falhas.push(msg); };

  try {
    if (preVendas) {
      const t = await card(`/pessoas/${preVendas.id}`, "1-pessoa-prevendas");
      confere(/PRÉ-VENDAS/i.test(t) && !/Nada em andamento/.test(t), "pessoa em Pré-vendas mostra Aquisição, sem 'Nada em andamento'");
      const e = await card(`/empresas/${preVendas.empresa_id}`, "2-empresa-prevendas");
      confere(!/Nada em andamento/.test(e), "empresa com lead em Pré-vendas não diz 'Nada em andamento'");
    } else console.log("SEM DADO: lead em Pré-vendas sem oportunidade/serviço");

    if (cliente) {
      const t = await card(`/pessoas/${cliente.id}`, "3-pessoa-cliente");
      confere(/Cliente ativo/.test(t) && /Cliente 360/i.test(t), "pessoa cliente mostra 'Cliente ativo' e Cliente 360");
      await page.getByText(/Abrir Cliente 360/i).first().click();
      await page.waitForURL(`**/clientes/${cliente.empresa_id}*`, { timeout: 30000 }).then(() => confere(true, "clique abre /clientes/<empresa>"), () => confere(false, "clique abre /clientes/<empresa>"));
      const e = await card(`/empresas/${cliente.empresa_id}`, "4-empresa-cliente");
      confere(/Cliente ativo/.test(e) && /Cliente 360/i.test(e), "empresa cliente mostra 'Cliente ativo' e Cliente 360");
    } else console.log("SEM DADO: cliente ativo com ficha");

    if (ganhoSemServico) {
      const t = await card(`/pessoas/${ganhoSemServico.id}`, "5-pessoa-ganho-sem-servico");
      confere(!/Cliente ativo/.test(t) && /Ganho, sem serviço ativo/.test(t), "ganho sem serviço ativo não é 'Cliente ativo'");
    } else console.log("SEM DADO: ganho sem serviço ativo");
  } finally {
    await browser.close();
  }
  if (falhas.length) { console.error("FALHAS:", falhas); process.exit(1); }
  console.log("prova ok");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
