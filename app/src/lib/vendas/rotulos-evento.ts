/* ─────────────────────────────────────────────────────────────────────────
 * Rótulos em português dos tipos de evento da timeline.
 *
 * A projeção canônica grava o tipo em inglês (`OpportunityStageChanged`,
 * `MeetingScheduled`, `PRE_SALES`…). Sem tradução, o nome técnico vazava cru
 * para a timeline da oportunidade e do lead. Este é o lugar único que converte.
 * ───────────────────────────────────────────────────────────────────────── */

import { ROTULO_ETAPA_PIPELINE, ROTULO_ETAPA_PRE_VENDAS } from "./dominio";

const ROTULO_EVENTO: Record<string, string> = {
  // Pré-vendas
  leadcreated: "Lead criado",
  leadassigned: "Lead atribuído",
  firstcontactmade: "Primeiro contato",
  stagechanged: "Mudança de etapa",
  qualificationstarted: "Qualificação iniciada",
  leadqualified: "Lead qualificado",
  leadnurtured: "Movido para nutrição",
  leaddisqualified: "Lead desqualificado",
  leadreactivated: "Lead reativado",
  ownerchanged: "Responsável alterado",
  // Pipeline
  opportunitycreated: "Oportunidade criada",
  opportunityassigned: "Oportunidade atribuída",
  opportunityfamilychanged: "Família alterada",
  opportunitystagechanged: "Mudança de etapa",
  opportunitystalled: "Oportunidade parada",
  opportunitylost: "Oportunidade perdida",
  opportunitywon: "Oportunidade ganha",
  nextactionset: "Próxima ação definida",
  // Reuniões
  meetingscheduled: "Reunião agendada",
  meetingrescheduled: "Reunião remarcada",
  meetingcompleted: "Reunião realizada",
  meetingcancelled: "Reunião cancelada",
  meetingnoshow: "Não compareceu",
  // Trial
  trialstarted: "Trial iniciado",
  trialended: "Trial encerrado",
  // Propostas
  proposalcreated: "Proposta criada",
  proposalsent: "Proposta enviada",
  proposaledited: "Proposta editada",
  proposaldeleted: "Rascunho de proposta excluído",
  proposalviewed: "Proposta visualizada",
  proposalaccepted: "Proposta aceita",
  proposalrejected: "Proposta recusada",
  proposalexpired: "Proposta expirada",
  proposalsuperseded: "Proposta substituída",
  proposaladjustmentrequested: "Ajuste solicitado",
  // Contrato e pagamento
  contractcreated: "Contrato criado",
  contractsigned: "Contrato assinado",
  paymentcreated: "Cobrança criada",
  paymentconfirmed: "Pagamento confirmado",
  // Prospecção
  prospectadded: "Prospect adicionado",
  prospectimported: "Prospect importado",
  prospectenriched: "Prospect enriquecido",
  prospectassigned: "Prospect atribuído",
  cadenceenrolled: "Inscrito em cadência",
  cadencepaused: "Cadência pausada",
  prospectreplied: "Prospect respondeu",
  prospectprequalified: "Prospect pré-qualificado",
  opportunitycreatedfromprospecting: "Oportunidade criada (prospecção)",
  prospectnoresponse: "Sem resposta",
  prospectdiscarded: "Prospect descartado",
  prospectarchived: "Prospect arquivado",
  // Pós-venda
  onboardingstarted: "Onboarding iniciado",
  // Diretório
  companycreated: "Empresa criada",
  personcreated: "Pessoa criada",
  personlinkedtocompany: "Pessoa vinculada à empresa",
  personunlinkedfromcompany: "Pessoa desvinculada",
  // Tipos de atividade (quando a timeline traz atividade crua)
  call: "Ligação", ligacao: "Ligação", phone: "Ligação",
  email: "E-mail", mail: "E-mail",
  meeting: "Reunião", reuniao: "Reunião",
  task: "Tarefa", tarefa: "Tarefa",
  note: "Nota", nota: "Nota",
  whatsapp: "WhatsApp", mensagem: "Mensagem",
  follow_up: "Follow up", followup: "Follow up",
  // Origem / canal
  pre_sales: "Pré-vendas", prospecting: "Prospecção", manual: "Manual",
};

