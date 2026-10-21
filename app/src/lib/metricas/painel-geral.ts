/**
 * Visão Geral executiva: a composição do painel inteiro, no servidor.
 *
 * O cliente NUNCA reconstrói recorte nem soma: cada cartão traz o número, a cobertura, o estado honesto e a
 * querystring pronta do drill. Os números saem de `medirDetalhado`/`medir` (catálogo) e de `medirRazao`
 * (derivadas); aqui só se compõe. `explorar()` (7+ consultas) roda só nos dois blocos que desenham gráfico.
 *
 * `Promise.allSettled`: uma métrica que explode vira `indisponivel`, não derruba o painel. Sem acesso a uma
 * métrica, o cartão vira `indisponivel` sem valor; o painel nunca devolve 403 por causa de um cartão.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { podeVer, entrada } from "@/lib/relatorios/biblioteca";
import { definicao, FiltroNaoSuportado, medir, medirDetalhado, type DefinicaoMetrica } from "./catalogo";
import { lerPedido } from "./consulta";
import { consultaDe, medirRazao, razao, type MedicaoRazao } from "./derivadas";
import { explorar } from "./explorar";
import { calendarioSP, diaSP, janelaAnterior } from "./janela";
import { avaliarAlertas, VERSAO_LIMIARES } from "./alertas";
import type {
  AvisoRecorrencia, BlocoAlertas, BlocoBase, BlocoCartoes, BlocoComposicao, BlocoEvolucao, BlocoReceita, Cartao,
  Cobertura, EstadoBloco, Lacuna, Motivo, PainelGeral, ParamsPainel,
} from "./painel-geral-tipos";

export type * from "./painel-geral-tipos";

/** Competências seguidas, até a última, que a família precisa ter com MRR para ser chamada de recorrente. */
export const RECORRENCIA_MINIMA_COMPETENCIAS = 3;

/** O que o painel deliberadamente não responde. Servido daqui para a tela não escrever regra em JSX. */
export const LACUNAS: Lacuna[] = [
  { titulo: "Lucro, margem, CAC completo, payback, burn e runway", motivo: "só existem custos de mídia organizados; sem custo de equipe, telefonia, IA e fornecedores o cálculo seria inventado." },
  { titulo: "Bridge de MRR e retenção (NRR/GRR)", motivo: "exigem movimentos de receita reconciliados com o fechamento mensal; entram quando a conciliação por cliente fechar." },
  { titulo: "Faturamento por família antes da classificação", motivo: "a planilha base não tem produto, só Business Line; veja o percentual \"sem família\" na composição." },
  { titulo: "Recebido", motivo: "só existe a baixa dos pagamentos Stripe; boleto e nota fiscal do PABX não têm baixa no ONFACE. Por isso recebido não deve ser lido contra o faturado total, nem por família." },
  { titulo: "Booking por família", motivo: "a família da venda ganha está preenchida em poucas oportunidades; filtrar por família deixa de fora quem não tem, e o número não representa o total da família." },
];

const LAYOUT = {
  receita: ["faturamento_competencia", "faturado", "recebido", "receita_setup", "receita_avulsa", "receita_uso"],
  carteira: ["mrr_atual", "mrr_contratado", "mrr_faturavel", "clientes_ativos", "mrr_em_risco", "mrr_cancelado", "logos_cancelados", "mrr_movimento_liquido"],
  aquisicao: ["leads_novos", "oportunidades_criadas", "booking_ganho", "ticket_medio_booking"],
  conversao: ["win_rate", "conversao_lead_oportunidade", "oportunidades_perdidas"],
  pipeline: ["pipeline_aberto", "pipeline_ponderado", "pipeline_previsto", "oportunidades_abertas", "oportunidades_estagnadas"],
  metas: ["meta_booking", "booking_ganho", "atingimento_meta_booking"],
} as const;

export const METRICA_DAS_SERIES = "faturamento_competencia";

const dia = (d: Date) => { const c = calendarioSP(d); return `${c.ano}-${String(c.mes).padStart(2, "0")}-${String(c.dia).padStart(2, "0")}`; };
const dataBR = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

