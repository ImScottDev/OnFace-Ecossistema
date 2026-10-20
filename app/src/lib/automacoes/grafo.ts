/**
 * Construtor de Automações (Fluxos) — contrato compartilhado entre o editor
 * (frontend) e o executor (backend). Ver docs/produto/automacoes-fluxos.md.
 *
 * Este arquivo é PURO: sem banco, sem React, sem Node. Roda no navegador (o
 * editor marca pendências e mostra prévia de expressão) e no servidor (a API
 * recusa publicar e o executor resolve expressões e regras). Ter as duas
 * pontas lendo a MESMA regra é o motivo de existir: a lição repetida deste
 * repo é regra duplicada que diverge em silêncio.
 *
 * O que mora aqui: o formato do grafo (nós/arestas em JSON, gravado em
 * automacao_versoes.nodes/edges), o catálogo de nós com campos e saídas, o
 * catálogo de eventos reais da plataforma, as variáveis de contexto, a
 * resolução de {{ expressões }}, a avaliação de regras e a validação de
 * publicação. Executar ação NÃO mora aqui (é do backend, via adapters do
 * cadence-engine).
 */
import { z } from "zod";

// ─── Grafo ──────────────────────────────────────────────────────────────────

export const TIPOS_NO = [
  "gatilho",
  // Lógica
  "condicao", "roteador", "esperar", "aguardar_horario", "horario_comercial", "definir_variavel", "parar",
  // Ações de plataforma
  "criar_tarefa", "mover_etapa", "adicionar_tag", "remover_tag", "atribuir_responsavel", "enviar_whatsapp",
  "enviar_email", "inscrever_cadencia", "remover_cadencia", "notificar_usuario", "atualizar_campo", "adicionar_nota",
  // Integrações
  "requisicao_http", "discagem_callface",
  // IA
  "ia_gerar_texto", "ia_classificar", "ia_responder",
  // Agentes de IA (operadores autônomos): atribuir muda a responsabilidade, acionar pede uma execução. Sem cadência.
  "agente_atribuir", "agente_acionar", "agente_pausar", "agente_transferir", "agente_encerrar",
] as const;
export type TipoNo = (typeof TIPOS_NO)[number];

export type CategoriaNo = "gatilho" | "logica" | "acao" | "integracao" | "ia";

export type PoliticaFalha = "parar" | "saida_erro" | "ignorar";

export interface FalhaNo {
  /** parar = execução termina com erro; saida_erro = segue pela saída "erro"; ignorar = segue pela saída normal. */
  politica: PoliticaFalha;
  /** Teto de tempo do nó, em segundos (1–300). */
  timeoutSeg: number;
  /** Novas tentativas antes de aplicar a política (0–3), espaçadas 1, 5 e 15 min. */
  tentativas: number;
}

export interface NoFluxo {
  /** Estável e curto ("n1", "n2"...). É o que aparece em {{ nos.<id>.campo }}. */
  id: string;
  tipo: TipoNo;
  /** Título editável no canvas; vazio usa o rótulo do catálogo. */
  rotulo?: string;
  posicao: { x: number; y: number };
  config: Record<string, unknown>;
  /** Ausente = FALHA_PADRAO. Gatilho e lógica pura ignoram. */
  falha?: FalhaNo;
  /** Nó desligado: o executor passa direto pela saída normal sem executar. */
  desativado?: boolean;
  /** Anotação livre de quem montou. Não afeta a execução. */
  nota?: string;
}

export interface ArestaFluxo {
  id: string;
  origem: string;
  /** id da saída do nó de origem (ver `saidasDoNo`). Normal = "ok". */
  saida: string;
  destino: string;
}

export interface GrafoFluxo {
  versao: 1;
  nos: NoFluxo[];
  arestas: ArestaFluxo[];
}

/** Gravado em automacao_versoes.settings (e no rascunho). */
export interface ConfigFluxo {
  /** uma_viva = a mesma entidade não entra de novo enquanto houver execução viva (padrão);
   *  sempre = entra a cada disparo; uma_vez = só a primeira vez na vida da automação. */
  reentrada: "uma_viva" | "sempre" | "uma_vez";
  fuso: string;
  horarioComercial: { dias: number[]; inicio: string; fim: string };
  /** O lead respondeu enquanto a execução ESPERA (espera, horário, nova tentativa):
   *  continuar = a espera vence no horário, como sempre foi (padrão; ausente = continuar);
   *  parar = a execução é cancelada com motivo "lead respondeu". Lido em `registrarRespostaEmFluxos`. */
  aoResponder?: "continuar" | "parar";
}

export const FALHA_PADRAO: FalhaNo = { politica: "parar", timeoutSeg: 30, tentativas: 0 };

export const CONFIG_PADRAO: ConfigFluxo = {
  reentrada: "uma_viva",
  fuso: "America/Sao_Paulo",
  horarioComercial: { dias: [1, 2, 3, 4, 5], inicio: "09:00", fim: "18:00" },
};

// Validação de FORMA (a API usa ao receber rascunho). A validação de conteúdo
// — campo obrigatório vazio, nó solto — é `validarGrafo`, que não bloqueia o
// rascunho, só a publicação.
const idSchema = z.string().min(1).max(40).regex(/^[a-zA-Z0-9_-]+$/);
export const grafoFluxoSchema = z.object({
  versao: z.literal(1),
  nos: z.array(z.object({
    id: idSchema,
    tipo: z.enum(TIPOS_NO),
    rotulo: z.string().max(80).optional(),
    posicao: z.object({ x: z.number(), y: z.number() }),
    config: z.record(z.string(), z.unknown()),
    falha: z.object({
      politica: z.enum(["parar", "saida_erro", "ignorar"]),
      timeoutSeg: z.number().int().min(1).max(300),
      tentativas: z.number().int().min(0).max(3),
    }).optional(),
    desativado: z.boolean().optional(),
    nota: z.string().max(500).optional(),
  })).min(1).max(150),
  arestas: z.array(z.object({ id: idSchema, origem: idSchema, saida: z.string().min(1).max(40), destino: idSchema })).max(400),
});

export const configFluxoSchema = z.object({
  reentrada: z.enum(["uma_viva", "sempre", "uma_vez"]),
  fuso: z.string().min(1).max(60),
  horarioComercial: z.object({
    dias: z.array(z.number().int().min(0).max(6)),
    inicio: z.string().regex(/^\d{2}:\d{2}$/),
    fim: z.string().regex(/^\d{2}:\d{2}$/),
  }),
  aoResponder: z.enum(["continuar", "parar"]).optional(),
});

// ─── Entidades e eventos reais ─────────────────────────────────────────────

export type TipoEntidade = "lead" | "negocio" | "oportunidade" | "contato" | "empresa" | "cliente" | "servico";

export const ROTULO_ENTIDADE: Record<TipoEntidade, string> = {
  lead: "Lead", negocio: "Negócio", oportunidade: "Oportunidade", contato: "Contato",
  empresa: "Empresa", cliente: "Cliente", servico: "Serviço",
};

export interface EventoPlataforma {
  id: string;
  rotulo: string;
  grupo: "Leads e negócios" | "Conversas" | "Propostas e contratos" | "Financeiro" | "Clientes" | "Tarefas";
  entidade: TipoEntidade;
  /**
   * De onde o fato vem. UMA fonte por evento, para o mesmo fato nunca
   * disparar duas vezes: `outbox` = event_outbox.event_type (consumer do
   * worker); `legado` = gatilho de dispararAutomacoes() (rotas/worker/Stripe),
   * usado só onde o fato não passa pelo outbox.
   */
  fontes: { outbox?: string[]; legado?: string };
  /** Campos que chegam em {{ gatilho.* }}, para o seletor de variáveis e filtros. */
  campos: { chave: string; rotulo: string }[];
}

/**
 * Só entra aqui o que o código emite de verdade (conferido por grep em
 * 01/10/2026). Dois foram LIGADOS pelo backend nesta frente e estão marcados:
 * `negocio.etapa_mudou` via OpportunityStageChanged (o board /pipeline grava
 * em vendas_eventos e não chegava ao outbox) e `tarefa.vencida` (varredura do
 * sweep de fluxos).
 */
