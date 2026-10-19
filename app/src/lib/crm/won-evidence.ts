/**
 * F4 (Commercial) — Commercial Evidence Policy.
 *
 * Achado real (09/08, revisão do Kauã sobre o relatório de duplicidade):
 * Won não pode ficar acoplado só ao Stripe — `if (stripeSubscription) won
 * = true` não escala pra PBX/venda manual, que fatura fora do Stripe.
 *
 * Arquitetura: toda evidência de fechamento vira um registro em
 * `comercial_evidencia` (tipado, com origem e quem verificou). Uma
 * POLÍTICA (`won_evidence_policies`, por org × produto) decide quais tipos
 * de evidência são aceitos pra considerar um negócio "ganho". O gate de
 * Won (negocios.ts) não sabe nada de Stripe/contrato — só pergunta "esse
 * negócio tem evidência válida conforme a política do produto dele?".
 *
 * Isto NÃO decide a regra de negócio de qual evidência vale pra qual
 * produto (isso é calibração comercial, registrada em
 * crm2-decisoes-pendentes.md) — só constrói a arquitetura extensível e
 * aplica um default conservador alinhado aos gates atuais: pagamento
 * confirmado para pagamento direto; contrato assinado E pagamento confirmado
 * quando existe contrato. Contrato sozinho nunca libera Won.
 *
 * Ver ADR-EXEC-012 em ARCHITECTURE_DECISIONS.md.
 */
import { db } from "@/lib/db";
import { garantirEmpresaDoNegocio, registrarGanhoSemEmpresa, FRASE_GANHO_SEM_EMPRESA } from "@/lib/vendas/empresa-do-negocio";
import { decidirGanhoPelaOferta, propagarGanhoCanonico } from "@/lib/vendas/ponte-ganho";
import { comercialEvidencia, wonEvidencePolicies, negocios, propostas, contratos, auditLog, leads, statusChanges, oportunidadeItens, oportunidades, clientes, atividades } from "@/lib/db/schema";
import { eq, and, or, isNull } from "drizzle-orm";
import { publicarEvento } from "@/lib/events/outbox";
import { valoresFechadosDoGanho } from "@/lib/crm/regras-pos-ganho";

export type TipoEvidenciaComercial =
  | "stripe_payment"
  | "stripe_subscription"
  | "signed_contract"
  | "manual_contract"
  | "admin_approval"
  // Correção de escopo (19/08) — via de exceção auditada pra venda que não
  // passa por Stripe/proposta/contrato formal (ex: PABX legado/negociação
  // fora do fluxo padrão). Só nasce via registrarEvidenciaManual (admin,
  // sempre audit-logada) — nunca automática.
  | "financial_attestation";

/** Tipos possíveis do default; a combinação real é resolvida por existência de contrato. */
const POLICY_DEFAULT: TipoEvidenciaComercial[] = ["signed_contract", "stripe_subscription", "stripe_payment"];

/**
 * Registra uma evidência comercial pra um negócio. Idempotente por
 * (negocioId, tipo, sourceRef) — chamar de novo com a mesma origem não
 * duplica. `verificadoPor=null` significa evidência automática do sistema
 * (ex: contrato criado via aceite de proposta); presente = ação humana.
 */
export async function registrarEvidencia(opts: {
  negocioId: string;
  organizacaoId: string;
  tipo: TipoEvidenciaComercial;
  sourceRef?: string | null;
  metadata?: Record<string, unknown>;
  verificadoPor?: string | null;
  /** Commercial Core v2 (ADR-EXEC-021) — a que grupo comercial esta evidência pertence (venda mista tem evidência por grupo). */
  grupoComercialId?: string | null;
}): Promise<void> {
  try {
    await db
      .insert(comercialEvidencia)
      .values({
        negocioId: opts.negocioId,
        organizacaoId: opts.organizacaoId,
        tipo: opts.tipo,
        sourceRef: opts.sourceRef ?? null,
        metadata: opts.metadata ?? {},
        verificadoPor: opts.verificadoPor ?? null,
        grupoComercialId: opts.grupoComercialId ?? null,
      })
      .onConflictDoNothing();
  } catch (err) {
    console.error(`[won-evidence] falha ao registrar evidência (best-effort) negocio=${opts.negocioId}:`, err);
  }
}

