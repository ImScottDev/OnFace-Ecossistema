/**
 * Commercial Core v2 (ADR-EXEC-021) — Grupo Comercial: fulfillment
 * independente por composição dentro da MESMA proposta/oportunidade.
 *
 * Problema real (achado no E2E da v1): "tem PABX na proposta, então a
 * proposta INTEIRA espera contrato" — quebra venda mista de verdade
 * (Callface AI sem fidelidade + PABX contratual na mesma negociação). A
 * partir daqui, o aceite agrupa os itens por commercial_model e cada grupo
 * tem seu PRÓPRIO estado, independente dos outros grupos da mesma proposta.
 *
 * State machine (grupo.status):
 *   aguardando_aceite -> aguardando_contrato -> contrato_enviado_assinatura
 *     -> contrato_assinado -\
 *   aguardando_aceite -----------------------> aguardando_checkout
 *     -> checkout_gerado -> pagamento_pendente -> pago -> concluido
 *   (qualquer estado -> falhou, quando o pagamento falha de vez)
 *
 * `concluido` é o único estado que materializa/atualiza servico_canonico —
 * feito via evento no Event Outbox (ver consumer.ts), nunca inline
 * best-effort silencioso (ADR-EXEC-021, resiliência da materialização).
 */
import { db } from "@/lib/db";
import { eq, and, inArray, sql } from "drizzle-orm";
import {
  propostas, propostaItens, propostaGrupoComercial, propostaGrupoComercialItens,
  oportunidades, oportunidadeItens, catalogoPrecos, servicosCatalogo,
} from "@/lib/db/schema";
import { publicarEvento } from "@/lib/events/outbox";
import { resolverCommercialModelPadraoPorCatalogoIds, resolverCommercialModelDoItem, type CommercialModel } from "@/lib/crm/commercial-model";
import { decidirGrupos, type CaminhoDeFechamento } from "@/lib/crm/decisao-fechamento";
import { classificarProdutoPorNome } from "@/lib/crm/classificar-produto";
import { regraDaFamilia } from "@/lib/crm/politica-familia";

export type StatusGrupoComercial =
  | "aguardando_aceite" | "aguardando_contrato" | "contrato_enviado_assinatura" | "contrato_assinado"
  | "aguardando_checkout" | "checkout_gerado" | "pagamento_pendente" | "pago" | "concluido" | "falhou"
  // Frente 2C.1 — família sem regra clara de fechamento: aceita, mas nunca
  // ganha automaticamente. Alguém do time valida na mão.
  | "aguardando_validacao_manual";

export interface GrupoComercialRow {
  id: string;
  commercialModel: CommercialModel;
  status: StatusGrupoComercial;
  itensIds: string[];
  contratoId?: string | null;
  checkoutId?: string | null;
  /** Caminho decidido item a item no aceite. null = grupo anterior à decisão por item (regra antiga, por grupo). */
  caminho: CaminhoDeFechamento | null;
  serviceFamily: string | null;
  /** Assinado: a retomada do aceite não reenvia nem regride um grupo assinado. */
  contratoAssinadoEm: Date | null;
  /** Última falha registrada ao avançar o grupo após o aceite (null = sem pendência). */
  fechamentoErro: string | null;
}

/** Quem executa: o `db` ou a transação do aceite. */
export type ExecutorGrupos = Pick<typeof db, "select" | "insert" | "update" | "delete" | "execute">;

/**
 * Forma os grupos comerciais de uma proposta, decidindo contrato × pagamento
 * ITEM A ITEM (P1-13, ver `decisao-fechamento.ts`).
 *
 * Chamado no ACEITE, dentro da transação dele. Cada linha ganha o seu caminho
 * (modelo comercial, modo da proposta, Price, família) e as que seguem o mesmo
 * caminho, modelo e família dividem UM grupo — um contrato ou um checkout por
 * grupo, nunca dois. O caminho fica gravado no grupo.
 *
 * Idempotente e sem duplicar: linha que já está num grupo FICA onde está (a
 * proposta aceita é imutável, e realocar linha de grupo que já tem contrato ou
 * checkout seria desfazer a venda em curso); só as linhas ainda sem grupo são
 * decididas, e entram num grupo existente de mesma decisão antes de criar outro.
 * A proposta é travada (FOR UPDATE) para duas chamadas simultâneas não criarem
 * grupos em dobro.
 */
