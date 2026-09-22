/**
 * Motor de Prospecção (Bloco 04).
 *
 * Prospecção é workspace de outbound. Ela não substitui Pré-vendas e não é um
 * segundo Pipeline — a própria spec põe as duas coisas na lista de proibições.
 *
 * A correção conceitual mais importante deste bloco (§24): **a existência de
 * uma oportunidade deixa de significar que o prospect foi qualificado**. Agora
 * há duas saídas, e elas nunca se confundem:
 *
 *   Pré-qualificado    → cria Lead em Pré-vendas / Novo
 *   Oportunidade direta → cria Opportunity em Pipeline / Entrada
 *
 * O motor de cadências é CONSUMIDO, nunca reimplementado (§9): a configuração
 * pertence a Automações.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { registrarEvento } from "./eventos";
import { resolverEmpresa, resolverPessoa, registrarTouchpoint, type DadosEmpresa } from "./identidade";
import { criarOportunidade } from "./pipeline";
import { garantirEntradaCanonica } from "./ponte-canonica";
import {
  MOTIVOS_DESCARTE, RegraDeNegocio,
  type Ator, type EstadoProspeccao, type Familia, type MotivoDescarte,
} from "./dominio";

/* ── Entrada (Bloco 04 §5-6) ───────────────────────────────────────────── */

export interface EntradaDeProspect {
  organizacaoId: string;
  empresa: DadosEmpresa;
  /** Bloco 05 §2: Empresa pode existir sem Pessoa. Aqui isso é normal. */
  pessoa?: {
    nome: string;
    sobrenome?: string | null;
    email?: string | null;
    telefone?: string | null;
    whatsapp?: string | null;
    cargo?: string | null;
  } | null;
  fonte?: string | null;
  lista?: string | null;
  responsavelId?: string | null;
  importado?: boolean;
}

export interface ProspectCriado {
  leadId: string;
  empresaId: string;
  pessoaId: string | null;
  jaExistia: boolean;
}

/**
 * Adiciona uma empresa à base outbound.
 *
 * Deduplica antes de criar (§6): a mesma empresa aparecendo em outra lista ou
 * importação não pode virar um registro novo. Ela pode participar de várias
 * listas ao longo do tempo, preservando o histórico.
 */
