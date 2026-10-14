/**
 * Leitura do drawer de um prospect: tudo vem de tabelas que já existem e das
 * mesmas leituras que Pré-vendas e as fichas usam (`detalheLead`,
 * `lerLinhaDoTempo`, `enriquecimentoDaEmpresa`). Nada inventado: aba sem dado
 * devolve vazio e a tela diz isso.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { detalheLead, passoDaCadencia, type DetalheLead } from "./consultas";
import { lerLinhaDoTempo, type LinhaDoTempo } from "./eventos";
import { enriquecimentoDaEmpresa, type EnriquecimentoDaEmpresa } from "./ficha-extras";
import { ROTULO_ESTADO_PROSPECCAO, type EstadoProspeccao } from "./dominio";
import { sessaoPrivada, condicaoComunicacaoNaoPrivada } from "@/lib/whatsapp/acesso";

export interface PassoDaCadencia {
  id: string;
  ordem: number;
  /** `executado` | `atual` | `pendente` | `erro` */
  situacao: "executado" | "atual" | "pendente" | "erro";
  titulo: string;
  quando: string | null;
}

export interface CadenciaDoProspect {
  enrollmentId: string;
  nome: string;
  status: string;
  passoAtual: number | null;
  passosExecutados: number | null;
  totalPassos: number;
  proximaAcaoEm: string | null;
  ultimaExecucaoEm: string | null;
  iniciadaEm: string;
  motivoDeParada: string | null;
  passos: PassoDaCadencia[];
}

export interface ConversaDoProspect {
  id: string;
  canal: string;
  direcao: "in" | "out" | null;
  resumo: string;
  em: string;
}

export interface DetalheDoProspect {
  leadId: string;
  estado: EstadoProspeccao;
  estadoRotulo: string;
  lead: DetalheLead;
  descarte: { motivo: string | null; em: string | null } | null;
  fonte: string | null;
  lista: string | null;
  /** Outras pessoas da mesma empresa que já existem no diretório. */
  outrasPessoas: Array<{ id: string; nome: string; cargo: string | null; email: string | null; telefone: string | null; leadId: string | null }>;
  cadencia: CadenciaDoProspect | null;
  conversas: { total: number; recebidas: number; enviadas: number; ultimas: ConversaDoProspect[]; hrefAtendimento: string };
  historico: LinhaDoTempo[];
  inteligencia: {
    sinais: Array<{ rotulo: string; valor: string; tom: "ok" | "aviso" | "neutro" }>;
    faltando: string[];
    empresa: EnriquecimentoDaEmpresa | null;
    leadScore: number | null;
  };
}

const ROTULO_ADAPTER: Record<string, string> = {
  noop: "Passo de acompanhamento", whatsapp: "WhatsApp", email: "E-mail", ai_agent_message: "Mensagem pelo Callpilot",
  whatsapp_template: "WhatsApp (modelo)", ai_classify: "Classificação por IA", crm_create_task: "Tarefa manual",
  crm_add_tag: "Adicionar tag", crm_remove_tag: "Remover tag", crm_update_stage: "Atualizar etapa",
  crm_assign_owner: "Atribuir responsável", crm_add_note: "Registrar nota", crm_callface_call: "Ligação",
};

type EventoDoMotor = { step_id: string; status: string; created_at: string };

