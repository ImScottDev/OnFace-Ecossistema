/**
 * Marcapasso de envio por NÚMERO de WhatsApp.
 *
 * Em 21/10/2026 o WhatsApp restringiu o número da agente por "spam, automated or
 * bulk messaging". A medição desmontou a explicação fácil: ela mandou 47
 * mensagens em dois dias, para 4 contatos, e **nunca iniciou uma conversa** —
 * enquanto números humanos da mesma instância iniciam 251 conversas frias por
 * mês, com metade dos destinatários nunca respondendo, e não foram restringidos.
 *
 * O que a Lia tinha de pior que todos: **um terço dos envios dela saiu no MESMO
 * SEGUNDO** (14 pares com 0,0s de intervalo), e o número tinha um dia de vida.
 * Rajada sub-segundo é a assinatura que nenhum humano produz.
 *
 * E o código não tinha NENHUM limite por número: todo teto era por conversa.
 * Com 60/hora por conversa, dez conversas ao mesmo tempo davam 600 mensagens
 * por hora pelo mesmo chip, sem nada no caminho.
 *
 * Este marcapasso é o ponto único: fica no caminho por onde TODO envio passa,
 * inclusive o das campanhas, que não passa pela fila nem pela política de canal.
 *
 * **O freio é só do robô.** Quem clicou "enviar" no Atendimento não espera e não
 * é barrado: o humano digitando é exatamente o tráfego que o WhatsApp quer ver,
 * e segurar a resposta dele por 25 segundos seria quebrar o produto para
 * resolver um problema que não é dele. O envio humano só CONTA, porque o teto
 * do chip é do chip — se o time já gastou a cota conversando, o robô cala.
 *
 * ponytail: contador em memória do processo. Hoje o envio é serializado num
 * worker só (`concurrency: 1`), então basta. Se um dia mais de um processo
 * enviar pelo mesmo número, isto precisa ir para o Redis.
 */

/** Espaço mínimo entre dois envios do MESMO número, com variação. */
export const INTERVALO_MIN_MS = 8_000;
export const INTERVALO_MAX_MS = 25_000;

/** Teto por número. Protege o chip, não a conversa — é outro eixo. */
export const MAX_POR_HORA_POR_NUMERO = 30;
export const MAX_POR_DIA_POR_NUMERO = 200;

/** Quem está mandando: o robô espera a vez, o humano não. */
export type OrigemDoEnvio = "automatico" | "humano";

type Estado = { ultimoEnvio: number; horas: Map<number, number>; dias: Map<number, number> };
const porNumero = new Map<string, Estado>();

const horaDe = (t: number) => Math.floor(t / 3_600_000);
const diaDe = (t: number) => Math.floor(t / 86_400_000);

/** Sorteia o espaço entre envios: intervalo fixo é tão suspeito quanto nenhum. */
export function intervaloSorteado(aleatorio = Math.random): number {
  return Math.round(INTERVALO_MIN_MS + aleatorio() * (INTERVALO_MAX_MS - INTERVALO_MIN_MS));
}

export class NumeroNoLimite extends Error {
  /** Quanto falta para a janela virar: quem chama adia em vez de desistir. */
  constructor(message: string, readonly tentarEmMs: number) { super(message); }
}

/**
 * Quanto falta esperar e se o número ainda pode enviar.
 * Função pura: a decisão é testável sem relógio nem banco.
 */
export function decidir(
  e: Estado | undefined,
  agora: number,
  intervalo: number,
  origem: OrigemDoEnvio = "automatico",
): { esperarMs: number; estourou: "hora" | "dia" | null } {
  if (!e) return { esperarMs: 0, estourou: null };
  // O humano nunca espera nem é barrado: ver o comentário do topo.
  if (origem === "humano") return { esperarMs: 0, estourou: null };
  if ((e.dias.get(diaDe(agora)) ?? 0) >= MAX_POR_DIA_POR_NUMERO) return { esperarMs: 0, estourou: "dia" };
  if ((e.horas.get(horaDe(agora)) ?? 0) >= MAX_POR_HORA_POR_NUMERO) return { esperarMs: 0, estourou: "hora" };
  return { esperarMs: Math.max(0, e.ultimoEnvio + intervalo - agora), estourou: null };
}

const umaEspera = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Segura o envio automático até o número poder falar de novo. Lança
 * `NumeroNoLimite` com o tempo de espera quando o teto do chip estourou —
 * quem chama adia para a próxima janela, nunca descarta a mensagem.
 */
export async function aguardarVezDoNumero(
  chave: string,
  opcoes: { origem?: OrigemDoEnvio; espera?: (ms: number) => Promise<void> } = {},
): Promise<void> {
  const { origem = "automatico", espera = umaEspera } = opcoes;
  const agora = Date.now();
  const e = porNumero.get(chave) ?? { ultimoEnvio: 0, horas: new Map(), dias: new Map() };
  const { esperarMs, estourou } = decidir(e, agora, intervaloSorteado(), origem);

  if (estourou) {
    const viraEm = estourou === "dia"
      ? (diaDe(agora) + 1) * 86_400_000 - agora
      : (horaDe(agora) + 1) * 3_600_000 - agora;
    throw new NumeroNoLimite(
      estourou === "dia"
        ? `número no teto diário (${MAX_POR_DIA_POR_NUMERO} envios): protege o chip de restrição por volume`
        : `número no teto por hora (${MAX_POR_HORA_POR_NUMERO} envios): protege o chip de rajada`,
      viraEm,
    );
  }
  if (esperarMs > 0) await espera(esperarMs);

  const depois = Date.now();
  e.ultimoEnvio = depois;
  e.horas.set(horaDe(depois), (e.horas.get(horaDe(depois)) ?? 0) + 1);
  e.dias.set(diaDe(depois), (e.dias.get(diaDe(depois)) ?? 0) + 1);
  // Janelas velhas não interessam e não podem crescer para sempre.
  for (const h of e.horas.keys()) if (h < horaDe(depois) - 1) e.horas.delete(h);
  for (const d of e.dias.keys()) if (d < diaDe(depois) - 1) e.dias.delete(d);
  porNumero.set(chave, e);
}

/** Só para teste: esquece o que já foi contado. */
export function zerarMarcapasso(): void {
  porNumero.clear();
}
