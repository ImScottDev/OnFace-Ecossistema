/**
 * Geometria do radar do NEXO a partir de `DadosRadar` reais.
 *
 * O `montarRadar` da CascaLiga (gerada) desenha com números fixos — meta 48,
 * feito 34, "Camila Reis". Este é o mesmo contrato de saída que o markup lê
 * (kpis, arco, degrau, sinais), calculado do período corrente.
 *
 * Não existe meta de "qualificados" cadastrada (a tabela `metas` só tem
 * mrr_fechado e reuniões), então a referência é o PERÍODO ANTERIOR, e os
 * rótulos dizem isso — inventar uma meta seria pior que não ter.
 */
import type { DadosRadar } from "./painel";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DIAS_SEMANA = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
const CORES = ["#fe4f2b", "#12171d", "#7f8b95", "#c8ccc9"];

export function tituloDoRadar(d: Pick<DadosRadar, "modo" | "inicio" | "fim">): string {
  const [, mi, di] = d.inicio.split("-").map(Number);
  const [, mf, df] = d.fim.split("-").map(Number);
  if (!mi) return d.modo === "mes" ? "Radar do mês" : "Radar da semana";
  if (d.modo === "mes") return `Radar do mês · ${MESES[mi - 1]}`;
  return mi === mf
    ? `Radar da semana · ${di}–${df} ${MES_CURTO[mi - 1]}`
    : `Radar da semana · ${di} ${MES_CURTO[mi - 1]}–${df} ${MES_CURTO[mf - 1]}`;
}

const horas = (h: number | null) => (h == null ? "—" : h < 1 ? `${Math.round(h * 60)}min` : `${Math.floor(h)}h${String(Math.round((h % 1) * 60)).padStart(2, "0")}`);