export async function adicionarProspect(entrada: EntradaDeProspect, ator: Ator): Promise<ProspectCriado> {
  const { organizacaoId } = entrada;

  const empresa = await resolverEmpresa(organizacaoId, entrada.empresa, ator);

  let pessoaId: string | null = null;
  if (entrada.pessoa?.nome) {
    const pessoa = await resolverPessoa(organizacaoId, {
      ...entrada.pessoa, empresaId: empresa.empresaId,
    }, ator);
    pessoaId = pessoa.pessoaId;
  }

  // O prospect operacional vive em `leads` com `prospeccao_estado`, que é a
  // mesma linha que Pré-vendas usa depois. É de propósito: pré-qualificar não
  // pode significar copiar a empresa de uma tabela para outra.
  const [existente] = await db.execute<{ id: string; estado: string | null }>(sql`
    SELECT id::text, prospeccao_estado AS estado FROM leads
     WHERE organizacao_id = ${organizacaoId}::uuid
       AND empresa_id = ${empresa.empresaId}::uuid
       AND prospeccao_estado IS NOT NULL
     ORDER BY created_at DESC LIMIT 1
  `);

  if (existente) {
    if (entrada.lista) await adicionarALista(organizacaoId, existente.id, entrada.lista);
    return { leadId: existente.id, empresaId: empresa.empresaId, pessoaId, jaExistia: true };
  }

  const [prospect] = await db.execute<{ id: string }>(sql`
    INSERT INTO leads (
      organizacao_id, nome, sobrenome, email, telefone, whatsapp, cargo,
      empresa_id, empresa, origem, responsavel_id, tipo, status, sdr_status,
      prospeccao_estado
    ) VALUES (
      ${organizacaoId}::uuid,
      ${entrada.pessoa?.nome ?? entrada.empresa.nome},
      ${entrada.pessoa?.sobrenome ?? null},
      ${entrada.pessoa?.email ?? null},
      ${entrada.pessoa?.telefone ?? null},
      ${entrada.pessoa?.whatsapp ?? null},
      ${entrada.pessoa?.cargo ?? null},
      ${empresa.empresaId}::uuid,
      ${entrada.empresa.nome},
      'outbound',
      ${entrada.responsavelId ?? null}::uuid,
      'contato', 'novo', 'pending',
      'novo'
    )
    RETURNING id::text
  `);

  // A ENTRADA CANÔNICA, que faltava.
  //
  // Esta função criava o lead legado e parava aí. O caminho irmão — a
  // importação de lista, em `api-server/routes/prospeccao.ts` — já chamava a
  // porta desde a fase 16; este, que é o "adicionar prospect" da tela, nunca
  // chamou. Medido com `smoke-prospeccao-entra-no-canonico` em 22/09: um
  // prospect criado pela tela nascia com **0 aquisições, 0 pessoas canônicas,
  // 0 eventos `AcquisitionCreated` e fora do board canônico**.
  //
  // Os 3.598 leads do banco terem aquisição não desmentia isso: eles têm porque
  // o backfill da fase 06 rodou UMA vez sobre o que já existia. Contagem
  // histórica mede o passado; o buraco estava no runtime.
  //
  // `await`, não `void`: a entrada canônica é parte do resultado de adicionar
  // um prospect, não um efeito colateral que pode falhar calado.
  const canonica = await garantirEntradaCanonica({
    organizacaoId, tipo: "OUTBOUND",
    origem: entrada.fonte ?? "outbound", provider: "prospeccao",
    pessoa: {
      nome: entrada.pessoa?.nome ?? entrada.empresa.nome,
      sobrenome: entrada.pessoa?.sobrenome ?? null,
      email: entrada.pessoa?.email ?? null,
      telefone: entrada.pessoa?.telefone ?? null,
      cargo: entrada.pessoa?.cargo ?? null,
    },
    empresa: entrada.empresa,
    responsavelId: entrada.responsavelId ?? null,
    // O par (organização, lead) é a chave do fato: a mesma tela chamada duas
    // vezes para o mesmo prospect não pode render duas aquisições.
    idempotencyKey: `prospeccao:${organizacaoId}:${prospect.id}`,
  }, prospect.id);
  // Falhar duro, MENOS quando a recusa é legítima.
  //
  // A primeira versão desta trava lançava em toda falha da ponte, e derrubou o
  // caso mais comum do outbound: o prospect que nasce com empresa e nome
  // porque o contato ainda vai ser descoberto. O domínio recusa esse registro
  // de propósito — sem e-mail nem telefone não há como deduplicar — e recusa
  // certo. Quem errou foi a trava, ao tratar uma condição de negócio como
  // defeito. É o terceiro guarda desta leva a recusar a decisão correta, e a
  // conclusão já não é nova: guarda que impede o certo custa tanto quanto
  // guarda nenhum.
  //
  // Sem identificador o prospect segue sem par canônico, e quem o traz de volta
  // é `preQualificar` — a saída do outbound para Pré-vendas, onde o contato já
  // foi descoberto. Qualquer outro código continua sendo falha dura.
  if (!canonica.ok && canonica.codigo !== "SEM_IDENTIFICADOR") {
    throw new RegraDeNegocio(
      "prospect_sem_entrada_canonica",
      `O prospect foi criado mas não entrou no modelo canônico: ${canonica.erro ?? "motivo não informado"}`,
    );
  }

  // E o vínculo da pessoa com o lead.
  //
  // `resolverPessoa` roda ANTES do INSERT acima, porque o lead precisa do
  // `empresa_id` e do contato já resolvidos. O efeito colateral é que a pessoa
  // nasce sem saber a qual lead pertence, e a porta canônica não conserta: ela
  // reaproveita a pessoa que já existe em vez de criar outra.
  //
  // Que isso é anomalia, e não uma escolha, o banco responde: **3.950 de 3.950
  // pessoas têm `lead_id_legado`**, sem uma exceção. Um prospect criado pela
  // tela seria o primeiro registro sem o vínculo.
  //
  // `IS NULL` no WHERE: pessoa já ligada a outro lead não é religada aqui.
  if (pessoaId) {
    await db.execute(sql`
      UPDATE pessoas SET lead_id_legado = ${prospect.id}::uuid
       WHERE id = ${pessoaId}::uuid
         AND organizacao_id = ${organizacaoId}::uuid
         AND lead_id_legado IS NULL`);
  }

  await registrarTouchpoint({
    organizacaoId, pessoaId, empresaId: empresa.empresaId, leadIdLegado: prospect.id,
    touchpoint: {
      tipoOrigem: "importacao", source: entrada.fonte ?? "outbound",
      medium: "outbound", campaign: entrada.lista ?? null,
    },
  });

  if (entrada.lista) await adicionarALista(organizacaoId, prospect.id, entrada.lista);

  await registrarEvento({
    organizacaoId, tipo: entrada.importado ? "ProspectImported" : "ProspectAdded", ator,
    leadId: prospect.id, empresaId: empresa.empresaId, pessoaId,
    contexto: { fonte: entrada.fonte ?? null, lista: entrada.lista ?? null, empresaJaExistia: !empresa.criada },
    timeline: { tipo: "nota", titulo: "Prospect adicionado", descricao: entrada.lista ?? entrada.fonte ?? "Outbound" },
  });

  return { leadId: prospect.id, empresaId: empresa.empresaId, pessoaId, jaExistia: false };
}

