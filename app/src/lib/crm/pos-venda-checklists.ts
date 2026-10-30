/**
 * Checklists de entrega por família de serviço.
 *
 * Portados sem alteração do CRM 2.0 (`lib/crm/fulfillment.ts` da branch dev),
 * que por sua vez os derivou dos processos reais: PABX do documento
 * "Delivery de Projeto PABX — Callface" (agosto/2026, 8 etapas), Callface AI
 * do "Guia de Treinamento e Onboarding de Clientes Callface" (Alisson/
 * Suporte, 2026) e White Label do fluxo operacional validado do produto.
 *
 * São STARTING POINT, não state machine: cada instância vira linhas em
 * `fulfillment_itens`, que o time edita. Nunca tratar como enum de código.
 *
 * Mantidos com os MESMOS nomes de export do CRM 2.0 de propósito — quando o
 * CRM2 completo subir, este arquivo é substituído pelo de lá sem reescrever
 * nada que dependa dele.
 */

export type EstagioPedagogico = "EXPLICAR" | "DEMONSTRAR" | "FAZER_JUNTO" | "CLIENTE_EXECUTA" | "VALIDAR";

// Metadata aditiva por item de checklist — reaproveita a coluna jsonb
// `fulfillment_itens.metadata` que já existia (nula) no schema, sem migração
// nova. Ausente/undefined = etapa administrativa/preparatória, fora da
// progressão pedagógica (ex.: validar contratação, configurar acessos,
// handoff pro CS).
export type ChecklistItemMetadata = {
  estagioPedagogico?: EstagioPedagogico[];
  // Marco de First Value (Activation ≠ Adoption — conceito central do
  // guia: a conta existir/estar configurada não é o cliente ter adotado de
  // fato). Sempre marcação MANUAL — não há hoje nenhum sinal técnico
  // confiável (ex.: "primeira ligação atendida com sucesso pela IA") pra
  // inferir isso automaticamente; o time confirma quando souber que
  // aconteceu de verdade. Não inventar a métrica aqui.
  milestone?: "FIRST_VALUE";
  marcacaoManual?: boolean;
  // Handoff estruturado pro Customer Success (conceito 3 do guia): fechar
  // este item é o que fica registrado pro CS herdar — não só
  // fulfillment.status = COMPLETED e acabou.
  handoffCs?: boolean;
};

export type ChecklistSeed = { workstream: string; titulo: string; metadata?: ChecklistItemMetadata }[];


