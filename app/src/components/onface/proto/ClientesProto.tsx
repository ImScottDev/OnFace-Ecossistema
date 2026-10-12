"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Clientes (carteira pós-venda) — o adaptador.
 *
 * `ClientesDesenho` é o markup do handoff e `ClientesLiga` a lógica portada;
 * os dois são GERADOS e não se editam. Aqui a carteira real (montada em
 * lib/clientes/carteira-desenho.ts) entra no lugar do `ClientesSeed` do mock,
 * e o que o protótipo afirma sem ter dado é corrigido na saída.
 * ───────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { CarteiraDoDesenho, ClienteDoDesenho } from "@/lib/clientes/carteira-desenho";
import { CAMADAS_FATURAMENTO, geometriaFaturamento } from "@/lib/clientes/evolucao-geometria";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClientesLiga } from "./ClientesLiga";
import { abrirNexo } from "@/lib/nexo/cliente";
import { rotaDoDesenho } from "./rota-do-desenho";
import { usePecas } from "./pecas-host";

const brlC = (n: number) => "R$ " + Math.round(n).toLocaleString("pt-BR");
const MESC = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const pillC = (ok: boolean) => "display:inline-flex;align-items:center;gap:3px;height:20px;padding:0 7px;border-radius:9999px;font-size:11px;font-weight:700;white-space:nowrap;" + (ok ? "background:#e6f4ee;color:#1f7256" : "background:#fdeeea;color:#c2330f");

/**
 * VISÃO PRINCIPAL da Carteira (decisão do Scott, 06/10): evolução do
 * FATURAMENTO mês a mês, empilhada por natureza (MRR | Setup/Avulso | Débito
 * recuperado), com a linha de MRR por cima; KPIs MRR | Setup/Avulso | Total
 * separados. Troca o que o desenho calcula (MRR por produto, somado por data de
 * entrada) pela série real de cliente_receita_mensal.
 */
