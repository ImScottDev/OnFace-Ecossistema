"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Customer Success (Command Center) — o adaptador.
 *
 * `CsDesenho` é o markup convertido do handoff e `CsLiga` a lógica dele,
 * portada. Os dois são GERADOS e não se editam. Este arquivo troca o mock pelo
 * dado real de `lib/cs/tela-cs.ts` e liga as ações nos endpoints de /api/cs.
 *
 * ── Onde o Liga inventa, e como cada invenção foi neutralizada ────────────
 *
 * Tudo o que mente mora em funções LOCAIS de `renderVals()` (renovDe,
 * sinaisDe, oriDe, diasSem, EU) — não dá para sobrescrever por subclasse.
 * Então o conserto entra por dois lados:
 *
 * 1. PELO DADO, na chave que o gerador lê:
 *    - `saude` só alimenta os gatilhos inventados de sinaisDe (fatura < 45,
 *      "uso baixo" 45–59, "pediu mais N usuários" >= 80). Vai 70 para todos —
 *      faixa neutra, nenhum dispara — e 0 só para quem tem fatura REALMENTE
 *      vencida, que é o único desses três sinais com fato no banco.
 *    - `ultima` vai no formato "Há N dias" contado do timestamp real. Conta
 *      sem interação nenhuma conta desde a entrada na carteira (o parser do
 *      desenho leria "" como "contato hoje").
 *    - leads com origem para TODA conta ("Outros" quando vazia), senão oriDe
 *      sorteia a origem pelo hash do nome.
 *    - sinal de renovação marcado como "tratado" em `cs.resolvidos` para toda
 *      conta: a data vem de hash do nome e não existe renovação no banco
 *      (cs_renovacoes = 0, assinaturas.current_period_end 100% nulo).
 *
 * 2. NA SAÍDA de renderVals (padrão corrigirInventados de PessoaProto): o que
 *    a renovação inventada alimenta sem passar por sinal (aba, KPI, kanban,
 *    coluna da carteira, texto do NEXO), os textos da fatura (dias e valor
 *    vêm de hash/MRR), a distribuição por produto, o histórico de 12 meses e
 *    a equipe fixa ("Ricardo Alves", "Juliana Prado").
 *
 * Quando o handoff parar de inventar, estas correções ficam inertes sozinhas.
 * ───────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { useOrdemDaEquipe } from "./equipe-do-proto";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { DadosTelaCs, ClienteDaTela } from "@/lib/cs/tela-cs";
import { CAMADAS_FATURAMENTO, passoDoEixo } from "@/lib/clientes/evolucao-geometria";
import type { FaturamentoMes } from "@/lib/financeiro/faturamento-natureza";
import { CsLiga } from "./CsLiga";
import { abrirNexo } from "@/lib/nexo/cliente";
import { rotaDoDesenho } from "./rota-do-desenho";
import { usePecas } from "./pecas-host";

/** Mesmo literal de tela-cs.ts. Não importado: aquele módulo puxa o banco. */
const INICIO_SEM_EVIDENCIA = "0000-01";
/** O usuário fixo do Liga. `minha()` compara com ele; ver pendências. */
const EU_DO_LIGA = "Scott Ferraz";
const FAM_K = ["CALLFACE_AI", "PABX", "WHITE_LABEL", "ASSISTANT"] as const;
const FAM: Record<string, string> = { CALLFACE_AI: "Callface AI", PABX: "PABX", WHITE_LABEL: "White Label", ASSISTANT: "Callface Assistant" };
const CORF: Record<string, string> = { CALLFACE_AI: "var(--of-coral-marca)", PABX: "var(--of-coral-no-escuro-2)", WHITE_LABEL: "var(--of-coral-no-escuro-3)", ASSISTANT: "var(--of-coral-no-escuro-3)" };
const MESL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