const qs = (params: ParamsPainel, snapshot: boolean, extra: Record<string, string> = {}) => {
  const q = consultaDe(params);
  if (snapshot) q.delete("periodo");
  for (const [k, v] of Object.entries(extra)) q.set(k, v);
  return q.toString();
};
const drillDe = (codigo: string, q: string) => (q ? `${codigo}?${q}` : codigo);

function esqueleto(id: string, tipo: Cartao["tipo"], codigo: string, nome: string, unidade: Cartao["unidade"], fonte: string, naoInclui: string | null): Cartao {
  return { id, tipo, codigo, nome, unidade, estado: "indisponivel", motivo: null, valor: null, registros: null, comparacao: null, cobertura: null, fonte, naoInclui, drill: null, razao: null };
}

const MOTIVO_ERRO: Motivo = { codigo: "erro", mensagem: "Não foi possível calcular este número agora. Os outros cartões não foram afetados." };
const MOTIVO_SEM_ACESSO: Motivo = { codigo: "sem_acesso", mensagem: "Seu papel não tem acesso a esta métrica." };

function falha(c: Cartao, e: unknown, codigo: string): Cartao {
  if (e instanceof FiltroNaoSuportado) return { ...c, estado: "nao_aplicavel", motivo: { codigo: "filtro_nao_suportado", mensagem: e.message } };
  console.error(`[painel-geral] ${codigo} falhou:`, e instanceof Error ? e.message : e);
  return { ...c, estado: "indisponivel", motivo: MOTIVO_ERRO };
}

function frescorHoras(ate: string | null, agora: Date): number | null {
  if (!ate) return null;
  const t = new Date(ate.length === 10 ? `${ate}T00:00:00-03:00` : ate).getTime();
  return Number.isFinite(t) ? Math.max(0, Math.round(((agora.getTime() - t) / 3_600_000) * 10) / 10) : null;
}

async function cartaoMetrica(org: string, codigo: string, params: ParamsPainel, papel: string, agora: Date): Promise<Cartao> {
  const d = definicao(codigo) as DefinicaoMetrica;
  const base = esqueleto(codigo, "metrica", codigo, d.nome, d.unidade, d.fonte, d.naoInclui ?? null);
  const e = entrada(`metrica-${codigo}`);
  if (!e || !podeVer(e.acesso, papel)) return { ...base, motivo: MOTIVO_SEM_ACESSO };
  const snapshot = d.tipo === "SNAPSHOT";
  const ped = lerPedido(codigo, consultaDe(params), agora)!;
  const drill = drillDe(codigo, qs(params, snapshot));
  try {
    if (!snapshot && ped.p.de && ped.p.ate && ped.p.ate.getTime() <= ped.p.de.getTime()) {
      return { ...base, drill, motivo: { codigo: "janela_antes_do_piso", mensagem: `A fonte só é confiável a partir de ${dataBR(d.explorar.piso?.toISOString() ?? "")}: a janela pedida termina antes disso.` } };
    }
    const piso = d.explorar.piso;
    const comparar = async () => {
      if (snapshot) return null;
      const ant = janelaAnterior(ped.janela, ped.periodo, agora);
      if (piso && ant.de.getTime() < piso.getTime()) return null;
      try {
        const v = (await medir(org, codigo, { ...ped.p, de: ant.de, ate: ant.ate })).valor;
        return { v, rotulo: ant.rotulo };
      } catch { return null; }
    };
    const [m, ant] = await Promise.all([medirDetalhado(org, codigo, ped.p), comparar()]);
    const cobertura: Cobertura = {
      pisoDeclarado: piso ? piso.toISOString().slice(0, 10) : null,
      pisoAplicado: ped.pisoAplicado ? ped.pisoAplicado.toISOString().slice(0, 10) : null,
      observadoDe: m.observadoDe, observadoAte: m.observadoAte, frescorHoras: frescorHoras(m.observadoAte, agora),
      preenchimento: m.preenchimento,
    };
    const pr = m.preenchimento;
    let estado: Cartao["estado"] = "disponivel";
    let motivo: Motivo | null = null;
    if (pr?.modo === "ausencia" && pr.universo === 0) {
      estado = "indisponivel";
      motivo = { codigo: "sem_dado_na_fonte", mensagem: "A fonte não tem nenhuma linha nesta janela: competência ainda não fechada é ausência de dado, não zero." };
    } else if (pr?.modo === "ausencia" && pr.preenchido === 0) {
      estado = "indisponivel";
      motivo = { codigo: "sem_dado_na_fonte", mensagem: `A fonte não tem nenhuma linha classificada como ${pr.rotulo}: não há o que somar, e zero seria mentira.` };
    } else if (pr?.modo !== "ausencia" && pr && pr.universo > 0 && pr.preenchido === 0) {
      estado = "indisponivel";
      motivo = { codigo: "sem_dado_na_fonte", mensagem: `Nenhum dos ${pr.universo} registros tem o dado (${pr.rotulo}): o número não pode ser calculado, e zero seria mentira.` };
    } else if (pr?.modo !== "ausencia" && pr && pr.preenchido < pr.universo) {
      estado = "parcial";
      motivo = { codigo: "preenchimento_parcial", mensagem: `Só ${pr.preenchido} de ${pr.universo} têm o dado (${pr.rotulo}). O valor soma apenas esses.` };
    } else if (ped.pisoAplicado) {
      estado = "parcial";
      motivo = { codigo: "janela_encurtada_pelo_piso", mensagem: `A fonte só é confiável a partir de ${dataBR(ped.pisoAplicado.toISOString())}: a janela começa nessa data.` };
    }
    if (estado === "indisponivel") return { ...base, estado, motivo, drill, cobertura };
    const variacao = ant && ant.v !== 0 ? (m.valor - ant.v) / Math.abs(ant.v) : null;
    return { ...base, estado, motivo, drill, cobertura, valor: m.valor, registros: m.registros, comparacao: ant ? { rotulo: ant.rotulo, valor: ant.v, variacao } : null };
  } catch (err) {
    return falha({ ...base, drill }, err, codigo);
  }
}