async function getPolicyAplicavel(organizacaoId: string, produto: string | null): Promise<{ tiposAceitos: TipoEvidenciaComercial[]; requiredCombinations: TipoEvidenciaComercial[][] | null; isDefault: boolean }> {
  const rows = await db
    .select({ produto: wonEvidencePolicies.produto, tiposAceitos: wonEvidencePolicies.tiposAceitos, requiredCombinations: wonEvidencePolicies.requiredCombinations })
    .from(wonEvidencePolicies)
    .where(and(eq(wonEvidencePolicies.organizacaoId, organizacaoId), eq(wonEvidencePolicies.ativo, true), or(isNull(wonEvidencePolicies.produto), produto ? eq(wonEvidencePolicies.produto, produto) : undefined)));

  if (rows.length === 0) return { tiposAceitos: POLICY_DEFAULT, requiredCombinations: null, isDefault: true };
  // política específica do produto tem prioridade sobre a catch-all (produto=null)
  const especifica = rows.find((r) => r.produto === produto);
  const catchAll = rows.find((r) => r.produto === null);
  const escolhida = especifica ?? catchAll;
  return {
    tiposAceitos: (escolhida?.tiposAceitos as TipoEvidenciaComercial[]) ?? POLICY_DEFAULT,
    requiredCombinations: (escolhida?.requiredCombinations as TipoEvidenciaComercial[][] | null) ?? null,
    isDefault: false,
  };
}

/**
 * Avalia se um negócio tem evidência comercial válida (conforme a política
 * do produto dele) pra ser marcado como "ganho". Se não houver NENHUMA
 * evidência registrada ainda (negócio criado antes desta arquitetura
 * existir), cai no fallback legado (proposta aceita OU contrato existente)
 * — e, se passar, registra a evidência retroativamente (self-healing, sem
 * precisar de script de backfill em massa).
 */