export const EVENTOS_PLATAFORMA: EventoPlataforma[] = [
  { id: "lead.criado", rotulo: "Novo lead", grupo: "Leads e negócios", entidade: "lead",
    // AcquisitionCreated é como a Pré-vendas cria (56 no outbox); LeadCreated é a rota legada.
    fontes: { outbox: ["LeadCreated", "AcquisitionCreated"] },
    campos: [{ chave: "origem", rotulo: "Origem" }, { chave: "tipo", rotulo: "Tipo" }] },
  { id: "lead.qualificado", rotulo: "Lead qualificado", grupo: "Leads e negócios", entidade: "lead",
    fontes: { outbox: ["AcquisitionQualified"] }, campos: [] },
  { id: "lead.inativo", rotulo: "Lead inativo (perdido além do prazo)", grupo: "Leads e negócios", entidade: "lead",
    fontes: { legado: "lead_inativo" }, campos: [] },
  { id: "negocio.criado", rotulo: "Negócio criado", grupo: "Leads e negócios", entidade: "negocio",
    fontes: { outbox: ["DealCreated", "OpportunityCreated"] }, campos: [{ chave: "status", rotulo: "Etapa inicial" }] },
  { id: "negocio.etapa_mudou", rotulo: "Negócio mudou de etapa", grupo: "Leads e negócios", entidade: "negocio",
    // LIGADO nesta frente: OpportunityStageChanged entra na tradução canônica.
    fontes: { outbox: ["StageChanged", "OpportunityStageChanged"] },
    campos: [{ chave: "status", rotulo: "Etapa nova" }, { chave: "statusAnterior", rotulo: "Etapa anterior" }, { chave: "toStage", rotulo: "Etapa nova (automação)" }] },
  { id: "negocio.ganho", rotulo: "Negócio ganho", grupo: "Leads e negócios", entidade: "negocio",
    fontes: { outbox: ["DealWon", "OpportunityWon"] }, campos: [] },
  { id: "negocio.perdido", rotulo: "Negócio perdido", grupo: "Leads e negócios", entidade: "negocio",
    fontes: { outbox: ["DealLost", "OpportunityLost"] }, campos: [{ chave: "motivoPerda", rotulo: "Motivo da perda" }] },
  { id: "tag.adicionada", rotulo: "Tag adicionada", grupo: "Leads e negócios", entidade: "lead",
    fontes: { outbox: ["TagAdded"] }, campos: [{ chave: "tag", rotulo: "Tag" }, { chave: "entityType", rotulo: "Tipo do registro" }] },
  { id: "tag.removida", rotulo: "Tag removida", grupo: "Leads e negócios", entidade: "lead",
    fontes: { outbox: ["TagRemoved"] }, campos: [{ chave: "tag", rotulo: "Tag" }, { chave: "entityType", rotulo: "Tipo do registro" }] },
  { id: "whatsapp.recebido", rotulo: "WhatsApp recebido", grupo: "Conversas", entidade: "contato",
    fontes: { outbox: ["ConversationMessageReceived"] }, campos: [{ chave: "conteudo", rotulo: "Texto da mensagem" }] },
  { id: "nps.recebido", rotulo: "NPS recebido", grupo: "Clientes", entidade: "empresa",
    fontes: { legado: "nps_recebido" }, campos: [{ chave: "nota", rotulo: "Nota" }, { chave: "comentario", rotulo: "Comentário" }] },
  { id: "proposta.enviada", rotulo: "Proposta enviada", grupo: "Propostas e contratos", entidade: "negocio",
    fontes: { outbox: ["ProposalSent"] }, campos: [] },
  { id: "proposta.visualizada", rotulo: "Proposta visualizada", grupo: "Propostas e contratos", entidade: "negocio",
    fontes: { outbox: ["ProposalViewed"] }, campos: [] },
  { id: "proposta.aceita", rotulo: "Proposta aceita", grupo: "Propostas e contratos", entidade: "negocio",
    fontes: { outbox: ["ProposalAccepted"] }, campos: [] },
  { id: "contrato.assinado", rotulo: "Contrato assinado", grupo: "Propostas e contratos", entidade: "negocio",
    fontes: { outbox: ["ContractSigned"] }, campos: [] },
  { id: "contrato.vencendo", rotulo: "Contrato vencendo", grupo: "Clientes", entidade: "empresa",
    fontes: { legado: "contrato_vencendo" }, campos: [{ chave: "diasParaVencer", rotulo: "Dias para vencer" }] },
  { id: "cliente.criado", rotulo: "Cliente criado", grupo: "Clientes", entidade: "cliente",
    fontes: { outbox: ["CustomerCreated"] }, campos: [] },
  { id: "servico.ativado", rotulo: "Serviço ativado", grupo: "Clientes", entidade: "servico",
    fontes: { outbox: ["CanonicalServiceActivated"] }, campos: [] },
  { id: "pagamento.confirmado", rotulo: "Pagamento confirmado", grupo: "Financeiro", entidade: "negocio",
    fontes: { outbox: ["PaymentCompleted"] }, campos: [] },
  // Os quatro do Stripe vêm de dispararAutomacoesFinanceiras: é ela que resolve
  // a empresa pela fatura/assinatura. O PaymentFailed do outbox é falha de
  // checkout, outro fato.
  { id: "stripe.pagamento_falhou", rotulo: "Stripe: pagamento falhou", grupo: "Financeiro", entidade: "empresa",
    fontes: { legado: "pagamento_falhou" }, campos: [{ chave: "valor", rotulo: "Valor" }] },
  { id: "stripe.fatura_atrasada", rotulo: "Stripe: fatura atrasada", grupo: "Financeiro", entidade: "empresa",
    fontes: { legado: "fatura_atrasada" }, campos: [{ chave: "valor", rotulo: "Valor" }] },
  { id: "stripe.fatura_paga", rotulo: "Stripe: fatura paga", grupo: "Financeiro", entidade: "empresa",
    fontes: { legado: "fatura_paga" }, campos: [{ chave: "valor", rotulo: "Valor" }] },
  { id: "stripe.assinatura_alterada", rotulo: "Stripe: status da assinatura mudou", grupo: "Financeiro", entidade: "empresa",
    fontes: { legado: "assinatura_status_alterado" }, campos: [{ chave: "status", rotulo: "Status novo" }] },
  // LIGADO nesta frente: varredura do job fluxos-sweep (tarefa pendente cujo vence_em passou).
  { id: "tarefa.vencida", rotulo: "Tarefa venceu", grupo: "Tarefas", entidade: "lead",
    fontes: { legado: "tarefa_vencida" }, campos: [{ chave: "titulo", rotulo: "Título da tarefa" }, { chave: "tarefaId", rotulo: "Id da tarefa" }] },
];

export const eventoPorId = (id: string) => EVENTOS_PLATAFORMA.find((e) => e.id === id);

/** Campos que o nó "Atualizar campo" pode escrever (allowlist do backend). */
export const CAMPOS_ATUALIZAVEIS: Record<"lead" | "negocio" | "contato", { chave: string; rotulo: string }[]> = {
  lead: [
    { chave: "nome", rotulo: "Nome" }, { chave: "sobrenome", rotulo: "Sobrenome" }, { chave: "email", rotulo: "E-mail" },
    { chave: "telefone", rotulo: "Telefone" }, { chave: "cargo", rotulo: "Cargo" }, { chave: "origem", rotulo: "Origem" },
    { chave: "linkedin", rotulo: "LinkedIn" },
  ],
  negocio: [
    { chave: "titulo", rotulo: "Título" }, { chave: "temperatura", rotulo: "Temperatura" },
    { chave: "proximaAcao", rotulo: "Próxima ação" }, { chave: "previsaoFechamento", rotulo: "Previsão de fechamento" },
    // Campo personalizado: grava em negocios.campos_custom[<nome>].
    { chave: "campos_custom", rotulo: "Campo personalizado" },
  ],
  contato: [{ chave: "nome", rotulo: "Nome" }, { chave: "email", rotulo: "E-mail" }],
};

// ─── Variáveis de contexto ─────────────────────────────────────────────────

