/**
 * Motor do Pipeline / Oportunidades (Bloco 02).
 *
 * Oportunidade é um processo comercial real aberto com uma Empresa para vender
 * UMA família de serviço. Ela mora na tabela `negocios`, que continua sendo
 * lida por financeiro, contratos e relatórios; o vocabulário novo vive na
 * coluna `etapa` e a tradução para `status` é feita aqui, num lugar só.
 *
 * As regras que este arquivo existe para garantir, todas da spec:
 *   - Empresa é obrigatória; Família pode começar como "a definir" em Entrada,
 *     mas é obrigatória antes de proposta, contrato, checkout ou ganho (§1, §5);
 *   - duas famílias criam duas oportunidades irmãs, nunca uma genérica (§2-3);
 *   - reunião, trial e no-show são eventos, nunca etapa (§10-12);
 *   - Proposta e Negociação têm gate de proposta vinculada (§10);
 *   - Ganho nunca é drag: é consequência de evidência (§19-20).
 */
import { resolverNomes } from "./resolver-ids";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { registrarEvento, registrarMudancaDeEtapa } from "./eventos";
import { encerrarAquisicaoConvertida } from "./sincronizar-aquisicao";
import { publicarEvento } from "@/lib/events/outbox";
import {
  ehFamiliaValida, RegraDeNegocio, ROTULO_FAMILIA, STATUS_LEGADO_DA_ETAPA,
  type Ator, type EtapaPipeline, type EtapaPipelineAberta, type Familia,
  MOTIVOS_PERDA, type Motion, type MotivoEstagnacao, type MotivoPerda, type ProcessoOrigem, ROTULO_ETAPA_PIPELINE } from "./dominio";

/* ── Leitura de apoio ──────────────────────────────────────────────────── */

interface OportunidadeInterna extends Record<string, unknown> {
  id: string;
  organizacao_id: string;
  titulo: string;
  etapa: EtapaPipeline | null;
  status: string;
  empresa_id: string | null;
  lead_id: string | null;
  /** Família RESOLVIDA: legado quando existe, canônica quando o legado é nulo. */
  service_family: string | null;
  /**
   * Família gravada no negócio legado, sem a dedução.
   *
   * Existe porque `alterarFamilia` compara para decidir se há o que mudar. Se
   * comparasse contra a resolvida, escolher a família que o canônico já deduziu
   * viraria um no-op silencioso e o legado ficaria nulo para sempre.
   */
  service_family_proprio: string | null;
  responsavel_id: string | null;
  bundle_id: string | null;
  propostas_vinculadas: number;
}

async function carregarOportunidade(organizacaoId: string, negocioId: string): Promise<OportunidadeInterna> {
  const [op] = await db.execute<OportunidadeInterna>(sql`
    SELECT n.id::text, n.organizacao_id::text, n.titulo, n.etapa, n.status,
           n.empresa_id::text, n.lead_id::text,
           -- A familia resolvida alimenta os GATES, e isso nao e cosmetico.
           --
           -- Mover para Proposta ou Negociacao exige familia valida, e
           -- negocios.service_family e NULL em 526 dos negocios abertos. Em 125
           -- deles a oportunidade canonica sabe qual e, deduzida no backfill: a
           -- etapa ficava bloqueada por um dado que o sistema tem.
           COALESCE(n.service_family, o.service_family) AS service_family,
           n.service_family AS service_family_proprio,
           n.responsavel_id::text, n.bundle_id::text,
           (SELECT count(*)::int FROM propostas p WHERE p.negocio_id = n.id) AS propostas_vinculadas
      FROM negocios n
      LEFT JOIN oportunidades o ON o.negocio_id_legado = n.id
     WHERE n.id = ${negocioId}::uuid AND n.organizacao_id = ${organizacaoId}::uuid
  `);
  if (!op) throw new RegraDeNegocio("oportunidade_nao_encontrada", "Oportunidade não encontrada.");
  return op;
}

/* ── Criação (Bloco 02 §5-8) ───────────────────────────────────────────── */

export interface CriarOportunidade {
  organizacaoId: string;
  /** Obrigatória. Bloco 02 §29: oportunidade sem Empresa é proibida. */
  empresaId: string;
  /** Vazia significa "Família a definir". Duas ou mais criam irmãs no mesmo bundle. */
  familias: Familia[];
  responsavelId: string;
  sourceProcess: ProcessoOrigem;
  leadId?: string | null;
  pessoaId?: string | null;
  motion?: Motion;
  titulo?: string | null;
  valorEstimado?: string | null;
  previsaoFechamento?: string | null;
  proximaAcao?: string | null;
  proximaAcaoEm?: string | null;
  /** Agendar reunião junto. Bloco 02 §6: reunião NÃO é requisito. */
  reuniao?: { data: string; duracao?: number; tipo?: "call" | "presencial" | "video"; titulo?: string; notas?: string; closerId?: string } | null;
  servicoOrigemId?: string | null;
  /** upgrade | downgrade | crosssell | expansao | renovacao: decide, no Ganho, se o serviço soma, substitui ou renova. */
  tipoVenda?: string | null;
}

export interface OportunidadeCriada {
  oportunidades: Array<{ id: string; familia: Familia | null; titulo: string }>;
  bundleId: string | null;
  reuniaoId: string | null;
  /** Convite que não saiu (sem Outlook, token expirado…): a tela mostra, a reunião segue salva. */
  reuniaoAviso?: string | null;
}

/**
 * Cria a oportunidade (ou as oportunidades irmãs).
 *
 * Bloco 02 §2-3: uma oportunidade pertence a exatamente uma família. Duas
 * famílias selecionadas viram DUAS oportunidades com o mesmo `bundleId`,
 * compartilhando empresa, contato e origem, mas com ciclo comercial e
 * fechamento independentes. Criar uma única oportunidade "genérica" para as
 * duas está na lista de proibições.
 *
 * Nasce sempre em `entrada`, com ou sem reunião. Bloco 02 §10: "Entrada não
 * significa reunião agendada" — e era exatamente isso que o conversor antigo
 * gravava, ao pôr `reuniao_agendada` mesmo no caminho sem reunião.
 */