export async function avaliarEvidenciaWon(negocioId: string, organizacaoId: string, produto: string | null): Promise<{ permitido: boolean; evidencias: TipoEvidenciaComercial[]; motivo: string }> {
  // CUTOVER (fase 16): quando o negócio já tem oportunidade canônica com
  // oferta, quem decide é a política da OFERTA, não a família do produto. Este
  // é o ponto único por onde todos os caminhos de Ganho passam — rota, webhook
  // do Stripe, webhook do Documenso, worker e script. Ver `ponte-ganho.ts`.
  const pelaOferta = await decidirGanhoPelaOferta(negocioId);
  if (pelaOferta.aplicavel) {
    const evidenciasDaOferta = await db
      .select({ tipo: comercialEvidencia.tipo })
      .from(comercialEvidencia)
      .where(eq(comercialEvidencia.negocioId, negocioId));
    return {
      permitido: Boolean(pelaOferta.permitido),
      evidencias: evidenciasDaOferta.map((e) => e.tipo as TipoEvidenciaComercial),
      motivo: pelaOferta.motivo ?? "política da oferta",
    };
  }

  const { tiposAceitos, requiredCombinations, isDefault } = await getPolicyAplicavel(organizacaoId, produto);

  const evidenciasExistentes = await db
    .select({ tipo: comercialEvidencia.tipo })
    .from(comercialEvidencia)
    .where(eq(comercialEvidencia.negocioId, negocioId));

  const tiposEncontrados = evidenciasExistentes.map((e) => e.tipo as TipoEvidenciaComercial);

  // Default sem política explícita: contrato define o gate. Isso impede que
  // o fallback histórico transforme proposta aceita/contrato pendente em Won.
  // `stripe_subscription` conta como pagamento confirmado somente porque é
  // gravado pelo webhook de Checkout com payment_status=paid.
  if (isDefault) {
    const pagamentoConfirmado = tiposEncontrados.includes("stripe_payment") || tiposEncontrados.includes("stripe_subscription");
    const contratoAssinado = tiposEncontrados.includes("signed_contract");
    const contratosDoNegocio = await db.select({ id: contratos.id }).from(contratos).where(eq(contratos.negocioId, negocioId)).limit(1);
    const exigeContrato = contratosDoNegocio.length > 0;
    if (tiposEncontrados.includes("financial_attestation")) {
      return { permitido: true, evidencias: ["financial_attestation"], motivo: "exceção financeira/legado registrada por usuário autorizado" };
    }
    if (pagamentoConfirmado && (!exigeContrato || contratoAssinado)) {
      return {
        permitido: true,
        evidencias: exigeContrato ? ["signed_contract", "stripe_payment"] : ["stripe_payment"],
        motivo: exigeContrato ? "contrato assinado e pagamento confirmado" : "pagamento confirmado",
      };
    }
    return {
      permitido: false,
      evidencias: tiposEncontrados.filter((tipo) => tiposAceitos.includes(tipo)),
      motivo: exigeContrato ? "contrato assinado e pagamento confirmado são obrigatórios" : "pagamento confirmado é obrigatório",
    };
  }

  // Política com combinação explícita (OR-de-AND): precisa de TODAS as
  // evidências de PELO MENOS uma combinação — uma evidência isolada não
  // basta quando o fluxo exige mais de uma junto (ex: contrato + pagamento).
  if (requiredCombinations && requiredCombinations.length > 0) {
    for (const combinacao of requiredCombinations) {
      if (combinacao.length > 0 && combinacao.every((t) => tiposEncontrados.includes(t))) {
        return { permitido: true, evidencias: combinacao, motivo: "combinação de evidências exigida pela política satisfeita" };
      }
    }
    // Combinação configurada e não satisfeita: não cai no fallback legado
    // (fallback é OR simples — reintroduziria exatamente o risco que a
    // combinação existe pra evitar).
    return { permitido: false, evidencias: tiposEncontrados.filter((t) => tiposAceitos.includes(t)), motivo: "nenhuma combinação de evidências exigida pela política foi satisfeita" };
  }

  const valida = tiposEncontrados.filter((t) => tiposAceitos.includes(t));
  if (valida.length > 0) {
    return { permitido: true, evidencias: valida, motivo: "evidência registrada" };
  }

  // Fallback legado, só para negócios que nunca passaram por um ponto que registra evidência
  // explicitamente: um contrato JÁ ASSINADO conta como `signed_contract`.
  //
  // Aqui NÃO existe mais o atalho "proposta aceita". Ele registrava `signed_contract` a partir do ACEITE
  // (status 'aceita' sem contrato pendente), isto é, tratava o "sim" do cliente como evidência de
  // fechamento — exatamente o que o Bloco 03 §26 e o Scott proíbem: aceite NÃO é ganho. Ganho vem da
  // evidência (contrato assinado ou pagamento confirmado), decidida pela política da oferta. O mesmo vale
  // para o contrato: só 'assinado' e 'aceite_simples' são assinatura; 'pendente', 'recusado', 'cancelado' e
  // 'expirado' não são (o critério antigo, "diferente de pendente", deixava os três últimos passarem).
  const [contratoExistente] = await db.select({ id: contratos.id, assinaturaStatus: contratos.assinaturaStatus })
    .from(contratos).where(and(eq(contratos.negocioId, negocioId), or(eq(contratos.assinaturaStatus, "assinado"), eq(contratos.assinaturaStatus, "aceite_simples")))).limit(1);
  if (contratoExistente) {
    await registrarEvidencia({ negocioId, organizacaoId, tipo: "signed_contract", sourceRef: contratoExistente.id, metadata: { origem: "fallback_legado_contrato_assinado" } });
    if (tiposAceitos.includes("signed_contract")) return { permitido: true, evidencias: ["signed_contract"], motivo: "contrato assinado (fallback legado)" };
  }

  return { permitido: false, evidencias: [], motivo: "nenhuma evidência comercial válida encontrada" };
}

