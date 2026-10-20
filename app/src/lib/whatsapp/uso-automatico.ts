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

/* ── Pool OPERACIONAL (migration 0131) ──────────────────────────────────────
 *
 * A operação ligou números para SDR, Lia, automações e distribuição — mas não
 * são todos os números conectados. `operacional` marca esse pool: é dele que
 * distribuição, agentes e campanhas escolhem número. Privado e operacional
 * nunca andam juntos (CHECK no banco; a mesma regra aqui, com mensagem).
 */

export const MOTIVO_PRIVADO_NAO_OPERACIONAL = "Número privado não pode ser operacional: a máquina não fala pela conversa particular de ninguém.";

export class ErroDeNumero extends Error {}

/** Regra pura: o número pode estar no pool operacional? */
export function numeroOperacional(sessao: { privado?: boolean | null; operacional?: boolean | null } | null | undefined): boolean {
  return Boolean(sessao?.operacional) && !sessao?.privado;
}

/** Combinação de marcações válida? Devolve o motivo da recusa, ou null. */
export function validarMarcacaoDoNumero(m: { privado?: boolean | null; operacional?: boolean | null }): string | null {
  return m.privado && m.operacional ? MOTIVO_PRIVADO_NAO_OPERACIONAL : null;
}

export interface NumeroOperacional {
  id: string; nome: string; phoneNumber: string | null; finalidade: string | null;
  usuarioId: string | null; isDefault: boolean;
}

/**
 * Números operacionais da organização, conectados e não privados. Ordem
 * estável: o padrão primeiro, depois por nome. `finalidade` filtra pelo rótulo
 * livre (0102), sem caixa, quando informada.
 */
export async function listarNumerosOperacionais(organizacaoId: string, opts: { finalidade?: string | null; incluirDesconectados?: boolean } = {}): Promise<NumeroOperacional[]> {
  const condicoes = [
    eq(whatsappSessao.organizacaoId, organizacaoId),
    eq(whatsappSessao.operacional, true),
    eq(whatsappSessao.privado, false),
  ];
  if (!opts.incluirDesconectados) condicoes.push(eq(whatsappSessao.status, "connected"));
  const rows = await db.select({
    id: whatsappSessao.id, label: whatsappSessao.label, sessionName: whatsappSessao.sessionName, phoneNumber: whatsappSessao.phoneNumber,
    finalidade: whatsappSessao.finalidade, usuarioId: whatsappSessao.usuarioId, isDefault: whatsappSessao.isDefault,
  }).from(whatsappSessao).where(and(...condicoes));
  const alvo = opts.finalidade?.trim().toLowerCase();
  return rows
    .map(({ label, sessionName, ...r }) => ({ ...r, nome: label?.trim() || sessionName }))
    .filter((r) => !alvo || r.finalidade?.trim().toLowerCase() === alvo)
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.nome.localeCompare(b.nome, "pt-BR"));
}

/** O número é operacional e utilizável agora (desta organização, conectado, não privado)? */
export async function sessaoEhOperacional(organizacaoId: string, sessaoId: string | null | undefined): Promise<boolean> {
  if (!sessaoId) return false;
  const [s] = await db.select({ operacional: whatsappSessao.operacional, privado: whatsappSessao.privado, status: whatsappSessao.status })
    .from(whatsappSessao).where(and(eq(whatsappSessao.id, sessaoId), eq(whatsappSessao.organizacaoId, organizacaoId))).limit(1);
  return Boolean(s) && numeroOperacional(s) && s.status === "connected";
}

/**
 * Liga ou desliga o número no pool operacional. Recusa número privado (com a
 * mensagem, em vez do erro cru do CHECK) e número de outra organização.
 * Quem chama confere o papel (gestão) e grava auditoria, como faz com `privado`.
 */
