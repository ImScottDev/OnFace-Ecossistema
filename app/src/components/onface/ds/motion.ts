/** Fundação de movimento do ONFACE.
 *
 * Um lugar só para duração, curva e mola. Componente não inventa número:
 * importa daqui ou usa a var CSS equivalente de `ds.css`. Motion aqui serve
 * hierarquia, orientação e feedback — não decoração.
 *
 * A biblioteca é `motion` (sucessora do framer-motion). O projeto ainda tem
 * dois arquivos legados importando `framer-motion` direto (crm/CommandPalette
 * e crm/CrmSidebar); eles migram quando a tela for tocada, não agora. */

export const DURACAO = {
  instantaneo: 0.08,
  rapido: 0.12,
  base: 0.18,
  lento: 0.28,
} as const;

export const CURVA = {
  /** Mudança de estado no lugar: cor, opacidade, fundo. */
  padrao: [0.2, 0, 0.2, 1],
  /** Algo entrando na tela. Desacelera no fim. */
  entrada: [0, 0, 0.2, 1],
  /** Algo saindo. Acelera e some. */
  saida: [0.4, 0, 1, 1],
  /** Movimento com ênfase: overlay grande, painel, transição de página. */
  enfase: [0.2, 0, 0, 1],
} as const;

export const MOLA = {
  /** Cartão, hover, micro-movimento. */
  suave: { type: "spring", stiffness: 260, damping: 30, mass: 0.9 },
  /** Resposta imediata: toggle, chip, indicador de aba. */
  seca: { type: "spring", stiffness: 420, damping: 34, mass: 0.7 },
  /** Gaveta e folha: peso de painel, sem quicar. */
  gaveta: { type: "spring", stiffness: 300, damping: 34, mass: 1 },
  /** Item arrastado voltando ao lugar. */
  arraste: { type: "spring", stiffness: 500, damping: 40, mass: 0.8 },
} as const;

/** Variantes prontas para o que mais aparece no produto. */
export const VARIANTES = {
  /** Overlay ancorado (dropdown, popover, tooltip): escala a partir da origem. */
  ancorado: {
    inicial: { opacity: 0, scale: 0.96, y: -4 },
    ativo: { opacity: 1, scale: 1, y: 0 },
    saindo: { opacity: 0, scale: 0.98, y: -2 },
  },
  /** Diálogo centralizado. */
  dialogo: {
    inicial: { opacity: 0, scale: 0.97 },
    ativo: { opacity: 1, scale: 1 },
    saindo: { opacity: 0, scale: 0.98 },
  },
  /** Lista que entra em cascata curta. Passo alto demais vira espera. */
  lista: {
    ativo: { transition: { staggerChildren: 0.035 } },
  },
  item: {
    inicial: { opacity: 0, y: 8 },
    ativo: { opacity: 1, y: 0 },
  },
} as const;

/** Transição padrão para trocas de estado simples. */
export const TRANSICAO_PADRAO = {
  duration: DURACAO.base,
  ease: CURVA.padrao,
} as const;