export async function formarGruposComerciais(propostaId: string, ex: ExecutorGrupos = db): Promise<GrupoComercialRow[]> {
  const [proposta] = await ex.select().from(propostas).where(eq(propostas.id, propostaId)).limit(1);
  if (!proposta) return [];
  await ex.execute(sql`SELECT 1 FROM propostas WHERE id = ${propostaId}::uuid FOR UPDATE`);

  const itens = await ex
    .select({
      id: propostaItens.id, nome: propostaItens.nome, subtotal: propostaItens.subtotal, ordem: propostaItens.ordem,
      commercialModel: propostaItens.commercialModel, servicoCatalogoId: propostaItens.servicoCatalogoId,
      familiaDaLinha: propostaItens.serviceFamily, familiaDoCatalogo: servicosCatalogo.serviceFamily,
      catalogoPrecoId: propostaItens.catalogoPrecoId, exigeContratoDoPreco: catalogoPrecos.exigeContrato,
    })
    .from(propostaItens)
    .leftJoin(servicosCatalogo, eq(servicosCatalogo.id, propostaItens.servicoCatalogoId))
    .leftJoin(catalogoPrecos, eq(catalogoPrecos.id, propostaItens.catalogoPrecoId))
    .where(eq(propostaItens.propostaId, propostaId))
    .orderBy(propostaItens.ordem);
  if (itens.length === 0) return [];

  const jaAgrupados = new Set((await ex
    .select({ itemId: propostaGrupoComercialItens.propostaItemId })
    .from(propostaGrupoComercialItens)
    .innerJoin(propostaGrupoComercial, eq(propostaGrupoComercial.id, propostaGrupoComercialItens.grupoId))
    .where(eq(propostaGrupoComercial.propostaId, propostaId))).map((r) => r.itemId));

  const novos = itens.filter((i) => !jaAgrupados.has(i.id));
  if (novos.length > 0) {
    const catalogoIds = novos.map((i) => i.servicoCatalogoId).filter((id): id is string => !!id);
    const defaultMap = await resolverCommercialModelPadraoPorCatalogoIds(catalogoIds);
    const conhecida = (f: string | null | undefined) => (f && f !== "UNKNOWN" ? f : null);

    const decididos = decidirGrupos(novos.map((item) => ({
      id: item.id,
      // commercial_model já foi resolvido na criação do item (proposta_itens.commercial_model,
      // não nulo) — usa ele diretamente, sem re-resolver (evita divergência se o catálogo mudar depois).
      commercialModel: resolverCommercialModelDoItem({
        overrideExplicito: item.commercialModel, servicoCatalogoId: item.servicoCatalogoId, catalogoDefaultMap: defaultMap,
      }),
      // A linha, depois o catálogo, depois o nome — a mesma ordem de `calcularFamiliaDoGrupo`. Sem nenhuma, a
      // linha herda a família dominante do mesmo caminho e modelo (item genérico, como "Setup") ou, não
      // havendo, o grupo vai para validação manual: nunca um palpite.
      familia: conhecida(item.familiaDaLinha) ?? conhecida(item.familiaDoCatalogo) ?? conhecida(classificarProdutoPorNome(item.nome)),
      exigeContratoDoPreco: item.catalogoPrecoId ? item.exigeContratoDoPreco : null,
      subtotal: Number(item.subtotal) || 0,
    })), {
      modoFechamento: proposta.modoFechamento,
      familiaExigeContrato: (f) => regraDaFamilia(f).exigeContrato,
    });

    const existentes = await ex.select().from(propostaGrupoComercial).where(eq(propostaGrupoComercial.propostaId, propostaId));
    for (const d of decididos) {
      let grupo = existentes.find((g) =>
        g.commercialModel === d.commercialModel && g.caminhoFechamento === d.caminho && (g.serviceFamily ?? "UNKNOWN") === d.familia);
      if (!grupo) {
        [grupo] = await ex
          .insert(propostaGrupoComercial)
          .values({
            organizacaoId: proposta.organizacaoId,
            propostaId,
            negocioId: proposta.negocioId,
            commercialModel: d.commercialModel,
            caminhoFechamento: d.caminho,
            serviceFamily: d.familia === "UNKNOWN" ? null : d.familia,
            status: d.caminho === "contrato" ? "aguardando_contrato" : "aguardando_checkout",
          })
          .returning();
        existentes.push(grupo);
      }
      // O índice único em proposta_item_id garante que uma linha nunca fica em 2 grupos.
      await ex.insert(propostaGrupoComercialItens).values(d.itensIds.map((itemId) => ({ grupoId: grupo!.id, propostaItemId: itemId })));
    }
  }

  // Todos os grupos da proposta, com as linhas de cada um.
  const grupos = await ex.select().from(propostaGrupoComercial).where(eq(propostaGrupoComercial.propostaId, propostaId)).orderBy(propostaGrupoComercial.createdAt);
  const vinculos = await ex
    .select({ grupoId: propostaGrupoComercialItens.grupoId, itemId: propostaGrupoComercialItens.propostaItemId })
    .from(propostaGrupoComercialItens)
    .where(inArray(propostaGrupoComercialItens.grupoId, grupos.map((g) => g.id)));
  const resultado: GrupoComercialRow[] = grupos
    .map((g) => ({
      id: g.id,
      commercialModel: g.commercialModel as CommercialModel,
      status: g.status as StatusGrupoComercial,
      itensIds: vinculos.filter((v) => v.grupoId === g.id).map((v) => v.itemId),
      contratoId: g.contratoId,
      checkoutId: g.checkoutId,
      caminho: (g.caminhoFechamento as CaminhoDeFechamento | null) ?? null,
      serviceFamily: g.serviceFamily,
      contratoAssinadoEm: g.contratoAssinadoEm ?? null,
      fechamentoErro: g.fechamentoErro ?? null,
    }))
    .filter((g) => g.itensIds.length > 0);

  // Propaga o modelo/grupo pra oportunidade_itens já materializados (se
  // existirem) — pra tela de negócio mostrar fulfillment por item sem
  // precisar recalcular nada.
  const [oportunidade] = proposta.negocioId
    ? await ex.select({ id: oportunidades.id }).from(oportunidades).where(eq(oportunidades.negocioIdLegado, proposta.negocioId)).limit(1)
    : [undefined];
  if (oportunidade) {
    for (const grupo of resultado) {
      await ex
        .update(oportunidadeItens)
        .set({ commercialModel: grupo.commercialModel, grupoComercialId: grupo.id, updatedAt: new Date() })
        .where(and(eq(oportunidadeItens.oportunidadeId, oportunidade.id), inArray(oportunidadeItens.propostaItemIdLegado, grupo.itensIds)));
    }
  }

  return resultado;
}

