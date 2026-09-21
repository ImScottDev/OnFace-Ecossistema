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
import { metaGraphUrl } from "./config";

/**
 * O nome vai como string porque a política decide qual é (ver
 * `politica-eventos.ts`). Fixar um union aqui obrigaria a mudar este arquivo
 * toda vez que a política ganhasse um evento, e a política é que manda.
 */
export type EventoCapiNome = string;

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
  /** true quando vale repetir: rede, limite de taxa, erro transitório da Meta. */
  tentarDeNovo?: boolean;
  /** Identificador da Meta para rastrear a chamada no suporte deles. */
  traceId?: string | null;
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

export interface CredenciaisCapiEnvio {
  /** Pixel/Dataset ID: o mesmo número, o mesmo endpoint. */
  datasetId: string | null;
  accessToken: string | null;
  testEventCode?: string | null;
}

/**
 * Envia os eventos para a Meta.
 *
 * Três resultados distintos, e a distinção importa para quem chama decidir o
 * que fazer:
 *
 *   `semCredencial`  configuração ausente — não é falha, não alerta, não repete;
 *   `tentarDeNovo`   transitório (rede, limite de taxa, erro deles) — repete;
 *   nenhum dos dois  a Meta recusou o evento — repetir daria o mesmo erro.
 *
 * Tratar os três como "erro" faria a fila tentar para sempre um evento que
 * nunca vai passar, e faria o alerta de integração quebrada disparar num
 * ambiente que ninguém configurou.
 */
export async function enviarParaCapi(
  eventos: EventoCapi[], cred: CredenciaisCapiEnvio,
  fetchImpl: typeof fetch = fetch,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ResultadoCapi> {
  if (!eventos.length) return { ok: true, enviados: 0 };
  if (!cred.datasetId || !cred.accessToken) {
    return { ok: false, semCredencial: true, erro: "Meta CAPI sem dataset ou token configurado" };
  }

  const corpo: Record<string, unknown> = { data: eventos.map(montarEventoCapi) };
  if (cred.testEventCode) corpo.test_event_code = cred.testEventCode;

  let r: Response;
  try {
    r = await fetchImpl(metaGraphUrl(`${cred.datasetId}/events`, env), {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cred.accessToken}` },
      body: JSON.stringify(corpo),
    });
  } catch (e) {
    return { ok: false, erro: `falha de rede: ${String(e)}`, tentarDeNovo: true };
  }

  if (!r.ok) {
    const texto = (await r.text().catch(() => "")).slice(0, 400);
    let codigo: number | undefined;
    try { codigo = (JSON.parse(texto) as { error?: { code?: number } }).error?.code; } catch { /* texto cru */ }
    // 4 e 17 são limite de taxa; 1 e 2 são erro transitório da Meta.
    const transitorio = r.status >= 500 || codigo === 4 || codigo === 17 || codigo === 1 || codigo === 2;
    return { ok: false, erro: `Meta respondeu ${r.status}: ${texto}`, tentarDeNovo: transitorio };
  }

  const resposta = (await r.json().catch(() => ({}))) as { events_received?: number; fbtrace_id?: string };
  return {
    ok: true,
    enviados: resposta.events_received ?? eventos.length,
    traceId: resposta.fbtrace_id ?? null,
  };
}