function evolucaoFaturamento(v: any, c: CarteiraDoDesenho, S: any) {
  const todas = c.faturamento ?? [];
  if (!todas.length || !v.evo) return;
  const EN = Math.min(S.evoN || 12, todas.length), serie = todas.slice(-EN);
  const g = geometriaFaturamento(serie, S.evoOff || {}, 1000, 220);
  const ult = todas[todas.length - 1], ant = todas.length > 1 ? todas[todas.length - 2] : null;
  const hE = S.hvE != null && S.hvE < EN ? S.hvE : null;
  const pctDe = (a: number, b: number) => (b > 0 ? Math.round((a / b - 1) * 100) : null);
  const mesTxt = (m: string) => MESC[Number(m.slice(5)) - 1] + "/" + m.slice(0, 4);
  const dE = pctDe(serie[EN - 1].total, serie[0].total);
  const dicaX = hE != null ? (EN === 1 ? 50 : (hE / (EN - 1)) * 100) : 0;
  const passoRot = EN > 8 && (S.larg ?? 1440) < 1100 ? 2 : 1;
  const camadas = g.camadas.map((cm) => ({
    gid: "evoG" + cm.k, cor: cm.cor, fill: "url(#evoG" + cm.k + ")", linha: cm.linha, area: cm.area,
    aStyle: "transition:opacity .2s;opacity:" + (hE == null ? 1 : .85), lStyle: "",
  })).reverse();
  // Linha de MRR por cima de tudo: sem área, traço claro, desenhada por último.
  camadas.push({ gid: "evoGmrrTopo", cor: "#ffffff", fill: "none", linha: g.linhaMrr, area: "", aStyle: "", lStyle: "" });
  Object.assign(v.evo, {
    desc: "Faturamento por natureza · " + mesTxt(serie[0].competencia) + " a " + mesTxt(serie[EN - 1].competencia) + " · linha branca = MRR",
    total: brlC(serie[EN - 1].total),
    temD: dE != null, dt: dE != null ? Math.abs(dE) + "%" : "", dIco: dE != null && dE < 0 ? "M7 7l10 10M17 9v8H9" : "M7 17 17 7M9 7h8v8", dStyle: pillC(dE == null || dE >= 0),
    eixo: [4, 3, 2, 1, 0].map((k) => ({ l: g.passo * k >= 1000 ? "R$ " + ((g.passo * k) / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "k" : "R$ " + Math.round(g.passo * k) })),
    camadas,
    cols: serie.map((_, i) => ({ entrar: () => { if (S.hvE !== i) S.setState?.({ hvE: i }); } })),
    rot: serie.map((m, i) => ({ l: MESC[Number(m.competencia.slice(5)) - 1], st: "position:absolute;top:0;transform:translateX(-50%);font-size:10.5px;color:#67787c;white-space:nowrap;left:" + (EN === 1 ? 50 : (i / (EN - 1)) * 100) + "%" + ((EN - 1 - i) % passoRot ? ";visibility:hidden" : "") + (i === 0 ? ";transform:none" : i === EN - 1 ? ";transform:translateX(-100%)" : "") })),
    temDica: hE != null,
    guia: hE != null ? "position:absolute;top:0;bottom:0;width:0;border-left:1px dashed rgba(254,79,43,.45);pointer-events:none;left:" + dicaX + "%" : "display:none",
    pts: hE != null ? g.visiveis.map((cm, j) => ({ st: "position:absolute;pointer-events:none;width:9px;height:9px;border-radius:9999px;background:" + cm.cor + ";box-shadow:0 0 0 2px #12171d;transform:translate(-50%,-50%);left:" + dicaX + "%;top:" + (g.Y(g.cum[j][hE]) * 170 / 220) + "px" })) : [],
    dicaT: hE != null ? mesTxt(serie[hE].competencia) : "",
    dicaL: hE != null ? g.visiveis.slice().reverse().map((cm) => ({ l: cm.l, v: brlC(serie[hE][cm.k]), dot: "width:8px;height:8px;border-radius:2px;background:" + cm.cor })) : [],
    dicaTot: hE != null ? brlC(g.totais[hE]) : "",
    legenda: CAMADAS_FATURAMENTO.map((cm) => { const off = !!(S.evoOff || {})[cm.k]; return {
      l: cm.l, onClick: () => S.setState?.((s: any) => ({ evoOff: Object.assign({}, s.evoOff || {}, { [cm.k]: !off }) })),
      st: "display:inline-flex;align-items:center;gap:7px;height:26px;padding:0 6px;border-radius:7px;border:0;background:transparent;cursor:pointer;font-size:12px;font-weight:500;white-space:nowrap;color:" + (off ? "#4a5560;text-decoration:line-through" : "#a3aab0"),
      dot: "width:9px;height:9px;border-radius:2px;background:" + (off ? "#2a3139" : cm.cor),
    }; }),
  });
  /* KPIs: MRR | Setup/Avulso | Total, sempre separados. Sem natureza
     classificada na carga, o valor vai para "A classificar" (nunca para MRR). */
  const nota = ult.semClasse ? " · " + brlC(ult.semClasse) + " a classificar" : "";
  const delta = (a: number, b: number | undefined) => { const d = b ? pctDe(a, b) : null; return d == null ? { temD: false, dt: "", dIco: "M7 17 17 7M9 7h8v8", dStyle: pillC(true) } : { temD: true, dt: Math.abs(d) + "%", dIco: d < 0 ? "M7 7l10 10M17 9v8H9" : "M7 17 17 7M9 7h8v8", dStyle: pillC(d >= 0) }; };
  const kpis: any[] = v.kpi ?? [];
  const iM = kpis.findIndex((k) => k.l === "Receita mensal (MRR)");
  if (iM >= 0) {
    const base = kpis[iM];
    Object.assign(base, { l: "MRR do mês", v: brlC(ult.mrr), sub: "vs. mês anterior" + nota, ...delta(ult.mrr, ant?.mrr) });
    kpis.splice(iM + 1, 0,
      { ...base, l: "Setup / Avulso", v: brlC(ult.avulso), sub: "não recorrente no mês", ...delta(ult.avulso, ant?.avulso) },
      ...(ult.debito || ant?.debito ? [{ ...base, l: "Débito recuperado", v: brlC(ult.debito), sub: "dívida antiga paga, não recorrente", ...delta(ult.debito, ant?.debito) }] : []),
      { ...base, l: "Total faturado no mês", v: brlC(ult.total), sub: "MRR + setup/avulso + débito · " + mesTxt(ult.competencia), ...delta(ult.total, ant?.total) });
  }
  /* "Por produto" soma o MRR dos clientes COM empresa vinculada; o topo soma a
     série inteira. A diferença é MRR de lançamento sem empresa (nada a atribuir
     sem inventar): vai escrito, para os dois números fecharem na leitura. */
  const somaProd = c.clientes.filter((x) => x.status !== "Inativo").reduce((a, x) => a + x.mrr, 0);
  const semEmpresa = Math.round(ult.mrr - somaProd);
  if (v.hero && semEmpresa > 0) v.hero.prodTxt = brlC(somaProd) + " de " + brlC(ult.mrr) + " de MRR (" + brlC(semEmpresa) + " sem empresa vinculada)";
  if (v.hero) {
    const dm = delta(ult.mrr, ant?.mrr);
    Object.assign(v.hero, {
      mrr: brlC(ult.mrr), dt: dm.dt, dIco: dm.dIco,
      dStyle: dm.temD ? "display:inline-flex;align-items:center;gap:4px;height:24px;padding:0 9px;border-radius:9999px;font-size:12px;font-weight:700;white-space:nowrap;" + (dm.dt && ult.mrr < (ant?.mrr ?? 0) ? "background:rgba(254,79,43,.14);color:#ff8a70" : "background:rgba(62,207,142,.12);color:#3ecf8e") : "display:none",
      dTxt: "MRR vs. mês anterior",
      /* Setup/Avulso e Débito recuperado são naturezas distintas (regra do Scott):
         juntar os dois escondia os R$ 6 mil de débito dentro do "avulso". */
      resumo: "Setup/Avulso " + brlC(ult.avulso) + " · Débito recuperado " + brlC(ult.debito) + " · Total faturado " + brlC(ult.total) + " em " + mesTxt(ult.competencia) + nota,
    });
  }
}

/**
 * Legendas que o protótipo escreve com uma confiança que o dado não tem.
 *
 * Os valores são montados dentro de `renderVals`, sem gancho; corrigir a saída
 * por RÓTULO (padrão `corrigirInventados` de PessoaProto) é o que resolve sem
 * tocar no gerado. Os números continuam os do protótipo — o que muda é a
 * legenda dizer sobre qual base eles foram calculados.
 */
function corrigirSaida(v: any, c: CarteiraDoDesenho, DC: ClienteDoDesenho | null, S: any = {}) {
  const total = c.clientes.length;
  const semInicio = total - c.comInicio;

  /* `inicio` falta em parte da base (nenhuma das quatro fontes tem a data).
     Esses clientes chegam com inicio "" — e "" <= qualquer "YYYY-MM", então o
     `ativoEm` do desenho os conta como ativos em TODO o período. Os números de
     hoje ficam certos (total, MRR, ticket); a curva histórica subestima o
     crescimento. É o default conservador: nunca inventa um mês de entrada,
     e a legenda avisa. */
  const notaInicio = semInicio ? ` · início conhecido em ${c.comInicio} de ${total}` : "";
  const notaContato = ` · entre os ${c.comAtividade} com atividade registrada`;

  for (const k of v.kpi ?? []) {
    /* `diasSem()` devolve 0 para `ultima` vazio: quem NUNCA teve atividade
       conta como "contato recente". Sem a nota o número mente por omissão. */
    if (k.l === "Clientes sem atividade") k.sub += notaContato;
    else k.sub += notaInicio;
  }
  for (const t of v.hero?.kpis ?? []) {
    if (t.l === "Sem contato 30+ dias") t.l = `Sem contato 30+ dias (de ${c.comAtividade})`;
  }
  /* Ticket "vs. N meses antes" ainda é o MRR de HOJE somado por data de
     entrada (não há faturamento por cliente em mês passado nesta lista): sem
     selo. MRR, Setup/Avulso e Total, a curva e o hero saem de
     cliente_receita_mensal (série real) em `evolucaoFaturamento`. */
  for (const k of v.kpi ?? []) {
    if (k.l === "Ticket médio mensal") Object.assign(k, { temD: false, dt: "", sub: "sem histórico por cliente" });
  }
  evolucaoFaturamento(v, c, S);
  /* E14: o filtro "Inativos" do desenho é a aba Cancelados (status_financeiro 'churned'). */
  for (const f of v.tab?.filtros ?? []) if (f.l === "Inativos") f.l = "Cancelados";
  if (v.cresc && semInicio) v.cresc.rodape2 += ` · ${semInicio} sem data de início`;

  /* Segmentos: o desenho manda setor vazio para "Outros" (173 empresas sem
     setor) E agrupa a cauda depois do 4º lugar também como "Outros" — com o
     dado real saíam DUAS linhas "Outros". Funde numa só, somando. */
  if (Array.isArray(v.segs)) {
    const outros = v.segs.filter((s: any) => s.l === "Outros");
    if (outros.length > 1) {
      const n = outros.reduce((a: number, s: any) => a + parseInt(s.n, 10), 0);
      Object.assign(outros[0], {
        n: n + (n === 1 ? " cliente" : " clientes"),
        pct: Math.round((n / Math.max(1, total)) * 100) + "%",
      });
      v.segs = v.segs.filter((s: any) => s.l !== "Outros" || s === outros[0]);
    }
  }

  for (const l of v.tab?.linhas ?? []) {
    // inicio "" vira "undefined/" no `MESC[am0 - 1]` do desenho.
    if (String(l.desde).startsWith("undefined")) l.desde = "—";
    // clientes.responsavel_id nunca foi populado: coluna mostra "—", não vazio mudo.
    if (!l.resp) l.resp = "—";
    if (!l.ultima) l.ultima = "—";
  }

  if (v.dr?.aberto && DC) {
    const semData = !DC.inicio;
    if (semData) v.dr.desde = "Cliente desde: sem data registrada";
    for (const t of v.dr.tiles ?? []) {
      /* O desenho chama de "Renovação" o aniversário de 12 meses do início.
         Não existe data de renovação de contrato no domínio (cs_renovacoes
         vazio, contratos sem fim de vigência) — o rótulo honesto é aniversário. */
      if (t.l === "Renovação") {
        t.l = "Aniversário";
        if (semData) { t.v = "—"; t.s = "sem data de início"; }
      }
      if (t.l === "Última atividade" && !DC.ultima) t.s = "sem atividade registrada";
    }
    for (const f of v.dr.fatos ?? []) {
      if (f.l === "Cliente desde" && semData) f.v = "—";
      if (f.l === "Customer Success" && !f.v) f.v = "Não atribuído";
    }
  }
  return v;
}

class ClientesLigada extends ClientesLiga {
  nexo(pergunta?: string) { abrirNexo(pergunta ?? ""); }
  _mudo = false;

  constructor(props: any) {
    super(props);
    const E = (this as any).E;
    (this as any).E = {
      ...E,
      /* A Liga passa `irPara(href, label, params)` mas a prop `ir` só recebe o
         href — o id do cliente se perdia e "/clientes/360" abria sem alvo.
         O 360 real é /clientes/<empresaId>. */
      irPara: (href: string, _label?: string, params?: Record<string, string>) => {
        return props.ir(rotaDoDesenho(href, params));
      },
      /* Quem grava sem command recebe o toast honesto do adaptador. O
         protótipo emenda um "N atividades criadas" / "X entrou na carteira"
         logo depois — calado aqui, senão o segundo toast desmente o primeiro. */
      gravar: (patch: any) => {
        this._mudo = true;
        queueMicrotask(() => { this._mudo = false; });
        return props.gravar?.(patch);
      },
      avisar: (texto: string, tom?: string) => { if (!this._mudo) this.diz(texto, tom); },
    };
  }

  // A Liga chama `this.diz` e não o define — sem isto, exportar CSV estourava.
  diz(texto: string, tom?: string) {
    if (tom === "ok") toast.success(texto); else toast(texto);
  }

  renderVals() {
    const v = super.renderVals();
    const p = (this as any).props;
    const s = (this as any).state;
    const DC = s.drawer ? p.carteira.clientes.find((x: ClienteDoDesenho) => x.id === s.drawer) ?? null : null;
    const saida = corrigirSaida(v, p.carteira, DC, { ...s, setState: (x: any) => (this as any).setState(x) });
    /* E3: reatribuição em massa do responsável (seleção da tabela). */
    const ids = Object.keys(s.sel ?? {}).filter((k) => s.sel[k]);
    if (saida.tab && ids.length) saida.tab.reatribuir = () => p.onReatribuir?.(ids, () => (this as any).setState({ sel: {} }));
    return saida;
  }
}

export function ClientesProto({ carteira }: { carteira: CarteiraDoDesenho }) {
  const router = useRouter();
  const [atribuir, setAtribuir] = React.useState<{ ids: string[]; limpar: () => void } | null>(null);
  const [gravando, setGravando] = React.useState(false);

  /* E3: POST /api/cs/carteira/atribuir (empresaIds = ids da carteira). */
  const reatribuir = async (responsavelId: string | null) => {
    if (!atribuir) return;
    setGravando(true);
    try {
      const r = await fetch("/api/cs/carteira/atribuir", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ empresaIds: atribuir.ids, responsavelId }),
      });
      if (!r.ok) throw new Error(String(r.status));
      toast(`${atribuir.ids.length} ${atribuir.ids.length === 1 ? "cliente reatribuído" : "clientes reatribuídos"}.`);
      atribuir.limpar();
      setAtribuir(null);
      router.refresh();
    } catch {
      toast("Não consegui reatribuir. Nada foi alterado.");
    } finally {
      setGravando(false);
    }
  };

  const agenda = React.useMemo(() => carteira.agenda.map((r) => {
    const quando: any = new Date(r.data);
    quando._h = true;
    return {
      key: "p:" + r.id, src: "p", id: r.id, tipo: "Reunião", titulo: r.titulo,
      ini: quando, quando, temHora: true, situacao: "A fazer",
      resp: r.resp, empresa: r.empresa, pessoa: r.pessoa, oppId: r.negocioId,
    };
  }), [carteira]);

  const catalogo = React.useMemo(() => ({
    ClientesSeed: carteira.clientes,
    AtividadesSeed: carteira.atividades,
    /* Agenda e Relacoes NÃO podem faltar: o drawer faz
       `(Agenda ?? []).itens()` e `(Relacoes ?? [])({...})` — o `?? []` devolve
       array, que não tem .itens() nem é função, e o drawer estoura.
       Agenda = reuniões agendadas (forma do `paraItem` do Calendário; `src: "p"`
       faz o clique virar abrir("reuniao")). Vencida sai "Atrasada" pelo diaDe.
       ponytail: o gerado casa por NOME; 5 empresas da carteira se chamam
       "LUMEN EDUCACAO LTDA" (hoje sem relação nem reunião). Se ganharem,
       casar pelo id do drawer aberto. */
    Agenda: { itens: () => agenda },
    Relacoes: ({ empresa }: { empresa: string }) => ({
      itens: carteira.relacoes.filter((r) => r.empresa === empresa).map((r) => ({
        k: r.k, tipo: r.k === "opp" ? "Oportunidade" : "Proposta", titulo: r.titulo, sub: r.sub,
        status: r.status, ir: () => router.push(r.href),
      })),
    }),
    // Só o modal "Novo cliente" usa; ele não grava (ver `gravar`).
    LEADS: [], OPORTUNIDADES: [], SEGMENTOS: {},
  }), [carteira, agenda, router]);

  /* Peça do protótipo: abre por cima desta tela pelo hospedeiro global. */
  const { abrir: abrirPeca } = usePecas();
  const abrir = React.useCallback((peca: string, ref?: any) => {
    if (peca === "reuniao" && ref?.id) {
      const r = carteira.agenda.find((x) => x.id === ref.id);
      if (r?.negocioId) { router.push(`/pipeline/${r.negocioId}`); return; }
    }
    abrirPeca(peca, ref, { tela: "clientes" });
  }, [router, carteira, abrirPeca]);

  /* Não há command para criar cliente na carteira nem atividade a partir de
     insight. Avisar e reler, nunca fingir que gravou. */
  const gravar = React.useCallback((patch: Record<string, unknown>) => {
    if ("clientesExtra" in patch) {
      toast("Cliente novo entra na carteira pelo ganho da oportunidade e pela Entrega — não por aqui.");
    } else {
      toast("Criar atividades a partir do insight ainda não grava.", {
        action: { label: "Abrir Tarefas", onClick: () => router.push("/tarefas") },
      });
    }
    router.refresh();
  }, [router]);

  return (
    <div data-workspace="desenho">
      <ClientesLigada
        dados={{ atividadesV2: carteira.atividades }}
        catalogo={catalogo}
        carteira={carteira}
        abrir={abrir}
        gravar={gravar}
        onReatribuir={(ids: string[], limpar: () => void) => setAtribuir({ ids, limpar })}
        ir={(href: string) => router.push(href)}
      />
      <Dialog open={!!atribuir} onOpenChange={(o) => { if (!o && !gravando) setAtribuir(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Responsável da carteira</DialogTitle>
            <DialogDescription>
              {atribuir?.ids.length} {atribuir?.ids.length === 1 ? "cliente selecionado" : "clientes selecionados"}. Todo mundo continua vendo tudo; muda só quem responde pela conta.
            </DialogDescription>
          </DialogHeader>
          <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
            {carteira.equipe.map((u) => (
              <button key={u.id} type="button" disabled={gravando} onClick={() => reatribuir(u.id)}
                className="rounded-md px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50">
                {u.nome}
              </button>
            ))}
            <button type="button" disabled={gravando} onClick={() => reatribuir(null)}
              className="rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted disabled:opacity-50">
              Sem responsável
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
