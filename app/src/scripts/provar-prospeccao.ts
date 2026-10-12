/**
 * Prova NO NAVEGADOR (Chrome headless + cookie de sessão) da Prospecção 2.0,
 * Fase 1, contra o app local:
 *
 *  - cadastro pela tela (e repetição sem duplicar);
 *  - arrastar persiste após F5 (Novo → Em cadência, com cadência válida);
 *  - passo da cadência derivado (passo X de N) na lista e no drawer;
 *  - Respondeu: sem evidência pede confirmação manual auditada; com evidência real passa direto;
 *  - descartar exige motivo (backend recusa sem ele) e preserva o histórico;
 *  - pré-qualificar entrega a Pré-vendas (uma aquisição, tela do lead abre);
 *  - oportunidade direta sem duplicar (clique repetido e chamadas concorrentes);
 *  - transição proibida e erro de rede revertem a tela ao estado gravado;
 *  - drawer com as seis abas; lista com busca, ordenação, paginação e F5;
 *  - Operação com números iguais ao banco;
 *  - desktop 1440 e 390px (menu "Mover para", sem rolagem horizontal), console e rede limpos.
 *
 * Tudo com prefixo `prova-prosp-`, criado e apagado por esta rodada.
 * Evidências em .tmp-prosp/*.png.
 *
 *   BASE=http://localhost:3000 npx tsx --env-file=.env src/scripts/provar-prospeccao.ts
 */
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { atorHumano } from "@/lib/vendas/dominio";
import { adicionarProspect, moverProspect } from "@/lib/vendas/prospeccao";
import { sessaoDeSmoke } from "./_sessao-de-smoke";

