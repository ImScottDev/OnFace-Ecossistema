/**
 * Vocabulário canônico do Módulo 01 — Vendas.
 *
 * Fonte: docs/produto/specdrive-modulo-01-vendas.md. Nada aqui é escolha de
 * implementação: são os nomes que a spec fechou. Quando o legado usa outro
 * nome, a tradução mora neste arquivo e em nenhum outro lugar — é o que
 * permite o resto do módulo falar só o domínio novo sem reescrever as tabelas
 * que financeiro, contratos e relatórios ainda leem.
 */

/* ── Pré-vendas (Bloco 01 §2) ──────────────────────────────────────────── */

/**
 * As views rápidas do workspace (§5 da spec).
 *
 * NÃO são páginas nem abas: são recortes salvos do mesmo board. Ficam aqui, e
 * não na tela, porque cada uma vira condição de SQL — resolver "atrasados" no
 * cliente faria a coluna anunciar 2.919 e mostrar 12.
 */
export const VIEWS_PRE_VENDAS = [
  { chave: "todos", rotulo: "Todos" },
  { chave: "meus", rotulo: "Meus" },
  { chave: "hoje", rotulo: "Hoje" },
  { chave: "atrasados", rotulo: "Atrasados" },
  { chave: "sem-dono", rotulo: "Sem dono" },
  { chave: "sem-proxima-acao", rotulo: "Sem próxima ação" },
] as const;

export type ViewPreVendas = (typeof VIEWS_PRE_VENDAS)[number]["chave"];

export function ehView(valor: string | null | undefined): valor is ViewPreVendas {
  return VIEWS_PRE_VENDAS.some((v) => v.chave === valor);
}



export const ETAPAS_PRE_VENDAS = ["novo", "em_contato", "qualificacao", "qualificado", "oportunidade"] as const;
export type EtapaPreVendas = (typeof ETAPAS_PRE_VENDAS)[number];

/** Saídas auxiliares. São estados reais, mas não ocupam coluna no board
 *  principal — a spec pede tabs `Ativos | Nutrição | Desqualificados`. */
export const SAIDAS_PRE_VENDAS = ["nutricao", "desqualificado"] as const;
export type SaidaPreVendas = (typeof SAIDAS_PRE_VENDAS)[number];

export type EstagioPreVendas = EtapaPreVendas | SaidaPreVendas;

export const ROTULO_ETAPA_PRE_VENDAS: Record<EstagioPreVendas, string> = {
  novo: "Novo",
  em_contato: "Em contato",
  qualificacao: "Qualificação",
  qualificado: "Qualificado",
  oportunidade: "Oportunidade",
  nutricao: "Nutrição",
  desqualificado: "Desqualificado",
};

/** Bloco 01 §13: nutrição não pode ser lixeira elegante. */
export const MOTIVOS_NUTRICAO = [
  { chave: "sem_resposta", rotulo: "Sem resposta", exigeRetomada: true },
  { chave: "sem_interesse_agora", rotulo: "Sem interesse no momento", exigeRetomada: true },
  { chave: "timing", rotulo: "Timing inadequado", exigeRetomada: true },
  { chave: "sem_orcamento", rotulo: "Sem orçamento agora", exigeRetomada: true },
  { chave: "contrato_vigente", rotulo: "Contrato vigente", exigeRetomada: true },
  { chave: "decisao_interna", rotulo: "Aguardando decisão interna", exigeRetomada: false },
  { chave: "retomar_em_data", rotulo: "Retomar em outra data", exigeRetomada: true },
  { chave: "outro", rotulo: "Outro", exigeRetomada: false },
] as const;
export type MotivoNutricao = (typeof MOTIVOS_NUTRICAO)[number]["chave"];

/** Bloco 01 §14: desqualificar exige motivo estruturado. */
export const MOTIVOS_DESQUALIFICACAO = [
  { chave: "fora_icp", rotulo: "Fora do ICP" },
  { chave: "contato_invalido", rotulo: "Contato inválido" },
  { chave: "sem_fit", rotulo: "Empresa sem fit" },
  { chave: "sem_necessidade", rotulo: "Sem necessidade" },
  { chave: "duplicado", rotulo: "Duplicado" },
  { chave: "outro", rotulo: "Outro" },
] as const;
export type MotivoDesqualificacao = (typeof MOTIVOS_DESQUALIFICACAO)[number]["chave"];

/** Bloco 01 §8: a qualificação é estruturada. Nenhum campo é obrigatório no
 *  MVP de propósito — a spec diz que a organização poderá endurecer os
 *  critérios depois, e travar agora só faria a equipe preencher lixo. */
