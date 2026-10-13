// Geração do PDF da Proposta Comercial (moldes Zoho) via HTML + Chrome headless.
// Renderiza no container `api` (Hono). Requer chromium (PUPPETEER_EXECUTABLE_PATH).
import { periodoDoItem, totaisPorPeriodo } from "@/lib/crm/periodo-cobranca";
import { formaPagamentoSetup } from "@/lib/crm/condicoes-comerciais";
import puppeteer from "puppeteer";
import { existsSync } from "node:fs";
import { LOGO_WHITE, LOGO_COLOR } from "./pdf-assets";

/** Resolve o binário do Chromium (o caminho varia no Alpine). */
function resolveChromePath(): string | undefined {
  const env = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (env && existsSync(env)) return env;
  for (const p of [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/usr/lib/chromium/chrome",
  ]) {
    if (existsSync(p)) return p;
  }
  return undefined;
}

const CARMIM = "#e23752";
const ROXO = "#8e27ef";

export interface PropostaPdfItem {
  nome: string;
  descricao?: string | null;
  tipo: string; // recorrente | avulso | setup
  /** mensal | anual | unico, do Price: anual não se escreve "Mensal". */
  periodo?: string | null;
  quantidade: string | number;
  valorUnitario: string | number;
  subtotal: string | number;
}

export interface PropostaPdfData {
  numero: number;
  versao: number;
  moeda?: string | null;
  dataEmissao?: string | Date | null;
  dataValidade?: string | Date | null;
  prazoContratoMeses?: number | null;
  condicoesPagamento?: string | null;
  condicaoPagamentoTipo?: string | null;
  parcelas?: number | null;
  totalRecorrente?: string | number | null;
  totalAvulso?: string | number | null;
  totalGeral?: string | number | null;
  checkoutUrl?: string | null; // link direto de pagamento (Stripe) — vira botão no PDF
  criadoPorNome?: string | null;
  criadoPorEmail?: string | null;
  leadNome?: string | null;
  leadEmpresa?: string | null;
  leadEmail?: string | null;
  leadTelefone?: string | null;
  itens: PropostaPdfItem[];
}

