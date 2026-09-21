/**
 * Fulfillment (entrega/implantação pós-Won — 19/08, correção de escopo).
 *
 * Won termina o comercial. Fulfillment é outro processo (achado real do
 * legado: "Delivery PABX" virou Stage de Deal no Zoho — exatamente o erro
 * que este módulo existe pra não repetir). Chamado depois que um serviço
 * canônico é materializado (Won confirmado), nunca antes.
 *
 * Este módulo guarda os METADADOS de entrega usados pelas telas portadas do
 * CRM 2.0 (fases do kanban PABX, marcos do onboarding AI, famílias por
 * trilha) e a criação de fulfillment a partir dos SERVIÇOS canônicos.
 *
 * Os CHECKLISTS em si moram em `pos-venda-checklists.ts` e são reexportados
 * aqui porque é daqui que a rota `api-server/routes/fulfillments.ts` (portada
 * literal do CRM 2.0), os scripts de backfill e as telas os importam. São
 * STARTING POINT, não state machine travada — PABX vem do processo
 * operacional real de Delivery PABX (8 etapas: levantamento/portabilidade/
 * softswitch/infra/licenciamento/configuração/QA interno/validação do
 * cliente); Callface AI vem do "Guia de Treinamento e Onboarding" real;
 * White Label usa o checklist operacional mínimo do fluxo validado do
 * produto. Cada instância de Fulfillment é dado (linhas em
 * `fulfillment_itens`), editável, não enum de código.
 *
 * Existem DOIS caminhos de criação, de propósito, e eles não competem:
 *  - `criarFulfillmentsParaServicos` (aqui) — entra pelo SERVIÇO canônico
 *    materializado no Won; é o caminho do consumer de eventos, da rota de
 *    negócios e dos seeds.
 *  - `criarPosVendaDoNegocio` (`pos-venda.ts`, produção) — entra pelo
 *    NEGÓCIO, sem depender de grupo comercial (que não existe naquele banco).
 */
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { fulfillments, fulfillmentItens, servicosCanonicos, contratos, negocios, tarefas, oportunidadeItens, oportunidades } from "@/lib/db/schema";
import { notificarFulfillmentOnboardingCriado } from "@/lib/crm/notificar";
import { regraDaFamilia, FAMILIAS_POR_TRILHA } from "@/lib/crm/politica-familia";
import { PABX_CHECKLIST, AI_CHECKLIST_BASE, WHITE_LABEL_CHECKLIST, type ChecklistSeed } from "@/lib/crm/pos-venda-checklists";

export { PABX_CHECKLIST, AI_CHECKLIST_BASE, WHITE_LABEL_CHECKLIST };
export type { ChecklistSeed, ChecklistItemMetadata, EstagioPedagogico } from "@/lib/crm/pos-venda-checklists";

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

function checklistParaFamilia(serviceFamily: string): ChecklistSeed {
  if (serviceFamily === "PABX") return PABX_CHECKLIST;
  if (serviceFamily === "CALLFACE_AI") return AI_CHECKLIST_BASE;
  if (serviceFamily === "WHITE_LABEL") return WHITE_LABEL_CHECKLIST;
  return [];
}

// Onboarding (não Implantação) — Callface AI e White Label (27/08, contexto
// mestre do Kauã: "Implantação agora é PABX. White Label fica em Onboarding"
// + seção White Label "pertence ao Onboarding"). Isso reverte a correção de
// 25/08 que tinha jogado White Label pra Implantação; a instrução de 27/08 é
// posterior e explícita nos dois pontos do documento. O JSDoc de
// `criarFulfillmentsParaServicos` abaixo já descrevia CALLFACE_AI/WHITE_LABEL
// — a constante é que tinha ficado divergente do comportamento documentado.
// Usado aqui pra decidir responsável automático + 1ª tarefa + notificação,
// e reusado pelas rotas/telas de Onboarding pra filtrar a família certa
// sem duplicar a regra em mais de um lugar.
/**
 * Frente 2C.1 — a divisão por trilha passou a viver em UM lugar
 * (`lib/crm/politica-familia.ts`). Esta constante continua exportada porque
 * as rotas de Onboarding e a Home a usam como filtro, mas agora é DERIVADA da
 * política, não uma segunda lista que pode divergir.
 *
 * Divergência real que isso corrige (medida no código antes da mudança): este
 * arquivo dizia Onboarding = AI + White Label; `analytics/inicio.ts` dizia
 * Onboarding = só AI e Implantação = PABX + White Label; a página
 * `/clientes/implantacao` era `familiaFixa="PABX"`; e a Carteira
 * (`clientes-crm2.ts`) só contava PABX em implantação e AI em onboarding.
 * Resultado: um fulfillment de White Label não aparecia em bucket nenhum.
 *
 * Regra vigente (2C.1, explícita do Kauã): Callface AI → Onboarding; PABX →
 * Implantação PABX; White Label → Implantação White Label (trilha própria,
 * não igual à do PABX).
 */
