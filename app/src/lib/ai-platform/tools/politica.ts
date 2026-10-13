/**
 * Política das ferramentas: domínio, classe de autonomia e metadados de produto.
 *
 * Duas coisas distintas, de propósito:
 *  - CLASSE DE AUTONOMIA (leitura | mensagens | crm | agenda | comercial): qual
 *    dos botões de autonomia do agente vale para a ferramenta. Cada classe pode
 *    ser copiloto, sob aprovação ou autônoma, independente das outras;
 *  - PERMISSÃO (permissao-delegada.ts): o teto de RBAC. Autonomia nunca concede
 *    permissão: o backend aplica a interseção das duas.
 * Este arquivo não importa banco: a tela pode ler as constantes.
 */
export type ClasseAutonomia = "leitura" | "mensagens" | "crm" | "agenda" | "comercial";
export type ModoAutonomia = "suggest" | "approval" | "autonomous";
export type DominioFerramenta = "Leitura" | "Atendimento" | "Comercial" | "Atividades" | "Calendário" | "Cadências" | "Integrações";

export const CLASSES_AUTONOMIA: { id: ClasseAutonomia; rotulo: string; ajuda: string }[] = [
  { id: "leitura", rotulo: "Leitura e contexto", ajuda: "Consultar CRM, conversa, conhecimento e memória. Não altera nada." },
  { id: "mensagens", rotulo: "Mensagens", ajuda: "Responder e retomar contato pelo WhatsApp." },
  { id: "crm", rotulo: "CRM", ajuda: "Notas, tags, qualificação, tarefas e memória operacional." },
  { id: "agenda", rotulo: "Agenda", ajuda: "Consultar horários e criar, remarcar ou cancelar reuniões." },
  { id: "comercial", rotulo: "Operações comerciais", ajuda: "Mover etapa, criar oportunidade e ações com efeito comercial." },
];

export interface MetaFerramenta {
  dominio: DominioFerramenta;
  classe: ClasseAutonomia;
  entidades: string[];
  efeitos: string;
  /** Pede confirmação humana quando a classe está em "sob aprovação". */
  exigeConfirmacao: boolean;
  resultado: string;
}