async function atualizarStatusGrupo(grupoId: string, status: StatusGrupoComercial, extra: Record<string, unknown> = {}): Promise<void> {
  await db.update(propostaGrupoComercial).set({ status, updatedAt: new Date(), ...extra }).where(eq(propostaGrupoComercial.id, grupoId));
}

export async function vincularContratoAoGrupo(grupoId: string, contratoId: string): Promise<void> {
  await atualizarStatusGrupo(grupoId, "contrato_enviado_assinatura", { contratoId });
}

/** Vincula um contrato já preparado, mantendo o grupo aguardando o aceite. */
export async function vincularContratoPreparadoAoGrupo(grupoId: string, contratoId: string): Promise<void> {
  await atualizarStatusGrupo(grupoId, "aguardando_contrato", { contratoId });
}

/**
 * Contrato assinado -> grupo avança pra aguardando_checkout (todo modelo,
 * mesmo CONTRATO_OBRIGATORIO, termina precisando de cobrança — PABX/White
 * Label agora faturam via Stripe também, não mais só manual — ver seção 10
 * do briefing). Quem decide se o checkout é automático ou manual é o
 * caller (aceitar-proposta/proposta-publica), não este módulo.
 */
export async function marcarContratoAssinadoNoGrupo(grupoId: string): Promise<void> {
  // `contrato_assinado_em` (Frente 2C.1) é o que preserva o FATO da
  // assinatura depois que o status avança pra aguardando_checkout — sem ele
  // não havia como distinguir "aguardando pagamento porque nunca precisou de
  // contrato" de "aguardando pagamento com contrato já assinado", que são
  // regras de ganho opostas.
  await atualizarStatusGrupo(grupoId, "contrato_assinado", { contratoAssinadoEm: new Date() });
  await atualizarStatusGrupo(grupoId, "aguardando_checkout");
}

