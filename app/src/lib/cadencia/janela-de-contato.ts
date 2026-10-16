/**
 * A hora em que a cadência pode falar com o cliente.
 *
 * O motor agendava tudo como `agora + minutos`, sem olhar o relógio: uma espera
 * de 12 horas iniciada às 15h dispara às 3h da manhã, e o lead recebe WhatsApp
 * (ou uma LIGAÇÃO) de madrugada. Ninguém escolheu isso — era só ausência de
 * regra.
 *
 * A janela vale para o que CHEGA ao cliente. Passo interno (criar tarefa, pôr
 * etiqueta, mover etapa) continua rodando a qualquer hora: ele não incomoda
 * ninguém e segurá-lo só atrasaria o trabalho de quem vende.
 *
 * Fuso fixo em São Paulo porque é onde o time e os clientes estão; o dia útil
 * vai de segunda a sexta. Feriado não entra: exigiria calendário, e errar para
 * mais (não falar) é melhor que errar para menos.
 */

/** Adapters que falam com o cliente — só estes esperam a janela. */
const FALA_COM_O_CLIENTE = new Set([
  "whatsapp",
  "whatsapp_template",
  "ai_agent_message",
  "email",
  "crm_callface_call",
]);

export const contataOCliente = (adapter: string | null | undefined): boolean =>
  !!adapter && FALA_COM_O_CLIENTE.has(adapter);

export const JANELA_ABRE = 8;   // 08:00
export const JANELA_FECHA = 20; // 20:00 (às 20h já não envia)

const FUSO = "America/Sao_Paulo";

/** Hora e dia da semana de um instante, no fuso de São Paulo. */
function horaLocal(quando: Date): { hora: number; minuto: number; diaSemana: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: FUSO, hour12: false, weekday: "short", hour: "2-digit", minute: "2-digit",
  });
  const partes = Object.fromEntries(fmt.formatToParts(quando).map((p) => [p.type, p.value]));
  const dias: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    hora: Number(partes.hour) % 24,
    minuto: Number(partes.minute),
    diaSemana: dias[partes.weekday as string] ?? 1,
  };
}

export function dentroDaJanela(quando: Date): boolean {
  const { hora, diaSemana } = horaLocal(quando);
  if (diaSemana === 0 || diaSemana === 6) return false;
  return hora >= JANELA_ABRE && hora < JANELA_FECHA;
}

/**
 * O primeiro instante válido a partir de `quando` — ele mesmo, se já serve.
 *
 * Anda de hora em hora em vez de calcular o salto: é bobo e é à prova de
 * horário de verão, onde um dia pode ter 23 ou 25 horas. O teto de 8 dias
 * existe só para nunca virar laço infinito se alguém estreitar a janela.
 */
export function proximoHorarioDeContato(quando: Date): Date {
  if (dentroDaJanela(quando)) return quando;

  const candidato = new Date(quando);
  // Zera minutos para cair exatamente na abertura, e não às 8h37.
  candidato.setUTCSeconds(0, 0);
  for (let i = 0; i < 24 * 8; i += 1) {
    candidato.setUTCMinutes(candidato.getUTCMinutes() + 60);
    const { hora, minuto, diaSemana } = horaLocal(candidato);
    if (diaSemana === 0 || diaSemana === 6) continue;
    if (hora < JANELA_ABRE || hora >= JANELA_FECHA) continue;
    candidato.setUTCMinutes(candidato.getUTCMinutes() - minuto);
    return candidato;
  }
  return quando;
}
