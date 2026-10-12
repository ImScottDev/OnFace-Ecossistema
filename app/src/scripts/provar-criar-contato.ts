/**
 * Prova NO NAVEGADOR (Chrome headless + cookie de sessão) da criação de contato e
 * empresa em /contatos (modal "Novo"), contra o app local:
 *
 *  A contato avulso (telefone com máscara, grava E.164, origem como ponto de contato,
 *    sem processo em Pré-vendas), aparece no topo da lista sem F5, "Abrir contato" vai
 *    para a ficha BASE (/pessoas/<lead>) com telefone mascarado, F5 mantém;
 *  B contato com empresa nova (empresa criada uma vez, vínculo principal);
 *  C empresa sem pessoas aparece na lista, "Abrir empresa" vai para /empresas/<id>;
 *  D empresa com duas pessoas;
 *  E Pré-vendas sem empresa e sem e-mail/telefone: BLOQUEIA e não grava nada;
 *  F Pré-vendas completo: lead + aquisição, telefone normalizado;
 *  G mesmo telefone em outro formato: reconhece a pessoa, não duplica.
 *
 * Registros de teste têm prefixo `prova-criar-` e são apagados antes e depois.
 * Evidências em .tmp-criar-contato/*.png.
 *
 *   BASE=http://localhost:3000 npx tsx --env-file=.env src/scripts/provar-criar-contato.ts
 */
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessaoDeSmoke } from "./_sessao-de-smoke";

const BASE = process.env.BASE || "http://localhost:3000";
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = ".tmp-criar-contato";
const PREFIXO = "prova-criar-%";
const marca = `prova-criar-${Date.now()}`;

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

const um = async <T>(q: ReturnType<typeof sql>): Promise<T | undefined> => (await db.execute<any>(q))[0] as T | undefined;

