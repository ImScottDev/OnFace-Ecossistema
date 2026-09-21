/**
 * Conversions API da Meta — o sinal de volta (SPEC §20).
 *
 * O que isto resolve: hoje a Meta só sabe que o formulário foi preenchido. Ela
 * não sabe quem qualificou, quem virou venda e quem pagou. Otimizar campanha
 * por volume de formulário é otimizar pelo evento errado, e foi o que o
 * levantamento mostrou: 1.536 entradas de Mídia Paga e nenhum retorno de
 * qualidade para o algoritmo.
 *
 * Aqui os eventos que importam voltam: qualificação, ganho e pagamento.
 *
 * Duas regras de privacidade que são da Meta e também são do bom senso:
 * dado pessoal vai **hasheado** em SHA-256, e nunca vai o nome bruto, o CPF ou
 * o conteúdo de uma conversa.
 *
 * Pacote de integração: monta e envia. Não decide QUANDO enviar — isso é do
 * domínio, pelo evento.
 */
import { createHash } from "node:crypto";

export type EventoCapiNome =
  | "Lead"            // entrada qualificada
  | "Purchase"        // pagamento confirmado
  | "CompleteRegistration"; // venda ganha

export interface EventoCapi {
  eventName: EventoCapiNome;
  /** Quando aconteceu, em segundos. A Meta recusa evento muito antigo. */
  eventTime: number;
  /** Deduplicação na Meta: o mesmo fato enviado duas vezes conta uma. */
  eventId: string;
  /** O identificador do lead na Meta, quando veio de Lead Ads. */
  leadId?: string | null;
  email?: string | null;
  telefone?: string | null;
  fbc?: string | null;
  fbp?: string | null;
  valor?: number | null;
  moeda?: string;
  actionSource?: "system_generated" | "website" | "phone_call" | "business_messaging";
}

export interface ResultadoCapi {
  ok: boolean;
  enviados?: number;
  erro?: string;
  /** true quando faltou credencial: é config ausente, não falha de integração. */
  semCredencial?: boolean;
}

/** SHA-256 do valor normalizado, como a Meta exige para dado pessoal. */
export function hashCapi(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const limpo = valor.trim().toLowerCase();
  if (!limpo) return null;
  return createHash("sha256").update(limpo).digest("hex");
}

/** Telefone tem regra própria: só dígitos, com país, antes do hash. */
function hashTelefone(telefone: string | null | undefined): string | null {
  if (!telefone) return null;
  const digitos = telefone.replace(/\D/g, "");
  if (digitos.length < 10) return null;
  const comPais = digitos.length <= 11 ? `55${digitos}` : digitos;
  return createHash("sha256").update(comPais).digest("hex");
}

export function montarEventoCapi(evento: EventoCapi): Record<string, unknown> {
  const userData: Record<string, unknown> = {};
  const em = hashCapi(evento.email);
  const ph = hashTelefone(evento.telefone);
  if (em) userData.em = [em];
  if (ph) userData.ph = [ph];
  if (evento.fbc) userData.fbc = evento.fbc;
  if (evento.fbp) userData.fbp = evento.fbp;
  if (evento.leadId) userData.lead_id = evento.leadId;

  const corpo: Record<string, unknown> = {
    event_name: evento.eventName,
    event_time: evento.eventTime,
    event_id: evento.eventId,
    action_source: evento.actionSource ?? "system_generated",
    user_data: userData,
  };
  if (evento.valor != null) {
    corpo.custom_data = { value: evento.valor, currency: evento.moeda ?? "BRL" };
  }
  return corpo;
}

export interface CredenciaisCapi {
  pixelId: string | null;
  accessToken: string | null;
  testEventCode?: string | null;
}

/**
 * Envia os eventos para a Meta.
 *
 * Falta de credencial devolve `semCredencial`, não erro: é configuração
 * ausente, e tratar as duas coisas como a mesma faz o alerta de integração
 * quebrada disparar num ambiente que nunca foi configurado.
 */
export async function enviarParaCapi(
  eventos: EventoCapi[], cred: CredenciaisCapi,
  fetchImpl: typeof fetch = fetch,
): Promise<ResultadoCapi> {
  if (!eventos.length) return { ok: true, enviados: 0 };
  if (!cred.pixelId || !cred.accessToken) return { ok: false, semCredencial: true, erro: "Meta CAPI sem pixel ou token configurado" };

  const corpo: Record<string, unknown> = { data: eventos.map(montarEventoCapi) };
  if (cred.testEventCode) corpo.test_event_code = cred.testEventCode;

  try {
    const r = await fetchImpl(`https://graph.facebook.com/v21.0/${cred.pixelId}/events`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cred.accessToken}` },
      body: JSON.stringify(corpo),
    });
    if (!r.ok) return { ok: false, erro: `Meta respondeu ${r.status}: ${(await r.text()).slice(0, 300)}` };
    return { ok: true, enviados: eventos.length };
  } catch (e) {
    return { ok: false, erro: String(e) };
  }
}
