/**
 * Prova NO NAVEGADOR (Chrome headless + cookie de sessão) da tela do lead
 * /pre-vendas/[id], de ponta a ponta, contra o app local:
 *
 *  - abrir pelo drawer do board ("Abrir lead") e por link direto; F5 mantém;
 *  - editar qualificação (interesse, fit, tamanho, dor), observação, responsável,
 *    etapa e nota, e conferir DEPOIS DE RECARREGAR na própria tela, no drawer do
 *    board, na ficha da Pessoa e na da Empresa;
 *  - converter em oportunidade (redireciona para /pipeline/<id>) e ver o reflexo;
 *  - nutrição (motivo + quando) e desqualificado (motivo obrigatório + Reativar);
 *  - lead sem empresa (criar oportunidade desabilitado com motivo);
 *  - console e rede limpos; 390px sem rolagem horizontal.
 *
 * Usa um lead de TESTE (prefixo `prova-tela-lead-`), criado e apagado por esta
 * rodada; não toca nos dados reais. Evidências em .tmp-tela-do-lead/*.png.
 *
 *   BASE=http://localhost:3000 npx tsx --env-file=.env src/scripts/provar-tela-do-lead.ts
 */
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { criarLead, moverEtapa, qualificar } from "@/lib/vendas/pre-vendas";
import { atorHumano } from "@/lib/vendas/dominio";
import { sessaoDeSmoke } from "./_sessao-de-smoke";

const BASE = process.env.BASE || "http://localhost:3000";
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = ".tmp-tela-do-lead";
const PREFIXO = "prova-tela-lead-%";
const marca = `prova-tela-lead-${Date.now()}`;

