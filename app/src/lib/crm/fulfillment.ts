/**
 * Fulfillment (entrega/implantação pós-Won — 19/08, correção de escopo).
 *
 * Won termina o comercial. Fulfillment é outro processo (achado real do
 * legado: "Delivery PABX" virou Stage de Deal no Zoho — exatamente o erro
 * que este módulo existe pra não repetir). Chamado depois que um serviço
 * canônico é materializado (Won confirmado), nunca antes.
 *
 * Os templates de checklist abaixo são STARTING POINT, não state machine
 * travada — PABX vem do processo operacional real de Delivery PABX (8
 * etapas: levantamento/portabilidade/softswitch/infra/licenciamento/
 * configuração/QA interno/validação do cliente); Callface AI vem do "Guia
 * de Treinamento e Onboarding" real (base comum — módulos condicionais
 * como integração de CRM/campanhas/reuniões/agente de IA ainda não têm
 * detecção real no catálogo, fica pra quando existir esse sinal); White
 * Label usa um checklist operacional mínimo baseado no fluxo validado do
 * produto, sem inventar provisionamento técnico de infraestrutura. Cada
 * instância de Fulfillment é dado (linhas em
 * `fulfillment_itens`), editável, não enum de código.
 */
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { fulfillments, fulfillmentItens, servicosCanonicos } from "@/lib/db/schema";

// Estágio pedagógico do "Guia de Treinamento e Onboarding de Clientes
// Callface" (base do checklist CALLFACE_AI, 19/08): EXPLICAR → DEMONSTRAR →
// FAZER JUNTO → CLIENTE EXECUTA → VALIDAR. Onboarding não é "passo marcado
// feito", é progressão pedagógica — um item pode cobrir mais de um estágio
// (ex.: "explicar e demonstrar" nasceu como um item só no processo real).
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
// Callface" (recebido 19/08, enriquecido 19/08 seguindo a progressão
// pedagógica do guia). Só a BASE (comum a qualquer contratação) — módulos
// condicionais (integração de CRM, campanhas, reuniões online, agente de
// IA) dependem de saber o que o Service/Catalog realmente contratou, e
// essa detecção ainda não existe no catálogo (nenhum campo tipo
// "incluiIntegracaoCrm"/"incluiAgente" hoje) — não fabricar isso aqui;
// fica registrado como próximo passo real, não fingido com item solto.
//
// Nota honesta sobre a progressão EXPLICAR→DEMONSTRAR→FAZER JUNTO→CLIENTE
// EXECUTA→VALIDAR: o processo real recebido não descreve um passo próprio
// de "fazer junto" pro onboarding Callface AI (o time explica+demonstra e
// depois o cliente já executa a primeira ligação real sozinho) — por isso
// nenhum item aqui carrega o estágio FAZER_JUNTO. Não inventado; é um gap
// real do processo tal como descrito, não do modelo de dado.
//
// Princípio do guia preservado: treinamento concluído ≠ onboarding
// concluído (Activation ≠ Adoption) — por isso "primeiro_valor_confirmado"
// é item explícito do checklist (não só um efeito colateral de outro
// passo), e é ele (junto com todos os demais) que precisa estar DONE pra
// fulfillment.status virar COMPLETED — ver PATCH /fulfillments/itens/:id.
// Isso faz "pronto tecnicamente" e "adotado de fato" convergirem no mesmo
// gate, de propósito.
export const AI_CHECKLIST_BASE: ChecklistSeed = [
  { workstream: "validacao_contratacao", titulo: "Validar contratação (plano, módulos, responsável, dados da empresa)" },
  { workstream: "acessos", titulo: "Configurar acessos e usuários" },
  {
    workstream: "explicar_demonstrar",
    titulo: "Explicar e demonstrar a plataforma (ligação de exemplo)",
    metadata: { estagioPedagogico: ["EXPLICAR", "DEMONSTRAR"] },
  },
  {
    workstream: "primeira_ligacao",
    titulo: "Cliente realizar a primeira ligação real",
    metadata: { estagioPedagogico: ["CLIENTE_EXECUTA"] },
  },
  {
    workstream: "primeiro_valor",
    titulo: "Validar primeiro valor (histórico, transcrição e resumo da ligação)",
    metadata: { estagioPedagogico: ["VALIDAR"] },
  },
  // First-Value milestone — marco de negócio, não passo técnico. Sempre
  // manual: só o time confirma quando souber que o cliente de fato teve
  // valor real (ex.: uma ligação real atendida com sucesso pela IA, um
  // lead qualificado automaticamente) — não decidido/inferido em código
  // aqui porque não há sinal técnico confiável disponível hoje.
  {
    workstream: "primeiro_valor_confirmado",
    titulo: "Confirmar primeiro valor real atingido (marco manual)",
    metadata: { milestone: "FIRST_VALUE", marcacaoManual: true },
  },
  {
    workstream: "proximos_passos",
    titulo: "Definir próximos passos e handoff para o Customer Success",
    metadata: { handoffCs: true },
  },
];