export async function criarOportunidade(entrada: CriarOportunidade, ator: Ator): Promise<OportunidadeCriada> {
  if (!entrada.empresaId) {
    throw new RegraDeNegocio("oportunidade_exige_empresa", "Toda oportunidade precisa de uma Empresa.");
  }
  const familias = [...new Set(entrada.familias)];
  for (const familia of familias) {
    if (!ehFamiliaValida(familia)) {
      throw new RegraDeNegocio("familia_invalida", `Família inválida: ${familia}.`);
    }
  }
  if (!entrada.responsavelId) {
    throw new RegraDeNegocio("oportunidade_exige_responsavel", "Escolha o responsável comercial.");
  }

  const [empresa] = await db.execute<{ id: string; nome: string }>(sql`
    SELECT id::text, nome FROM empresas
     WHERE id = ${entrada.empresaId}::uuid AND organizacao_id = ${entrada.organizacaoId}::uuid
  `);
  if (!empresa) throw new RegraDeNegocio("empresa_nao_encontrada", "Empresa não encontrada.");

  // Bundle só existe quando há irmãs de verdade. Bundle de uma oportunidade
  // só seria ruído: ele agrega, não é status nem container.
  let bundleId: string | null = null;
  if (familias.length > 1) {
    const [bundle] = await db.execute<{ id: string }>(sql`
      INSERT INTO oportunidade_bundle (organizacao_id, nome, lead_id, empresa_id)
      VALUES (${entrada.organizacaoId}::uuid, ${`${empresa.nome} — Nova venda`},
              ${entrada.leadId ?? null}::uuid, ${entrada.empresaId}::uuid)
      RETURNING id::text
    `);
    bundleId = bundle.id;
  }

  const [pipelinePadrao] = await db.execute<{ id: string }>(sql`
    SELECT id::text FROM pipelines
     WHERE organizacao_id = ${entrada.organizacaoId}::uuid AND ativo = true
     ORDER BY is_default DESC LIMIT 1
  `);

  const motion: Motion = entrada.motion
    ?? (entrada.sourceProcess === "EXPANSION" ? "EXPANSION" : "NEW_BUSINESS");

  const familiasParaCriar: Array<Familia | null> = familias.length > 0 ? familias : [null];
  const criadas: Array<{ id: string; familia: Familia | null; titulo: string }> = [];

  for (const familia of familiasParaCriar) {
    // Bloco 02 §8: nome gerado como {Empresa} — {Família}. Só respeita um
    // título manual quando há uma família só; com irmãs, um título único para
    // as duas faria os cards ficarem indistinguíveis no board.
    const titulo = familias.length === 1 && entrada.titulo?.trim()
      ? entrada.titulo.trim()
      : `${empresa.nome} — ${familia ? ROTULO_FAMILIA[familia] : "Família a definir"}`;

    const [negocio] = await db.execute<{ id: string }>(sql`
      INSERT INTO negocios (
        organizacao_id, lead_id, empresa_id, titulo, service_family,
        etapa, etapa_desde, status, source_process, commercial_motion,
        responsavel_id, pipeline_id, bundle_id, valor_total,
        previsao_fechamento, proxima_acao, proxima_acao_em, proxima_acao_responsavel_id,
        origem_negocio, origem_qualificacao, servico_origem_id, campos_custom
      ) VALUES (
        ${entrada.organizacaoId}::uuid,
        ${entrada.leadId ?? null}::uuid,
        ${entrada.empresaId}::uuid,
        ${titulo},
        ${familia},
        'entrada', now(), ${STATUS_LEGADO_DA_ETAPA.entrada},
        ${entrada.sourceProcess},
        ${motion},
        ${entrada.responsavelId}::uuid,
        ${pipelinePadrao?.id ?? null}::uuid,
        ${bundleId}::uuid,
        ${entrada.valorEstimado ?? null},
        ${entrada.previsaoFechamento ?? null}::date,
        ${entrada.proximaAcao ?? null},
        ${entrada.proximaAcaoEm ?? null}::timestamptz,
        ${entrada.proximaAcao ? entrada.responsavelId : null}::uuid,
        ${entrada.sourceProcess === "EXPANSION" ? "carteira" : "novo"},
        ${entrada.reuniao ? "reuniao" : "direta"},
        ${entrada.servicoOrigemId ?? null}::uuid,
        COALESCE(${entrada.tipoVenda ? JSON.stringify({ tipo_venda: entrada.tipoVenda }) : null}::jsonb, '{}'::jsonb)
      )
      RETURNING id::text
    `);

    if (entrada.leadId) {
      await db.execute(sql`
        INSERT INTO negocio_leads (negocio_id, lead_id, papel)
        VALUES (${negocio.id}::uuid, ${entrada.leadId}::uuid, 'contato')
        ON CONFLICT DO NOTHING
      `);
    }

    await registrarMudancaDeEtapa({
      organizacaoId: entrada.organizacaoId, ator, negocioId: negocio.id,
      leadId: entrada.leadId ?? null, de: null, para: "entrada",
      tipo: "OpportunityStageChanged", motivo: "Oportunidade criada",
    });

    await registrarEvento({
      organizacaoId: entrada.organizacaoId,
      tipo: entrada.sourceProcess === "OUTBOUND_DIRECT" ? "OpportunityCreatedFromProspecting" : "OpportunityCreated",
      ator, negocioId: negocio.id, leadId: entrada.leadId ?? null,
      empresaId: entrada.empresaId, pessoaId: entrada.pessoaId ?? null,
      contexto: { familia, motion, sourceProcess: entrada.sourceProcess, bundleId, titulo },
      timeline: { tipo: "nota", titulo: "Oportunidade criada", descricao: titulo },
    });

    criadas.push({ id: negocio.id, familia, titulo });
  }

  // A reunião é agendada na PRIMEIRA oportunidade quando há irmãs: uma reunião
  // única não deve ser duplicada só porque a venda tem duas linhas.
  let reuniaoId: string | null = null;
  let reuniaoAviso: string | null = null;
  if (entrada.reuniao?.data) {
    const resultado = await agendarReuniao({
      organizacaoId: entrada.organizacaoId,
      negocioId: criadas[0].id,
      leadId: entrada.leadId ?? null,
      data: entrada.reuniao.data,
      duracao: entrada.reuniao.duracao,
      tipo: entrada.reuniao.tipo,
      titulo: entrada.reuniao.titulo,
      notas: entrada.reuniao.notas,
      responsavelId: entrada.reuniao.closerId ?? entrada.responsavelId,
      ator,
    });
    reuniaoId = resultado.reuniaoId;
    reuniaoAviso = resultado.aviso;
  }

  // Bloco 01 §11-12: o Lead conclui o handoff e passa a espelhar o Pipeline.
  //
  // Só no caminho de Pré-vendas. Quando a oportunidade nasce do outbound
  // direto, do Pipeline ou da carteira, o registro é vinculado para não perder
  // a origem — mas empurrá-lo para a etapa "Oportunidade" de Pré-vendas seria
  // fingir uma passagem que não houve, que é o que Bloco 04 §13 proíbe.
  if (entrada.leadId && entrada.sourceProcess === "PRE_SALES") {
    // Mesma transação: o lead vira Oportunidade E a aquisição é encerrada como
    // convertida. Sem o segundo passo ela seguia "aberta" em Pré-vendas e a
    // ficha mostrava Pré-vendas e Oportunidade ao mesmo tempo.
    const leadId = entrada.leadId;
    await db.transaction(async (tx) => {
      await tx.execute(sql`
        UPDATE leads SET
          estagio_pre_vendas = 'oportunidade',
          negocio_ativo_id = ${criadas[0].id}::uuid,
          convertido_at = COALESCE(convertido_at, now()),
          sdr_status = 'qualified',
          updated_at = now()
         WHERE id = ${leadId}::uuid
      `);
      await encerrarAquisicaoConvertida(leadId, tx as never);
    });
    await registrarMudancaDeEtapa({
      organizacaoId: entrada.organizacaoId, ator, leadId: entrada.leadId,
      negocioId: criadas[0].id, de: "qualificado", para: "oportunidade",
      tipo: "StageChanged", motivo: "Handoff de Pré-vendas concluído",
    });
  }

  // O vínculo operacional vale para qualquer origem: é o que leva do registro
  // para a oportunidade sem depender da etapa de Pré-vendas.
  if (entrada.leadId && entrada.sourceProcess !== "PRE_SALES") {
    await db.execute(sql`
      UPDATE leads SET negocio_ativo_id = ${criadas[0].id}::uuid, updated_at = now()
       WHERE id = ${entrada.leadId}::uuid
    `);
  }

  await espelharNoDominioV2(criadas.map((c) => c.id));

  return { oportunidades: criadas, bundleId, reuniaoId, reuniaoAviso };
}