/**
 * Frente 2C.1 — família sem regra clara de fechamento (UNKNOWN / produto
 * novo sem configuração). O grupo fica parado num estado explícito em vez de
 * seguir por um caminho chutado.
 */
export async function marcarAguardandoValidacaoManual(grupoId: string, motivo: string): Promise<void> {
  const [grupo] = await db.select().from(propostaGrupoComercial).where(eq(propostaGrupoComercial.id, grupoId)).limit(1);
  if (!grupo || grupo.status === "aguardando_validacao_manual") return;
  await atualizarStatusGrupo(grupoId, "aguardando_validacao_manual");
  await publicarEvento({
    organizacaoId: grupo.organizacaoId,
    eventType: "ManualValidationRequired",
    aggregateType: "grupo_comercial",
    aggregateId: grupoId,
    payload: { propostaId: grupo.propostaId, negocioId: grupo.negocioId, commercialModel: grupo.commercialModel, serviceFamily: grupo.serviceFamily, motivo },
    idempotencyKey: `manual-validation-required:${grupoId}`,
  });
}

/**
 * Frente 2C.1 — LIBERA A ENTREGA de um grupo sem exigir pagamento.
 *
 * Existe porque PABX e White Label fecham na ASSINATURA: o serviço tem que
 * ser materializado e a implantação começar mesmo com a cobrança em aberto.
 * Antes desta frente, a materialização só acontecia dentro de `concluirGrupo`
 * (caminho de pagamento) — na prática, PABX/White Label nunca chegavam a
 * gerar serviço canônico nem fulfillment sem passar pelo Stripe.
 *
 * Publica o MESMO `FulfillmentGroupCompleted` com a MESMA idempotencyKey de
 * `concluirGrupo`, de propósito: quem chegar primeiro (assinatura ou
 * pagamento) materializa, o outro é no-op real. Nunca dois serviços.
 *
 * O status do grupo NÃO vira `concluido` aqui — concluído continua
 * significando "ciclo comercial inteiro fechado, pagamento incluído". O que
 * marca a liberação é `entrega_liberada_em/por`.
 */
export async function liberarEntregaDoGrupo(grupoId: string, opts: { por: "contrato_assinado" | "pagamento_confirmado" | "manual" }): Promise<{ liberado: boolean }> {
  const [grupo] = await db.select().from(propostaGrupoComercial).where(eq(propostaGrupoComercial.id, grupoId)).limit(1);
  if (!grupo) return { liberado: false };
  if (grupo.entregaLiberadaEm) return { liberado: false }; // idempotente

  await db.transaction(async (tx) => {
    await tx.update(propostaGrupoComercial)
      .set({ entregaLiberadaEm: new Date(), entregaLiberadaPor: opts.por, updatedAt: new Date() })
      .where(eq(propostaGrupoComercial.id, grupoId));
    await publicarEvento({
      organizacaoId: grupo.organizacaoId,
      eventType: "FulfillmentGroupCompleted",
      aggregateType: "grupo_comercial",
      aggregateId: grupoId,
      payload: { propostaId: grupo.propostaId, negocioId: grupo.negocioId, commercialModel: grupo.commercialModel, serviceFamily: grupo.serviceFamily, liberadoPor: opts.por },
      idempotencyKey: `fulfillment-group-completed:${grupoId}`,
    }, tx);
  });
  return { liberado: true };
}