/** Raízes de {{ }} que o executor hidrata. `nos.<id>.*` vem das saídas declaradas no catálogo. */
export const VARIAVEIS_CONTEXTO: { raiz: string; rotulo: string; campos: { chave: string; rotulo: string }[] }[] = [
  { raiz: "registro", rotulo: "Registro do gatilho", campos: [
    { chave: "tipo", rotulo: "Tipo" }, { chave: "id", rotulo: "Id" }, { chave: "nome", rotulo: "Nome" },
    { chave: "responsavel_id", rotulo: "Responsável (id)" }, { chave: "responsavel_nome", rotulo: "Responsável" },
  ] },
  { raiz: "lead", rotulo: "Lead", campos: [
    { chave: "nome", rotulo: "Nome" }, { chave: "primeiro_nome", rotulo: "Primeiro nome" }, { chave: "email", rotulo: "E-mail" },
    { chave: "telefone", rotulo: "Telefone" }, { chave: "origem", rotulo: "Origem" }, { chave: "etapa", rotulo: "Etapa de pré-vendas" },
    { chave: "cargo", rotulo: "Cargo" }, { chave: "tags", rotulo: "Tags" },
    { chave: "utm_source", rotulo: "UTM source" }, { chave: "utm_campaign", rotulo: "UTM campaign" },
    { chave: "meta_campaign_id", rotulo: "Campanha Meta (id)" }, { chave: "distribuicao_motivo", rotulo: "Motivo da distribuição" },
  ] },
  { raiz: "negocio", rotulo: "Negócio", campos: [
    { chave: "titulo", rotulo: "Título" }, { chave: "etapa", rotulo: "Etapa" }, { chave: "valor", rotulo: "Valor" },
    { chave: "mrr", rotulo: "MRR estimado" }, { chave: "temperatura", rotulo: "Temperatura" }, { chave: "responsavel_nome", rotulo: "Responsável" },
  ] },
  { raiz: "contato", rotulo: "Contato", campos: [
    { chave: "nome", rotulo: "Nome" }, { chave: "telefone", rotulo: "Telefone" }, { chave: "email", rotulo: "E-mail" },
    { chave: "ultima_mensagem", rotulo: "Última mensagem recebida" },
  ] },
  { raiz: "empresa", rotulo: "Empresa", campos: [
    { chave: "nome", rotulo: "Nome" }, { chave: "cnpj", rotulo: "CNPJ" }, { chave: "setor", rotulo: "Setor" },
  ] },
  { raiz: "vars", rotulo: "Variáveis definidas", campos: [] },
  { raiz: "", rotulo: "Agora", campos: [{ chave: "agora", rotulo: "Data e hora (ISO)" }, { chave: "hoje", rotulo: "Data de hoje" }] },
];

// ─── Catálogo de nós ───────────────────────────────────────────────────────

export type TipoCampo =
  | "texto" | "texto_longo" | "numero" | "booleano" | "selecao" | "duracao" | "horario" | "horarios" | "dias_semana"
  | "usuario" | "tag" | "etapa" | "cadencia" | "template_whatsapp" | "sessao_whatsapp" | "agente_ia" | "evento" | "regras" | "rotas"
  | "classes" | "pares" | "campo_entidade" | "url" | "tipo_entidade" | "somente_leitura";

export interface CampoConfig {
  chave: string;
  rotulo: string;
  tipo: TipoCampo;
  obrigatorio?: boolean;
  ajuda?: string;
  placeholder?: string;
  opcoes?: { valor: string; rotulo: string }[];
  /** Aceita {{ }}: o inspetor mostra o seletor de variáveis ao lado. */
  aceitaExpressao?: boolean;
  padrao?: unknown;
  min?: number;
  max?: number;
  /** Só aparece (e só é exigido) quando outro campo tem um destes valores. */
  mostrarSe?: { campo: string; valores: unknown[] };
}

export interface SaidaNo { id: string; rotulo: string; erro?: boolean }

export interface MetaNo {
  tipo: TipoNo;
  categoria: CategoriaNo;
  rotulo: string;
  descricao: string;
  /** Nome do ícone em lucide-react. */
  icone: string;
  campos: CampoConfig[];
  /** Saídas fixas. Condição, roteador e classificar calculam em `saidasDoNo`. */
  saidas: SaidaNo[];
  /** Campos que este nó publica em {{ nos.<id>.* }}. */
  saidaCampos: { chave: string; rotulo: string }[];
  /** Tem efeito fora do grafo (escreve, envia, chama API). O Ensaio nunca executa. */
  efeitoExterno: boolean;
  /** Precisa de um registro (lead/negócio/...) no contexto para rodar. */
  exigeEntidade: boolean;
}

const OK: SaidaNo[] = [{ id: "ok", rotulo: "Próximo" }];
const DUR_UNIDADES = [{ valor: "minutos", rotulo: "minutos" }, { valor: "horas", rotulo: "horas" }, { valor: "dias", rotulo: "dias" }];
const PRIORIDADES = [{ valor: "baixa", rotulo: "Baixa" }, { valor: "media", rotulo: "Média" }, { valor: "alta", rotulo: "Alta" }, { valor: "urgente", rotulo: "Urgente" }];
const ALVOS = [
  { valor: "nenhuma", rotulo: "Nenhum registro" }, { valor: "lead", rotulo: "Lead" }, { valor: "negocio", rotulo: "Negócio" },
  { valor: "oportunidade", rotulo: "Oportunidade" }, { valor: "contato", rotulo: "Contato" }, { valor: "empresa", rotulo: "Empresa" },
];