/**
 * Cria a oportunidade a partir de um Lead qualificado.
 *
 * Bloco 01 §9-11: Qualificado não cria oportunidade sozinho; é preciso o
 * comando. A família pode ficar "a definir" neste momento; o Lead não tem
 * obrigação de sabê-la e o sistema nunca a adivinha por `servicos_interesse`.
 */
export async function criarOportunidadeDoLead(params: {
  organizacaoId: string;
  leadId: string;
  familias: Familia[];
  responsavelId: string;
  titulo?: string | null;
  valorEstimado?: string | null;
  reuniao?: CriarOportunidade["reuniao"];
  ator: Ator;
}): Promise<OportunidadeCriada> {
  const [lead] = await db.execute<{
    id: string; empresa_id: string | null; empresa: string | null; qualificado: boolean;
    estagio_pre_vendas: string | null; nome: string; email: string | null;
    telefone: string | null; cargo: string | null; sobrenome: string | null;
  }>(sql`
    SELECT id::text, empresa_id::text, empresa, qualificado, estagio_pre_vendas,
           nome, sobrenome, email, telefone, cargo
      FROM leads WHERE id = ${params.leadId}::uuid AND organizacao_id = ${params.organizacaoId}::uuid
  `);
  if (!lead) throw new RegraDeNegocio("lead_nao_encontrado", "Lead não encontrado.");

  // Empresa é obrigatória e o Lead legado pode ter só o nome dela em texto.
  // Resolver aqui é o que impede a oportunidade de nascer órfã.
  let empresaId = lead.empresa_id;
  if (!empresaId) {
    if (!lead.empresa?.trim()) {
      throw new RegraDeNegocio(
        "lead_sem_empresa",
        "Este lead não tem empresa. Associe ou crie a empresa antes de abrir a oportunidade.",
        { rotulo: "Associar empresa", tipo: "associar_empresa" },
      );
    }
    const { resolverEmpresa } = await import("./identidade");
    const resolvida = await resolverEmpresa(params.organizacaoId, {
      nome: lead.empresa, email: lead.email,
    }, params.ator);
    empresaId = resolvida.empresaId;
    await db.execute(sql`UPDATE leads SET empresa_id = ${empresaId}::uuid WHERE id = ${lead.id}::uuid`);

    // A aquisição canônica precisa saber da empresa AGORA, e não por acaso.
    //
    // A Empresa 360 lista os leads da conta por `aquisicoes.empresa_id`. Este
    // UPDATE é SQL direto e não passa por `registrarEvento`, que é quem dispara
    // a sincronização — então o lead ganhava empresa e não aparecia na conta
    // dele. Achado pelo aceite de vendas, que monta lead e empresa do zero;
    // com o dado de produção já sincronizado pelo backfill, medir o banco não
    // acusava nada.
    //
    // `await` de propósito: a sincronização geral é best-effort e disparada com
    // `void`, o que serve para propagação de fundo. Aqui ela é parte do comando
    // que o usuário acabou de executar, e quem recarregar a tela em seguida tem
    // que ver o resultado.
    const { sincronizarAquisicaoDoLead } = await import("./sincronizar-aquisicao");
    await sincronizarAquisicaoDoLead(lead.id);
  }

  return criarOportunidade({
    organizacaoId: params.organizacaoId,
    empresaId,
    familias: params.familias,
    responsavelId: params.responsavelId,
    sourceProcess: "PRE_SALES",
    leadId: lead.id,
    titulo: params.titulo,
    valorEstimado: params.valorEstimado,
    reuniao: params.reuniao,
  }, params.ator);
}

/* ── Etapas e gates (Bloco 02 §9-10, §16, §19) ─────────────────────────── */

/**
 * Move a oportunidade de etapa.
 *
 * Os gates não são validação de formulário: são a regra comercial. Mover para
 * Proposta ou Negociação exigem Família e proposta vinculada, com a mensagem e
 * o CTA que a spec escreve literalmente. Ganho não é alcançável por aqui em
 * hipótese alguma.
 */
export async function moverEtapa(params: {
  organizacaoId: string;
  negocioId: string;
  para: EtapaPipelineAberta;
  ator: Ator;
  motivo?: string | null;
  /** Usado pelo envio de proposta, que move automaticamente (Bloco 03 §9). */
  ignorarGateDeProposta?: boolean;
}): Promise<void> {
  const op = await carregarOportunidade(params.organizacaoId, params.negocioId);

  if (op.etapa === "ganho") {
    throw new RegraDeNegocio("oportunidade_ganha", "Esta oportunidade já foi ganha.");
  }
  if (op.etapa === params.para) {
    // Idempotente no LEGADO não é idempotente no canônico.
    //
    // `op.etapa` vem de `negocios`, e a tela lê de `oportunidades`. Quando uma
    // tentativa anterior atualizou o negócio e morreu antes do espelho — foi o
    // que aconteceu com a FK de `status_changes` —, sair aqui congela a
    // divergência: o usuário arrasta, nada acontece, e nada avisa.
    //
    // Mesma assinatura do bug de `atribuirResponsavel`: o caminho idempotente
    // precisa reconciliar, não só sair.
    await espelharNoDominioV2([op.id]);
    return;
  }

  const exigeProposta = params.para === "proposta" || params.para === "negociacao";
  if (exigeProposta && !ehFamiliaValida(op.service_family)) {
    throw new RegraDeNegocio(
      "etapa_exige_familia",
      // A etapa pedida, e não "Proposta" fixo: o gate vale para Negociação
      // também, e a mensagem dizia o nome errado de quem pediu Negociação.
      `Defina a família comercial antes de avançar para ${ROTULO_ETAPA_PIPELINE[params.para] ?? params.para}.`,
      { rotulo: "Definir família", tipo: "alterar_familia" },
    );
  }
  if (exigeProposta && !params.ignorarGateDeProposta && op.propostas_vinculadas === 0) {
    throw new RegraDeNegocio(
      "etapa_exige_proposta",
      params.para === "proposta"
        ? "Crie uma proposta para mover esta oportunidade para Proposta."
        : "Negociação é negociação sobre uma oferta real. Crie uma proposta primeiro.",
      { rotulo: "Criar proposta", tipo: "criar_proposta" },
    );
  }

  await aplicarEtapa(op, params.para, params.ator, params.motivo ?? null);
}

