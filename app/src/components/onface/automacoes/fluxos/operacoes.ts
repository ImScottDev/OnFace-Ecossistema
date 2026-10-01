/* Operações puras sobre o grafo que o editor faz: adicionar, ligar, apagar,
 * duplicar. Puras para caber no desfazer (cada uma devolve um grafo novo) e
 * para ter teste sem navegador (operacoes.test.ts). As regras de forma são as
 * de grafo.ts: uma saída liga a um bloco só, nada volta ao gatilho, sem laço. */
import {
  novoNo, proximoIdNo, saidasDoNo,
  type ArestaFluxo, type GrafoFluxo, type NoFluxo, type TipoNo,
} from "@/lib/automacoes/grafo";

const COL = 340;
const LIN = 150;

function proximoIdAresta(grafo: GrafoFluxo): string {
  const max = grafo.arestas.reduce((m, a) => Math.max(m, Number(/^a(\d+)$/.exec(a.id)?.[1] ?? 0)), 0);
  return `a${max + 1}`;
}

/** `destino` alcança `origem` andando pelas arestas? Se sim, ligar origem→destino fecha um laço. */
function alcanca(grafo: GrafoFluxo, de: string, ate: string): boolean {
  const pilha = [de];
  const visto = new Set<string>();
  while (pilha.length) {
    const atual = pilha.pop()!;
    if (atual === ate) return true;
    if (visto.has(atual)) continue;
    visto.add(atual);
    for (const a of grafo.arestas) if (a.origem === atual) pilha.push(a.destino);
  }
  return false;
}

/** Motivo para recusar a ligação, ou null se pode. */
export function motivoNaoLigar(grafo: GrafoFluxo, origem: string, saida: string, destino: string): string | null {
  if (origem === destino) return "Um bloco não liga nele mesmo.";
  const alvo = grafo.nos.find((n) => n.id === destino);
  if (!alvo) return "Bloco de destino não existe.";
  if (alvo.tipo === "gatilho") return "Nada pode ligar de volta ao gatilho.";
  const no = grafo.nos.find((n) => n.id === origem);
  if (!no || !saidasDoNo(no).some((s) => s.id === saida)) return "Essa saída não existe.";
  if (alcanca(grafo, destino, origem)) return "Essa ligação faria o fluxo voltar a um bloco anterior.";
  return null;
}

/** Liga a saída ao destino. Se a saída já levava a outro bloco, troca (cada saída leva a UM bloco). */
export function ligar(grafo: GrafoFluxo, origem: string, saida: string, destino: string): GrafoFluxo {
  if (motivoNaoLigar(grafo, origem, saida, destino)) return grafo;
  const resto = grafo.arestas.filter((a) => !(a.origem === origem && a.saida === saida));
  return { ...grafo, arestas: [...resto, { id: proximoIdAresta(grafo), origem, saida, destino }] };
}

/** Primeira posição livre perto de `alvo` (desce uma linha enquanto houver bloco lá). */
export function posicaoLivre(grafo: GrafoFluxo, alvo: { x: number; y: number }): { x: number; y: number } {
  const p = { ...alvo };
  for (let i = 0; i < 30 && grafo.nos.some((n) => Math.abs(n.posicao.x - p.x) < COL * 0.6 && Math.abs(n.posicao.y - p.y) < LIN * 0.7); i++) {
    p.y += LIN;
  }
  return p;
}

/** Adiciona um bloco. Com `depoisDe`, posiciona à direita da saída e já liga. */
export function adicionarNo(
  grafo: GrafoFluxo,
  tipo: TipoNo,
  opcoes: { posicao?: { x: number; y: number }; depoisDe?: { noId: string; saida: string } } = {},
): { grafo: GrafoFluxo; id: string } {
  const id = proximoIdNo(grafo);
  let posicao = opcoes.posicao ?? { x: 0, y: 0 };
  const origem = opcoes.depoisDe && grafo.nos.find((n) => n.id === opcoes.depoisDe!.noId);
  if (origem) {
    const saidas = saidasDoNo(origem);
    const indice = Math.max(0, saidas.findIndex((s) => s.id === opcoes.depoisDe!.saida));
    const desvio = saidas.length > 1 ? (indice - (saidas.length - 1) / 2) * LIN : 0;
    posicao = posicaoLivre(grafo, { x: origem.posicao.x + COL, y: origem.posicao.y + desvio });
  }
  const no = novoNo(tipo, id, { x: Math.round(posicao.x / 16) * 16, y: Math.round(posicao.y / 16) * 16 });
  let novo: GrafoFluxo = { ...grafo, nos: [...grafo.nos, no] };
  if (origem) novo = ligar(novo, origem.id, opcoes.depoisDe!.saida, id);
  return { grafo: novo, id };
}

/** Apaga blocos (o gatilho nunca) e ligações, com as ligações que ficarem órfãs. */
export function remover(grafo: GrafoFluxo, nos: string[], arestas: string[] = []): GrafoFluxo {
  const saem = new Set(nos.filter((id) => grafo.nos.find((n) => n.id === id)?.tipo !== "gatilho"));
  const tiradas = new Set(arestas);
  if (!saem.size && !tiradas.size) return grafo;
  return {
    ...grafo,
    nos: grafo.nos.filter((n) => !saem.has(n.id)),
    arestas: grafo.arestas.filter((a) => !tiradas.has(a.id) && !saem.has(a.origem) && !saem.has(a.destino)),
  };
}

/** Cópia do bloco ao lado, sem ligações. O gatilho não duplica (só existe um). */
export function duplicar(grafo: GrafoFluxo, noId: string): { grafo: GrafoFluxo; id: string } | null {
  const no = grafo.nos.find((n) => n.id === noId);
  if (!no || no.tipo === "gatilho") return null;
  const id = proximoIdNo(grafo);
  const copia: NoFluxo = {
    ...structuredClone(no), id,
    posicao: posicaoLivre(grafo, { x: no.posicao.x + 32, y: no.posicao.y + LIN }),
  };
  return { grafo: { ...grafo, nos: [...grafo.nos, copia] }, id };
}

/** Troca um bloco e descarta ligações de saídas que ele deixou de ter (rota apagada, saída de erro desligada). */
export function trocarNo(grafo: GrafoFluxo, noId: string, fn: (no: NoFluxo) => NoFluxo): GrafoFluxo {
  let alterado: NoFluxo | null = null;
  const nos = grafo.nos.map((n) => (n.id === noId ? (alterado = fn(n)) : n));
  if (!alterado) return grafo;
  const validas = new Set(saidasDoNo(alterado).map((s) => s.id));
  const arestas: ArestaFluxo[] = grafo.arestas.filter((a) => a.origem !== noId || validas.has(a.saida));
  return { ...grafo, nos, arestas };
}

/** Ids dos blocos ANTES de `noId` em algum caminho — o seletor só oferece variáveis deles. */
export function anteriores(grafo: GrafoFluxo, noId: string): string[] {
  const pais = new Map<string, string[]>();
  for (const a of grafo.arestas) pais.set(a.destino, [...(pais.get(a.destino) ?? []), a.origem]);
  const visto = new Set<string>();
  const pilha = [...(pais.get(noId) ?? [])];
  while (pilha.length) {
    const id = pilha.pop()!;
    if (visto.has(id)) continue;
    visto.add(id);
    pilha.push(...(pais.get(id) ?? []));
  }
  return grafo.nos.filter((n) => visto.has(n.id)).map((n) => n.id);
}