// As mesmas contas do Liga — precisam bater caractere a caractere para achar o texto inventado.
const hsh = (s: string) => { let x = 7; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) >>> 0; return x; };
const brl = (n: number) => "R$ " + Math.round(n).toLocaleString("pt-BR");
const brlK = (n: number) => n >= 10000 ? "R$ " + (n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mil" : brl(n);
const pad = (n: number) => String(n).padStart(2, "0");
const ym = (d: Date) => d.getFullYear() + "-" + pad(d.getMonth() + 1);
const ativoEm = (c: ClienteDaTela, m: Date) => c.inicio <= ym(m) && (!c.fim || c.fim > ym(m));

/* ── Domínio → desenho ─────────────────────────────────────────────────── */

function tipoDaTarefa(t: string): string {
  if (/reuni/.test(t)) return "Reunião";
  if (/lig/.test(t)) return "Ligação";
  if (/follow/.test(t)) return "Follow up";
  if (/mail/.test(t)) return "E-mail";
  if (/whats|mensag/.test(t)) return "Mensagem";
  return "Tarefa";
}
const SITUACAO: Record<string, string> = { concluida: "Feita", declinada: "Declinada", em_andamento: "Em andamento", aguardando: "Aguardando" };
const PRIORIDADE: Record<string, string> = { alta: "Alta", urgente: "Alta", baixa: "Baixa" };
const TIPO_EVENTO: Record<string, string> = { ligacao: "Ligação", ligacao_legado: "Ligação", nota: "Nota", reuniao: "Reunião", reuniao_legado: "Reunião", whatsapp: "WhatsApp", email: "E-mail", email_legado: "E-mail", proposta_enviada: "Proposta enviada", cadencia: "Cadência", tarefa: "Tarefa", tarefa_legado: "Tarefa", diagnostico: "Diagnóstico", follow_up: "Follow up" };

/* ── Correções na saída de renderVals ──────────────────────────────────── */

/** Troca o texto de fatura inventado (dias por hash, valor = MRR) pelo real. */
function fatura(s: string, c: ClienteDaTela): string {
  if (!c.inad || typeof s !== "string") return s;
  const tagFalsa = "Fatura vencida há " + (3 + hsh(c.nome) % 12) + " dias";
  const descFalsa = "Fatura de " + brl(c.mrr) + " sem pagamento no Stripe.";
  const desc = (c.inad.n > 1 ? c.inad.n + " faturas em aberto somando " : "Fatura de ") + brl(c.inad.valor) + " vencida e sem pagamento.";
  return s.split(tagFalsa).join("Fatura vencida há " + c.inad.dias + " dias").split(descFalsa).join(desc);
}

/** Conta sem interação nenhuma: "há 2310 dias" contaria desde a entrada, e
    leria como se tivesse havido um contato lá atrás. */
function contato(s: string, c: ClienteDaTela): string {
  return c.nunca && typeof s === "string" ? s.replace(/Sem contato há \d+ dias/, "Nenhum contato registrado") : s;
}

/** Texto de uma resposta do NEXO, sem a renovação e a fatura inventadas. */
function textoDoNexo(t: string, porNome: Map<string, ClienteDaTela>): string {
  if (/^\d+ renovaç(ão|ões) nos próximos 90 dias/.test(t)) return "Nenhum cliente tem data de renovação cadastrada.";
  let out = t
    .replace(/Renova em -?\d+ dias \([^)]*\)\. /, "Sem data de renovação cadastrada. ")
    .replace("\n3. Preparar a renovação", "\n3. Mapear necessidade de expansão")
    .replace(/, \d+ renovações em 90 dias/, "")
    .replace("cliente desde 01/0000", "início sem evidência no banco");
  // briefC: a primeira linha começa pelo nome; listas: "• Nome · tag · R$".
  out = out.split("\n").map((linha) => {
    const nome = linha.startsWith("• ") ? linha.slice(2).split(" · ")[0] : null;
    const c = nome ? porNome.get(nome) : undefined;
    return c ? contato(fatura(linha, c), c) : linha;
  }).join("\n");
  const c = porNome.get(out.split(" · ")[0]);
  if (c) {
    out = fatura(out, c);
    if (c.nunca) out = out.replace(/Último contato: há \d+ dias\./, "Último contato: nunca registrado.");
  }
  return out;
}