async function cartaoRazao(org: string, codigo: string, params: ParamsPainel, papel: string, agora: Date): Promise<Cartao> {
  const def = razao(codigo)!;
  const base = esqueleto(codigo, "razao", codigo, def.nome, def.unidade, def.fonte, def.naoInclui);
  const operandos = [...new Set([...def.numerador, ...def.denominador].map((o) => o.codigo))];
  if (operandos.some((c) => { const e = entrada(`metrica-${c}`); return !e || !podeVer(e.acesso, papel); })) return { ...base, motivo: MOTIVO_SEM_ACESSO };
  let r: MedicaoRazao;
  try { r = await medirRazao(org, codigo, { periodo: params.periodo, familia: params.familia, testes: params.testes }, agora); }
  catch (err) { return falha(base, err, codigo); }

  const alvo = (def.drillDe === "numerador" ? def.numerador : def.denominador)[0].codigo;
  const op = r.operandos[alvo];
  const snapshot = definicao(alvo)!.tipo === "SNAPSHOT";
  const drill = drillDe(alvo, qs(params, snapshot, op.deComum ? { de: dia(op.deComum) } : {}));
  const comum = Object.values(r.operandos).find((o) => o.deComum)?.deComum ?? Object.values(r.operandos).find((o) => o.pisoAplicado)?.pisoAplicado ?? null;
  const cobertura: Cobertura = {
    pisoDeclarado: definicao(alvo)!.explorar.piso?.toISOString().slice(0, 10) ?? null,
    pisoAplicado: comum ? comum.toISOString().slice(0, 10) : null,
    observadoDe: op.medicao.observadoDe, observadoAte: op.medicao.observadoAte,
    frescorHoras: frescorHoras(op.medicao.observadoAte, agora), preenchimento: op.medicao.preenchimento,
  };
  const ingredientes = { numerador: r.numerador, denominador: r.denominador, amostraMinima: def.amostraMinima, drillDe: def.drillDe };
  const comBase = { ...base, drill, cobertura, razao: ingredientes };
  if (r.valor === null) {
    const motivo: Motivo = r.motivo === "amostra_pequena"
      ? { codigo: "amostra_pequena", mensagem: `Amostra de ${r.amostra} no denominador, abaixo do mínimo de ${def.amostraMinima}: a razão não é exibida.` }
      : { codigo: "sem_denominador", mensagem: "O denominador é zero ou não existe na janela: a razão não é calculável (não é 0%)." };
    return { ...comBase, estado: "indisponivel", motivo };
  }
  const parcial = comum !== null;
  return {
    ...comBase, estado: parcial ? "parcial" : "disponivel", valor: r.valor, registros: r.amostra,
    motivo: parcial ? { codigo: "janela_encurtada_pelo_piso", mensagem: `Numerador e denominador usam a mesma janela, que começa em ${dataBR(comum.toISOString())} (início da fonte mais recente).` } : null,
  };
}

