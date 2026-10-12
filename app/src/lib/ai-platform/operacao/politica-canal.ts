/**
 * Política de canal aplicada pelo BACKEND antes de qualquer envio do agente.
 *
 * Nada aqui depende do prompt: o modelo pode "querer" mandar, a política diz se
 * pode. Cobre o que existe hoje (sessão QR do WhatsApp) e já deixa a regra da
 * API oficial pronta: fora da janela de 24h só template aprovado, e primeira
 * abordagem exige consentimento.
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiMemoriaFatos, aiSdrContatoState, contatos, whatsappSessao } from "@/lib/db/schema";

export type DecisaoDeCanal = { permitido: true } | { permitido: false; codigo: CodigoBloqueio; motivo: string; tentarDepois: boolean };
export type CodigoBloqueio = "sem_contato" | "sem_telefone" | "sem_sessao" | "canal_desconectado" | "opt_out" | "bot_silenciado" | "ia_pausada" | "fora_da_janela_template";

export const JANELA_RESPOSTA_LIVRE_HORAS = 24;

export interface EntradaPolitica {
  organizacaoId: string;
  contatoId: string;
  /** Iniciativa do agente (retomada, abertura) em vez de resposta a uma mensagem. */
  proativo: boolean;
  agora?: Date;
}

export async function optOutAtivo(organizacaoId: string, contatoId: string): Promise<boolean> {
  const [f] = await db.select({ id: aiMemoriaFatos.id }).from(aiMemoriaFatos)
    .where(and(eq(aiMemoriaFatos.organizacaoId, organizacaoId), eq(aiMemoriaFatos.contatoId, contatoId), eq(aiMemoriaFatos.chave, "opt_out"), eq(aiMemoriaFatos.status, "ativo"))).limit(1);
  if (f) return true;
  const [s] = await db.select({ motivo: aiSdrContatoState.handoffMotivo, ativo: aiSdrContatoState.aiAtivo }).from(aiSdrContatoState).where(eq(aiSdrContatoState.contatoId, contatoId)).limit(1);
  return Boolean(s && !s.ativo && s.motivo === "descadastro");
}

export async function avaliarEnvio(p: EntradaPolitica): Promise<DecisaoDeCanal> {
  const agora = p.agora ?? new Date();
  const [c] = await db.select({ telefone: contatos.telefone, sessaoId: contatos.sessaoId, silenciado: contatos.botSilencedUntil })
    .from(contatos).where(and(eq(contatos.id, p.contatoId), eq(contatos.organizacaoId, p.organizacaoId))).limit(1);
  if (!c) return { permitido: false, codigo: "sem_contato", motivo: "Contato não encontrado nesta organização.", tentarDepois: false };
  if (!c.telefone) return { permitido: false, codigo: "sem_telefone", motivo: "Contato sem telefone.", tentarDepois: false };
  if (await optOutAtivo(p.organizacaoId, p.contatoId)) return { permitido: false, codigo: "opt_out", motivo: "O contato pediu para não receber mensagens.", tentarDepois: false };
  if (c.silenciado && c.silenciado > agora) return { permitido: false, codigo: "bot_silenciado", motivo: "Conversa silenciada por handoff em curso.", tentarDepois: true };
  if (!c.sessaoId) return { permitido: false, codigo: "sem_sessao", motivo: "A conversa não tem número de WhatsApp vinculado.", tentarDepois: false };
  const [s] = await db.select({ status: whatsappSessao.status, tipo: whatsappSessao.tipo }).from(whatsappSessao).where(and(eq(whatsappSessao.id, c.sessaoId), eq(whatsappSessao.organizacaoId, p.organizacaoId))).limit(1);
  if (!s) return { permitido: false, codigo: "sem_sessao", motivo: "Número de WhatsApp não encontrado.", tentarDepois: false };
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