// Valores efetivos hoje (iguais aos literais que produção tinha hardcoded):
// onboarding = ["CALLFACE_AI"], implantacao_pabx = ["PABX"],
// implantacao_white_label = ["WHITE_LABEL"]. Derivar da política evita a
// segunda lista que já divergiu uma vez. Tipados como string[] porque os
// consumidores (rotas portadas do CRM 2.0) os usam em filtros de coluna texto.
export const FAMILIAS_ONBOARDING: string[] = FAMILIAS_POR_TRILHA.onboarding;
export const FAMILIAS_IMPLANTACAO_PABX: string[] = FAMILIAS_POR_TRILHA.implantacao_pabx;
export const FAMILIAS_IMPLANTACAO_WHITE_LABEL: string[] = FAMILIAS_POR_TRILHA.implantacao_white_label;

/**
 * Cria o Fulfillment + checklist inicial pra cada serviço canônico
 * informado, se ainda não existir (idempotente via UNIQUE em
 * fulfillments.servico_canonico_id). Best-effort — nunca deve derrubar o
 * fluxo de Won que a chamou.
 *
 * Pra famílias de Onboarding (CALLFACE_AI/WHITE_LABEL — 25/08, spec do
 * Kauã "nada disso deve depender de alguém clicar em novo onboarding"),
 * além do fulfillment+checklist isso também: (1) atribui responsável —
 * regra real reaproveitada, não inventada: mesmo responsável do negócio que
 * gerou a venda (`contratos.negocioId → negocios.responsavelId`), já que
 * ainda não existe um time/regra dedicada de "responsável de onboarding"
 * separado do comercial; (2) cria a 1ª tarefa real ("Agendar reunião de
 * onboarding com o cliente" — o guia real confirma que quase tudo acontece
 * numa reunião só, então essa é literalmente a primeira ação que precisa
 * existir); (3) notifica o responsável e registra o evento na timeline
 * (`notificarFulfillmentOnboardingCriado`, mesmo padrão fire-and-forget de
 * `notificarFormularioImplantacaoRecebido`). PABX não recebe nada disso
 * aqui — Implantação continua com o fluxo que já tinha.
 */
export async function criarFulfillmentsParaServicos(servicoIds: string[], organizacaoId: string): Promise<void> {
  for (const servicoId of servicoIds) {
    try {
      const [existente] = await db.select({ id: fulfillments.id }).from(fulfillments).where(eq(fulfillments.servicoCanonicoId, servicoId)).limit(1);
      if (existente) continue;

      const [servico] = await db.select({ serviceFamily: servicosCanonicos.serviceFamily, contratoId: servicosCanonicos.contratoId, leadId: servicosCanonicos.leadId })
        .from(servicosCanonicos).where(eq(servicosCanonicos.id, servicoId)).limit(1);
      if (!servico) continue;

      // Frente 2C.1 — a automação inicial (responsável + 1ª tarefa +
      // notificação) é uma propriedade da FAMÍLIA, não do rótulo "onboarding".
      // PABX segue sem ela de propósito: Implantação PABX já tem o fluxo
      // próprio (formulário de implantação) e não deve ganhar uma tarefa
      // genérica de reunião em cima.
      const regra = regraDaFamilia(servico.serviceFamily);
      const ehOnboarding = regra.automacaoInicial;

      let responsavelId: string | null = null;
      if (ehOnboarding) {
        // Caminho original: pelo contrato do serviço.
        if (servico.contratoId) {
          const [comercial] = await db
            .select({ responsavelId: negocios.responsavelId })
            .from(contratos)
            .innerJoin(negocios, eq(negocios.id, contratos.negocioId))
            .where(eq(contratos.id, servico.contratoId))
            .limit(1);
          responsavelId = comercial?.responsavelId ?? null;
        }
        // Frente 2C.1 — venda SEM contrato (Callface AI pago no checkout) não
        // tinha como resolver responsável: caía em null, e sem responsável a
        // notificação de onboarding também não era enviada (achado real na
        // simulação: o onboarding de Callface AI nascia órfão). Resolve pelo
        // negócio da oportunidade que gerou o serviço.
        if (!responsavelId) {
          const [viaOportunidade] = await db
            .select({ responsavelId: negocios.responsavelId })
            .from(oportunidadeItens)
            .innerJoin(oportunidades, eq(oportunidades.id, oportunidadeItens.oportunidadeId))
            .innerJoin(negocios, eq(negocios.id, oportunidades.negocioIdLegado))
            .where(eq(oportunidadeItens.servicoCanonicoId, servicoId))
            .limit(1);
          responsavelId = viaOportunidade?.responsavelId ?? null;
        }
      }

      const checklist = checklistParaFamilia(servico.serviceFamily);
      const [fulfillment] = await db.insert(fulfillments).values({
        organizacaoId,
        servicoCanonicoId: servicoId,
        serviceFamily: servico.serviceFamily,
        status: "NOT_STARTED",
        startedAt: new Date(),
        responsavelId,
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

      if (ehOnboarding) {
        if (servico.leadId) {
          await db.insert(tarefas).values({
            organizacaoId,
            leadId: servico.leadId,
            usuarioId: responsavelId,
            titulo: regra.tarefaInicial ?? "Agendar reunião de kickoff com o cliente",
            tipo: "onboarding_agendar_reuniao",
            prioridade: "alta",
            venceEm: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          });
        }
        await notificarFulfillmentOnboardingCriado(fulfillment.id);
      }
    } catch (err) {
      console.error(`[fulfillment] falha ao criar fulfillment do serviço ${servicoId} (best-effort):`, err);
    }
  }
}
