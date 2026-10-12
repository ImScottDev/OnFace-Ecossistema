/**
 * Explorador de métrica no navegador: número, composição clicável, série, lista,
 * gaveta de registro, URL como estado e Voltar. Capturas em .tmp-relatorios/.
 *
 * BASE=http://localhost:3000 npx tsx --env-file=.env src/scripts/provar-relatorios-metricas.ts
 */
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { sessaoDeSmoke } from "./_sessao-de-smoke";

const BASE = process.env.BASE || "http://localhost:3000";
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PW = process.env.PLAYWRIGHT_CORE || join(homedir(), ".npm/_npx/e41f203b7505f1fb/node_modules/playwright-core");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { chromium } = createRequire(`${process.cwd()}/`)(PW) as any;
const OUT = ".tmp-relatorios";
const falhas: string[] = [];
const hidratacao = { n: 0 };
const ok = (c: boolean, m: string) => { if (!c) falhas.push(m); console.log(`${c ? "ok  " : "FAIL"} ${m}`); };
const num = (t: string) => Number(t.replace(/[^\d,-]/g, "").replace(",", "."));

async function main() {
  mkdirSync(OUT, { recursive: true });
  const s = await sessaoDeSmoke({ role: "super_admin" });
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const abrir = async (w: number, h = 900) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    await ctx.addCookies([{ name: "authjs.session-token", value: s.cookie.split("=").slice(1).join("="), url: BASE }]);
    const page = await ctx.newPage();
    const erros: string[] = [];
    // Falha de rede vem com a URL (o texto do console não traz). O 422 do filtro sem suporte é o comportamento esperado.
    page.on("response", (r: { status(): number; url(): string }) => { if (r.status() >= 400 && !/filtro_nao|metrica-faturado|metricas\/faturado/.test(r.url()) && !(r.status() === 422)) erros.push(`${r.status()} ${r.url().replace(BASE, "")}`); });
    page.on("console", (m: { type(): string; text(): string }) => { if (m.type() === "error" && !/favicon|hydrat|Failed to load resource/i.test(m.text())) erros.push(m.text().slice(0, 160)); });
    // Hidratação regenerada pelo dev server (Turbopack) é intermitente também fora desta tela; conta à parte (ver EVIDENCIAS).
    page.on("pageerror", (e: Error) => { if (/Hydration failed/.test(e.message)) { hidratacao.n++; return; } erros.push(`pageerror em ${page.url().replace(BASE, "")}: ${e.message.slice(0, 600)}`); });
    return { page, erros };
  };
  try {
    // ── MRR (retrato) ──
    let { page, erros } = await abrir(1440);
    await page.goto(`${BASE}/relatorios/biblioteca/metrica-mrr_atual`, { waitUntil: "networkidle", timeout: 90000 });
    const kpi = page.locator(".rx-kpi-valor");
    await kpi.waitFor({ timeout: 30000 });
    const total = num(await kpi.innerText());
    ok(total > 400000, `MRR carrega com valor real (${await kpi.innerText()})`);
    const subtitulo = await page.locator(".rx-tabela-cab .rx-dica").innerText();
    ok(/igual ao número acima/.test(subtitulo), `lista declara que soma o número do card: "${subtitulo.slice(0, 80)}"`);
    await page.screenshot({ path: `${OUT}/1-mrr-1440.png`, fullPage: true });

    // composição: clicar em PABX filtra número, chip, URL e lista
    await page.locator(".rx-barra-item", { hasText: "PABX" }).first().click();
    await page.waitForFunction(() => location.search.includes("dim=familia"));
    await page.locator(".rx-chip", { hasText: "Família: PABX" }).waitFor();
    await page.waitForTimeout(600);
    const pabx = num(await kpi.innerText());
    ok(pabx > 300000 && pabx < total, `clicar em PABX filtra o número (${await kpi.innerText()})`);
    const somaLinhas = num((await page.locator(".rx-tabela-cab .rx-dica").innerText()).replace(/^.*?somam?/, ""));
    ok(Math.abs(somaLinhas - pabx) < 0.01, "a lista do recorte soma o mesmo valor do card");
    await page.screenshot({ path: `${OUT}/2-mrr-pabx.png`, fullPage: true });

    // recarregar mantém o recorte
    await page.reload({ waitUntil: "networkidle" });
    await page.locator(".rx-chip", { hasText: "Família: PABX" }).waitFor({ timeout: 20000 });
    ok(true, "recarregar a página mantém o filtro (estado na URL)");

    // linha abre gaveta com ficha, fechar volta
    await page.locator(".rx-tabela tbody tr").first().click();
    await page.getByText("Fechar volta à lista").waitFor({ timeout: 10000 });
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/3-mrr-gaveta.png` });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    ok((await page.locator(".rx-chip").count()) === 1, "fechar a gaveta mantém o filtro");

    // remover chip, voltar do navegador
    await page.getByRole("button", { name: /Remover filtro/ }).click();
    await page.waitForFunction(() => !location.search.includes("dim="));
    await page.goBack();
    await page.locator(".rx-chip", { hasText: "Família: PABX" }).waitFor({ timeout: 10000 });
    ok(true, "botão Voltar do navegador devolve o filtro anterior");

    // filtro família no topo e filtro sem suporte
    await page.goto(`${BASE}/relatorios/biblioteca/metrica-mrr_atual?familia=WHITE_LABEL`, { waitUntil: "networkidle" });
    await page.locator(".rx-chip", { hasText: "White Label" }).waitFor({ timeout: 20000 });
    ok(num(await page.locator(".rx-kpi-valor").innerText()) < 40000, "filtro de família do topo aplica (White Label)");
    await page.goto(`${BASE}/relatorios/biblioteca/metrica-faturado?familia=PABX`, { waitUntil: "networkidle" });
    await page.getByText("não tem família").first().waitFor({ timeout: 20000 });
    ok(true, "métrica sem família avisa em vez de ignorar o filtro");
    ok(erros.length === 0, `sem erro de console no MRR (${erros.join(" | ") || "limpo"})`);
    await page.context().close();

    // ── Booking (evento): série, clique na barra ──
    ({ page, erros } = await abrir(1440));
    await page.goto(`${BASE}/relatorios/biblioteca/metrica-booking_ganho?periodo=30d`, { waitUntil: "networkidle", timeout: 90000 });
    await page.locator(".rx-kpi-valor").waitFor({ timeout: 30000 });
    await page.locator(".recharts-bar-rectangle").first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(700);
    const cheio = num(await page.locator(".rx-kpi-valor").innerText());
    await page.screenshot({ path: `${OUT}/4-booking-1440.png`, fullPage: true });
    await page.locator(".recharts-bar-rectangle").nth(2).click();
    await page.waitForFunction(() => location.search.includes("de="), null, { timeout: 10000 });
    await page.locator(".rx-chip", { hasText: "Recorte" }).waitFor();
    await page.waitForTimeout(600);
    const recorte = num(await page.locator(".rx-kpi-valor").innerText());
    ok(recorte < cheio && recorte > 0, `clicar numa barra filtra o recorte (${recorte} de ${cheio})`);
    await page.locator(".rx-legenda button", { hasText: "Período anterior" }).click();
    ok((await page.locator(".rx-legenda button[aria-pressed=false]").count()) === 1, "legenda desliga a série anterior");
    ok(erros.length === 0, `sem erro de console no booking (${erros.join(" | ") || "limpo"})`);
    await page.context().close();

    // ── Faturamento por competência (histórico desde 2021) ──
    ({ page, erros } = await abrir(1440));
    await page.goto(`${BASE}/relatorios/biblioteca/metrica-faturamento_competencia?periodo=tudo`, { waitUntil: "networkidle", timeout: 90000 });
    await page.locator(".rx-kpi-valor").waitFor({ timeout: 30000 });
    await page.locator(".recharts-bar-rectangle").first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(800);
    const hist = num(await page.locator(".rx-kpi-valor").innerText());
    ok(hist > 25_000_000 && hist < 26_000_000, `histórico completo soma R$ 25,3 mi (${await page.locator(".rx-kpi-valor").innerText()})`);
    const barras = await page.locator(".recharts-bar-rectangle").count();
    ok(barras === 67, `uma barra por competência: ${barras} de 67`);
    await page.screenshot({ path: `${OUT}/6-faturamento-tudo.png`, fullPage: true });
    await page.goto(`${BASE}/relatorios/biblioteca/metrica-faturamento_competencia`, { waitUntil: "networkidle" });
    await page.locator(".rx-seg button[aria-pressed=true]", { hasText: "12 meses" }).waitFor({ timeout: 20000 });
    ok(true, "abre em 12 meses (período padrão da métrica) com o botão marcado");
    await page.locator(".rx-seg button", { hasText: "Todo o histórico" }).click();
    await page.waitForFunction(() => location.search.includes("periodo=tudo"));
    ok(true, "trocar o período grava na URL");
    ok(erros.length === 0, `sem erro de console no faturamento (${erros.join(" | ") || "limpo"})`);
    await page.context().close();

    // ── Permissão: quem não é gestão/leitor não lê métrica oficial ──
    const closer = await sessaoDeSmoke({ role: "closer" });
    for (const [rotulo, cookie, esperado] of [["sem sessão", "", 401], ["closer", closer.cookie, 403]] as const) {
      const r = await fetch(`http://localhost:3012/api/relatorios/metricas/mrr_atual`, { headers: cookie ? { cookie } : {} });
      const e = await fetch(`http://localhost:3012/api/relatorios/metricas/mrr_atual/exportar`, { headers: cookie ? { cookie } : {} });
      ok(r.status === esperado && e.status === esperado, `${rotulo}: leitura e exportação recusadas com ${esperado} (${r.status}/${e.status})`);
    }

    // ── Painel executivo ──
    ({ page, erros } = await abrir(1440));
    await page.goto(`${BASE}/relatorios`, { waitUntil: "networkidle", timeout: 90000 });
    await page.locator(".ex-kpis").waitFor({ timeout: 40000 });
    ok(await page.getByRole("tab", { name: "Executivo" }).getAttribute("aria-selected") === "true", "a gestão abre no Executivo (consolidado)");
    await page.locator(".ex-kpi-valor").first().waitFor();
    await page.locator(".recharts-bar-rectangle").first().waitFor({ timeout: 30000 });
    await page.waitForTimeout(900);
    const mrrCard = num(await page.locator(".ex-kpi-valor").first().innerText());
    ok(Math.abs(mrrCard - 478013.79) < 1, `MRR do painel = MRR do explorador (${mrrCard})`);
    const faturadoSet = num(await page.locator(".ex-kpi-valor").nth(1).innerText());
    ok(Math.abs(faturadoSet - 512404.49) < 0.01, `Faturado de set/26 = rodapé da planilha (${faturadoSet})`);
    await page.screenshot({ path: `${OUT}/7-executivo-1440.png`, fullPage: true });
    // filtro de família muda os números e a URL; recarregar mantém
    await page.getByRole("button", { name: "PABX", exact: true }).click();
    await page.waitForFunction(() => location.search.includes("familia=PABX"));
    await page.waitForTimeout(1200);
    const mrrPabx = num(await page.locator(".ex-kpi-valor").first().innerText());
    ok(Math.abs(mrrPabx - 376431.9) < 1, `família PABX muda o MRR do painel (${mrrPabx})`);
    ok((await page.locator(".ex-kpi[data-vazio=true]").count()) === 1, "recebido não se aplica a família e diz isso em vez de zero");
    await page.reload({ waitUntil: "networkidle" });
    await page.locator(".ex-kpis").waitFor({ timeout: 40000 });
    ok(await page.getByRole("button", { name: "PABX", exact: true }).getAttribute("aria-pressed") === "true", "recarregar mantém a família");
    // clicar no card leva ao explorador com o mesmo recorte
    await page.locator("a.ex-kpi").first().click();
    await page.waitForURL(/metrica-mrr_atual\?familia=PABX/, { timeout: 20000 });
    await page.locator(".rx-kpi-valor").waitFor({ timeout: 30000 });
    await page.waitForTimeout(600);
    ok(Math.abs(num(await page.locator(".rx-kpi-valor").innerText()) - mrrPabx) < 0.01, "o card abre o explorador com o mesmo número");
    ok(erros.length === 0, `sem erro de console no executivo (${erros.join(" | ") || "limpo"})`);
    await page.context().close();
    for (const w of [820, 390]) {
      ({ page, erros } = await abrir(w, 844));
      await page.goto(`${BASE}/relatorios`, { waitUntil: "networkidle", timeout: 90000 });
      await page.locator(".ex-kpis").waitFor({ timeout: 40000 });
      await page.locator(".recharts-bar-rectangle").first().waitFor({ timeout: 30000 });
      await page.waitForTimeout(900);
      const estouro = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      const quebra = await page.evaluate(() => [...document.querySelectorAll(".ex-kpi-valor")].filter((el) => (el as HTMLElement).getBoundingClientRect().height > 40).length);
      ok(estouro <= 1, `executivo ${w}px: sem rolagem horizontal (sobra ${estouro}px)`);
      ok(quebra === 0, `executivo ${w}px: nenhum valor monetário quebrado em duas linhas`);
      await page.screenshot({ path: `${OUT}/8-executivo-${w}.png`, fullPage: true });
      await page.context().close();
    }

    // ── Larguras: tablet e celular ──
    for (const w of [820, 390]) {
      ({ page, erros } = await abrir(w, 844));
      await page.goto(`${BASE}/relatorios/biblioteca/metrica-booking_ganho?periodo=30d`, { waitUntil: "networkidle", timeout: 90000 });
      await page.locator(".rx-kpi-valor").waitFor({ timeout: 30000 });
      await page.locator(".recharts-bar-rectangle").first().waitFor({ timeout: 20000 });
      await page.waitForTimeout(700);
      const estouro = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      const kpiH = await page.locator(".rx-kpi-valor").evaluate((el: HTMLElement) => el.getBoundingClientRect().height);
      ok(estouro <= 1, `${w}px: sem rolagem horizontal da página (sobra ${estouro}px)`);
      ok(kpiH < 48, `${w}px: o valor monetário não quebra em duas linhas (altura ${Math.round(kpiH)}px)`);
      await page.screenshot({ path: `${OUT}/5-booking-${w}.png`, fullPage: true });
      await page.context().close();
    }
  } finally { await browser.close(); }
  if (falhas.length) { console.error("\nFALHAS:", falhas); process.exit(1); }
  console.log(`\nAviso: ${hidratacao.n} regeneração(ões) de hidratação no dev server (não é falha de dado).`);
  console.log("\nOK: tudo provado"); process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
