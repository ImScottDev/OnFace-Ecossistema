// Callpilot pra lead "Novo" — gatilho automático de ligação de IA (Fase 3 do
// plano em PLANO-CALLPILOT-LEAD-NOVO.md). Lead cai em sdrStatus='pending'
// ("Novo" no board Pré-vendas) → pega o próximo closer da fila + horários reais
// da agenda dela (CRM + Outlook) → cria uma campanha nova na Callface pro
// agente "Nathália - Callpilot (Leads Novos)" com 1 contato + variáveis
// dinâmicas → ativa a campanha (a Callface liga sozinha em segundos).
//
// Caminho A (decidido pelo Kauã, 23/07): a Callface só roteia um contato pra
// um agente de IA específico via upload manual de planilha numa campanha nova
// — não existe API pra isso nem pra adicionar contato numa campanha já
// existente (ver seção 1 do plano). Por isso a automação aqui é via
// puppeteer (mesmo binário chromium já usado em lib/propostas/proposta-pdf.ts,
// já instalado no container `worker`).
import { existsSync } from "node:fs";
import { and, desc, eq, gte, isNotNull, isNull } from "drizzle-orm";
import puppeteer from "puppeteer";
import * as XLSX from "xlsx";
import { leads as leadsT, atividades as ativT, emailContas, ligacoes as ligacoesT } from "@/lib/db/schema";
import { pickNextCloser, getActiveClosers, getFullAvailability, type DiaDisponibilidade } from "@/lib/crm/agenda-closers";
import { getBusyTimes } from "@/lib/email/microsoft";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

const CALLFACE_AGENT_NAME = "Nathália - Callpilot (Leads Novos)";
const JANELA_MAXIMA_MS = 2 * 60 * 60 * 1000; // mesma trava do ai-sdr-outreach: só lead novo, nunca backlog histórico
const GRACE_PERIOD_CALLPILOT_MS = 20 * 60 * 1000; // tempo de espera pela ligação antes do fallback WhatsApp assumir

/**
 * Callpilot (voz) é o canal PRIMÁRIO pra lead "Novo"; o Agente SDR (WhatsApp,
 * lib/crm/ai-sdr-outreach.ts) só deve agir como FALLBACK — pedido explícito do
 * Kauã (23/07): "cai em Novo, faz a ligação, não teve sucesso aí sim mensagem
 * no whatsapp". Usado pelo sweep do WhatsApp (worker/index.ts,
 * runAiSdrFirstContactSweep) pra decidir se ainda deve esperar a ligação.
 *
 * - "pendente": Callpilot disparou a campanha há pouco tempo, nenhuma ligação
 *   chegou ainda pelo webhook — segura o WhatsApp.
 * - "falhou": ligação chegou sem sucesso (curta/MISSED/FAILED) OU estourou o
 *   prazo de espera sem nenhuma ligação — libera o fallback WhatsApp.
 * - "sucesso": ligação conectou de verdade — não deveria nem chegar aqui (lead
 *   segue em sdr_status='pending' até a IA confirmar reunião ou não, mas por
 *   segurança também libera, pra nunca travar um lead pra sempre).
 */
export async function avaliarResultadoCallpilot(
  db: Db,
  leadId: string,
  disparadoEm: Date,
): Promise<"pendente" | "sucesso" | "falhou"> {
  const [ligacao] = await db
    .select({ callStatus: ligacoesT.callStatus, duracaoSegundos: ligacoesT.duracaoSegundos, callDate: ligacoesT.callDate })
    .from(ligacoesT)
    .where(and(eq(ligacoesT.leadId, leadId), gte(ligacoesT.callDate, disparadoEm)))
    .orderBy(desc(ligacoesT.callDate))
    .limit(1);

  if (!ligacao) {
    const decorrido = Date.now() - disparadoEm.getTime();
    return decorrido > GRACE_PERIOD_CALLPILOT_MS ? "falhou" : "pendente";
  }
  const sucesso = ligacao.callStatus === "FINISHED" && (ligacao.duracaoSegundos ?? 0) >= 15;
  return sucesso ? "sucesso" : "falhou";
}

function resolveChromePath(): string | undefined {
  const env = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (env && existsSync(env)) return env;
  for (const p of ["/usr/bin/chromium-browser", "/usr/bin/chromium", "/usr/lib/chromium/chrome"]) {
    if (existsSync(p)) return p;
  }
  return env || undefined;
}

/** "15h", "15h30" — formato falado pelo roteiro da Nathália, sem minutos quando é hora cheia. */
function formatHora(d: Date): string {
  const h = d.toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo", hour12: false });
  const [hh, mm] = h.split(":");
  return mm === "00" ? `${parseInt(hh, 10)}h` : `${parseInt(hh, 10)}h${mm}`;
}