function achaPlaywright(): string {
  if (process.env.PLAYWRIGHT_CORE) return process.env.PLAYWRIGHT_CORE;
  const raiz = join(homedir(), ".npm/_npx");
  for (const d of existsSync(raiz) ? readdirSync(raiz) : []) {
    const p = join(raiz, d, "node_modules/playwright-core");
    if (existsSync(p)) return p;
  }
  throw new Error("playwright-core não encontrado (defina PLAYWRIGHT_CORE)");
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { chromium } = createRequire(`${process.cwd()}/`)(achaPlaywright()) as any;

const falhas: string[] = [];
const confere = (ok: boolean, msg: string) => { console.log(`${ok ? "OK   " : "FALHA"} ${msg}`); if (!ok) falhas.push(msg); };

async function limpar() {
  const meusLeads = sql`(SELECT id FROM leads WHERE nome LIKE ${PREFIXO})`;
  const minhasPessoas = sql`(SELECT id FROM pessoas WHERE nome LIKE ${PREFIXO})`;
  const minhasEmpresas = sql`(SELECT id FROM empresas WHERE nome LIKE ${PREFIXO})`;
  const meusNegocios = sql`(SELECT id FROM negocios WHERE lead_id IN ${meusLeads} OR empresa_id IN ${minhasEmpresas})`;
  for (const q of [
    sql`DELETE FROM notas WHERE lead_id IN ${meusLeads}`,
    sql`DELETE FROM entity_labels WHERE entity_type = 'lead' AND entity_id IN ${meusLeads}`,
    sql`DELETE FROM lead_labels WHERE lead_id IN ${meusLeads}`,
    sql`DELETE FROM contratos WHERE lead_id IN ${meusLeads}`,
    sql`DELETE FROM atividades WHERE lead_id IN ${meusLeads} OR negocio_id IN ${meusNegocios}`,
    sql`DELETE FROM tarefas WHERE lead_id IN ${meusLeads} OR negocio_id IN ${meusNegocios}`,
    sql`DELETE FROM status_changes WHERE lead_id IN ${meusLeads}`,
    sql`DELETE FROM vendas_eventos WHERE lead_id IN ${meusLeads} OR negocio_id IN ${meusNegocios}`,
    sql`DELETE FROM reunioes WHERE lead_id IN ${meusLeads} OR negocio_id IN ${meusNegocios}`,
    sql`DELETE FROM comercial_evidencia WHERE negocio_id IN ${meusNegocios}`,
    sql`DELETE FROM timeline_events WHERE aquisicao_id IN (SELECT id FROM aquisicoes WHERE lead_legado_id IN ${meusLeads})
         OR pessoa_id IN ${minhasPessoas} OR empresa_id IN ${minhasEmpresas}`,
    sql`DELETE FROM pontos_contato WHERE lead_id_legado IN ${meusLeads} OR pessoa_id IN ${minhasPessoas} OR empresa_id IN ${minhasEmpresas}`,
    sql`DELETE FROM oportunidades WHERE lead_id IN ${meusLeads} OR negocio_id_legado IN ${meusNegocios} OR empresa_id IN ${minhasEmpresas}`,
    sql`DELETE FROM negocios WHERE lead_id IN ${meusLeads} OR empresa_id IN ${minhasEmpresas}`,
    sql`DELETE FROM aquisicoes WHERE lead_legado_id IN ${meusLeads} OR pessoa_id IN ${minhasPessoas} OR empresa_id IN ${minhasEmpresas}`,
    sql`DELETE FROM event_outbox WHERE payload ->> 'lead_legado_id' IN (SELECT id::text FROM leads WHERE nome LIKE ${PREFIXO})`,
    sql`DELETE FROM domain_events WHERE payload ->> 'lead_legado_id' IN (SELECT id::text FROM leads WHERE nome LIKE ${PREFIXO})`,
    sql`DELETE FROM pessoa_empresa_vinculos WHERE pessoa_id IN ${minhasPessoas} OR empresa_id IN ${minhasEmpresas}`,
    sql`DELETE FROM pessoas WHERE nome LIKE ${PREFIXO}`,
    sql`DELETE FROM leads WHERE nome LIKE ${PREFIXO}`,
    sql`UPDATE leads SET empresa_id = NULL WHERE empresa_id IN ${minhasEmpresas}`,
    sql`DELETE FROM empresas WHERE nome LIKE ${PREFIXO}`,
  ]) await db.execute(q).catch((e) => console.warn("  limpeza:", String(e).slice(0, 120)));
  await db.execute(sql`
    DELETE FROM backfill_provenance bp WHERE bp.entidade_canonica = 'aquisicao'
      AND NOT EXISTS (SELECT 1 FROM aquisicoes a WHERE a.id = bp.id_canonico)`).catch(() => undefined);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  await limpar();
  const s = await sessaoDeSmoke({ role: "admin" });
  const org = s.organizacaoId;
  const ator = atorHumano(s.usuarioId);
  const [outro] = await db.execute<{ id: string; nome: string }>(sql`
    SELECT id::text, nome FROM usuarios WHERE organizacao_id = ${org}::uuid AND ativo = true AND id <> ${s.usuarioId}::uuid ORDER BY nome LIMIT 1`);

  let fone = 11987650000;
  const novo = async (sufixo: string, comEmpresa = true) => {
    const r = await criarLead({
      organizacaoId: org,
      empresa: comEmpresa ? { nome: `${marca} Ltda ${sufixo}` } : null,
      pessoa: { nome: `${marca}-${sufixo}`, email: `${marca}-${sufixo}@teste.local`, telefone: String(++fone), cargo: "Diretora" },
      touchpoint: { tipoOrigem: "organica", source: "prova" },
      origem: "Manual", responsavelId: s.usuarioId,
    } as never, ator);
    return r;
  };
  const a = await novo("a");
  await moverEtapa({ organizacaoId: org, leadId: a.leadId, para: "em_contato", ator });
  const semEmpresa = await novo("sem", false);
  const paraNutrir = await novo("nutri");

  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addCookies([{ name: "authjs.session-token", value: s.cookie.split("=").slice(1).join("="), url: BASE }]);
  const page = await ctx.newPage();
  page.setDefaultTimeout(60000);

  /* Console e rede: tudo que não for ruído conhecido derruba a prova. */
  const ruido: string[] = [];
  page.on("console", (m: { type(): string; text(): string; location(): { url: string } }) => {
    /* Conhecido e FORA desta tela: o board (PreVendasDesenho, gerado) renderiza o placeholder da coluna
       vazia com estilo diferente no servidor e no cliente quando a busca esvazia colunas. Não é da tela do lead. */
    if (page.url().includes("/pre-vendas?busca=") && /didn't match the client properties/.test(m.text())) return;
    // Aviso do Next em desenvolvimento (preload de CSS que o chunk usa depois): não é da tela.
    if (/preloaded using link preload but not used/.test(m.text())) return;
    // O app não tem /favicon.ico (o Chrome pede uma vez e leva 404): é do produto, não desta tela.
    if (m.location().url.endsWith("/favicon.ico")) return;
    if (["error", "warning"].includes(m.type())) ruido.push(`console ${m.type()} em ${page.url().replace(BASE, "")} (${m.location().url.replace(BASE, "")}): ${m.text().slice(0, 600)}`);
  });
  page.on("pageerror", (e: Error) => ruido.push(`pageerror: ${e.message.slice(0, 200)}`));
  page.on("response", (r: { status(): number; url(): string }) => { if (r.status() >= 400) ruido.push(`http ${r.status()} ${r.url().replace(BASE, "")}`); });
  page.on("requestfailed", (r: { url(): string; failure(): { errorText: string } | null }) => {
    const motivo = r.failure()?.errorText ?? "";
    if (!/ERR_ABORTED/.test(motivo)) ruido.push(`requestfailed ${r.url().replace(BASE, "")} ${motivo}`);
  });

  const url = (id: string) => `${BASE}/pre-vendas/${id}`;
  const abre = async (rota: string, espera = 700) => {
    await page.goto(`${BASE}${rota}`, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForTimeout(espera);
  };
  const texto = async () => page.locator("body").innerText();
  const foto = (nome: string) => page.screenshot({ path: `${OUT}/${nome}.png` });

  try {
    /* ── 1. pelo drawer do board e por link direto ── */
    console.log("\n== abrir ==");
    await abre(`/pre-vendas?busca=${encodeURIComponent(marca + "-a")}`, 1500);
    await page.getByText(`${marca} Ltda a`).first().click();
    await page.getByRole("button", { name: "Abrir lead" }).click();
    await page.waitForURL(`**/pre-vendas/${a.leadId}`, { timeout: 60000 }).then(
      () => confere(true, "Abrir lead no drawer leva a /pre-vendas/<id>"),
      () => confere(false, `Abrir lead no drawer leva a /pre-vendas/<id> (parou em ${page.url()})`));
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(700);
    let t = await texto();
    confere(/LEAD/.test(t) && t.includes(`${marca} Ltda a`) && /Qualificação/.test(t), "a tela mostra o lead (empresa, contato e Qualificação)");
    await foto("1-aberto-pelo-drawer");

    await abre(`/pre-vendas/${a.leadId}`);
    confere((await texto()).includes(`${marca}-a`), "link direto abre a tela");
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    confere(page.url() === url(a.leadId) && (await texto()).includes(`${marca}-a`), "F5 mantém a tela");

    /* ── 2. editar: qualificação, observação, responsável, nota, etapa ── */
    console.log("\n== editar ==");
    const secaoQual = () => page.locator("section", { has: page.getByLabel("Dor principal") }).first();
    const qual = secaoQual();
    await qual.getByRole("button", { name: "PABX", exact: true }).click();
    await page.getByText("Qualificação salva").first().waitFor();
    confere(true, "marcar Interesse grava na hora (toast Qualificação salva)");
    await qual.getByRole("button", { name: "Alto", exact: true }).click();
    await page.waitForTimeout(900);
    await qual.getByLabel("Tamanho da operação").fill("25");
    await qual.getByLabel("Tamanho da operação").blur();
    await page.waitForTimeout(900);
    await qual.getByLabel("Dor principal").fill("Fila longa no suporte");
    await qual.getByLabel("Dor principal").blur();
    await page.waitForTimeout(900);
    await qual.getByLabel("Observação").fill("Prefere WhatsApp à tarde");
    await qual.getByRole("button", { name: /^Salvar$/ }).click();
    await qual.getByRole("button", { name: "Salvo" }).waitFor();
    confere(true, "botão Salvar explícito grava a observação");

    if (outro) {
      await page.locator("section select").first().selectOption({ label: outro.nome });
      await page.getByText(`Responsável: ${outro.nome}`).first().waitFor();
      confere(true, `responsável trocado para ${outro.nome}`);
    }

    await page.getByPlaceholder(/Escreva uma nota/).click();
    await page.getByPlaceholder(/Escreva uma nota/).fill(`Nota da prova ${marca}`);
    await page.getByRole("button", { name: "Adicionar nota" }).click();
    await page.getByText("Nota adicionada").first().waitFor();
    confere(true, "nota criada");

    await page.getByTitle("Mover de etapa").click();
    await page.getByRole("button", { name: "Qualificação", exact: true }).click();
    await page.getByText("Movido para Qualificação").first().waitFor();
    confere(true, "etapa movida pelo chip (Em contato → Qualificação)");
    await foto("2-editado");

    /* ── 3. depois de recarregar: a própria tela ── */
    console.log("\n== reler (F5) ==");
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    t = await texto();
    const q2 = secaoQual();
    confere((await q2.getByLabel("Dor principal").inputValue()) === "Fila longa no suporte", "tela: dor persistiu");
    confere((await q2.getByLabel("Tamanho da operação").inputValue()) === "25", "tela: tamanho persistiu");
    confere((await q2.getByLabel("Observação").inputValue()) === "Prefere WhatsApp à tarde", "tela: observação persistiu");
    confere((await q2.getByRole("button", { name: "Alto", exact: true }).getAttribute("aria-pressed")) === "true", "tela: fit Alto persistiu");
    confere((await q2.getByRole("button", { name: "PABX", exact: true }).getAttribute("aria-pressed")) === "true", "tela: interesse PABX persistiu");
    confere(t.includes(`Nota da prova ${marca}`), "tela: nota persistiu");
    if (outro) confere((await page.locator("section select").first().inputValue()) === outro.nome, "tela: responsável persistiu");
    confere(/Qualificação/.test(await page.getByTitle("Mover de etapa").innerText()), "tela: etapa Qualificação persistiu");

    /* ── 4. o MESMO dado no drawer, na Pessoa e na Empresa ── */
    console.log("\n== reflexo nas outras telas ==");
    await abre(`/pre-vendas?busca=${encodeURIComponent(marca + "-a")}`, 1500);
    await page.getByText(`${marca} Ltda a`).first().click();
    await page.waitForTimeout(1200);
    await page.locator("[data-r=drawer]").getByText("4 de 4 campos").click().catch(() => undefined);
    await page.waitForTimeout(500);
    /* innerText não traz o que está em campo (tamanho e dor são input/textarea): lê os valores também. */
    const camposDoDrawer = await page.locator("[data-r=drawer]").evaluate((el: Element) =>
      [...el.querySelectorAll("input,textarea")].map((e) => (e as HTMLInputElement).value).join(" | "));
    const drawer = (await page.locator("[data-r=drawer]").innerText()) + " | " + camposDoDrawer;
    const okDrawer = /Fila longa no suporte/.test(drawer) && /25/.test(drawer) && /Alto/.test(drawer) && /PABX/.test(drawer);
    if (!okDrawer) console.log("   (drawer) " + drawer.slice(drawer.indexOf("QUALIFICA")).slice(0, 700).replace(/\n+/g, " | "));
    confere(okDrawer, "drawer do board: qualificação (interesse, tamanho, dor, fit)");
    if (outro) confere(drawer.includes(outro.nome), `drawer do board: responsável ${outro.nome}`);
    confere(/Qualificação/.test(drawer), "drawer do board: etapa");
    await foto("3-drawer");

    await abre(`/pessoas/${a.leadId}`);
    const pessoa = await texto();
    confere(/Fila longa no suporte/.test(pessoa) && /PABX/.test(pessoa) && /Alto/.test(pessoa), "ficha da Pessoa: qualificação");
    confere(pessoa.includes("Prefere WhatsApp à tarde"), "ficha da Pessoa: observação");
    confere(pessoa.includes(`Nota da prova ${marca}`), "ficha da Pessoa: nota");
    if (outro) confere(pessoa.includes(outro.nome), `ficha da Pessoa: responsável ${outro.nome}`);
    confere(/PRÉ-VENDAS/i.test(pessoa) && /Qualificação/.test(pessoa), "ficha da Pessoa: relação em andamento (Pré-vendas · Qualificação)");
    await foto("4-pessoa");

    await abre(`/empresas/${a.empresaId}`);
    const empresa = await texto();
    confere(/Fila longa no suporte/.test(empresa) && /Alto/.test(empresa), "ficha da Empresa: qualificação");
    if (outro) confere(empresa.includes(outro.nome), `ficha da Empresa: responsável ${outro.nome}`);
    confere(/PRÉ-VENDAS/i.test(empresa) && /Qualificação/.test(empresa), "ficha da Empresa: relação em andamento");
    await foto("5-empresa");

    /* ── 5. nutrição e desqualificado (banners) ── */
    console.log("\n== nutrição e desqualificado ==");
    await abre(`/pre-vendas/${paraNutrir.leadId}`);
    await page.getByTitle("Outras saídas do lead").click();
    await page.getByRole("button", { name: /Nutrir/ }).click();
    await page.locator("[data-r=modal-fundo]").last().waitFor();
    await foto("6-nutrir-modal");
    const janelaNutrir = page.locator("[data-r=modal-fundo]").last();
    confere(/motivo/i.test(await janelaNutrir.innerText()), "Nutrir abre a peça pedindo o motivo");
    await janelaNutrir.getByRole("button", { name: "Mover para nutrição" }).click({ force: true });
    await page.waitForTimeout(700);
    confere(await janelaNutrir.isVisible() && !/Em nutrição · /.test(await texto()), "sem motivo, Mover para nutrição não grava (a peça segue aberta)");
    await janelaNutrir.getByText("Sem orçamento agora").click();
    await janelaNutrir.locator("input[type=date]").fill("2030-02-01");
    await janelaNutrir.getByRole("button", { name: "Mover para nutrição" }).click();
    await page.getByText(/Em nutrição · Sem orçamento agora/).first().waitFor();
    let tN = await texto();
    confere(/Desde \d{2}\/\d{2}\/\d{4}/.test(tN) && /retomar em 01\/02\/2030/.test(tN), "banner de nutrição mostra o MOTIVO, QUANDO entrou e a retomada");
    await foto("6b-nutricao-banner");
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    confere(/Em nutrição · Sem orçamento agora/.test(await texto()), "F5 mantém a nutrição");
    await abre(`/pessoas/${paraNutrir.leadId}`);
    const pN = await texto();
    confere(/Em nutrição: Sem orçamento agora/.test(pN) && /desde \d{2}\/\d{2}\/\d{4}/.test(pN), "ficha da Pessoa: nutrição com motivo e quando entrou");
    await abre(`/empresas/${paraNutrir.empresaId}`);
    confere(/Em nutrição: Sem orçamento agora/.test(await texto()), "ficha da Empresa: nutrição com motivo");

    await abre(`/pre-vendas/${paraNutrir.leadId}`);
    await page.getByRole("button", { name: "Reativar" }).click();
    await page.getByText("Lead reativado").first().waitFor();
    await page.waitForTimeout(800);
    confere(/Em contato/.test(await page.getByTitle("Mover de etapa").innerText()) && !/Em nutrição/.test(await texto()), "Reativar devolve o lead para Em contato");

    await page.getByTitle("Outras saídas do lead").click();
    await page.getByRole("button", { name: /Descartar/ }).click();
    const janelaDesq = page.locator("[data-r=modal-fundo]").last();
    await janelaDesq.waitFor();
    await foto("6c-descartar-modal");
    await janelaDesq.getByRole("button", { name: /^(Desqualificar|Escolha o motivo)/ }).click({ force: true });
    await page.waitForTimeout(700);
    confere(await janelaDesq.isVisible() && !/Desqualificado · /.test(await texto()), "Descartar exige motivo: sem ele não grava (a peça segue aberta)");
    await janelaDesq.getByText("Fora do ICP").click();
    await janelaDesq.getByRole("button", { name: "Desqualificar" }).click();
    await page.getByText(/Desqualificado · Fora do ICP/).first().waitFor();
    confere(await page.getByRole("button", { name: "Reativar" }).isVisible(), "banner de desqualificado com motivo e Reativar");
    await foto("6d-desqualificado");
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    confere(/Desqualificado · Fora do ICP/.test(await texto()), "F5 mantém o desqualificado");
    await page.getByRole("button", { name: "Reativar" }).click();
    await page.getByText("Lead reativado").first().waitFor();

    /* ── 6. lead sem empresa ── */
    console.log("\n== sem empresa ==");
    await abre(`/pre-vendas/${semEmpresa.leadId}`);
    const tSem = await texto();
    if (!/Sem empresa/.test(tSem)) console.log("   (sem empresa) " + page.url() + " :: " + tSem.slice(0, 500).replace(/\n+/g, " | "));
    confere(/Sem empresa/.test(tSem), "lead sem empresa abre e diz Sem empresa");
    await page.getByTitle("Outras saídas do lead").click();
    const criar = page.getByRole("button", { name: /Criar oportunidade/ }).last();
    confere((await criar.getAttribute("aria-disabled")) === "true", "Criar oportunidade fica desabilitado");
    confere(/Lead sem empresa/.test((await criar.getAttribute("title")) ?? ""), "e diz o motivo (title)");
    confere(await page.getByRole("button", { name: /Vincular empresa/ }).first().isVisible(), "e oferece Vincular empresa");
    await foto("7-sem-empresa");
    await page.keyboard.press("Escape");

    /* ── 7. converter em oportunidade ── */
    console.log("\n== converter em oportunidade ==");
    await qualificar({ organizacaoId: org, leadId: a.leadId, ator });   // a saída que o modal "Qualificar" chama
    await abre(`/pre-vendas/${a.leadId}`);
    confere(/Qualificado/.test(await page.getByTitle("Mover de etapa").innerText()), "lead qualificado: o chip diz Qualificado");
    await page.getByRole("button", { name: "Criar oportunidade" }).first().click();
    await page.waitForTimeout(1500);
    await foto("8-criar-oportunidade-modal");
    const modal = await texto();
    console.log("   (modal) " + modal.slice(-420).replace(/\n+/g, " | "));
    // o modal da peça: escolher como a oportunidade avança e confirmar
    const janela = page.locator("[data-r=modal-fundo]").last();
    await janela.getByRole("button", { name: "WhatsApp" }).click();
    await page.waitForTimeout(600);
    await foto("8b-criar-oportunidade-whatsapp");
    console.log("   (modal 2) " + (await janela.innerText()).slice(-500).replace(/\n+/g, " | "));
    await janela.getByRole("button", { name: "Continuar" }).click();
    await page.waitForTimeout(700);
    await janela.getByRole("textbox").first().fill("Retomar conversa no WhatsApp");
    await janela.getByRole("button", { name: /^Amanhã/ }).click();
    await foto("8c-criar-oportunidade-passo2");
    await janela.getByRole("button", { name: "Criar oportunidade" }).click();
    await page.waitForURL(/\/pipeline\//, { timeout: 60000 }).then(
      () => confere(true, `converter leva a ${page.url().replace(BASE, "")}`),
      () => confere(false, `converter leva a /pipeline/<id> (parou em ${page.url()})`));
    const [r] = await db.execute<{ etapa: string; n: number }>(sql`
      SELECT l.estagio_pre_vendas AS etapa, (SELECT count(*) FROM oportunidades o WHERE o.lead_id = l.id)::int AS n
        FROM leads l WHERE l.id = ${a.leadId}::uuid`);
    confere(r.etapa === "oportunidade" && r.n >= 1, `banco: lead em "${r.etapa}" com ${r.n} oportunidade(s)`);
    await foto("9-pipeline");

    await abre(`/pre-vendas/${a.leadId}`);
    t = await texto();
    confere(/Convertido em oportunidade/.test(t) && /Abrir oportunidade/.test(t), "a tela do lead mostra o banner Convertido em oportunidade");
    confere(/Oportunidade/.test(t.split("Relações em andamento")[1] ?? ""), "e a oportunidade em Relações");
    await foto("10-convertido");
    await abre(`/pessoas/${a.leadId}`);
    confere(/OPORTUNIDADE/i.test(await texto()), "ficha da Pessoa: a oportunidade aparece em Relações");

    /* ── 8. 390px ── */
    console.log("\n== 390px ==");
    await page.setViewportSize({ width: 390, height: 900 });
    await abre(`/pre-vendas/${paraNutrir.leadId}`);
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    confere(sobra <= 1, `sem rolagem horizontal em 390px (sobra ${sobra}px)`);
    await foto("11-390");
  } finally {
    await browser.close();
    await limpar();
  }

  console.log("\n== console e rede ==");
  const unicos = [...new Set(ruido)];
  confere(unicos.length === 0, unicos.length ? `ruído: ${unicos.join(" || ")}` : "console e rede limpos");
  if (falhas.length) { console.error("\nFALHAS:", falhas); process.exit(1); }
  console.log("\nprova ok");
  process.exit(0);
}
main().catch(async (e) => { console.error(e); await limpar().catch(() => undefined); process.exit(1); });