export async function detalheDoProspect(organizacaoId: string, leadId: string): Promise<DetalheDoProspect | null> {
  const [base] = await db.execute<{
    estado: string; descarte_motivo: string | null; descartado_em: string | null; fonte: string | null; lista: string | null;
  }>(sql`
    SELECT l.prospeccao_estado AS estado, l.prospeccao_descarte_motivo AS descarte_motivo,
           l.prospeccao_descartado_em::text AS descartado_em,
           (SELECT COALESCE(pc.source, pc.tipo_origem) FROM pontos_contato pc
             WHERE pc.lead_id_legado = l.id ORDER BY pc.is_first_touch DESC, pc.ocorrido_em ASC LIMIT 1) AS fonte,
           (SELECT lb.nome FROM lead_labels ll JOIN labels lb ON lb.id = ll.label_id
             WHERE ll.lead_id = l.id ORDER BY lb.nome LIMIT 1) AS lista
      FROM leads l
     WHERE l.id = ${leadId}::uuid AND l.organizacao_id = ${organizacaoId}::uuid AND l.prospeccao_estado IS NOT NULL`);
  if (!base) return null;

  const [lead, historico, cadencia, conversas] = await Promise.all([
    detalheLead(organizacaoId, leadId),
    lerLinhaDoTempo({ organizacaoId, leadId, limite: 60 }),
    cadenciaDoProspect(organizacaoId, leadId),
    conversasDoProspect(organizacaoId, leadId),
  ]);
  if (!lead) return null;

  const empresa = lead.empresa.id ? await enriquecimentoDaEmpresa(organizacaoId, lead.empresa.id) : null;
  const outras = lead.empresa.id ? await db.execute<{ id: string; nome: string; cargo: string | null; email: string | null; telefone: string | null; lead_id: string | null }>(sql`
    SELECT p.id::text, trim(concat_ws(' ', p.nome, p.sobrenome)) AS nome, p.cargo, p.email, p.telefone, p.lead_id_legado::text AS lead_id
      FROM pessoas p
     WHERE p.organizacao_id = ${organizacaoId}::uuid AND p.empresa_id = ${lead.empresa.id}::uuid
       AND (p.lead_id_legado IS NULL OR p.lead_id_legado <> ${leadId}::uuid)
     ORDER BY p.created_at LIMIT 10`) : [];
  const estado = base.estado as EstadoProspeccao;

  const sinais: DetalheDoProspect["inteligencia"]["sinais"] = [];
  if (conversas.recebidas > 0) sinais.push({ rotulo: "Respostas recebidas", valor: String(conversas.recebidas), tom: "ok" });
  if (estado === "respondeu") sinais.push({ rotulo: "Estado", valor: "Respondeu: aguardando decisão", tom: "ok" });
  if (cadencia && cadencia.passosExecutados != null) {
    sinais.push({ rotulo: "Abordagens executadas", valor: `${cadencia.passosExecutados} de ${cadencia.totalPassos}`, tom: "neutro" });
  }
  if (cadencia?.status === "failed") sinais.push({ rotulo: "Cadência", valor: "Falhou: revisar passo", tom: "aviso" });
  if (empresa?.deApollo) sinais.push({ rotulo: "Dados da empresa", valor: "Enriquecidos pelo Apollo", tom: "neutro" });
  if (lead.leadScore > 0) sinais.push({ rotulo: "Lead score", valor: String(lead.leadScore), tom: "neutro" });

  const faltando: string[] = [];
  if (!lead.pessoa.email) faltando.push("E-mail");
  if (!lead.pessoa.telefone && !lead.pessoa.whatsapp) faltando.push("Telefone ou WhatsApp");
  if (!lead.pessoa.cargo) faltando.push("Cargo");
  if (!lead.empresa.setor) faltando.push("Setor da empresa");
  if (!lead.empresa.website) faltando.push("Site da empresa");
  if (!lead.responsavel.id) faltando.push("Responsável");

  return {
    leadId, estado, estadoRotulo: ROTULO_ESTADO_PROSPECCAO[estado],
    lead,
    descarte: estado === "descartado" ? { motivo: base.descarte_motivo, em: base.descartado_em } : null,
    fonte: base.fonte, lista: base.lista,
    outrasPessoas: outras.map((o) => ({ id: o.id, nome: o.nome, cargo: o.cargo, email: o.email, telefone: o.telefone, leadId: o.lead_id })),
    cadencia, conversas, historico,
    inteligencia: { sinais, faltando, empresa, leadScore: lead.leadScore > 0 ? lead.leadScore : null },
  };
}