export interface VariaveisNathalia {
  nome_do_lead: string;
  horario_opcao_1: string;
  horario_opcao_2: string;
  horario_opcao_3: string;
}

/**
 * 2 horários do 1º dia com vaga + 1 do dia seguinte com vaga — mesma
 * distribuição de getAvailableSlots, mas cruzando Outlook (getFullAvailability
 * + busyExtra), igual à rota GET /closers/:id/slots-reais. Null se a closer
 * não tiver disponibilidade configurada ou não sobrar nenhum slot nos
 * próximos 7 dias (aí o sweep pula o lead — não força ligação sem horário
 * real, guardrail do próprio roteiro).
 */
export async function calcularVariaveisHorario(
  db: Db,
  closerId: string,
  nomeLead: string,
): Promise<VariaveisNathalia | null> {
  let busyExtra: { inicio: Date; fim: Date }[] = [];
  const [conta] = await db
    .select({ id: emailContas.id })
    .from(emailContas)
    .where(and(eq(emailContas.usuarioId, closerId), eq(emailContas.tipo, "microsoft"), eq(emailContas.syncStatus, "active")))
    .limit(1);
  if (conta) {
    try {
      const now = new Date();
      const rangeEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      busyExtra = await getBusyTimes(conta.id, now.toISOString(), rangeEnd.toISOString());
    } catch (e) {
      console.error("[Callpilot] falha ao buscar Outlook do closer (seguindo só com CRM):", e);
    }
  }

  const dias: DiaDisponibilidade[] = await getFullAvailability(db, closerId, { lookaheadDays: 7, busyExtra });
  if (dias.length === 0) return null;

  const horarios: string[] = [];
  horarios.push(...dias[0].slots.slice(0, 2).map((s) => formatHora(s.inicio)));
  if (dias.length > 1) horarios.push(formatHora(dias[1].slots[0].inicio));
  else if (dias[0].slots.length > 2) horarios.push(formatHora(dias[0].slots[2].inicio));

  if (horarios.length === 0) return null;
  while (horarios.length < 3) horarios.push(horarios[horarios.length - 1]);

  return {
    nome_do_lead: nomeLead.trim().split(/\s+/)[0] || nomeLead,
    horario_opcao_1: horarios[0],
    horario_opcao_2: horarios[1],
    horario_opcao_3: horarios[2],
  };
}

