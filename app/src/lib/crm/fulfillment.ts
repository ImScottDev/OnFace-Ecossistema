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
import { eq, sql } from "drizzle-orm";
import { fulfillments, fulfillmentItens, servicosCanonicos, tarefas } from "@/lib/db/schema";
import { notificarFulfillmentOnboardingCriado } from "@/lib/crm/notificar";
import { regraDaFamilia, FAMILIAS_POR_TRILHA } from "@/lib/crm/politica-familia";
import { PABX_CHECKLIST, AI_CHECKLIST_BASE, WHITE_LABEL_CHECKLIST, type ChecklistSeed } from "@/lib/crm/pos-venda-checklists";

export { PABX_CHECKLIST, AI_CHECKLIST_BASE, WHITE_LABEL_CHECKLIST };
export type { ChecklistSeed, ChecklistItemMetadata, EstagioPedagogico } from "@/lib/crm/pos-venda-checklists";

// Vocabulário de fase: mora em `pos-venda-checklists.ts` (módulo puro), para
// que as telas possam importá-lo sem arrastar `db` junto. Reexportado aqui
// porque sete chamadores já o pegam deste caminho.
export {
  FASE_PABX_POR_WORKSTREAM, FASE_WHITE_LABEL_POR_WORKSTREAM,
  MARCOS_AI, MARCO_AI_POR_WORKSTREAM, type MarcoAI,
} from "@/lib/crm/pos-venda-checklists";

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
 * regra real reaproveitada, não inventada: o mesmo responsável da venda,
 * buscado em cadeia do canônico para o legado (oportunidade, contrato,
 * negócio, aquisição), já que ainda não existe um time/regra dedicada de
 * "responsável de onboarding" separado do comercial; (2) cria a 1ª tarefa real ("Agendar reunião de
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
        // A cadeia vai do canônico para o legado, nesta ordem, e cada elo
        // existe porque o anterior FALHA para uma parte real da base:
        //
        //   1. oportunidade do serviço  — o dono canônico da venda;
        //   2. contrato -> oportunidade — contrato assinado sem item de
        //      oportunidade registrado;
        //   3. contrato -> negócio      — o caminho antigo, que resolve nada
        //      para 406 dos 742 contratos (271 deles ATIVOS), porque metade da
        //      base de contratos nunca teve negócio de origem;
        //   4. aquisição do lead        — último recurso: quem trabalhou a
        //      entrada. Sem isto, o onboarding nasce órfão e a notificação
        //      nunca sai, que foi o achado da simulação 2C.1.
        const donos = await db.execute<{ responsavel_id: string | null }>(sql`
          SELECT COALESCE(
            (SELECT o.responsavel_id FROM oportunidade_itens oi
               JOIN oportunidades o ON o.id = oi.oportunidade_id
              WHERE oi.servico_canonico_id = ${servicoId}::uuid AND o.responsavel_id IS NOT NULL
              LIMIT 1),
            (SELECT o.responsavel_id FROM contratos c
               JOIN oportunidades o ON o.id = c.oportunidade_id
              WHERE c.id = ${servico.contratoId ?? null}::uuid AND o.responsavel_id IS NOT NULL
              LIMIT 1),
            (SELECT n.responsavel_id FROM contratos c
               JOIN negocios n ON n.id = c.negocio_id
              WHERE c.id = ${servico.contratoId ?? null}::uuid AND n.responsavel_id IS NOT NULL
              LIMIT 1),
            (SELECT a.responsavel_id FROM contratos c
               JOIN aquisicoes a ON a.lead_legado_id = c.lead_id
              WHERE c.id = ${servico.contratoId ?? null}::uuid AND a.responsavel_id IS NOT NULL
              LIMIT 1)
          )::text AS responsavel_id`);
        responsavelId = donos[0]?.responsavel_id ?? null;
      }

      const checklist = checklistParaFamilia(servico.serviceFamily);
      // `tipo` e `cycleNumber` são obrigatórios desde a migration 0066: a
      // unicidade é (servico, tipo, ciclo). Com `tipo` NULO o índice não
      // colide nunca — NULL não é igual a NULL — e este caminho passaria a
      // criar jornada duplicada em silêncio a cada execução.
      const [fulfillment] = await db.insert(fulfillments).values({
        organizacaoId,
        servicoCanonicoId: servicoId,
        serviceFamily: servico.serviceFamily,
        tipo: ehOnboarding ? "ONBOARDING" : "IMPLEMENTATION",
        cycleNumber: 1,
        status: "NOT_STARTED",
        startedAt: new Date(),
        responsavelId,
      }).onConflictDoNothing({
        target: [fulfillments.servicoCanonicoId, fulfillments.tipo, fulfillments.cycleNumber],
        where: sql`servico_canonico_id IS NOT NULL`,
      }).returning({ id: fulfillments.id });
      if (!fulfillment) continue; // jornada já existia para este serviço e ciclo

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