/** A matrícula mais recente, com os passos e a situação de cada um. */
async function cadenciaDoProspect(organizacaoId: string, leadId: string): Promise<CadenciaDoProspect | null> {
  const [ce] = await db.execute<{
    id: string; nome: string; status: string; atual: string | null; proxima: string | null; iniciada: string;
    motivo: string | null; passos: unknown;
  }>(sql`
    SELECT ce.id::text, cd.nome, ce.status, ce.current_step_id AS atual, ce.scheduled_at::text AS proxima,
           ce.started_at::text AS iniciada, ce.cancel_reason AS motivo,
           COALESCE(cv.compiled_steps, cd.steps, '[]'::jsonb) AS passos
      FROM cadence_enrollments ce
      JOIN cadence_definitions cd ON cd.id = ce.cadence_definition_id
      LEFT JOIN cadence_versions cv ON cv.id = ce.cadence_version_id
     WHERE ce.organizacao_id = ${organizacaoId}::uuid AND ce.entity_type = 'lead' AND ce.entity_id = ${leadId}::uuid
     ORDER BY ce.started_at DESC LIMIT 1`);
  if (!ce) return null;

  const eventos = await db.execute<EventoDoMotor>(sql`
    SELECT step_id, status, created_at::text FROM cadence_enrollment_events
     WHERE enrollment_id = ${ce.id}::uuid ORDER BY created_at`);

  type Passo = { id: string; tipo: string; adapter?: string; titulo?: string; nome?: string; config?: { title?: string } };
  const acoes = (Array.isArray(ce.passos) ? (ce.passos as Passo[]) : []).filter((p) => p.tipo === "action");
  const feitos = new Map(eventos.filter((e) => e.status === "executado").map((e) => [e.step_id, e.created_at]));
  const comErro = new Set(eventos.filter((e) => e.status === "erro").map((e) => e.step_id));
  const viva = ["active", "waiting", "waiting_reply"].includes(ce.status);

  let achouAtual = false;
  const passos: PassoDaCadencia[] = acoes.map((p, i) => {
    const feito = feitos.get(p.id);
    let situacao: PassoDaCadencia["situacao"] = "pendente";
    if (feito) situacao = "executado";
    else if (comErro.has(p.id)) situacao = "erro";
    else if (viva && !achouAtual) { situacao = "atual"; achouAtual = true; }
    return {
      id: p.id, ordem: i + 1, situacao,
      titulo: p.config?.title || p.titulo || p.nome || (p.adapter ? ROTULO_ADAPTER[p.adapter] ?? p.adapter.replace(/_/g, " ") : `Passo ${i + 1}`),
      quando: feito ?? null,
    };
  });

  const executadas = [...feitos.values()].sort();
  const { passoAtual, passosExecutados } = passoDaCadencia(ce.status, feitos.size, acoes.length);
  return {
    enrollmentId: ce.id, nome: ce.nome, status: ce.status,
    passoAtual, passosExecutados, totalPassos: acoes.length,
    proximaAcaoEm: viva ? ce.proxima : null,
    ultimaExecucaoEm: executadas.length ? executadas[executadas.length - 1] : null,
    iniciadaEm: ce.iniciada,
    motivoDeParada: ["paused", "cancelled"].includes(ce.status) ? ce.motivo : null,
    passos,
  };
}

/**
 * Conversas do prospect: as mensagens que o Atendimento já guarda (WhatsApp por
 * lead e comunicações por pessoa). Não existe caixa nova: o botão leva ao
 * Atendimento, já filtrado no lead.
 */
async function conversasDoProspect(organizacaoId: string, leadId: string): Promise<DetalheDoProspect["conversas"]> {
  const linhas = await db.execute<{ id: string; canal: string; direcao: string | null; resumo: string | null; em: string }>(sql`
    SELECT * FROM (
      SELECT m.id::text, 'whatsapp' AS canal, m.direcao, left(COALESCE(m.conteudo, '[' || m.tipo || ']'), 160) AS resumo, m.created_at::text AS em
        FROM whatsapp_mensagens m
       WHERE m.lead_id = ${leadId}::uuid
         -- Número privado não aparece aqui: a ficha do prospect é vista por todo o
         -- comercial, e o trecho de 160 caracteres é conteúdo da conversa.
         AND NOT ${sessaoPrivada(sql`m.sessao_id`)}
      UNION ALL
      SELECT c.id::text, c.canal, c.direcao, left(COALESCE(NULLIF(c.summary, ''), c.conteudo, ''), 160), c.ocorrido_em::text
        FROM communications c
       WHERE c.organizacao_id = ${organizacaoId}::uuid AND c.canal <> 'whatsapp'
         AND ${condicaoComunicacaoNaoPrivada("c")}
         AND c.pessoa_id IN (SELECT id FROM pessoas WHERE lead_id_legado = ${leadId}::uuid)
    ) x ORDER BY em DESC LIMIT 200`);
  return {
    total: linhas.length,
    recebidas: linhas.filter((l) => l.direcao === "in").length,
    enviadas: linhas.filter((l) => l.direcao === "out").length,
    ultimas: linhas.slice(0, 8).map((l) => ({
      id: l.id, canal: l.canal, direcao: l.direcao === "in" || l.direcao === "out" ? l.direcao : null,
      resumo: l.resumo ?? "", em: l.em,
    })),
    hrefAtendimento: `/atendimento?leadId=${encodeURIComponent(leadId)}`,
  };
}