/** Escrita da etapa: coluna nova, status legado e histórico, sempre juntos. */
async function aplicarEtapa(
  op: OportunidadeInterna,
  para: EtapaPipeline,
  ator: Ator,
  motivo: string | null,
): Promise<void> {
  // A etapa e o seu registro no histórico vão JUNTOS ou não vão.
  //
  // Estavam soltos, e a FK de `status_changes` provou o custo: o negócio já
  // tinha mudado de etapa quando o INSERT do histórico estourou, e ficou uma
  // etapa nova sem nenhum registro de quem a mudou — invisível, porque a ação
  // devolveu erro e ninguém foi olhar o que já tinha sido gravado.
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      UPDATE negocios SET
        etapa = ${para},
        etapa_desde = now(),
        status = ${STATUS_LEGADO_DA_ETAPA[para]},
        -- Sair da etapa limpa a estagnação: ela descrevia a parada anterior.
        motivo_estagnacao = NULL,
        estagnado_em = NULL,
        -- Reabrir uma perdida não pode deixar o motivo da perda grudado numa
        -- oportunidade aberta: o relatório de perda a contaria como perdida.
        -- A perda original segue no histórico (vendas_eventos / status_changes).
        motivo_perda = CASE WHEN ${para} = 'perdido' THEN motivo_perda ELSE NULL END,
        motivo_perda_chave = CASE WHEN ${para} = 'perdido' THEN motivo_perda_chave ELSE NULL END,
        motivo_perda_detalhe = CASE WHEN ${para} = 'perdido' THEN motivo_perda_detalhe ELSE NULL END,
        updated_at = now()
       WHERE id = ${op.id}::uuid
    `);

    await registrarMudancaDeEtapa({
      organizacaoId: op.organizacao_id, ator, negocioId: op.id, leadId: op.lead_id,
      de: op.etapa, para, tipo: "OpportunityStageChanged", motivo,
    }, tx);
  });

  // O espelho fica FORA da transação de propósito: ele chama código que usa a
  // conexão global e é idempotente. Se falhar, a próxima tentativa de mover
  // reconcilia pelo caminho idempotente lá em cima.
  await espelharNoDominioV2([op.id]);

  /* O barramento, que é o que faz automação disparar em mudança de etapa.
   *
   * `registrarMudancaDeEtapa` grava o fato em `vendas_eventos` — o histórico
   * do card e o tempo por etapa saem de lá. Mas quem acorda fluxo e cadência
   * é o outbox, e ele não estava sendo alimentado por aqui: a rota legada
   * (api-server/routes/negocios.ts) publicava, e o board do ONFACE não. Na
   * prática, mover card no produto novo não disparava NADA.
   *
   * Best-effort de propósito: a etapa já está gravada e o espelho já
   * reconciliou. Derrubar a movimentação porque o barramento falhou seria
   * trocar um problema pequeno por um grande. */
  await publicarEvento({
    organizacaoId: op.organizacao_id,
    eventType: "StageChanged",
    aggregateType: "negocio",
    aggregateId: op.id,
    payload: { status: para, statusAnterior: op.etapa, motivo: motivo ?? null },
    /* A mesma transição não pode virar dois disparos quando o vendedor
       arrasta o card de ida e volta — a chave inclui de→para. */
    idempotencyKey: `stage:${op.id}:${op.etapa}:${para}`,
  }).catch((e: unknown) => console.error("[pipeline] StageChanged não publicado:", e));
}

/**
 * Próxima ação É uma tarefa (SPEC §23), e não um campo do negócio.
 *
 * Antes isto escrevia `negocios.proxima_acao`, uma coluna que a base inteira
 * tem VAZIA: 0 de 1.562. O efeito visível era o selo "Sem próxima ação"
 * aparecendo em todo card aberto do pipeline, inclusive nos que tinham tarefa
 * marcada — porque o selo olhava a coluna e a fila do vendedor olhava
 * `tarefas`. Dois lugares para o mesmo compromisso, e nenhum deles completo.
 *
 * A tarefa é a canônica. `chave_idempotencia` garante UMA por oportunidade:
 * redefinir a próxima ação substitui, não empilha. `origem = 'MANUAL'` é o
 * mesmo que a tela de CS já usa para a próxima ação dela.
 *
 * A coluna legada continua sendo escrita enquanto houver leitor — ponte, não
 * segunda verdade: quem decide é a tarefa.
 */
export async function definirProximaAcao(params: {
  organizacaoId: string;
  negocioId: string;
  descricao: string | null;
  quando: string | null;
  responsavelId?: string | null;
  ator: Ator;
}): Promise<void> {
  const op = await carregarOportunidade(params.organizacaoId, params.negocioId);
  const dono = params.responsavelId ?? op.responsavel_id ?? null;
  const chave = `proxima-acao:${params.negocioId}`;

  if (params.descricao?.trim()) {
    await db.execute(sql`
      INSERT INTO tarefas (organizacao_id, lead_id, negocio_id, usuario_id, titulo,
                           tipo, prioridade, origem, status, vence_em, data_vencimento,
                           chave_idempotencia)
      VALUES (${params.organizacaoId}::uuid, ${op.lead_id ?? null}::uuid, ${params.negocioId}::uuid,
              ${dono}::uuid, ${params.descricao.trim()}, 'follow_up', 'media', 'MANUAL', 'a_fazer',
              ${params.quando ?? null}::timestamptz, ${params.quando ?? null}::timestamptz,
              ${chave})
      ON CONFLICT (organizacao_id, chave_idempotencia) WHERE chave_idempotencia IS NOT NULL
      DO UPDATE SET titulo = EXCLUDED.titulo, usuario_id = EXCLUDED.usuario_id,
                    vence_em = EXCLUDED.vence_em, data_vencimento = EXCLUDED.data_vencimento,
                    status = 'a_fazer', concluida = false, concluida_em = NULL`);
  } else {
    // Limpar a próxima ação não apaga a tarefa: declina, que é o que preserva
    // o rastro de que alguém combinou algo e depois desmarcou.
    await db.execute(sql`
      UPDATE tarefas SET status = 'declinada', concluida = false
       WHERE organizacao_id = ${params.organizacaoId}::uuid AND chave_idempotencia = ${chave}
         AND status NOT IN ('concluida', 'declinada')`);
  }

  // Ponte com o legado: escrita mantida enquanto houver leitor da coluna.
  await db.execute(sql`
    UPDATE negocios SET
      proxima_acao = ${params.descricao},
      proxima_acao_em = ${params.quando ?? null}::timestamptz,
      proxima_acao_responsavel_id = ${dono}::uuid,
      updated_at = now()
     WHERE id = ${params.negocioId}::uuid
  `);
  await registrarEvento({
    organizacaoId: params.organizacaoId, tipo: "NextActionSet", ator: params.ator,
    negocioId: params.negocioId,
    contexto: { descricao: params.descricao, quando: params.quando },
  });
}

/** Bloco 02 §17: motivo de estagnação é contexto do card, não etapa nova. */
export async function marcarEstagnacao(params: {
  organizacaoId: string;
  negocioId: string;
  motivo: MotivoEstagnacao | null;
  ator: Ator;
}): Promise<void> {
  await carregarOportunidade(params.organizacaoId, params.negocioId);
  await db.execute(sql`
    UPDATE negocios SET
      motivo_estagnacao = ${params.motivo},
      estagnado_em = ${params.motivo ? sql`now()` : sql`NULL`},
      updated_at = now()
     WHERE id = ${params.negocioId}::uuid
  `);
  // O espelho leva a estagnação para `oportunidades` (migration 0084). Sem
  // esta chamada a escrita ficava só no legado, e o canônico só descobria a
  // estagnação se alguém por acaso mudasse a etapa depois.
  await espelharNoDominioV2([params.negocioId]);

  await registrarEvento({
    organizacaoId: params.organizacaoId, tipo: "OpportunityStalled", ator: params.ator,
    negocioId: params.negocioId, contexto: { motivo: params.motivo },
  });
}

/** Bloco 02 §4: a família é editável enquanto a oportunidade está aberta, e a
 *  troca gera evento estruturado. */
export async function alterarFamilia(params: {
  organizacaoId: string;
  negocioId: string;
  familia: Familia;
  motivo?: string | null;
  ator: Ator;
}): Promise<{ propostasIncompativeis: number }> {
  if (!ehFamiliaValida(params.familia)) {
    throw new RegraDeNegocio("familia_invalida", "Família inválida.");
  }
  const op = await carregarOportunidade(params.organizacaoId, params.negocioId);
  if (op.etapa === "ganho" || op.etapa === "perdido") {
    throw new RegraDeNegocio("oportunidade_fechada", "Oportunidade fechada não muda de família.");
  }
  // Compara com o valor do LEGADO, não com o resolvido: escolher a família que
  // o canônico já deduziu precisa gravar no negócio, e não virar no-op.
  if (op.service_family_proprio === params.familia) return { propostasIncompativeis: 0 };

  // Bloco 02 §4: a alteração não pode deixar proposta e oportunidade
  // inconsistentes em silêncio. Propostas vigentes da família antiga são
  // contadas e devolvidas para que a interface avise — sem reescrever
  // proposta histórica, que a spec proíbe.
  const [incompativeis] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM propostas
     WHERE negocio_id = ${params.negocioId}::uuid
       AND status IN ('enviada','visualizada','ajuste_solicitado')
       AND COALESCE(service_family, ${op.service_family ?? ""}) <> ${params.familia}
  `);

  await db.execute(sql`
    UPDATE negocios SET service_family = ${params.familia},
      -- O título nasce "{Empresa} — Família a definir" e a família escolhida depois
      -- nunca o atualizava: o card seguia dizendo "a definir" já com família.
      -- Só troca o sufixo gerado; título digitado à mão fica como está.
      titulo = CASE WHEN titulo LIKE '% — Família a definir'
                    THEN left(titulo, length(titulo) - length('Família a definir')) || ${ROTULO_FAMILIA[params.familia]}
                    ELSE titulo END,
      updated_at = now()
     WHERE id = ${params.negocioId}::uuid
  `);

  await registrarEvento({
    organizacaoId: params.organizacaoId, tipo: "OpportunityFamilyChanged", ator: params.ator,
    negocioId: params.negocioId,
    contexto: { de: op.service_family, para: params.familia, motivo: params.motivo ?? null },
    timeline: {
      tipo: "nota", titulo: "Família alterada",
      descricao: `${op.service_family ?? "não classificada"} → ${ROTULO_FAMILIA[params.familia]}`,
    },
  });

  await espelharNoDominioV2([params.negocioId]);
  return { propostasIncompativeis: incompativeis?.n ?? 0 };
}