function corrigir(vals: any, S: any, p: { clientes: ClienteDaTela[]; equipe: string[]; eu: string; leads: DadosTelaCs["leads"]; faturamento?: FaturamentoMes[]; risco?: DadosTelaCs["risco"] }) {
  const porNome = new Map(p.clientes.map((c) => [c.nome, c] as const));
  const hoje = new Date();
  // As mesmas bases do Liga: `cart` = ativos no escopo, `base` = escopo com inativos.
  const noEscopo = (c: ClienteDaTela) => S.esc === "todos" || c.resp === EU_DO_LIGA;
  const base = p.clientes.filter(noEscopo);
  const cart = base.filter((c) => !c.fim);

  /* Renovação: não existe data no banco. Aba sem contagem, KPI "—" e kanban
     vazio (o próprio desenho tem o estado de coluna vazia). "Em negociação" e
     "Renovados" ficam 0 porque isso SIM é fato: não há oportunidade RENEWAL. */
  vals.abas = vals.abas.map((a: any) => a.l === "Renovações" ? { ...a, n: "", temN: false } : a);
  vals.kp5[2] = { ...vals.kp5[2], v: "—", dt: "—", s: "sem data de renovação cadastrada" };
  vals.ren = {
    ...vals.ren,
    kpis: vals.ren.kpis.map((k: any, i: number) => ({ ...k, v: i === 1 || i === 3 ? "0" : "—", s: i === 0 ? "sem data de renovação cadastrada" : k.s, vStyle: k.vStyle.replace("var(--of-coral-acao-hover)", "var(--of-tinta-forte)") })),
    colunas: vals.ren.colunas.map((c: any) => ({ ...c, cards: [], vazia: true, tot: "—" })),
  };

  /* RISCO: uma fonte só. O desenho contava "em risco" por silêncio (>= 30 dias sem contato,
     e 216 contas nunca tiveram contato registrado): 211 contas e R$ 381 mil, contra 18 contas
     críticas ou em risco em /clientes/risco (cs_riscos). Os KPIs de risco leem o mesmo
     cs_riscos; o resto do desenho (fila "Precisa da sua atenção") continua sendo sinal de atenção. */
  if (p.risco) {
    const R = p.risco;
    vals.kp5[3] = { ...vals.kp5[3], v: String(R.criticoEmRisco), dt: brlK(R.mrrCriticoEmRisco), s: "de MRR em risco crítico ou em risco · " + R.atencao + " em atenção" };
    vals.kpis = (vals.kpis ?? []).map((k: any) => k.l === "MRR em risco" ? { ...k, v: brlK(R.mrrCriticoEmRisco), s: R.criticoEmRisco + (R.criticoEmRisco === 1 ? " conta crítica ou em risco" : " contas críticas ou em risco") } : k);
    if (typeof vals.nexo?.txt === "string") {
      vals.nexo.txt = vals.nexo.txt.replace(/R\$ [\d.,]+ (mil )?de MRR possui algum risco aberto\./, R.criticoEmRisco ? brlK(R.mrrCriticoEmRisco) + " de MRR em " + R.criticoEmRisco + " contas críticas ou em risco." : "Nenhuma conta crítica ou em risco.");
    }
  }

  vals.car.views = vals.car.views.map((v: any) => v.l === "Renovação próxima" ? { ...v, n: "—" } : v);
  if (S.carV === "renov") vals.car = { ...vals.car, linhas: [], vazio: true, sub: "0 clientes · R$ 0 de MRR" };
  vals.car.linhas = vals.car.linhas.map((l: any) => {
    const c = porNome.get(l.nome);
    const out = { ...l, ren: "—", renSt: "white-space:nowrap;font-size:12px;color:var(--of-linha-forte)" };
    if (c?.nunca) out.ult = "Nunca";
    // O próximo passo da fatura escolhia "escalar" pelos dias INVENTADOS.
    if (c?.inad && /^(Escalar para CS|Contatar o financeiro)/.test(l.prox)) {
      out.prox = c.inad.dias >= 7 ? "Escalar para CS + Financeiro" : "Contatar o financeiro do cliente";
    }
    return out;
  });

  /* Sinais: "marcar como tratado" não tem onde ser guardado (era localStorage
     no protótipo). Esconder o card fingiria que gravou; avisar é o honesto. */
  vals.at.cards = vals.at.cards.map((card: any) => {
    const c = porNome.get(card.nome);
    return {
      ...card,
      tag: c ? contato(fatura(card.tag, c), c) : card.tag,
      desc: c ? fatura(card.desc, c) : card.desc,
      resolver: () => toast("Este sinal é calculado do banco e some sozinho quando a causa for resolvida. Ainda não há onde registrar \"tratado\"."),
    };
  });

  // NEXO: o texto inteiro, sem a frase de renovação, e a animação de digitação sobre ele.
  const briefLimpo = String(vals.nexo?.txt ?? "").replace(/ ?\d+ (clientes renovam|cliente renova) nos próximos 90 dias\./, "");
  vals.nx = {
    ...vals.nx,
    brief: briefLimpo.slice(0, S.tp),
    digitando: S.tp < briefLimpo.length,
    plano: vals.nx.plano.map((it: any) => {
      const c = porNome.get(String(it.t).split(" · ").slice(1).join(" · "));
      return c ? { ...it, sub: contato(fatura(it.sub, c), c) } : it;
    }),
    msgs: vals.nx.msgs.map((m: any) => ({
      ...m,
      t: textoDoNexo(m.t, porNome),
      acoes: (m.acoes ?? []).filter((a: any) => !/^Preparar /.test(a.l)),
    })),
  };

  /* Origem: os baldes do desenho (Meta Ads, Indicação, Outbound, Eventos)
     não existem no banco — as origens reais são ZohoDesk, Mídia Paga, stripe,
     Orgânico… e todas cairiam em "Outros" (272 de 272). As 4 origens reais
     mais comuns da carteira ocupam as fatias, o resto vai para "Outros". */
  const origemDe = new Map(p.leads.map((l) => [l.empresa, l.origem || "Sem origem"] as const));
  const cont = new Map<string, number>();
  for (const c of cart) { const o = origemDe.get(c.nome) ?? "Sem origem"; cont.set(o, (cont.get(o) ?? 0) + 1); }
  const top = [...cont.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const fatias = [...top, ["Outros", cart.length - top.reduce((a, [, n]) => a + n, 0)] as [string, number]];
  const totO = Math.max(1, cart.length);
  let accO = 0;
  vals.ori = {
    ...vals.ori,
    arcos: vals.ori.arcos.map((a: any, i: number) => {
      const pc = (fatias[i]?.[1] ?? 0) / totO * 100, len = Math.max(0, pc - 1.5), l = S.pronto ? len : 0;
      const o = { ...a, da: l.toFixed(2) + " " + (100 - l).toFixed(2), off: String(-accO) };
      accO += pc;
      return o;
    }),
    lista: vals.ori.lista.map((x: any, i: number) => ({ ...x, l: fatias[i]?.[0] ?? x.l, n: String(fatias[i]?.[1] ?? 0) })),
  };

  /* Distribuição por produto: o desenho soma a conta INTEIRA na família
     dominante. Com o MRR por família, o donut bate com servicos_canonicos. */
  const mrrP = FAM_K.map((k) => cart.reduce((a, c) => a + (c.mrrFam[k] ?? 0), 0));
  const totP = Math.max(1, mrrP.reduce((a, b) => a + b, 0));
  let acc = 0;
  vals.dist = {
    ...vals.dist,
    centro: S.hvD != null ? brlK(mrrP[S.hvD]) : vals.dist.centro,
    arcos: vals.dist.arcos.map((a: any, i: number) => {
      const pc = mrrP[i] / totP * 100, len = Math.max(0, pc - 1.5), l = S.pronto ? len : 0;
      const o = { ...a, da: l.toFixed(2) + " " + (100 - l).toFixed(2), off: String(-acc) };
      acc += pc;
      return o;
    }),
    lista: vals.dist.lista.map((x: any, i: number) => ({ ...x, v: brl(mrrP[i]), pct: Math.round(mrrP[i] / totP * 100) + "%" })),
  };

  /* Saúde da carteira: snapshot real (cs_health_snapshots). Faixas do próprio
     calculador: >= 70 saudável, 40-69 atenção, < 40 risco; sem serviço ativo, inativo. */
  const cls = (c: any) => c.fim ? 3 : c.saudeReal >= 70 ? 0 : c.saudeReal >= 40 ? 1 : 2;
  const cntS = [0, 1, 2, 3].map((k) => base.filter((c) => cls(c) === k).length), totS = Math.max(1, base.length);
  vals.sau = { ...vals.sau, segs: vals.sau.segs.map((sg: any, k: number) => ({
    ...sg, pct: Math.round(cntS[k] / totS * 100) + "%", n: cntS[k] + (cntS[k] === 1 ? " conta" : " contas"), dica: sg.l + ": " + cntS[k],
    barra: sg.barra.replace("display:none;", "display:block;").replace(/flex:0 0 0;/, "flex:" + cntS[k] + " 0 0;"),
  })) };

  /* Evolução do FATURAMENTO (cliente_receita_mensal), barras empilhadas por
     natureza: MRR | Setup/Avulso | Débito recuperado | A classificar. É a
     carteira inteira (a série não é por responsável). Sem série carregada,
     fica o aviso do Liga ("sem histórico"). */
  const FAT = p.faturamento ?? [];
  const W = Array.from({ length: 12 }, (_, i) => new Date(hoje.getFullYear(), hoje.getMonth() - 11 + i, 1));
  if (FAT.length) {
    const topo = passoDoEixo(Math.max(1, ...FAT.map((m) => m.total))) * 4;
    const nomeMes = (c: string) => MESL[Number(c.slice(5)) - 1];
    const hv = S.hv != null && S.hv < FAT.length ? S.hv : null;
    vals.ev = {
      ...vals.ev,
      legenda: CAMADAS_FATURAMENTO.map((c) => ({ l: c.l, dot: "width:9px;height:9px;border-radius:2px;background:" + c.cor })),
      eixo: [4, 3, 2, 1, 0].map((k) => { const n = topo / 4 * k; return n >= 1000 ? "R$ " + Math.round(n / 1000) + "k" : "R$ " + Math.round(n); }),
      cols: FAT.map((m, i) => ({
        l: nomeMes(m.competencia).slice(0, 3),
        entrar: () => { if (S.hv !== i) S.setState?.({ hv: i }); },
        rot: "flex:1;min-width:0;text-align:center;font-size:10.5px;white-space:nowrap;overflow:hidden;color:" + (hv === i ? "var(--of-tinta-forte);font-weight:700" : "var(--of-tinta-3)"),
        barra: "width:100%;max-width:30px;display:flex;flex-direction:column;gap:2px;transition:height .9s cubic-bezier(.16,1,.3,1) " + (i * 40) + "ms,opacity .15s;height:" + (S.pronto ? m.total / topo * 100 : 0) + "%;opacity:" + (hv == null || hv === i ? 1 : .4),
        segs: CAMADAS_FATURAMENTO.map((c, j) => ({ st: "display:block;min-height:0;flex:" + m[c.k] + " 0 0;background:" + c.cor + ";border-radius:" + (j === CAMADAS_FATURAMENTO.length - 1 ? "5px 5px 2px 2px" : "2px") })).reverse(),
      })),
      temDica: hv != null,
      dicaPos: "position:absolute;z-index:3;pointer-events:none;top:6px;left:8px;width:190px;padding:9px 11px;border-radius:10px;background:var(--of-tinta);box-shadow:0 0 0 1px var(--of-grafite-borda),0 14px 30px -12px rgba(0,0,0,.6)",
      dicaT: hv != null ? nomeMes(FAT[hv].competencia) + " " + FAT[hv].competencia.slice(0, 4) : "",
      dicaL: hv != null ? CAMADAS_FATURAMENTO.map((c) => ({ l: c.l, v: brl(FAT[hv][c.k]), dot: "width:8px;height:8px;border-radius:2px;background:" + c.cor })) : [],
      dicaTot: hv != null ? brl(FAT[hv].total) : "",
    };
  }

  /* Tempo médio de vida e "clientes vs. 12 meses atrás" dependem da data de
     entrada, que 90 contas não têm (ver tela-cs.ts). A média sai só das contas
     com evidência; o comparativo de 12 meses vira "—" em vez de um % errado. */
  const comData = base.filter((c) => c.inicio !== INICIO_SEM_EVIDENCIA);
  const vidaEm = (m: Date) => {
    const at = comData.filter((c) => ativoEm(c, m));
    return at.length ? at.reduce((a, c) => { const [y, mm] = c.inicio.split("-").map(Number); return a + Math.max(0, (m.getFullYear() - y) * 12 + m.getMonth() - (mm - 1)); }, 0) / at.length : 0;
  };
  const vS = W.map(vidaEm), vNow = vS[11], vMax = Math.max(1, ...vS);
  const Yv = (v: number) => 64 - v / vMax * 56;
  const vLinha = vS.map((v, i) => (i ? "L" : "M") + (i / 11 * 300).toFixed(1) + " " + Yv(v).toFixed(1)).join(" ");
  const neutro = "display:inline-flex;align-items:center;height:20px;padding:0 7px;border-radius:9999px;font-size:11px;font-weight:700;white-space:nowrap;background:var(--of-calha);color:var(--of-tinta-2)";
  vals.vida = {
    ...vals.vida,
    v: vNow < 1 ? "Novo" : Math.round(vNow) + " meses",
    dt: "—", dSt: neutro,
    linha: vLinha, area: vLinha + " L300 70 L0 70 Z",
    ponto: "position:absolute;width:9px;height:9px;border-radius:9999px;background:var(--of-coral-marca);box-shadow:0 0 0 2.5px var(--of-papel);right:-4px;top:calc(" + (Yv(vNow) / 70 * 100).toFixed(1) + "% - 4px)",
  };
  if (comData.length < base.length) vals.kp5[1] = { ...vals.kp5[1], dt: "—", dSt: neutro };

  /* Equipe real no lugar de "Ricardo Alves" / "Juliana Prado". O `resp` já
     vem do estado normalizado por setState (ver CsLigada) — o que aparece no
     select é o que vai gravado. O usuário da sessão entra na lista quando não
     é da org (super_admin com override), senão o select não teria a opção. */
  if (vals.mP?.aberto) {
    vals.mP = { ...vals.mP, equipe: p.eu && !p.equipe.includes(p.eu) ? [p.eu, ...p.equipe] : p.equipe };
  }
  return vals;
}

/* ── A subclasse ───────────────────────────────────────────────────────── */

class CsLigada extends CsLiga {
  constructor(props: any) {
    super(props);
    const self = this as any;
    /* O protótipo lê ?aba= e ?view= no componentDidMount, que o servidor não
       roda. A página lê searchParams e passa aqui. `esc: "todos"`: nenhum dos
       275 clientes tem responsável, e "Minha carteira" abriria a tela zerada
       com "Carteira em dia" — mentira por omissão. */
    const aba = ["geral", "carteira", "renov", "play"].includes(props.abaInicial) ? props.abaInicial : "geral";
    self.state = {
      ...self.state,
      esc: "todos",
      aba: props.viewInicial ? "carteira" : aba,
      carV: props.viewInicial || "minha",
    };
    /* O `irPara` do Liga entrega só o href e joga fora os parâmetros — e é
       neles que vem o id do cliente. Sem isto "Abrir cliente" ia para uma
       lista, não para a conta. */
    const E = self.E;
    self.E = { ...E, irPara: (href: string, _label?: string, params?: any) => props.ir?.(href, params) };
  }

  /** Responsável padrão do modal de playbook. O Liga abre o modal com
      `csmDe(c)` (vazio: nenhuma conta tem responsavel_cs_id) e, no salvar,
      cai em `M.resp || "Scott Ferraz"` fixo — a tela mostrava o usuário da
      sessão e gravava o id de Scott Ferraz. Aqui, todo `modal.resp` que não
      é um nome da equipe vira o responsável CS da conta ou, sem ele, o
      usuário logado. Ao abrir, o resp do Liga é sempre recalculado. */
  setState(u: any, cb?: () => void) {
    const p = (this as any).props.correcao as { equipe: string[]; eu: string; clientes: ClienteDaTela[] };
    const valido = (n?: string | null) => !!n && (p.equipe.includes(n) || n === p.eu);
    super.setState((s: any, pr: any) => {
      const v = typeof u === "function" ? u(s, pr) : u;
      const m = v?.modal;
      if (m?.k !== "pb") return v;
      // Ao ABRIR o modal, o resp vem do Liga (csmDe ou o "Scott Ferraz" fixo, que
      // é nome real da equipe — por isso não basta checar validade). Depois de
      // aberto, nome válido é escolha do usuário no select e fica.
      if (s.modal?.k === "pb" && valido(m.resp)) return v;
      const cs = p.clientes.find((c) => c.id === m.cli)?.resp;
      return { ...v, modal: { ...m, resp: valido(cs) ? cs : p.eu } };
    }, cb);
  }

  /** O Liga chama `this.diz` em todo aviso e não o define: o primeiro toast derrubava a tela. */
  diz(t: string, tom?: string) {
    if (tom === "erro") toast.error(t); else toast.success(t);
  }

  renderVals() {
    const self = this as any;
    const v = corrigir(super.renderVals(), { ...self.state, setState: (x: any) => self.setState(x) }, self.props.correcao);
    // O bloco contextual de CS é só uma entrada: conversa, ações e memória vivem no painel global.
    if (v.nx) {
      v.nx.status = "NEXO · inteligência central";
      v.nx.brief = "Pergunte sobre sua carteira ou abra o NEXO para agir.";
      v.nx.digitando = false;
      v.nx.mostraPlano = false;
      v.nx.temPend = false;
      v.nx.temMsgs = false;
      v.nx.pensando = false;
      v.nx.msgs = [];
      v.nx.enviar = () => abrirNexo(v.nx.rasc);
      v.nx.tecla = (e: React.KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); abrirNexo(v.nx.rasc); } };
      v.nx.chips = (v.nx.chips ?? []).map((chip: { l: string }) => ({ ...chip, onClick: () => abrirNexo(chip.l) }));
    }
    return v;
  }
}