/** Bloco 04 §19: uma empresa participa de várias listas ao longo do tempo. */
async function adicionarALista(organizacaoId: string, leadId: string, lista: string): Promise<void> {
  const [existente] = await db.execute<{ id: string }>(sql`
    SELECT id::text FROM labels
     WHERE organizacao_id = ${organizacaoId}::uuid AND lower(nome) = ${lista.toLowerCase()}
     LIMIT 1
  `);
  let labelId = existente?.id;
  if (!labelId) {
    const [criada] = await db.execute<{ id: string }>(sql`
      INSERT INTO labels (organizacao_id, nome, cor) VALUES (${organizacaoId}::uuid, ${lista}, '#2563EB')
      RETURNING id::text
    `);
    labelId = criada.id;
  }
  await db.execute(sql`
    INSERT INTO lead_labels (lead_id, label_id) VALUES (${leadId}::uuid, ${labelId}::uuid)
    ON CONFLICT DO NOTHING
  `);
}

/* ── Leitura de apoio ──────────────────────────────────────────────────── */

interface ProspectInterno extends Record<string, unknown> {
  id: string;
  organizacao_id: string;
  estado: EstadoProspeccao | null;
  empresa_id: string | null;
  empresa: string | null;
  nome: string;
  sobrenome: string | null;
  email: string | null;
  telefone: string | null;
  cargo: string | null;
  responsavel_id: string | null;
}

async function carregarProspect(organizacaoId: string, leadId: string): Promise<ProspectInterno> {
  const [p] = await db.execute<ProspectInterno>(sql`
    SELECT id::text, organizacao_id::text, prospeccao_estado AS estado,
           empresa_id::text, empresa, nome, sobrenome, email, telefone, cargo,
           responsavel_id::text
      FROM leads WHERE id = ${leadId}::uuid AND organizacao_id = ${organizacaoId}::uuid
  `);
  if (!p) throw new RegraDeNegocio("prospect_nao_encontrado", "Prospect não encontrado.");
  return p;
}

