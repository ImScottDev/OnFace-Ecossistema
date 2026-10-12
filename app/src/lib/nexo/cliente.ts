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
  executadas?: { ferramenta: string; resumo: string; href: string | null }[];
  confirmacoes?: { rotulo: string; runId: string; passo: number; ferramenta: string }[];
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

/** Entrada única do NEXO: qualquer tela abre a mesma conversa da casca. */
export function abrirNexo(pergunta = ""): void {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("onface:nexo-abrir", { detail: { pergunta } }));
}

/** Links internos citados pelo NEXO continuam clicáveis sem interpretar HTML do modelo. */
export function partesComLinks(texto: string): { texto: string; href?: string }[] {
  const partes: { texto: string; href?: string }[] = [];
  const links = /\[([^\]]{1,80})\]\((\/(?!\/)[^\s)]*)\)/g;
  let inicio = 0;
  for (const achado of texto.matchAll(links)) {
    if (achado.index > inicio) partes.push({ texto: texto.slice(inicio, achado.index) });
    partes.push({ texto: achado[1], href: achado[2] });
    inicio = achado.index + achado[0].length;
  }
  if (inicio < texto.length) partes.push({ texto: texto.slice(inicio) });
  return partes;
}

/** Pergunta ao NEXO. Lança Error com o motivo quando o servidor recusa; falha do provedor volta com `falhou`. */
export async function perguntarAoNexo(p: { conversaId: string; pergunta: string; rota: string; area: string }): Promise<RespostaDoNexo> {
  const r = await pedir<RespostaDoNexo>("/api/nexo/perguntar", p);
  if (r.executadas?.length) avisarQueMudou();
  return r;
}

/** As telas abertas releem o servidor depois que o NEXO escreveu (a casca escuta e faz router.refresh()). */
export function avisarQueMudou(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("onface:dados-mudaram"));
}

/** Confirmar no chat. O servidor relê a ação do banco; aqui só vai o run e o passo. */
export async function confirmarAcaoDoNexo(c: { runId: string; passo: number }): Promise<{ ok: boolean; texto: string; href?: string | null }> {
  try {
    const r = await pedir<{ ok: boolean; texto: string; href?: string | null }>("/api/nexo/acoes/confirmar", c);
    if (r.ok) avisarQueMudou();
    return r;
  } catch (e) { return { ok: false, texto: e instanceof Error ? e.message : String(e) }; }
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

export interface BotaoNexo { rotulo: string; href?: string; confirmar?: { runId: string; passo: number } }

/**
 * A resposta do servidor vira texto limpo + botões, igual em toda superfície:
 * links markdown `[rótulo](/rota)` saem do texto e viram botão de abrir; o que o
 * NEXO executou ganha o atalho do registro; o que aguarda confirmação vira Confirmar.
 */
export function botoesDaResposta(d: RespostaDoNexo): { texto: string; botoes: BotaoNexo[] } {
  const botoes: BotaoNexo[] = [];
  const vistos = new Set<string>();
  const curto = (t: string) => (t.length > 40 ? t.slice(0, 40) + "..." : t);
  const add = (b: BotaoNexo) => { const k = b.href ?? JSON.stringify(b.confirmar); if (!vistos.has(k)) { vistos.add(k); botoes.push(b); } };
  for (const c of d.confirmacoes ?? []) add({ rotulo: `Confirmar: ${c.rotulo}`, confirmar: { runId: c.runId, passo: c.passo } });
  for (const e of d.executadas ?? []) if (e.href) add({ rotulo: "Abrir: " + curto(e.resumo), href: e.href });
  for (const p of d.propostas ?? []) add({ rotulo: p.rotulo, href: destinoDaProposta(p) });
  const texto = d.mensagem.texto.replace(/\[([^\]]+)\]\((\/[^)\s]*)\)/g, (_m, rotulo: string, href: string) => {
    if (botoes.length < 6) add({ rotulo: curto(rotulo), href });
    return rotulo;
  });
  return { texto, botoes };
}