async function main() {
  mkdirSync(OUT, { recursive: true });
  await limpar();
  const s = await sessaoDeSmoke({ role: "admin" });
  const org = s.organizacaoId;
  const [resp] = await db.execute<{ id: string; nome: string }>(sql`
    SELECT id::text, nome FROM usuarios WHERE organizacao_id = ${org}::uuid AND ativo = true ORDER BY nome LIMIT 1`);

  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addCookies([{ name: "authjs.session-token", value: s.cookie.split("=").slice(1).join("="), url: BASE }]);
  const page = await ctx.newPage();
  page.setDefaultTimeout(60000);

  const ruido: string[] = [];
  page.on("console", (m: any) => {
    if (/preloaded using link preload but not used/.test(m.text()) || m.location().url.endsWith("/favicon.ico")) return;
    if (/didn't match the client properties|Hydration/.test(m.text())) { ruido.push(`hidratação: ${m.text().slice(0, 200)}`); return; }
    if (["error", "warning"].includes(m.type())) ruido.push(`console ${m.type()} em ${page.url().replace(BASE, "")}: ${m.text().slice(0, 300)}`);
  });
  page.on("pageerror", (e: Error) => ruido.push(`pageerror: ${e.message.slice(0, 200)}`));
  page.on("response", (r: any) => { if (r.status() >= 400) ruido.push(`http ${r.status()} ${r.url().replace(BASE, "")}`); });

  if (process.env.DEBUG_PROVA) { page.on("request", (r: any) => { if (r.method() === "POST") console.log("POST", r.url().replace(BASE, ""), Date.now()); }); page.on("response", (r: any) => { if (r.request().method() === "POST") console.log("RESP", r.status(), Date.now()); }); }
  const irLista = async () => { await page.goto(`${BASE}/contatos`, { waitUntil: "load", timeout: 120000 }); };
  const novo = async (item: "Novo contato" | "Nova empresa") => {
    await page.locator('button[data-ct-pop="1"]', { hasText: "Novo" }).first().waitFor();
    await page.waitForTimeout(1500);
    await page.locator('button[data-ct-pop="1"]', { hasText: "Novo" }).first().click();
    await page.getByText(item, { exact: true }).first().click();
  };
  const campo = (ph: string) => page.locator(`input[placeholder^="${ph}"]`).first();
  const toastTxt = async (re: RegExp) => { try { await page.locator("[data-sonner-toast]").filter({ hasText: re }).first().waitFor({ timeout: 60000 }); return true; } catch { return false; } };
  const continuar = () => page.getByRole("button", { name: "Continuar" }).click();
  const destino = (nome: string) => page.getByText(nome, { exact: true }).first().click();
  const salvar = (nome: string) => page.getByRole("button", { name: nome }).click();
  const selecionar = async (rotulo: string, valor: string) => {
    // campo de escolha: <select> logo após o rótulo
    const bloco = page.locator("label", { hasText: rotulo }).first();
    await bloco.locator("select").selectOption({ label: valor });
  };
  const sem = (v: unknown) => v === undefined || v === null;

  /* ── A: contato avulso ─────────────────────────────────────────────── */
  await irLista();
  await novo("Novo contato");
  await campo("Nome completo").fill(`${marca}-avulso`);
  await campo("Ex: Gerente").fill("Analista");
  await campo("(11) 90000").fill("11987654321");
  const mascarado = await campo("(11) 90000").inputValue();
  confere(mascarado === "(11) 98765-4321", `A: máscara de digitação (${mascarado})`);
  await campo("(11) 90000").fill("11");
  await campo("(11) 90000").fill("abc12");
  confere((await campo("(11) 90000").inputValue()) === "(12", "A: máscara descarta letras");
  await campo("(11) 90000").fill("11987654321");
  await continuar();
  const temResp = await page.locator("label", { hasText: "Responsável" }).count();
  confere(temResp === 0, "A: destino 'só na base' não pede responsável");
  confere((await page.getByText("Enviar para Prospecção").count()) === 0, "A: destino Prospecção removido do modal");
  await selecionar("Origem", "Indicação");
  await page.screenshot({ path: `${OUT}/a-modal.png` });
  await salvar("Salvar contato");
  confere(await toastTxt(/salvo na base/), "A: aviso de sucesso só depois do servidor");
  const a = await um<any>(sql`
    SELECT p.id::text, p.telefone, p.lead_id_legado::text AS lead, l.tipo, l.estagio_pre_vendas AS etapa, l.responsavel_id::text AS resp,
           (SELECT count(*)::int FROM aquisicoes q WHERE q.pessoa_id = p.id) AS aq,
           (SELECT source FROM pontos_contato t WHERE t.pessoa_id = p.id ORDER BY t.ocorrido_em DESC LIMIT 1) AS origem
      FROM pessoas p LEFT JOIN leads l ON l.id = p.lead_id_legado WHERE p.nome = ${marca + "-avulso"}`);
  confere(a?.telefone === "+5511987654321", `A: telefone gravado normalizado (${a?.telefone})`);
  confere(a?.origem === "Indicação", `A: origem virou ponto de contato (${a?.origem})`);
  confere(a?.tipo === "contato" && sem(a?.etapa) && a?.aq === 0 && sem(a?.resp), "A: registro de contato sem processo, sem etapa, sem dono");
  // visível sem F5: o painel do registro novo abre sozinho e a linha está destacada no topo
  const painelAberto = await page.getByText(`${marca}-avulso`).first().waitFor({ timeout: 15000 }).then(() => true, () => false);
  confere(painelAberto, "A: registro novo visível na lista sem recarregar");
  await page.screenshot({ path: `${OUT}/a-lista.png` });
  const topo = await page.locator("[data-workspace=desenho]").innerText();
  const iMeu = topo.indexOf(`${marca}-avulso`), iAntigo = topo.indexOf("[QA-CRIAR]");
  confere(iMeu >= 0 && (iAntigo < 0 || iMeu < iAntigo), "A: aparece no topo, acima dos cadastros mais antigos");
  await page.getByText("Abrir contato", { exact: true }).first().click();
  await page.waitForURL(new RegExp(`/pessoas/${a.lead}`), { timeout: 30000 }).catch(() => undefined);
  confere(page.url().includes(`/pessoas/${a.lead}`) && !page.url().includes("/contatos/pessoas"), `A: Abrir contato vai para a ficha base (${page.url().replace(BASE, "")})`);
  await page.getByText(`${marca}-avulso`).first().waitFor({ timeout: 120000 });
  await page.getByText("(11) 98765-4321").first().waitFor({ timeout: 60000 }).catch(() => undefined);
  let corpo = await page.locator("body").innerText();
  confere(/\(11\) 98765-4321/.test(corpo), "A: ficha base mostra telefone mascarado");
  confere(!/Voltar para Pessoas|Vincular a uma empresa/.test(corpo), "A: não é a página simplificada");
  await page.screenshot({ path: `${OUT}/a-ficha.png` });
  await page.reload({ waitUntil: "load", timeout: 120000 });
  await page.getByText(`${marca}-avulso`).first().waitFor({ timeout: 120000 });
  corpo = await page.locator("body").innerText();
  confere(corpo.includes(`${marca}-avulso`) && /\(11\) 98765-4321/.test(corpo), "A: F5 mantém a ficha");
  // porta antiga também cai na ficha base
  await page.goto(`${BASE}/contatos/pessoas/${a.id}`, { waitUntil: "load", timeout: 120000 });
  await page.getByText(`${marca}-avulso`).first().waitFor({ timeout: 120000 }).catch(() => undefined);
  confere(page.url().includes(`/pessoas/${a.lead}`) && !page.url().includes("/contatos/pessoas"), "A: /contatos/pessoas/<id> redireciona para a ficha base");

  /* ── G: mesmo telefone, outro formato ──────────────────────────────── */
  await irLista();
  await novo("Novo contato");
  await campo("Nome completo").fill(`${marca}-avulso outra grafia`);
  await campo("(11) 90000").fill("+55 11 98765-4321");
  await continuar();
  await salvar("Salvar contato");
  confere(await toastTxt(/já existia na base/), "G: telefone em outro formato reconhece a pessoa (sem duplicar)");
  const g = await um<any>(sql`SELECT count(*)::int AS n FROM pessoas WHERE nome LIKE ${PREFIXO} AND telefone = '+5511987654321'`);
  confere(g?.n === 1, `G: uma pessoa só com esse telefone (${g?.n})`);

  /* ── B: contato com empresa nova ───────────────────────────────────── */
  await irLista();
  await novo("Novo contato");
  await campo("Nome completo").fill(`${marca}-com-empresa`);
  await campo("Buscar ou digitar").fill(`${marca} Empresa B Ltda`);
  await campo("nome@empresa").fill(`${marca}-b@teste.local`);
  await continuar();
  await salvar("Salvar contato");
  confere(await toastTxt(/salvo na base/), "B: salvo");
  const b = await um<any>(sql`
    SELECT p.id::text, p.empresa_id::text AS emp, (SELECT count(*)::int FROM empresas WHERE nome = ${marca + " Empresa B Ltda"}) AS n_emp,
           (SELECT count(*)::int FROM pessoa_empresa_vinculos v WHERE v.pessoa_id = p.id AND v.encerrado_em IS NULL AND v.principal) AS princ
      FROM pessoas p WHERE p.nome = ${marca + "-com-empresa"}`);
  confere(b?.n_emp === 1 && !!b?.emp && b?.princ === 1, `B: empresa criada uma vez e vínculo principal (empresas=${b?.n_emp}, principal=${b?.princ})`);

  await page.getByText("Abrir contato", { exact: true }).first().click();
  await page.waitForURL(/\/pessoas\//, { timeout: 60000 }).catch(() => undefined);
  await page.getByText(`${marca}-com-empresa`).first().waitFor({ timeout: 120000 });
  await page.getByText(`${marca} Empresa B Ltda`).first().waitFor({ timeout: 60000 }).then(
    () => confere(true, "B: ficha base mostra a empresa vinculada"), () => confere(false, "B: ficha base mostra a empresa vinculada"));
  await page.screenshot({ path: `${OUT}/b-ficha.png` });

  /* ── C: empresa sem pessoas ────────────────────────────────────────── */
  await irLista();
  await novo("Nova empresa");
  await campo("Razão social").fill(`${marca} Empresa C Ltda`);
  await campo("Ex: Saúde").fill("Tecnologia");
  await continuar();
  await salvar("Salvar empresa");
  await page.screenshot({ path: `${OUT}/c-depois.png` });
  confere(await toastTxt(/salvo na base/), "C: salva");
  const c = await um<any>(sql`SELECT id::text FROM empresas WHERE nome = ${marca + " Empresa C Ltda"}`);
  confere(!!c, "C: empresa gravada");
  await page.getByText(`${marca} Empresa C Ltda`).first().waitFor({ timeout: 15000 }).then(
    () => confere(true, "C: empresa sem pessoas visível na lista"), () => confere(false, "C: empresa sem pessoas visível na lista"));
  await page.reload({ waitUntil: "load", timeout: 120000 });
  confere((await page.getByText(`${marca} Empresa C Ltda`).count()) > 0, "C: F5 mantém a empresa na lista");
  await page.getByText("Abrir empresa", { exact: true }).first().click().catch(() => undefined);
  await page.getByText(`${marca} Empresa C Ltda`).first().click();
  await page.getByText("Abrir empresa", { exact: true }).first().click();
  await page.waitForURL(new RegExp(`/empresas/${c.id}`), { timeout: 30000 }).catch(() => undefined);
  confere(page.url().includes(`/empresas/${c.id}`), `C: Abrir empresa vai para a ficha base (${page.url().replace(BASE, "")})`);
  await page.getByText(`${marca} Empresa C Ltda`).first().waitFor({ timeout: 120000 });
  await page.screenshot({ path: `${OUT}/c-ficha-empresa.png` });
  /* drawer da empresa: Adicionar pessoa (máscara + vínculo gravado no servidor) */
  await page.getByText("Pessoas", { exact: true }).first().click().catch(() => undefined);
  await page.getByText("Adicionar pessoa").first().click();
  await campo("Nome completo").fill(`${marca}-c1`);
  await campo("(11) 90000").fill("11988887777");
  confere((await campo("(11) 90000").inputValue()) === "(11) 98888-7777", "C: máscara no telefone do drawer da empresa");
  await campo("nome@").fill(`${marca}-c1@teste.local`);
  await page.screenshot({ path: `${OUT}/c-drawer-pessoa.png` });
  await page.getByRole("button", { name: /^(Salvar|Adicionar|Vincular)/ }).last().click();
  confere(await toastTxt(/vinculada à empresa/), "C: Adicionar pessoa avisa só depois do servidor");
  const cp = await um<any>(sql`
    SELECT p.telefone, p.empresa_id::text AS emp,
           (SELECT count(*)::int FROM pessoa_empresa_vinculos v WHERE v.pessoa_id = p.id AND v.empresa_id = ${c.id}::uuid AND v.encerrado_em IS NULL) AS vinc
      FROM pessoas p WHERE p.nome = ${marca + "-c1"}`);
  confere(cp?.telefone === "+5511988887777" && cp?.emp === c.id && cp?.vinc === 1, `C: pessoa adicionada na empresa, vínculo ativo e telefone normalizado (${JSON.stringify(cp)})`);

  /* ── D: empresa com duas pessoas ───────────────────────────────────── */
  await irLista();
  await novo("Nova empresa");
  await campo("Razão social").fill(`${marca} Empresa D Ltda`);
  await page.getByText("Adicionar pessoa", { exact: false }).first().click();
  await page.getByText("Adicionar pessoa", { exact: false }).first().click().catch(() => undefined);
  const nomes = page.locator('input[placeholder="Nome *"]');
  await nomes.nth(0).fill(`${marca}-d1`);
  await nomes.nth(1).fill(`${marca}-d2`);
  await page.locator('input[placeholder="E-mail"]').nth(0).fill(`${marca}-d1@teste.local`);
  await page.locator('input[placeholder="Telefone"]').nth(1).fill("21 3333 4444");
  confere((await page.locator('input[placeholder="Telefone"]').nth(1).inputValue()) === "(21) 3333-4444", "D: máscara no telefone da pessoa dentro da empresa");
  await continuar();
  await page.screenshot({ path: `${OUT}/d-antes.png` });
  await salvar("Salvar empresa");
  await page.screenshot({ path: `${OUT}/d-depois.png` });
  confere(await toastTxt(/salvo na base/), "D: salva");
  const d = await db.execute<any>(sql`
    SELECT p.nome, p.telefone, p.empresa_id::text AS emp, e.nome AS empresa FROM pessoas p JOIN empresas e ON e.id = p.empresa_id
     WHERE e.nome = ${marca + " Empresa D Ltda"} ORDER BY p.nome`);
  confere(d.length === 2 && d[1].telefone === "+552133334444", `D: duas pessoas na empresa, telefone normalizado (${d.map((x: any) => x.telefone).join(",")})`);

  /* ── E: Pré-vendas sem empresa / sem identificador ─────────────────── */
  await irLista();
  await novo("Novo contato");
  await campo("Nome completo").fill(`${marca}-pv-bloqueado`);
  await continuar();
  await destino("Enviar para Pré-vendas");
  await selecionar("Origem inbound", "Site");
  await selecionar("Responsável", resp.nome);
  await salvar("Salvar e enviar para Pré-vendas");
  await page.waitForTimeout(1500);
  let pv = await um<any>(sql`SELECT count(*)::int AS n FROM pessoas WHERE nome = ${marca + "-pv-bloqueado"}`);
  confere(pv?.n === 0, "E: Pré-vendas sem empresa nem e-mail/telefone não grava");
  confere((await page.getByText("Salvar e enviar para Pré-vendas").count()) > 0, "E: modal continua aberto");
  confere((await page.locator("[data-sonner-toast]").filter({ hasText: /enviado ao Pré-vendas/ }).count()) === 0, "E: sem aviso verde falso");
  await page.screenshot({ path: `${OUT}/e-bloqueio.png` });
  await campo("Pré-vendas trabalha").fill(`${marca} Empresa PV Ltda`);
  await salvar("Salvar e enviar para Pré-vendas");
  confere(await toastTxt(/e-mail ou telefone/), "E: pede e-mail ou telefone com mensagem clara");
  pv = await um<any>(sql`SELECT count(*)::int AS n FROM pessoas WHERE nome = ${marca + "-pv-bloqueado"}`);
  confere(pv?.n === 0, "E: ainda nada gravado");

  /* ── F: Pré-vendas completo ────────────────────────────────────────── */
  await campo("(11) 90000").last().fill("11 91234 5678");
  await salvar("Salvar e enviar para Pré-vendas");
  confere(await toastTxt(/enviado ao Pré-vendas/), "F: enviado ao Pré-vendas (aviso depois do servidor)");
  const f = await um<any>(sql`
    SELECT l.telefone, l.estagio_pre_vendas AS etapa, l.responsavel_id::text AS resp, e.nome AS empresa,
           (SELECT count(*)::int FROM aquisicoes q WHERE q.lead_legado_id = l.id AND q.closed_at IS NULL) AS aq
      FROM leads l LEFT JOIN empresas e ON e.id = l.empresa_id WHERE l.nome = ${marca + "-pv-bloqueado"}`);
  confere(f?.aq === 1 && f?.telefone === "+5511912345678" && f?.resp === resp.id && f?.empresa === `${marca} Empresa PV Ltda`,
    `F: lead com aquisição, empresa, dono e telefone normalizado (${JSON.stringify(f)})`);

  confere(ruido.length === 0, `console e rede limpos${ruido.length ? ": " + ruido.slice(0, 6).join(" | ") : ""}`);
  await browser.close();
  await limpar();
  console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : "\nTUDO OK");
  process.exit(falhas.length ? 1 : 0);
}

main().catch(async (e) => { console.error(e); await limpar().catch(() => undefined); process.exit(1); });