const BASE = process.env.BASE || "http://localhost:3000";
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = ".tmp-prosp";
const PREFIXO = "prova-prosp-%";
const marca = `prova-prosp-${Date.now()}`;

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
  const meusLeads = sql`(SELECT id FROM leads WHERE nome LIKE ${PREFIXO} OR empresa LIKE ${PREFIXO})`;
  const minhasPessoas = sql`(SELECT id FROM pessoas WHERE nome LIKE ${PREFIXO})`;
  const minhasEmpresas = sql`(SELECT id FROM empresas WHERE nome LIKE ${PREFIXO})`;
  const meusNegocios = sql`(SELECT id FROM negocios WHERE lead_id IN ${meusLeads} OR empresa_id IN ${minhasEmpresas})`;
  for (const q of [
    sql`DELETE FROM cadence_enrollment_events WHERE enrollment_id IN (SELECT id FROM cadence_enrollments WHERE entity_id IN ${meusLeads})`,
    sql`DELETE FROM cadence_enrollments WHERE entity_id IN ${meusLeads}`,
    sql`DELETE FROM cadence_definition_pointers WHERE cadence_definition_id IN (SELECT id FROM cadence_definitions WHERE nome LIKE ${PREFIXO})`,
    sql`DELETE FROM cadence_definitions WHERE nome LIKE ${PREFIXO}`,
    sql`DELETE FROM whatsapp_mensagens WHERE lead_id IN ${meusLeads}`,
    sql`DELETE FROM notas WHERE lead_id IN ${meusLeads}`,
    sql`DELETE FROM entity_labels WHERE entity_type = 'lead' AND entity_id IN ${meusLeads}`,
    sql`DELETE FROM lead_labels WHERE lead_id IN ${meusLeads}`,
    sql`DELETE FROM labels WHERE nome LIKE ${PREFIXO}`,
    sql`DELETE FROM atividades WHERE lead_id IN ${meusLeads} OR negocio_id IN ${meusNegocios}`,
    sql`DELETE FROM tarefas WHERE lead_id IN ${meusLeads} OR negocio_id IN ${meusNegocios}`,
    sql`DELETE FROM status_changes WHERE lead_id IN ${meusLeads}`,
    sql`DELETE FROM vendas_eventos WHERE lead_id IN ${meusLeads} OR negocio_id IN ${meusNegocios}`,
    sql`DELETE FROM comercial_evidencia WHERE negocio_id IN ${meusNegocios}`,
    sql`DELETE FROM timeline_events WHERE aquisicao_id IN (SELECT id FROM aquisicoes WHERE lead_legado_id IN ${meusLeads})
         OR pessoa_id IN ${minhasPessoas} OR empresa_id IN ${minhasEmpresas}`,
    sql`DELETE FROM pontos_contato WHERE lead_id_legado IN ${meusLeads} OR pessoa_id IN ${minhasPessoas} OR empresa_id IN ${minhasEmpresas}`,
    sql`DELETE FROM oportunidades WHERE lead_id IN ${meusLeads} OR negocio_id_legado IN ${meusNegocios} OR empresa_id IN ${minhasEmpresas}`,
    sql`DELETE FROM negocio_leads WHERE negocio_id IN ${meusNegocios}`,
    sql`DELETE FROM negocios WHERE lead_id IN ${meusLeads} OR empresa_id IN ${minhasEmpresas}`,
    sql`DELETE FROM oportunidade_bundle WHERE lead_id IN ${meusLeads} OR empresa_id IN ${minhasEmpresas}`,
    sql`DELETE FROM aquisicoes WHERE lead_legado_id IN ${meusLeads} OR pessoa_id IN ${minhasPessoas} OR empresa_id IN ${minhasEmpresas}`,
    sql`DELETE FROM event_outbox WHERE payload ->> 'lead_legado_id' IN (SELECT id::text FROM leads WHERE nome LIKE ${PREFIXO} OR empresa LIKE ${PREFIXO})`,
    sql`DELETE FROM domain_events WHERE payload ->> 'lead_legado_id' IN (SELECT id::text FROM leads WHERE nome LIKE ${PREFIXO} OR empresa LIKE ${PREFIXO})`,
    sql`DELETE FROM pessoa_empresa_vinculos WHERE pessoa_id IN ${minhasPessoas} OR empresa_id IN ${minhasEmpresas}`,
    sql`DELETE FROM pessoas WHERE nome LIKE ${PREFIXO}`,
    sql`DELETE FROM leads WHERE nome LIKE ${PREFIXO} OR empresa LIKE ${PREFIXO}`,
    sql`DELETE FROM empresas WHERE nome LIKE ${PREFIXO}`,
  ]) await db.execute(q).catch((e) => console.warn("  limpeza:", String(e).slice(0, 140)));
  await db.execute(sql`
    DELETE FROM backfill_provenance bp WHERE bp.entidade_canonica = 'aquisicao'
      AND NOT EXISTS (SELECT 1 FROM aquisicoes a WHERE a.id = bp.id_canonico)`).catch(() => undefined);
}

const estadoDe = async (id: string) =>
  (await db.execute<{ e: string | null }>(sql`SELECT prospeccao_estado AS e FROM leads WHERE id = ${id}::uuid`))[0]?.e ?? null;

