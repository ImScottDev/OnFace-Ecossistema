/**
 * Permissão delegada ao agente (SPEC §31).
 *
 * A frase do SPEC é literal: *"NEXO and Hermes use an AI actor context and
 * cannot exceed the permissions delegated to the run."*
 *
 * Hoje as ferramentas passam pelos adapters de domínio, o que impede a IA de
 * escrever direto no banco. Mas **nenhuma verifica permissão**: um agente
 * configurado com a ferramenta de mover etapa move a etapa de qualquer
 * oportunidade, independentemente de quem o acionou poder fazer isso.
 *
 * O risco concreto: NEXO é operado por conversa. Se um SDR pede ao NEXO uma
 * ação que o papel dele não permite, e o agente executa, o RBAC inteiro vira
 * decoração — basta pedir ao robô.
 *
 * ## O teto é a INTERSEÇÃO, não a união
 *
 * O agente nunca pode mais que:
 *
 *   1. a versão dele — o que foi configurado que aquele agente faz;
 *   2. quem o acionou — o usuário por trás da conversa, quando existe.
 *
 * Interseção, porque união deixaria um agente poderoso emprestar poder a um
 * usuário limitado, e um usuário poderoso emprestar poder a um agente que
 * ninguém autorizou a tanto.
 *
 * Hermes roda por evento e não tem usuário; o teto dele é só a versão. Por isso
 * a versão nasce restrita, e ampliar é decisão explícita de quem opera.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { permissoesDoUsuario, type CodigoPermissao } from "@/lib/auth/permissoes";
import { permissoesEfetivas } from "@/lib/auth/permissoes";

/**
 * Permissão que cada ferramenta exige.
 *
 * Só ferramenta que MUTA aparece aqui: leitura de contexto é o que o agente
 * precisa para responder, e negá-la o tornaria inútil sem proteger nada — o
 * dado já passou pelo gate da conversa.
 */
export const PERMISSAO_POR_FERRAMENTA: Record<string, CodigoPermissao> = {
  "task.create": "acquisition.manage",
  "lead.update_status": "acquisition.manage",
  "lead.qualify": "acquisition.manage",
  "lead.tag": "acquisition.manage",
  "activity.note": "acquisition.manage",
  "contact.propose_field": "acquisition.manage",
  "deal.advance": "sales.manage",
  "meeting.schedule": "sales.manage", "meeting.reschedule": "sales.manage", "meeting.cancel": "sales.manage",
  "followup.enroll": "automation.manage",
  "followup.cancel": "automation.manage",
  "cadence.pause": "automation.manage",
  "callface.call": "acquisition.manage",
  // Memória e retomada própria do agente: gravam fato e agendam contato sobre uma pessoa, então exigem a mesma permissão de quem trabalha o lead.
  "memory.remember": "acquisition.manage", "followup.schedule": "acquisition.manage", "followup.resume_cancel": "acquisition.manage",
  // NEXO (chat do ecossistema): leitura também é gateada pelo papel, porque o
  // painel age COMO o usuário. As escritas checam dentro da ferramenta, porque
  // a permissão depende do alvo (lead x oportunidade).
  "nexo.agenda": "sales.read", "nexo.leads": "acquisition.read", "nexo.entradas": "acquisition.read", "nexo.horarios_entrada": "acquisition.read", "nexo.pipeline": "sales.read",
  "nexo.criar_atividade": "acquisition.manage", "nexo.editar_atividade": "acquisition.manage", "nexo.excluir_atividade": "acquisition.manage",
  "nexo.criar_nota": "acquisition.manage", "nexo.tag": "acquisition.manage", "nexo.decidir_lead": "acquisition.manage", "nexo.criar_lead": "acquisition.manage",
  "nexo.mover_etapa": "acquisition.manage", "nexo.atribuir_responsavel": "acquisition.manage", "nexo.criar_empresa_contato": "companies.write",
  "nexo.agendar_reuniao": "sales.manage", "nexo.criar_oportunidade": "sales.manage", "nexo.perder_oportunidade": "sales.manage",
  "nexo.incluir_em_cadencia": "automation.manage",
  // Responder WhatsApp em nome do usuário é escrita no atendimento, mesma família de quem assume a conversa.
  "nexo.enviar_whatsapp": "acquisition.manage",
  "nexo.propostas": "sales.read", "nexo.clientes": "cs.read", "nexo.conversas": "acquisition.read", "nexo.nao_respondidas": "acquisition.read",
  // Fora daqui, de propósito: `handoff.request`, `case.open` e `alert.create`
  // são o que o agente faz quando NÃO pode agir — pedir ajuda, abrir caso,
  // levantar alerta. Um agente que não consegue pedir socorro é pior que um sem
  // permissão nenhuma, porque falha em silêncio. Nenhuma delas toca dado de
  // negócio: escrevem em fila de trabalho humano, e o abuso possível é volume,
  // que é limitação de taxa e não de permissão.
  //
  // `skill.activate`, `message.prepare` e `response.classify` também ficam
  // fora: preparam a resposta, não mudam estado.
};

