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
  /** Posição do contêiner que rola por dentro da tela. */
  rolagem?: number;
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

/**
 * O contêiner que rola por dentro da tela.
 *
 * É um só por tela (a área do quadro, a lista), e é o maior: o que tem mais
 * conteúdo para rolar. Identificar assim, e não por caminho no DOM, é o que
 * sobrevive à tela voltar com a ficha aberta — a gaveta acrescenta nós e todo
 * caminho guardado antes deixa de resolver. Medido em 20/10/2026: com
 * caminho, a rolagem nunca voltava.
 */
function contêinerQueRola(): Element | null {
  let maior: Element | null = null;
  for (const el of Array.from(document.querySelectorAll("div, section, main, ul, ol"))) {
    const sobra = el.scrollHeight - el.clientHeight;
    if (sobra < 200) continue; // ruído: caixa com meia linha a mais
    if (!maior || el.scrollHeight > maior.scrollHeight) maior = el;
  }
  return maior;
}

/** Fotografa a posição na entrada atual do histórico. */
export function guardarRolagem(): void {
  if (typeof window === "undefined") return;
  const el = contêinerQueRola();
  if (!el || el.scrollTop <= 0) return;
  guardarVisao({ rolagem: el.scrollTop });
}

/**
 * Devolve a posição guardada.
 *
 * Insiste por alguns segundos, e não por alguns quadros: os cartões são
 * montados pelo cliente e chegam MUITO depois da primeira pintura — pôr
 * `scrollTop` numa lista ainda vazia não faz nada.
 *
 * Para assim que acerta, e desiste no primeiro gesto de quem está olhando:
 * insistir por cima de alguém que já começou a rolar é pior que não lembrar.
 */
export function restaurarRolagem(limiteMs = 6000): void {
  if (typeof window === "undefined") return;
  const topo = lerVisao().rolagem;
  if (!topo || topo <= 0) return;

  const ate = Date.now() + limiteMs;
  let desistir = false;
  const aoTocar = () => { desistir = true; };
  for (const ev of ["wheel", "touchstart", "keydown"]) {
    window.addEventListener(ev, aoTocar, { once: true, passive: true } as never);
  }
  const parar = () => {
    for (const ev of ["wheel", "touchstart", "keydown"]) window.removeEventListener(ev, aoTocar);
  };

  const tentar = () => {
    if (desistir || Date.now() > ate) return parar();
    const el = contêinerQueRola();
    if (el) {
      el.scrollTop = topo;
      if (Math.abs(el.scrollTop - topo) <= 1) return parar(); // chegou
    }
    setTimeout(tentar, 120);
  };
  setTimeout(tentar, 0);
}
