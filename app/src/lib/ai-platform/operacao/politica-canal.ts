/**
 * Política de canal aplicada pelo BACKEND antes de qualquer envio do agente.
 *
 * Nada aqui depende do prompt: o modelo pode "querer" mandar, a política diz se
 * pode. Cobre o que existe hoje (sessão QR do WhatsApp) e já deixa a regra da
 * API oficial pronta: fora da janela de 24h só template aprovado, e primeira
 * abordagem exige consentimento.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiAgentAtribuicoes, aiMemoriaFatos, aiSdrContatoState, contatos, whatsappSessao } from "@/lib/db/schema";

export type DecisaoDeCanal = { permitido: true } | { permitido: false; codigo: CodigoBloqueio; motivo: string; tentarDepois: boolean };
export type CodigoBloqueio = "sem_contato" | "sem_telefone" | "sem_sessao" | "canal_desconectado" | "opt_out" | "bot_silenciado" | "ia_pausada" | "fora_da_janela_template" | "numero_privado";

export const JANELA_RESPOSTA_LIVRE_HORAS = 24;

export interface EntradaPolitica {
  organizacaoId: string;
  contatoId: string;
  /** Iniciativa do agente (retomada, abertura) em vez de resposta a uma mensagem. */
  proativo: boolean;
  agora?: Date;
  /**
   * A pausa foi causada pelo PRÓPRIO run que está enviando (handoff_request, reunião marcada):
   * a mensagem de despedida/confirmação desse run ainda sai. Pausa de outra origem bloqueia.
   */
  pausaDoProprioRun?: boolean;
}

/** Handoff "leve" do SDR legado: não pausa a conversa (o worker reativa), como no gate do inbound. */
const MOTIVOS_LEVES = ["criterio_concluido", "pedido_contato"];

/**
 * Uma pessoa assumiu ou pausou a IA nesta conversa: flag da conversa (ai_sdr_contato_state)
 * desligada ou em handoff humano, ou atribuição do agente com uma pessoa / pausada.
 * Antes nada disso era lido aqui e envios fora do inbound (cadência, retomada, sweeps)
 * falavam por cima de quem tinha assumido.
 */
export async function iaPausadaNaConversa(organizacaoId: string, contatoId: string): Promise<string | null> {
  const [s] = await db.select({ ativo: aiSdrContatoState.aiAtivo, status: aiSdrContatoState.handoffStatus, motivo: aiSdrContatoState.handoffMotivo })
    .from(aiSdrContatoState).where(and(eq(aiSdrContatoState.contatoId, contatoId), eq(aiSdrContatoState.organizacaoId, organizacaoId))).limit(1);
  if (s && (!s.ativo || s.status === "human_required" || s.status === "human_assigned") && !MOTIVOS_LEVES.includes(s.motivo ?? "")) return "IA pausada nesta conversa: uma pessoa assumiu o atendimento.";
  const [a] = await db.select({ status: aiAgentAtribuicoes.status }).from(aiAgentAtribuicoes)
    .where(and(eq(aiAgentAtribuicoes.organizacaoId, organizacaoId), eq(aiAgentAtribuicoes.contatoId, contatoId), inArray(aiAgentAtribuicoes.status, ["humano", "pausada"]))).limit(1);
  if (a) return a.status === "humano" ? "Atendimento com uma pessoa: o agente não fala por cima." : "Agente pausado neste atendimento.";
  return null;
}

export async function optOutAtivo(organizacaoId: string, contatoId: string): Promise<boolean> {
  const [f] = await db.select({ id: aiMemoriaFatos.id }).from(aiMemoriaFatos)
    .where(and(eq(aiMemoriaFatos.organizacaoId, organizacaoId), eq(aiMemoriaFatos.contatoId, contatoId), eq(aiMemoriaFatos.chave, "opt_out"), eq(aiMemoriaFatos.status, "ativo"))).limit(1);
  if (f) return true;
  const [s] = await db.select({ motivo: aiSdrContatoState.handoffMotivo, ativo: aiSdrContatoState.aiAtivo }).from(aiSdrContatoState).where(eq(aiSdrContatoState.contatoId, contatoId)).limit(1);
  return Boolean(s && !s.ativo && s.motivo === "descadastro");
}

/**
 * Quais destes destinos (telefone ou e-mail) pediram para não receber.
 *
 * A mesma verdade de `optOutAtivo`, consultada por DESTINO em vez de por
 * contato, porque disparo em massa só conhece o telefone. Existe porque a
 * campanha de outreach mandava para quem já tinha pedido para parar: ali não é
 * risco de ban, é a LGPD. Uma consulta por lote, não uma por pessoa.
 */