/**
 * Evidência anexada manualmente por um humano (admin/gerente) — a via
 * pra PBX/venda manual (não passa por Stripe nem proposta). Sempre grava
 * em audit_log (nunca silenciosa, guardrail explícito do blueprint).
 * Calibração ainda pendente (ex: exigir dupla aprovação?) — registrada em
 * crm2-decisoes-pendentes.md, não decidida aqui. Default atual: uma única
 * aprovação de admin/gerente já é suficiente, reversível (é só um registro,
 * pode ser corrigido/adicionado outro depois).
 */
export async function registrarEvidenciaManual(opts: {
  negocioId: string;
  organizacaoId: string;
  tipo: "manual_contract" | "admin_approval" | "financial_attestation";
  usuarioId: string;
  nota: string;
}): Promise<void> {
  await registrarEvidencia({
    negocioId: opts.negocioId,
    organizacaoId: opts.organizacaoId,
    tipo: opts.tipo,
    sourceRef: opts.usuarioId,
    metadata: { nota: opts.nota },
    verificadoPor: opts.usuarioId,
  });
  await db.insert(auditLog).values({
    organizacaoId: opts.organizacaoId,
    actorId: opts.usuarioId,
    action: "negocio.evidencia_manual_anexada",
    entityType: "negocio",
    entityId: opts.negocioId,
    after: { tipo: opts.tipo, nota: opts.nota },
    source: "api",
  });
}

/** Lê o produto de um negócio a partir de campos_custom (não é coluna direta hoje). */
/**
 * Correção 19/08 (chave real do Won-gate): a chave histórica
 * (`negocios.campos_custom.produto`) só tem 2 valores reais em produção
 * ("ai"/"ai_pabx") — não dá pra expressar PABX_STANDARD/WHITE_LABEL_STANDARD
 * como políticas próprias com essa granularidade. Quando o negócio tem
 * itens reais do Commercial Core v2 (`oportunidade_itens`, via
 * `oportunidades.negocio_id_legado`) com família classificada, essa é a
 * chave real (PABX|CALLFACE_AI|WHITE_LABEL) — sempre prioridade sobre o
 * campo legado. Sem isso, cai no campo legado (compat, nenhuma política
 * existente quebra).
 */
export async function getProdutoNegocio(negocioId: string): Promise<string | null> {
  const itensReais = await db
    .select({ serviceFamily: oportunidadeItens.serviceFamily })
    .from(oportunidadeItens)
    .innerJoin(oportunidades, eq(oportunidades.id, oportunidadeItens.oportunidadeId))
    .where(eq(oportunidades.negocioIdLegado, negocioId));
  const familiasReais = new Set(itensReais.map((i) => i.serviceFamily).filter((f) => f && f !== "UNKNOWN"));
  if (familiasReais.size === 1) return [...familiasReais][0];

  const [row] = await db.select({ camposCustom: negocios.camposCustom }).from(negocios).where(eq(negocios.id, negocioId)).limit(1);
  const produto = (row?.camposCustom as Record<string, unknown> | null)?.produto;
  return typeof produto === "string" ? produto : null;
}