/** Frente 2C.1 — estado do pagamento do grupo, independente do status de fulfillment. */
export async function registrarPagamentoDoGrupo(grupoId: string, status: "pendente" | "confirmado" | "falhou", opts: { venceEm?: Date | null; confirmadoEm?: Date | null } = {}): Promise<void> {
  await db.update(propostaGrupoComercial).set({
    pagamentoStatus: status,
    ...(opts.venceEm !== undefined ? { pagamentoVenceEm: opts.venceEm } : {}),
    ...(status === "confirmado" ? { pagamentoConfirmadoEm: opts.confirmadoEm ?? new Date() } : {}),
    updatedAt: new Date(),
  }).where(eq(propostaGrupoComercial.id, grupoId));
}

export async function vincularCheckoutAoGrupo(grupoId: string, checkoutId: string): Promise<void> {
  await atualizarStatusGrupo(grupoId, "checkout_gerado", { checkoutId });
}

export async function marcarPagamentoPendenteNoGrupo(grupoId: string): Promise<void> {
  await atualizarStatusGrupo(grupoId, "pagamento_pendente", { pagamentoStatus: "pendente" });
}

export async function marcarPagamentoFalhouNoGrupo(grupoId: string): Promise<void> {
  await atualizarStatusGrupo(grupoId, "falhou", { pagamentoStatus: "falhou" });
}

/**
 * Pagamento confirmado -> grupo concluído. Publica FulfillmentGroupCompleted
 * no Event Outbox NA MESMA TRANSAÇÃO da mudança de status (ADR-EXEC-021,
 * resiliência): o consumer real (consumer.ts) é quem materializa/atualiza
 * o serviço canônico, de forma idempotente e com retry — nunca uma chamada
 * best-effort inline que, se falhar, perde o fato comercial silenciosamente.
 */
export async function concluirGrupo(grupoId: string): Promise<void> {
  const [grupo] = await db.select().from(propostaGrupoComercial).where(eq(propostaGrupoComercial.id, grupoId)).limit(1);
  if (!grupo || grupo.status === "concluido") return; // idempotente — retry não duplica evento

  const agora = new Date();
  await db.transaction(async (tx) => {
    await tx.update(propostaGrupoComercial).set({
      status: "concluido",
      concluidoEm: agora,
      // Frente 2C.1: pagamento confirmado é o que conclui o grupo, e conclusão
      // implica entrega liberada. `entregaLiberadaEm` só é setado se ainda não
      // existia (num PABX ela foi liberada antes, na assinatura — não
      // sobrescreve a data real do fato anterior).
      pagamentoStatus: "confirmado",
      pagamentoConfirmadoEm: grupo.pagamentoConfirmadoEm ?? agora,
      entregaLiberadaEm: grupo.entregaLiberadaEm ?? agora,
      entregaLiberadaPor: grupo.entregaLiberadaPor ?? "pagamento_confirmado",
      updatedAt: agora,
    }).where(eq(propostaGrupoComercial.id, grupoId));
    await publicarEvento({
      organizacaoId: grupo.organizacaoId,
      eventType: "FulfillmentGroupCompleted",
      aggregateType: "grupo_comercial",
      aggregateId: grupoId,
      payload: { propostaId: grupo.propostaId, negocioId: grupo.negocioId, commercialModel: grupo.commercialModel, serviceFamily: grupo.serviceFamily, liberadoPor: grupo.entregaLiberadaPor ?? "pagamento_confirmado" },
      idempotencyKey: `fulfillment-group-completed:${grupoId}`,
    }, tx);
  });
}

/** Todos os grupos de uma proposta/negócio, pra exibir fulfillment por composição na tela. */
export async function listarGruposDoNegocio(negocioId: string) {
  return db.select().from(propostaGrupoComercial).where(eq(propostaGrupoComercial.negocioId, negocioId)).orderBy(propostaGrupoComercial.createdAt);
}
