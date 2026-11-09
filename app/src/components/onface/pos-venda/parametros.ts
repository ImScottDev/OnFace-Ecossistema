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
import type { EstadoDoProjeto, Familia, FiltrosDoBoard } from "@/lib/pos-venda/contrato";

export const ROTA_DO_BOARD = "/pos-vendas";

export type ParamsBrutos = Record<string, string | string[] | undefined>;

const FAMILIAS: readonly Familia[] = ["CALLFACE_AI", "PABX", "WHITE_LABEL"];
const ESTADOS: readonly EstadoDoProjeto[] = ["NAO_INICIADO", "EM_ANDAMENTO", "AGUARDANDO", "EM_VALIDACAO", "CONCLUIDO", "CANCELADO"];

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
    tipo: null,
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