async function mudarEstado(
  prospect: ProspectInterno, para: EstadoProspeccao, ator: Ator, motivo?: string | null,
): Promise<void> {
  await db.execute(sql`
    UPDATE leads SET prospeccao_estado = ${para}, updated_at = now() WHERE id = ${prospect.id}::uuid
  `);
  await db.execute(sql`
    INSERT INTO status_changes (lead_id, de_status, para_status, usuario_id, motivo)
    VALUES (${prospect.id}::uuid, ${prospect.estado}, ${`prospeccao:${para}`},
            ${ator.usuarioId ?? null}::uuid, ${motivo ?? null})
  `);
}

/* ── Cadência (Bloco 04 §8-9) ──────────────────────────────────────────── */

/** Inscreve o prospect numa cadência. O motor é o de Automações; aqui só se
 *  registra o estado operacional e o evento. */
export async function inscreverEmCadencia(params: {
  organizacaoId: string;
  leadId: string;
  cadenceDefinitionId: string;
  ator: Ator;
}): Promise<{ enrollmentId: string | null }> {
  const prospect = await carregarProspect(params.organizacaoId, params.leadId);

  const { iniciarCadencia } = await import("@/lib/cadencia/cadence-engine");
  const enrollmentId = await iniciarCadencia({
    cadenceDefinitionId: params.cadenceDefinitionId,
    organizacaoId: params.organizacaoId,
    entityType: "lead",
    entityId: params.leadId,
    varsIniciais: {
      nome: prospect.nome, empresa: prospect.empresa,
      email: prospect.email, telefone: prospect.telefone,
    },
  });

  if (!enrollmentId) {
    throw new RegraDeNegocio("cadencia_indisponivel", "Cadência inativa ou sem passos publicados.");
  }

  await mudarEstado(prospect, "em_cadencia", params.ator, "Inscrito em cadência");
  await registrarEvento({
    organizacaoId: params.organizacaoId, tipo: "CadenceEnrolled", ator: params.ator,
    leadId: params.leadId, empresaId: prospect.empresa_id,
    contexto: { cadenceDefinitionId: params.cadenceDefinitionId, enrollmentId },
    timeline: { tipo: "nota", titulo: "Prospect entrou em cadência" },
  });

  return { enrollmentId };
}

export async function pausarCadencia(params: {
  organizacaoId: string; leadId: string; motivo: string; ator: Ator;
}): Promise<void> {
  const prospect = await carregarProspect(params.organizacaoId, params.leadId);
  await db.execute(sql`
    UPDATE cadence_enrollments
       SET status = 'cancelled', cancelled_at = now(), cancel_reason = ${params.motivo}, updated_at = now()
     WHERE organizacao_id = ${params.organizacaoId}::uuid
       AND entity_type = 'lead' AND entity_id = ${params.leadId}::uuid
       AND status IN ('active','waiting')
  `);
  await registrarEvento({
    organizacaoId: params.organizacaoId, tipo: "CadencePaused", ator: params.ator,
    leadId: params.leadId, empresaId: prospect.empresa_id, contexto: { motivo: params.motivo },
  });
}

/** Bloco 04 §10: responder NÃO significa qualificado. É só sinal de interação. */
export async function registrarResposta(params: {
  organizacaoId: string; leadId: string; canal?: string | null; ator: Ator;
}): Promise<void> {
  const prospect = await carregarProspect(params.organizacaoId, params.leadId);
  if (prospect.estado === "respondeu") return;

  await mudarEstado(prospect, "respondeu", params.ator, "Resposta recebida");
  await registrarEvento({
    organizacaoId: params.organizacaoId, tipo: "ProspectReplied", ator: params.ator,
    leadId: params.leadId, empresaId: prospect.empresa_id,
    contexto: { canal: params.canal ?? null },
    timeline: { tipo: params.canal ?? "nota", titulo: "Prospect respondeu" },
  });
}