const cartao = (org: string, codigo: string, params: ParamsPainel, papel: string, agora: Date) =>
  razao(codigo) ? cartaoRazao(org, codigo, params, papel, agora) : cartaoMetrica(org, codigo, params, papel, agora);

function semaforo<T extends BlocoBase>(b: Omit<T, "estado" | "motivo">, cartoes: Cartao[]): T {
  const ok = cartoes.filter((c) => c.estado === "disponivel").length;
  const algum = cartoes.filter((c) => c.estado === "parcial").length;
  const estado: EstadoBloco = ok === cartoes.length ? "disponivel" : ok + algum === 0 ? "indisponivel" : "parcial";
  const motivo = estado === "indisponivel" ? (cartoes.find((c) => c.motivo)?.motivo ?? MOTIVO_ERRO) : null;
  return { ...b, estado, motivo } as T;
}

async function blocoCartoes(org: string, titulo: string, codigos: readonly string[], params: ParamsPainel, papel: string, agora: Date): Promise<BlocoCartoes> {
  const r = await Promise.allSettled(codigos.map((c) => cartao(org, c, params, papel, agora)));
  const cartoes = r.map((x, i) => x.status === "fulfilled" ? x.value : falha(esqueleto(codigos[i], razao(codigos[i]) ? "razao" : "metrica", codigos[i], codigos[i], "BRL", "", null), x.reason, codigos[i]));
  return semaforo<BlocoCartoes>({ titulo, cartoes }, cartoes);
}

/** A família White Label tem MRR sem recorrência confirmada: o número fica no MRR e o painel diz isso. */
async function avisosRecorrencia(org: string, params: ParamsPainel, papel: string): Promise<AvisoRecorrencia[]> {
  if (params.familia && params.familia !== "WHITE_LABEL") return [];
  const e = entrada("metrica-mrr_atual");
  if (!e || !podeVer(e.acesso, papel)) return [];
  const valor = (await medir(org, "mrr_atual", { familia: "WHITE_LABEL", incluirTestes: params.testes })).valor;
  if (!(valor > 0)) return [];
  const linhas = await db.execute<{ fam: string; comp: string; ultima: string }>(sql`
    SELECT COALESCE(NULLIF(service_family, ''), 'UNKNOWN') AS fam, to_char(competencia, 'YYYY-MM-DD') AS comp,
           to_char(max(competencia) OVER (), 'YYYY-MM-DD') AS ultima
      FROM cliente_receita_mensal
     WHERE organizacao_id = ${org}::uuid AND revenue_nature = 'MRR' AND valor > 0
     GROUP BY 1, competencia`);
  const wl = new Set(linhas.filter((l) => l.fam === "WHITE_LABEL").map((l) => l.comp));
  const referencia = linhas.filter((l) => l.fam === "PABX").length;
  let seq = 0;
  if (linhas[0]) {
    let [a, m] = linhas[0].ultima.split("-").map(Number);
    while (wl.has(`${a}-${String(m).padStart(2, "0")}-01`)) { seq++; m--; if (m === 0) { m = 12; a--; } }
  }
  if (seq >= RECORRENCIA_MINIMA_COMPETENCIAS) return [];
  const brl = valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return [{
    codigo: "white_label_sem_recorrencia", familia: "WHITE_LABEL", valor,
    competenciasComMrr: wl.size, competenciasReferencia: referencia, sequenciaAteUltima: seq, sequenciaMinima: RECORRENCIA_MINIMA_COMPETENCIAS,
    mensagem: `${brl} do MRR atual de White Label é faturamento sem recorrência confirmada: a família tem MRR em ${wl.size} de ${referencia} competências (o PABX tem em ${referencia}) e em ${seq} seguidas até a última; recorrente pede ${RECORRENCIA_MINIMA_COMPETENCIAS}. O valor continua dentro do MRR.`,
    drill: drillDe("mrr_atual", qs(params, true, { familia: "WHITE_LABEL" })),
  }];
}