export interface Qualificacao {
  icp?: string;
  dor?: string;
  necessidade?: string;
  servicosInteresse?: string[];
  cenarioAtual?: string;
  solucaoAtual?: string;
  urgencia?: string;
  budget?: string;
  decisor?: string;
  influenciadores?: string;
  timing?: string;
  quantidade?: number | null;
  observacoes?: string;
}

/* ── Pipeline (Bloco 02 §9) ────────────────────────────────────────────── */

export const ETAPAS_PIPELINE = ["entrada", "diagnostico", "proposta", "negociacao"] as const;
export type EtapaPipelineAberta = (typeof ETAPAS_PIPELINE)[number];

export const ETAPAS_FECHADAS = ["ganho", "perdido"] as const;
export type EtapaFechada = (typeof ETAPAS_FECHADAS)[number];

export type EtapaPipeline = EtapaPipelineAberta | EtapaFechada;

export const ROTULO_ETAPA_PIPELINE: Record<EtapaPipeline, string> = {
  entrada: "Entrada",
  diagnostico: "Diagnóstico",
  proposta: "Proposta",
  negociacao: "Negociação",
  ganho: "Ganho",
  perdido: "Perdido",
};

/**
 * Tradução entre a etapa canônica e o `negocios.status` legado.
 *
 * O status continua existindo porque financeiro, contratos, relatórios e a
 * reconciliação leem essa coluna. A etapa é o que o módulo novo usa. Um lado
 * nunca é derivado do outro na hora da leitura: os dois são escritos juntos
 * pelo motor, senão qualquer bug de tradução vira divergência silenciosa.
 */
export const STATUS_LEGADO_DA_ETAPA: Record<EtapaPipeline, string> = {
  entrada: "reuniao_agendada",
  diagnostico: "reuniao_realizada",
  proposta: "proposta_apresentada",
  negociacao: "negociacao_iniciada",
  ganho: "ganho",
  perdido: "perdido",
};

export function etapaDoStatusLegado(status: string | null | undefined): EtapaPipeline | null {
  switch (status) {
    case "reuniao_agendada": return "entrada";
    case "reuniao_realizada": return "diagnostico";
    // Trial é estado contextual, não etapa (Bloco 02 §10): comercialmente,
    // quem está em trial está em diagnóstico.
    case "trial": return "diagnostico";
    case "proposta_apresentada": return "proposta";
    case "negociacao_iniciada": return "negociacao";
    case "ganho": return "ganho";
    case "perdido": case "churned": return "perdido";
    // No-show não é etapa: a oportunidade é preservada onde estava.
    case "no_show": return "entrada";
    default: return null;
  }
}

/** Bloco 02 §17: motivo de estagnação deixa de ser status diferente. */
export const MOTIVOS_ESTAGNACAO = [
  { chave: "sem_retorno", rotulo: "Sem retorno" },
  { chave: "trava_negociacao", rotulo: "Trava na negociação" },
  { chave: "trava_assinatura", rotulo: "Trava na assinatura" },
  { chave: "outra_data", rotulo: "Negociar em outra data" },
] as const;
export type MotivoEstagnacao = (typeof MOTIVOS_ESTAGNACAO)[number]["chave"];

/** Bloco 02 §17. */
export const MOTIVOS_PERDA = [
  { chave: "sem_retorno", rotulo: "Sem retorno" },
  { chave: "sem_interesse", rotulo: "Sem interesse" },
  { chave: "preco", rotulo: "Preço" },
  { chave: "concorrente", rotulo: "Escolheu concorrente" },
  { chave: "sem_orcamento", rotulo: "Sem orçamento" },
  { chave: "timing", rotulo: "Timing / outra data" },
  { chave: "trava_negociacao", rotulo: "Trava na negociação" },
  { chave: "trava_contratual", rotulo: "Trava contratual" },
  { chave: "projeto_cancelado", rotulo: "Projeto cancelado" },
  { chave: "sem_fit", rotulo: "Sem fit após diagnóstico" },
  { chave: "outro", rotulo: "Outro" },
] as const;
export type MotivoPerda = (typeof MOTIVOS_PERDA)[number]["chave"];

/* ── Famílias e receita ────────────────────────────────────────────────── */

export const FAMILIAS = ["CALLFACE_AI", "PABX", "WHITE_LABEL"] as const;
export type Familia = (typeof FAMILIAS)[number];

/** `UNKNOWN` existe só para o legado. Bloco 02 §2: oportunidade nova nunca
 *  nasce assim, e é por isso que ele está fora de `FAMILIAS`. */
export type FamiliaComLegado = Familia | "UNKNOWN";