export async function destinosEmOptOut(organizacaoId: string, canal: string, destinos: string[]): Promise<Set<string>> {
  if (destinos.length === 0) return new Set();
  const coluna = canal === "whatsapp"
    ? sql`regexp_replace(coalesce(ct.telefone, ''), '[^0-9]', '', 'g')`
    : sql`lower(trim(coalesce(ct.email, '')))`;
  const linhas = (await db.execute(sql`
    SELECT DISTINCT ${coluna} AS destino
      FROM contatos ct
      LEFT JOIN ai_memoria_fatos f
        ON f.contato_id = ct.id AND f.organizacao_id = ct.organizacao_id
       AND f.chave = 'opt_out' AND f.status = 'ativo'
      LEFT JOIN ai_sdr_contato_state s
        ON s.contato_id = ct.id AND s.ai_ativo = false AND s.handoff_motivo = 'descadastro'
     WHERE ct.organizacao_id = ${organizacaoId}::uuid
       AND (f.id IS NOT NULL OR s.contato_id IS NOT NULL)
       AND ${coluna} IN (${sql.join(destinos.map((d) => sql`${d}`), sql`, `)})
  `)) as unknown as Array<{ destino: string }>;
  return new Set(linhas.map((l) => l.destino));
}

export async function avaliarEnvio(p: EntradaPolitica): Promise<DecisaoDeCanal> {
  const agora = p.agora ?? new Date();
  const [c] = await db.select({ telefone: contatos.telefone, sessaoId: contatos.sessaoId, silenciado: contatos.botSilencedUntil })
    .from(contatos).where(and(eq(contatos.id, p.contatoId), eq(contatos.organizacaoId, p.organizacaoId))).limit(1);
  if (!c) return { permitido: false, codigo: "sem_contato", motivo: "Contato não encontrado nesta organização.", tentarDepois: false };
  if (!c.telefone) return { permitido: false, codigo: "sem_telefone", motivo: "Contato sem telefone.", tentarDepois: false };
  if (await optOutAtivo(p.organizacaoId, p.contatoId)) return { permitido: false, codigo: "opt_out", motivo: "O contato pediu para não receber mensagens.", tentarDepois: false };
  if (c.silenciado && c.silenciado > agora) return { permitido: false, codigo: "bot_silenciado", motivo: "Conversa silenciada por handoff em curso.", tentarDepois: true };
  if (!p.pausaDoProprioRun) {
    const pausa = await iaPausadaNaConversa(p.organizacaoId, p.contatoId);
    if (pausa) return { permitido: false, codigo: "ia_pausada", motivo: pausa, tentarDepois: true };
  }
  if (!c.sessaoId) return { permitido: false, codigo: "sem_sessao", motivo: "A conversa não tem número de WhatsApp vinculado.", tentarDepois: false };
  const [s] = await db.select({ status: whatsappSessao.status, tipo: whatsappSessao.tipo, privado: whatsappSessao.privado }).from(whatsappSessao).where(and(eq(whatsappSessao.id, c.sessaoId), eq(whatsappSessao.organizacaoId, p.organizacaoId))).limit(1);
  if (!s) return { permitido: false, codigo: "sem_sessao", motivo: "Número de WhatsApp não encontrado.", tentarDepois: false };
  // Número privado (WhatsApp pessoal): agente nunca fala por ele. Ver lib/whatsapp/uso-automatico.ts.
  if (s.privado) return { permitido: false, codigo: "numero_privado", motivo: "O número desta conversa é privado: o agente não fala por ele.", tentarDepois: false };
  if (s.status !== "connected") return { permitido: false, codigo: "canal_desconectado", motivo: "O número de WhatsApp está desconectado.", tentarDepois: true };

  // API oficial: fora de 24h desde a última mensagem do contato só vai template aprovado.
  // A sessão QR atual não tem essa regra; o gancho fica aqui para quando houver número oficial.
  if (p.proativo && (s.tipo === "oficial" || s.tipo === "cloud_api")) {
    const [u] = await db.execute<{ horas: number | null }>(sql`
      SELECT extract(epoch FROM (${agora.toISOString()}::timestamptz - max(created_at)))/3600.0 AS horas
        FROM whatsapp_mensagens WHERE contato_id = ${p.contatoId}::uuid AND direcao = 'in'`);
    if (u?.horas == null || u.horas > JANELA_RESPOSTA_LIVRE_HORAS) {
      return { permitido: false, codigo: "fora_da_janela_template", motivo: "Fora da janela de 24h: só template aprovado, e o agente não envia template sozinho.", tentarDepois: false };
    }
  }
  return { permitido: true };
}