// PABX: baseado no processo real "Delivery de Projeto PABX — Callface"
// (agosto/2026). Ordem reflete o processo descrito, mas dependências reais
// (ex.: portabilidade pode rodar em paralelo com Softswitch) não são
// travadas aqui — status BLOCKED + blockerType é o mecanismo pra isso.
// PABX granular (reconstrução 19/08, fonte: Callface-Processo-Delivery-PABX.pdf
// — documento real de processo interno, agosto/2026). Cada `workstream` já
// existia (bate com FASE_PABX_POR_WORKSTREAM abaixo); o que muda é a
// granularidade dentro de cada um — antes 1 item genérico por etapa, agora
// as atividades reais descritas no PDF, uma checkbox por atividade (mesmo
// nível do documento). Yeastar/3CX seguem a mesma sequência (o PDF só diverge
// dentro das etapas 4 e 5 — nomenclatura de máquina e mecanismo de
// licença — não modelado como campo separado aqui, é observação textual).
export const PABX_CHECKLIST: ChecklistSeed = [
  // Etapa 1/8 — Levantamento de informações
  { workstream: "levantamento", titulo: "Enviar formulário de implantação ao cliente" },
  { workstream: "levantamento", titulo: "Conferir se todas as informações foram preenchidas" },
  { workstream: "levantamento", titulo: "Validar quantidade de ramais" },
  { workstream: "levantamento", titulo: "Validar quantidade de linhas" },
  { workstream: "levantamento", titulo: "Validar URAs" },
  { workstream: "levantamento", titulo: "Validar filas" },
  { workstream: "levantamento", titulo: "Comparar informações com o contrato" },
  { workstream: "levantamento", titulo: "Solicitar correções ao cliente, se houver informação incompleta" },

  // Etapa 2/8 — Portabilidade
  { workstream: "portabilidade", titulo: "Identificar linhas que serão portadas" },
  { workstream: "portabilidade", titulo: "Solicitar documentação/dados necessários" },
  { workstream: "portabilidade", titulo: "Encaminhar solicitação de portabilidade" },
  { workstream: "portabilidade", titulo: "Acompanhar o processo junto à operadora" },
  { workstream: "portabilidade", titulo: "Atualizar o projeto com o status da portabilidade" },

  // Etapa 3/8 — Criação do ambiente no SIPRoute/Softswitch
  { workstream: "softswitch", titulo: "Criar cadastro do cliente" },
  { workstream: "softswitch", titulo: "Definir quantidade de chamadas simultâneas conforme contrato" },
  { workstream: "softswitch", titulo: "Definir franquia/quantidade de minutos conforme contrato" },
  { workstream: "softswitch", titulo: "Criar conta VoIP e associar ao cliente" },
  { workstream: "softswitch", titulo: "Cadastrar o número remoto (pendente se portabilidade não concluída)" },
  { workstream: "softswitch", titulo: "Criar/configurar Gateway" },
  { workstream: "softswitch", titulo: "Validar comunicação com a operadora" },
  { workstream: "softswitch", titulo: "Criar regras de roteamento (entrada e saída)" },

  // Etapa 4/8 — Solicitação de máquina para o PBX
  { workstream: "infraestrutura", titulo: "Levantar informações da máquina (plataforma, recursos, SO, IP/rede, armazenamento)" },
  { workstream: "infraestrutura", titulo: "Solicitar ao time de Infraestrutura a criação da máquina" },

  // Etapa 5/8 — Licenciamento (Yeastar trial 30d vs 3CX licença — mesmo item, mecanismo diverge por fornecedor)
  { workstream: "licenciamento", titulo: "Solicitar/vincular licença da plataforma ao ambiente do cliente" },
  { workstream: "licenciamento", titulo: "Programar renovação da licença (Yeastar: trial 30 dias → 1 ano)" },

  // Etapa 6/8 — Configuração do PBX (6.1 a 6.8 do processo real)
  { workstream: "configuracao_pbx", titulo: "FQDN — configurar, validar resolução e certificado" },
  { workstream: "configuracao_pbx", titulo: "Ramais — criar, associar usuários, configurar permissões e senha temporária" },
  { workstream: "configuracao_pbx", titulo: "Linhas — configurar troncos, associar números, validar entrada/saída" },
  { workstream: "configuracao_pbx", titulo: "Filas — criar, associar ramais, estratégia de distribuição e transbordo" },
  { workstream: "configuracao_pbx", titulo: "URAs — criar, configurar opções/destinos/áudios, validar fluxo" },
  { workstream: "configuracao_pbx", titulo: "Regras de saída — prefixos, rotas, operadora/tronco, permissões" },
  { workstream: "configuracao_pbx", titulo: "Regras de entrada — números de destino, rotas, URAs, filas, ramais" },
  { workstream: "configuracao_pbx", titulo: "Telefones IP — provisionar, associar ramais, configurar teclas, testar" },

  // Etapa 7/8 — Testes e validação interna
  { workstream: "qa_interno", titulo: "Testar chamada de saída" },
  { workstream: "qa_interno", titulo: "Testar chamada de entrada" },
  { workstream: "qa_interno", titulo: "Testar transferência" },
  { workstream: "qa_interno", titulo: "Testar atendimento por ramal" },
  { workstream: "qa_interno", titulo: "Testar funcionamento das filas" },
  { workstream: "qa_interno", titulo: "Testar funcionamento das URAs" },
  { workstream: "qa_interno", titulo: "Testar roteamento das chamadas" },
  { workstream: "qa_interno", titulo: "Testar telefones IP, quando aplicável" },
  { workstream: "qa_interno", titulo: "Testar áudio nos dois sentidos" },
  { workstream: "qa_interno", titulo: "Validar números portados" },
  { workstream: "qa_interno", titulo: "Validar principais cenários definidos no formulário" },

  // Etapa 8/8 — Entrega do projeto ao cliente
  { workstream: "validacao_cliente", titulo: "Apresentar o ambiente ao cliente" },
  { workstream: "validacao_cliente", titulo: "Demonstrar os principais fluxos" },
  { workstream: "validacao_cliente", titulo: "Realizar testes junto ao cliente" },
  { workstream: "validacao_cliente", titulo: "Validar funcionamento com o cliente" },
  { workstream: "validacao_cliente", titulo: "Esclarecer dúvidas e registrar pendências" },
  { workstream: "validacao_cliente", titulo: "Atualizar documentação do projeto" },
  { workstream: "validacao_cliente", titulo: "Transição para Suporte/Operação" },
];

