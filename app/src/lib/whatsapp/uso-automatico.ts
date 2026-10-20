/**
 * Número PRIVADO não é canal de automação.
 *
 * A 0126 protegeu a LEITURA humana das conversas de número privado (acesso.ts).
 * O lado automático ficou aberto: mensagem recebida num número privado ainda
 * acionava IA, fluxos e regras de "whatsapp_recebido", e a escolha de número da
 * cadência, do agente e do fluxo podia cair no WhatsApp pessoal de alguém —
 * ou seja, a máquina lendo e falando pela conversa particular de uma pessoa.
 *
 * Regra única, usada por todos os caminhos automáticos (worker de entrada,
 * agentes, cadências, fluxos, campanhas, número padrão):
 *   - recebida em número privado: só o que PROTEGE roda (parar cadência porque
 *     o lead respondeu). Nada de IA, fluxo ou regra;
 *   - escolha automática de número nunca devolve número privado;
 *   - agente de IA nunca lê nem responde conversa de número privado;
 *   - o dono do número pode, explicitamente, escolher o próprio número num
 *     passo de cadência (é ele falando pelo que é dele). Escolha automática, não.
 */
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { whatsappSessao } from "@/lib/db/schema";

export const MOTIVO_NUMERO_PRIVADO = "o número de WhatsApp desta conversa é privado: automação e IA não agem nele";

/** Regra pura: o número aceita ação automática? Sessão nula (conversa sem número) não é privada. */
export function numeroAceitaAutomacao(sessao: { privado?: boolean | null } | null | undefined): boolean {
  return !sessao?.privado;
}

/** O número é privado? Sem sessão (ou sessão de outra organização) responde false. */
export async function sessaoEhPrivada(organizacaoId: string, sessaoId: string | null | undefined): Promise<boolean> {
  if (!sessaoId) return false;
  const [s] = await db.select({ privado: whatsappSessao.privado }).from(whatsappSessao)
    .where(and(eq(whatsappSessao.id, sessaoId), eq(whatsappSessao.organizacaoId, organizacaoId))).limit(1);
  return Boolean(s?.privado);
}

/** Dos ids informados, quais são de número privado (para filtrar conversas em lote). */
export async function sessoesPrivadas(organizacaoId: string, ids: (string | null | undefined)[]): Promise<Set<string>> {
  const validos = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (!validos.length) return new Set();
  const rows = await db.select({ id: whatsappSessao.id }).from(whatsappSessao)
    .where(and(eq(whatsappSessao.organizacaoId, organizacaoId), inArray(whatsappSessao.id, validos), eq(whatsappSessao.privado, true)));
  return new Set(rows.map((r) => r.id));
}