export const WHITE_LABEL_CHECKLIST: ChecklistSeed = [
  { workstream: "acesso", titulo: "Enviar convite e provisionar acesso do cliente" },
  { workstream: "acesso", titulo: "Confirmar primeiro acesso" },
  { workstream: "branding", titulo: "Coletar e validar logo e identidade visual" },
  { workstream: "dominio", titulo: "Definir domínio white label" },
  { workstream: "dominio", titulo: "Configurar e validar DNS" },
  { workstream: "ambiente", titulo: "Configurar ambiente white label" },
  { workstream: "capacidade", titulo: "Registrar capacidade contratada" },
  { workstream: "qualidade", titulo: "Executar testes internos" },
  { workstream: "treinamento", titulo: "Realizar treinamento" },
  { workstream: "ativacao", titulo: "Confirmar primeiro uso e primeiro valor", metadata: { milestone: "FIRST_VALUE", marcacaoManual: true } },
  { workstream: "ativacao", titulo: "Confirmar ativação do ambiente" },
  { workstream: "handoff", titulo: "Preparar handoff para Customer Success", metadata: { handoffCs: true } },
];

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

function checklistParaFamilia(serviceFamily: string): ChecklistSeed {
  if (serviceFamily === "PABX") return PABX_CHECKLIST;
  if (serviceFamily === "CALLFACE_AI") return AI_CHECKLIST_BASE;
  if (serviceFamily === "WHITE_LABEL") return WHITE_LABEL_CHECKLIST;
  return [];
}

/**
 * Cria o Fulfillment + checklist inicial pra cada serviço canônico
 * informado, se ainda não existir (idempotente via UNIQUE em
 * fulfillments.servico_canonico_id). Best-effort — nunca deve derrubar o
 * fluxo de Won que a chamou.
 */
export async function criarFulfillmentsParaServicos(servicoIds: string[], organizacaoId: string): Promise<void> {
  for (const servicoId of servicoIds) {
    try {
      const [existente] = await db.select({ id: fulfillments.id }).from(fulfillments).where(eq(fulfillments.servicoCanonicoId, servicoId)).limit(1);
      if (existente) continue;

      const [servico] = await db.select({ serviceFamily: servicosCanonicos.serviceFamily }).from(servicosCanonicos).where(eq(servicosCanonicos.id, servicoId)).limit(1);
      if (!servico) continue;

      const checklist = checklistParaFamilia(servico.serviceFamily);
      const [fulfillment] = await db.insert(fulfillments).values({
        organizacaoId,
        servicoCanonicoId: servicoId,
        serviceFamily: servico.serviceFamily,
        status: "NOT_STARTED",
        startedAt: new Date(),
      }).returning({ id: fulfillments.id });

      if (checklist.length > 0) {
        await db.insert(fulfillmentItens).values(
          checklist.map((item, i) => ({
            organizacaoId,
            fulfillmentId: fulfillment.id,
            workstream: item.workstream,
            titulo: item.titulo,
            ordem: i,
            metadata: item.metadata ?? null,
          }))
        );
      }
    } catch (err) {
      console.error(`[fulfillment] falha ao criar fulfillment do serviço ${servicoId} (best-effort):`, err);
    }
  }
}
