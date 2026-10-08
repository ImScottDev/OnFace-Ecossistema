/**
 * PÓS-VENDA CANÔNICO — Won → Serviço → Onboarding/Implantação.
 *
 * Ponto único de entrada do pós-venda. Chamado DEPOIS que o negócio já foi
 * persistido como ganho, nos três caminhos que fecham venda hoje
 * (PATCH Hono, PATCH Next e aceite de proposta). Nunca antes, nunca dentro
 * da transação do Won: se isto falhar, o negócio continua ganho e o comando
 * `npm run posvenda:reprocessar -- <negocioId>` refaz.
 *
 * Roteamento (regra do Kauã, 08/09):
 *   CALLFACE_AI → Onboarding
 *   PABX        → Implantação PABX
 *   WHITE_LABEL → Implantação White Label
 *   UNKNOWN     → Validação manual (nunca chuta uma trilha)
 *
 * O que este módulo deliberadamente NÃO faz, porque está fora do recorte
 * mínimo acordado: não mexe em receita/MRR (o serviço nasce
 * `portfolio_included = false` e `current_recurring_value = 0`, portanto
 * invisível pra view `current_service_portfolio`), não cria evidência de
 * Won, não usa event_outbox e não toca o board `/onboarding` legado.
 *
 * Convenção de nomes preservada do CRM 2.0 de propósito: quando o CRM2
 * completo subir, ele materializa serviço canônico pelo grupo comercial e
 * este adaptador sai de cena — as tabelas, as trilhas e os checklists
 * continuam os mesmos.
 */
import { db } from "@/lib/db";
import { and, eq, sql } from "drizzle-orm";
import {
  negocios,
  contratos,
  propostas,
  propostaItens,
  servicosCanonicos,
  fulfillments,
  fulfillmentItens,
  tarefas,
  pipelines,
} from "@/lib/db/schema";
import {
  classificarItensDaProposta,
  classificarProdutoPorNome,
  type FamiliaServico,
} from "@/lib/crm/classificar-produto";
import {
  PABX_CHECKLIST,
  AI_CHECKLIST_BASE,
  WHITE_LABEL_CHECKLIST,
  type ChecklistSeed,
} from "@/lib/crm/pos-venda-checklists";

export type TrilhaPosGanho =
  | "onboarding"
  | "implantacao_pabx"
  | "implantacao_white_label"
  | "validacao_manual";

interface RegraFamilia {
  trilha: TrilhaPosGanho;
  trilhaLabel: string;
  checklist: ChecklistSeed;
  /** Cria responsável + 1ª tarefa automaticamente? PABX não: tem fluxo próprio (formulário de implantação). */
  automacaoInicial: boolean;
  tarefaInicial: string | null;
}

const REGRAS: Record<FamiliaServico, RegraFamilia> = {
  CALLFACE_AI: {
    trilha: "onboarding",
    trilhaLabel: "Onboarding",
    checklist: AI_CHECKLIST_BASE,
    automacaoInicial: true,
    tarefaInicial: "Agendar reunião de onboarding com o cliente",
  },
  PABX: {
    trilha: "implantacao_pabx",
    trilhaLabel: "Implantação PABX",
    checklist: PABX_CHECKLIST,
    automacaoInicial: false,
    tarefaInicial: null,
  },
  WHITE_LABEL: {
    trilha: "implantacao_white_label",
    trilhaLabel: "Implantação White Label",
    checklist: WHITE_LABEL_CHECKLIST,
    // A fila recebe White Label sem dono. O time define o responsável antes
    // de iniciar, em vez de herdar automaticamente o comercial.
    automacaoInicial: false,
    tarefaInicial: null,
  },
  // Sem sinal nenhum de família = ninguém adivinha. Vai pra fila de
  // validação manual, sem checklist, esperando uma pessoa dizer o que é.
  UNKNOWN: {
    trilha: "validacao_manual",
    trilhaLabel: "Validação manual",
    checklist: [],
    automacaoInicial: false,
    tarefaInicial: null,
  },
};