export const ROTULO_FAMILIA: Record<FamiliaComLegado, string> = {
  CALLFACE_AI: "Callface AI",
  PABX: "PABX",
  WHITE_LABEL: "White Label",
  UNKNOWN: "Não classificada",
};

export function ehFamiliaValida(valor: unknown): valor is Familia {
  return typeof valor === "string" && (FAMILIAS as readonly string[]).includes(valor);
}

/** Bloco 02 §14 / Bloco 03 §4: nem toda venda é recorrente. */
export const NATUREZAS_RECEITA = ["MRR", "SETUP", "PROJECT", "ONE_TIME", "USAGE", "HARDWARE"] as const;
export type NaturezaReceita = (typeof NATUREZAS_RECEITA)[number];

export const ROTULO_NATUREZA: Record<NaturezaReceita, string> = {
  MRR: "Recorrente",
  SETUP: "Setup",
  PROJECT: "Projeto",
  ONE_TIME: "Avulso",
  USAGE: "Uso",
  HARDWARE: "Hardware",
};

export const NATUREZAS_RECORRENTES: NaturezaReceita[] = ["MRR"];

/* ── Origem comercial ──────────────────────────────────────────────────── */

/** Bloco 04 §13: por onde a oportunidade entrou de verdade. Serve para medir
 *  a eficiência de cada caminho, então não pode ser preenchido por palpite. */
export const PROCESSOS_ORIGEM = ["PRE_SALES", "OUTBOUND_DIRECT", "MANUAL", "EXPANSION"] as const;
export type ProcessoOrigem = (typeof PROCESSOS_ORIGEM)[number];

export const ROTULO_PROCESSO_ORIGEM: Record<ProcessoOrigem, string> = {
  PRE_SALES: "Pré-vendas",
  OUTBOUND_DIRECT: "Prospecção direta",
  MANUAL: "Criação manual",
  EXPANSION: "Carteira / expansão",
};

export const MOTIONS = ["NEW_BUSINESS", "EXPANSION", "RENEWAL", "REACTIVATION"] as const;
export type Motion = (typeof MOTIONS)[number];

/* ── Proposta (Bloco 03) ───────────────────────────────────────────────── */

export const STATUS_PROPOSTA = [
  "rascunho", "enviada", "visualizada", "ajuste_solicitado",
  "aceita", "recusada", "expirada", "substituida",
] as const;
export type StatusProposta = (typeof STATUS_PROPOSTA)[number];

export const ROTULO_STATUS_PROPOSTA: Record<StatusProposta, string> = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  visualizada: "Visualizada",
  ajuste_solicitado: "Ajuste solicitado",
  aceita: "Aceita",
  recusada: "Recusada",
  expirada: "Expirada",
  substituida: "Substituída",
};

/** Proposta que ainda está viva comercialmente — a que pode ser aceita. */
export const STATUS_PROPOSTA_VIGENTE: StatusProposta[] = ["enviada", "visualizada", "ajuste_solicitado"];

/** Bloco 03 §7: escolhido antes do envio, porque muda regra, dado
 *  obrigatório e gate de Won. */
export const MODOS_FECHAMENTO = ["PREPAID", "CONTRACT"] as const;
export type ModoFechamento = (typeof MODOS_FECHAMENTO)[number];

export const ROTULO_MODO_FECHAMENTO: Record<ModoFechamento, string> = {
  PREPAID: "Pré-pago / Checkout",
  CONTRACT: "Contrato",
};

export const VALIDADES_PROPOSTA = [7, 14, 22, 30] as const;

/** Bloco 03 §21. */
export const TIPOS_CONTRATUAIS = ["NOVO_CONTRATO", "ADITIVO", "UPGRADE", "DOWNGRADE", "RENOVACAO"] as const;
export type TipoContratual = (typeof TIPOS_CONTRATUAIS)[number];

/** Tipos que exigem referência a um contrato existente. */
export const TIPOS_CONTRATUAIS_COM_BASE: TipoContratual[] = ["ADITIVO", "UPGRADE", "DOWNGRADE", "RENOVACAO"];

/**
 * Qual documento o contrato gerado usa. Upgrade e downgrade alteram um
 * contrato vigente, e alteração se formaliza por termo aditivo — é o que a
 * própria cláusula 9.3 dos contratos exige.
 */
export function tipoDocumentoDoContratual(tipo: string | null | undefined): "CONTRATO" | "ADITIVO" | "RENOVACAO" {
  if (tipo === "ADITIVO" || tipo === "UPGRADE" || tipo === "DOWNGRADE") return "ADITIVO";
  if (tipo === "RENOVACAO") return "RENOVACAO";
  return "CONTRATO";
}

/* ── Prospecção (Bloco 04 §3) ──────────────────────────────────────────── */