export const CATALOGO_NOS: Record<TipoNo, MetaNo> = {
  gatilho: {
    tipo: "gatilho", categoria: "gatilho", rotulo: "Quando", descricao: "Começa a automação.", icone: "Zap",
    campos: [
      { chave: "modo", rotulo: "Começa quando", tipo: "selecao", obrigatorio: true, padrao: "evento", opcoes: [
        { valor: "manual", rotulo: "Eu mandar rodar" }, { valor: "agendado", rotulo: "Em horários marcados" },
        { valor: "evento", rotulo: "Algo acontecer na plataforma" }, { valor: "webhook", rotulo: "Receber uma chamada HTTP" },
      ] },
      // evento
      { chave: "evento", rotulo: "O que acontece", tipo: "evento", obrigatorio: true, mostrarSe: { campo: "modo", valores: ["evento"] } },
      { chave: "filtros", rotulo: "Só quando", tipo: "regras", ajuda: "Regras sobre os dados do evento. Vazio = sempre.", mostrarSe: { campo: "modo", valores: ["evento"] } },
      { chave: "entidadeAlvo", rotulo: "Só para registros do tipo", tipo: "selecao", padrao: "",
        ajuda: "Tag pode ser aplicada a qualquer registro. Escolha o tipo para o fluxo disparar só nele (ex.: só Oportunidade).",
        opcoes: [{ valor: "", rotulo: "Qualquer registro" }, { valor: "lead", rotulo: "Lead" }, { valor: "negocio", rotulo: "Negócio" }, { valor: "oportunidade", rotulo: "Oportunidade" },
          { valor: "contato", rotulo: "Contato" }, { valor: "empresa", rotulo: "Empresa" }, { valor: "cliente", rotulo: "Cliente" }],
        mostrarSe: { campo: "evento", valores: ["tag.adicionada", "tag.removida"] } },
      { chave: "permitirOrigemAutomacao", rotulo: "Disparar também quando a mudança vier de outra automação", tipo: "booleano", padrao: false,
        ajuda: "Desligado evita automação disparando automação em cadeia.", mostrarSe: { campo: "modo", valores: ["evento"] } },
      // manual
      { chave: "entidade", rotulo: "Roda sobre", tipo: "tipo_entidade", padrao: "nenhuma", opcoes: ALVOS,
        ajuda: "Ao rodar, você escolhe o registro.", mostrarSe: { campo: "modo", valores: ["manual"] } },
      // agendado
      { chave: "frequencia", rotulo: "Repetir", tipo: "selecao", obrigatorio: true, padrao: "diaria", opcoes: [
        { valor: "intervalo", rotulo: "A cada intervalo" }, { valor: "diaria", rotulo: "Todo dia" },
        { valor: "semanal", rotulo: "Em dias da semana" }, { valor: "mensal", rotulo: "Todo mês" },
      ], mostrarSe: { campo: "modo", valores: ["agendado"] } },
      { chave: "intervaloMinutos", rotulo: "Intervalo (minutos)", tipo: "numero", min: 15, max: 1440, padrao: 60, obrigatorio: true, mostrarSe: { campo: "frequencia", valores: ["intervalo"] } },
      { chave: "horarios", rotulo: "Horários", tipo: "horarios", obrigatorio: true, padrao: ["09:00"], mostrarSe: { campo: "frequencia", valores: ["diaria", "semanal", "mensal"] } },
      { chave: "diasSemana", rotulo: "Dias", tipo: "dias_semana", obrigatorio: true, padrao: [1, 2, 3, 4, 5], mostrarSe: { campo: "frequencia", valores: ["semanal"] } },
      { chave: "diaMes", rotulo: "Dia do mês", tipo: "numero", min: 1, max: 28, padrao: 1, obrigatorio: true, mostrarSe: { campo: "frequencia", valores: ["mensal"] } },
      { chave: "alvo", rotulo: "Para cada", tipo: "tipo_entidade", padrao: "nenhuma", opcoes: ALVOS.filter((a) => ["nenhuma", "lead", "negocio"].includes(a.valor)),
        ajuda: "Com um tipo escolhido, roda uma vez por registro que casar com os filtros (até 500).", mostrarSe: { campo: "modo", valores: ["agendado"] } },
      { chave: "alvoEtapa", rotulo: "Na etapa", tipo: "etapa", mostrarSe: { campo: "alvo", valores: ["lead", "negocio"] } },
      { chave: "alvoTag", rotulo: "Com a tag", tipo: "tag", mostrarSe: { campo: "alvo", valores: ["lead", "negocio"] } },
      { chave: "alvoResponsavelId", rotulo: "Do responsável", tipo: "usuario", mostrarSe: { campo: "alvo", valores: ["lead", "negocio"] } },
      { chave: "alvoParadoHaDias", rotulo: "Sem atualização há (dias)", tipo: "numero", min: 1, max: 365, mostrarSe: { campo: "alvo", valores: ["lead", "negocio"] } },
      // webhook
      { chave: "webhookUrl", rotulo: "Endereço", tipo: "somente_leitura", ajuda: "Gerado ao salvar. Envie POST com JSON. Trate como senha.", mostrarSe: { campo: "modo", valores: ["webhook"] } },
      { chave: "webhookEntidade", rotulo: "Registro do corpo", tipo: "tipo_entidade", padrao: "nenhuma", opcoes: ALVOS, mostrarSe: { campo: "modo", valores: ["webhook"] } },
      { chave: "webhookEntidadeId", rotulo: "Id do registro", tipo: "texto", aceitaExpressao: true, placeholder: "{{ gatilho.body.lead_id }}", obrigatorio: true,
        mostrarSe: { campo: "webhookEntidade", valores: ["lead", "negocio", "oportunidade", "contato", "empresa"] } },
    ],
    saidas: OK,
    saidaCampos: [],
    efeitoExterno: false, exigeEntidade: false,
  },

  condicao: {
    tipo: "condicao", categoria: "logica", rotulo: "Condição", descricao: "Segue por Sim ou Não conforme as regras.", icone: "GitBranch",
    campos: [
      { chave: "combinador", rotulo: "Casar", tipo: "selecao", padrao: "e", opcoes: [{ valor: "e", rotulo: "Todas as regras" }, { valor: "ou", rotulo: "Qualquer regra" }] },
      { chave: "regras", rotulo: "Regras", tipo: "regras", obrigatorio: true },
    ],
    saidas: [{ id: "sim", rotulo: "Sim" }, { id: "nao", rotulo: "Não" }],
    saidaCampos: [{ chave: "resultado", rotulo: "Resultado (true/false)" }],
    efeitoExterno: false, exigeEntidade: false,
  },
  roteador: {
    tipo: "roteador", categoria: "logica", rotulo: "Roteador", descricao: "Manda pela primeira rota cujas regras casarem.", icone: "Split",
    campos: [{ chave: "rotas", rotulo: "Rotas", tipo: "rotas", obrigatorio: true, ajuda: "Avaliadas de cima para baixo. Nenhuma casou = Caso contrário." }],
    saidas: [],
    saidaCampos: [{ chave: "rota", rotulo: "Rota escolhida" }],
    efeitoExterno: false, exigeEntidade: false,
  },
  esperar: {
    tipo: "esperar", categoria: "logica", rotulo: "Esperar", descricao: "Pausa por um tempo e continua.", icone: "Hourglass",
    campos: [
      { chave: "quantidade", rotulo: "Quanto", tipo: "numero", obrigatorio: true, min: 1, padrao: 1 },
      { chave: "unidade", rotulo: "Unidade", tipo: "selecao", obrigatorio: true, padrao: "dias", opcoes: DUR_UNIDADES },
    ],
    saidas: OK, saidaCampos: [{ chave: "retomadoEm", rotulo: "Retomado em" }],
    efeitoExterno: false, exigeEntidade: false,
  },
  aguardar_horario: {
    tipo: "aguardar_horario", categoria: "logica", rotulo: "Aguardar até horário", descricao: "Espera o próximo horário marcado.", icone: "AlarmClock",
    campos: [
      { chave: "horario", rotulo: "Horário", tipo: "horario", obrigatorio: true, padrao: "09:00" },
      { chave: "diasSemana", rotulo: "Nos dias", tipo: "dias_semana", padrao: [1, 2, 3, 4, 5] },
    ],
    saidas: OK, saidaCampos: [{ chave: "retomadoEm", rotulo: "Retomado em" }],
    efeitoExterno: false, exigeEntidade: false,
  },
  horario_comercial: {
    tipo: "horario_comercial", categoria: "logica", rotulo: "Horário comercial", descricao: "Separa o que chega dentro e fora do expediente.", icone: "BriefcaseBusiness",
    campos: [
      { chave: "usarPadrao", rotulo: "Usar o expediente da automação", tipo: "booleano", padrao: true },
      { chave: "dias", rotulo: "Dias", tipo: "dias_semana", padrao: [1, 2, 3, 4, 5], mostrarSe: { campo: "usarPadrao", valores: [false] } },
      { chave: "inicio", rotulo: "Início", tipo: "horario", padrao: "09:00", mostrarSe: { campo: "usarPadrao", valores: [false] } },
      { chave: "fim", rotulo: "Fim", tipo: "horario", padrao: "18:00", mostrarSe: { campo: "usarPadrao", valores: [false] } },
    ],
    saidas: [{ id: "dentro", rotulo: "Dentro" }, { id: "fora", rotulo: "Fora" }],
    saidaCampos: [],
    efeitoExterno: false, exigeEntidade: false,
  },
  definir_variavel: {
    tipo: "definir_variavel", categoria: "logica", rotulo: "Definir variável", descricao: "Guarda valores em {{ vars.* }}.", icone: "Variable",
    campos: [{ chave: "pares", rotulo: "Variáveis", tipo: "pares", obrigatorio: true, aceitaExpressao: true }],
    saidas: OK, saidaCampos: [],
    efeitoExterno: false, exigeEntidade: false,
  },
  parar: {
    tipo: "parar", categoria: "logica", rotulo: "Parar", descricao: "Encerra a execução aqui.", icone: "CircleStop",
    campos: [
      { chave: "resultado", rotulo: "Terminar como", tipo: "selecao", padrao: "sucesso", opcoes: [{ valor: "sucesso", rotulo: "Sucesso" }, { valor: "erro", rotulo: "Erro" }] },
      { chave: "motivo", rotulo: "Motivo", tipo: "texto", aceitaExpressao: true },
    ],
    saidas: [], saidaCampos: [],
    efeitoExterno: false, exigeEntidade: false,
  },

  criar_tarefa: {
    tipo: "criar_tarefa", categoria: "acao", rotulo: "Criar tarefa", descricao: "Cria tarefa ligada ao registro.", icone: "ListTodo",
    campos: [
      { chave: "titulo", rotulo: "Título", tipo: "texto", obrigatorio: true, aceitaExpressao: true },
      { chave: "descricao", rotulo: "Descrição", tipo: "texto_longo", aceitaExpressao: true },
      { chave: "prioridade", rotulo: "Prioridade", tipo: "selecao", padrao: "media", opcoes: PRIORIDADES },
      { chave: "prazoMinutos", rotulo: "Vence em", tipo: "duracao", padrao: 1440 },
      { chave: "responsavelId", rotulo: "Responsável", tipo: "usuario", aceitaExpressao: true, ajuda: "Vazio = responsável do registro." },
    ],
    saidas: OK, saidaCampos: [{ chave: "tarefaId", rotulo: "Id da tarefa" }],
    efeitoExterno: true, exigeEntidade: true,
  },
  mover_etapa: {
    tipo: "mover_etapa", categoria: "acao", rotulo: "Mover etapa", descricao: "Muda a etapa do lead ou negócio. Ganho exige o gate comercial e é recusado.", icone: "ArrowRightLeft",
    campos: [{ chave: "etapa", rotulo: "Para a etapa", tipo: "etapa", obrigatorio: true }],
    saidas: OK, saidaCampos: [{ chave: "etapa", rotulo: "Etapa nova" }],
    efeitoExterno: true, exigeEntidade: true,
  },
  adicionar_tag: {
    tipo: "adicionar_tag", categoria: "acao", rotulo: "Adicionar tag", descricao: "Põe uma tag no registro.", icone: "Tag",
    campos: [{ chave: "tagId", rotulo: "Tag", tipo: "tag", obrigatorio: true }],
    saidas: OK, saidaCampos: [],
    efeitoExterno: true, exigeEntidade: true,
  },
  remover_tag: {
    tipo: "remover_tag", categoria: "acao", rotulo: "Remover tag", descricao: "Tira uma tag do registro.", icone: "Tags",
    campos: [{ chave: "tagId", rotulo: "Tag", tipo: "tag", obrigatorio: true }],
    saidas: OK, saidaCampos: [],
    efeitoExterno: true, exigeEntidade: true,
  },
  atribuir_responsavel: {
    tipo: "atribuir_responsavel", categoria: "acao", rotulo: "Atribuir responsável", descricao: "Troca o dono do registro, com auditoria.", icone: "UserCheck",
    campos: [{ chave: "responsavelId", rotulo: "Responsável", tipo: "usuario", obrigatorio: true, aceitaExpressao: true }],
    saidas: OK, saidaCampos: [],
    efeitoExterno: true, exigeEntidade: true,
  },
  enviar_whatsapp: {
    tipo: "enviar_whatsapp", categoria: "acao", rotulo: "Enviar WhatsApp", descricao: "Manda mensagem ao contato pelo número conectado.", icone: "MessageCircle",
    campos: [
      { chave: "modo", rotulo: "Enviar", tipo: "selecao", padrao: "texto", opcoes: [{ valor: "texto", rotulo: "Texto" }, { valor: "template", rotulo: "Modelo aprovado" }] },
      { chave: "mensagem", rotulo: "Mensagem", tipo: "texto_longo", obrigatorio: true, aceitaExpressao: true, mostrarSe: { campo: "modo", valores: ["texto"] } },
      { chave: "templateId", rotulo: "Modelo", tipo: "template_whatsapp", obrigatorio: true, mostrarSe: { campo: "modo", valores: ["template"] } },
      { chave: "telefone", rotulo: "Para o número", tipo: "texto", aceitaExpressao: true, ajuda: "Vazio = telefone do registro." },
      { chave: "sessaoId", rotulo: "Enviar pelo número", tipo: "sessao_whatsapp", ajuda: "Vazio = o número do responsável do registro; sem ele, o padrão da organização." },
    ],
    saidas: OK, saidaCampos: [{ chave: "jobId", rotulo: "Id do envio" }],
    efeitoExterno: true, exigeEntidade: true,
  },
  enviar_email: {
    tipo: "enviar_email", categoria: "acao", rotulo: "Enviar e-mail", descricao: "Manda e-mail ao contato.", icone: "Mail",
    campos: [
      { chave: "assunto", rotulo: "Assunto", tipo: "texto", obrigatorio: true, aceitaExpressao: true },
      { chave: "mensagem", rotulo: "Mensagem", tipo: "texto_longo", obrigatorio: true, aceitaExpressao: true },
      { chave: "para", rotulo: "Para", tipo: "texto", aceitaExpressao: true, ajuda: "Vazio = e-mail do registro." },
    ],
    saidas: OK, saidaCampos: [],
    efeitoExterno: true, exigeEntidade: true,
  },
  inscrever_cadencia: {
    tipo: "inscrever_cadencia", categoria: "acao", rotulo: "Inscrever em cadência", descricao: "Coloca o registro numa cadência publicada.", icone: "ListPlus",
    campos: [{ chave: "cadenciaId", rotulo: "Cadência", tipo: "cadencia", obrigatorio: true }],
    saidas: OK, saidaCampos: [{ chave: "inscricaoId", rotulo: "Id da inscrição" }],
    efeitoExterno: true, exigeEntidade: true,
  },
  remover_cadencia: {
    tipo: "remover_cadencia", categoria: "acao", rotulo: "Remover de cadência", descricao: "Cancela a inscrição viva do registro.", icone: "ListMinus",
    campos: [{ chave: "cadenciaId", rotulo: "Cadência", tipo: "cadencia", obrigatorio: true }],
    saidas: OK, saidaCampos: [{ chave: "canceladas", rotulo: "Inscrições canceladas" }],
    efeitoExterno: true, exigeEntidade: true,
  },
  notificar_usuario: {
    tipo: "notificar_usuario", categoria: "acao", rotulo: "Notificar usuário", descricao: "Aviso no sino do CRM.", icone: "Bell",
    campos: [
      { chave: "usuarioId", rotulo: "Quem", tipo: "usuario", aceitaExpressao: true, ajuda: "Vazio = responsável do registro." },
      { chave: "titulo", rotulo: "Título", tipo: "texto", aceitaExpressao: true, padrao: "Automação" },
      { chave: "mensagem", rotulo: "Mensagem", tipo: "texto_longo", obrigatorio: true, aceitaExpressao: true },
    ],
    saidas: OK, saidaCampos: [{ chave: "notificacaoId", rotulo: "Id da notificação" }],
    efeitoExterno: true, exigeEntidade: false,
  },
  atualizar_campo: {
    tipo: "atualizar_campo", categoria: "acao", rotulo: "Atualizar campo", descricao: "Escreve um valor num campo do registro.", icone: "PenLine",
    campos: [
      { chave: "campo", rotulo: "Campo", tipo: "campo_entidade", obrigatorio: true },
      { chave: "nomeCampoCustom", rotulo: "Nome do campo personalizado", tipo: "texto", obrigatorio: true, mostrarSe: { campo: "campo", valores: ["campos_custom"] } },
      { chave: "valor", rotulo: "Valor", tipo: "texto", obrigatorio: true, aceitaExpressao: true },
    ],
    saidas: OK, saidaCampos: [{ chave: "anterior", rotulo: "Valor anterior" }],
    efeitoExterno: true, exigeEntidade: true,
  },
  adicionar_nota: {
    tipo: "adicionar_nota", categoria: "acao", rotulo: "Adicionar nota", descricao: "Nota na linha do tempo do registro.", icone: "StickyNote",
    campos: [
      { chave: "titulo", rotulo: "Título", tipo: "texto", obrigatorio: true, aceitaExpressao: true },
      { chave: "descricao", rotulo: "Texto", tipo: "texto_longo", aceitaExpressao: true },
    ],
    saidas: OK, saidaCampos: [{ chave: "atividadeId", rotulo: "Id da nota" }],
    efeitoExterno: true, exigeEntidade: true,
  },

  requisicao_http: {
    tipo: "requisicao_http", categoria: "integracao", rotulo: "Requisição HTTP", descricao: "Chama uma API externa e usa a resposta.", icone: "Globe",
    campos: [
      { chave: "metodo", rotulo: "Método", tipo: "selecao", padrao: "POST", opcoes: ["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => ({ valor: m, rotulo: m })) },
      { chave: "url", rotulo: "URL", tipo: "url", obrigatorio: true, aceitaExpressao: true, placeholder: "https://" },
      { chave: "cabecalhos", rotulo: "Cabeçalhos", tipo: "pares", aceitaExpressao: true },
      { chave: "corpo", rotulo: "Corpo (JSON)", tipo: "texto_longo", aceitaExpressao: true, mostrarSe: { campo: "metodo", valores: ["POST", "PUT", "PATCH", "DELETE"] } },
    ],
    saidas: OK, saidaCampos: [{ chave: "status", rotulo: "Status HTTP" }, { chave: "corpo", rotulo: "Corpo da resposta" }],
    efeitoExterno: true, exigeEntidade: false,
  },
  discagem_callface: {
    tipo: "discagem_callface", categoria: "integracao", rotulo: "Enviar para discagem", descricao: "Põe o contato na fila de ligação da Callface.", icone: "PhoneOutgoing",
    campos: [],
    saidas: OK, saidaCampos: [],
    efeitoExterno: true, exigeEntidade: true,
  },

  ia_gerar_texto: {
    tipo: "ia_gerar_texto", categoria: "ia", rotulo: "IA: gerar texto", descricao: "Escreve um texto com o agente de IA. Não envia nada.", icone: "Sparkles",
    campos: [
      { chave: "instrucao", rotulo: "Instrução", tipo: "texto_longo", obrigatorio: true, aceitaExpressao: true },
      { chave: "agenteId", rotulo: "Agente", tipo: "agente_ia", ajuda: "Vazio = agente padrão da organização." },
    ],
    saidas: OK, saidaCampos: [{ chave: "texto", rotulo: "Texto gerado" }],
    efeitoExterno: false, exigeEntidade: false,
  },
  ia_classificar: {
    tipo: "ia_classificar", categoria: "ia", rotulo: "IA: classificar", descricao: "Lê um texto e escolhe uma classe. Cada classe vira uma saída.", icone: "Bot",
    campos: [
      { chave: "texto", rotulo: "Texto", tipo: "texto_longo", obrigatorio: true, aceitaExpressao: true, padrao: "{{ contato.ultima_mensagem }}" },
      { chave: "classes", rotulo: "Classes", tipo: "classes", obrigatorio: true },
      { chave: "dica", rotulo: "Contexto para a IA", tipo: "texto", aceitaExpressao: true },
      { chave: "agenteId", rotulo: "Agente", tipo: "agente_ia" },
    ],
    saidas: [],
    saidaCampos: [{ chave: "classe", rotulo: "Classe escolhida" }],
    efeitoExterno: false, exigeEntidade: false,
  },
  ia_responder: {
    tipo: "ia_responder", categoria: "ia", rotulo: "IA: responder", descricao: "O agente conversa com o contato pelo WhatsApp.", icone: "Hand",
    campos: [
      { chave: "agenteId", rotulo: "Agente", tipo: "agente_ia" },
      { chave: "instrucao", rotulo: "Orientação para esta resposta", tipo: "texto_longo", aceitaExpressao: true },
      { chave: "sessaoId", rotulo: "Falar pelo número", tipo: "sessao_whatsapp", ajuda: "Vazio = o número configurado no agente." },
    ],
    saidas: OK, saidaCampos: [{ chave: "resposta", rotulo: "Texto enviado" }, { chave: "handoff", rotulo: "Passou para humano" }],
    efeitoExterno: true, exigeEntidade: true,
  },
  agente_atribuir: {
    tipo: "agente_atribuir", categoria: "ia", rotulo: "Agente: atribuir atendimento", descricao: "Passa a responsabilidade operacional do atendimento para um agente de IA. Não envia nada: quem conduz a conversa é o agente.", icone: "UserCheck",
    campos: [
      { chave: "agenteId", rotulo: "Agente", tipo: "agente_ia", obrigatorio: true },
      { chave: "objetivo", rotulo: "Objetivo do agente neste atendimento", tipo: "texto_longo", aceitaExpressao: true, ajuda: "Ex.: qualificar o lead e agendar demonstração. O agente decide como." },
      { chave: "autonomia", rotulo: "Autonomia nesta atribuição", tipo: "selecao", opcoes: [{ valor: "", rotulo: "A da versão publicada do agente" }, { valor: "suggest", rotulo: "Copiloto (só sugere)" }, { valor: "approval", rotulo: "Sob aprovação" }, { valor: "autonomous", rotulo: "Autônomo controlado" }] },
      { chave: "trocar", rotulo: "Trocar o agente atual, se houver", tipo: "booleano", padrao: false, ajuda: "Nunca substitui atendimento humano em andamento." },
    ],
    saidas: OK, saidaCampos: [{ chave: "status", rotulo: "Resultado (atribuido, ja_atribuido, recusado)" }, { chave: "motivo", rotulo: "Motivo da recusa" }, { chave: "atribuicaoId", rotulo: "Id da atribuição" }],
    efeitoExterno: true, exigeEntidade: true,
  },
  agente_acionar: {
    tipo: "agente_acionar", categoria: "ia", rotulo: "Agente: acionar com objetivo", descricao: "Pede ao agente uma execução agora, com objetivo e contexto. Ele recupera o histórico completo e decide como proceder.", icone: "Sparkles",
    campos: [
      { chave: "agenteId", rotulo: "Agente", tipo: "agente_ia", ajuda: "Vazio = o agente já atribuído a este atendimento." },
      { chave: "objetivo", rotulo: "Objetivo", tipo: "texto_longo", obrigatorio: true, aceitaExpressao: true, ajuda: "Ex.: retomar a negociação. O motivo da retomada vem do gatilho." },
      { chave: "instrucao", rotulo: "Orientação adicional", tipo: "texto_longo", aceitaExpressao: true },
      { chave: "modo", rotulo: "Modo", tipo: "selecao", padrao: "conduzir", opcoes: [{ valor: "conduzir", rotulo: "Conduzir (pode falar com o contato)" }, { valor: "analisar", rotulo: "Só analisar (registra nota, não envia nada)" }] },
    ],
    saidas: OK, saidaCampos: [{ chave: "status", rotulo: "Resultado (respondeu, handover, bloqueado, pausado, ignorado...)" }, { chave: "motivo", rotulo: "Motivo, quando bloqueado" }, { chave: "runId", rotulo: "Execução" }, { chave: "handoff", rotulo: "Passou para humano" }],
    efeitoExterno: true, exigeEntidade: true,
  },
  agente_pausar: {
    tipo: "agente_pausar", categoria: "ia", rotulo: "Agente: pausar", descricao: "Pausa o agente neste atendimento (as retomadas dele ficam guardadas).", icone: "Pause",
    campos: [{ chave: "motivo", rotulo: "Motivo", tipo: "texto", aceitaExpressao: true }],
    saidas: OK, saidaCampos: [{ chave: "status", rotulo: "Resultado" }], efeitoExterno: true, exigeEntidade: true,
  },
  agente_transferir: {
    tipo: "agente_transferir", categoria: "ia", rotulo: "Agente: transferir para pessoa", descricao: "Transfere o atendimento para uma pessoa. A IA para de responder e o histórico é preservado.", icone: "ArrowRightLeft",
    campos: [
      { chave: "usuarioId", rotulo: "Pessoa", tipo: "usuario", ajuda: "Vazio = quem o agente ou a regra definir." },
      { chave: "motivo", rotulo: "Motivo", tipo: "texto", aceitaExpressao: true },
      { chave: "resumo", rotulo: "Resumo para quem assume", tipo: "texto_longo", aceitaExpressao: true },
      { chave: "copiloto", rotulo: "Agente continua como copiloto interno", tipo: "booleano", padrao: false },
    ],
    saidas: OK, saidaCampos: [{ chave: "status", rotulo: "Resultado" }], efeitoExterno: true, exigeEntidade: true,
  },
  agente_encerrar: {
    tipo: "agente_encerrar", categoria: "ia", rotulo: "Agente: encerrar atuação", descricao: "Encerra a atribuição e cancela as retomadas pendentes do agente neste atendimento.", icone: "CircleStop",
    campos: [{ chave: "motivo", rotulo: "Motivo", tipo: "texto", aceitaExpressao: true }],
    saidas: OK, saidaCampos: [{ chave: "status", rotulo: "Resultado" }], efeitoExterno: true, exigeEntidade: true,
  },
};

export const CATEGORIAS: { id: CategoriaNo; rotulo: string }[] = [
  { id: "logica", rotulo: "Lógica" }, { id: "acao", rotulo: "Plataforma" }, { id: "ia", rotulo: "IA" }, { id: "integracao", rotulo: "Integrações" },
];

const SAIDA_ERRO: SaidaNo = { id: "erro", rotulo: "Erro", erro: true };

type Regra = { campo: string; operador: OperadorRegra; valor?: unknown };
type Rota = { id: string; rotulo: string; combinador?: "e" | "ou"; regras: Regra[] };

/** Saídas de UM nó, já com as dinâmicas e a de erro (quando a política pede). */
export function saidasDoNo(no: NoFluxo): SaidaNo[] {
  let saidas = CATALOGO_NOS[no.tipo].saidas;
  if (no.tipo === "roteador") {
    const rotas = (no.config.rotas as Rota[] | undefined) ?? [];
    saidas = [...rotas.map((r) => ({ id: r.id, rotulo: r.rotulo || r.id })), { id: "senao", rotulo: "Caso contrário" }];
  }
  if (no.tipo === "ia_classificar") {
    const classes = (no.config.classes as { id: string; rotulo: string }[] | undefined) ?? [];
    saidas = [...classes.map((c) => ({ id: c.id, rotulo: c.rotulo || c.id })), { id: "outra", rotulo: "Nenhuma das classes" }];
  }
  const meta = CATALOGO_NOS[no.tipo];
  if ((no.falha?.politica ?? FALHA_PADRAO.politica) === "saida_erro" && (meta.efeitoExterno || meta.categoria === "ia")) {
    saidas = [...saidas, SAIDA_ERRO];
  }
  return saidas;
}

export function grafoInicial(): GrafoFluxo {
  return { versao: 1, nos: [{ id: "n1", tipo: "gatilho", posicao: { x: 0, y: 0 }, config: { modo: "evento" } }], arestas: [] };
}

/** Nó novo com os padrões do catálogo, pronto para entrar no grafo. */
export function novoNo(tipo: TipoNo, id: string, posicao: { x: number; y: number }): NoFluxo {
  const config: Record<string, unknown> = {};
  for (const c of CATALOGO_NOS[tipo].campos) if (c.padrao !== undefined) config[c.chave] = c.padrao;
  return { id, tipo, posicao, config };
}

/** Próximo id livre "nN". */
export function proximoIdNo(grafo: GrafoFluxo): string {
  const max = grafo.nos.reduce((m, n) => Math.max(m, Number(/^n(\d+)$/.exec(n.id)?.[1] ?? 0)), 0);
  return `n${max + 1}`;
}

// ─── Expressões {{ }} ──────────────────────────────────────────────────────

/**
 * `{{ caminho.com.pontos }}` e `{{ caminho || "padrão" }}`. Sem JavaScript:
 * a expressão é caminho de leitura, nunca código, porque quem escreve a
 * automação não pode executar nada no servidor por ela.
 */
const EXPRESSAO = /\{\{\s*([^}]+?)\s*\}\}/g;

export function lerCaminho(contexto: Record<string, unknown>, caminho: string): unknown {
  return caminho.split(".").reduce<unknown>((valor, chave) => {
    if (valor === null || valor === undefined) return undefined;
    // Só propriedade própria: `constructor`/`__proto__` nunca são lidos.
    if (typeof valor !== "object" || !Object.hasOwn(valor, chave)) return undefined;
    return (valor as Record<string, unknown>)[chave];
  }, contexto);
}

function avaliarTermo(termo: string, contexto: Record<string, unknown>): unknown {
  const [caminho, ...padroes] = termo.split("||").map((t) => t.trim());
  const valor = lerCaminho(contexto, caminho);
  if (valor !== undefined && valor !== null && valor !== "") return valor;
  const padrao = padroes.join("||").trim();
  if (!padrao) return valor;
  const literal = /^(["'])(.*)\1$/.exec(padrao);
  return literal ? literal[2] : lerCaminho(contexto, padrao);
}

function paraTexto(valor: unknown): string {
  if (valor === undefined || valor === null) return "";
  if (Array.isArray(valor)) return valor.map(paraTexto).join(", ");
  if (typeof valor === "object") return JSON.stringify(valor);
  return String(valor);
}

/** Texto com {{ }} vira texto. Um campo que é SÓ uma expressão devolve o valor cru (número, lista...). */
export function resolverExpressao(texto: unknown, contexto: Record<string, unknown>): unknown {
  if (typeof texto !== "string") return texto;
  const unica = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/.exec(texto);
  if (unica) return avaliarTermo(unica[1], contexto);
  return texto.replace(EXPRESSAO, (_, termo: string) => paraTexto(avaliarTermo(termo, contexto)));
}

/** Resolve todos os campos de texto da config (rasos e em listas de pares). */
export function resolverConfig(config: Record<string, unknown>, contexto: Record<string, unknown>): Record<string, unknown> {
  const resolver = (v: unknown): unknown =>
    typeof v === "string" ? resolverExpressao(v, contexto)
      : Array.isArray(v) ? v.map(resolver)
        : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolver(x)]))
          : v;
  return resolver(config) as Record<string, unknown>;
}

