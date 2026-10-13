/**
 * CalendarProvider — a interface que o ONFACE usa para falar com agenda
 * externa (Documento Mestre v0.13, Módulo 09 e Módulo 13).
 *
 * "Microsoft e Google entram por CalendarProvider."
 * "Create/Update/Cancel sincronizam provider."
 * "Falha de sync é visível e reprocessável."
 *
 * O GAP QUE ISTO FECHA, confirmado no código antes de escrever: existia criar
 * (`criarEventoOutlookParaReuniao`) e existia ler de volta
 * (`syncOutlookReunioes`). Não existia atualizar — o cliente Graph tinha
 * create, get e delete, e mais nada. Resultado: `PATCH /reunioes/:id` mudava a
 * data no ONFACE e só avisava o provedor quando o status virava "cancelada".
 * Reagendar deixava o convite antigo de pé na agenda do cliente, e ninguém era
 * avisado disso.
 *
 * O que NÃO muda: a reunião é do ONFACE. O provedor é onde o convite vive, não
 * onde a verdade mora. Provedor fora do ar não impede reagendar — deixa a
 * reunião com `calendar_sync_status = 'falhou'`, visível e reprocessável.
 */

export type NomeProvider = "microsoft" | "google";

export interface EventoParaCriar {
  titulo: string;
  inicioISO: string;
  fimISO: string;
  corpo?: string | null;
  /** E-mail do cliente. Sem ele o evento existe e ninguém é convidado. */
  convidadoEmail?: string | null;
  /** Todos os convidados (participantes da reunião). Inclui `convidadoEmail`. */
  convidados?: string[];
  /** Gera link de reunião online quando o provedor suporta. */
  online?: boolean;
}

export interface EventoParaAtualizar {
  /** Lista completa de convidados: quando vem, SUBSTITUI a do evento (participante removido sai do convite). */
  convidados?: string[] | null;
  titulo?: string | null;
  inicioISO?: string | null;
  fimISO?: string | null;
  corpo?: string | null;
}

export type ResultadoProvider =
  | { ok: true; eventId: string; link?: string | null; joinUrl?: string | null }
  | { ok: true; eventId: null; naoExiste: true }
  | { ok: false; motivo: MotivoFalha; detalhe: string; tentarDeNovo: boolean };

export type MotivoFalha =
  | "sem_conta"        // ninguém conectou agenda para este usuário
  | "token_expirado"   // conectou e a credencial morreu
  | "nao_configurado"  // o provedor não tem credencial de aplicação no ambiente
  | "erro_provedor";   // qualquer outra falha ao falar com o provedor

/**
 * Cada adapter implementa isto. O `contaId` é a conexão do usuário dono da
 * agenda — a tenant isolation acontece antes, ao resolver essa conta.
 */
export interface CalendarProvider {
  nome: NomeProvider;
  /** O provedor tem credencial de aplicação neste ambiente? */
  configurado(): boolean;
  /** A conexão do usuário existe e está válida? */
  contaDoUsuario(usuarioId: string): Promise<string | null>;
  criar(contaId: string, evento: EventoParaCriar): Promise<ResultadoProvider>;
  atualizar(contaId: string, eventId: string, mudanca: EventoParaAtualizar): Promise<ResultadoProvider>;
  cancelar(contaId: string, eventId: string): Promise<ResultadoProvider>;
  /**
   * Horários realmente ocupados na agenda do usuário no intervalo. Falha NÃO vira
   * "livre": quem oferece horário precisa saber que a checagem não aconteceu.
   */
  ocupados(contaId: string, inicioISO: string, fimISO: string): Promise<OcupadosResultado>;
}

export type OcupadosResultado =
  | { ok: true; faixas: { inicio: Date; fim: Date }[] }
  | { ok: false; motivo: MotivoFalha; detalhe: string };

/**
 * Traduz a falha para uma frase que o usuário entende e pode agir.
 *
 * "Reunião agendada" sem dizer que o convite não foi criado é mentira: a
 * pessoa fecha a tela achando que o cliente recebeu. Esta é a mesma lição que
 * o `MOTIVO_LABEL` do Outlook já carregava, generalizada.
 */
export const FRASE_DA_FALHA: Record<MotivoFalha, string> = {
  sem_conta:
    "Reunião salva no ONFACE, mas NÃO entrou na agenda: o responsável pela reunião não tem calendário conectado. " +
    "Conecte em Ajustes > Integrações.",
  token_expirado:
    "Reunião salva no ONFACE, mas NÃO entrou na agenda: a conexão do responsável com o calendário expirou. " +
    "Reconecte em Ajustes > Integrações.",
  nao_configurado:
    "Reunião salva no ONFACE. A integração de calendário não está configurada neste ambiente, " +
    "então nenhum convite externo foi criado.",
  erro_provedor:
    "Reunião salva no ONFACE, mas NÃO entrou na agenda (falha ao falar com o provedor). " +
    "A sincronização será tentada de novo.",
};
