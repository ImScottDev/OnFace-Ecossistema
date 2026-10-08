/**
 * Cliente único do NEXO no navegador. Toda superfície com chat ou botão de IA
 * (casca ⌘J, Atividades, Atendimento, Clientes, CS) fala com o servidor por
 * aqui; nenhuma tem resposta própria. Só tipos e fetch: não importa nada de
 * servidor.
 */
export interface PropostaNexo {
  kind: "criar_tarefa" | "abrir_tela";
  rotulo: string;
  titulo?: string;
  venceEm?: string;
  href?: string;
}

export interface RespostaDoNexo {
  conversaId: string;
  configurada: boolean;
  falhou?: boolean;
  runId?: string;
  mensagem: { de: "oni" | "eu"; texto: string };
  propostas?: PropostaNexo[];
}

export type AnaliseConversa =
  | { tipo: "resumo"; runId: string; resumo: string; pedidos: string[]; proximoPasso: string }
  | { tipo: "sentimento"; runId: string; tom: string; motivo: string; sinais: string[] }
  | { tipo: "sugestao"; runId: string; resposta: string };

async function pedir<T>(url: string, corpo?: unknown): Promise<T> {
  const r = await fetch(url, {
    credentials: "same-origin",
    ...(corpo === undefined ? {} : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) }),
  });
  const json = await r.json().catch(() => null);
  if (!r.ok) throw new Error(json?.error || `HTTP ${r.status}`);
  return json as T;
}

export const novaConversaId = (): string => crypto.randomUUID();

/** Pergunta ao NEXO. Lança Error com o motivo quando o servidor recusa; falha do provedor volta com `falhou`. */
export function perguntarAoNexo(p: { conversaId: string; pergunta: string; rota: string; area: string }): Promise<RespostaDoNexo> {
  return pedir<RespostaDoNexo>("/api/nexo/perguntar", p);
}

export function analisarConversaDoAtendimento(contatoId: string, tipo: "resumo" | "sentimento" | "sugestao"): Promise<AnaliseConversa> {
  return pedir<AnaliseConversa>("/api/nexo/conversa/analisar", { contatoId, tipo });
}

export function conversasRecentes(): Promise<{ conversas: { id: string; titulo: string; quando: string }[] }> {
  return pedir("/api/nexo/painel");
}

export function mensagensDaConversa(id: string): Promise<{ mensagens: { de: "oni" | "eu"; texto: string }[] }> {
  return pedir(`/api/nexo/conversas/${id}`);
}

/** Rota que a proposta abre. `criar_tarefa` cai em Atividades com o formulário único já preenchido. */
export function destinoDaProposta(p: PropostaNexo): string {
  if (p.kind === "abrir_tela") return p.href ?? "/";
  const qs = new URLSearchParams({ nova: p.titulo ?? "" });
  if (p.venceEm) qs.set("data", p.venceEm.slice(0, 10));
  return `/tarefas?${qs.toString()}`;
}