export function regraDaFamilia(familia: FamiliaServico): RegraFamilia {
  return REGRAS[familia] ?? REGRAS.UNKNOWN;
}

/**
 * Ligado só quando a env existe e é "on". Ausente = desligado.
 *
 * Duas envs de propósito, com ciclos de vida diferentes:
 *  - `POSVENDA_CANONICO` decide se o pós-venda é CRIADO (lida em runtime pela
 *    API/worker — ligar ou desligar é só restart);
 *  - `NEXT_PUBLIC_POSVENDA_CANONICO` decide se o menu APARECE (o Next inlina
 *    no build, então mudá-la exige rebuild do app).
 *
 * Na prática ligam juntas. Separadas, dá pra deixar o motor rodando com o
 * menu escondido — que é exatamente o estado de "subiu, ninguém viu ainda".
 */
export function posVendaHabilitado(): boolean {
  const v = process.env.POSVENDA_CANONICO || process.env.NEXT_PUBLIC_POSVENDA_CANONICO || "";
  return v.toLowerCase() === "on";
}

export interface ResultadoPosVenda {
  criado: boolean;
  motivo?: string;
  familia?: FamiliaServico;
  trilha?: TrilhaPosGanho;
  servicoCanonicoId?: string;
  fulfillmentId?: string;
  itensChecklist?: number;
}

/**
 * Descobre a família do negócio pelos melhores dados já disponíveis, na
 * ordem decrescente de confiança:
 *
 *   1. itens da proposta ACEITA vinculada ao negócio (o que foi vendido de
 *      fato, com valor pra desempatar venda mista);
 *   2. itens de qualquer proposta do negócio, se nenhuma foi marcada aceita
 *      (acontece no Won manual arrastado no pipeline);
 *   3. `contratos.produto` ('ai' | 'pabx') do contrato do negócio;
 *   4. `negocios.campos_custom.produto`, gravado pela qualificação SDR;
 *   5. título do negócio;
 *   6. o PIPELINE em que o negócio está (funil PABX ou Callface AI).
 *
 * Retorna UNKNOWN quando nenhuma das seis diz nada — nunca um palpite.
 */
export async function resolverFamiliaDoNegocio(negocioId: string): Promise<FamiliaServico> {
  // 1./2. itens de proposta
  const itens = await db
    .select({
      nome: propostaItens.nome,
      subtotal: propostaItens.subtotal,
      statusProposta: propostas.status,
    })
    .from(propostaItens)
    .innerJoin(propostas, eq(propostaItens.propostaId, propostas.id))
    .where(eq(propostas.negocioId, negocioId));

  const aceitos = itens.filter((i) => i.statusProposta === "aceita");
  const universo = aceitos.length > 0 ? aceitos : itens;

  if (universo.length > 0) {
    const classificados = classificarItensDaProposta(
      universo.map((i) => ({ nome: i.nome, valor: parseFloat(i.subtotal || "0") || 0 })),
    );
    const soma = new Map<FamiliaServico, number>();
    for (const c of classificados) {
      if (c.familia === "UNKNOWN") continue;
      soma.set(c.familia, (soma.get(c.familia) ?? 0) + c.valor);
    }
    if (soma.size > 0) {
      return [...soma.entries()].sort((a, b) => b[1] - a[1])[0][0];
    }
  }

  // 3. contratos.produto
  const [contrato] = await db
    .select({ produto: contratos.produto, servicos: contratos.servicos })
    .from(contratos)
    .where(eq(contratos.negocioId, negocioId))
    .limit(1);
  if (contrato?.produto === "pabx") return "PABX";
  if (contrato?.produto === "ai") return "CALLFACE_AI";
  if (contrato?.servicos?.length) {
    const porServico = classificarProdutoPorNome(contrato.servicos.join(" "));
    if (porServico !== "UNKNOWN") return porServico;
  }

  // 4. campos_custom.produto (qualificação SDR)
  const [negocio] = await db
    .select({ camposCustom: negocios.camposCustom, titulo: negocios.titulo, pipelineId: negocios.pipelineId })
    .from(negocios)
    .where(eq(negocios.id, negocioId))
    .limit(1);
  const produtoCustom = ((negocio?.camposCustom || {}) as Record<string, unknown>).produto;
  if (produtoCustom === "pabx") return "PABX";
  if (produtoCustom === "ai") return "CALLFACE_AI";
  if (typeof produtoCustom === "string") {
    const porCustom = classificarProdutoPorNome(produtoCustom);
    if (porCustom !== "UNKNOWN") return porCustom;
  }

  // 5. título do negócio
  const porTitulo = classificarProdutoPorNome(negocio?.titulo);
  if (porTitulo !== "UNKNOWN") return porTitulo;

  // 6. PIPELINE em que o negócio está. Vem por último de propósito, e depois
  // do título: o funil "Callface AI" também abriga venda White Label (medido
  // no banco — "Spot Sales - White Label" mora lá), então o nome do negócio,
  // quando diz algo, é mais confiável que o funil.
  //
  // Sem este passo, 52% dos negócios abertos caíam em Validação manual só
  // porque se chamam "Fulano - Novo negócio" e não têm proposta com itens.
  // O funil é uma escolha explícita de quem vendeu, não um palpite.
  if (negocio?.pipelineId) {
    const [pipe] = await db
      .select({ nome: pipelines.nome })
      .from(pipelines)
      .where(eq(pipelines.id, negocio.pipelineId))
      .limit(1);
    const porPipeline = classificarProdutoPorNome(pipe?.nome);
    if (porPipeline !== "UNKNOWN") return porPipeline;
  }

  return "UNKNOWN";
}