function montarPlanilhaCampanha(telefoneRaw: string, variaveis: VariaveisNathalia): Buffer {
  // Callface: coluna "Telefone" tem que ser DDD+número puro, SEM "+55" (ela
  // prefixa sozinha) — bug real encontrado em teste manual 22/07, ver plano.
  const telefone = telefoneRaw.replace(/\D/g, "").replace(/^55/, "");
  const row = { Telefone: telefone, Nome: variaveis.nome_do_lead, ...variaveis };
  const sheet = XLSX.utils.json_to_sheet([row]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Contatos");
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/**
 * Automação via puppeteer (login → Agentes → card da Nathália → Nova
 * Campanha → upload → Criar campanha → toggle de ativação). Sem API pra isso
 * na Callface (ver seção 1 do plano) — validado manualmente 22-23/07.
 */
async function dispararCampanhaCallface(nomeCampanha: string, xlsxBuffer: Buffer): Promise<{ ok: boolean; erro?: string }> {
  const email = process.env.CALLFACE_EMAIL;
  const senha = process.env.CALLFACE_PASSWORD;
  if (!email || !senha) return { ok: false, erro: "CALLFACE_EMAIL/CALLFACE_PASSWORD não configurados no ambiente" };

  const execPath = resolveChromePath();
  const browser = await puppeteer.launch({
    ...(execPath ? { executablePath: execPath } : {}),
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    // Callface usa i18next; uma sessão headless nova (sem localStorage) renderiza
    // em INGLÊS por padrão ("Sign in with email" em vez de "Entrar com seu
    // email") — confirmado isolando o puppeteer fora do fluxo real (23/07).
    // `Accept-Language`/`--lang` do Chrome NÃO mudam isso (testado, sem efeito);
    // o app só respeita a chave `i18nextLng` do localStorage, então força ela
    // ANTES de qualquer script da página rodar.
    await page.evaluateOnNewDocument(() => {
      localStorage.setItem("i18nextLng", "pt-BR");
    });
    await page.setViewport({ width: 1440, height: 900 });

    // Login em 2 passos: "/sign-in" só mostra o botão de entrar com email; o
    // form de email/senha de verdade só aparece em "/sign-in/email" (achado
    // 23/07). Seletor por data-testid (independe de idioma, mais robusto que
    // texto mesmo com o locale forçado acima).
    await page.goto("https://app.callface.ai/sign-in", { waitUntil: "networkidle2", timeout: 30000 });
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => null),
      page.click('[data-testid="auth-component-social-button-EMAIL"]').catch(() => null),
    ]);
    await page.waitForSelector('input[type="email"]', { timeout: 15000 });
    await page.type('input[type="email"]', email, { delay: 20 });
    await page.type('input[type="password"]', senha, { delay: 20 });
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }).catch(() => null),
      page.click('[data-testid="auth-component-submit-button"]').catch(() => null),
    ]);

    await page.goto("https://app.callface.ai/agents", { waitUntil: "networkidle2", timeout: 30000 });
    // A lista de agentes carrega via API depois do "networkidle2" (fetch client-side
    // já dentro da janela de rede ociosa) — 1.5s fixo não bastava sempre (achado
    // 23/07: falhou 1x com 1.5s, funcionou com 4s). Espera ativa pelo card real
    // em vez de sleep fixo, mais robusto contra variação de latência.
    await page.waitForFunction(
      (agentName: string) =>
        Array.from(document.querySelectorAll("*")).some((el) => el.children.length === 0 && el.textContent?.trim() === agentName),
      { timeout: 15000 },
      CALLFACE_AGENT_NAME,
    );

    // Acha o card do agente Nathália pelo nome e clica "Nova campanha" DENTRO
    // DELE. Bug real encontrado 23/07: `querySelectorAll('div').find(textContent
    // includes agentName)` pega o PRIMEIRO div cujo texto contém o nome —
    // como todos os cards ficam dentro de um wrapper comum, isso geralmente
    // acha o wrapper GRANDE (que contém todos os agentes) e clica no primeiro
    // botão "Nova campanha" da página inteira, não o do card certo (validado:
    // criou campanha no "Agente de Prospecção" em vez da Nathália). Fix: achar
    // o elemento MAIS ESPECÍFICO (folha, sem filhos) cujo texto é EXATAMENTE o
    // nome do agente, e subir só alguns níveis de ancestral até achar o botão.
    const clicked = await page.evaluate((agentName: string) => {
      const folhas = Array.from(document.querySelectorAll("*")).filter(
        (el) => el.children.length === 0 && el.textContent?.trim() === agentName,
      );
      for (const folha of folhas) {
        let el: Element | null = folha;
        for (let i = 0; i < 8 && el; i++) {
          const btn = Array.from(el.querySelectorAll("button")).find((b) => b.textContent?.includes("Nova campanha"));
          if (btn) { (btn as HTMLButtonElement).click(); return true; }
          el = el.parentElement;
        }
      }
      return false;
    }, CALLFACE_AGENT_NAME);
    if (!clicked) return { ok: false, erro: `Card do agente "${CALLFACE_AGENT_NAME}" ou botão "Nova campanha" não encontrado` };

    await new Promise((r) => setTimeout(r, 1500));

    // Nome da campanha — real: <input name="name" placeholder="Nome"> (confirmado
    // ao vivo 23/07; versão anterior procurava name*="nome"/placeholder*="ampanha",
    // que não batia com o DOM real e deixava o campo vazio).
    await page.waitForSelector('input[name="name"]', { timeout: 10000 });
    await page.type('input[name="name"]', nomeCampanha, { delay: 10 });

    // Upload do xlsx — real: <input type="file" id="file-input"> (confirmado ao
    // vivo). Arquivo temporário em /tmp (container Linux).
    const fs = await import("node:fs/promises");
    const os = await import("node:os");
    const path = await import("node:path");
    const tmpPath = path.join(os.tmpdir(), `callpilot-${Date.now()}.xlsx`);
    await fs.writeFile(tmpPath, xlsxBuffer);

    const fileInput = await page.$("#file-input");
    if (!fileInput) return { ok: false, erro: "Input de upload de arquivo (#file-input) não encontrado no wizard de campanha" };
    await (fileInput as import("puppeteer").ElementHandle<HTMLInputElement>).uploadFile(tmpPath);
    // Espera o preview de "Estatísticas do upload" processar o arquivo (client-side,
    // tempo variável) em vez de sleep fixo — mesma lição do achado da lista de agentes.
    await page.waitForFunction(() => document.body.textContent?.includes("Estatísticas do upload"), { timeout: 15000 }).catch(() => null);
    await fs.unlink(tmpPath).catch(() => null);

    // "Continuar" → "Criar campanha". Espera ativa pelo botão em vez de sleep fixo.
    for (const label of ["Continuar", "Criar campanha"]) {
      await page.waitForFunction(
        (txt: string) => Array.from(document.querySelectorAll("button")).some((b) => b.textContent?.trim() === txt),
        { timeout: 15000 },
        label,
      );
      const ok = await page.evaluate((txt: string) => {
        const btn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.trim() === txt);
        if (!btn) return false;
        (btn as HTMLButtonElement).click();
        return true;
      }, label);
      if (!ok) return { ok: false, erro: `Botão "${label}" não encontrado no wizard de campanha` };
    }

    // Ativação: toggle `div.switch` ao lado da campanha recém-criada (sem
    // role/input acessível — achado 22/07, único jeito é querySelectorAll).
    // Espera de verdade pelo nome da campanha aparecer (mesma lição do card do
    // agente: a listagem demora mais que qualquer sleep fixo às vezes).
    await page.goto("https://app.callface.ai/agents", { waitUntil: "networkidle2", timeout: 30000 });
    await page.waitForFunction(
      (campanha: string) => Array.from(document.querySelectorAll("*")).some((el) => el.children.length === 0 && el.textContent?.trim() === campanha),
      { timeout: 15000 },
      nomeCampanha,
    ).catch(() => null);
    // SEM fallback de "qualquer switch da tela" (removido 23/07): com múltiplos
    // leads processados em sequência, pode haver mais de uma campanha pendente
    // ao mesmo tempo (ex: campanha manual antiga "teste AGENTE IA") — ativar a
    // errada é pior que falhar e cair pro aviso manual.
    // Bug real encontrado 23/07: o nome da campanha renderiza dentro de um
    // <span> (não <div>) — `querySelectorAll("div").filter(textContent exato)`
    // nunca batia (o <span> nem entra no querySelectorAll, e o <div> pai já
    // tem texto extra tipo "Pendente" junto, quebrando o match exato).
    // Confirmado isolando o puppeteer: div.switch existe 2 níveis acima do
    // <span> com o nome exato. Fix: mesmo padrão de folha (`*`) do card do
    // agente, não restrito a "div".
    const ativado = await page.evaluate((campanha: string) => {
      const folhas = Array.from(document.querySelectorAll("*")).filter(
        (el) => el.children.length === 0 && el.textContent?.trim() === campanha,
      );
      for (const folha of folhas) {
        let el: Element | null = folha;
        for (let i = 0; i < 8 && el; i++) {
          const sw = el.querySelector("div.switch") as HTMLElement | null;
          if (sw) { sw.click(); return true; }
          el = el.parentElement;
        }
      }
      return false;
    }, nomeCampanha);
    if (!ativado) return { ok: false, erro: "Toggle de ativação da campanha não encontrado" };

    // Passo 2 de ativação (achado 23/07, confirmado pelo Kauã ao vivo): o
    // toggle sozinho NÃO basta — precisa também abrir o menu de ações da
    // campanha em /auto-dialer e clicar "Iniciar". Contradiz o achado de 22/07
    // ("toggle sozinho suficiente em todo teste") — provavelmente mudou no
    // fluxo da Callface, ou o teste anterior não cobriu esse caso; o
    // comportamento real observado agora é o que vale.
    await new Promise((r) => setTimeout(r, 1500));
    await page.goto("https://app.callface.ai/auto-dialer", { waitUntil: "networkidle2", timeout: 30000 });
    await page.waitForFunction(
      (campanha: string) => Array.from(document.querySelectorAll("tr")).some((r) => r.textContent?.includes(campanha)),
      { timeout: 15000 },
      nomeCampanha,
    ).catch(() => null);

    const iniciado = await page.evaluate((campanha: string) => {
      const rows = Array.from(document.querySelectorAll("tr"));
      const row = rows.find((r) => r.textContent?.includes(campanha));
      if (!row) return "ROW_NOT_FOUND";
      const btn = row.querySelector('button[aria-label="actions"]') as HTMLButtonElement | null;
      if (!btn) return "ACTIONS_BTN_NOT_FOUND";
      btn.click();
      return "MENU_OPENED";
    }, nomeCampanha);
    if (iniciado !== "MENU_OPENED") return { ok: false, erro: `Falha ao abrir menu de ações da campanha (${iniciado})` };

    await new Promise((r) => setTimeout(r, 500));
    const clicouIniciar = await page.evaluate(() => {
      const item = Array.from(document.querySelectorAll('[role="menuitem"]')).find((m) => m.textContent?.trim() === "Iniciar");
      if (!item) return false;
      (item as HTMLElement).click();
      return true;
    });
    if (!clicouIniciar) return { ok: false, erro: 'Item de menu "Iniciar" não encontrado' };

    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  } finally {
    await browser.close().catch(() => null);
  }
}