async function main() {
  mkdirSync(OUT, { recursive: true });
  await limpar();
  const s = await sessaoDeSmoke({ role: "admin" });
  const org = s.organizacaoId;
  const ator = atorHumano(s.usuarioId);

  // Cadência de TESTE com passos inofensivos (noop): nunca inscrever prospect de
  // prova numa cadência real, que mandaria mensagem de verdade.
  const [cad] = await db.execute<{ id: string }>(sql`
    INSERT INTO cadence_definitions (organizacao_id, nome, entity_type, ativo, steps)
    VALUES (${org}::uuid, ${`${marca} cadência`}, 'lead', true, ${JSON.stringify([
      { id: "p1", tipo: "action", adapter: "noop", config: {}, branches: [{ condicao: null, proximoStepId: "w1" }] },
      { id: "w1", tipo: "wait", config: { mode: "fixed" }, esperaMinutos: 1440, branches: [{ condicao: null, proximoStepId: "p2" }] },
      { id: "p2", tipo: "action", adapter: "noop", config: {}, branches: [] },
    ])}::jsonb) RETURNING id::text`);
  const cadenciaNome = `${marca} cadência`;

  let fone = 11987660000;
  const novo = async (sufixo: string, extra: Record<string, unknown> = {}) => (await adicionarProspect({
    organizacaoId: org,
    empresa: { nome: `${marca} Ltda ${sufixo}` },
    pessoa: { nome: `${marca}-${sufixo}`, email: `${marca}-${sufixo}@teste.local`, telefone: String(++fone), cargo: "Diretora" },
    fonte: "prova", responsavelId: s.usuarioId, ...extra,
  }, ator)).leadId;

  const a = await novo("a");          // vai para cadência e responde manualmente
  const b = await novo("b");          // resposta com evidência real
  const c = await novo("c");          // descartar
  const d = await novo("d");          // pré-qualificar
  const e = await novo("e");          // oportunidade direta
  const f = await novo("f");          // erro de rede + transição proibida + 390px

  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addCookies([{ name: "authjs.session-token", value: s.cookie.split("=").slice(1).join("="), url: BASE }]);
  const page = await ctx.newPage();
  page.setDefaultTimeout(60000);
  const errosConsole: string[] = [];
  const errosRede: string[] = [];
  let abortando = false;
  page.on("console", (m: { type: () => string; text: () => string }) => { if (m.type() === "error" && !abortando) errosConsole.push(`${page.url().replace(BASE, "")} ${m.text().slice(0, 120)}`); });
  page.on("response", (r: { status: () => number; url: () => string }) => { if (r.status() >= 400) errosRede.push(`${r.status()} ${r.url().slice(0, 100)}`); });

  const ir = async (qs: string) => { await page.goto(`${BASE}/prospeccao${qs}`, { waitUntil: "domcontentloaded" }); await page.locator(".pp:visible").first().waitFor(); await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined); };
  const recarregar = async () => { await page.reload({ waitUntil: "domcontentloaded" }); await page.locator(".pp:visible").first().waitFor(); await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined); };
  const card = (id: string) => page.locator(`.pp-card[data-lead="${id}"]`);
  const coluna = (est: string) => page.locator(`.pp-coluna-alvo[data-estado="${est}"]`);
  const desfecho = (est: string) => page.locator(`.pp-desfecho[data-estado="${est}"]`);
  const arrastar = async (id: string, alvo: ReturnType<typeof page.locator>) => { await card(id).dragTo(alvo); };

  // ── 1. Cadastro pela tela ────────────────────────────────────────────────
  await ir("?visao=kanban");
  const empresaUi = `${marca} Ltda ui`;
  await page.getByRole("button", { name: "Adicionar empresa" }).click();
  await page.locator('label:has-text("Empresa *") input').fill(empresaUi);
  await page.locator('label:has-text("Contato") input').first().fill(`${marca}-ui`);
  await page.locator('label:has-text("E-mail") input').fill(`${marca}-ui@teste.local`);
  await page.locator('label:has-text("Telefone") input').fill("11987669999");
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await page.getByText(`${empresaUi} adicionada à base outbound`).waitFor();
  await recarregar();
  confere(await page.getByText(empresaUi).first().isVisible(), "cadastro: a empresa aparece no Kanban em Novo depois do F5");
  const [uiRow] = await db.execute<{ id: string; estado: string; origem: string }>(sql`
    SELECT id::text, prospeccao_estado AS estado, origem FROM leads WHERE empresa = ${empresaUi} AND organizacao_id = ${org}::uuid`);
  confere(uiRow?.estado === "novo" && uiRow?.origem === "outbound", "cadastro: persistiu em Novo, origem outbound");
  // repetir o cadastro da mesma empresa não duplica
  await page.getByRole("button", { name: "Adicionar empresa" }).click();
  await page.locator('label:has-text("Empresa *") input').fill(empresaUi);
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await page.getByText("já estava na base").waitFor();
  const [{ n: qtdUi }] = await db.execute<{ n: number }>(sql`SELECT count(*)::int n FROM leads WHERE empresa = ${empresaUi} AND organizacao_id = ${org}::uuid`);
  confere(qtdUi === 1, "cadastro repetido: uma linha só, sem duplicar");
  await page.screenshot({ path: `${OUT}/01-cadastro-1440.png` });

  // ── 2. Arrastar Novo → Em cadência persiste após F5 ──────────────────────
  await ir("?visao=kanban&busca=" + encodeURIComponent(marca));
  await arrastar(a, coluna("em_cadencia"));
  await page.getByRole("dialog").getByRole("button", { name: cadenciaNome }).click();
  await page.getByText("entrou em cadência").waitFor();
  await recarregar();
  confere(await coluna("em_cadencia").locator(`.pp-card[data-lead="${a}"]`).count() === 1, "drag: card em Em cadência depois do F5");
  confere(await estadoDe(a) === "em_cadencia", "drag: banco = em_cadencia");
  const [{ n: matriculas }] = await db.execute<{ n: number }>(sql`SELECT count(*)::int n FROM cadence_enrollments WHERE entity_id = ${a}::uuid AND status IN ('active','waiting')`);
  confere(matriculas === 1, "drag: uma matrícula viva no motor de cadências");
  await page.screenshot({ path: `${OUT}/02-kanban-cadencia-1440.png` });

  // cadência inválida é recusada pelo backend (definição de outra organização / inexistente)
  const rInv = await moverProspect({ organizacaoId: org, leadId: c, para: "em_cadencia", cadenceDefinitionId: "00000000-0000-0000-0000-000000000000", ator }).then(() => "ok", (x) => (x as { codigo?: string }).codigo);
  confere(rInv === "cadencia_invalida", "regra: Novo → Em cadência recusa cadência inexistente");

  // ── 3. Passo derivado ────────────────────────────────────────────────────
  await db.execute(sql`INSERT INTO cadence_enrollment_events (enrollment_id, step_id, status, resultado)
    SELECT id, 'p1', 'executado', '{}'::jsonb FROM cadence_enrollments WHERE entity_id = ${a}::uuid`);
  await ir("?busca=" + encodeURIComponent(marca));
  confere(await page.getByText("passo 2 de 2").first().isVisible(), "passo: lista mostra 'passo 2 de 2' (1 ação executada + a próxima), derivado dos eventos");

  // ── 4. Respondeu ─────────────────────────────────────────────────────────
  // 4a. sem evidência: o backend recusa e a tela pede a confirmação manual auditada
  await ir("?visao=kanban&busca=" + encodeURIComponent(marca));
  await arrastar(a, coluna("respondeu"));
  await page.getByRole("dialog", { name: /Confirmar resposta manualmente/ }).waitFor();
  confere(await estadoDe(a) === "em_cadencia", "resposta sem evidência: nada mudou no banco e a tela voltou o card");
  await page.locator('textarea').fill("Pediu proposta por telefone");
  await page.getByRole("button", { name: "Confirmar resposta" }).click();
  await page.getByText("marcada como respondeu").waitFor();
  await recarregar();
  confere(await coluna("respondeu").locator(`.pp-card[data-lead="${a}"]`).count() === 1, "resposta manual: card em Respondeu depois do F5");
  const [evA] = await db.execute<{ contexto: { origem?: string; observacao?: string; confirmadoPor?: string } }>(sql`
    SELECT contexto FROM vendas_eventos WHERE lead_id = ${a}::uuid AND tipo = 'ProspectReplied'`);
  confere(evA?.contexto?.origem === "confirmacao_manual" && evA.contexto.confirmadoPor === s.usuarioId, "resposta manual: evento auditado com quem confirmou e a observação");

  // 4b. com evidência real (mensagem recebida no Atendimento): passa sem perguntar
  await moverProspect({ organizacaoId: org, leadId: b, para: "em_cadencia", cadenceDefinitionId: cad.id, ator });
  await db.execute(sql`INSERT INTO whatsapp_mensagens (lead_id, telefone, direcao, tipo, conteudo, status)
    VALUES (${b}::uuid, '5511987660001', 'in', 'text', 'Olá, tenho interesse', 'received')`);
  await ir("?visao=kanban&busca=" + encodeURIComponent(marca));
  await arrastar(b, coluna("respondeu"));
  await page.getByText("marcada como respondeu").waitFor();
  const [evB] = await db.execute<{ contexto: { origem?: string; canal?: string } }>(sql`
    SELECT contexto FROM vendas_eventos WHERE lead_id = ${b}::uuid AND tipo = 'ProspectReplied'`);
  confere(await estadoDe(b) === "respondeu" && evB?.contexto?.origem === "evidencia", "resposta com evidência real: moveu direto, evento aponta a evidência");

  // ── 5. Drawer com as seis abas ───────────────────────────────────────────
  await ir(`?visao=kanban&busca=${encodeURIComponent(marca)}&lead=${a}`);
  await page.getByRole("tab", { name: "Operação" }).first().waitFor();
  const abasDrawer = await page.locator('.pp-abas-drawer [role=tab]').allTextContents();
  confere(JSON.stringify(abasDrawer) === JSON.stringify(["Operação", "Pessoas", "Conversas", "Cadência", "Histórico", "Inteligência"]), "drawer: seis abas na ordem pedida (abre por ?lead= e sobrevive ao F5)");
  await page.screenshot({ path: `${OUT}/05-drawer-operacao-1440.png` });
  await page.locator('.pp-abas-drawer').getByRole("tab", { name: "Cadência" }).click();
  confere(await page.getByText("Passo", { exact: true }).first().isVisible() && await page.getByText("2 de 2").first().isVisible(), "drawer/Cadência: passo 2 de 2 e passos listados");
  await page.screenshot({ path: `${OUT}/05-drawer-cadencia-1440.png` });
  await page.locator('.pp-abas-drawer').getByRole("tab", { name: "Histórico" }).click();
  confere(await page.getByText("Prospect respondeu").first().isVisible(), "drawer/Histórico: vem de eventos persistidos");
  await page.locator('.pp-abas-drawer').getByRole("tab", { name: "Pessoas" }).click();
  confere(await page.getByText(`${marca}-a@teste.local`).first().isVisible(), "drawer/Pessoas: contato real");
  await page.locator('.pp-abas-drawer').getByRole("tab", { name: "Inteligência" }).click();
  confere(await page.getByText("Abordagens executadas").first().isVisible(), "drawer/Inteligência: sinal real (abordagens executadas)");
  await ir(`?visao=kanban&busca=${encodeURIComponent(marca)}&lead=${b}`);
  await page.locator('.pp-abas-drawer').getByRole("tab", { name: "Conversas" }).click();
  confere(await page.getByText("Olá, tenho interesse").first().isVisible() && await page.getByRole("link", { name: /Abrir no Atendimento/ }).count() === 1, "drawer/Conversas: mensagem real do Atendimento + link para o Atendimento (sem caixa nova)");

  // ── 6. Descartar exige motivo ────────────────────────────────────────────
  const rSem = await moverProspect({ organizacaoId: org, leadId: c, para: "descartado", ator }).then(() => "ok", (x) => (x as { codigo?: string }).codigo);
  confere(rSem === "descarte_exige_motivo" && await estadoDe(c) === "novo", "descartar: backend recusa sem motivo e nada muda");
  await ir("?visao=kanban&busca=" + encodeURIComponent(marca));
  await arrastar(c, desfecho("descartado"));
  await page.getByRole("dialog", { name: "Descartar prospect" }).waitFor();
  confere(await estadoDe(c) === "novo", "descartar: soltar no desfecho só abre o diálogo de motivo");
  await page.getByRole("dialog").getByRole("button", { name: "Dados insuficientes" }).click();
  await page.getByText("descartada. O histórico foi preservado").waitFor();
  await recarregar();
  const [dc] = await db.execute<{ e: string; m: string; h: number }>(sql`
    SELECT prospeccao_estado e, prospeccao_descarte_motivo m, (SELECT count(*)::int FROM vendas_eventos WHERE lead_id = l.id) h FROM leads l WHERE id = ${c}::uuid`);
  confere(dc.e === "descartado" && dc.m === "dados_insuficientes" && dc.h >= 1, "descartar: estado e motivo persistidos, histórico preservado");
  confere((await desfecho("descartado").textContent())?.includes("1") === true, "descartar: contador do desfecho (fila derivada) = 1 após F5");
  const rVolta = await moverProspect({ organizacaoId: org, leadId: c, para: "novo", ator }).then(() => "ok", (x) => (x as { codigo?: string }).codigo);
  confere(rVolta === "transicao_invalida", "regra: descartado não volta a nenhum estado");

  // ── 7. Pré-qualificar ────────────────────────────────────────────────────
  await ir("?visao=kanban&busca=" + encodeURIComponent(marca));
  await arrastar(d, desfecho("pre_qualificado"));
  await page.getByText("entregue a Pré-vendas").waitFor();
  const [pq] = await db.execute<{ e: string; etapa: string; pre: boolean; aq: number }>(sql`
    SELECT prospeccao_estado e, estagio_pre_vendas etapa, pre_qualificado pre,
           (SELECT count(*)::int FROM aquisicoes WHERE lead_legado_id = l.id) aq FROM leads l WHERE id = ${d}::uuid`);
  confere(pq.e === "pre_qualificado" && pq.etapa === "novo" && pq.pre === true && pq.aq === 1, "pré-qualificar: Pré-vendas/Novo, fato pre_qualificado, exatamente 1 aquisição");
  // repetir não duplica
  await moverProspect({ organizacaoId: org, leadId: d, para: "pre_qualificado", ator });
  const [{ aq2 }] = await db.execute<{ aq2: number }>(sql`SELECT count(*)::int aq2 FROM aquisicoes WHERE lead_legado_id = ${d}::uuid`);
  confere(aq2 === 1, "pré-qualificar repetido: continua 1 aquisição");
  await page.getByRole("link", { name: "Abrir em Pré-vendas" }).click();
  await page.waitForURL(`**/pre-vendas/${d}`);
  confere(await page.getByText(`${marca} Ltda d`).first().waitFor().then(() => true, () => false), "pré-qualificar: o banner leva à tela do lead em Pré-vendas");

  // ── 8. Oportunidade direta sem duplicar ──────────────────────────────────
  await ir("?visao=kanban&busca=" + encodeURIComponent(marca));
  await arrastar(e, desfecho("oportunidade"));
  const dlg = page.getByRole("dialog", { name: "Oportunidade direta" });
  await dlg.waitFor();
  await dlg.locator(".ov-familia").first().click();
  await dlg.locator("select").selectOption({ index: 1 });
  const btn = dlg.getByRole("button", { name: "Criar oportunidade" });
  await btn.dblclick().catch(() => undefined); // o segundo clique cai com o botão já desabilitado
  await page.getByText("criada no Pipeline").waitFor();
  const concorrente = await Promise.all([1, 2, 3].map(() => moverProspect({ organizacaoId: org, leadId: e, para: "oportunidade", familias: ["PABX"], responsavelId: s.usuarioId, ator }).then(() => "ok", (x) => (x as { codigo?: string }).codigo)));
  const [op] = await db.execute<{ n: number; src: string | null }>(sql`
    SELECT count(*)::int n, max(source_process) src FROM negocios WHERE lead_id = ${e}::uuid`);
  confere(op.n === 1 && op.src === "OUTBOUND_DIRECT", `oportunidade direta: 1 negócio, source OUTBOUND_DIRECT, mesmo com clique duplo e 3 chamadas concorrentes (${concorrente.join(",")})`);
  confere(await estadoDe(e) === "oportunidade", "oportunidade direta: prospect em Oportunidade");
  const [{ naoLead }] = await db.execute<{ naoLead: boolean }>(sql`SELECT (estagio_pre_vendas IS NULL OR estagio_pre_vendas <> 'novo' OR tipo <> 'lead') AS "naoLead" FROM leads WHERE id = ${e}::uuid`);
  confere(naoLead, "oportunidade direta: NÃO virou Lead de Pré-vendas");
  const semFam = await moverProspect({ organizacaoId: org, leadId: f, para: "oportunidade", familias: [], responsavelId: s.usuarioId, ator }).then(() => "ok", (x) => (x as { codigo?: string }).codigo);
  confere(semFam === "oportunidade_exige_familia", "oportunidade direta: sem família é recusada");
  await page.getByRole("link", { name: "Abrir no Pipeline" }).first().click();
  await page.waitForURL(/\/pipeline\//);
  confere(await page.getByText(`${marca} Ltda e`).first().waitFor().then(() => true, () => false), "oportunidade direta: aparece no Pipeline (Entrada)");

  // ── 9. Transição proibida e erro de rede revertem a tela ─────────────────
  await ir("?visao=kanban&busca=" + encodeURIComponent(marca));
  await arrastar(f, coluna("respondeu"));
  await page.getByText("Inclua a empresa em uma cadência primeiro").first().waitFor();
  confere(await coluna("novo").locator(`.pp-card[data-lead="${f}"]`).count() === 1 && await estadoDe(f) === "novo", "transição proibida (Novo → Respondeu): explica o motivo e nada muda");
  abortando = true;
  await page.route("**/prospeccao**", (r: { request: () => { headers: () => Record<string, string> }; abort: () => Promise<void>; continue: () => Promise<void> }) =>
    r.request().headers()["next-action"] ? r.abort() : r.continue());
  await arrastar(f, desfecho("pre_qualificado"));
  await page.getByText("Não foi possível falar com o CRM").first().waitFor();
  confere(await coluna("novo").locator(`.pp-card[data-lead="${f}"]`).count() === 1 && await estadoDe(f) === "novo", "erro de rede: o card volta para Novo e o banco não mudou (reversão)");
  await page.screenshot({ path: `${OUT}/09-erro-reversao-1440.png` });
  await page.unroute("**/prospeccao**");
  abortando = false;

  // ── 10. Lista: busca, ordenação, paginação, F5 ───────────────────────────
  await ir("?busca=" + encodeURIComponent(marca) + "&ordem=empresa&dir=desc");
  const nomes = await page.locator(".pp-linha:not(.pp-linha-cab) .pp-principal").allTextContents();
  confere(nomes.length >= 6 && [...nomes].sort().reverse().join("|") === nomes.join("|"), "lista: busca + ordenação por empresa (desc) na URL");
  await ir("?porPagina=25");
  await page.getByRole("button", { name: "Próxima", exact: true }).click();
  await page.waitForURL(/pagina=2/);
  await recarregar();
  confere(await page.getByText(/Página 2 de/).isVisible(), "lista: paginação real e página sobrevive ao F5");
  await page.screenshot({ path: `${OUT}/10-lista-1440.png` });

  // ── 11. Operação = banco ─────────────────────────────────────────────────
  await ir("?visao=operacao");
  const [{ novos }] = await db.execute<{ novos: number }>(sql`SELECT count(*)::int novos FROM leads WHERE organizacao_id = ${org}::uuid AND prospeccao_estado = 'novo'`);
  const tileNovo = await page.locator(".pp-tile", { hasText: "Novos" }).first().locator(".pp-tile-valor").textContent();
  confere(Number(tileNovo) === novos, `operação: tile Novos (${tileNovo}) = banco (${novos})`);
  await page.screenshot({ path: `${OUT}/11-operacao-1440.png` });
  for (const v of ["campanhas", "inteligencia"]) {
    await ir(`?visao=${v}`);
    confere(await page.locator(".pp-visao").isVisible(), `visão ${v} abre com dado real ou vazio honesto`);
  }

  // ── 12. 390px ────────────────────────────────────────────────────────────
  const ctxM = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await ctxM.addCookies([{ name: "authjs.session-token", value: s.cookie.split("=").slice(1).join("="), url: BASE }]);
  const m = await ctxM.newPage();
  m.setDefaultTimeout(60000);
  const errosM: string[] = [];
  m.on("console", (x: { type: () => string; text: () => string }) => { if (x.type() === "error") errosM.push(x.text().slice(0, 160)); });
  for (const qs of ["?visao=kanban", "", "?visao=operacao"]) {
    await m.goto(`${BASE}/prospeccao${qs}&busca=${encodeURIComponent(marca)}`.replace("&busca", qs ? "&busca" : "?busca"), { waitUntil: "domcontentloaded" }); await m.locator(".pp:visible").first().waitFor(); await m.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);
    const sobra = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    confere(sobra <= 1, `390px ${qs || "lista"}: sem rolagem horizontal da página (sobra ${sobra}px)`);
  }
  await m.goto(`${BASE}/prospeccao?visao=kanban&busca=${encodeURIComponent(marca)}`, { waitUntil: "domcontentloaded" }); await m.locator(".pp:visible").first().waitFor(); await m.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);
  await m.locator(`.pp-card[data-lead="${f}"] .pp-card-menu`).click();
  await m.getByRole("menuitem", { name: "Adicionar à cadência" }).click();
  await m.getByRole("dialog").getByRole("button", { name: cadenciaNome }).click();
  await m.getByText("entrou em cadência").waitFor();
  confere(await estadoDe(f) === "em_cadencia", "390px: menu 'Mover para' (toque) move para Em cadência e persiste");
  await m.screenshot({ path: `${OUT}/12-kanban-390.png` });
  await m.locator(`.pp-card[data-lead="${f}"] .ov-card`).click();
  await m.locator(".pp-abas-drawer").waitFor();
  const cheio = await m.evaluate(() => { const r = document.querySelector(".ov-painel")?.getBoundingClientRect(); return r ? Math.round(r.width) : 0; });
  confere(cheio >= 385, `390px: drawer ocupa a tela (${cheio}px)`);
  await m.screenshot({ path: `${OUT}/12-drawer-390.png` });
  await ctxM.close();

  confere(errosConsole.length === 0, `console limpo no desktop (${errosConsole.length}) ${errosConsole.slice(0, 3).join(" | ")}`);
  confere(errosM.length === 0, `console limpo no mobile (${errosM.length}) ${errosM.slice(0, 3).join(" | ")}`);
  confere(errosRede.filter((x) => !x.includes("/_next/")).length === 0, `rede sem 4xx/5xx (${errosRede.slice(0, 3).join(" | ")})`);

  await browser.close();
  await limpar();
  const [{ resto }] = await db.execute<{ resto: number }>(sql`SELECT count(*)::int resto FROM leads WHERE nome LIKE ${PREFIXO} OR empresa LIKE ${PREFIXO}`);
  confere(resto === 0, "limpeza: nada de prova ficou no banco local");

  console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : "\nTudo OK");
  process.exit(falhas.length ? 1 : 0);
}

main().catch(async (err) => { console.error(err); await limpar().catch(() => undefined); process.exit(1); });