/** Caminhos citados num texto — o editor usa para avisar variável de nó que não vem antes. */
export function caminhosUsados(texto: unknown): string[] {
  if (typeof texto !== "string") return [];
  return [...texto.matchAll(EXPRESSAO)].map((m) => m[1].split("||")[0].trim());
}

// ─── Regras ────────────────────────────────────────────────────────────────

export const OPERADORES_REGRA = [
  { valor: "igual", rotulo: "é igual a" }, { valor: "diferente", rotulo: "é diferente de" },
  { valor: "contem", rotulo: "contém" }, { valor: "nao_contem", rotulo: "não contém" },
  { valor: "maior", rotulo: "é maior que" }, { valor: "menor", rotulo: "é menor que" },
  { valor: "maior_igual", rotulo: "é maior ou igual a" }, { valor: "menor_igual", rotulo: "é menor ou igual a" },
  { valor: "vazio", rotulo: "está vazio" }, { valor: "preenchido", rotulo: "está preenchido" },
  { valor: "em_lista", rotulo: "é um destes (separados por vírgula)" },
] as const;
export type OperadorRegra = (typeof OPERADORES_REGRA)[number]["valor"];

/** `campo` é um caminho de contexto ("lead.origem") ou uma expressão; `valor` aceita {{ }}. */
export function avaliarRegra(regra: Regra, contexto: Record<string, unknown>): boolean {
  const bruto = regra.campo.includes("{{") ? resolverExpressao(regra.campo, contexto) : lerCaminho(contexto, regra.campo);
  const alvo = resolverExpressao(regra.valor ?? "", contexto);
  const lista = Array.isArray(bruto) ? bruto.map(paraTexto) : null;
  const texto = paraTexto(bruto).toLowerCase();
  const textoAlvo = paraTexto(alvo).toLowerCase();
  switch (regra.operador) {
    case "igual": return lista ? lista.some((x) => x.toLowerCase() === textoAlvo) : texto === textoAlvo;
    case "diferente": return lista ? !lista.some((x) => x.toLowerCase() === textoAlvo) : texto !== textoAlvo;
    case "contem": return texto.includes(textoAlvo);
    case "nao_contem": return !texto.includes(textoAlvo);
    case "maior": return Number(bruto) > Number(alvo);
    case "menor": return Number(bruto) < Number(alvo);
    case "maior_igual": return Number(bruto) >= Number(alvo);
    case "menor_igual": return Number(bruto) <= Number(alvo);
    case "vazio": return lista ? lista.length === 0 : texto === "";
    case "preenchido": return lista ? lista.length > 0 : texto !== "";
    case "em_lista": {
      const opcoes = textoAlvo.split(",").map((x) => x.trim()).filter(Boolean);
      return lista ? lista.some((x) => opcoes.includes(x.toLowerCase())) : opcoes.includes(texto);
    }
    default: return false;
  }
}