/**
 * Cria o pós-venda de um negócio ganho. IDEMPOTENTE em três camadas:
 *
 *   1. checagem explícita por `evidence->>'negocioId'` — se já existe
 *      serviço deste negócio, sai sem escrever nada;
 *   2. `UNIQUE (organizacao_id, canonical_key)` — a chave é determinística
 *      (`POSVENDA:negocio:<id>:<FAMILIA>`), então repetir dá a mesma linha;
 *   3. `UNIQUE (fulfillments.servico_canonico_id)` — um serviço nunca tem
 *      duas entregas, nem em corrida.
 *
 * Nunca lança: devolve `{ criado: false, motivo }` e loga. Quem chama não
 * precisa (e não deve) tratar erro — o Won já aconteceu.
 */
export async function criarPosVendaDoNegocio(
  negocioId: string,
  opts: { ignorarFlag?: boolean } = {},
): Promise<ResultadoPosVenda> {
  try {
    if (!opts.ignorarFlag && !posVendaHabilitado()) {
      return { criado: false, motivo: "flag POSVENDA_CANONICO desligada" };
    }

    const [negocio] = await db
      .select({
        id: negocios.id,
        organizacaoId: negocios.organizacaoId,
        empresaId: negocios.empresaId,
        leadId: negocios.leadId,
        responsavelId: negocios.responsavelId,
        status: negocios.status,
        titulo: negocios.titulo,
        ganhoAt: negocios.ganhoAt,
      })
      .from(negocios)
      .where(eq(negocios.id, negocioId))
      .limit(1);

    if (!negocio) return { criado: false, motivo: "negócio não encontrado" };
    if (negocio.status !== "ganho") {
      return { criado: false, motivo: `negócio não está ganho (status=${negocio.status})` };
    }

    // Camada 1 de idempotência: já existe serviço deste negócio?
    const [jaExiste] = await db
      .select({ id: servicosCanonicos.id, familia: servicosCanonicos.serviceFamily })
      .from(servicosCanonicos)
      .where(
        and(
          eq(servicosCanonicos.organizacaoId, negocio.organizacaoId),
          sql`${servicosCanonicos.evidence} ->> 'negocioId' = ${negocioId}`,
        ),
      )
      .limit(1);

    if (jaExiste) {
      const [f] = await db
        .select({ id: fulfillments.id })
        .from(fulfillments)
        .where(eq(fulfillments.servicoCanonicoId, jaExiste.id))
        .limit(1);
      return {
        criado: false,
        motivo: "pós-venda já existe para este negócio",
        familia: jaExiste.familia as FamiliaServico,
        servicoCanonicoId: jaExiste.id,
        fulfillmentId: f?.id,
      };
    }

    const familia = await resolverFamiliaDoNegocio(negocioId);
    const regra = regraDaFamilia(familia);
    const wonAt = negocio.ganhoAt ?? new Date();

    const [contrato] = await db
      .select({ id: contratos.id })
      .from(contratos)
      .where(eq(contratos.negocioId, negocioId))
      .limit(1);

    // Serviço canônico. Prefixo POSVENDA: não colide com as chaves já
    // existentes em produção (LEDGER:/STRIPE:/CONTRACT:/ZOHO:).
    //
    // portfolio_included=false + revenue_nature=UNKNOWN + valor 0 é
    // deliberado: a view current_service_portfolio filtra
    // `portfolio_included AND revenue_nature='MRR'`, então nada disto entra
    // em MRR, carteira ou relatório de receita. Este recorte roteia entrega,
    // não reconhece receita.
    const canonicalKey = `POSVENDA:negocio:${negocioId}:${familia}`;
    const [servico] = await db
      .insert(servicosCanonicos)
      .values({
        organizacaoId: negocio.organizacaoId,
        empresaId: negocio.empresaId,
        leadId: negocio.leadId,
        contratoId: contrato?.id ?? null,
        canonicalKey,
        serviceFamily: familia,
        canonicalProduct: negocio.titulo,
        revenueNature: "UNKNOWN",
        billingSource: "CRM_POSVENDA",
        commercialLifecycle: "ACTIVE",
        billingStatus: "NOT_APPLICABLE",
        currentRecurringValue: "0",
        portfolioIncluded: false,
        // A família veio de classificador por nome, não de evidência dura.
        confidence: familia === "UNKNOWN" ? "UNRESOLVED" : "PROBABLE",
        evidence: {
          origem: "pos_venda_canonico",
          negocioId,
          contratoId: contrato?.id ?? null,
          wonAt: wonAt.toISOString(),
        },
      })
      .onConflictDoNothing({
        target: [servicosCanonicos.organizacaoId, servicosCanonicos.canonicalKey],
      })
      .returning({ id: servicosCanonicos.id });

    // Camada 2: conflito = outra execução ganhou a corrida. Relê e segue.
    let servicoId = servico?.id;
    if (!servicoId) {
      const [existente] = await db
        .select({ id: servicosCanonicos.id })
        .from(servicosCanonicos)
        .where(
          and(
            eq(servicosCanonicos.organizacaoId, negocio.organizacaoId),
            eq(servicosCanonicos.canonicalKey, canonicalKey),
          ),
        )
        .limit(1);
      servicoId = existente?.id;
      if (!servicoId) return { criado: false, motivo: "falha ao materializar serviço canônico" };
    }

    // Camada 3: UNIQUE em (servico_canonico_id, tipo, cycle_number).
    //
    // Era UNIQUE em servico_canonico_id sozinho até a migration 0068, que
    // removeu a exclusividade porque ela impedia PABX/White Label de ter
    // onboarding E implantação no mesmo serviço (SPEC 18.1). Este caminho
    // legado continua criando SÓ a jornada de onboarding — quem cria as duas
    // é `avaliarCondicaoDeGanho`, pela política da oferta. Este adaptador
    // morre na fase 17, quando `negocios.ts` passar pelo canônico.
    const [fulfillment] = await db
      .insert(fulfillments)
      .values({
        organizacaoId: negocio.organizacaoId,
        servicoCanonicoId: servicoId,
        serviceFamily: familia,
        tipo: "ONBOARDING",
        cycleNumber: 1,
        status: "NOT_STARTED",
        startedAt: new Date(),
        responsavelId: regra.automacaoInicial ? negocio.responsavelId : null,
      })
      .onConflictDoNothing({
        target: [fulfillments.servicoCanonicoId, fulfillments.tipo, fulfillments.cycleNumber],
        where: sql`servico_canonico_id IS NOT NULL`,
      })
      .returning({ id: fulfillments.id });

    if (!fulfillment) {
      const [existente] = await db
        .select({ id: fulfillments.id })
        .from(fulfillments)
        .where(
          and(
            eq(fulfillments.servicoCanonicoId, servicoId),
            eq(fulfillments.tipo, "ONBOARDING"),
            eq(fulfillments.cycleNumber, 1),
          ),
        )
        .limit(1);
      return {
        criado: false,
        motivo: "fulfillment já existia para este serviço",
        familia,
        trilha: regra.trilha,
        servicoCanonicoId: servicoId,
        fulfillmentId: existente?.id,
      };
    }

    if (regra.checklist.length > 0) {
      await db.insert(fulfillmentItens).values(
        regra.checklist.map((item, i) => ({
          organizacaoId: negocio.organizacaoId,
          fulfillmentId: fulfillment.id,
          workstream: item.workstream,
          titulo: item.titulo,
          ordem: i,
          metadata: item.metadata ?? null,
        })),
      );
    }

    // Primeira tarefa real. Só nas famílias com automação inicial: PABX é
    // false de propósito (o fluxo dele começa pelo formulário de
    // implantação, não por uma reunião genérica).
    if (regra.automacaoInicial && regra.tarefaInicial && negocio.leadId) {
      await db.insert(tarefas).values({
        organizacaoId: negocio.organizacaoId,
        leadId: negocio.leadId,
        negocioId,
        // QA pós-venda 06/10: sem `empresaId`/`origem`/serviço a tarefa nascia
        // invisível para a agenda e a fila do CS (ambas juntam por empresa_id)
        // e como "MANUAL"; a carga do marco zero já grava as do onboarding
        // assim, então o Ganho novo tem de gravar igual.
        empresaId: negocio.empresaId,
        servicoCanonicoId: servicoId,
        origem: familia === "WHITE_LABEL" ? "IMPLANTACAO" : "ONBOARDING",
        usuarioId: negocio.responsavelId,
        titulo: regra.tarefaInicial,
        tipo: familia === "WHITE_LABEL" ? "implantacao_white_label_contato" : "onboarding_agendar_reuniao",
        prioridade: "alta",
        venceEm: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      });
    }

    /* Marco medível: do Ganho ao começo da entrega. Sem este evento o tempo entre os dois só
       existia como diferença de created_at entre duas tabelas. Best-effort: o pós-venda já nasceu. */
    try {
      const { registrarEvento } = await import("@/lib/vendas/eventos");
      await registrarEvento({
        organizacaoId: negocio.organizacaoId, tipo: "OnboardingStarted", ator: { tipo: "SYSTEM", usuarioId: null, ref: "pos_venda_canonico" },
        negocioId, empresaId: negocio.empresaId, leadId: negocio.leadId,
        contexto: { familia, trilha: regra.trilha, servicoCanonicoId: servicoId, fulfillmentId: fulfillment.id, itensChecklist: regra.checklist.length, ganhoEm: wonAt.toISOString() },
      });
    } catch (e) {
      console.error("[pos-venda] evento OnboardingStarted não gravado:", e);
    }

    return {
      criado: true,
      familia,
      trilha: regra.trilha,
      servicoCanonicoId: servicoId,
      fulfillmentId: fulfillment.id,
      itensChecklist: regra.checklist.length,
    };
  } catch (err) {
    console.error(`[pos-venda] falha ao criar pós-venda do negócio ${negocioId} (negócio segue ganho):`, err);
    return { criado: false, motivo: err instanceof Error ? err.message : String(err) };
  }
}