/* ── Fechamento ────────────────────────────────────────────────────────── */

/** Bloco 02 §17: perder exige motivo estruturado, e o registro precisa
 *  sustentar relatório de motivo de perda depois. */
export async function perder(params: {
  organizacaoId: string;
  negocioId: string;
  motivo: MotivoPerda;
  detalhe?: string | null;
  ator: Ator;
}): Promise<void> {
  if (!params.motivo) {
    throw new RegraDeNegocio("perda_exige_motivo", "Escolha o motivo da perda.");
  }
  // Motivo fora da lista fechada gravava mesmo assim (chave "xpto" perdia a
  // oportunidade) e o relatório de motivo de perda ganhava uma categoria fantasma.
  if (!MOTIVOS_PERDA.some((m) => m.chave === params.motivo)) {
    throw new RegraDeNegocio("perda_motivo_invalido", "Motivo de perda inválido. Escolha um da lista.");
  }
  const op = await carregarOportunidade(params.organizacaoId, params.negocioId);
  if (op.etapa === "ganho") {
    throw new RegraDeNegocio("oportunidade_ganha", "Oportunidade ganha não pode ser marcada como perdida.");
  }

  // A perda e o seu registro no histórico vão JUNTOS, como em `aplicarEtapa`.
  // Soltos, a FK de `status_changes` deixaria o negócio perdido sem registro de
  // quem perdeu nem por quê: o relatório de motivo de perda, que é a razão de
  // existir desta função, ficaria com um buraco invisível.
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      UPDATE negocios SET
        etapa = 'perdido', etapa_desde = now(), status = 'perdido',
        motivo_perda_chave = ${params.motivo},
        motivo_perda = ${params.motivo},
        motivo_perda_detalhe = ${params.detalhe ?? null},
        updated_at = now()
       WHERE id = ${params.negocioId}::uuid
    `);

    // Perdida não pode ter proposta viva: o link público seguia aceitável e o
    // cliente aceitava (gerando contrato/checkout) numa oportunidade já perdida.
    // Expira as que aguardam resposta; aceita/recusada/rascunho ficam como estão.
    await tx.execute(sql`
      UPDATE propostas SET status = 'expirada', expirada_em = now(), updated_at = now()
       WHERE negocio_id = ${params.negocioId}::uuid
         AND status IN ('enviada', 'visualizada', 'ajuste_solicitado')
    `);

    await registrarMudancaDeEtapa({
      organizacaoId: params.organizacaoId, ator: params.ator, negocioId: params.negocioId,
      leadId: op.lead_id, de: op.etapa, para: "perdido",
      tipo: "OpportunityStageChanged", motivo: params.motivo,
    }, tx);
  });

  await registrarEvento({
    organizacaoId: params.organizacaoId, tipo: "OpportunityLost", ator: params.ator,
    negocioId: params.negocioId, empresaId: op.empresa_id,
    contexto: { motivo: params.motivo, detalhe: params.detalhe ?? null, etapaAnterior: op.etapa },
    timeline: { tipo: "nota", titulo: "Oportunidade perdida", descricao: params.detalhe ?? params.motivo },
  });

  await espelharNoDominioV2([params.negocioId]);
}

/**
 * Tenta fechar como Ganho.
 *
 * Bloco 02 §19-20: Won não é um movimento, é consequência de evidência válida
 * para a família e o modo comercial. O gate já existe no projeto
 * (`won-evidence.ts`, com políticas por produto e evidência tipada) e é ele
 * quem decide — este comando só o aciona e mantém a etapa nova coerente.
 *
 * Se a evidência não bastar, a oportunidade continua aberta e a função diz por
 * quê. Não existe caminho que force o ganho.
 */
export async function tentarGanhar(params: {
  organizacaoId: string;
  negocioId: string;
  ator: Ator;
}): Promise<{ ganhou: boolean; motivo: string }> {
  const op = await carregarOportunidade(params.organizacaoId, params.negocioId);
  if (op.etapa === "ganho") return { ganhou: true, motivo: "Já estava ganha." };

  if (!ehFamiliaValida(op.service_family)) {
    throw new RegraDeNegocio(
      "ganho_exige_familia",
      "Defina a família comercial antes de concluir a oportunidade como ganha.",
      { rotulo: "Definir família", tipo: "alterar_familia" },
    );
  }

  const { marcarNegocioGanhoSeAindaNao, avaliarEvidenciaWon, getProdutoNegocio } =
    await import("@/lib/crm/won-evidence");

  const familia = op.service_family;
  await marcarNegocioGanhoSeAindaNao(params.negocioId, params.organizacaoId, { familiaHint: familia });

  const [depois] = await db.execute<{ status: string }>(sql`
    SELECT status FROM negocios WHERE id = ${params.negocioId}::uuid
  `);

  if (depois?.status !== "ganho") {
    const avaliacao = await avaliarEvidenciaWon(
      params.negocioId, params.organizacaoId, familia ?? (await getProdutoNegocio(params.negocioId)),
    );
    return { ganhou: false, motivo: avaliacao.motivo };
  }

  // `marcarNegocioGanhoSeAindaNao` escreve o status legado e dispara Cliente,
  // CS e os eventos de pós-venda; a etapa canônica é responsabilidade daqui.
  await db.execute(sql`
    UPDATE negocios SET etapa = 'ganho', etapa_desde = now(), motivo_estagnacao = NULL
     WHERE id = ${params.negocioId}::uuid
  `);

  await registrarEvento({
    organizacaoId: params.organizacaoId, tipo: "OpportunityWon", ator: params.ator,
    negocioId: params.negocioId, empresaId: op.empresa_id, leadId: op.lead_id,
    contexto: { familia, etapaAnterior: op.etapa },
  });

  await espelharNoDominioV2([params.negocioId]);

  /* Pós-venda: o Ganho tinha DOIS caminhos e só um entregava.
   *
   * `PATCH /api/negocios` (rota legada) chama `criarPosVendaDoNegocio` e cria
   * serviço canônico + jornada de onboarding com checklist. A tela do ONFACE
   * ganha por AQUI, e aqui só rodava `propagarGanhoCanonico`, que cria a
   * jornada pela OFERTA — e não existe nenhuma oferta comercial cadastrada
   * (medido em 06/10: 0 linhas). Resultado: ganhar pelo produto novo deixava o
   * cliente sem entrega nenhuma.
   *
   * Mesma forma da rota: não aguardado (o negócio já está ganho e não pode
   * depender disto), idempotente (a segunda chamada responde "pós-venda já
   * existe") e sem efeito quando a flag POSVENDA_CANONICO está desligada. */
  const { criarPosVendaDoNegocio } = await import("@/lib/crm/pos-venda");
  void (async () => {
    /* Serviço com PRODUTO, VALOR e QUANTIDADE antes do serviço de roteamento. `criarPosVendaDoNegocio`
     * cria um serviço sem nome, natureza UNKNOWN e valor 0 (de propósito: roteia a entrega, não
     * reconhece receita). Sozinho, ele fazia o Ganho por aqui (atestado financeiro, por exemplo)
     * perder o produto e o MRR vendidos. A rota PATCH legada já materializa os itens antes; aqui é
     * o mesmo passo. Os itens carregam `evidence.negocioId`, então o pós-venda abaixo reconhece que o
     * serviço já existe e não cria o segundo (nem a segunda jornada). */
    const { garantirItemComercialManual } = await import("@/lib/crm/composicao-comercial");
    const { materializarServicosCanonicosDoNegocio } = await import("@/lib/crm/servico-canonico");
    const { criarFulfillmentsParaServicos } = await import("@/lib/crm/fulfillment");
    /* Grupo com entrega liberada ou concluído: quem materializa é o consumer do outbox
     * (FulfillmentGroupCompleted). Materializar aqui também criaria um segundo serviço MRR. */
    const [grupoLiberado] = await db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM proposta_grupo_comercial
       WHERE negocio_id = ${params.negocioId}::uuid AND (entrega_liberada_em IS NOT NULL OR status = 'concluido')`);
    if (!((grupoLiberado?.n ?? 0) > 0)) await garantirItemComercialManual(params.negocioId);
    const [contrato] = await db.execute<{ id: string }>(sql`SELECT id::text FROM contratos WHERE negocio_id = ${params.negocioId}::uuid ORDER BY created_at DESC LIMIT 1`);
    const { servicoIds } = (grupoLiberado?.n ?? 0) > 0 ? { servicoIds: [] as string[] } : await materializarServicosCanonicosDoNegocio({
      negocioId: params.negocioId, organizacaoId: params.organizacaoId, contratoId: contrato?.id ?? null, wonAt: new Date(), stripeSubscriptionId: null,
    });
    if (servicoIds.length > 0) {
      await criarFulfillmentsParaServicos(servicoIds, params.organizacaoId);
      console.log(`[pos-venda] ${params.negocioId} -> ${servicoIds.length} serviço(s) com produto e valor`);
      return;
    }
    const r = await criarPosVendaDoNegocio(params.negocioId);
    if (r.criado) console.log(`[pos-venda] ${params.negocioId} -> ${r.trilha} (${r.itensChecklist} itens)`);
    else console.warn(`[pos-venda] ${params.negocioId} não criou: ${r.motivo}`);
  })().catch((e) => console.error("[pos-venda] falha (negócio segue ganho):", params.negocioId, e));

  return { ganhou: true, motivo: "Evidência comercial confirmada." };
}

