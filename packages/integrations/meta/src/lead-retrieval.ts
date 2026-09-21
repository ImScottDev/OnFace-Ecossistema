/**
 * Busca do lead real na Graph API (SPEC §20).
 *
 * Por que isto é obrigatório e não um detalhe: **o webhook de leadgen da Meta
 * não traz os dados do lead.** Ele avisa que um lead existe e entrega o
 * `leadgen_id`, o `page_id`, o `form_id` e o horário. Nome, e-mail, telefone e
 * as respostas do formulário só existem depois de buscar em
 * `/{leadgen_id}`.
 *
 * Um webhook que assume `field_data` no payload funciona com o integrador que
 * já buscou por nós (o n8n de hoje) e falha silenciosamente quando a Meta
 * chama direto: entra um lead sem identificador nenhum, a porta canônica
 * recusa — corretamente — e o lead pago se perde.
 *
 * Pacote de integração: fala com o provedor e normaliza. Não escreve no banco.
 */
import { metaGraphUrl } from "./config";
import type { LeadAdsBruto } from "./lead-ads";

export interface ResultadoRetrieval {
  ok: boolean;
  lead?: LeadAdsBruto;
  erro?: string;
  /** Distingue configuração ausente de falha de integração. */
  semCredencial?: boolean;
  /** true quando a Meta recusou por permissão: é aprovação pendente, não bug. */
  semPermissao?: boolean;
  /** true quando vale tentar de novo (rede, limite de taxa, erro transitório). */
  tentarDeNovo?: boolean;
}

/**
 * Campos pedidos à Graph API.
 *
 * `field_data` é o que o formulário coletou; o resto é a atribuição, e ela
 * precisa vir junto para o anúncio e a pessoa chegarem no MESMO fato. Buscar a
 * atribuição depois foi o que criou a tabela de staging e a corrida entre dois
 * webhooks que este refactor está desfazendo.
 */
const CAMPOS = [
  "id", "created_time", "field_data",
  "ad_id", "ad_name", "adset_id", "adset_name", "campaign_id", "campaign_name",
  "form_id", "is_organic", "platform", "partner_name",
].join(",");

export async function buscarLeadNaGraph(
  leadgenId: string,
  accessToken: string | null,
  fetchImpl: typeof fetch = fetch,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ResultadoRetrieval> {
  if (!leadgenId) return { ok: false, erro: "leadgen_id ausente" };
  if (!accessToken) {
    return {
      ok: false,
      semCredencial: true,
      erro: "META_LEADS_ACCESS_TOKEN não configurado: sem ele a Meta não entrega os dados do lead",
    };
  }

  const url = metaGraphUrl(`${encodeURIComponent(leadgenId)}?fields=${CAMPOS}`, env);
  let resposta: Response;
  try {
    resposta = await fetchImpl(url, { headers: { authorization: `Bearer ${accessToken}` } });
  } catch (e) {
    // Falha de rede é transitória por definição: quem chama decide reagendar.
    return { ok: false, erro: `falha de rede ao buscar o lead: ${String(e)}`, tentarDeNovo: true };
  }

  if (!resposta.ok) {
    const corpo = await resposta.text().catch(() => "");
    let codigo: number | undefined;
    let mensagem = corpo.slice(0, 300);
    try {
      const j = JSON.parse(corpo) as { error?: { code?: number; message?: string } };
      codigo = j.error?.code;
      mensagem = j.error?.message ?? mensagem;
    } catch { /* corpo não é JSON: fica o texto cru */ }

    // 10 e 200 são permissão; 190 é token inválido ou expirado. Nenhum deles
    // melhora com retry, e tratá-los como transitório encheria a fila de
    // tentativas que nunca vão passar.
    const permissao = codigo === 10 || codigo === 200 || codigo === 190;
    // 4 e 17 são limite de taxa; 1 e 2 são erro transitório do lado deles.
    const transitorio = codigo === 4 || codigo === 17 || codigo === 1 || codigo === 2 || resposta.status >= 500;

    return {
      ok: false,
      erro: `Meta respondeu ${resposta.status}${codigo ? ` (código ${codigo})` : ""}: ${mensagem}`,
      semPermissao: permissao,
      tentarDeNovo: transitorio,
    };
  }

  const lead = (await resposta.json()) as Record<string, unknown>;
  return { ok: true, lead: { ...lead, leadgen_id: String(lead.id ?? leadgenId) } as LeadAdsBruto };
}

/**
 * Junta o que o webhook trouxe com o que a Graph API devolveu.
 *
 * A Graph vence nos campos que ela preenche, porque é a fonte; o webhook
 * preenche o que ela não devolve (`page_id`, por exemplo, que vem no envelope
 * da notificação e não no objeto do lead).
 *
 * Quando a busca falha, sobra o webhook — e isso NÃO é fallback inseguro: se o
 * webhook também não tiver identidade, a porta canônica recusa a entrada, que é
 * o comportamento certo. O que não se faz é inventar um identificador para a
 * entrada passar.
 */
export function combinar(doWebhook: LeadAdsBruto, daGraph?: LeadAdsBruto): LeadAdsBruto {
  if (!daGraph) return doWebhook;
  const juntos: LeadAdsBruto = { ...doWebhook };
  for (const [chave, valor] of Object.entries(daGraph)) {
    if (valor !== null && valor !== undefined && valor !== "") {
      (juntos as Record<string, unknown>)[chave] = valor;
    }
  }
  return juntos;
}