export function avaliarRegras(regras: Regra[], combinador: "e" | "ou", contexto: Record<string, unknown>): boolean {
  if (regras.length === 0) return true;
  return combinador === "ou" ? regras.some((r) => avaliarRegra(r, contexto)) : regras.every((r) => avaliarRegra(r, contexto));
}

// ─── Validação de publicação ───────────────────────────────────────────────

export interface Pendencia { noId?: string; campo?: string; mensagem: string }

function campoVisivel(campo: CampoConfig, config: Record<string, unknown>, todos: CampoConfig[]): boolean {
  if (!campo.mostrarSe) return true;
  const pai = todos.find((c) => c.chave === campo.mostrarSe!.campo);
  if (pai && !campoVisivel(pai, config, todos)) return false;
  const valor = config[campo.mostrarSe.campo] ?? pai?.padrao;
  return campo.mostrarSe.valores.includes(valor);
}

function vazio(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);
}

/** O gatilho fornece um registro? Decide se nós com `exigeEntidade` podem rodar. */
export function gatilhoTemEntidade(gatilho: NoFluxo | undefined): boolean {
  if (!gatilho) return false;
  const c = gatilho.config;
  if (c.modo === "evento") return Boolean(c.evento);
  if (c.modo === "manual") return Boolean(c.entidade) && c.entidade !== "nenhuma";
  if (c.modo === "agendado") return Boolean(c.alvo) && c.alvo !== "nenhuma";
  if (c.modo === "webhook") return Boolean(c.webhookEntidade) && c.webhookEntidade !== "nenhuma";
  return false;
}