/** Rótulo PT de um tipo de evento/atividade. Nunca devolve o enum cru:
 *  um tipo desconhecido vira uma versão legível (camelCase → "Camel case"). */
export function rotuloDeEvento(tipo: string | null | undefined): string {
  if (!tipo) return "Evento";
  const chave = tipo.toLowerCase();
  if (ROTULO_EVENTO[chave]) return ROTULO_EVENTO[chave];
  // Fallback: quebra camelCase/snake_case e capitaliza a primeira letra.
  const legivel = tipo.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim().toLowerCase();
  return legivel ? legivel.charAt(0).toUpperCase() + legivel.slice(1) : "Evento";
}

const STATUS_DE_LIGACAO: Record<string, string> = {
  failed: "falhada", completed: "finalizada", missed: "perdida", no_answer: "sem resposta",
  busy: "ocupado", canceled: "cancelada", cancelled: "cancelada", answered: "atendida",
  ringing: "tocando", voicemail: "caixa postal", rejected: "recusada",
};

/** Título pronto de um evento gravado em texto livre: conserta o que a fonte
 *  escreveu cru ("Ligação failed", "Ligacao") sem depender de reescrever o
 *  histórico. Um único ponto, na leitura, serve toda timeline. */
export function tituloLegivel(titulo: string | null | undefined): string | null {
  if (!titulo) return titulo ?? null;
  let t = titulo.trim();
  if (/^liga[cç][aã]o\b/i.test(t)) {
    t = t.replace(/^liga[cç][aã]o/i, "Ligação");
    t = t.replace(/\b(failed|completed|missed|no_answer|busy|canceled|cancelled|answered|ringing|voicemail|rejected)\b/gi, (m) => STATUS_DE_LIGACAO[m.toLowerCase()] ?? m);
  }
  return t;
}

/** Nome legível de uma etapa (pré-vendas ou pipeline); chave desconhecida vira texto legível. */
export function rotuloDeEtapa(chave: unknown): string {
  const k = String(chave ?? "").trim();
  if (!k) return "—";
  const r = (ROTULO_ETAPA_PRE_VENDAS as Record<string, string>)[k] ?? (ROTULO_ETAPA_PIPELINE as Record<string, string>)[k];
  if (r) return r;
  const t = k.replace(/[_-]+/g, " ").toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Título do evento com o que aconteceu, não só o nome do tipo:
 *  "Etapa: Em contato → Qualificação", "Lead desqualificado — Sem interesse". */
export function tituloDoEvento(
  tipo: string | null | undefined, titulo: string | null | undefined, contexto: Record<string, unknown> | null | undefined,
): string | null {
  const t = String(tipo ?? "").toLowerCase();
  const c = contexto ?? {};
  const de = c.de ?? c.fromStage, para = c.para ?? c.toStage;
  const motivo = typeof c.motivo === "string" && c.motivo.trim() ? c.motivo.trim() : null;
  if (/stagechanged$|^etapa$|^mudanca_etapa$/.test(t) && para) {
    return `Etapa: ${de ? rotuloDeEtapa(de) + " → " : "para "}${rotuloDeEtapa(para)}${motivo ? " · " + motivo : ""}`;
  }
  if (t === "ownerchanged" && para) {
    return `${c.entidade === "cliente" ? "Customer Success" : "Responsável"}: ${de ? String(de) : "sem responsável"} → ${String(para)}`;
  }
  if (t === "tarefa" && titulo) {
    const feita = /conclu|feit|done/i.test(String(c.status ?? ""));
    return `${feita ? "Tarefa concluída" : "Tarefa criada"}: ${titulo}`;
  }
  if (/leaddisqualified|leadnurtured|opportunitylost/.test(t) && motivo) {
    return `${tituloLegivel(titulo) ?? rotuloDeEvento(tipo)} — ${motivo}`;
  }
  // Sem título próprio (evento de domínio): o rótulo em português, nunca o nome do tipo cru ("CompanyCreated").
  return tituloLegivel(titulo) ?? (t ? rotuloDeEvento(tipo) : null);
}
