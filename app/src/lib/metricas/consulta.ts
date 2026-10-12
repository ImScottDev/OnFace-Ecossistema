/**
 * Da querystring ao recorte, num lugar só. A tela, a rota JSON e a exportação
 * leem os mesmos parâmetros por aqui: é o que garante que "o que eu vejo" e
 * "o que eu baixo" são o mesmo conjunto de registros.
 */
import { definicao, medir, type Periodo, type DefinicaoMetrica } from "./catalogo";
import { explorar, type Selecao, type Exploracao } from "./explorar";
import { PERIODO_RE, janelaDoPeriodo, janelaAnterior, diaSP, type Janela } from "./janela";
import { familiaValida } from "./recorte";

export interface PedidoMetrica {
  codigo: string;
  periodo: string;
  p: Periodo;
  selecao: Selecao;
  pagina: number;
  tamanho: number;
  janela: Janela;
  /** O piso confiável da fonte encurtou a janela pedida. */
  pisoAplicado: Date | null;
}

const dia = (v: string | null | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? diaSP(+v.slice(0, 4), +v.slice(5, 7), +v.slice(8, 10)) : undefined);

export function lerPedido(codigo: string, q: URLSearchParams, agora = new Date()): PedidoMetrica | null {
  const d = definicao(codigo);
  if (!d) return null;
  const bruto = q.get("periodo") ?? "mes_atual";
  const periodo = PERIODO_RE.test(bruto) ? bruto : "mes_atual";
  let janela = janelaDoPeriodo(periodo, agora);
  let pisoAplicado: Date | null = null;
  const piso = d.explorar.piso;
  if (d.tipo === "EVENT" && piso && janela.de.getTime() < piso.getTime()) {
    pisoAplicado = piso;
    janela = { ...janela, de: piso };
  }
  const p: Periodo = {
    de: d.tipo === "SNAPSHOT" ? undefined : janela.de,
    ate: d.tipo === "SNAPSHOT" ? undefined : janela.ate,
    familia: familiaValida(q.get("familia")),
    incluirTestes: q.get("testes") === "1",
  };
  const selecao: Selecao = {
    q: q.get("q")?.slice(0, 80) || undefined,
    dim: q.get("dim") || undefined,
    valorDim: q.get("valorDim") ?? undefined,
    ordem: q.get("ordem") || undefined,
    sentido: q.get("sentido") === "asc" ? "asc" : "desc",
    // Seleção de intervalo no gráfico: só vale dentro da janela.
    de: dia(q.get("de")),
    ate: dia(q.get("ate")),
  };
  return {
    codigo, periodo, p, selecao, janela, pisoAplicado,
    pagina: Math.max(1, parseInt(q.get("pagina") ?? "1") || 1),
    tamanho: Math.min(200, Math.max(5, parseInt(q.get("tamanho") ?? "25") || 25)),
  };
}

export interface RespostaMetrica {
  metrica: Pick<DefinicaoMetrica, "codigo" | "nome" | "tipo" | "unidade" | "descricao" | "fonte" | "naoInclui" | "agregacao"> & {
    filtros: DefinicaoMetrica["filtros"];
    dimensoes: DefinicaoMetrica["explorar"]["dimensoes"];
  };
  janela: { de: string; ate: string; rotulo: string; parcial: boolean } | null;
  pisoAplicado: string | null;
  comparacao: { rotulo: string; valor: number; variacao: number | null } | null;
  exploracao: Exploracao;
}

export async function responder(organizacaoId: string, pedido: PedidoMetrica, agora = new Date()): Promise<RespostaMetrica | null> {
  const d = definicao(pedido.codigo);
  if (!d) return null;
  const exploracao = await explorar(organizacaoId, pedido.codigo, pedido.p, pedido.selecao, pedido.pagina, pedido.tamanho);
  if (!exploracao) return null;
  const snapshot = d.tipo === "SNAPSHOT";
  let comparacao: RespostaMetrica["comparacao"] = null;
  if (!snapshot) {
    const ant = janelaAnterior(pedido.janela, pedido.periodo, agora);
    // Janela anterior que cai antes do piso confiável não é comparável: sem número, sem seta.
    if (!d.explorar.piso || ant.de.getTime() >= d.explorar.piso.getTime()) {
      const v = (await medir(organizacaoId, pedido.codigo, { ...pedido.p, de: ant.de, ate: ant.ate })).valor;
      comparacao = { rotulo: ant.rotulo, valor: v, variacao: v === 0 ? null : (exploracao.total - v) / Math.abs(v) };
    }
  }
  return {
    metrica: {
      codigo: d.codigo, nome: d.nome, tipo: d.tipo, unidade: d.unidade, descricao: d.descricao, fonte: d.fonte,
      naoInclui: d.naoInclui, agregacao: d.agregacao, filtros: d.filtros, dimensoes: d.explorar.dimensoes,
    },
    janela: snapshot ? null : {
      de: pedido.janela.de.toISOString(), ate: pedido.janela.ate.toISOString(),
      rotulo: pedido.janela.rotulo, parcial: pedido.janela.parcial,
    },
    pisoAplicado: pedido.pisoAplicado?.toISOString() ?? null,
    comparacao,
    exploracao,
  };
}