export const META_FERRAMENTA: Record<string, MetaFerramenta> = {
  "context.read_contact": { dominio: "Leitura", classe: "leitura", entidades: ["Contato"], efeitos: "Nenhum.", exigeConfirmacao: false, resultado: "Identidade, canal e vínculo do contato." },
  "context.read_conversation": { dominio: "Leitura", classe: "leitura", entidades: ["Conversa"], efeitos: "Nenhum.", exigeConfirmacao: false, resultado: "Mensagens recentes (com transcrição dos áudios)." },
  "context.read_crm": { dominio: "Leitura", classe: "leitura", entidades: ["Lead", "Oportunidade"], efeitos: "Nenhum.", exigeConfirmacao: false, resultado: "Lead e oportunidades vinculadas." },
  "knowledge.search": { dominio: "Leitura", classe: "leitura", entidades: ["Base de conhecimento"], efeitos: "Nenhum.", exigeConfirmacao: false, resultado: "Trechos de conhecimento aprovado." },
  "memory.read": { dominio: "Leitura", classe: "leitura", entidades: ["Memória"], efeitos: "Nenhum.", exigeConfirmacao: false, resultado: "Fatos lembrados sobre a pessoa, a empresa e a operação." },
  "budget.read": { dominio: "Leitura", classe: "leitura", entidades: ["Orçamento de IA"], efeitos: "Nenhum.", exigeConfirmacao: false, resultado: "Limite e consumo do mês." },
  "skill.activate": { dominio: "Leitura", classe: "leitura", entidades: ["Skill"], efeitos: "Registra o uso da skill.", exigeConfirmacao: false, resultado: "Instruções da skill." },
  "response.classify": { dominio: "Atendimento", classe: "leitura", entidades: ["Conversa"], efeitos: "Nenhum.", exigeConfirmacao: false, resultado: "Intenção e confiança." },
  "message.prepare": { dominio: "Atendimento", classe: "mensagens", entidades: ["Conversa", "WhatsApp"], efeitos: "Envia as mensagens pelo número da conversa, após a política de canal.", exigeConfirmacao: true, resultado: "Mensagens enfileiradas no WhatsApp." },
  "handoff.request": { dominio: "Atendimento", classe: "crm", entidades: ["Conversa", "Responsável"], efeitos: "Pausa a IA, notifica a pessoa e registra resumo na timeline.", exigeConfirmacao: false, resultado: "Atendimento passado a uma pessoa." },
  "case.open": { dominio: "Atendimento", classe: "crm", entidades: ["Caso"], efeitos: "Abre caso para a equipe.", exigeConfirmacao: false, resultado: "Caso aberto." },
  "alert.create": { dominio: "Atendimento", classe: "crm", entidades: ["Alerta"], efeitos: "Cria alerta visível.", exigeConfirmacao: false, resultado: "Alerta criado." },
  "contact.propose_field": { dominio: "Atendimento", classe: "crm", entidades: ["Contato"], efeitos: "Cria proposta de alteração; não altera o dado.", exigeConfirmacao: false, resultado: "Proposta aguardando confirmação humana." },
  "lead.qualify": { dominio: "Comercial", classe: "crm", entidades: ["Lead"], efeitos: "Grava qualificação sem apagar valores válidos e registra nota.", exigeConfirmacao: true, resultado: "Qualificação atualizada." },
  "lead.update_status": { dominio: "Comercial", classe: "comercial", entidades: ["Lead"], efeitos: "Muda a etapa de pré-vendas pela porta de domínio.", exigeConfirmacao: true, resultado: "Etapa atualizada." },
  "deal.advance": { dominio: "Comercial", classe: "comercial", entidades: ["Oportunidade"], efeitos: "Move a oportunidade; Ganho é recusado pela política comercial.", exigeConfirmacao: true, resultado: "Etapa da oportunidade atualizada." },
  "lead.tag": { dominio: "Comercial", classe: "crm", entidades: ["Lead"], efeitos: "Adiciona/remove tag e publica o evento para automações.", exigeConfirmacao: true, resultado: "Tag aplicada." },
  "activity.note": { dominio: "Atividades", classe: "crm", entidades: ["Lead"], efeitos: "Nota na timeline assinada pelo agente.", exigeConfirmacao: false, resultado: "Nota registrada." },
  "task.create": { dominio: "Atividades", classe: "crm", entidades: ["Tarefa"], efeitos: "Cria tarefa para uma pessoa.", exigeConfirmacao: true, resultado: "Tarefa criada." },
  "memory.remember": { dominio: "Atendimento", classe: "crm", entidades: ["Memória"], efeitos: "Grava fato com fonte; inferência nunca sobrescreve dado confirmado.", exigeConfirmacao: false, resultado: "Fato lembrado." },
  "followup.schedule": { dominio: "Atendimento", classe: "mensagens", entidades: ["Compromisso do agente"], efeitos: "Agenda uma retomada própria; no horário o contexto é reconstruído e o agente decide a mensagem.", exigeConfirmacao: false, resultado: "Retomada agendada." },
  "followup.resume_cancel": { dominio: "Atendimento", classe: "mensagens", entidades: ["Compromisso do agente"], efeitos: "Cancela uma retomada própria com motivo.", exigeConfirmacao: false, resultado: "Retomada cancelada." },
  "agenda.slots": { dominio: "Calendário", classe: "leitura", entidades: ["Agenda da closer", "Outlook"], efeitos: "Nenhum.", exigeConfirmacao: false, resultado: "Horários verificados (CRM + Outlook) da closer da regra." },
  "meeting.schedule": { dominio: "Calendário", classe: "agenda", entidades: ["Reunião", "Oportunidade", "Outlook"], efeitos: "Revalida o horário, cria o evento no Outlook, a reunião e a oportunidade; notifica a closer.", exigeConfirmacao: true, resultado: "Reunião confirmada com link." },
  "meeting.reschedule": { dominio: "Calendário", classe: "agenda", entidades: ["Reunião", "Outlook"], efeitos: "Revalida e atualiza o evento externo.", exigeConfirmacao: true, resultado: "Reunião remarcada." },
  "meeting.cancel": { dominio: "Calendário", classe: "agenda", entidades: ["Reunião", "Outlook"], efeitos: "Cancela o evento externo e a reunião.", exigeConfirmacao: true, resultado: "Reunião cancelada." },
  "cadence.pause": { dominio: "Cadências", classe: "crm", entidades: ["Cadência do time"], efeitos: "Pausa a cadência do time para a entidade.", exigeConfirmacao: true, resultado: "Cadências pausadas." },
  "followup.enroll": { dominio: "Cadências", classe: "crm", entidades: ["Cadência do time"], efeitos: "Inscreve o contato em cadência publicada. Opcional: o agente não depende dela.", exigeConfirmacao: true, resultado: "Inscrição criada." },
  "followup.cancel": { dominio: "Cadências", classe: "crm", entidades: ["Cadência do time"], efeitos: "Cancela inscrição em cadência.", exigeConfirmacao: true, resultado: "Inscrição cancelada." },
  // NEXO: leitura do retrato e memória PRÓPRIA do usuário (anotação pessoal, nenhum dado de negócio muda).
  "nexo.panorama": { dominio: "Leitura", classe: "leitura", entidades: ["Pré-vendas", "Pipeline", "Carteira"], efeitos: "Nenhum.", exigeConfirmacao: false, resultado: "Retrato do usuário, pendências e uso da Callface AI." },
  "nexo.lembrar": { dominio: "Leitura", classe: "leitura", entidades: ["Memória do NEXO"], efeitos: "Nenhum.", exigeConfirmacao: false, resultado: "Anotações relevantes do usuário." },
  "nexo.abrir_anotacao": { dominio: "Leitura", classe: "leitura", entidades: ["Memória do NEXO"], efeitos: "Nenhum.", exigeConfirmacao: false, resultado: "Anotação inteira e as ligadas." },
  "nexo.esquecer": { dominio: "Atividades", classe: "leitura", entidades: ["Memória do NEXO"], efeitos: "Arquiva uma anotação só do usuário.", exigeConfirmacao: false, resultado: "Anotação esquecida." },
  "nexo.anotar": { dominio: "Atividades", classe: "leitura", entidades: ["Memória do NEXO"], efeitos: "Grava ou corrige uma anotação só do usuário.", exigeConfirmacao: false, resultado: "Anotação guardada." },
  "callface.call": { dominio: "Integrações", classe: "mensagens", entidades: ["Discador"], efeitos: "Envia o lead à fila de ligação da Callface AI.", exigeConfirmacao: true, resultado: "Lead na fila de discagem." },
};