/**
 * Commercial Core v2 (ADR-EXEC-021) — ponto ÚNICO que marca um negócio como
 * ganho a partir de evidência real (chamado por: assinatura de contrato,
 * confirmação de pagamento Stripe). Centraliza o que antes estava
 * duplicado em 3 lugares (aceitar-proposta.ts, proposta-publica.ts,
 * negocios.ts) — mesma regra sempre: Won dispara na PRIMEIRA evidência
 * válida de QUALQUER grupo comercial da oportunidade, não espera todos os
 * grupos concluírem (uma venda mista com AI pago e PABX ainda em contrato
 * já é um negócio "ganho" no sentido comercial/pipeline — o que falta é
 * FULFILLMENT dos demais grupos, rastreado à parte em
 * proposta_grupo_comercial.status, não no status do negócio). Idempotente.
 */
export async function marcarNegocioGanhoSeAindaNao(
  negocioId: string,
  organizacaoId: string,
  /**
   * Frente 2C.1 — família comercial já resolvida por quem disparou o Won (o
   * grupo comercial que assinou/pagou). Necessário, não decorativo: medido no
   * banco real, `getProdutoNegocio` NÃO consegue resolver família pra nenhum
   * dos 1.425 negócios existentes (o dual-write de `oportunidade_itens` só
   * cobriu 7), então sem esta dica toda avaliação cairia no produto legado
   * (`ai`/`ai_pabx`), que não tem política de família nenhuma — e PABX/White
   * Label voltariam a exigir pagamento pra fechar.
   */
  opts: { familiaHint?: string | null } = {},
): Promise<{ pendenciaEmpresa?: string }> {
  const [negocio] = await db.select().from(negocios).where(eq(negocios.id, negocioId)).limit(1);
  if (!negocio || negocio.status === "ganho") return {};

  const familiaHint = opts.familiaHint && opts.familiaHint !== "UNKNOWN" ? opts.familiaHint : null;
  const produto = familiaHint ?? (await getProdutoNegocio(negocioId));
  const evidencia = await avaliarEvidenciaWon(negocioId, organizacaoId, produto);
  if (!evidencia.permitido) return {};

  /*
   * Ganho PRECISA de empresa: Cliente 360, serviço canônico, conta de CS e implantação dependem dela, e foi
   * assim que 150 ganhos nasceram órfãos. Resolve pela regra única (lead, oportunidade, CNPJ, domínio, nome),
   * criando a partir do lead quando não houver.
   *
   * ESTE caminho é o AUTOMÁTICO (pagamento no Stripe, contrato assinado). Aqui o ganho acontece MESMO sem
   * empresa: o dinheiro já entrou, e segurar o Ganho faria uma venda paga sumir do faturamento e da meta —
   * pior do que o pós-venda atrasar. A pendência não some: vira caso aberto e log de erro, e o backfill de
   * empresa resolve depois. Quem BLOQUEIA é o caminho manual (`tentarGanhar`, PATCH do negócio), onde há uma
   * pessoa na tela que consegue vincular a empresa na hora.
   */
  const empresa = await garantirEmpresaDoNegocio(organizacaoId, negocioId);
  let pendenciaEmpresa: string | undefined;
  if (empresa.ok) {
    negocio.empresaId = empresa.empresaId;
  } else {
    console.error(`[won-evidence] negócio ${negocioId} ganho SEM empresa (${empresa.motivo}) — pós-venda fica pendente`);
    await registrarGanhoSemEmpresa(organizacaoId, negocioId, empresa.motivo, empresa.pista)
      .catch((e) => console.error("[won-evidence] caso GANHO_SEM_EMPRESA não gravado:", e));
    pendenciaEmpresa = FRASE_GANHO_SEM_EMPRESA;
  }

  const deStatus = negocio.status;
  // `etapa` junto com `status`: o board lê a etapa, e só `tentarGanhar` a gravava.
  // Ganho por pagamento ou contrato assinado (o caminho de PABX/White Label) ficava
  // com status 'ganho' e card parado em Proposta, e o total da coluna Ganho não o contava.
  // `mrr_fechado` e `valor_setup` são o que o faturamento do mês, a meta e o placar do vendedor somam.
  // Só o PATCH manual os preenchia: ganho por pagamento ou contrato assinado valia R$ 0 em todo número.
  // Preenche a partir do que as propostas já somaram no negócio, sem sobrescrever valor digitado.
  const valoresFechados = valoresFechadosDoGanho(negocio);
  await db.update(negocios).set({ status: "ganho", etapa: "ganho", etapaDesde: new Date(), ganhoAt: new Date(), updatedAt: new Date(), ...valoresFechados }).where(eq(negocios.id, negocioId));
  // O board lê `oportunidades`: o espelho acompanha. Best-effort, o ganho já está gravado.
  await import("@/lib/crm/sync-domain-model")
    .then((m) => m.syncOportunidadeFromNegocio(negocioId))
    .catch((e) => console.error("[won-evidence] espelho do ganho falhou:", e));

  await db.insert(statusChanges).values({
    leadId: negocio.leadId, negocioId, deStatus, paraStatus: "ganho", motivo: "Evidência comercial confirmada",
  });

  await aplicarEfeitosPosGanho({
    negocio,
    organizacaoId,
    produto,
    familiaHint,
    evidencias: evidencia.evidencias,
    motivo: evidencia.motivo,
  });
  return pendenciaEmpresa ? { pendenciaEmpresa } : {};
}