/* ── Reuniões e no-show (Bloco 02 §11-12) ──────────────────────────────── */

export async function agendarReuniao(params: {
  organizacaoId: string;
  negocioId: string;
  leadId?: string | null;
  data: string;
  duracao?: number;
  tipo?: "call" | "presencial" | "video";
  titulo?: string;
  notas?: string;
  link?: string;
  responsavelId?: string | null;
  ator: Ator;
}): Promise<{ reuniaoId: string; aviso: string | null }> {
  const data = new Date(params.data);
  if (Number.isNaN(data.getTime())) {
    throw new RegraDeNegocio("reuniao_data_invalida", "Data da reunião inválida.");
  }
  const op = await carregarOportunidade(params.organizacaoId, params.negocioId);

  const [reuniao] = await db.execute<{ id: string }>(sql`
    INSERT INTO reunioes (organizacao_id, negocio_id, lead_id, titulo, data, duracao, tipo, status, notas, link, responsavel_id)
    VALUES (
      ${params.organizacaoId}::uuid, ${params.negocioId}::uuid,
      ${params.leadId ?? op.lead_id ?? null}::uuid,
      ${params.titulo?.trim() || `Reunião · ${op.titulo}`},
      ${data.toISOString()}::timestamptz,
      ${params.duracao ?? 30}, ${params.tipo ?? "call"}, 'agendada',
      ${params.notas ?? null}, ${params.link ?? null},
      ${params.responsavelId ?? op.responsavel_id ?? null}::uuid
    )
    RETURNING id::text
  `);

  await registrarEvento({
    organizacaoId: params.organizacaoId, tipo: "MeetingScheduled", ator: params.ator,
    negocioId: params.negocioId, leadId: params.leadId ?? op.lead_id, reuniaoId: reuniao.id,
    contexto: { data: data.toISOString(), tipo: params.tipo ?? "call" },
    timeline: {
      tipo: "reuniao", titulo: "Reunião agendada",
      descricao: data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }),
    },
  });

  /* Toda reunião nasce com o evento na agenda do responsável (e convite aos participantes). Pela porta
     única de calendário: falha não derruba o agendamento, mas volta como aviso e fica em
     `calendar_sync_status` — nunca silenciosa. */
  const { criarNaAgenda, FRASE_SEM_CONVIDADO } = await import("@/lib/calendario/sincronizar");
  const sync = await criarNaAgenda(params.organizacaoId, reuniao.id).catch((e) => {
    console.error(`[agendarReuniao] sincronização da reunião ${reuniao.id} falhou:`, e);
    return { sincronizado: false, aviso: "A reunião foi salva no CRM, mas não consegui criar o evento na agenda. Tente de novo pela reunião." };
  });
  const aviso = sync.aviso ?? (sync.sincronizado && "semConvidado" in sync && sync.semConvidado ? FRASE_SEM_CONVIDADO : null);

  return { reuniaoId: reuniao.id, aviso };
}