// Callface AI: baseado no "Guia de Treinamento e Onboarding de Clientes
// Callface" real (Alisson/Suporte, 2026) — o roteiro que o time efetivamente
// segue AO VIVO com o cliente, quase sempre numa reunião só (o próprio guia:
// "o treinamento não termina quando a tela é apresentada — termina quando o
// cliente sai com acessos funcionando, funcionalidades configuradas e
// autonomia pra operar sozinho"). Granularidade pareada com PABX_CHECKLIST
// acima (uma checkbox por atividade real do documento, não um item
// genérico por etapa) — reconstruído 25/08 depois do time apontar que a
// versão anterior (7 itens abstratos) tinha "engolido" o guia real.
//
// Campanhas/Reuniões online/Agente de IA são descritos no guia como
// condicionais ("planos acima do Full", "clientes com o módulo
// contratado") — igual antes, não fabricamos aqui uma detecção real de
// módulo contratado (não existe campo no catálogo pra isso); por ora todo
// onboarding Callface AI ganha o checklist completo, e workstreams
// condicionais ficam marcados no comentário pra quando esse sinal existir.
export const AI_CHECKLIST_BASE: ChecklistSeed = [
  // Tópico 2 — Abertura
  { workstream: "abertura", titulo: "Validar responsável, empresa e cargo" },
  { workstream: "abertura", titulo: "Confirmar usuários, plano e módulos contratados" },
  { workstream: "abertura", titulo: "Checar se contratou Agente de IA e/ou Reuniões Online" },
  { workstream: "abertura", titulo: "Confirmar o que foi contratado antes de demonstrar" },

  // Tópico 3 — CRM e integração
  { workstream: "crm_integracao", titulo: "Perguntar se o cliente possui CRM" },
  { workstream: "crm_integracao", titulo: "Com integração pronta: integrar e validar junto com o cliente" },
  { workstream: "crm_integracao", titulo: "Sem integração pronta: apresentar os Webhooks" },
  { workstream: "crm_integracao", titulo: "Sem CRM: alinhar operação acompanhada pela Callface" },

  // Tópico 4 — Acessos
  { workstream: "acessos", titulo: "Validar login, senha e usuários" },
  { workstream: "acessos", titulo: "Confirmar permissões e número/linha" },
  { workstream: "acessos", titulo: "Checar recursos contratados" },
  { workstream: "acessos", titulo: "Registrar pendências de acesso antes de avançar" },

  // Tópico 5 — Dados da empresa
  { workstream: "dados_empresa", titulo: "Perguntar se os dados da empresa já foram preenchidos" },
  { workstream: "dados_empresa", titulo: "Mostrar onde ficam e como editar os dados da empresa" },
  { workstream: "dados_empresa", titulo: "Validar as informações da empresa junto com o cliente" },

  // Tópico 6 — Gestão de usuários e times
  { workstream: "usuarios_times", titulo: "Se há equipe: apresentar Gestão de Usuários e organização por times" },
  { workstream: "usuarios_times", titulo: "Se não há equipe ainda: explicar que dá pra separar por times no futuro" },
  { workstream: "usuarios_times", titulo: "Alinhar que toda adição de novo usuário passa pelo time Comercial" },

  // Tópico 7 — Ligação manual e histórico
  {
    workstream: "primeira_ligacao",
    titulo: "Demonstrar fazendo uma ligação manual na frente do cliente",
    metadata: { estagioPedagogico: ["EXPLICAR", "DEMONSTRAR"] },
  },
  {
    workstream: "primeira_ligacao",
    titulo: "Cliente realizar a ligação de teste sozinho",
    metadata: { estagioPedagogico: ["CLIENTE_EXECUTA"] },
  },
  {
    workstream: "primeira_ligacao",
    titulo: "Abrir o Histórico de Interações (registro, transcrição, resumo e análises)",
    metadata: { estagioPedagogico: ["VALIDAR"] },
  },

  // Tópico 8 — Scorecard e Insights
  { workstream: "scorecard_insights", titulo: "Ativar o Scorecard junto com o cliente e confirmar que ficou ativo" },
  { workstream: "scorecard_insights", titulo: "Mostrar um Scorecard real aplicado a uma ligação já registrada" },
  { workstream: "scorecard_insights", titulo: "Apresentar os Insights gerados automaticamente pela IA" },
  { workstream: "scorecard_insights", titulo: "Explicar como transformar os insights em ligações mais assertivas" },
  {
    workstream: "scorecard_insights",
    titulo: "Checkpoint: confirmar que o cliente localiza e interpreta os insights sozinho",
    metadata: { estagioPedagogico: ["VALIDAR"] },
  },

  // Tópicos 9 e 10 — Próximos passos, tarefas e relatórios (mesmo marco
  // "Scorecard e insights" da Jornada — é a continuação natural do tópico 8).
  { workstream: "proximos_passos", titulo: "Mostrar os próximos passos sugeridos pela IA" },
  { workstream: "proximos_passos", titulo: "Criar uma tarefa junto com o cliente (responsável e prazo)" },
  {
    workstream: "proximos_passos",
    titulo: "Validar se o cliente repete o processo de criar tarefa sozinho",
    metadata: { estagioPedagogico: ["VALIDAR"] },
  },
  { workstream: "relatorios", titulo: "Empresas com +1 usuário: mostrar visão por usuário e por time" },
  { workstream: "relatorios", titulo: "Apresentar o relatório de performance por usuário" },
  { workstream: "relatorios", titulo: "Apresentar as objeções detectadas pela IA" },
  { workstream: "relatorios", titulo: "Mostrar Minutos Falados por Dia e por Horário" },

  // Tópicos 11-13 — Reuniões online e campanhas (condicional: "planos acima
  // do Full" pra Reuniões, sem detecção real de plano no catálogo hoje).
  { workstream: "reunioes_online", titulo: "Mostrar como incluir o Agente na reunião online" },
  { workstream: "reunioes_online", titulo: "Mostrar onde revisitar a gravação depois" },
  { workstream: "reunioes_online", titulo: "Apresentar resumo, pontos-chave e próximos passos gerados por IA" },
  { workstream: "campanhas", titulo: "Demonstrar a criação e o upload de uma campanha" },
  { workstream: "campanhas", titulo: "Fazer um exemplo real de campanha junto com o cliente" },
  { workstream: "campanhas", titulo: "Enviar a planilha modelo da Callface" },
  { workstream: "campanhas", titulo: "Mostrar mapeamento de campos e configuração da campanha" },
  { workstream: "campanhas", titulo: "Mostrar onde consultar os resultados da campanha" },
  { workstream: "campanhas", titulo: "Focar na distribuição de resultados apresentada pela IA" },
  { workstream: "campanhas", titulo: "Explicar volume de contatos e padrões identificados" },

  // Tópicos 14-15 — Agente de IA (condicional: "clientes com o módulo
  // contratado", sem detecção real de módulo no catálogo hoje).
  { workstream: "agente_prompt", titulo: "Montar o prompt junto com o cliente, campo por campo" },
  { workstream: "agente_prompt", titulo: "Configurar o Data Collection (o que a IA deve coletar)" },
  { workstream: "agente_prompt", titulo: "Definir o essencial: objetivo, produto, público, qualificação, objeções e próximo passo" },
  {
    workstream: "agente_prompt",
    titulo: "Testar o Agente, ajustar o prompt e testar novamente",
    metadata: { estagioPedagogico: ["VALIDAR"] },
  },
  { workstream: "agente_config", titulo: "Configurar identificação de caixa postal" },
  { workstream: "agente_config", titulo: "Configurar barreiras eletrônicas / atendimento automático (inclusive iPhone)" },
  { workstream: "agente_config", titulo: "Configurar comportamento quando o cliente diz \"alô\" novamente" },
  { workstream: "agente_config", titulo: "Configurar comportamento em silêncio e interrupções" },
  { workstream: "agente_config", titulo: "Enviar o material de referência de configuração de prompt" },

  // Tópicos 16-18 — First Message, prompt-base e bateria de testes
  { workstream: "first_message", titulo: "Criar a First Message junto com o cliente (variável de nome via planilha)" },
  {
    workstream: "bateria_testes",
    titulo: "Testar cenário: cliente interessado",
    metadata: { estagioPedagogico: ["VALIDAR"] },
  },
  { workstream: "bateria_testes", titulo: "Testar cenário: cliente sem interesse" },
  { workstream: "bateria_testes", titulo: "Testar cenário: objeção" },
  { workstream: "bateria_testes", titulo: "Testar cenário: silêncio" },
  { workstream: "bateria_testes", titulo: "Testar cenário: repetição de \"alô\"" },
  { workstream: "bateria_testes", titulo: "Testar cenário: caixa postal / barreira eletrônica" },
  { workstream: "bateria_testes", titulo: "Testar cenário: uso de dados da planilha" },

  // Tópicos 19-20 — SLA e canais
  { workstream: "sla_canais", titulo: "Apresentar o SLA oficial vigente" },
  { workstream: "sla_canais", titulo: "Explicar abertura e acompanhamento de chamados" },
  { workstream: "sla_canais", titulo: "Apresentar os canais oficiais de atendimento" },
  { workstream: "sla_canais", titulo: "Explicar qual canal usar para cada necessidade" },

  // Tópico 21 — Critério de sucesso (Activation ≠ Adoption: treinamento
  // concluído ≠ onboarding concluído — por isso é checklist explícito, não
  // efeito colateral de outro item). Handoff pro CS fecha o processo.
  {
    workstream: "validacao_final",
    titulo: "Cliente consegue operar: realizar ligação e localizar o histórico sozinho",
    metadata: { estagioPedagogico: ["VALIDAR"] },
  },
  {
    workstream: "validacao_final",
    titulo: "Cliente consegue interpretar: ler os insights da IA e agir sobre eles",
    metadata: { estagioPedagogico: ["VALIDAR"] },
  },
  {
    workstream: "validacao_final",
    titulo: "Cliente consegue organizar: criar tarefa e acompanhar performance",
    metadata: { estagioPedagogico: ["VALIDAR"] },
  },
  {
    workstream: "validacao_final",
    titulo: "Cliente consegue escalar: subir campanha e interpretar resultados",
    metadata: { estagioPedagogico: ["VALIDAR"] },
  },
  {
    workstream: "validacao_final",
    titulo: "Confirmar primeiro valor real atingido (marco manual)",
    metadata: { milestone: "FIRST_VALUE", marcacaoManual: true },
  },
  {
    workstream: "validacao_final",
    titulo: "Handoff estruturado para o Customer Success",
    metadata: { handoffCs: true },
  },
];

