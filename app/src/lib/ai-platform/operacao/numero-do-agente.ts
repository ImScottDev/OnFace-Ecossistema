/**
 * Quem escreve no número de um agente é atendido por ele.
 *
 * Sintoma (20/10/2026, produção): a Lia respondia quem já tinha cadastro e
 * ficava calada com número novo. Duas causas no caminho da mensagem recebida:
 *
 *  1. Conversa nova nasce com o responsável que o número dá (dono do número
 *     pessoal, rodízio entre PESSOAS no compartilhado, ou ninguém). Como nem a
 *     conversa nem o lead tinham a agente como responsável, a mensagem caía na
 *     regra "resposta automática só quando alguém liga a IA na conversa"
 *     (12/10) — que vale para número de gente, não para o número da própria
 *     agente.
 *  2. Depois de um handoff a conversa ficava "IA pausada" para sempre: se
 *     ninguém do time respondesse, o cliente voltava a escrever e ficava no
 *     vácuo, sem prazo.
 *
 * Regra (decisão do Scott, 20/10): no número em que um agente atende — o
 * mesmo critério que Ajustes › WhatsApp mostra em "Agente que atende por
 * aqui": versão presa ao número, ou agente no pool operacional e número
 * operacional — o agente responde QUALQUER pessoa. Sem cadastro, ele cria o
 * lead em Pré-vendas com o nome do perfil do WhatsApp e conduz pela atribuição
 * (ciclo completo de `acionarAgente`: lease, deduplicação, horário, taxa,
 * política de canal).
 *
 * Fica calado só quando há motivo de verdade:
 *   - o contato pediu para parar (opt-out);
 *   - uma pessoa pausou a IA nesta conversa (botão do Atendimento);
 *   - uma pessoa do time escreveu nesta conversa nas últimas horas
 *     (`JANELA_HUMANO_HORAS`): é atendimento humano em andamento.
 * Handoff sem ninguém respondendo NÃO é motivo: o agente retoma, com nota na
 * linha do tempo, em vez de deixar o cliente sem resposta.
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiSdrContatoState, contatos } from "@/lib/db/schema";
import { leadPorTelefone, ligarConversaAoLead } from "@/lib/atendimento/lead-da-conversa";
import { optOutAtivo } from "./politica-canal";
import { atribuicaoViva, humanoAtendendoRecentemente, retomarAtribuicao } from "./atribuicoes";
import { acionarAgente, EVENTO_MENSAGEM, type ResultadoAcionar } from "./acionar";

export interface AgenteDoNumero { agentId: string; nome: string; slug: string; usuarioId: string | null }

/**
 * Agente que atende por este número, ou null. Mesmo critério da tela de
 * números (`GET /whatsapp/numeros`): versão publicada presa ao número vence;
 * depois o agente dono do número; depois agente no pool operacional quando o
 * número é operacional. Número privado nunca tem agente.
 */
export async function agenteDoNumero(organizacaoId: string, sessaoId: string | null | undefined): Promise<AgenteDoNumero | null> {
  if (!sessaoId) return null;
  const [a] = await db.execute<{ agent_id: string; nome: string; slug: string; usuario_id: string | null }>(sql`
    SELECT a.id::text AS agent_id, a.nome, a.slug, ua.id::text AS usuario_id
      FROM whatsapp_sessao s
      JOIN ai_agents a ON a.organizacao_id = s.organizacao_id AND a.status = 'published' AND a.archived_at IS NULL
      JOIN ai_agent_versions v ON v.id = a.published_version_id
      LEFT JOIN usuarios dono ON dono.id = s.usuario_id
      LEFT JOIN usuarios ua ON ua.agente_id = a.id AND ua.organizacao_id = a.organizacao_id
     WHERE s.id = ${sessaoId}::uuid AND s.organizacao_id = ${organizacaoId}::uuid AND NOT s.privado
       AND (v.channel_session_id = s.id
            OR dono.agente_id = a.id
            OR (s.operacional AND v.guardrail_config->'canais'->>'pool' = 'operacional'))
     ORDER BY (v.channel_session_id = s.id) DESC, (dono.agente_id = a.id) DESC, a.prioridade DESC
     LIMIT 1`);
  return a ? { agentId: a.agent_id, nome: a.nome, slug: a.slug, usuarioId: a.usuario_id } : null;
}

export type ResultadoNumeroDoAgente =
  | { tratado: false }
  | { tratado: true; resultado: ResultadoAcionar["resultado"] | "calado"; motivo?: string; leadCriado?: boolean };

/** Por que o agente fica calado nesta conversa do número dele, ou null para responder. Ver o topo do arquivo. */
export async function motivoParaCalar(organizacaoId: string, contatoId: string): Promise<string | null> {
  if (await optOutAtivo(organizacaoId, contatoId)) return "opt_out";
  const [estado] = await db.select({ ativo: aiSdrContatoState.aiAtivo, motivo: aiSdrContatoState.handoffMotivo })
    .from(aiSdrContatoState).where(eq(aiSdrContatoState.contatoId, contatoId)).limit(1);
  if (estado && !estado.ativo && estado.motivo === "manual_toggle") return "pausada_por_pessoa";
  const viva = await atribuicaoViva(organizacaoId, { contatoId });
  if (viva?.status === "pausada") return "pausada_por_pessoa";
  if (await humanoAtendendoRecentemente(contatoId)) return "pessoa_atendendo";
  return null;
}