/**
 * Tudo que acontece DEPOIS de um negócio virar ganho, num lugar só.
 *
 * Existe porque o Won tem dois gatilhos legítimos e eles divergiram (achado
 * 14/09): o automático (`marcarNegocioGanhoSeAindaNao`, chamado por pagamento
 * confirmado e por contrato assinado) e o manual (`PATCH /api/negocios/:id`
 * com status "ganho", usado quando a venda fecha fora do fluxo de proposta).
 * O manual promovia o lead e publicava os eventos, mas não registrava a
 * atividade na timeline, não materializava Pessoa e — o mais grave — não
 * colocava o cliente na carteira do CS. Um cliente fechado na mão
 * simplesmente não existia pro pós-venda.
 *
 * Também corrige um defeito que os DOIS caminhos tinham: a linha em `clientes`
 * nunca era criada aqui, só atualizada quando já existisse. Quem criava era
 * `garantirContaCs`, acionado por `CanonicalServiceActivated` — que só nasce
 * quando existe grupo comercial materializado. Venda manual não gera grupo, e
 * portanto nunca gerava conta de CS.
 *
 * Idempotente e best-effort por etapa: nada aqui desfaz o ganho já registrado.
 */
export async function aplicarEfeitosPosGanho(opts: {
  negocio: typeof negocios.$inferSelect;
  organizacaoId: string;
  produto: string | null;
  familiaHint?: string | null;
  evidencias: TipoEvidenciaComercial[] | string[];
  motivo: string;
  contratoId?: string | null;
}): Promise<void> {
  const { negocio, organizacaoId, produto, motivo } = opts;
  const familiaHint = opts.familiaHint ?? null;
  const negocioId = negocio.id;

  // A família fica GRAVADA no negócio e na oportunidade no momento do Ganho (UNKNOWN quando nada diz),
  // em vez de cada leitor adivinhar depois. Não bloqueia nem desfaz o Ganho.
  const { gravarFamiliaDoGanho } = await import("@/lib/crm/gravar-familia");
  await gravarFamiliaDoGanho({ negocioId, organizacaoId, familiaHint });

  // CUTOVER (fase 16): o mesmo Ganho no modelo canônico — marca a
  // oportunidade, publica o evento de domínio e cria serviço e jornadas pela
  // oferta. Best-effort: o legado já fechou a venda.
  void propagarGanhoCanonico(negocioId);

  // O ganho passa a existir na TIMELINE, não só em status_changes.
  if (negocio.leadId) {
    await db.insert(atividades).values({
      organizacaoId,
      leadId: negocio.leadId,
      negocioId,
      tipo: "negocio_ganho",
      titulo: "Negócio ganho",
      descricao: `Fechamento confirmado: ${motivo}.`,
      dados: { produto, familiaHint, evidencias: opts.evidencias, motivo, contratoId: opts.contratoId ?? null },
    }).catch((e) => console.error("[won-evidence] falha ao registrar atividade de ganho (best-effort):", e));

    await db.update(leads).set({ tipo: "cliente", clienteDesde: new Date(), updatedAt: new Date() }).where(eq(leads.id, negocio.leadId));

    try {
      const { syncPessoaFromLead } = await import("@/lib/crm/sync-domain-model");
      await syncPessoaFromLead(negocio.leadId);
    } catch (err) {
      console.error(`[won-evidence] falha ao materializar pessoa do lead ${negocio.leadId} (best-effort):`, err);
    }
  }

  // Entrada na carteira do CS. Acontece no Won, com ou sem serviço canônico —
  // o serviço, quando existir, reforça por CanonicalServiceActivated (idempotente).
  if (negocio.empresaId) {
    try {
      const { garantirContaCsPorEmpresa } = await import("@/lib/cs/handoff");
      const { criada } = await garantirContaCsPorEmpresa({
        organizacaoId,
        empresaId: negocio.empresaId,
        leadId: negocio.leadId,
        entrouEm: negocio.ganhoAt ?? new Date(),
      });
      if (criada) console.log(`[won-evidence] conta de CS criada para a empresa ${negocio.empresaId} (negócio ${negocioId})`);
    } catch (err) {
      console.error(`[won-evidence] falha ao criar conta de CS da empresa ${negocio.empresaId} (best-effort):`, err);
    }
  } else {
    // Sem empresa não há conta de CS possível — e isso é um gap de dado real,
    // não um caso de sucesso silencioso.
    console.warn(`[won-evidence] negócio ${negocioId} ganho sem empresa vinculada — não entrou na carteira do CS`);
  }

  // Cache de leitura da Carteira, para contas que já existiam sem status.
  if (negocio.empresaId || negocio.leadId) {
    const filtro = negocio.empresaId ? eq(clientes.empresaId, negocio.empresaId) : eq(clientes.leadIdLegado, negocio.leadId!);
    await db.update(clientes).set({ statusFinanceiro: "ativo", updatedAt: new Date() })
      .where(and(filtro, isNull(clientes.statusFinanceiro)))
      .catch((e) => console.error("[won-evidence] falha ao atualizar status financeiro (best-effort):", e));
  }

  const { notificarNegocioGanho } = await import("@/lib/crm/notificar");
  await notificarNegocioGanho(negocioId).catch((e) => console.error("[won-evidence] falha ao notificar negócio ganho (best-effort):", e));

  // Valor do ganho para a Meta (conversão `OpportunityWon`): mensalidade + setup
  // FECHADOS, lidos agora porque o `negocio` recebido pode ser anterior ao Ganho.
  const [fechado] = await db.select({ mrr: negocios.mrrFechado, setup: negocios.valorSetup }).from(negocios).where(eq(negocios.id, negocioId)).limit(1);
  const valorDoGanho = Number(fechado?.mrr ?? 0) + Number(fechado?.setup ?? 0);

  await publicarEvento({
    organizacaoId, eventType: "DealWon", aggregateType: "negocio", aggregateId: negocioId,
    payload: { leadId: negocio.leadId, empresaId: negocio.empresaId, contratoId: opts.contratoId ?? null, produto, familiaHint, evidencias: opts.evidencias, motivo, valor: valorDoGanho > 0 ? valorDoGanho : null },
    idempotencyKey: `deal-won:${negocioId}`,
  });
  if (negocio.leadId) {
    await publicarEvento({
      organizacaoId, eventType: "CustomerCreated", aggregateType: "lead", aggregateId: negocio.leadId,
      payload: { negocioId, empresaId: negocio.empresaId, contratoId: opts.contratoId ?? null },
      idempotencyKey: `customer-created:${negocioId}`,
    });
  }
}