export const WHITE_LABEL_CHECKLIST: ChecklistSeed = [
  { workstream: "abertura", titulo: "Iniciar implantação e confirmar responsável interno" },
  { workstream: "abertura", titulo: "Revisar o escopo vendido e os contatos do cliente" },
  { workstream: "comunicacao", titulo: "Fazer o primeiro contato de boas-vindas" },
  { workstream: "comunicacao", titulo: "Apresentar as etapas e o prazo estimado da implantação" },
  { workstream: "materiais", titulo: "Enviar o formulário de materiais e configuração" },
  { workstream: "materiais", titulo: "Acompanhar o preenchimento do formulário pelo cliente" },
  { workstream: "materiais", titulo: "Receber e validar materiais e informações do cliente" },
  { workstream: "materiais", titulo: "Solicitar correções ou complementos, quando necessário" },
  { workstream: "ambiente", titulo: "Configurar ambiente White Label e identidade da marca" },
  { workstream: "dominio", titulo: "Enviar instruções de DNS/CNAME e acompanhar a configuração" },
  { workstream: "dominio", titulo: "Validar DNS, TLS e domínio de e-mail (SPF/DKIM quando aplicável)" },
  { workstream: "qa_interno", titulo: "Executar QA interno do ambiente" },
  { workstream: "onboarding", titulo: "Agendar e conduzir a reunião de onboarding do ambiente" },
  { workstream: "validacao_cliente", titulo: "Validar ambiente com o cliente e liberar acesso administrativo" },
  { workstream: "go_live", titulo: "Confirmar go-live do ambiente White Label" },
  { workstream: "conclusao", titulo: "Concluir implantação e realizar handoff para Customer Success", metadata: { handoffCs: true } },
];