/** Lead em Pré-vendas para quem escreveu sem cadastro, com o nome do perfil do WhatsApp. */
async function garantirLead(p: { organizacaoId: string; contatoId: string; agente: AgenteDoNumero }): Promise<{ leadId: string | null; criado: boolean }> {
  const [c] = await db.select({ leadId: contatos.leadId, nome: contatos.nome, telefone: contatos.telefone })
    .from(contatos).where(and(eq(contatos.id, p.contatoId), eq(contatos.organizacaoId, p.organizacaoId))).limit(1);
  if (!c) return { leadId: null, criado: false };
  if (c.leadId) return { leadId: c.leadId, criado: false };
  const digitos = (c.telefone ?? "").replace(/\D/g, "");
  // Identificador interno do WhatsApp (LID, 14+ dígitos) não é telefone: sem número de verdade não
  // há como cadastrar a pessoa; o agente conversa assim mesmo e o lead nasce quando houver dado.
  if (digitos.length < 10 || digitos.length > 13) return { leadId: null, criado: false };
  // Já existe lead com este telefone: só liga a conversa a ele (porta única do casamento).
  const casado = await ligarConversaAoLead({ organizacaoId: p.organizacaoId, contatoId: p.contatoId, telefone: digitos });
  if (casado) return { leadId: casado, criado: false };

  /* O vínculo pode ser RECUSADO sem que falte lead: `idx_contatos_lead_responsavel`
     é único por (lead, responsável), então quando o mesmo número já tem outra
     conversa ligada àquele lead com o mesmo atendente, `ligarConversaAoLead`
     devolve null de propósito — protegendo a tabela `contatos`.
     Medido em produção (21/10/2026): 1.377 conversas sem lead, 77 com lead
     casável por telefone, e 75 dessas travadas exatamente aqui. O preço era o
     agente rodar CEGO: sem `leadId`, `lead.qualify`, `task.create`, `lead.tag`,
     `agenda.slots` e as de reunião recusam na entrada — a Lia extraiu uma
     qualificação completa em 20/10 e o backend respondeu "lead ausente".
     O índice protege a GRAVAÇÃO do vínculo, não a execução: para ESTA execução
     o lead do número vale, mesmo sem gravar a ligação. */
  const soParaEstaExecucao = await leadPorTelefone(p.organizacaoId, digitos);
  if (soParaEstaExecucao) return { leadId: soParaEstaExecucao, criado: false };

  const { criarLead } = await import("@/lib/vendas/pre-vendas");
  const [primeiro, ...resto] = (c.nome?.trim() || "Contato do WhatsApp").split(/\s+/);
  const criado = await criarLead({
    organizacaoId: p.organizacaoId,
    empresa: null,
    pessoa: { nome: primeiro, sobrenome: resto.length ? resto.join(" ") : null, telefone: digitos, whatsapp: digitos },
    touchpoint: { tipoOrigem: "organica", source: "whatsapp", medium: "mensagem", raw: { contatoId: p.contatoId, agente: p.agente.slug } },
    origem: "WhatsApp",
  }, { tipo: "AI_AGENT", usuarioId: p.agente.usuarioId, ref: p.agente.slug });
  const ligado = await ligarConversaAoLead({ organizacaoId: p.organizacaoId, contatoId: p.contatoId, telefone: digitos });
  return { leadId: ligado ?? criado.leadId, criado: !criado.reaproveitado };
}

/**
 * Mensagem recebida numa conversa: se o número é de um agente, ele atende (ver topo).
 * `tratado: false` = o número não tem agente; quem chama segue o fluxo de sempre.
 */
export async function atenderPeloNumeroDoAgente(p: {
  organizacaoId: string; contatoId: string; leadId: string | null; sessaoId: string | null;
  mensagem: string; sourceMessageId?: string | null;
}): Promise<ResultadoNumeroDoAgente> {
  const agente = await agenteDoNumero(p.organizacaoId, p.sessaoId);
  if (!agente) return { tratado: false };

  // Outro agente já conduz esta conversa: é dele (o fluxo de atribuição do chamador resolve).
  const viva = await atribuicaoViva(p.organizacaoId, { contatoId: p.contatoId, leadId: p.leadId });
  if (viva && viva.agentId !== agente.agentId && viva.status !== "humano") return { tratado: false };

  const calar = await motivoParaCalar(p.organizacaoId, p.contatoId);
  if (calar) return { tratado: true, resultado: "calado", motivo: calar };

  let leadId = p.leadId;
  let leadCriado = false;
  if (!leadId) {
    try {
      const g = await garantirLead({ organizacaoId: p.organizacaoId, contatoId: p.contatoId, agente });
      leadId = g.leadId;
      leadCriado = g.criado;
    } catch (err) {
      // Cadastro falhou (dado estranho, regra de negócio): o cliente ainda é atendido.
      console.error(`[numero-do-agente] não criou lead para o contato ${p.contatoId}:`, err);
    }
  }

  // Handoff sem ninguém atendendo (nenhuma pessoa escreveu na janela, acima): o agente retoma.
  // Atribuição em "humano" de OUTRO agente é encerrada pela própria atribuição nova (sobrepoeHumano).
  if (viva?.status === "humano" && viva.agentId === agente.agentId) {
    await retomarAtribuicao({ organizacaoId: p.organizacaoId, atribuicaoId: viva.id, ator: { rotulo: "cliente voltou a escrever e ninguém do time estava atendendo" } });
  }

  const r = await acionarAgente({
    organizacaoId: p.organizacaoId, agentId: agente.agentId, contatoId: p.contatoId, leadId,
    evento: EVENTO_MENSAGEM, mensagem: p.mensagem, sourceMessageId: p.sourceMessageId ?? null,
    origem: "numero_do_agente",
    atribuir: { origem: "evento", origemRef: "numero_do_agente", objetivo: `Atender quem escreveu no número de ${agente.nome}`, sobrepoeHumano: viva?.status === "humano" },
  });
  return { tratado: true, resultado: r.resultado, motivo: r.motivo, leadCriado };
}