/** Bloco 04 §14: cadência encerrada sem resposta. O histórico não é apagado. */
export async function marcarSemResposta(params: {
  organizacaoId: string; leadId: string; ator: Ator;
}): Promise<void> {
  const prospect = await carregarProspect(params.organizacaoId, params.leadId);
  await mudarEstado(prospect, "sem_resposta", params.ator, "Cadência concluída sem resposta");
  await registrarEvento({
    organizacaoId: params.organizacaoId, tipo: "ProspectNoResponse", ator: params.ator,
    leadId: params.leadId, empresaId: prospect.empresa_id,
  });
}

/* ── Saída 1: pré-qualificado → Pré-vendas (Bloco 04 §11) ──────────────── */

/**
 * Entrega o prospect à jornada formal de Pré-vendas.
 *
 * Pré-qualificado NÃO é o Qualificado de Pré-vendas: significa que o outbound
 * achou sinal suficiente para entregar a empresa, e ela entra em NOVO para
 * percorrer a jornada inteira.
 *
 * O Lead nasce na MESMA linha do prospect, então empresa, pessoas, origem,
 * lista, cadência, histórico, responsável e tags são preservados sem cópia —
 * perder isso no handoff está entre as proibições do bloco.
 */
export async function preQualificar(params: {
  organizacaoId: string; leadId: string; ator: Ator;
}): Promise<{ leadId: string }> {
  const prospect = await carregarProspect(params.organizacaoId, params.leadId);
  if (!prospect.empresa_id) {
    throw new RegraDeNegocio("prospect_sem_empresa", "Prospect sem empresa não pode virar Lead de Pré-vendas.");
  }
  if (prospect.estado === "pre_qualificado") return { leadId: prospect.id };

  await db.execute(sql`
    UPDATE leads SET
      prospeccao_estado = 'pre_qualificado',
      pre_qualificado = true,
      pre_qualificado_em = COALESCE(pre_qualificado_em, now()),
      pre_qualificado_por = COALESCE(pre_qualificado_por, ${params.ator.usuarioId ?? null}::uuid),
      tipo = 'lead',
      estagio_pre_vendas = 'novo',
      status = 'novo',
      sdr_status = 'pending',
      updated_at = now()
     WHERE id = ${params.leadId}::uuid
  `);

  await db.execute(sql`
    INSERT INTO status_changes (lead_id, de_status, para_status, usuario_id, motivo)
    VALUES (${params.leadId}::uuid, ${`prospeccao:${prospect.estado ?? "novo"}`}, 'novo',
            ${params.ator.usuarioId ?? null}::uuid, 'Pré-qualificado no outbound')
  `);

  // A segunda chance de entrar no canônico.
  //
  // O prospect pode ter nascido sem e-mail nem telefone, e nesse caso
  // `adicionarProspect` não conseguiu abrir a aquisição. Aqui ele está virando
  // Lead de Pré-vendas, o que só acontece depois de alguém falar com a empresa:
  // é o momento em que o contato costuma existir. Sem esta chamada, relaxar a
  // trava lá em cima teria trocado um erro por um órfão permanente, que é o
  // buraco que o CP42 existe para tapar.
  //
  // Chamar de novo é seguro por dois caminhos independentes de deduplicação: a
  // mesma `idempotencyKey` devolve a aquisição que já existe, e uma aquisição
  // aberta para a mesma identidade também. Por isso a chave é IDÊNTICA à de
  // `adicionarProspect` — mudá-la abriria um segundo processo para o mesmo fato.
  //
  // Sem `if (email || telefone)` de propósito: o que conta como identificador é
  // regra do domínio, que normaliza antes de decidir. Repetir o teste aqui com
  // truthiness criaria uma segunda versão da mesma regra.
  //
  // ANTES da porta, o contato descoberto precisa chegar na pessoa que já está
  // ligada a este lead. Sem isso nascem DUAS pessoas para o mesmo prospect, e o
  // banco mostra como: `adicionarProspect` resolve a pessoa pelo caminho de
  // vendas (que cria com nome, sem exigir contato) e a porta resolve pelo
  // caminho do domínio (que só acha por e-mail ou telefone). Enquanto a pessoa
  // ligada ao lead não tiver o contato, o domínio não a reconhece e cria outra
  // — e o `idx_pessoas_lead_legado`, que é ÚNICO, estoura na hora de ligar a
  // segunda ao mesmo lead. Medido em 22/09, com o prospect sem contato sendo
  // pré-qualificado depois do enriquecimento.
  //
  // `COALESCE` e não atribuição: enriquecimento preenche o que falta, nunca
  // sobrescreve o que alguém já apurou. E sem tocar `updated_at`, pelo mesmo
  // motivo que o backfill não toca: a coluna é sinal de atividade na tela.
  await db.execute(sql`
    UPDATE pessoas SET
      email = COALESCE(email, ${prospect.email ?? null}),
      telefone = COALESCE(telefone, ${prospect.telefone ?? null})
     WHERE lead_id_legado = ${prospect.id}::uuid
       AND organizacao_id = ${params.organizacaoId}::uuid
       AND (email IS NULL OR telefone IS NULL)`);

  const canonica = await garantirEntradaCanonica({
    organizacaoId: params.organizacaoId, tipo: "OUTBOUND",
    origem: "outbound", provider: "prospeccao",
    pessoa: {
      nome: prospect.nome, sobrenome: prospect.sobrenome ?? null,
      email: prospect.email ?? null, telefone: prospect.telefone ?? null,
      cargo: prospect.cargo ?? null,
    },
    empresa: { nome: prospect.empresa ?? "" },
    responsavelId: prospect.responsavel_id ?? null,
    idempotencyKey: `prospeccao:${params.organizacaoId}:${prospect.id}`,
  }, prospect.id);
  // O `NOT EXISTS` é o cinto: `lead_id_legado IS NULL` protege a pessoa que já
  // aponta para OUTRO lead, não o lead que já tem dono. Se a propagação acima
  // não bastar para o domínio reconhecer a pessoa (um telefone que normaliza
  // diferente, por exemplo), sem esta cláusula o UPDATE tentaria ligar a
  // segunda pessoa ao mesmo lead e derrubaria a pré-qualificação inteira por
  // violação de índice.
  if (canonica.ok && canonica.pessoaId) {
    await db.execute(sql`
      UPDATE pessoas SET lead_id_legado = ${prospect.id}::uuid
       WHERE id = ${canonica.pessoaId}::uuid
         AND organizacao_id = ${params.organizacaoId}::uuid
         AND lead_id_legado IS NULL
         AND NOT EXISTS (SELECT 1 FROM pessoas o WHERE o.lead_id_legado = ${prospect.id}::uuid)`);
  }

  await registrarEvento({
    organizacaoId: params.organizacaoId, tipo: "ProspectPreQualified", ator: params.ator,
    leadId: params.leadId, empresaId: prospect.empresa_id,
    timeline: {
      tipo: "nota", titulo: "Prospect pré-qualificado",
      descricao: "Entrou em Pré-vendas na etapa Novo, com a origem outbound preservada.",
    },
  });

  return { leadId: params.leadId };
}