export function classeDaFerramenta(id: string): ClasseAutonomia {
  // NEXO e demais: escrita sem classe explícita é tratada como comercial (a mais restritiva por padrão).
  return META_FERRAMENTA[id]?.classe ?? (id.startsWith("nexo.") ? "crm" : "comercial");
}

const MODOS: ModoAutonomia[] = ["suggest", "approval", "autonomous"];
export const ehModo = (v: unknown): v is ModoAutonomia => MODOS.includes(v as ModoAutonomia);

export function lerAutonomiaPorAcao(guardrail: unknown): Partial<Record<ClasseAutonomia, ModoAutonomia>> {
  const g = (guardrail && typeof guardrail === "object" ? guardrail : {}) as Record<string, unknown>;
  const p = (g.autonomiaPorAcao && typeof g.autonomiaPorAcao === "object" ? g.autonomiaPorAcao : {}) as Record<string, unknown>;
  const out: Partial<Record<ClasseAutonomia, ModoAutonomia>> = {};
  for (const c of CLASSES_AUTONOMIA) if (ehModo(p[c.id])) out[c.id] = p[c.id] as ModoAutonomia;
  return out;
}

/** Modo efetivo da ferramenta: o da classe, quando configurado; senão o geral da execução. Leitura nunca é bloqueada. */
export function autonomiaDaFerramenta(id: string, geral: ModoAutonomia, porClasse: Partial<Record<ClasseAutonomia, ModoAutonomia>>): ModoAutonomia {
  const classe = classeDaFerramenta(id);
  if (classe === "leitura") return "autonomous";
  return porClasse[classe] ?? geral;
}