/* ── Vocabulário de fase, por família ──────────────────────────────────────
 *
 * Mora AQUI, e não em `fulfillment.ts`, por um motivo mecânico: aquele arquivo
 * importa `db`, e Client Component que o importasse quebraria o build. Era por
 * isso que `OnboardingDetail.tsx` mantinha uma CÓPIA deste mapa — idêntica hoje,
 * divergente no dia em que alguém mexer num lado só.
 *
 * Os dois vocabulários são DIFERENTES de propósito. A primeira versão do board
 * comprimia a jornada de Callface AI em 4 fases genéricas e o Kauã reprovou
 * ("muito simplório"): o guia real tem 10 marcos. Unificar os dois num enum de
 * seis fases repetiria esse erro. O que é universal é o BOARD — ver a entrega
 * de qualquer família num lugar só; o vocabulário de cada uma continua sendo o
 * do processo real dela.
 */
// Fase do Kanban de Implantação PABX (referência de UX, 19/08) — agrupamento
// honesto dos workstreams reais do Delivery PABX em 5 fases visuais
// (Planejamento/Preparação/Execução/Validação/Concluída). Não é um campo
// novo no banco: é derivado do primeiro item NÃO concluído do checklist real,
// na ordem real do processo — nunca fabricado, sempre reflete o passo atual.
// Só existe pra PABX porque é o vocabulário do processo real recebido; AI
// tem progressão pedagógica própria (EstagioPedagogico) e não deve ser
// forçado nesse rótulo.
export const FASE_PABX_POR_WORKSTREAM: Record<string, "planejamento" | "preparacao" | "execucao" | "validacao"> = {
  levantamento: "planejamento",
  portabilidade: "preparacao",
  softswitch: "preparacao",
  infraestrutura: "preparacao",
  licenciamento: "preparacao",
  configuracao_pbx: "execucao",
  qa_interno: "validacao",
  validacao_cliente: "validacao",
};