export async function marcarOperacional(organizacaoId: string, sessaoId: string, operacional: boolean): Promise<void> {
  const [s] = await db.select({ privado: whatsappSessao.privado }).from(whatsappSessao)
    .where(and(eq(whatsappSessao.id, sessaoId), eq(whatsappSessao.organizacaoId, organizacaoId))).limit(1);
  if (!s) throw new ErroDeNumero("Número não encontrado nesta organização.");
  const motivo = validarMarcacaoDoNumero({ privado: s.privado, operacional });
  if (motivo) throw new ErroDeNumero(motivo);
  await db.update(whatsappSessao).set({ operacional, updatedAt: new Date() })
    .where(and(eq(whatsappSessao.id, sessaoId), eq(whatsappSessao.organizacaoId, organizacaoId)));
}

/** Número candidato à escolha automática (linha de `whatsapp_sessao`, só o que decide). */
export interface CandidatoDeNumero {
  id: string;
  usuarioId?: string | null;
  privado?: boolean | null;
  operacional?: boolean | null;
  status?: string | null;
  isDefault?: boolean | null;
}

/**
 * Escolha AUTOMÁTICA de número (nenhuma pessoa apontou o remetente): a regra
 * única para quem só tem a organização e o responsável na mão. Ordem:
 *
 *   1. número OPERACIONAL conectado do responsável (o padrão dele primeiro);
 *   2. qualquer número operacional conectado da organização (padrão primeiro);
 *   3. FALLBACK — número não privado do responsável, conectado e depois
 *      qualquer um, que é exatamente o que o lembrete de reunião fazia antes.
 *
 * Número PRIVADO nunca entra: automática é a máquina falando, e ela não fala
 * pelo WhatsApp pessoal de ninguém (escolha explícita pelo dono continua em
 * `escolherSessao`, com `preferidaId`).
 *
 * O passo 3 existe porque em 20/10/2026 NENHUM número de produção está marcado
 * como operacional: sem fallback, o lembrete de reunião pararia de sair no dia
 * em que esta regra entrou — e lembrete que some é pior que lembrete pelo
 * número errado. Quando a operação marcar o pool (Ajustes › WhatsApp), o passo
 * 1/2 passa a ganhar sozinho e o fallback deixa de ser usado; ele fica como
 * rede, não como caminho normal.
 *
 * Devolve `null` quando não há número nenhum — quem chama decide o que fazer
 * (o lembrete segue sem `sessaoId`, como antes).
 */
export function escolherNumeroAutomatico(
  numeros: CandidatoDeNumero[],
  responsavelId: string | null | undefined,
): string | null {
  const naoPrivados = numeros.filter((n) => !n.privado);
  const conectados = naoPrivados.filter((n) => n.status === "connected");
  const padraoPrimeiro = (lista: CandidatoDeNumero[]) => lista.find((n) => n.isDefault) ?? lista[0] ?? null;
  const doResponsavel = (lista: CandidatoDeNumero[]) =>
    responsavelId ? lista.filter((n) => n.usuarioId === responsavelId) : [];
  const operacionais = conectados.filter((n) => n.operacional);

  const escolhido =
    padraoPrimeiro(doResponsavel(operacionais)) ??
    padraoPrimeiro(operacionais) ??
    padraoPrimeiro(doResponsavel(conectados)) ??
    padraoPrimeiro(doResponsavel(naoPrivados));
  return escolhido?.id ?? null;
}

/**
 * Agente preso ao POOL operacional (`guardrail_config.canais.pool = "operacional"`):
 * atende e abre conversa só nos números operacionais, em vez de um número fixo.
 * Decisão de 20/10/2026 para a Lia: a versão publicada estava presa a um número
 * que não existe mais e não respondia em lugar nenhum; agora vale o pool, e os
 * números entram e saem dele por Ajustes › WhatsApp, sem republicar o agente.
 */
export function usaPoolOperacional(guardrailConfig: unknown): boolean {
  const canais = (guardrailConfig as { canais?: { pool?: unknown } } | null | undefined)?.canais;
  return canais?.pool === "operacional";
}
