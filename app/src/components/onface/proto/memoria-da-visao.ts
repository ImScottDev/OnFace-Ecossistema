/**
 * Voltar devolve a tela como ela estava.
 *
 * O que se perdia (medido em 20/10/2026, Pré-vendas → "Abrir lead" → voltar):
 * a ficha aberta fechava, e a rolagem da coluna voltava a zero — com 167
 * cartões na coluna, quem voltava perdia o lugar.
 *
 * O recorte (view, responsável, busca) já sobrevive porque vive na URL, e é lá
 * que ele deve viver: é o que faz F5 e link compartilhado devolverem o mesmo
 * quadro. Rolagem e gaveta aberta são outra natureza — são de QUEM está
 * olhando, não do que se vê, e sujar a URL com elas tornaria todo link
 * compartilhado uma foto da sessão alheia.
 *
 * Por isso elas vão em `history.state`, que o navegador guarda POR ENTRADA do
 * histórico e devolve intacto no voltar e no avançar. `replaceState` grava na
 * entrada ATUAL sem criar entrada nova e sem recarregar nada: quando a pessoa
 * navega, a entrada que fica para trás já leva a memória junto.
 */

const CHAVE = "onface:visao";

type Visao = {
  /** A peça aberta sobre a tela (ficha do lead, reunião, atividade…). */
  peca?: { nome: string; id: string | null } | null;
  /** Rolagem dos contêineres que rolam por dentro, por caminho no DOM. */
  rolagem?: Record<string, number>;
};

function estadoAtual(): Record<string, unknown> {
  if (typeof window === "undefined") return {};
  const s = window.history.state;
  return s && typeof s === "object" ? (s as Record<string, unknown>) : {};
}

/** Lê o que foi guardado para ESTA entrada do histórico. */
export function lerVisao(): Visao {
  const v = estadoAtual()[CHAVE];
  return v && typeof v === "object" ? (v as Visao) : {};
}

/**
 * Grava na entrada atual, mesclando com o que já estava.
 *
 * Mexer no `history.state` do Next exige cuidado: ele guarda as chaves dele
 * aí (`__NA`, `__PRS`…) e perde a navegação se forem apagadas. Por isso o
 * estado anterior é espalhado de volta, sempre.
 */
export function guardarVisao(parcial: Visao): void {
  if (typeof window === "undefined") return;
  const anterior = estadoAtual();
  const atual = { ...(anterior[CHAVE] as Visao | undefined), ...parcial };
  try {
    window.history.replaceState({ ...anterior, [CHAVE]: atual }, "");
  } catch {
    /* Navegador que recusa replaceState (quota, about:blank): a tela continua
       funcionando, só não lembra — nunca deixar isso derrubar a navegação. */
  }
}

/* ── Rolagem ──────────────────────────────────────────────────────────── */

/** Caminho estável de um elemento: índice de cada filho até o body. */
function caminho(el: Element): string {
  const partes: number[] = [];
  let atual: Element | null = el;
  while (atual && atual !== document.body) {
    const pai: Element | null = atual.parentElement;
    if (!pai) break;
    partes.unshift(Array.prototype.indexOf.call(pai.children, atual));
    atual = pai;
  }
  return partes.join("-");
}

function porCaminho(p: string): Element | null {
  let atual: Element | null = document.body;
  for (const i of p.split("-")) {
    if (!atual) return null;
    atual = atual.children[Number(i)] ?? null;
  }
  return atual;
}

/** Quem rola por dentro agora. A tela só tem alguns; varrer é barato. */
function contêineresComRolagem(): Element[] {
  return Array.prototype.filter.call(
    document.querySelectorAll("div, section, main, ul, ol"),
    (el: Element) => el.scrollTop > 0,
  ) as Element[];
}

/** Fotografa a rolagem de todos os contêineres internos na entrada atual. */
export function guardarRolagem(): void {
  if (typeof window === "undefined") return;
  const rolagem: Record<string, number> = {};
  for (const el of contêineresComRolagem()) rolagem[caminho(el)] = el.scrollTop;
  guardarVisao({ rolagem });
}

/**
 * Devolve a rolagem guardada.
 *
 * Tenta de novo por alguns quadros porque o conteúdo chega depois da primeira
 * pintura (os cartões são montados pelo cliente): pôr `scrollTop` numa lista
 * ainda vazia não faz nada, e sem a repetição a tela voltaria ao topo.
 */
export function restaurarRolagem(tentativas = 10): void {
  if (typeof window === "undefined") return;
  const { rolagem } = lerVisao();
  if (!rolagem || Object.keys(rolagem).length === 0) return;

  let faltam = tentativas;
  const tentar = () => {
    let tudoNoLugar = true;
    for (const [p, topo] of Object.entries(rolagem)) {
      const el = porCaminho(p);
      if (!el) { tudoNoLugar = false; continue; }
      if (el.scrollTop !== topo) {
        el.scrollTop = topo;
        if (el.scrollTop !== topo) tudoNoLugar = false; // ainda não tem altura
      }
    }
    if (!tudoNoLugar && --faltam > 0) requestAnimationFrame(tentar);
  };
  requestAnimationFrame(tentar);
}