async function blocoReceita(org: string, params: ParamsPainel, papel: string, agora: Date): Promise<BlocoReceita> {
  const [b, av] = await Promise.all([
    blocoCartoes(org, "Receita", LAYOUT.receita, params, papel, agora),
    avisosRecorrencia(org, params, papel).catch((e) => { console.error("[painel-geral] aviso de recorrência falhou:", e instanceof Error ? e.message : e); return []; }),
  ]);
  return { ...b, avisos: av };
}

const semGrafico = (metrica: string, motivo: Motivo) => ({ titulo: "", estado: "indisponivel" as const, motivo, metrica });

async function blocoEvolucao(org: string, params: ParamsPainel, papel: string, agora: Date): Promise<BlocoEvolucao> {
  const vazio: BlocoEvolucao = { ...semGrafico(METRICA_DAS_SERIES, MOTIVO_ERRO), titulo: "Evolução do faturamento", periodo: params.serie, granularidade: null, pontos: [], pisoAplicado: null };
  const e = entrada(`metrica-${METRICA_DAS_SERIES}`);
  if (!e || !podeVer(e.acesso, papel)) return { ...vazio, motivo: MOTIVO_SEM_ACESSO };
  try {
    const q = { ...params, periodo: params.serie };
    const ped = lerPedido(METRICA_DAS_SERIES, consultaDe(q), agora)!;
    const x = await explorar(org, METRICA_DAS_SERIES, ped.p, {}, 1, 5);
    if (!x?.serie) return { ...vazio, motivo: { codigo: "sem_dado_na_fonte", mensagem: "A fonte não devolveu série para esta janela." } };
    const g = x.serie.granularidade;
    const passo = (inicio: string) => {
      const [a, m, d] = inicio.split("-").map(Number);
      return dia(g === "mes" ? diaSP(a, m + 1, 1) : diaSP(a, m, d + 1));
    };
    const pontos = x.serie.pontos.map((p) => ({ ...p, drill: drillDe(METRICA_DAS_SERIES, qs(q, false, { de: p.inicio, ate: passo(p.inicio) })) }));
    const ped0: BlocoEvolucao = {
      ...vazio, estado: pontos.length ? (ped.pisoAplicado ? "parcial" : "disponivel") : "indisponivel", granularidade: g, pontos,
      pisoAplicado: ped.pisoAplicado ? ped.pisoAplicado.toISOString().slice(0, 10) : null,
      motivo: pontos.length ? (ped.pisoAplicado ? { codigo: "janela_encurtada_pelo_piso", mensagem: `A série começa em ${dataBR(ped.pisoAplicado.toISOString())}, o início confiável da fonte.` } : null)
        : { codigo: "sem_dado_na_fonte", mensagem: "Nenhuma competência com faturamento nesta janela." },
    };
    return ped0;
  } catch (err) {
    return { ...vazio, ...(err instanceof FiltroNaoSuportado ? { estado: "indisponivel" as const, motivo: { codigo: "filtro_nao_suportado" as const, mensagem: err.message } } : {}) };
  }
}