export const ESTADOS_PROSPECCAO = [
  "novo", "em_cadencia", "respondeu",
  "pre_qualificado", "oportunidade", "sem_resposta", "descartado",
] as const;
export type EstadoProspeccao = (typeof ESTADOS_PROSPECCAO)[number];

export const ROTULO_ESTADO_PROSPECCAO: Record<EstadoProspeccao, string> = {
  novo: "Novo",
  em_cadencia: "Em cadência",
  respondeu: "Respondeu",
  pre_qualificado: "Pré-qualificado",
  oportunidade: "Oportunidade",
  sem_resposta: "Sem resposta",
  descartado: "Descartado",
};

/** Bloco 04 §15: em Prospecção é "Descartado", não "Desqualificado" — nem
 *  todo prospect descartado passou por qualificação comercial formal. */
export const MOTIVOS_DESCARTE = [
  { chave: "contato_invalido", rotulo: "Contato inválido" },
  { chave: "fora_icp_aparente", rotulo: "Empresa fora do ICP aparente" },
  { chave: "duplicado", rotulo: "Duplicado" },
  { chave: "empresa_encerrada", rotulo: "Empresa encerrada" },
  { chave: "dados_insuficientes", rotulo: "Dados insuficientes" },
  { chave: "nao_prospectar", rotulo: "Não prospectar" },
  { chave: "outro", rotulo: "Outro" },
] as const;
export type MotivoDescarte = (typeof MOTIVOS_DESCARTE)[number]["chave"];

/* ── Relacionamento da Empresa (Bloco 05 §7) ───────────────────────────── */

/** O relacionamento é DERIVADO dos processos reais, nunca um status que o
 *  usuário troca à mão. A função que deriva mora em `identidade.ts`. */
export const RELACIONAMENTOS = [
  "cadastrada", "em_pre_vendas", "em_oportunidade", "cliente", "ex_cliente",
] as const;
export type RelacionamentoEmpresa = (typeof RELACIONAMENTOS)[number];

export const ROTULO_RELACIONAMENTO: Record<RelacionamentoEmpresa, string> = {
  cadastrada: "Cadastrada",
  em_pre_vendas: "Em Pré-vendas",
  em_oportunidade: "Em oportunidade",
  cliente: "Cliente",
  ex_cliente: "Ex-cliente",
};

/* ── Papéis do vínculo Pessoa ↔ Empresa (Bloco 05 §11) ─────────────────── */

export const PAPEIS_PESSOA = [
  { chave: "contato_principal", rotulo: "Contato principal" },
  { chave: "decisor", rotulo: "Decisor" },
  { chave: "influenciador", rotulo: "Influenciador" },
  { chave: "financeiro", rotulo: "Financeiro" },
  { chave: "tecnico", rotulo: "Técnico" },
  { chave: "usuario", rotulo: "Usuário" },
  { chave: "outro", rotulo: "Outro" },
] as const;
export type PapelPessoa = (typeof PAPEIS_PESSOA)[number]["chave"];

/* ── Ator (Bloco 01 §19) ───────────────────────────────────────────────── */

/** Humano e IA usam o MESMO motor. A diferença é só quem executou, e é isso
 *  que este tipo carrega por todo comando de negócio. */
export const ATORES = ["HUMAN", "AI_AGENT", "AUTOMATION", "SYSTEM"] as const;
export type TipoAtor = (typeof ATORES)[number];

export interface Ator {
  tipo: TipoAtor;
  /** Usuário responsável quando existe. Agente e automação podem não ter. */
  usuarioId: string | null;
  /** Identificação livre de quem executou quando não é usuário (ex: "nexo-sdr"). */
  ref?: string | null;
}

export const ATOR_SISTEMA: Ator = { tipo: "SYSTEM", usuarioId: null, ref: null };

export function atorHumano(usuarioId: string | null): Ator {
  return { tipo: "HUMAN", usuarioId, ref: null };
}

/* ── Erro de regra de negócio ──────────────────────────────────────────── */

/**
 * Regra do domínio violada — não é falha técnica.
 *
 * Existe para que os gates da spec (mover para Proposta sem proposta, Won sem
 * evidência, nutrir sem motivo) cheguem à interface como uma mensagem
 * acionável e, quando houver, com a ação que destrava. A spec é explícita:
 * bloquear, explicar o requisito e oferecer o CTA.
 */
export class RegraDeNegocio extends Error {
  readonly codigo: string;
  readonly acao?: { rotulo: string; tipo: string };

  constructor(codigo: string, mensagem: string, acao?: { rotulo: string; tipo: string }) {
    super(mensagem);
    this.name = "RegraDeNegocio";
    this.codigo = codigo;
    this.acao = acao;
  }
}
