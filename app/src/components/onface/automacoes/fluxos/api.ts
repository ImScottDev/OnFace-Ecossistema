/* Chamadas do construtor de automações às rotas Hono de
 * api-server/routes/automacoes-fluxos.ts. Os tipos são os DTOs de
 * lib/automacoes/grafo.ts: tela e API tipam contra o mesmo contrato
 * (docs/design/construtor-automacoes.md §5). Sem mock: se a rota falha, a
 * tela mostra o erro real. */
import type {
  ConfigFluxo, DetalheExecucao, ExecucaoResumo, FluxoDetalhe, FluxoResumo, GrafoFluxo, OpcoesInspetor,
  PassoExecucao, Pendencia, PedidoExecucao, RegraAntiga, ResultadoEnsaio, TipoEntidade, VersaoResumo,
} from "@/lib/automacoes/grafo";

/** Erro com o status e o corpo da API: o editor decide pela forma (409 de outra aba, 422 com pendências). */
export class ErroApi extends Error {
  constructor(public status: number, message: string, public corpo: Record<string, unknown> = {}) {
    super(message);
  }
}

const BASE = "/api/automacoes/fluxos";

async function chamar<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...resto } = init ?? {};
  let r: Response;
  try {
    r = await fetch(url, {
      ...resto,
      headers: json !== undefined ? { "Content-Type": "application/json", ...resto.headers } : resto.headers,
      body: json !== undefined ? JSON.stringify(json) : resto.body,
    });
  } catch {
    throw new ErroApi(0, "Sem conexão com o servidor. Confira a rede e tente de novo.");
  }
  if (r.status === 204) return undefined as T;
  const corpo = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) {
    const padrao = r.status === 404 ? "Não encontrado." : r.status === 403 ? "Sua função não tem a permissão automation.manage." : "Não foi possível concluir a ação.";
    throw new ErroApi(r.status, typeof corpo.error === "string" ? corpo.error : padrao, corpo);
  }
  return corpo as T;
}

export const apiFluxos = {
  listar: () => chamar<{ fluxos: FluxoResumo[]; pastas: string[]; regrasAntigas: RegraAntiga[] }>(BASE),
  opcoes: () => chamar<OpcoesInspetor>(`${BASE}/opcoes`),
  entidades: (tipo: TipoEntidade, busca: string) =>
    chamar<{ id: string; nome: string; detalhe: string | null }[]>(`${BASE}/entidades?tipo=${tipo}&busca=${encodeURIComponent(busca)}`),
  criar: (corpo: { nome: string; pasta?: string | null; grafo?: GrafoFluxo; config?: ConfigFluxo }) =>
    chamar<FluxoDetalhe>(BASE, { method: "POST", json: corpo }),
  detalhe: (id: string) => chamar<FluxoDetalhe>(`${BASE}/${id}`),
  salvarRascunho: (id: string, corpo: { grafo: GrafoFluxo; config: ConfigFluxo; nome?: string; pasta?: string | null; salvoEmBase: string }) =>
    chamar<{ salvoEm: string; pendencias: Pendencia[]; webhookUrl: string | null }>(`${BASE}/${id}/rascunho`, { method: "PUT", json: corpo }),
  publicar: (id: string) => chamar<{ fluxo: FluxoDetalhe; versao: VersaoResumo }>(`${BASE}/${id}/publicar`, { method: "POST" }),
  atualizar: (id: string, corpo: { ativo?: boolean; nome?: string; pasta?: string | null }) =>
    chamar<FluxoDetalhe>(`${BASE}/${id}`, { method: "PATCH", json: corpo }),
  duplicar: (id: string) => chamar<FluxoDetalhe>(`${BASE}/${id}/duplicar`, { method: "POST" }),
  excluir: (id: string) => chamar<void>(`${BASE}/${id}`, { method: "DELETE" }),
  versoes: (id: string) => chamar<VersaoResumo[]>(`${BASE}/${id}/versoes`),
  versao: (id: string, versaoId: string) => chamar<{ grafo: GrafoFluxo; config: ConfigFluxo; versao: VersaoResumo }>(`${BASE}/${id}/versoes/${versaoId}`),
  restaurar: (id: string, versaoId: string) => chamar<FluxoDetalhe>(`${BASE}/${id}/versoes/${versaoId}/restaurar`, { method: "POST" }),
  ensaiar: (id: string, corpo: PedidoExecucao & { grafo?: GrafoFluxo; config?: ConfigFluxo }) =>
    chamar<ResultadoEnsaio>(`${BASE}/${id}/ensaiar`, { method: "POST", json: corpo }),
  rodar: (id: string, corpo: PedidoExecucao) =>
    chamar<{ execucao: ExecucaoResumo; passos: PassoExecucao[] }>(`${BASE}/${id}/rodar`, { method: "POST", json: corpo }),
  execucoes: (id: string, antes?: string | null) =>
    chamar<{ itens: ExecucaoResumo[]; proximo: string | null }>(`${BASE}/${id}/execucoes${antes ? `?antes=${encodeURIComponent(antes)}` : ""}`),
  execucao: (execId: string) => chamar<DetalheExecucao>(`${BASE}/execucoes/${execId}`),
  cancelarExecucao: (execId: string) => chamar<ExecucaoResumo>(`${BASE}/execucoes/${execId}/cancelar`, { method: "POST" }),
  regenerarWebhook: (id: string) => chamar<{ webhookUrl: string }>(`${BASE}/${id}/webhook/regenerar`, { method: "POST" }),
  migrarRegra: (regraId: string) => chamar<FluxoDetalhe>(`${BASE}/regras/${regraId}/migrar`, { method: "POST" }),
};