/* ── Saída 2: oportunidade direta (Bloco 04 §12-13) ────────────────────── */

/**
 * Cria a oportunidade direto no Pipeline, sem passar por Pré-vendas.
 *
 * Bloco 04 §13: não fingir que passou por Pré-vendas. A oportunidade nasce com
 * `source_process = OUTBOUND_DIRECT`, e é isso que permite medir depois a
 * eficiência de cada caminho. Criar Lead de Pré-vendas quando a ação escolhida
 * foi Oportunidade Direta está entre as proibições.
 */
export async function criarOportunidadeDireta(params: {
  organizacaoId: string;
  leadId: string;
  familias: Familia[];
  responsavelId: string;
  ator: Ator;
}): Promise<{ oportunidades: Array<{ id: string; familia: Familia | null; titulo: string }>; bundleId: string | null }> {
  const prospect = await carregarProspect(params.organizacaoId, params.leadId);
  if (!prospect.empresa_id) {
    throw new RegraDeNegocio("prospect_sem_empresa", "Oportunidade exige Empresa.");
  }

  const resultado = await criarOportunidade({
    organizacaoId: params.organizacaoId,
    empresaId: prospect.empresa_id,
    familias: params.familias,
    responsavelId: params.responsavelId,
    sourceProcess: "OUTBOUND_DIRECT",
    leadId: params.leadId,
  }, params.ator);

  // O prospect muda de estado, mas NÃO vira Lead de Pré-vendas: a jornada
  // escolhida foi a direta, e `estagio_pre_vendas` fica como está.
  await mudarEstado(prospect, "oportunidade", params.ator, "Oportunidade criada direto do outbound");

  return { oportunidades: resultado.oportunidades, bundleId: resultado.bundleId };
}