async function blocoComposicao(org: string, params: ParamsPainel, papel: string, agora: Date): Promise<BlocoComposicao> {
  const vazio: BlocoComposicao = { ...semGrafico(METRICA_DAS_SERIES, MOTIVO_ERRO), titulo: "Composição do faturamento", total: null, dimensoes: [] };
  const e = entrada(`metrica-${METRICA_DAS_SERIES}`);
  if (!e || !podeVer(e.acesso, papel)) return { ...vazio, motivo: MOTIVO_SEM_ACESSO };
  try {
    const ped = lerPedido(METRICA_DAS_SERIES, consultaDe(params), agora)!;
    const x = await explorar(org, METRICA_DAS_SERIES, ped.p, {}, 1, 5);
    if (!x) return vazio;
    const dimensoes = x.dimensoes.filter((d) => d.chave === "familia" || d.chave === "natureza").map((d) => ({
      chave: d.chave, rotulo: d.rotulo,
      itens: d.itens.map((i) => ({ chave: i.chave, valor: i.valor, registros: i.registros, drill: drillDe(METRICA_DAS_SERIES, qs(params, false, { dim: d.chave, valorDim: i.chave })) })),
      outros: d.outros ? { valor: d.outros.valor, registros: d.outros.registros } : null,
    }));
    return { ...vazio, total: x.total, dimensoes, estado: x.registrosTotal ? "disponivel" : "indisponivel", motivo: x.registrosTotal ? null : { codigo: "sem_dado_na_fonte", mensagem: "Nenhuma linha de faturamento nesta janela." } };
  } catch (err) {
    return err instanceof FiltroNaoSuportado ? { ...vazio, motivo: { codigo: "filtro_nao_suportado", mensagem: err.message } } : vazio;
  }
}

async function blocoAlertas(org: string, params: ParamsPainel, papel: string, agora: Date): Promise<BlocoAlertas> {
  const memo = new Map<string, Promise<Cartao>>();
  const obter = (codigo: string, periodo: string) => {
    const k = `${codigo}|${periodo}`;
    if (!memo.has(k)) memo.set(k, cartaoMetrica(org, codigo, { periodo, testes: params.testes, serie: params.serie }, papel, agora));
    return memo.get(k)!;
  };
  const closersAtivos = async () => {
    const [r] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM usuarios WHERE organizacao_id = ${org}::uuid AND ativo = true AND role IN ('closer', 'vendedor')`);
    return Number(r?.n ?? 0);
  };
  const alertas = await avaliarAlertas({ obter, closersAtivos, organizacaoId: org, incluirTestes: params.testes, agora });
  const verificaveis = alertas.filter((a) => a.situacao !== "indisponivel").length;
  const estado: EstadoBloco = verificaveis === alertas.length ? "disponivel" : verificaveis === 0 ? "indisponivel" : "parcial";
  return { titulo: "Alertas", estado, motivo: estado === "indisponivel" ? (alertas.find((a) => a.motivo)?.motivo ?? MOTIVO_ERRO) : null, versaoLimiares: VERSAO_LIMIARES, alertas };
}

export async function montarPainelGeral(organizacaoId: string, params: ParamsPainel, papel: string, agora = new Date()): Promise<PainelGeral> {
  const [receita, carteira, aquisicao, conversao, pipeline, metas, evolucao, composicao, alertas] = await Promise.all([
    blocoReceita(organizacaoId, params, papel, agora),
    blocoCartoes(organizacaoId, "Carteira", LAYOUT.carteira, params, papel, agora),
    blocoCartoes(organizacaoId, "Aquisição", LAYOUT.aquisicao, params, papel, agora),
    blocoCartoes(organizacaoId, "Conversão", LAYOUT.conversao, params, papel, agora),
    blocoCartoes(organizacaoId, "Pipeline", LAYOUT.pipeline, params, papel, agora),
    blocoCartoes(organizacaoId, "Metas", LAYOUT.metas, params, papel, agora),
    blocoEvolucao(organizacaoId, params, papel, agora),
    blocoComposicao(organizacaoId, params, papel, agora),
    blocoAlertas(organizacaoId, params, papel, agora),
  ]);
  return { organizacaoId, geradoEm: agora.toISOString(), params, blocos: { receita, carteira, aquisicao, conversao, pipeline, evolucao, metas, composicao, alertas }, lacunas: LACUNAS };
}