/**
 * Tudo que impede publicar. Lista vazia = pode publicar. O rascunho salva
 * com pendência; o editor marca o nó e o botão Publicar mostra esta lista.
 */
export function validarGrafo(grafo: GrafoFluxo): Pendencia[] {
  const p: Pendencia[] = [];
  const porId = new Map(grafo.nos.map((n) => [n.id, n]));
  const gatilhos = grafo.nos.filter((n) => n.tipo === "gatilho");
  if (gatilhos.length !== 1) p.push({ mensagem: "A automação precisa de exatamente um gatilho." });
  const gatilho = gatilhos[0];
  const temEntidade = gatilhoTemEntidade(gatilho);

  if (porId.size !== grafo.nos.length) p.push({ mensagem: "Há nós com o mesmo id." });

  for (const a of grafo.arestas) {
    const origem = porId.get(a.origem);
    if (!origem || !porId.has(a.destino)) { p.push({ mensagem: `Ligação ${a.id} aponta para um nó que não existe.` }); continue; }
    if (porId.get(a.destino)?.tipo === "gatilho") p.push({ noId: a.origem, mensagem: "Nada pode ligar de volta ao gatilho." });
    if (!saidasDoNo(origem).some((s) => s.id === a.saida)) p.push({ noId: a.origem, mensagem: `Saída "${a.saida}" não existe mais neste nó.` });
  }
  // Uma saída leva a UM nó: o executor anda com um cursor só (ver o contrato).
  const usadas = new Set<string>();
  for (const a of grafo.arestas) {
    const chave = `${a.origem}:${a.saida}`;
    if (usadas.has(chave)) p.push({ noId: a.origem, mensagem: "Cada saída liga a um único próximo bloco." });
    usadas.add(chave);
  }

  // Sem ciclo (DFS) e todo nó alcançável a partir do gatilho.
  const filhos = new Map<string, string[]>();
  for (const a of grafo.arestas) filhos.set(a.origem, [...(filhos.get(a.origem) ?? []), a.destino]);
  const estado = new Map<string, 1 | 2>();
  let ciclo = false;
  const visitar = (id: string) => {
    if (estado.get(id) === 1) { ciclo = true; return; }
    if (estado.get(id) === 2) return;
    estado.set(id, 1);
    for (const f of filhos.get(id) ?? []) visitar(f);
    estado.set(id, 2);
  };
  if (gatilho) visitar(gatilho.id);
  if (ciclo) p.push({ mensagem: "O fluxo volta para um bloco anterior. Laços não são permitidos." });
  if (gatilho && !(filhos.get(gatilho.id)?.length)) p.push({ noId: gatilho.id, mensagem: "Ligue o gatilho ao primeiro bloco." });

  for (const no of grafo.nos) {
    const meta = CATALOGO_NOS[no.tipo];
    if (gatilho && no.id !== gatilho.id && !estado.has(no.id)) p.push({ noId: no.id, mensagem: "Bloco solto: nada chega até ele." });
    for (const campo of meta.campos) {
      if (!campo.obrigatorio || campo.tipo === "somente_leitura" || !campoVisivel(campo, no.config, meta.campos)) continue;
      if (vazio(no.config[campo.chave])) p.push({ noId: no.id, campo: campo.chave, mensagem: `Preencha "${campo.rotulo}".` });
    }
    if (meta.exigeEntidade && !no.desativado && !temEntidade) {
      p.push({ noId: no.id, mensagem: `"${meta.rotulo}" precisa de um registro, e o gatilho não fornece nenhum.` });
    }
    if (no.tipo === "roteador" || no.tipo === "condicao") {
      const listas = no.tipo === "roteador" ? ((no.config.rotas as Rota[] | undefined) ?? []).map((r) => r.regras) : [(no.config.regras as Regra[] | undefined) ?? []];
      if (listas.some((rs) => rs.some((r) => !r.campo || !r.operador))) p.push({ noId: no.id, campo: no.tipo === "roteador" ? "rotas" : "regras", mensagem: "Há regra sem campo ou operador." });
    }
    if (no.tipo === "esperar") {
      const minutos = minutosDeEspera(no.config);
      if (!(minutos >= 1 && minutos <= 90 * 1440)) p.push({ noId: no.id, campo: "quantidade", mensagem: "A espera vai de 1 minuto a 90 dias." });
    }
  }
  return p;
}