export interface DelegacaoDoRun {
  permissoes: Set<CodigoPermissao>;
  /** De onde veio o teto, para o log dizer por que negou. */
  origem: "versao+usuario" | "versao" | "nenhuma";
}

/**
 * Resolve o teto de permissão de uma execução.
 *
 * Sem configuração na versão, o agente fica **sem permissão de escrita**. O
 * padrão restritivo é deliberado: um agente que nasce podendo tudo é uma porta
 * que ninguém abriu de propósito.
 */
export async function delegacaoDoRun(params: {
  organizacaoId: string;
  agentVersionId?: string | null;
  /** Usuário que acionou o agente. Hermes, acionado por evento, não tem. */
  usuarioId?: string | null;
}): Promise<DelegacaoDoRun> {
  const daVersao = new Set<CodigoPermissao>();

  if (params.agentVersionId) {
    const linhas = await db.execute<{ permissoes: string[] | null }>(sql`
      SELECT COALESCE(guardrail_config -> 'permissoes', '[]'::jsonb) AS permissoes
        FROM ai_agent_versions
       WHERE id = ${params.agentVersionId}::uuid
         AND organizacao_id = ${params.organizacaoId}::uuid`);
    for (const p of linhas[0]?.permissoes ?? []) daVersao.add(p as CodigoPermissao);
  }

  if (daVersao.size === 0) return { permissoes: new Set(), origem: "nenhuma" };
  if (!params.usuarioId) return { permissoes: daVersao, origem: "versao" };

  // Interseção com quem acionou: o agente não empresta poder a ninguém, e
  // ninguém empresta poder ao agente.
  const doUsuario = await permissoesDoUsuario(params.usuarioId, params.organizacaoId);
  const intersecao = new Set<CodigoPermissao>();
  for (const p of daVersao) if (doUsuario.has(p)) intersecao.add(p);
  return { permissoes: intersecao, origem: "versao+usuario" };
}

/** O NEXO executa como a pessoa, limitado também pela política da versão interna. */
export async function permissoesDoNexo(params: {
  organizacaoId: string; agentVersionId: string; usuarioId: string; usuarioPapel: string | null;
}): Promise<Set<CodigoPermissao>> {
  const versao = await delegacaoDoRun({ organizacaoId: params.organizacaoId, agentVersionId: params.agentVersionId });
  if (versao.origem === "nenhuma") return new Set();
  const usuario = await permissoesEfetivas({ usuarioId: params.usuarioId, organizacaoId: params.organizacaoId, role: params.usuarioPapel });
  return new Set([...versao.permissoes].filter((codigo) => usuario.has(codigo)));
}

export interface VerificacaoFerramenta {
  permitido: boolean;
  /** Permissão que faltou, para o log e para a mensagem ao agente. */
  exigida?: CodigoPermissao;
}

/** A ferramenta pode rodar nesta execução? */
export function ferramentaPermitida(
  nomeOuId: string, delegacao: DelegacaoDoRun,
): VerificacaoFerramenta {
  const exigida = PERMISSAO_POR_FERRAMENTA[nomeOuId];
  // Ferramenta sem permissão mapeada é leitura ou pedido de ajuda: passa.
  if (!exigida) return { permitido: true };
  return { permitido: delegacao.permissoes.has(exigida), exigida };
}