/**
 * Sweep (job "callpilot-novo-lead", scheduled-jobs, a cada 5min — mesmo
 * padrão do ai-sdr-outreach). Lead em "Novo" recém-criado (mesma trava de 2h
 * de sempre, evita disparar backlog histórico) → pega/fixa o closer (reaproveita
 * leads.agendaCloserId se já tiver, senão pickNextCloser + fixa) → calcula
 * horários reais → dispara campanha na Nathália. Idempotente via
 * leads.callpilotDisparadoEm (setado ANTES da automação de browser, não
 * depois — evita duplo disparo se o puppeteer travar/repetir no meio).
 */
export async function runCallpilotNovoLeadSweep(db: Db): Promise<{ disparados: number; pulados: number }> {
  const janelaMaxima = new Date(Date.now() - JANELA_MAXIMA_MS);
  console.log(`[Callpilot] sweep iniciado, janelaMaxima=${janelaMaxima.toISOString()}`);

  const pendentes = await db
    .select({
      id: leadsT.id,
      nome: leadsT.nome,
      telefone: leadsT.telefone,
      organizacaoId: leadsT.organizacaoId,
      agendaCloserId: leadsT.agendaCloserId,
    })
    .from(leadsT)
    .where(
      and(
        eq(leadsT.tipo, "lead"),
        eq(leadsT.sdrStatus, "pending"),
        isNotNull(leadsT.telefone),
        isNull(leadsT.callpilotDisparadoEm),
        gte(leadsT.createdAt, janelaMaxima),
      ),
    )
    .limit(20);

  console.log(`[Callpilot] pendentes encontrados: ${pendentes.length}`);

  let disparados = 0;
  let pulados = 0;

  for (const lead of pendentes) {
    console.log(`[Callpilot] processando lead ${lead.id} (${lead.nome})`);
    try {
      let closer: { id: string; nome: string } | null = null;
      if (lead.agendaCloserId) {
        const ativos = await getActiveClosers(db, lead.organizacaoId);
        closer = ativos.find((c: { id: string }) => c.id === lead.agendaCloserId) || null;
      }
      if (!closer) closer = await pickNextCloser(db, lead.organizacaoId);
      if (!closer) { pulados++; continue; } // sem closer ativo no rodízio, nada a fazer

      const variaveis = await calcularVariaveisHorario(db, closer.id, lead.nome);
      if (!variaveis) { pulados++; continue; } // closer sem horário livre real nos próximos 7 dias

      if (lead.agendaCloserId !== closer.id) {
        await db.update(leadsT).set({ agendaCloserId: closer.id }).where(eq(leadsT.id, lead.id));
      }

      const nomeCampanha = `Callpilot - ${lead.nome} - ${new Date().toISOString().slice(0, 10)}`;
      const xlsx = montarPlanilhaCampanha(lead.telefone as string, variaveis);

      // Marca disparado ANTES de automatizar o browser — se o puppeteer travar
      // ou o worker cair no meio, o sweep seguinte não tenta de novo (evita
      // criar 2 campanhas/ligar 2x pro mesmo lead).
      await db.update(leadsT).set({ callpilotDisparadoEm: new Date() }).where(eq(leadsT.id, lead.id));

      const resultado = await dispararCampanhaCallface(nomeCampanha, xlsx);

      await db.insert(ativT).values({
        leadId: lead.id,
        organizacaoId: lead.organizacaoId,
        tipo: "nota",
        titulo: resultado.ok ? "Callpilot disparado" : "Callpilot falhou",
        descricao: resultado.ok
          ? `Campanha "${nomeCampanha}" criada e ativada na Callface (agente Nathália), closer ${closer.nome}. Horários oferecidos: ${variaveis.horario_opcao_1}, ${variaveis.horario_opcao_2}, ${variaveis.horario_opcao_3}.`
          : `Falha ao disparar campanha "${nomeCampanha}": ${resultado.erro}`,
      });

      if (resultado.ok) {
        disparados++;
        console.log(`[Callpilot] Campanha "${nomeCampanha}" disparada pro lead ${lead.id} (closer ${closer.nome})`);
      } else {
        console.error(`[Callpilot] Falha ao disparar campanha pro lead ${lead.id}: ${resultado.erro}`);
      }
    } catch (e) {
      console.error(`[Callpilot] erro processando lead ${lead.id}:`, e);
    }
  }

  return { disparados, pulados };
}