/* ── Descarte (Bloco 04 §15) ───────────────────────────────────────────── */

/**
 * Descarta o prospect.
 *
 * Em Prospecção é "Descartado", não "Desqualificado": nem todo prospect
 * descartado passou por uma qualificação comercial formal. `Desqualificado`
 * fica reservado a Pré-vendas, e chamar um de outro está na lista de
 * proibições do bloco.
 */
export async function descartar(params: {
  organizacaoId: string;
  leadId: string;
  motivo: MotivoDescarte;
  ator: Ator;
}): Promise<void> {
  if (!MOTIVOS_DESCARTE.some((m) => m.chave === params.motivo)) {
    throw new RegraDeNegocio("descarte_exige_motivo", "Escolha um motivo válido para o descarte.");
  }
  const prospect = await carregarProspect(params.organizacaoId, params.leadId);

  await db.execute(sql`
    UPDATE leads SET
      prospeccao_estado = 'descartado',
      prospeccao_descarte_motivo = ${params.motivo},
      prospeccao_descartado_em = now(),
      prospeccao_descartado_por = ${params.ator.usuarioId ?? null}::uuid,
      updated_at = now()
     WHERE id = ${params.leadId}::uuid
  `);

  await db.execute(sql`
    UPDATE cadence_enrollments
       SET status = 'cancelled', cancelled_at = now(), cancel_reason = 'Prospect descartado', updated_at = now()
     WHERE organizacao_id = ${params.organizacaoId}::uuid
       AND entity_type = 'lead' AND entity_id = ${params.leadId}::uuid
       AND status IN ('active','waiting')
  `);

  await registrarEvento({
    organizacaoId: params.organizacaoId, tipo: "ProspectDiscarded", ator: params.ator,
    leadId: params.leadId, empresaId: prospect.empresa_id,
    contexto: { motivo: params.motivo, estadoAnterior: prospect.estado },
    timeline: { tipo: "nota", titulo: "Prospect descartado", descricao: params.motivo },
  });
}

/** Bloco 04 §21: responsabilidade clara, com histórico de quem transferiu. */
export async function atribuirProspect(params: {
  organizacaoId: string;
  leadId: string;
  responsavelId: string | null;
  origemAtribuicao?: "manual" | "automacao" | "agente" | "round_robin";
  ator: Ator;
}): Promise<void> {
  const prospect = await carregarProspect(params.organizacaoId, params.leadId);
  if (prospect.responsavel_id === params.responsavelId) return;

  await db.execute(sql`
    UPDATE leads SET responsavel_id = ${params.responsavelId}::uuid, updated_at = now()
     WHERE id = ${params.leadId}::uuid
  `);
  await registrarEvento({
    organizacaoId: params.organizacaoId, tipo: "ProspectAssigned", ator: params.ator,
    leadId: params.leadId, empresaId: prospect.empresa_id,
    contexto: {
      de: prospect.responsavel_id, para: params.responsavelId,
      origemAtribuicao: params.origemAtribuicao ?? "manual",
    },
  });
}