// Os 10 marcos da "Jornada do onboarding" (25/08, 2ª correção — a 1ª
// versão desta nota comprimia o guia real em 4 fases genéricas, achado do
// Kauã como "muito simplório"). Nomes e ordem batem exatamente com o
// stepper de referência que ele mandou: Abertura e validação → Acessos e
// integração → Usuários e times → Primeira ligação → Scorecard e insights
// → Campanhas → Agente de IA → First Message e testes → SLA e canais →
// Validação final. Cada marco agrupa os workstreams reais do guia que
// pertencem ao mesmo tópico/tema — não um campo novo no banco, é derivado
// do checklist real (AI_CHECKLIST_BASE), igual o padrão já usado pro PABX.
export const MARCOS_AI = [
  { key: "abertura_validacao", label: "Abertura e validação" },
  { key: "acessos_integracao", label: "Acessos e integração" },
  { key: "usuarios_times", label: "Usuários e times" },
  { key: "primeira_ligacao", label: "Primeira ligação" },
  { key: "scorecard_insights", label: "Scorecard e insights" },
  { key: "campanhas", label: "Campanhas" },
  { key: "agente_ia", label: "Agente de IA" },
  { key: "first_message_testes", label: "First Message e testes" },
  { key: "sla_canais", label: "SLA e canais" },
  { key: "validacao_final", label: "Validação final" },
] as const;
export type MarcoAI = (typeof MARCOS_AI)[number]["key"];

export const MARCO_AI_POR_WORKSTREAM: Record<string, MarcoAI> = {
  abertura: "abertura_validacao",
  dados_empresa: "abertura_validacao",
  crm_integracao: "acessos_integracao",
  acessos: "acessos_integracao",
  usuarios_times: "usuarios_times",
  primeira_ligacao: "primeira_ligacao",
  scorecard_insights: "scorecard_insights",
  proximos_passos: "scorecard_insights",
  relatorios: "scorecard_insights",
  // Reuniões online cai no marco "Campanhas" — o stepper de referência não
  // tem nó próprio pra reuniões, e as duas são features de crescimento
  // condicionais ao plano/módulo contratado (ver nota no checklist acima).
  reunioes_online: "campanhas",
  campanhas: "campanhas",
  agente_prompt: "agente_ia",
  agente_config: "agente_ia",
  first_message: "first_message_testes",
  bateria_testes: "first_message_testes",
  sla_canais: "sla_canais",
  validacao_final: "validacao_final",
};