/**
 * Registra no-show.
 *
 * Bloco 01 §15 e Bloco 02 §12: no-show é evento. A MESMA oportunidade é
 * preservada, o card ganha contexto, e o Lead volta para QUALIFICADO para ser
 * retrabalhado. Criar uma segunda oportunidade por causa de no-show está entre
 * as proibições explícitas da spec.
 */
export async function registrarNoShow(params: {
  organizacaoId: string;
  negocioId: string;
  reuniaoId?: string | null;
  ator: Ator;
}): Promise<void> {
  const op = await carregarOportunidade(params.organizacaoId, params.negocioId);

  // Idempotência: repetir o no-show da MESMA reunião (duplo clique, retry) somava
  // o contador do card e duplicava o evento. A reunião já está 'no_show' aqui
  // porque a tela grava a coluna antes; por isso a trava é o evento, não o status.
  if (params.reuniaoId) {
    const jaRegistrado = await db.execute(sql`
      SELECT 1 FROM vendas_eventos WHERE tipo = 'MeetingNoShow' AND reuniao_id = ${params.reuniaoId}::uuid LIMIT 1`);
    if ((jaRegistrado as unknown as unknown[]).length) return;
  }

  await db.execute(sql`
    UPDATE negocios SET
      no_show_em = now(),
      no_show_contagem = no_show_contagem + 1,
      updated_at = now()
     WHERE id = ${params.negocioId}::uuid
  `);

  if (params.reuniaoId) {
    await db.execute(sql`
      UPDATE reunioes SET status = 'no_show', updated_at = now()
       WHERE id = ${params.reuniaoId}::uuid AND negocio_id = ${params.negocioId}::uuid
    `);
  }

  await registrarEvento({
    organizacaoId: params.organizacaoId, tipo: "MeetingNoShow", ator: params.ator,
    negocioId: params.negocioId, leadId: op.lead_id, reuniaoId: params.reuniaoId ?? null,
    contexto: { etapa: op.etapa },
    timeline: { tipo: "reuniao", titulo: "No-show", descricao: "Cliente não compareceu à reunião." },
  });

  // A tag "No-show" marca quem faltou: é por ela que o time acha, no board de
  // Pré-vendas, os leads a remarcar, e a automação de recuperação escuta o
  // mesmo gatilho. Fica no lead e na oportunidade; a contagem em
  // `negocios.no_show_contagem` guarda o histórico. Falhar aqui não desfaz o
  // no-show, que já está gravado.
  try {
    const { adicionarTag } = await import("@/lib/crm/tags");
    await adicionarTag({ organizacaoId: params.organizacaoId, entityType: "negocio", entityId: params.negocioId, label: "No-show", atorId: params.ator.usuarioId ?? null });
    if (op.lead_id) await adicionarTag({ organizacaoId: params.organizacaoId, entityType: "lead", entityId: op.lead_id, label: "No-show", atorId: params.ator.usuarioId ?? null });
  } catch (e) {
    console.warn(`[no-show] tag não aplicada na oportunidade ${params.negocioId}:`, e);
  }

  if (op.lead_id) {
    // Decisão do Scott (06/10, revista): o lead do no-show volta para QUALIFICADO.
    // Ele já foi qualificado, só não compareceu à reunião; mandá-lo de volta para
    // Qualificação faria o SDR requalificar quem já estava pronto.
    const [lead] = await db.execute<{ estagio_pre_vendas: string | null }>(sql`
      SELECT estagio_pre_vendas FROM leads
       WHERE id = ${op.lead_id}::uuid AND organizacao_id = ${params.organizacaoId}::uuid`);
    if (lead && lead.estagio_pre_vendas !== "qualificado") {
      await db.execute(sql`
        UPDATE leads SET estagio_pre_vendas = 'qualificado', updated_at = now()
         WHERE id = ${op.lead_id}::uuid`);
      await registrarMudancaDeEtapa({
        organizacaoId: params.organizacaoId, ator: params.ator, leadId: op.lead_id,
        de: lead.estagio_pre_vendas, para: "qualificado", tipo: "StageChanged",
        motivo: "No-show: lead volta para Qualificado",
      });
    }
  }
}

/**
 * Reagenda depois de um no-show.
 *
 * Reutiliza a MESMA oportunidade (Bloco 02 §12) e devolve o Lead para
 * Oportunidade, porque o handoff continua válido — o que falhou foi a reunião,
 * não a passagem de Pré-vendas.
 */
export async function reagendarAposNoShow(params: {
  organizacaoId: string;
  negocioId: string;
  data: string;
  duracao?: number;
  tipo?: "call" | "presencial" | "video";
  ator: Ator;
}): Promise<{ reuniaoId: string; aviso: string | null }> {
  const op = await carregarOportunidade(params.organizacaoId, params.negocioId);

  const reuniao = await agendarReuniao({
    organizacaoId: params.organizacaoId, negocioId: params.negocioId,
    data: params.data, duracao: params.duracao, tipo: params.tipo, ator: params.ator,
  });

  await db.execute(sql`
    UPDATE negocios SET no_show_em = NULL, updated_at = now()
     WHERE id = ${params.negocioId}::uuid
  `);

  if (op.lead_id) {
    await db.execute(sql`
      UPDATE leads SET estagio_pre_vendas = 'oportunidade', updated_at = now()
       WHERE id = ${op.lead_id}::uuid
    `);
  }

  await registrarEvento({
    organizacaoId: params.organizacaoId, tipo: "MeetingRescheduled", ator: params.ator,
    negocioId: params.negocioId, leadId: op.lead_id, reuniaoId: reuniao.reuniaoId,
    contexto: { reutilizouOportunidade: true },
  });

  return reuniao;
}

/* ── Trial (Bloco 02 §10) ──────────────────────────────────────────────── */

