/**
 * Rotinas agendadas do worker (app/src/worker/index.ts → setupScheduledJobs).
 *
 * Por que um catálogo à mão e não leitura do BullMQ: o estado das filas vive
 * no Redis, que a tela não alcança, e importar o worker para ler a constante
 * SUBIRIA o worker (o módulo tem efeito colateral no topo). Então a tela
 * descreve o que o código agenda — frequência e o que faz — e nunca afirma
 * "rodou há X minutos", porque nenhuma tabela registra a última execução.
 *
 * rotinas.test.ts lê o fonte do worker e falha se uma chave entrar ou sair
 * sem passar por aqui: o catálogo não tem como envelhecer em silêncio.
 */

export type GrupoRotina = "motor" | "agente_sdr" | "vendas" | "clientes" | "integracoes";

export interface RotinaAgendada {
  chave: string;
  nome: string;
  frequencia: string;
  grupo: GrupoRotina;
  oQueFaz: string;
}

export const GRUPOS_ROTINA: Record<GrupoRotina, string> = {
  motor: "Motor de automação",
  agente_sdr: "Agente SDR",
  vendas: "Vendas",
  clientes: "Clientes e financeiro",
  integracoes: "Integrações",
};

export const ROTINAS_AGENDADAS: RotinaAgendada[] = [
  { chave: "event-outbox-sweep", nome: "Barramento de eventos", frequencia: "a cada 1 min", grupo: "motor", oQueFaz: "Processa os eventos pendentes do outbox e inscreve nas cadências publicadas cujo gatilho casa." },
  { chave: "fluxos-sweep", nome: "Passos de automação", frequencia: "a cada 1 min", grupo: "motor", oQueFaz: "Anda as execuções de Fluxos: retoma quem estava em espera, dispara o que o agendamento marcou e aplica as novas tentativas." },
  { chave: "campanha-sweep", nome: "Disparo de campanhas", frequencia: "a cada 1 min", grupo: "motor", oQueFaz: "Envia as campanhas agendadas, um destinatário por vez, com o estado de cada envio gravado." },
  { chave: "cadence-sweep", nome: "Passos de cadência", frequencia: "a cada 5 min", grupo: "motor", oQueFaz: "Executa os passos vencidos das inscrições ativas em cadências." },
  { chave: "check-sequences", nome: "Sequências de e-mail", frequencia: "a cada 1 min", grupo: "motor", oQueFaz: "Envia o próximo e-mail das sequências com passo vencido." },
  { chave: "ai-sdr-outreach", nome: "1º contato do Agente SDR", frequencia: "a cada 5 min", grupo: "agente_sdr", oQueFaz: "Lead novo em Pré-vendas recebe a primeira mensagem do agente e passa para Em contato." },
  { chave: "ai-sdr-retry", nome: "Retentativa do Agente SDR", frequencia: "a cada 15 min", grupo: "agente_sdr", oQueFaz: "Lead em silêncio recebe nova tentativa (~2h, 24h, 40h)." },
  { chave: "ai-sdr-meeting-confirmation", nome: "Confirmação de reunião", frequencia: "todo dia às 9h", grupo: "agente_sdr", oQueFaz: "Reuniões marcadas para hoje recebem confirmação por WhatsApp." },
  { chave: "agentes-autonomia", nome: "Autonomia dos agentes de IA", frequencia: "a cada 1 min", grupo: "agente_sdr", oQueFaz: "Agentes que são responsáveis por leads fazem o contato ativo, o follow-up delegado e a sincronização como usuários, dentro dos limites do agente." },
  { chave: "agentes-retomadas", nome: "Retomadas dos agentes de IA", frequencia: "a cada 1 min", grupo: "agente_sdr", oQueFaz: "Executa as retomadas que o próprio agente combinou com o contato (ex.: \"me chama quinta\"): reconstrói o contexto no horário, confere se o agente ainda é o responsável e deixa o agente decidir. Humano que assumiu bloqueia o envio e registra o motivo. Não usa cadência." },
  { chave: "sdr-followup-escalation", nome: "Escalonamento de follow-up", frequencia: "a cada 15 min", grupo: "vendas", oQueFaz: "Lead parado 48h+ em Em contato sobe para Follow up." },
  { chave: "sla-check", nome: "SLA do pipeline", frequencia: "a cada 30 min", grupo: "vendas", oQueFaz: "Negócio parado além do limite da etapa gera alerta." },
  { chave: "follow-up-proposta", nome: "Follow-up de proposta", frequencia: "a cada 1 h", grupo: "vendas", oQueFaz: "Proposta apresentada parada 3+ dias notifica o dono e cria tarefa." },
  { chave: "expirar-propostas", nome: "Expirar propostas", frequencia: "a cada 1 h", grupo: "vendas", oQueFaz: "Proposta com validade vencida vira expirada e o link de pagamento morre." },
  { chave: "reativar-lead-perdido", nome: "Reativar perdidos", frequencia: "a cada 24 h", grupo: "vendas", oQueFaz: "Negócio perdido volta para o radar depois do prazo do motivo de perda." },
  { chave: "lembrete-reuniao-30min", nome: "Lembrete de reunião", frequencia: "a cada 5 min", grupo: "vendas", oQueFaz: "Avisa o responsável 30 minutos antes da reunião." },
  { chave: "cs-sweep", nome: "Varredura de CS", frequencia: "a cada 1 h", grupo: "clientes", oQueFaz: "Recalcula saúde e playbooks da carteira." },
  { chave: "alerta-renovacao", nome: "Alerta de renovação", frequencia: "a cada 24 h", grupo: "clientes", oQueFaz: "Contrato perto do vencimento dispara o gatilho contrato_vencendo." },
  { chave: "reconcile-pagamentos", nome: "Conciliação de pagamentos", frequencia: "a cada 24 h", grupo: "clientes", oQueFaz: "Proposta aceita sem pagamento confirmado em 5 dias avisa a responsável." },
  { chave: "snapshot-diario", nome: "Snapshot diário", frequencia: "a cada 1 h", grupo: "clientes", oQueFaz: "Grava o retrato diário dos indicadores para os relatórios." },
  { chave: "stripe-sync", nome: "Sincronização Stripe", frequencia: "a cada 30 min", grupo: "integracoes", oQueFaz: "Reconcilia assinaturas, faturas e churn com o Stripe." },
  { chave: "catalogo-stripe-sync", nome: "Catálogo Stripe", frequencia: "a cada 1 h", grupo: "integracoes", oQueFaz: "Traz preços e produtos do Stripe para o catálogo comercial." },
  { chave: "outlook-reuniao-sync", nome: "Reuniões do Outlook", frequencia: "a cada 5 min", grupo: "integracoes", oQueFaz: "Traz do Outlook para o ONFACE o que mudou nas reuniões: horário, convidados, respostas e cancelamento." },
  { chave: "calendar-sync-retry", nome: "Reenvio ao calendário", frequencia: "a cada 10 min", grupo: "integracoes", oQueFaz: "Tenta de novo as reuniões que falharam ao sincronizar." },
  { chave: "check-whatsapp-connection", nome: "Conexão do WhatsApp", frequencia: "a cada 5 min", grupo: "integracoes", oQueFaz: "Verifica se as sessões do WhatsApp continuam conectadas." },
  { chave: "email-sync-trigger", nome: "Sincronização de e-mail", frequencia: "a cada 5 min", grupo: "integracoes", oQueFaz: "Busca e-mails novos das caixas conectadas e liga aos leads." },
  { chave: "rd-criativo-sync", nome: "Criativo do RD", frequencia: "a cada 6 h", grupo: "integracoes", oQueFaz: "Completa o criativo (utm_content/term) dos leads pagos pela API do RD." },
  { chave: "callface-ai-sync", nome: "Uso do Callface AI", frequencia: "a cada 6 h", grupo: "integracoes", oQueFaz: "Importa o snapshot de uso por tenant do SaaS Callface AI." },
];