/** Implantação do Callface Assistant.
 *
 *  O trabalho é diferente do White Label (lá se monta um ambiente de marca;
 *  aqui se ensina um assistente a atender o N1 do cliente), então o checklist é
 *  próprio. As FASES são as mesmas quatro colunas das outras implantações,
 *  porque o board é o mesmo. */
export const ASSISTANT_CHECKLIST: ChecklistSeed = [
  { workstream: "abertura", titulo: "Iniciar implantação e confirmar responsável interno" },
  { workstream: "abertura", titulo: "Revisar o plano vendido: franquia de atendimentos e usuários" },
  { workstream: "comunicacao", titulo: "Fazer o primeiro contato de boas-vindas" },
  { workstream: "comunicacao", titulo: "Apresentar as etapas e o prazo estimado da implantação" },
  { workstream: "conhecimento", titulo: "Coletar a base de conhecimento e as perguntas frequentes do cliente" },
  { workstream: "conhecimento", titulo: "Definir tom de voz, saudação e limites de resposta do assistente" },
  { workstream: "conhecimento", titulo: "Mapear o que o assistente resolve e o que ele escala para humano" },
  { workstream: "treinamento", titulo: "Treinar o assistente com a base do cliente" },
  { workstream: "treinamento", titulo: "Configurar as regras de escalonamento para o time de atendimento" },
  { workstream: "canais", titulo: "Conectar os canais de atendimento acordados" },
  { workstream: "canais", titulo: "Cadastrar os usuários do plano e seus acessos" },
  { workstream: "qa_interno", titulo: "Executar QA interno: rodar os casos de teste do cliente" },
  { workstream: "validacao_cliente", titulo: "Validar as respostas com o cliente e ajustar o que ele apontar" },
  { workstream: "go_live", titulo: "Ativar o assistente em produção e acompanhar o primeiro dia" },
  { workstream: "conclusao", titulo: "Revisar o volume do primeiro ciclo e passar a conta para o CS" },
];

/** Fase do Assistant, derivada da ORDEM do `ASSISTANT_CHECKLIST` acima. */
export const FASE_ASSISTANT_POR_WORKSTREAM: Record<string, "planejamento" | "preparacao" | "execucao" | "validacao"> = {
  abertura: "planejamento",
  comunicacao: "planejamento",
  conhecimento: "preparacao",     // o insumo vem do cliente, como os materiais do White Label
  treinamento: "execucao",
  canais: "execucao",
  qa_interno: "validacao",
  validacao_cliente: "validacao",
  go_live: "validacao",           // o cliente ainda pode reprovar
  conclusao: "validacao",         // sem fase, a entrega quase pronta cairia em Planejamento
};

/** Fase do White Label, derivada da ORDEM do `WHITE_LABEL_CHECKLIST` acima.
 *
 *  Não é vocabulário novo: são as mesmas cinco colunas do PABX, porque as duas
 *  são implantação e o board é o mesmo. O que muda é o trabalho dentro de cada
 *  uma, que continua sendo o checklist real de cada família.
 *
 *  Até 21/09 o White Label voltava `fase: null` E `etapa_atual: null` — o
 *  comentário na rota dizia "zero registro real hoje", e já havia registro com
 *  checklist preenchido. Quem abria a tela via a entrega existir e não via onde
 *  ela estava. */
export const FASE_WHITE_LABEL_POR_WORKSTREAM: Record<string, "planejamento" | "preparacao" | "execucao" | "validacao"> = {
  abertura: "planejamento",       // iniciar implantação, revisar escopo
  comunicacao: "planejamento",    // boas-vindas, apresentar etapas e prazo
  materiais: "preparacao",        // formulário, coleta e validação do que o cliente manda
  ambiente: "execucao",           // configurar ambiente e identidade da marca
  dominio: "execucao",            // DNS/CNAME, TLS, SPF/DKIM
  qa_interno: "validacao",
  onboarding: "validacao",        // reunião de onboarding do ambiente
  validacao_cliente: "validacao",
  go_live: "validacao",           // go-live ainda é validação: o cliente ainda pode reprovar
  // Handoff para o CS. Fica em validação, e NÃO fora do mapa: enquanto esse
  // item estiver pendente o fulfillment não está COMPLETED, e sem fase ele
  // cairia no fallback — uma entrega quase pronta aparecendo em Planejamento.
  conclusao: "validacao",
};