export function desenharRadar(d: DadosRadar, ir: (href: string) => void) {
  const mes = d.modo === "mes";
  const ant = mes ? "mês anterior" : "semana anterior";
  const no = mes ? "no" : "na", doo = mes ? "do" : "da";
  const feito = d.qualificados;
  const antAteHoje = d.acumuladoAnterior[Math.min(d.diasDecorridos, d.acumuladoAnterior.length) - 1] ?? 0;
  const ref = Math.max(d.qualificadosAnterior, feito, 1);

  /* KPIs */
  const conv = d.chegaram ? feito / d.chegaram : null;
  const convAnt = d.chegaramAnterior ? d.qualificadosAnterior / d.chegaramAnterior : null;
  const kpi = (label: string, valor: string, delta: string | null, ok: boolean, nota: string) => ({
    label, valor, ok, nota,
    delta: delta ?? "",
    deltaStyle: "font-size:11.5px;font-weight:700;white-space:nowrap;font-variant-numeric:tabular-nums;color:" + (delta == null ? "#67787c" : ok ? "#1f7256" : "#c2330f"),
  });
  const seta = (n: number) => (n >= 0 ? "↑ " : "↓ ");
  const dQual = feito - antAteHoje;
  const dHoras = d.horasPrimeiroContato != null && d.horasPrimeiroContatoAnterior ? (d.horasPrimeiroContato - d.horasPrimeiroContatoAnterior) / d.horasPrimeiroContatoAnterior : null;
  const dConv = conv != null && convAnt != null ? Math.round((conv - convAnt) * 100) : null;
  const kpis = [
    kpi("QUALIFICADOS", String(feito), seta(dQual) + Math.abs(dQual), dQual >= 0, `até hoje ${no} ${ant}: ${antAteHoje}`),
    kpi("1º CONTATO", horas(d.horasPrimeiroContato), dHoras == null ? null : seta(dHoras) + Math.abs(Math.round(dHoras * 100)) + "%", (dHoras ?? 0) <= 0, "mediana até o primeiro toque"),
    kpi("CONVERSÃO", conv == null ? "—" : Math.round(conv * 100) + "%", dConv == null ? null : seta(dConv) + Math.abs(dConv) + " p.p.", (dConv ?? 0) >= 0, `qualificados ÷ ${d.chegaram} chegados`),
  ];

  /* Arco: qualificados do período contra o período anterior inteiro. */
  const top = d.porResponsavel.slice(0, 3);
  const resto = d.porResponsavel.slice(3).reduce((s, x) => s + x.n, 0);
  const pilhaBruta: [string, number, string][] = top.map((x, i) => [x.nome, x.n, CORES[i]!]);
  if (resto) pilhaBruta.push(["Outros", resto, CORES[3]!]);
  const N = 32, cx = 110, cy = 100, rExt = 86, rInt = 72;
  const preenchidos = Math.min(N, Math.round((feito / ref) * N));
  let acum = 0;
  const faixas = pilhaBruta.map(([, v, cor], i) => {
    const qtd = i === pilhaBruta.length - 1 ? Math.max(0, preenchidos - acum) : Math.round((v / ref) * N);
    const fx = { ini: acum, fim: acum + qtd, cor };
    acum += qtd;
    return fx;
  });
  const segmentos = Array.from({ length: N }, (_, i) => {
    const ang = Math.PI - (i + 0.5) * (Math.PI / N);
    const c = Math.cos(ang), s = Math.sin(ang);
    const faixa = faixas.find((fx) => i >= fx.ini && i < fx.fim);
    return {
      x1: +(cx + rInt * c).toFixed(1), y1: +(cy - rInt * s).toFixed(1),
      x2: +(cx + rExt * c).toFixed(1), y2: +(cy - rExt * s).toFixed(1),
      cor: faixa ? faixa.cor : "#e8eaeb",
    };
  });
  const iniciais = (n: string) => n.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();

  /* Degrau: acumulado do período (laranja) sobre o do anterior (pontilhado). */
  const x0 = 36, xF = 516, yTopo = 22, yBase = 174;
  const teto = Math.max(4, Math.ceil(Math.max(d.qualificadosAnterior, feito) * 1.1));
  const esc = (v: number) => +(yBase - (v / teto) * (yBase - yTopo)).toFixed(1);
  const px = (t: number) => +(x0 + t * (xF - x0)).toFixed(1);
  const total = d.diasNoPeriodo;
  const linha = (serie: number[]) => serie.reduce((s, v, i) => s + " L " + px((i + 1) / total) + " " + esc(v), "M " + px(0) + " " + esc(0));
  const metaLinha = linha(d.acumuladoAnterior.slice(0, total));
  const metaArea = metaLinha + " L " + px(Math.min(d.acumuladoAnterior.length, total) / total) + " " + yBase + " L " + px(0) + " " + yBase + " Z";
  const realLinha = linha(d.acumulado);
  const nD = d.acumulado.length;
  const realArea = realLinha + " L " + px(nD / total) + " " + yBase + " L " + px(0) + " " + yBase + " Z";
  const passos = [0, Math.round(teto / 3), Math.round((teto / 3) * 2), teto];
  const marcosDef = mes
    ? [0, 7, 14, 21, 28].filter((i) => i < total).map((i) => [String(i + 1), i] as const)
    : DIAS_SEMANA.map((l, i) => [l, i] as const);

  const nota = d.qualificadosAnterior === 0 && feito === 0
    ? `Nenhum qualificado neste período nem ${no} ${ant}.`
    : feito >= antAteHoje
      ? `${feito} qualificados até aqui, ${feito - antAteHoje} acima do mesmo ponto ${doo} ${ant} (que fechou com ${d.qualificadosAnterior}).`
      : `${feito} qualificados até aqui, ${antAteHoje - feito} abaixo do mesmo ponto ${doo} ${ant} (que fechou com ${d.qualificadosAnterior}).`;

  return {
    kpis,
    arco: {
      rotulo: (mes ? "QUALIFICADOS NO MÊS" : "QUALIFICADOS NA SEMANA") + " · RESPONSÁVEIS",
      segmentos,
      pct: d.qualificadosAnterior ? Math.round((feito / d.qualificadosAnterior) * 100) + "%" : String(feito),
      sub: d.qualificadosAnterior ? `${feito} de ${d.qualificadosAnterior} ${doo} ${ant}` : `qualificados · ${ant} sem registro`,
      pilha: pilhaBruta.map(([nome, v, cor]) => ({
        nome, valor: v, iniciais: iniciais(nome),
        share: feito ? Math.round((v / feito) * 100) + "%" : "—",
        chipStyle: "flex:0 0 auto;width:9px;height:9px;border-radius:3px;background:" + cor,
      })),
    },
    degrau: {
      rotulo: "RITMO CONTRA " + (mes ? "O " : "A ") + ant.toUpperCase() + " (PONTILHADO)",
      grade: passos.map((v) => ({
        y: esc(v), label: String(v),
        style: "position:absolute;right:" + (100 - (30 / 520) * 100).toFixed(2) + "%;top:" + ((esc(v) / 210) * 100).toFixed(2)
          + "%;transform:translateY(-50%);font-size:10px;color:#4a5560;white-space:nowrap;pointer-events:none;font-variant-numeric:tabular-nums",
      })),
      metaLinha, metaArea, realLinha, realArea,
      pontaX: px(nD / total), pontaY: esc(d.acumulado.at(-1) ?? 0),
      marcos: marcosDef.map(([label, i]) => ({
        label,
        style: "position:absolute;left:" + ((px((i + 0.5) / total) / 520) * 100).toFixed(2) + "%;top:" + ((198 / 210) * 100).toFixed(2)
          + "%;transform:translate(-50%,-50%);font-size:10px;color:#4a5560;white-space:nowrap;pointer-events:none",
      })),
      nota,
    },
    sinais: (d.sinais.length ? d.sinais : [{ texto: "Nada pendente agora: nenhum lead sem responsável ou sem próxima ação no seu escopo.", acao: "Pré-vendas", href: "/pre-vendas", urgente: false }])
      .map((s, i) => ({
        texto: s.texto, acao: s.acao,
        linhaStyle: "display:flex;align-items:center;gap:10px;min-width:0;padding:11px 0;" + (i === 0 ? "" : "border-top:1px solid #f3f5f5"),
        pontoStyle: "flex:0 0 auto;width:7px;height:7px;border-radius:50%;background:" + (s.urgente ? "#fe4f2b" : "#c8ccc9"),
        onClick: () => ir(s.href),
      })),
  };
}