/* ── A tela ────────────────────────────────────────────────────────────── */

async function post(url: string, body: unknown): Promise<void> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error ?? `HTTP ${r.status}`);
}

const TIPO_EXPANSAO: Record<string, string> = { expansao: "usuarios", upgrade: "upgrade", nova: "nova_familia" };

export function CsProto({ dados, eu, euId, abaInicial, viewInicial }: {
  dados: DadosTelaCs;
  /** Nome e id do usuário da sessão (getTenantContext) — responsável padrão do playbook. */
  eu: string;
  euId: string;
  abaInicial?: string;
  viewInicial?: string;
}) {
  const router = useRouter();

  const clientes = React.useMemo(() => dados.clientes.map((c) => ({
    ...c,
    // Ver o cabeçalho: faixa neutra para todos, 0 só para inadimplência real.
    saude: c.inad ? 0 : 70,
    /* Score real de cs_health_snapshots (275 de 275 contas têm). Não passa por
       `saude`: aquele campo alimenta os gatilhos inventados do Liga. */
    saudeReal: c.saude,
    /* "" e não null: o Liga faz `csmDe(c).split(" ")` no card de atenção e
       cai com null. Vazio continua falso para "Sem responsável". */
    resp: c.resp ?? "",
  })), [dados.clientes]);
  const porNome = React.useMemo(() => new Map(clientes.map((c) => [c.nome, c] as const)), [clientes]);
  const equipe = React.useMemo(() => dados.equipe.map((u) => u.nome), [dados.equipe]);
  const idDoUsuario = React.useCallback((nome?: string | null) => dados.equipe.find((u) => u.nome === nome)?.id ?? null, [dados.equipe]);

  const ordenarEquipe = useOrdemDaEquipe();
  const catalogo = React.useMemo(() => ({
    ClientesSeed: clientes,
    EQUIPE: ordenarEquipe(equipe),
    /* A mesma tarefa chega pela Agenda; semear AtividadesSeed também a
       contaria duas vezes. HistoricoSeed fica vazio: "Atividades recentes" já
       se alimenta das interações reais em clientes360 e das tarefas feitas. */
    AtividadesSeed: [],
    HistoricoSeed: [],
    LEADS: [],
    /* OBRIGATÓRIA: o Liga faz `(Agenda ?? []).itens()`, e `[]` é truthy — sem
       ela a tela cai com "itens is not a function" já no SSR. */
    Agenda: {
      itens: () => dados.tarefas.map((t) => ({
        key: t.id, id: t.id, src: "p", area: null,
        titulo: t.titulo, tipo: tipoDaTarefa(t.tipo),
        situacao: SITUACAO[t.situacao] ?? "A fazer",
        prioridade: PRIORIDADE[t.prioridade] ?? "Média",
        resp: t.resp, empresa: t.empresa,
        quando: t.quando ? new Date(t.quando) : null, temHora: t.temHora,
      })),
      situacao: (x: any, nova: string) => {
        if (nova !== "Feita") {
          toast("Reabrir tarefa ainda não tem command. Faça pela tela de Tarefas.");
          router.refresh();
          return;
        }
        post(`/api/cs/tarefas/${x.id}/concluir`, {})
          .catch((e) => toast.error(`Não foi possível concluir: ${e.message}`))
          .finally(() => router.refresh());
      },
    },
  }), [clientes, equipe, dados.tarefas, router, ordenarEquipe]);

  const dadosDoLiga = React.useMemo(() => {
    const agora = Date.now();
    const resolvidos: Record<string, number> = {};
    for (const c of clientes) resolvidos[c.id + ":renov"] = agora;
    const x360: Record<string, any> = {};
    for (const c of clientes) x360[c.id] = { csm: c.resp ?? undefined, principal: c.principal ?? undefined, pessoas: [], eventos: [] };
    for (const e of dados.eventos) {
      x360[e.empresaId]?.eventos.push({
        id: e.empresaId + e.quando, quando: e.quando, autor: e.autor,
        t: e.t && e.t !== e.cat ? e.t : TIPO_EVENTO[e.cat] ?? e.cat,
        cat: e.cat === "proposta_enviada" ? "comercial" : "atividades",
      });
    }
    return {
      opps: dados.expansoes,
      leads: dados.leads.map((l) => ({ ...l, origem: l.origem || "Outros" })),
      clientesExtra: [],
      atividadesV2: [],
      clientes360: x360,
      cs: { resolvidos },
    };
  }, [clientes, dados.eventos, dados.expansoes, dados.leads]);

  const ir = React.useCallback((href: string, params?: any) => {
    if (href === "/atendimento") {
      return router.push(params?.lead ? `/atendimento?canal=whatsapp&leadId=${encodeURIComponent(params.lead)}` : "/atendimento?canal=whatsapp");
    }
    // Oportunidade, cliente 360 e atividades: rotaDoDesenho é a fonte única
    // (oportunidade vai para /pipeline/<id>, a tela ONFACE, e preserva ?aba=).
    router.push(rotaDoDesenho(href, params));
  }, [router]);

  /* Peça do protótipo: abre por cima desta tela pelo hospedeiro global. */
  const { abrir: abrirPeca } = usePecas();
  const abrir = React.useCallback((peca: string, id?: unknown) => {
    abrirPeca(peca, id, { tela: "cs" });
  }, [abrirPeca]);

  /**
   * O store do protótipo, traduzido em command. Cada chave do patch vira
   * chamada real ou aviso honesto — nunca silêncio (lição 5).
   */
  const gravar = React.useCallback(async (patch: any) => {
    const erros: string[] = [];

    // Playbook: um passo = uma tarefa de CS na conta.
    const novas = (patch.atividadesV2 ?? []) as any[];
    await Promise.all(novas.map(async (a) => {
      const c = porNome.get(a.empresa);
      if (!c) return;
      try {
        await post(`/api/cs/clientes/${c.id}/tarefas`, {
          titulo: a.titulo,
          descricao: a.desc,
          tipo: "cs_followup",
          prioridade: a.prioridade === "Alta" ? "alta" : "media",
          venceEm: a.fimD ? new Date(`${a.fimD}T${a.fimH || "12:00"}:00`).toISOString() : null,
          // Nome sem id (nunca deveria, ver setState) → null, e o endpoint usa o usuário da sessão.
          usuarioId: a.resp === eu ? euId : idDoUsuario(a.resp),
        });
      } catch (e: any) { erros.push(e.message); }
    }));

    // Oportunidades: expansão tem command; renovação não tem de onde nascer.
    const conhecidas = new Set(dados.expansoes.map((o) => o.id));
    for (const o of (patch.opps ?? []) as any[]) {
      if (conhecidas.has(o.id)) continue;
      if (o.tipo === "renovacao") {
        toast.error("Não há contrato com data de renovação para esta conta.");
        continue;
      }
      const c = porNome.get(o.empresa);
      if (!c) continue;
      try {
        await post(`/api/cs/clientes/${c.id}/expansao`, {
          titulo: `Expansão via CS · ${FAM[o.familia] ?? o.familia} · ${c.nome}`.slice(0, 200),
          tipo: TIPO_EXPANSAO[o.tipo] ?? "usuarios",
          // Só herda o serviço quando é a MESMA família; cross-sell nasce sem.
          servicoOrigemId: o.familia === c.produto ? c.servicoId : null,
          descricao: [o.notas?.[0]?.texto, o.timing ? `Timing: ${o.timing}` : null].filter(Boolean).join("\n"),
          responsavelId: o.resp === eu ? euId : idDoUsuario(o.resp),
        });
        toast.success("Expansão criada no Pipeline" + (o.resp ? " · " + o.resp + " assume" : ""));
      } catch (e: any) { erros.push(e.message); }
    }

    // Estado que era localStorage no protótipo e não tem tabela no produto.
    if (patch.cs?.handoff) toast("Tarefas do handoff criadas. O selo \"Handoff feito\" ainda não é guardado.");

    if (erros.length) toast.error(`Falhou ao gravar: ${erros[0]}`);
    router.refresh();
  }, [porNome, idDoUsuario, eu, euId, dados.expansoes, router]);

  return (
    <div data-workspace="desenho">
      <CsLigada
        dados={dadosDoLiga}
        catalogo={catalogo}
        correcao={{ clientes, equipe, eu, leads: dados.leads, faturamento: dados.faturamento, risco: dados.risco }}
        abaInicial={abaInicial}
        viewInicial={viewInicial}
        abrir={abrir}
        gravar={gravar}
        ir={ir}
      />
    </div>
  );
}