export async function iniciarTrial(params: {
  organizacaoId: string; negocioId: string; ator: Ator;
}): Promise<void> {
  await carregarOportunidade(params.organizacaoId, params.negocioId);

  // Trial é capacidade da OFERTA (SPEC §12.2). Antes disto o botão gravava
  // `trial_iniciado_em` sem gate nenhum: PABX e White Label — venda por
  // contrato, com implantação — podiam entrar em "trial" como qualquer outra.
  const { verificarTrialExigeOferta } = await import("./trial-exige-oferta");
  const bloqueio = await verificarTrialExigeOferta(params.organizacaoId, params.negocioId);
  if (bloqueio) {
    throw new RegraDeNegocio("trial_exige_oferta", bloqueio.erro,
      bloqueio.falta.includes("família comercial da oportunidade")
        ? { rotulo: "Definir família", tipo: "alterar_familia" } : undefined);
  }

  await db.execute(sql`
    UPDATE negocios SET trial_iniciado_em = now(), trial_encerrado_em = NULL, updated_at = now()
     WHERE id = ${params.negocioId}::uuid
  `);
  // Sem o espelho a data ficava só no legado (migration 0085) — o mesmo
  // buraco que a estagnação tinha.
  await espelharNoDominioV2([params.negocioId]);

  await registrarEvento({
    organizacaoId: params.organizacaoId, tipo: "TrialStarted",
    ator: params.ator, negocioId: params.negocioId,
    timeline: { tipo: "nota", titulo: "Trial iniciado" },
  });
}

export async function encerrarTrial(params: {
  organizacaoId: string; negocioId: string; ator: Ator;
}): Promise<void> {
  await carregarOportunidade(params.organizacaoId, params.negocioId);
  await db.execute(sql`
    UPDATE negocios SET trial_encerrado_em = now(), updated_at = now()
     WHERE id = ${params.negocioId}::uuid
  `);
  // Sem o espelho a data ficava só no legado (migration 0085) — o mesmo
  // buraco que a estagnação tinha.
  await espelharNoDominioV2([params.negocioId]);

  await registrarEvento({
    organizacaoId: params.organizacaoId, tipo: "TrialEnded",
    ator: params.ator, negocioId: params.negocioId,
  });
}

/* ── Espelho no Domain Model v2 ────────────────────────────────────────── */

/**
 * Mantém `oportunidades` (modelo v2) coerente com `negocios`.
 *
 * O projeto já tinha `syncOportunidadeFromNegocio`; aqui só se acrescentam os
 * campos que o módulo novo criou. Best-effort de propósito: uma falha no
 * espelho não pode desfazer a venda que já aconteceu.
 */
async function espelharNoDominioV2(negocioIds: string[]): Promise<void> {
  for (const negocioId of negocioIds) {
    try {
      const { syncOportunidadeFromNegocio } = await import("@/lib/crm/sync-domain-model");
      await syncOportunidadeFromNegocio(negocioId);
      // COALESCE nos dois campos derivados, e não no resto.
      //
      // O espelho copiava `service_family` e `source_process` sem condição, e o
      // legado é NULL neles em 475 e 63 oportunidades. O backfill tinha deduzido
      // esses valores de uma cadeia de evidências (negócio, item de proposta,
      // catálogo, item de contrato, serviço canônico); o espelho os apagava a
      // cada edição do negócio. Medido: um PABX real vira NULL depois de um
      // UPDATE destes.
      //
      // Apagar a família não é perda cosmética: é a política de Ganho que dorme
      // atrás dela. Sem família, PABX e White Label não geram jornada de
      // implantação, e o produto engole a etapa sem erro nenhum.
      //
      // Os outros campos seguem cópia direta de propósito: título, etapa,
      // `commercial_motion` e `lead_id` são editados no legado, e ali o usuário
      // esvaziar o campo é uma intenção, não uma ausência de evidência.
      await db.execute(sql`
        UPDATE oportunidades o SET
          titulo = n.titulo,
          service_family = COALESCE(n.service_family, o.service_family),
          etapa = n.etapa,
          commercial_motion = n.commercial_motion,
          source_process = COALESCE(n.source_process, o.source_process),
          lead_id = n.lead_id,
          updated_at = now()
        FROM negocios n
        WHERE o.negocio_id_legado = n.id AND n.id = ${negocioId}::uuid
      `);
    } catch (erro) {
      console.error(`[vendas] falha ao espelhar oportunidade ${negocioId} no domain model v2:`, erro);
    }
  }
}

/**
 * Troca o responsável da oportunidade.
 *
 * O seletor da tela só mexia no estado local e a página voltava ao responsável
 * antigo. Grava nas duas pontas (negócio e oportunidade canônica) e deixa o
 * evento com quem era, quem passou a ser e quando: é o que permite medir carga
 * e tempo por responsável depois.
 */
export async function atribuirResponsavelDaOportunidade(params: {
  organizacaoId: string;
  negocioId: string;
  responsavelId: string;
  ator: Ator;
  /** Agente responsável assume sem ser acionada agora (a delegação tem o calendário próprio de toques). */
  semAcionarAgente?: boolean;
}): Promise<void> {
  const op = await carregarOportunidade(params.organizacaoId, params.negocioId);
  // Gatilho "agente virou responsável" (e o inverso): vale para a mudança e também para repetir a atribuição, que converge.
  const aoAtribuir = async () => {
    const { aoMudarResponsavel } = await import("@/lib/ai-platform/operacao/atribuicoes");
    await aoMudarResponsavel({
      organizacaoId: params.organizacaoId, entidade: "negocio", entidadeId: params.negocioId, anteriorId: op.responsavel_id, novoId: params.responsavelId,
      ator: { usuarioId: params.ator.usuarioId }, semAcionar: params.semAcionarAgente,
    });
  };
  const [dono] = await db.execute<{ id: string }>(sql`
    SELECT id::text FROM usuarios
     WHERE id = ${params.responsavelId}::uuid AND organizacao_id = ${params.organizacaoId}::uuid AND ativo = true`);
  if (!dono) throw new RegraDeNegocio("responsavel_invalido", "Responsável inválido: não é um usuário ativo desta organização.");
  if (op.responsavel_id === params.responsavelId) { await aoAtribuir(); return; }

  await db.execute(sql`
    UPDATE negocios SET responsavel_id = ${params.responsavelId}::uuid, updated_at = now()
     WHERE id = ${params.negocioId}::uuid`);
  await db.execute(sql`
    UPDATE oportunidades SET responsavel_id = ${params.responsavelId}::uuid, updated_at = now()
     WHERE negocio_id_legado = ${params.negocioId}::uuid`);
  const nomes = await resolverNomes(params.organizacaoId, [op.responsavel_id, params.responsavelId].filter((x): x is string => !!x));
  await registrarEvento({
    organizacaoId: params.organizacaoId, tipo: "OpportunityAssigned", ator: params.ator,
    negocioId: params.negocioId, leadId: op.lead_id, empresaId: op.empresa_id,
    contexto: {
      de: op.responsavel_id, para: params.responsavelId,
      deNome: op.responsavel_id ? nomes.get(op.responsavel_id) ?? null : null,
      paraNome: nomes.get(params.responsavelId) ?? null,
    },
    timeline: { tipo: "nota", titulo: `Responsável da oportunidade alterado: ${op.responsavel_id ? nomes.get(op.responsavel_id) ?? "—" : "sem responsável"} → ${nomes.get(params.responsavelId) ?? "—"}` },
  });
  await aoAtribuir();
}