function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function money(v: unknown, moeda = "BRL"): string {
  const n = Number(v ?? 0);
  const sym = moeda === "USD" ? "US$" : moeda === "EUR" ? "€" : moeda === "CAD" ? "C$" : "R$";
  return `${sym} ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function qtd(v: unknown): string {
  const n = Number(v ?? 1);
  return Number.isInteger(n) ? String(n) : n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}
function dataBR(v: unknown): string {
  if (!v) return "—";
  const d = new Date(v as string);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}
function recorrenciaLabel(tipo: string, periodo?: string | null): string {
  if (tipo === "recorrente") return periodo === "anual" ? "Anual" : "Mensal";
  if (tipo === "setup") return "Setup";
  return "Avulso";
}

function itensTabela(itens: PropostaPdfItem[], moeda: string, titulo: string, total: unknown): string {
  if (!itens.length) return "";
  const rows = itens
    .map((it) => {
      const desc = (it.descricao || "")
        // itens do catálogo vêm com features separadas por "; " numa string só —
        // quebra em linha própria tanto por "\n" real quanto por cada ";".
        .replace(/;\s*/g, ";\n")
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => `<div class="it-desc">${esc(l)}</div>`)
        .join("");
      return `<tr>
        <td class="it-nome"><strong>${esc(it.nome)}</strong>${desc}</td>
        <td class="ctr">${recorrenciaLabel(it.tipo, it.periodo)}</td>
        <td class="ctr">${qtd(it.quantidade)}</td>
        <td class="rgt">${money(it.valorUnitario, moeda)}</td>
        <td class="rgt">${money(it.subtotal, moeda)}</td>
      </tr>`;
    })
    .join("");
  return `<table class="mapa">
    <thead>
      <tr class="mapa-title"><th colspan="5">${titulo}</th></tr>
      <tr class="mapa-head"><th>Item</th><th class="ctr">Recorrência</th><th class="ctr">Qnt</th><th class="rgt">Preço</th><th class="rgt">Total</th></tr>
    </thead>
    <tbody>${rows}
      <tr class="mapa-total"><td colspan="4" class="rgt">Total</td><td class="rgt">${money(total, moeda)}</td></tr>
    </tbody>
  </table>`;
}

function header(): string {
  return `<div class="hd">
    <img class="hd-logo" src="${LOGO_COLOR}" alt="callface"/>
    <div class="hd-contato">
      <div>&#9743; +55 (11) 5199-7000</div>
      <div>&#9673; callface</div>
      <div>in callface.pabxvirtual</div>
    </div>
  </div>`;
}

export function propostaPdfHtml(p: PropostaPdfData): string {
  const moeda = p.moeda || "BRL";
  const cliente = p.leadEmpresa || p.leadNome || "Cliente";
  const numeroFmt = `PROP ${String(p.numero).padStart(4, "0")}${p.versao > 1 ? ` · v${p.versao}` : ""}`;
  // Cada linha no período de cobrança do Price: a anuidade não entra na tabela (nem no total) "mensal".
  const doPeriodo = (per: "mensal" | "anual" | "unico") => p.itens.filter((i) => periodoDoItem(i).periodo === per);
  const recorrentes = doPeriodo("mensal");
  const anuais = doPeriodo("anual");
  const setups = doPeriodo("unico");
  const totais = totaisPorPeriodo(p.itens);

  const diferenciais = [
    ["GESTÃO SIMPLIFICADA", "Gerencie seu time no console de gerenciamento. Disponibilizamos também dashboard personalizado para sua empresa."],
    ["BINA INTELIGENTE", "Suas ligações saem com DDD de origem, aumentando a taxa de atendimento e transmitindo mais credibilidade desde o primeiro toque."],
    ["CAMPANHA DE DISCAGEM AUTOMÁTICA", "Automatize chamadas e ganhe tempo com distribuição automática das ligações para os usuários."],
    ["FLEXIBILIDADE DE CONTRATAÇÃO", "Contrate por usuários, pague somente pelos usuários que utilizar. Nada de pacotes e valores injustos — a solução acompanha seu crescimento."],
    ["FLEXIBILIDADE DE USO", "Cada ligação é transcrita com IA, facilitando análise e acompanhamento. Com CRM, suas ligações são resumidas direto no CRM, sem esforço manual."],
    ["TOTALMENTE INTEGRADO", "Integrado com as principais plataformas de CRM (Agendor, RD Station, Bitrix24, PipeDrive, HubSpot, Ploomes, Zoho, Salesforce)."],
  ]
    .map(([t, d]) => `<div class="dif"><div class="dif-t">${t}</div><div class="dif-d">${d}</div></div>`)
    .join("");

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body { font-family:-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; color:#1c1c22; font-size:11px; line-height:1.55; }
  .page { width:210mm; min-height:297mm; padding:0; position:relative; page-break-after:always; overflow:hidden; }
  .page:last-child { page-break-after:auto; }
  .body { padding:16mm 18mm; }
  h2 { color:${CARMIM}; font-size:15px; margin:0 0 10px; font-weight:800; }
  h3 { font-size:11.5px; margin:16px 0 4px; font-weight:700; }
  p { margin:0 0 8px; }
  ul { margin:0 0 8px 16px; }
  li { margin:2px 0; }
  .muted { color:#6b6b76; }

  /* header das paginas de conteudo */
  .hd { display:flex; justify-content:space-between; align-items:flex-start; padding:10mm 18mm 6mm;
        border-bottom:3px solid ${CARMIM}; }
  .hd-logo { height:34px; }
  .hd-contato { text-align:right; font-size:9px; color:#4a4a55; line-height:1.7; }

  /* capa */
  .cover-top { background:${CARMIM}; height:150mm; border-radius:0 0 50% 50% / 0 0 22% 22%;
      display:flex; flex-direction:column; align-items:center; justify-content:flex-start; padding-top:22mm; position:relative; }
  .cover-logo { height:52px; margin-bottom:18mm; }
  .cover-badge { display:flex; align-items:center; gap:14px; color:#fff; }
  .cover-badge .ico { flex-shrink:0; }
  .cover-badge .ttl { font-size:40px; font-weight:800; line-height:1.02; letter-spacing:-.5px; }
  .cover-smile { position:absolute; bottom:-1px; left:50%; transform:translateX(-50%); }
  .cover-meta { padding:20mm 22mm 0; }
  .cover-meta .row { margin:0 0 9px; font-size:13px; }
  .cover-meta .k { color:${CARMIM}; font-weight:800; }
  .cover-valid { text-align:center; color:#8a8a95; font-size:10.5px; margin-top:26mm; }

  /* diferenciais */
  .dif-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px 18px; margin-top:6px; }
  .dif { text-align:center; padding:6px; }
  .dif-t { font-weight:800; font-size:10.5px; color:#26262e; margin:6px 0 4px; }
  .dif-d { font-size:9.5px; color:#5a5a64; line-height:1.5; }

  /* tabelas genericas */
  table { width:100%; border-collapse:collapse; }
  .tbl { margin:8px 0 14px; font-size:10px; }
  .tbl th { background:${CARMIM}; color:#fff; text-align:left; padding:8px 10px; font-weight:700; }
  .tbl td { padding:7px 10px; border-bottom:1px solid #eee; vertical-align:top; }
  .tbl tr:nth-child(even) td { background:#faf7f8; }
  .ctr { text-align:center; } .rgt { text-align:right; }

  /* mapa de investimento */
  .mapa { margin:10px 0 16px; font-size:10.5px; }
  .mapa-title th { background:#f2eef0; color:${CARMIM}; font-weight:800; padding:9px 10px; font-size:11px; }
  .mapa-head th { background:#fff; color:#26262e; border-bottom:2px solid #e6e6ea; padding:7px 10px; font-weight:700; }
  .mapa td { padding:9px 10px; border-bottom:1px solid #eee; vertical-align:top; }
  .it-nome strong { color:#26262e; }
  .it-desc { color:#6b6b76; font-size:9px; }
  .mapa-total td { border-top:2px solid #e6e6ea; border-bottom:none; font-weight:800; color:#1c1c22; padding-top:10px; }

  .box { background:${CARMIM}; color:#fff; padding:12px 16px; border-radius:6px; margin-top:14px; }
  .box b { font-weight:800; }
</style></head><body>

<!-- CAPA -->
<section class="page">
  <div class="cover-top">
    <img class="cover-logo" src="${LOGO_WHITE}" alt="callface"/>
    <div class="cover-badge">
      <svg class="ico" width="52" height="52" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="3" width="16" height="19" rx="2" stroke="#fff" stroke-width="1.6"/>
        <rect x="8" y="1.5" width="8" height="3.5" rx="1" fill="#fff"/>
        <line x1="7.5" y1="10" x2="16.5" y2="10" stroke="#fff" stroke-width="1.4"/>
        <line x1="7.5" y1="13.5" x2="16.5" y2="13.5" stroke="#fff" stroke-width="1.4"/>
        <line x1="7.5" y1="17" x2="13" y2="17" stroke="#fff" stroke-width="1.4"/>
      </svg>
      <div class="ttl">Proposta<br/>Comercial</div>
    </div>
    <svg class="cover-smile" width="220" height="120" viewBox="0 0 220 120">
      <path d="M12 8 A100 100 0 0 0 208 8" fill="none" stroke="${ROXO}" stroke-width="14" stroke-linecap="round"/>
      <circle cx="208" cy="14" r="12" fill="${ROXO}"/>
    </svg>
  </div>
  <div class="cover-meta">
    <div class="row"><span class="k">Proposta:</span> ${esc(numeroFmt)}</div>
    <div class="row"><span class="k">Cliente:</span> ${esc(cliente)}</div>
    <div class="row"><span class="k">Data:</span> ${dataBR(p.dataEmissao || new Date())}</div>
    <div class="row"><span class="k">Responsável:</span> ${esc(p.criadoPorNome || "—")}</div>
    <div class="row"><span class="k">E-mail:</span> ${esc(p.criadoPorEmail || "—")}</div>
    <div class="cover-valid">Os dados contidos nesta Proposta Comercial são válidos até ${p.dataValidade ? dataBR(p.dataValidade) : "10 dias após o recebimento"}</div>
  </div>
</section>

<!-- 1. OBJETIVO -->
<section class="page">
  ${header()}
  <div class="body">
    <h2>1. Objetivo — Callface AI (SaaS)</h2>
    <ul>
      <li>Relatório de chamadas</li><li>Transferência de chamadas com IA</li><li>Gravação de chamadas</li>
      <li>Bina inteligente</li><li>Campanha de discagem automática</li><li>Monitoramento de ramais</li>
      <li>Relatórios de time</li><li>Tela ativa do Supervisor</li><li>Integração com CRM</li>
      <li>Resumo da ligação no CRM</li><li>ToDo das chamadas</li>
    </ul>
    <h3>1.1 Integração de plataforma</h3>
    <p class="muted">A solução possui integração com diversas plataformas de mercado. Algumas funcionalidades dependem de integração via API. Caso a plataforma seja diferente da lista padrão, tratamos a integração em proposta separada.</p>
    <h3>1.2 Suporte 24x7</h3>
    <p class="muted">Está incluído o suporte 24x7 para a solução Callface AI. A Callface não é responsável pelo suporte ao CRM (responsabilidade da contratante). Atividades fora do escopo contratado são tratadas como consultoria, não inclusas no valor desta proposta.</p>
    <h3>1.3 Bina inteligente</h3>
    <p class="muted">As chamadas com Bina Inteligente são feitas com o DDD de origem, aumentando a confiança e a taxa de atendimento dos clientes.</p>
    <h3>1.4 Campanhas de discagem automática</h3>
    <p class="muted">Automatize a realização de chamadas em massa, facilitando o trabalho do usuário na comunicação com os clientes.</p>
    <h3>1.5 ToDo das chamadas (next steps)</h3>
    <p class="muted">O sistema sugere automaticamente os próximos passos após cada atendimento, garantindo a continuidade das ações após cada ligação.</p>
  </div>
</section>

<!-- 2. DIFERENCIAIS -->
<section class="page">
  ${header()}
  <div class="body">
    <h2>2. Diferenciais</h2>
    <div class="dif-grid">${diferenciais}</div>
  </div>
</section>

<!-- 3/4. SLA -->
<section class="page">
  ${header()}
  <div class="body">
    <h2>3. Processo de abertura de chamados</h2>
    <p class="muted">A Callface disponibiliza uma estrutura de Service Desk 24 horas para atendimento às solicitações do escopo desta proposta.</p>
    <table class="tbl">
      <thead><tr><th>Forma de abertura</th><th>Caminho</th><th>Cobertura</th></tr></thead>
      <tbody>
        <tr><td>Plataforma Online</td><td>ticket.callface.com.br</td><td>24x7</td></tr>
        <tr><td>Telefone</td><td>11 5199-7000</td><td>24x7</td></tr>
      </tbody>
    </table>
    <h2 style="margin-top:18px">4. Métricas de atendimento</h2>
    <table class="tbl">
      <thead><tr><th>Criticidade</th><th>Descrição</th><th>SLA resposta</th><th>SLA atendimento</th><th>Horário</th></tr></thead>
      <tbody>
        <tr><td>Crítico</td><td>Paralisação completa do sistema com impacto severo.</td><td>Até 30 min</td><td>2 horas</td><td>24x7</td></tr>
        <tr><td>Alto</td><td>Sistema degradado, mas há alternativa aceitável.</td><td>Até 1 hora</td><td>4 horas</td><td>24x7</td></tr>
        <tr><td>Médio</td><td>Problema sem impacto severo, com alternativa disponível.</td><td>Até 6 horas</td><td>12 horas</td><td>8x5</td></tr>
        <tr><td>Baixo</td><td>Solicitação de informação ou sugestão de otimização.</td><td>Até 12 horas</td><td>24 horas</td><td>8x5</td></tr>
        <tr><td>Planejada</td><td>Atividade agendada.</td><td>Até 1 dia</td><td>4 dias</td><td>8x5</td></tr>
      </tbody>
    </table>
    <p class="muted" style="font-size:9px">8x5 = Segunda a Sexta das 09:00 às 18:00. O SLA entra em pausa caso o ticket aguarde informações da contratante e é fechado automaticamente após 48h sem retorno.</p>
  </div>
</section>

<!-- 5. PREMISSAS -->
<section class="page">
  ${header()}
  <div class="body">
    <h2>5. Premissas e considerações</h2>
    <h3>Ligações Callface AI e receptivo</h3>
    <p class="muted">As ligações são ilimitadas para todo o Brasil, assim como as ligações receptivas.</p>
    <h3>Gravações</h3>
    <p class="muted">As gravações são limitadas a espaço em disco, com 50GB dedicados em nosso cloud.</p>
    <h3>Setup</h3>
    <p class="muted">O valor de Setup contempla a entrega de projetos ou serviços diferenciados, cobrado após a entrega do serviço.</p>
    <h3>Considerações</h3>
    <p class="muted">Demais informações serão apresentadas pela área de projetos, alinhadas aos prazos de ativação. Os valores desta proposta não contemplam despesas com viagens, estadias, estacionamento, combustível e alimentação.</p>
    <div class="box"><b>Item de projeto:</b> para configuração ou homologação de aparelhos não fornecidos pela Callface, será cobrado valor adicional de <b>R$ 40,00 por aparelho</b> a ser configurado.</div>
  </div>
</section>

<!-- 6/7. MAPA DE INVESTIMENTO -->
<section class="page">
  ${header()}
  <div class="body">
    <h2>6. Mapa de investimento</h2>
    ${itensTabela(recorrentes, moeda, "Investimento mensal", totais.mensal)}
    ${anuais.length ? `<div style="margin-top:12px">${itensTabela(anuais, moeda, "Investimento anual", totais.anual)}</div>` : ""}
    ${setups.length ? `<h2 style="margin-top:16px">7. Setup e itens avulsos</h2>${itensTabela(setups, moeda, "Setup", totais.unico)}<p class="muted" style="margin-top:8px"><strong>Forma de pagamento do setup:</strong> ${esc(formaPagamentoSetup({ condicaoPagamentoTipo: p.condicaoPagamentoTipo ?? null, parcelas: p.parcelas ?? null, condicoesPagamento: p.condicoesPagamento ?? null }, totais.unico) || "a combinar")}</p>` : ""}
    <table class="mapa" style="margin-top:14px">
      <tbody>
        <tr class="mapa-total"><td class="rgt" style="font-size:12px">Total geral${recorrentes.length || anuais.length ? " (1ª cobrança)" : ""}</td><td class="rgt" style="font-size:12px">${money(p.totalGeral, moeda)}</td></tr>
      </tbody>
    </table>
    ${p.condicoesPagamento ? `<p class="muted" style="margin-top:12px"><strong>Condições de pagamento:</strong> ${esc(p.condicoesPagamento)}</p>` : ""}
    ${p.prazoContratoMeses ? `<p class="muted" style="margin-top:8px"><strong>Vigência contratual:</strong> ${p.prazoContratoMeses} meses, conforme contrato aplicável.</p>` : ""}
    ${p.checkoutUrl ? `<div style="margin-top:20px;text-align:center">
      <a href="${esc(p.checkoutUrl)}" style="display:inline-block;background:${CARMIM};color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 34px;border-radius:10px">Contratar e pagar agora</a>
      <p class="muted" style="margin-top:8px;font-size:10px">Link de pagamento seguro • clique para finalizar</p>
    </div>` : ""}
  </div>
</section>

<!-- 8. FORMALIZACAO -->
<section class="page">
  ${header()}
  <div class="body">
    <h2>8. Formalização e validade</h2>
    <p>A presente proposta somente produzirá efeito com a formalização de pagamento, contemplando de forma precisa as obrigações de cada uma das partes, os níveis de serviço e os limites de responsabilidade da <strong>CALLFACE</strong> e <strong>${esc(cliente)}</strong>.</p>
    <p>Serviço prestado no formato pré-pago, via cartão ou boleto.</p>
    <h3 style="color:${CARMIM}">Importante</h3>
    <p class="muted">É imprescindível a rubrica das páginas que correspondem ao resumo financeiro acordado — tal ação garante a veracidade e autenticidade das quantidades e valores firmados pelas partes envolvidas.</p>
    <div style="margin-top:40px; display:flex; gap:40px;">
      <div style="flex:1; border-top:1px solid #bbb; padding-top:6px; text-align:center; font-size:10px; color:#6b6b76;">Callface</div>
      <div style="flex:1; border-top:1px solid #bbb; padding-top:6px; text-align:center; font-size:10px; color:#6b6b76;">${esc(cliente)}</div>
    </div>
  </div>
</section>

</body></html>`;
}

let _warned = false;
export async function renderPropostaPdf(
  html: string,
  /** Aditivo: o contrato precisa de cabeçalho/rodapé repetidos e margens próprias. A proposta segue sem nada. */
  opcoes?: { displayHeaderFooter?: boolean; headerTemplate?: string; footerTemplate?: string; margin?: { top: string; bottom: string; left: string; right: string } },
): Promise<Buffer> {
  const execPath = resolveChromePath();
  if (!execPath && !_warned) {
    _warned = true;
    console.warn("[proposta-pdf] Chromium não encontrado nos caminhos padrão — usando bundled (pode falhar se ausente).");
  }
  const browser = await puppeteer.launch({
    ...(execPath ? { executablePath: execPath } : {}),
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 20000 });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
      ...opcoes,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
