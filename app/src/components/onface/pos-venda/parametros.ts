/**
 * O recorte do board vive na URL, e só nela.
 *
 * Todo filtro é um `searchParam`: link compartilhável, botão voltar que
 * funciona, F5 que não perde o que a pessoa escolheu. Estado local de filtro é
 * o que faz a tela de hoje parecer quebrada quando se recarrega.
 *
 * Este arquivo é a única fonte de "como a URL vira filtro e o filtro vira
 * URL". Servidor e cliente importam daqui, então os dois nunca discordam.
 */
import type { EstadoDoProjeto, Familia, FiltrosDoBoard, TipoDeProjeto } from "@/lib/pos-venda/contrato";

export const ROTA_DO_BOARD = "/pos-vendas";

export type ParamsBrutos = Record<string, string | string[] | undefined>;

const FAMILIAS: readonly Familia[] = ["CALLFACE_AI", "PABX", "WHITE_LABEL"];
const ESTADOS: readonly EstadoDoProjeto[] = ["NAO_INICIADO", "EM_ANDAMENTO", "AGUARDANDO", "EM_VALIDACAO", "CONCLUIDO", "CANCELADO"];

/**
 * `?aba=` escolhe a jornada, e os nomes curtos vêm de antes: `/clientes/implantacao`
 * redireciona para `/pos-vendas?aba=imp` desde 01/10, e esse endereço continua
 * circulando. Mudar a chave aqui quebraria o redirect calado.
 *
 * Sem `?aba=` o board abre com as duas jornadas e as três famílias — é a visão
 * que cobre tudo, e é isso que a trava `entrega-fase-cobre-checklist` protege.
 */
const ABAS: Record<string, TipoDeProjeto> = {
  onb: "ONBOARDING",
  imp: "IMPLEMENTATION",
};

const abaDoTipo = (t: TipoDeProjeto): string => (t === "IMPLEMENTATION" ? "imp" : "onb");

/**
 * As abas da tela do projeto.
 *
 * Moram AQUI, e não junto do componente, porque a página é Server Component e
 * valida o `?aba=` antes de renderizar. Enquanto isto vivia em
 * `ProjetoTela.tsx` — que é `"use client"` — o Next recusava a chamada com
 * "Attempted to call abaValida() from the server", e TODO projeto abria em
 * erro. Typecheck não pega esta classe de defeito; só o navegador pega.
 */
export const ABAS_DO_PROJETO = ["visao", "tarefas", "levantamento", "materiais", "tempo"] as const;
export type AbaDoProjeto = (typeof ABAS_DO_PROJETO)[number];

/** Valor desconhecido cai na visão geral, nunca em erro: link velho não pode quebrar a tela. */
export function abaDoProjeto(v: string | null | undefined): AbaDoProjeto {
  return ABAS_DO_PROJETO.includes(v as AbaDoProjeto) ? (v as AbaDoProjeto) : "visao";
}

export const RECORTES = [
  { valor: "atrasados", rotulo: "Atrasados" },
  { valor: "aguardando_cliente", rotulo: "Aguardando cliente" },
  { valor: "sem_responsavel", rotulo: "Sem responsável" },
  { valor: "concluidos_mes", rotulo: "Concluídos no mês" },
] as const;

const um = (v: string | string[] | undefined): string | null => {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() ? s.trim() : null;
};

/** Valor desconhecido na URL vira "sem filtro", nunca erro: link velho não pode quebrar a tela. */
export function lerFiltros(p: ParamsBrutos): FiltrosDoBoard {
  const familia = um(p.familia);
  const estado = um(p.estado);
  const recorte = um(p.recorte);
  return {
    tipo: ABAS[um(p.aba) ?? ""] ?? null,
    familia: FAMILIAS.includes(familia as Familia) ? (familia as Familia) : null,
    responsavelId: um(p.responsavel),
    estado: ESTADOS.includes(estado as EstadoDoProjeto) ? (estado as EstadoDoProjeto) : null,
    recorte: RECORTES.some((r) => r.valor === recorte) ? recorte : null,
    busca: um(p.q)?.slice(0, 80) ?? null,
  };
}

/** O filtro vira URL. `mudar` sobrescreve; `null` remove o parâmetro. */
export function hrefDoBoard(atual: FiltrosDoBoard, mudar: Partial<FiltrosDoBoard> = {}): string {
  const f = { ...atual, ...mudar };
  const q = new URLSearchParams();
  if (f.tipo) q.set("aba", abaDoTipo(f.tipo));
  if (f.familia) q.set("familia", f.familia);
  if (f.estado) q.set("estado", f.estado);
  if (f.recorte) q.set("recorte", f.recorte);
  if (f.responsavelId) q.set("responsavel", f.responsavelId);
  if (f.busca) q.set("q", f.busca);
  const s = q.toString();
  return s ? `${ROTA_DO_BOARD}?${s}` : ROTA_DO_BOARD;
}

export function temFiltro(f: FiltrosDoBoard): boolean {
  return Boolean(f.estado || f.recorte || f.responsavelId || f.busca);
}
