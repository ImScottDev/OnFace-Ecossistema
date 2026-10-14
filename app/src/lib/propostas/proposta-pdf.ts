// Geração do PDF da Proposta Comercial (moldes Zoho) via HTML + Chrome headless.
// Renderiza no container `api` (Hono). Requer chromium (PUPPETEER_EXECUTABLE_PATH).
import { periodoDoItem, totaisPorPeriodo, type PeriodoDeCobranca } from "@/lib/crm/periodo-cobranca";
import { formaPagamentoSetup } from "@/lib/crm/condicoes-comerciais";
import puppeteer from "puppeteer";
import { existsSync } from "node:fs";
import { LOGO_WHITE, LOGO_COLOR } from "./pdf-assets";
import { conteudoDasFamilias, CONTEUDO_FAMILIA, type ConteudoFamilia } from "./conteudo-familia";
import type { ModeloPdf } from "./modelos-pdf";

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
  /** Modelo do PDF. Ausente ou "padrao" = o PDF de sempre, sem nenhuma mudança. */
  modelo?: ModeloPdf | null;
  /** Famílias dos itens (CALLFACE_AI | PABX | WHITE_LABEL): escolhem o conteúdo dos modelos novos. */
  familias?: string[] | null;
  trialDias?: number | null;
  reajusteIndice?: string | null;
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
  // `2026-10-13` (coluna date) sem hora vira meia-noite UTC e, em fuso a oeste, o dia anterior: ancora ao meio-dia.
  const d = new Date(typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T12:00:00` : (v as string));
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}
function recorrenciaLabel(tipo: string, periodo?: string | null): string {
  if (tipo === "recorrente") return periodo === "anual" ? "Anual" : periodo === "trimestral" ? "Trimestral" : periodo === "semestral" ? "Semestral" : "Mensal";
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
  if (p.modelo === "enxuto") return modeloEnxuto(p);
  if (p.modelo === "completo") return modeloCompleto(p);
  if (p.modelo === "white_label") return modeloWhiteLabel(p);
  return modeloPadrao(p);
}

/** O PDF de sempre (moldes Zoho). Intocado: é o que toda proposta existente continua usando. */
function modeloPadrao(p: PropostaPdfData): string {
  const moeda = p.moeda || "BRL";
  const cliente = p.leadEmpresa || p.leadNome || "Cliente";
  const numeroFmt = `PROP ${String(p.numero).padStart(4, "0")}${p.versao > 1 ? ` · v${p.versao}` : ""}`;
  // Cada linha no período de cobrança do Price: a anuidade não entra na tabela (nem no total) "mensal".
  const doPeriodo = (per: PeriodoDeCobranca) => p.itens.filter((i) => periodoDoItem(i).periodo === per);
  const recorrentes = doPeriodo("mensal");
  const trimestrais = doPeriodo("trimestral");
  const semestrais = doPeriodo("semestral");
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
    ${trimestrais.length ? `<div style="margin-top:12px">${itensTabela(trimestrais, moeda, "Investimento trimestral", totais.trimestral)}</div>` : ""}
    ${semestrais.length ? `<div style="margin-top:12px">${itensTabela(semestrais, moeda, "Investimento semestral", totais.semestral)}</div>` : ""}
    ${anuais.length ? `<div style="margin-top:12px">${itensTabela(anuais, moeda, "Investimento anual", totais.anual)}</div>` : ""}
    ${setups.length ? `<h2 style="margin-top:16px">7. Setup e itens avulsos</h2>${itensTabela(setups, moeda, "Setup", totais.unico)}<p class="muted" style="margin-top:8px"><strong>Forma de pagamento do setup:</strong> ${esc(formaPagamentoSetup({ condicaoPagamentoTipo: p.condicaoPagamentoTipo ?? null, parcelas: p.parcelas ?? null, condicoesPagamento: p.condicoesPagamento ?? null }, totais.unico) || "a combinar")}</p>` : ""}
    <table class="mapa" style="margin-top:14px">
      <tbody>
        <tr class="mapa-total"><td class="rgt" style="font-size:12px">Total geral${recorrentes.length || trimestrais.length || semestrais.length || anuais.length ? " (1ª cobrança)" : ""}</td><td class="rgt" style="font-size:12px">${money(p.totalGeral, moeda)}</td></tr>
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

// ═══════════════════════════════════════════════════════════════════════════
// Modelos novos (enxuto, completo, white_label). Mesmo motor do padrão: HTML + Chrome headless.
// Compartilham CSS, tabela de investimento (`itensTabela`) e bloco de condições, para os três
// parecerem a mesma marca. O PDF não enxerga os tokens do app, então as cores nascem aqui, num
// só lugar, espelhando `onface-proto.css` (neutros) e a marca do PDF de sempre (carmim e roxo).
// ═══════════════════════════════════════════════════════════════════════════
const NEUTROS_PDF = { tinta: "#12171d", tinta2: "#4a5560", tinta3: "#67787c", linha: "#e3e7e8", fio: "#eef1f1", fundo: "#fafafa", marcaFundo: "#fdeef0" };

function cssPremium(): string {
  return `
  :root { --marca:${CARMIM}; --acento:${ROXO}; --tinta:${NEUTROS_PDF.tinta}; --tinta-2:${NEUTROS_PDF.tinta2}; --tinta-3:${NEUTROS_PDF.tinta3};
          --linha:${NEUTROS_PDF.linha}; --fio:${NEUTROS_PDF.fio}; --fundo:${NEUTROS_PDF.fundo}; --marca-fundo:${NEUTROS_PDF.marcaFundo}; --papel:#fff; }
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body { font-family:-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; color:var(--tinta); font-size:11px; line-height:1.55; background:var(--papel); }
  .pg { width:210mm; min-height:297mm; position:relative; page-break-after:always; }
  .pg:last-child { page-break-after:auto; }
  .corpo { padding:14mm 18mm 16mm; }
  .topo { display:flex; justify-content:space-between; align-items:center; padding:9mm 18mm 5mm; border-bottom:3px solid var(--marca); }
  .topo img { height:30px; }
  .topo .quem { text-align:right; font-size:9px; color:var(--tinta-3); line-height:1.6; }
  .topo .quem b { color:var(--tinta); font-size:10px; }
  .rodape { position:absolute; left:18mm; right:18mm; bottom:9mm; display:flex; justify-content:space-between; font-size:8.5px; color:var(--tinta-3); border-top:1px solid var(--linha); padding-top:6px; }
  .over { font-size:9px; font-weight:800; letter-spacing:.16em; text-transform:uppercase; color:var(--marca); }
  h1 { font-size:26px; line-height:1.1; font-weight:800; letter-spacing:-.4px; margin:6px 0 8px; }
  h2 { font-size:15px; font-weight:800; margin:0 0 10px; letter-spacing:-.1px; }
  h2 .n { color:var(--marca); margin-right:8px; font-variant-numeric:tabular-nums; }
  h3 { font-size:11.5px; font-weight:700; margin:12px 0 4px; }
  p { margin:0 0 8px; }
  .lead { font-size:13px; color:var(--tinta-2); max-width:150mm; }
  .muted { color:var(--tinta-3); }
  .sec { margin-top:16px; }
  .meta { display:flex; flex-wrap:wrap; gap:0; margin:14px 0 4px; border:1px solid var(--linha); border-radius:8px; overflow:hidden; }
  .meta > div { flex:1 1 0; min-width:30mm; padding:8px 12px; border-right:1px solid var(--linha); }
  .meta > div:last-child { border-right:0; }
  .meta small { display:block; font-size:8px; letter-spacing:.1em; text-transform:uppercase; color:var(--tinta-3); font-weight:700; }
  .meta b { font-size:11px; }
  table { width:100%; border-collapse:collapse; }
  th { text-align:left; }
  .ctr { text-align:center; } .rgt { text-align:right; }
  .mapa { margin:8px 0 12px; font-size:10.5px; border:1px solid var(--linha); border-radius:8px; overflow:hidden; }
  .mapa-title th { background:var(--tinta); color:#fff; font-weight:700; padding:8px 10px; font-size:10px; letter-spacing:.08em; text-transform:uppercase; text-align:left; }
  .mapa-head th { background:var(--fundo); color:var(--tinta-2); border-bottom:1px solid var(--linha); padding:6px 10px; font-weight:700; font-size:9.5px; }
  .mapa td { padding:9px 10px; border-bottom:1px solid var(--fio); vertical-align:top; }
  .it-nome strong { color:var(--tinta); font-size:11px; }
  .it-desc { color:var(--tinta-3); font-size:9px; }
  .mapa-total td { border-top:1px solid var(--linha); border-bottom:none; background:var(--fundo); font-weight:800; padding:9px 10px; }
  .total { display:flex; justify-content:space-between; align-items:center; background:var(--tinta); color:#fff; border-radius:10px; padding:14px 18px; margin:6px 0 4px; }
  .total small { display:block; font-size:8.5px; letter-spacing:.12em; text-transform:uppercase; color:${NEUTROS_PDF.linha}; font-weight:700; }
  .total b { font-size:22px; letter-spacing:-.4px; font-weight:800; }
  .conds { display:grid; grid-template-columns:repeat(auto-fit, minmax(42mm, 1fr)); gap:8px; margin-top:10px; }
  .cond { border:1px solid var(--linha); border-radius:8px; padding:8px 12px; background:var(--papel); }
  .cond small { display:block; font-size:8px; letter-spacing:.1em; text-transform:uppercase; color:var(--tinta-3); font-weight:700; }
  .cond b { font-size:11px; }
  .cta { margin-top:16px; text-align:center; }
  .cta a { display:inline-block; background:var(--marca); color:#fff; text-decoration:none; font-weight:700; font-size:13px; padding:13px 32px; border-radius:10px; }
  .cta p { margin:8px 0 0; font-size:9.5px; color:var(--tinta-3); }
  .grade { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:8px; }
  .dif { border:1px solid var(--linha); border-left:3px solid var(--marca); border-radius:6px; padding:9px 12px; }
  .dif b { display:block; font-size:10.5px; margin-bottom:2px; }
  .dif span { font-size:9.5px; color:var(--tinta-2); line-height:1.5; }
  .checks { list-style:none; margin:6px 0 0; }
  .checks li { position:relative; padding:5px 0 5px 22px; border-bottom:1px solid var(--fio); font-size:10.5px; }
  .checks li::before { content:""; position:absolute; left:2px; top:9px; width:8px; height:8px; border-radius:2px; background:var(--marca); }
  .passos { display:grid; grid-template-columns:repeat(4, 1fr); gap:8px; margin-top:8px; }
  .passo { border:1px solid var(--linha); border-radius:8px; padding:10px; }
  .passo i { display:block; font-style:normal; font-weight:800; font-size:16px; color:var(--marca); margin-bottom:2px; }
  .passo b { display:block; font-size:10.5px; margin-bottom:2px; }
  .passo span { font-size:9px; color:var(--tinta-2); line-height:1.45; }
  .tbl { margin:8px 0 12px; font-size:10px; border:1px solid var(--linha); border-radius:8px; overflow:hidden; }
  .tbl th { background:var(--fundo); color:var(--tinta-2); text-align:left; padding:7px 10px; font-weight:700; border-bottom:1px solid var(--linha); }
  .tbl td { padding:7px 10px; border-bottom:1px solid var(--fio); vertical-align:top; }
  .assin { margin-top:34px; display:flex; gap:40px; }
  .assin div { flex:1; border-top:1px solid ${NEUTROS_PDF.tinta3}; padding-top:6px; text-align:center; font-size:10px; color:var(--tinta-3); }
  /* capa */
  .capa-topo { background:var(--marca); color:#fff; height:128mm; border-radius:0 0 50% 50% / 0 0 18% 18%; padding:22mm 22mm 0; position:relative; }
  .capa-topo img { height:46px; }
  .capa-topo .t { margin-top:26mm; font-size:42px; line-height:1.02; font-weight:800; letter-spacing:-.8px; }
  .capa-topo .s { margin-top:10px; font-size:14px; opacity:.92; max-width:130mm; }
  .capa-arco { position:absolute; left:50%; bottom:-1px; transform:translateX(-50%); }
  .capa-meta { padding:16mm 22mm 0; }
  .capa-meta .r { margin:0 0 8px; font-size:13px; }
  .capa-meta .r b { color:var(--marca); font-weight:800; margin-right:6px; }
  .capa-valid { text-align:center; color:var(--tinta-3); font-size:10.5px; margin-top:20mm; }
  `;
}

/** Cada período num bloco próprio (a anuidade nunca entra na mensalidade), mais setup, total e condições. */
function blocoInvestimento(p: PropostaPdfData, opts: { tituloSetup?: string } = {}): string {
  const moeda = p.moeda || "BRL";
  const doPeriodo = (per: PeriodoDeCobranca) => p.itens.filter((i) => periodoDoItem(i).periodo === per);
  const mensais = doPeriodo("mensal");
  const trimestrais = doPeriodo("trimestral");
  const semestrais = doPeriodo("semestral");
  const anuais = doPeriodo("anual");
  const setups = doPeriodo("unico");
  const totais = totaisPorPeriodo(p.itens);
  const cobraRecorrente = mensais.length || trimestrais.length || semestrais.length || anuais.length;
  const setupTxt = setups.length
    ? formaPagamentoSetup({ condicaoPagamentoTipo: p.condicaoPagamentoTipo ?? null, parcelas: p.parcelas ?? null, condicoesPagamento: p.condicoesPagamento ?? null }, totais.unico) || "a combinar"
    : null;
  return `
    ${itensTabela(mensais, moeda, "Investimento mensal", totais.mensal)}
    ${itensTabela(trimestrais, moeda, "Investimento trimestral", totais.trimestral)}
    ${itensTabela(semestrais, moeda, "Investimento semestral", totais.semestral)}
    ${itensTabela(anuais, moeda, "Investimento anual", totais.anual)}
    ${itensTabela(setups, moeda, opts.tituloSetup || "Setup e itens avulsos", totais.unico)}
    ${setupTxt ? `<p class="muted"><b>Forma de pagamento do setup:</b> ${esc(setupTxt)}</p>` : ""}
    <div class="total"><div><small>Total geral${cobraRecorrente ? " · 1ª cobrança" : ""}</small></div><b>${money(p.totalGeral, moeda)}</b></div>`;
}

/** Condições comerciais em cartões: só o que a proposta de fato tem. */
function blocoCondicoes(p: PropostaPdfData): string {
  const linhas: Array<[string, string]> = [];
  if (p.condicoesPagamento) linhas.push(["Pagamento", p.condicoesPagamento]);
  if (p.prazoContratoMeses) linhas.push(["Vigência", `${p.prazoContratoMeses} meses`]);
  if (p.trialDias) linhas.push(["Período de teste", `${p.trialDias} dias`]);
  if (p.reajusteIndice && p.reajusteIndice !== "nenhum") linhas.push(["Reajuste", p.reajusteIndice]);
  linhas.push(["Validade da proposta", p.dataValidade ? dataBR(p.dataValidade) : "10 dias após o recebimento"]);
  return `<div class="conds">${linhas.map(([k, v]) => `<div class="cond"><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join("")}</div>`;
}

function blocoCta(p: PropostaPdfData): string {
  return p.checkoutUrl
    ? `<div class="cta"><a href="${esc(p.checkoutUrl)}">Contratar e pagar agora</a><p>Link de pagamento seguro · clique para finalizar</p></div>`
    : "";
}

function numeroProposta(p: PropostaPdfData): string {
  return `PROP ${String(p.numero).padStart(4, "0")}${p.versao > 1 ? ` · v${p.versao}` : ""}`;
}

function topoPremium(p: PropostaPdfData): string {
  return `<div class="topo"><img src="${LOGO_COLOR}" alt="callface"/>
    <div class="quem"><b>${esc(numeroProposta(p))}</b><br/>${p.criadoPorNome ? `${esc(p.criadoPorNome)}${p.criadoPorEmail ? ` · ${esc(p.criadoPorEmail)}` : ""}` : "+55 (11) 5199-7000"}</div></div>`;
}

function rodapePremium(p: PropostaPdfData, pagina: string): string {
  return `<div class="rodape"><span>Callface · ${esc(numeroProposta(p))} · ${esc(p.leadEmpresa || p.leadNome || "Cliente")}</span><span>${pagina}</span></div>`;
}

function blocoMeta(p: PropostaPdfData): string {
  const itens: Array<[string, string]> = [
    ["Emissão", dataBR(p.dataEmissao || new Date())],
    ["Válida até", p.dataValidade ? dataBR(p.dataValidade) : "10 dias após o recebimento"],
  ];
  if (p.prazoContratoMeses) itens.push(["Vigência", `${p.prazoContratoMeses} meses`]);
  return `<div class="meta">${itens.map(([k, v]) => `<div><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join("")}</div>`;
}

function blocoDiferenciais(c: ConteudoFamilia): string {
  return `<div class="grade">${c.diferenciais.map((d) => `<div class="dif"><b>${esc(d.titulo)}</b><span>${esc(d.texto)}</span></div>`).join("")}</div>`;
}

function blocoEntregas(c: ConteudoFamilia): string {
  return `<ul class="checks">${c.entregas.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>`;
}

function blocoPassos(passos: Array<[string, string]>): string {
  return `<div class="passos">${passos.map(([t, d], i) => `<div class="passo"><i>${String(i + 1).padStart(2, "0")}</i><b>${esc(t)}</b><span>${esc(d)}</span></div>`).join("")}</div>`;
}

function blocoSla(): string {
  return `<table class="tbl">
      <thead><tr><th>Criticidade</th><th>Descrição</th><th>SLA resposta</th><th>SLA atendimento</th><th>Horário</th></tr></thead>
      <tbody>
        <tr><td>Crítico</td><td>Paralisação completa do sistema com impacto severo.</td><td>Até 30 min</td><td>2 horas</td><td>24x7</td></tr>
        <tr><td>Alto</td><td>Sistema degradado, mas há alternativa aceitável.</td><td>Até 1 hora</td><td>4 horas</td><td>24x7</td></tr>
        <tr><td>Médio</td><td>Problema sem impacto severo, com alternativa disponível.</td><td>Até 6 horas</td><td>12 horas</td><td>8x5</td></tr>
        <tr><td>Baixo</td><td>Solicitação de informação ou sugestão de otimização.</td><td>Até 12 horas</td><td>24 horas</td><td>8x5</td></tr>
      </tbody>
    </table>
    <p class="muted" style="font-size:9px">8x5 = segunda a sexta, das 09:00 às 18:00. Abertura de chamados: ticket.callface.com.br ou 11 5199-7000, 24x7.</p>`;
}

function capaPremium(p: PropostaPdfData, titulo: string, subtitulo: string): string {
  const cliente = p.leadEmpresa || p.leadNome || "Cliente";
  return `<section class="pg">
  <div class="capa-topo">
    <img src="${LOGO_WHITE}" alt="callface"/>
    <div class="t">${titulo}</div>
    <div class="s">${esc(subtitulo)}</div>
    <svg class="capa-arco" width="220" height="120" viewBox="0 0 220 120"><path d="M12 8 A100 100 0 0 0 208 8" fill="none" stroke="${ROXO}" stroke-width="14" stroke-linecap="round"/><circle cx="208" cy="14" r="12" fill="${ROXO}"/></svg>
  </div>
  <div class="capa-meta">
    <div class="r"><b>Proposta</b>${esc(numeroProposta(p))}</div>
    <div class="r"><b>Cliente</b>${esc(cliente)}</div>
    <div class="r"><b>Data</b>${dataBR(p.dataEmissao || new Date())}</div>
    <div class="r"><b>Responsável</b>${esc(p.criadoPorNome || "—")}${p.criadoPorEmail ? ` · ${esc(p.criadoPorEmail)}` : ""}</div>
    <div class="capa-valid">Os dados desta proposta são válidos até ${p.dataValidade ? dataBR(p.dataValidade) : "10 dias após o recebimento"}</div>
  </div>
</section>`;
}

const docPremium = (corpo: string) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><style>${cssPremium()}</style></head><body>${corpo}</body></html>`;

const PASSOS_PADRAO: Array<[string, string]> = [
  ["Aceite", "Você confirma a proposta pelo link e a decisão fica registrada."],
  ["Contrato", "Enviamos o contrato para assinatura eletrônica."],
  ["Pagamento", "Link de pagamento seguro, por cartão ou boleto."],
  ["Ativação", "O time de projetos agenda e acompanha a ativação."],
];

/** Uma página só: o que é, quanto custa e como fechar. Se a lista de itens for longa, continua na página seguinte em vez de cortar. */
function modeloEnxuto(p: PropostaPdfData): string {
  const cliente = p.leadEmpresa || p.leadNome || "Cliente";
  const c = conteudoDasFamilias(p.familias);
  return docPremium(`<section class="pg">
  ${topoPremium(p)}
  <div class="corpo">
    <div class="over">Proposta comercial · ${esc(c.rotulo)}</div>
    <h1>Proposta para ${esc(cliente)}</h1>
    <p class="lead">${esc(c.promessa)}</p>
    ${blocoMeta(p)}
    <div class="sec">${blocoInvestimento(p)}</div>
    ${blocoCondicoes(p)}
    ${blocoCta(p)}
    <p class="muted" style="margin-top:14px;font-size:9.5px">A proposta produz efeito com a formalização do pagamento, nos termos do contrato aplicável. ${c.garantias[0] ? esc(c.garantias[0]) + "." : ""}</p>
  </div>
  ${rodapePremium(p, "Callface")}
</section>`);
}

/** Proposta completa: capa, apresentação, escopo e entregas, investimento, suporte e formalização. */
function modeloCompleto(p: PropostaPdfData): string {
  const cliente = p.leadEmpresa || p.leadNome || "Cliente";
  const c = conteudoDasFamilias(p.familias);
  return docPremium(`
${capaPremium(p, "Proposta<br/>Comercial", c.rotulo)}

<section class="pg">
  ${topoPremium(p)}
  <div class="corpo">
    <div class="over">Apresentação</div>
    <h1>${esc(c.rotulo)} para ${esc(cliente)}</h1>
    <p class="lead">${esc(c.promessa)}</p>
    <h2 class="sec"><span class="n">01</span>Por que a Callface</h2>
    ${blocoDiferenciais(c)}
    <h2 class="sec"><span class="n">02</span>Escopo e entregas</h2>
    ${blocoEntregas(c)}
    <p class="muted" style="margin-top:10px;font-size:9.5px">Os itens e quantidades contratados estão no mapa de investimento. Atividades fora do escopo contratado são tratadas como consultoria, não inclusas no valor desta proposta.</p>
  </div>
  ${rodapePremium(p, "2")}
</section>

<section class="pg">
  ${topoPremium(p)}
  <div class="corpo">
    <h2><span class="n">03</span>Mapa de investimento</h2>
    ${blocoInvestimento(p)}
    <h2 class="sec"><span class="n">04</span>Condições comerciais</h2>
    ${blocoCondicoes(p)}
    ${blocoCta(p)}
  </div>
  ${rodapePremium(p, "3")}
</section>

<section class="pg">
  ${topoPremium(p)}
  <div class="corpo">
    <h2><span class="n">05</span>Suporte e níveis de serviço</h2>
    <p class="muted">A Callface mantém Service Desk 24 horas para as solicitações do escopo desta proposta.</p>
    ${blocoSla()}
    <h2 class="sec"><span class="n">06</span>Como fechamos</h2>
    ${blocoPassos(PASSOS_PADRAO)}
    <h2 class="sec"><span class="n">07</span>Formalização e validade</h2>
    <p>A presente proposta somente produzirá efeito com a formalização de pagamento, contemplando as obrigações de cada parte, os níveis de serviço e os limites de responsabilidade da <b>CALLFACE</b> e de <b>${esc(cliente)}</b>. Serviço prestado no formato pré-pago, via cartão ou boleto.</p>
    <p class="muted">É imprescindível a rubrica das páginas que correspondem ao resumo financeiro acordado: isso garante a veracidade das quantidades e valores firmados.</p>
    <div class="assin"><div>Callface</div><div>${esc(cliente)}</div></div>
  </div>
  ${rodapePremium(p, "4")}
</section>`);
}

/** Parceria de White Label: o parceiro compra licença e revende; a estrutura da página é a do completo, o conteúdo é o do parceiro. */
function modeloWhiteLabel(p: PropostaPdfData): string {
  const cliente = p.leadEmpresa || p.leadNome || "Parceiro";
  const c = CONTEUDO_FAMILIA.WHITE_LABEL;
  const passos: Array<[string, string]> = [
    ["Aceite", "Você confirma a proposta de parceria pelo link."],
    ["Contrato", "Assinatura eletrônica do contrato de parceria."],
    ["Implantação", "Domínio, identidade e configuração inicial, com a Callface junto."],
    ["Operação", "Licenças ativas, faturamento no ciclo combinado e suporte ao parceiro."],
  ];
  return docPremium(`
${capaPremium(p, "Proposta de<br/>Parceria", "White Label · a plataforma Callface com a sua marca")}

<section class="pg">
  ${topoPremium(p)}
  <div class="corpo">
    <div class="over">A parceria</div>
    <h1>${esc(cliente)} + Callface</h1>
    <p class="lead">${esc(c.promessa)}</p>
    <h2 class="sec"><span class="n">01</span>O que o parceiro recebe</h2>
    ${blocoDiferenciais(c)}
    <h2 class="sec"><span class="n">02</span>Entregas</h2>
    ${blocoEntregas(c)}
    <h2 class="sec"><span class="n">03</span>Como a parceria funciona</h2>
    <p>O parceiro opera a plataforma com a própria marca e reserva licenças por usuário. A Callface mantém a tecnologia e fatura as licenças no ciclo definido em contrato; valores, dia de faturamento e prazo de pagamento constam nesta proposta e no contrato de parceria.</p>
  </div>
  ${rodapePremium(p, "2")}
</section>

<section class="pg">
  ${topoPremium(p)}
  <div class="corpo">
    <h2><span class="n">04</span>Investimento da parceria</h2>
    ${blocoInvestimento(p, { tituloSetup: "Implantação e itens únicos" })}
    <h2 class="sec"><span class="n">05</span>Condições da parceria</h2>
    ${blocoCondicoes(p)}
    ${blocoCta(p)}
  </div>
  ${rodapePremium(p, "3")}
</section>

<section class="pg">
  ${topoPremium(p)}
  <div class="corpo">
    <h2><span class="n">06</span>Próximos passos</h2>
    ${blocoPassos(passos)}
    <h2 class="sec"><span class="n">07</span>Suporte ao parceiro</h2>
    <p class="muted">Service Desk 24 horas: ticket.callface.com.br ou 11 5199-7000.</p>
    ${blocoSla()}
    <h2 class="sec"><span class="n">08</span>Formalização e validade</h2>
    <p>A parceria somente produzirá efeito com a assinatura do contrato e a formalização do pagamento, contemplando as obrigações de cada parte e os limites de responsabilidade da <b>CALLFACE</b> e de <b>${esc(cliente)}</b>.</p>
    <div class="assin"><div>Callface</div><div>${esc(cliente)}</div></div>
  </div>
  ${rodapePremium(p, "4")}
</section>`);
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