/** Minutos de um nó Esperar — mesma conta para validação, executor e prévia. */
export function minutosDeEspera(config: Record<string, unknown>): number {
  const unidade = String(config.unidade ?? "dias");
  return Number(config.quantidade ?? 0) * (unidade === "dias" ? 1440 : unidade === "horas" ? 60 : 1);
}

// ─── DTOs da API (rotas Hono em api-server/routes/automacoes-fluxos.ts) ────
// Datas sempre ISO string. O editor e a API tipam contra estes tipos; mudar
// um campo aqui é mudança de contrato (ver o changelog do documento).

/** rascunho = nunca publicada; publicada = tem versão, desligada; ativa = tem versão e está ligada. */
export type EstadoFluxo = "rascunho" | "publicada" | "ativa";
export type StatusExecucaoFluxo = "executando" | "aguardando" | "sucesso" | "erro" | "cancelado";
export type ModoExecucao = "evento" | "manual" | "agendado" | "webhook";

export interface FluxoResumo {
  id: string;
  nome: string;
  pasta: string | null;
  ativo: boolean;
  estado: EstadoFluxo;
  /** Rascunho difere da versão publicada. */
  alteracoesNaoPublicadas: boolean;
  /** Frase pronta: "Quando: Novo lead", "Todo dia às 09:00", "Webhook", "Manual". */
  gatilhoResumo: string;
  versaoPublicada: number | null;
  publicadaEm: string | null;
  ultimaExecucao: { em: string; status: StatusExecucaoFluxo } | null;
  execucoes7d: number;
  erros7d: number;
  atualizadoEm: string;
}

/** Linha da tabela `automacoes` ainda no formato gatilho→ação (motor antigo). */
export interface RegraAntiga {
  id: string;
  nome: string;
  gatilho: string;
  acao: string;
  ativo: boolean;
  migravel: boolean;
  motivoNaoMigravel: string | null;
}

export interface FluxoDetalhe {
  id: string;
  nome: string;
  pasta: string | null;
  ativo: boolean;
  estado: EstadoFluxo;
  rascunho: { grafo: GrafoFluxo; config: ConfigFluxo; salvoEm: string };
  publicada: { versaoId: string; versao: number; publicadaEm: string } | null;
  alteracoesNaoPublicadas: boolean;
  /** Só existe com gatilho webhook salvo. */
  webhookUrl: string | null;
  pendencias: Pendencia[];
  podeGerir: boolean;
}

export interface VersaoResumo {
  id: string;
  versao: number;
  publicadaEm: string;
  publicadaPor: string | null;
  /** É a versão que roda hoje (automacoes.current_version_id). */
  atual: boolean;
}

export interface ExecucaoResumo {
  id: string;
  automacaoId: string;
  automacaoNome: string;
  versao: number | null;
  modo: ModoExecucao;
  status: StatusExecucaoFluxo;
  entidade: { tipo: TipoEntidade; id: string; nome: string | null } | null;
  iniciadaEm: string;
  terminadaEm: string | null;
  retomarEm: string | null;
  noAtual: string | null;
  erro: string | null;
}

export interface PassoExecucao {
  noId: string;
  tipo: TipoNo;
  ordem: number;
  status: "PENDING" | "RUNNING" | "DONE" | "FAILED" | "SKIPPED" | "WAITING";
  /** Saída tomada ("ok", "sim", "erro"...). Null enquanto não terminou. */
  saida: string | null;
  /** Config já com as expressões resolvidas. */
  entrada: Record<string, unknown>;
  resultado: Record<string, unknown>;
  erro: string | null;
  iniciadoEm: string | null;
  terminadoEm: string | null;
}

export interface DetalheExecucao {
  execucao: ExecucaoResumo;
  passos: PassoExecucao[];
  /** Grafo da versão que rodou (não o rascunho), para pintar o caminho certo. */
  grafo: GrafoFluxo;
}

export interface PassoEnsaio {
  noId: string;
  tipo: TipoNo;
  /** ok = lógica avaliada de verdade; simulado = ação que NÃO foi executada; esperaria = espera pulada. */
  status: "ok" | "simulado" | "esperaria" | "erro" | "pendencia";
  saida: string | null;
  /** Frase em pt-BR: "Enviaria WhatsApp para +55 11 9... : Oi Ana". */
  previa: string;
  entrada: Record<string, unknown>;
  resultado: Record<string, unknown>;
}

export interface ResultadoEnsaio {
  passos: PassoEnsaio[];
  /** ids das arestas percorridas, na ordem. */
  arestas: string[];
  final: "sucesso" | "erro" | "parado" | "pendencia";
  /** Raízes do contexto hidratado (registro, lead, negocio, gatilho...), para o seletor de variáveis mostrar valor real. */
  contexto: Record<string, unknown>;
}

/** Corpo de POST /ensaiar e /rodar. */
export interface PedidoExecucao {
  entidade?: { tipo: TipoEntidade; id: string };
  /** Simula o corpo do evento/webhook em {{ gatilho.* }}. */
  payload?: Record<string, unknown>;
  /** Só no ensaio: força a saída de nós que dependem de IA ou de tempo (noId → saidaId). */
  escolhas?: Record<string, string>;
}

/** GET /automacoes/fluxos/opcoes — tudo que os selects do inspetor precisam, numa chamada. */
export interface OpcoesInspetor {
  usuarios: { id: string; nome: string }[];
  tags: { id: string; nome: string; cor: string | null }[];
  etapas: { lead: { valor: string; rotulo: string }[]; negocio: { valor: string; rotulo: string }[] };
  cadencias: { id: string; nome: string; publicada: boolean }[];
  templatesWhatsapp: { id: string; nome: string }[];
  sessoesWhatsapp: { id: string; nome: string; conectada: boolean; operacional?: boolean }[];
  agentesIa: { id: string; nome: string }[];
}
