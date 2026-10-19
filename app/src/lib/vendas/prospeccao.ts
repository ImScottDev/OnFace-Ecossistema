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
import { exigirResponsavelDaOrg } from "./pre-vendas";
import { garantirEntradaCanonica } from "./ponte-canonica";
import {
  ATOR_SISTEMA, ESTADOS_PROSPECCAO, FAMILIAS, MOTIVOS_DESCARTE, RegraDeNegocio,
  type Ator, type EstadoProspeccao, type Familia, type MotivoDescarte,
} from "./dominio";
import { transicao } from "./prospeccao-transicoes";

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

  // Mesma guarda de tenant de Pré-vendas: responsável de outra organização ou
  // inativo estourava na chave estrangeira e voltava como erro genérico.
  await exigirResponsavelDaOrg(organizacaoId, entrada.responsavelId);

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

/**
 * Valida a transição contra a máquina de estados e devolve `true` quando o
 * prospect JÁ está no destino (o comando então é idempotente: clique repetido
 * e requisição duplicada não repetem o efeito). Recusa vira RegraDeNegocio.
 */
function exigirTransicao(prospect: ProspectInterno, para: EstadoProspeccao): boolean {
  const t = transicao(prospect.estado, para);
  if (t.permitida) return false;
  if (t.igual) return true;
  throw new RegraDeNegocio("transicao_invalida", t.motivo);
}

/**
 * Troca o estado com compare-and-swap: só grava se o estado ainda é o que foi
 * lido. Duas abas, dois cliques ou uma automação concorrente não atropelam uma
 * à outra, e quem perde a corrida recebe uma mensagem em vez de um estado
 * silenciosamente sobrescrito.
 */
async function mudarEstado(
  prospect: ProspectInterno, para: EstadoProspeccao, ator: Ator, motivo?: string | null,
): Promise<void> {
  const trocou = await db.execute<{ id: string }>(sql`
    UPDATE leads SET prospeccao_estado = ${para}, updated_at = now()
     WHERE id = ${prospect.id}::uuid AND organizacao_id = ${prospect.organizacao_id}::uuid
       AND prospeccao_estado IS NOT DISTINCT FROM ${prospect.estado}
    RETURNING id::text
  `);
  if (trocou.length === 0) {
    throw new RegraDeNegocio("prospect_mudou", "Este prospect mudou de estado enquanto você agia. Atualizei a tela com o estado atual.");
  }
  await registrarMudancaDeEstado(prospect, para, ator, motivo);
}

async function registrarMudancaDeEstado(
  prospect: ProspectInterno, para: EstadoProspeccao, ator: Ator, motivo?: string | null,
): Promise<void> {
  await db.execute(sql`
    INSERT INTO status_changes (lead_id, de_status, para_status, usuario_id, motivo)
    VALUES (${prospect.id}::uuid, ${prospect.estado ? `prospeccao:${prospect.estado}` : null}, ${`prospeccao:${para}`},
            ${ator.usuarioId ?? null}::uuid, ${motivo ?? null})
  `);
}

/* ── Cadência (Bloco 04 §8-9) ──────────────────────────────────────────── */

/** Enrollments que ainda "seguram" o prospect numa cadência (inclui pausada). */
const STATUS_VIVOS = sql`ARRAY['active','waiting','waiting_reply','paused']`;

/**
 * Cadência válida = ativa, da organização, para leads, com passos. É a mesma
 * condição que `iniciarCadencia` aplica, verificada ANTES para devolver o
 * motivo exato em vez de um "indisponível" genérico.
 */
async function exigirCadenciaValida(organizacaoId: string, userId: string | null, cadenceDefinitionId: string): Promise<{ nome: string }> {
  const [d] = await db.execute<{ nome: string; ativo: boolean; entity_type: string; passos: number }>(sql`
    SELECT cd.nome, cd.ativo, cd.entity_type,
           COALESCE(jsonb_array_length(COALESCE(cv.compiled_steps, cd.steps)), 0)::int AS passos
      FROM cadence_definitions cd
      LEFT JOIN cadence_definition_pointers cp ON cp.cadence_definition_id = cd.id AND cp.organizacao_id = cd.organizacao_id
      LEFT JOIN cadence_versions cv ON cv.id = cp.published_version_id AND cv.organizacao_id = cd.organizacao_id
     WHERE cd.id = ${cadenceDefinitionId}::uuid AND cd.organizacao_id = ${organizacaoId}::uuid
       AND (cd.visibility = 'shared' OR cd.owner_id = ${userId}::uuid)
  `);
  if (!d) throw new RegraDeNegocio("cadencia_invalida", "Cadência não encontrada nesta organização.");
  if (!d.ativo) throw new RegraDeNegocio("cadencia_invalida", `A cadência "${d.nome}" está inativa. Ative-a em Automações › Cadências.`);
  if (d.entity_type !== "lead") throw new RegraDeNegocio("cadencia_invalida", `A cadência "${d.nome}" não é para leads.`);
  if (d.passos === 0) throw new RegraDeNegocio("cadencia_invalida", `A cadência "${d.nome}" não tem passos publicados.`);
  return { nome: d.nome };
}

/** Inscreve o prospect numa cadência. O motor é o de Automações; aqui só se
 *  registra o estado operacional e o evento. */
export async function inscreverEmCadencia(params: {
  organizacaoId: string;
  leadId: string;
  cadenceDefinitionId: string;
  ator: Ator;
}): Promise<{ enrollmentId: string | null }> {
  const prospect = await carregarProspect(params.organizacaoId, params.leadId);

  // Já em cadência: clique repetido não abre uma segunda matrícula.
  if (exigirTransicao(prospect, "em_cadencia")) {
    const [viva] = await db.execute<{ id: string }>(sql`
      SELECT id::text FROM cadence_enrollments
       WHERE organizacao_id = ${params.organizacaoId}::uuid AND entity_type = 'lead'
         AND entity_id = ${params.leadId}::uuid AND status = ANY(${STATUS_VIVOS}::text[])
       ORDER BY started_at DESC LIMIT 1`);
    return { enrollmentId: viva?.id ?? null };
  }

  const cadencia = await exigirCadenciaValida(params.organizacaoId, params.ator.usuarioId, params.cadenceDefinitionId);

  // Uma cadência viva por prospect: duas fariam a mesma empresa receber duas
  // abordagens em paralelo e o "passo atual" deixaria de ter um dono.
  const [viva] = await db.execute<{ nome: string }>(sql`
    SELECT cd.nome FROM cadence_enrollments ce JOIN cadence_definitions cd ON cd.id = ce.cadence_definition_id
     WHERE ce.organizacao_id = ${params.organizacaoId}::uuid AND ce.entity_type = 'lead'
       AND ce.entity_id = ${params.leadId}::uuid AND ce.status = ANY(${STATUS_VIVOS}::text[])
     LIMIT 1`);
  if (viva) {
    throw new RegraDeNegocio("ja_em_cadencia", `Esta empresa já está na cadência "${viva.nome}". Pause ou remova antes de inscrever em outra.`);
  }

  const { iniciarCadencia } = await import("@/lib/cadencia/cadence-engine");
  const enrollmentId = await iniciarCadencia({
    cadenceDefinitionId: params.cadenceDefinitionId,
    organizacaoId: params.organizacaoId,
    actorId: params.ator.usuarioId,
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

  try {
    await mudarEstado(prospect, "em_cadencia", params.ator, "Inscrito em cadência");
  } catch (erro) {
    // Perdeu a corrida: desfaz a matrícula para não deixar uma cadência rodando
    // em prospect que o estado diz que não está nela.
    const { cancelarCadencia } = await import("@/lib/cadencia/cadence-engine");
    await cancelarCadencia(enrollmentId, "Inscrição desfeita: o prospect mudou de estado");
    throw erro;
  }
  await registrarEvento({
    organizacaoId: params.organizacaoId, tipo: "CadenceEnrolled", ator: params.ator,
    leadId: params.leadId, empresaId: prospect.empresa_id,
    contexto: { cadenceDefinitionId: params.cadenceDefinitionId, cadenciaNome: cadencia.nome, enrollmentId },
    timeline: { tipo: "nota", titulo: "Prospect entrou em cadência", descricao: cadencia.nome },
  });

  return { enrollmentId };
}

/**
 * Pausa a cadência viva do prospect. Usa o `paused` do próprio motor (o mesmo
 * da ficha da Pessoa): a versão anterior CANCELAVA a matrícula, o que perdia o
 * ponto em que a cadência estava e deixava o prospect "em cadência" sem
 * cadência nenhuma.
 */
export async function pausarCadencia(params: {
  organizacaoId: string; leadId: string; motivo: string; ator: Ator;
}): Promise<void> {
  const prospect = await carregarProspect(params.organizacaoId, params.leadId);
  const vivas = await db.execute<{ id: string; passo: string | null }>(sql`
    UPDATE cadence_enrollments
       SET status = 'paused', scheduled_at = NULL, next_eval_at = NULL, claimed_until = NULL,
           cancel_reason = ${params.motivo}, updated_at = now()
     WHERE organizacao_id = ${params.organizacaoId}::uuid
       AND entity_type = 'lead' AND entity_id = ${params.leadId}::uuid
       AND status IN ('active','waiting','waiting_reply')
    RETURNING id::text, current_step_id AS passo
  `);
  if (vivas.length === 0) {
    throw new RegraDeNegocio("sem_cadencia", "Esta empresa não está numa cadência ativa.");
  }
  for (const v of vivas) {
    await db.execute(sql`INSERT INTO cadence_enrollment_events (enrollment_id, step_id, status, resultado)
      VALUES (${v.id}::uuid, ${v.passo ?? "-"}, 'pause',
              ${JSON.stringify({ actorId: params.ator.usuarioId, origem: "prospeccao", motivo: params.motivo })}::jsonb)`);
  }
  await registrarEvento({
    organizacaoId: params.organizacaoId, tipo: "CadencePaused", ator: params.ator,
    leadId: params.leadId, empresaId: prospect.empresa_id, contexto: { motivo: params.motivo },
    timeline: { tipo: "nota", titulo: "Cadência pausada", descricao: params.motivo },
  });
}

/**
 * Prova de que o prospect respondeu: algo REAL no Atendimento ou no motor,
 * posterior à matrícula mais recente. Nunca uma flag que a tela marca.
 *   1. o motor registrou entrada (`cadence_enrollments.last_inbound_at`);
 *   2. WhatsApp recebido (`whatsapp_mensagens.direcao = 'in'`) do lead;
 *   3. comunicação recebida (`communications.direcao = 'in'`) de uma pessoa do lead.
 */
export async function evidenciaDeResposta(organizacaoId: string, leadId: string): Promise<
  { em: string; canal: string } | null
> {
  const [e] = await db.execute<{ em: string | null; canal: string | null }>(sql`
    WITH desde AS (
      SELECT COALESCE(max(started_at), '-infinity'::timestamptz) AS t FROM cadence_enrollments
       WHERE organizacao_id = ${organizacaoId}::uuid AND entity_type = 'lead' AND entity_id = ${leadId}::uuid
    ), achados AS (
      SELECT ce.last_inbound_at AS em, 'cadência' AS canal FROM cadence_enrollments ce, desde
       WHERE ce.organizacao_id = ${organizacaoId}::uuid AND ce.entity_type = 'lead' AND ce.entity_id = ${leadId}::uuid
         AND ce.last_inbound_at IS NOT NULL AND ce.last_inbound_at >= desde.t
      UNION ALL
      SELECT m.created_at, 'whatsapp' FROM whatsapp_mensagens m, desde
       WHERE m.lead_id = ${leadId}::uuid AND m.direcao = 'in' AND m.created_at >= desde.t
      UNION ALL
      SELECT c.ocorrido_em, c.canal FROM communications c, desde
       WHERE c.organizacao_id = ${organizacaoId}::uuid AND c.direcao = 'in' AND c.ocorrido_em >= desde.t
         AND c.pessoa_id IN (SELECT id FROM pessoas WHERE lead_id_legado = ${leadId}::uuid)
    )
    SELECT em::text, canal FROM achados ORDER BY em DESC LIMIT 1
  `);
  return e?.em ? { em: e.em, canal: e.canal ?? "outro" } : null;
}

/**
 * Bloco 04 §10: responder NÃO significa qualificado. É só sinal de interação.
 *
 * Exige evidência real (`evidenciaDeResposta`) OU uma confirmação manual com
 * canal e observação, que fica gravada no evento com quem confirmou. Sem
 * nenhuma das duas, recusa com o CTA que destrava.
 */
export async function registrarResposta(params: {
  organizacaoId: string; leadId: string; canal?: string | null; ator: Ator;
  confirmacaoManual?: { canal: string; observacao: string } | null;
}): Promise<void> {
  const prospect = await carregarProspect(params.organizacaoId, params.leadId);
  if (exigirTransicao(prospect, "respondeu")) return;

  const evidencia = await evidenciaDeResposta(params.organizacaoId, params.leadId);
  const manual = params.confirmacaoManual;
  if (!evidencia) {
    if (!manual) {
      throw new RegraDeNegocio(
        "resposta_sem_evidencia",
        "Não há resposta deste prospect registrada no Atendimento nem na cadência. Se ele respondeu por outro meio, confirme manualmente.",
        { rotulo: "Confirmar resposta manualmente", tipo: "confirmar_resposta" },
      );
    }
    if (!manual.canal?.trim() || (manual.observacao ?? "").trim().length < 3) {
      throw new RegraDeNegocio("confirmacao_incompleta", "A confirmação manual precisa do canal e de uma observação do que foi respondido.");
    }
  }

  const canal = evidencia?.canal ?? manual!.canal.trim();
  await mudarEstado(prospect, "respondeu", params.ator, evidencia ? "Resposta recebida" : "Resposta confirmada manualmente");
  await registrarEvento({
    organizacaoId: params.organizacaoId, tipo: "ProspectReplied", ator: params.ator,
    leadId: params.leadId, empresaId: prospect.empresa_id,
    contexto: evidencia
      ? { canal, origem: "evidencia", respondeuEm: evidencia.em }
      : { canal, origem: "confirmacao_manual", observacao: manual!.observacao.trim(), confirmadoPor: params.ator.usuarioId },
    timeline: {
      tipo: "nota", titulo: "Prospect respondeu",
      descricao: evidencia ? `Resposta recebida por ${canal}` : `Confirmado manualmente (${canal}): ${manual!.observacao.trim()}`,
    },
  });
}

/** Bloco 04 §14: cadência encerrada sem resposta. O histórico não é apagado. */
export async function marcarSemResposta(params: {
  organizacaoId: string; leadId: string; ator: Ator;
}): Promise<void> {
  const prospect = await carregarProspect(params.organizacaoId, params.leadId);
  if (exigirTransicao(prospect, "sem_resposta")) return;

  // Quantas abordagens houve e por onde: é o registro que a spec manda guardar.
  const [resumo] = await db.execute<{ tentativas: number; ultima: string | null; cadencia: string | null }>(sql`
    SELECT count(ev.*) FILTER (WHERE ev.status = 'executado')::int AS tentativas,
           max(ev.created_at) FILTER (WHERE ev.status = 'executado')::text AS ultima,
           (SELECT cd.nome FROM cadence_enrollments x JOIN cadence_definitions cd ON cd.id = x.cadence_definition_id
             WHERE x.entity_type = 'lead' AND x.entity_id = ${params.leadId}::uuid
             ORDER BY x.started_at DESC LIMIT 1) AS cadencia
      FROM cadence_enrollments ce
      LEFT JOIN cadence_enrollment_events ev ON ev.enrollment_id = ce.id
     WHERE ce.organizacao_id = ${params.organizacaoId}::uuid AND ce.entity_type = 'lead' AND ce.entity_id = ${params.leadId}::uuid
  `);

  await mudarEstado(prospect, "sem_resposta", params.ator, "Cadência concluída sem resposta");
  await registrarEvento({
    organizacaoId: params.organizacaoId, tipo: "ProspectNoResponse", ator: params.ator,
    leadId: params.leadId, empresaId: prospect.empresa_id,
    contexto: { tentativas: resumo?.tentativas ?? 0, ultimaTentativaEm: resumo?.ultima ?? null, cadencia: resumo?.cadencia ?? null },
    timeline: { tipo: "nota", titulo: "Prospect sem resposta", descricao: resumo?.cadencia ?? undefined },
  });
}

/**
 * Sincroniza o estado com o que o motor de cadências já sabe. Chamado pelo
 * worker (resposta recebida e fim do sweep), com ator SYSTEM:
 *   - resposta real de quem está em cadência (ou sem resposta) → RESPONDEU;
 *   - cadência concluída sem nenhuma resposta → SEM RESPOSTA.
 * É o que faz o estado acompanhar a realidade sem depender de alguém arrastar
 * o cartão. Falha de um prospect não derruba os outros.
 */
export async function sincronizarProspectsComCadencia(organizacaoId?: string): Promise<{ responderam: number; semResposta: number }> {
  let responderam = 0;
  let semResposta = 0;

  const candidatos = await db.execute<{ id: string; org: string; estado: string }>(sql`
    SELECT l.id::text, l.organizacao_id::text AS org, l.prospeccao_estado AS estado
      FROM leads l
     WHERE l.prospeccao_estado IN ('em_cadencia','sem_resposta')
       AND (${organizacaoId ?? null}::uuid IS NULL OR l.organizacao_id = ${organizacaoId ?? null}::uuid)
     LIMIT 500`);

  for (const c of candidatos) {
    try {
      const evidencia = await evidenciaDeResposta(c.org, c.id);
      if (evidencia) {
        await registrarResposta({ organizacaoId: c.org, leadId: c.id, canal: evidencia.canal, ator: ATOR_SISTEMA });
        responderam += 1;
        continue;
      }
      if (c.estado !== "em_cadencia") continue;
      // Concluída = a matrícula mais recente terminou e nenhuma outra segura o prospect.
      const [fim] = await db.execute<{ concluida: boolean }>(sql`
        SELECT EXISTS (SELECT 1 FROM cadence_enrollments WHERE organizacao_id = ${c.org}::uuid AND entity_type = 'lead'
                         AND entity_id = ${c.id}::uuid AND status = 'completed')
               AND NOT EXISTS (SELECT 1 FROM cadence_enrollments WHERE organizacao_id = ${c.org}::uuid AND entity_type = 'lead'
                         AND entity_id = ${c.id}::uuid AND status = ANY(${STATUS_VIVOS}::text[])) AS concluida`);
      if (fim?.concluida) {
        await marcarSemResposta({ organizacaoId: c.org, leadId: c.id, ator: ATOR_SISTEMA });
        semResposta += 1;
      }
    } catch (erro) {
      console.error("[prospeccao] sincronização com a cadência falhou", c.id, erro);
    }
  }
  return { responderam, semResposta };
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
  // Já entregue a Pré-vendas: clique repetido devolve o mesmo lead, sem refazer.
  if (exigirTransicao(prospect, "pre_qualificado")) return { leadId: prospect.id };
  if (!prospect.empresa_id) {
    throw new RegraDeNegocio("prospect_sem_empresa", "Prospect sem empresa não pode virar Lead de Pré-vendas.");
  }

  const entregue = await db.execute<{ id: string }>(sql`
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
     WHERE id = ${params.leadId}::uuid AND organizacao_id = ${params.organizacaoId}::uuid
       AND prospeccao_estado IS NOT DISTINCT FROM ${prospect.estado}
    RETURNING id::text
  `);
  if (entregue.length === 0) {
    throw new RegraDeNegocio("prospect_mudou", "Este prospect mudou de estado enquanto você agia. Atualizei a tela com o estado atual.");
  }

  // A cadência que ainda rodava não faz sentido depois da entrega: Pré-vendas
  // conduz a partir daqui. Cancelada com motivo, histórico preservado.
  await db.execute(sql`
    UPDATE cadence_enrollments
       SET status = 'cancelled', cancelled_at = now(), cancel_reason = 'Prospect pré-qualificado', updated_at = now()
     WHERE organizacao_id = ${params.organizacaoId}::uuid
       AND entity_type = 'lead' AND entity_id = ${params.leadId}::uuid
       AND status IN ('active','waiting','waiting_reply','paused')
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

  // Clique repetido ou requisição duplicada: o prospect já virou oportunidade
  // direta, então devolve as que existem em vez de criar outras.
  if (exigirTransicao(prospect, "oportunidade")) {
    const existentes = await db.execute<{ id: string; familia: string | null; titulo: string; bundle: string | null }>(sql`
      SELECT id::text, service_family AS familia, titulo, bundle_id::text AS bundle FROM negocios
       WHERE organizacao_id = ${params.organizacaoId}::uuid AND lead_id = ${params.leadId}::uuid
         AND source_process = 'OUTBOUND_DIRECT'
       ORDER BY created_at`);
    return {
      oportunidades: existentes.map((n) => ({ id: n.id, familia: n.familia as Familia | null, titulo: n.titulo })),
      bundleId: existentes.find((n) => n.bundle)?.bundle ?? null,
    };
  }

  if (!prospect.empresa_id) {
    throw new RegraDeNegocio("prospect_sem_empresa", "Oportunidade exige Empresa.");
  }
  // Bloco 04 §27: criar oportunidade sem Família está proibido.
  const familias = [...new Set(params.familias ?? [])];
  if (familias.length === 0) {
    throw new RegraDeNegocio("oportunidade_exige_familia", "Escolha ao menos uma família de serviço.");
  }
  if (familias.some((f) => !(FAMILIAS as readonly string[]).includes(f))) {
    throw new RegraDeNegocio("familia_invalida", "Família de serviço inválida.");
  }
  await exigirResponsavelDaOrg(params.organizacaoId, params.responsavelId);
  if (!params.responsavelId) {
    throw new RegraDeNegocio("oportunidade_exige_responsavel", "Escolha o responsável comercial.");
  }

  // Reivindica o estado ANTES de criar: o compare-and-swap é o que impede dois
  // cliques simultâneos de criarem duas oportunidades. Se a criação falhar, o
  // estado volta ao que era.
  await mudarEstado(prospect, "oportunidade", params.ator, "Oportunidade criada direto do outbound");
  try {
    const resultado = await criarOportunidade({
      organizacaoId: params.organizacaoId,
      empresaId: prospect.empresa_id,
      familias,
      responsavelId: params.responsavelId,
      sourceProcess: "OUTBOUND_DIRECT",
      leadId: params.leadId,
    }, params.ator);

    // O prospect NÃO vira Lead de Pré-vendas: a jornada escolhida foi a direta,
    // e `estagio_pre_vendas` fica como está. A cadência que sobrou é cancelada.
    await db.execute(sql`
      UPDATE cadence_enrollments
         SET status = 'cancelled', cancelled_at = now(), cancel_reason = 'Oportunidade criada', updated_at = now()
       WHERE organizacao_id = ${params.organizacaoId}::uuid
         AND entity_type = 'lead' AND entity_id = ${params.leadId}::uuid
         AND status IN ('active','waiting','waiting_reply','paused')`);
    return { oportunidades: resultado.oportunidades, bundleId: resultado.bundleId };
  } catch (erro) {
    await db.execute(sql`
      UPDATE leads SET prospeccao_estado = ${prospect.estado}, updated_at = now()
       WHERE id = ${params.leadId}::uuid AND prospeccao_estado = 'oportunidade'`);
    await registrarMudancaDeEstado({ ...prospect, estado: "oportunidade" }, prospect.estado ?? "novo", params.ator, "Criação da oportunidade falhou; estado revertido");
    throw erro;
  }
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
  // Já descartado: idempotente. Quem já virou Lead ou oportunidade não é
  // descartado daqui (a transição recusa com o motivo).
  if (exigirTransicao(prospect, "descartado")) return;

  const descartou = await db.execute<{ id: string }>(sql`
    UPDATE leads SET
      prospeccao_estado = 'descartado',
      prospeccao_descarte_motivo = ${params.motivo},
      prospeccao_descartado_em = now(),
      prospeccao_descartado_por = ${params.ator.usuarioId ?? null}::uuid,
      updated_at = now()
     WHERE id = ${params.leadId}::uuid AND organizacao_id = ${params.organizacaoId}::uuid
       AND prospeccao_estado IS NOT DISTINCT FROM ${prospect.estado}
    RETURNING id::text
  `);
  if (descartou.length === 0) {
    throw new RegraDeNegocio("prospect_mudou", "Este prospect mudou de estado enquanto você agia. Atualizei a tela com o estado atual.");
  }
  await registrarMudancaDeEstado(prospect, "descartado", params.ator, params.motivo);

  // O histórico não é apagado: a matrícula é cancelada com motivo, não removida.
  await db.execute(sql`
    UPDATE cadence_enrollments
       SET status = 'cancelled', cancelled_at = now(), cancel_reason = 'Prospect descartado', updated_at = now()
     WHERE organizacao_id = ${params.organizacaoId}::uuid
       AND entity_type = 'lead' AND entity_id = ${params.leadId}::uuid
       AND status IN ('active','waiting','waiting_reply','paused')
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
  await exigirResponsavelDaOrg(params.organizacaoId, params.responsavelId);

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

/* ── Comando único de movimento (Kanban) ───────────────────────────────── */

export interface PedidoDeMovimento {
  organizacaoId: string;
  leadId: string;
  para: EstadoProspeccao;
  ator: Ator;
  /** `em_cadencia` */
  cadenceDefinitionId?: string | null;
  /** `respondeu` sem evidência registrada */
  confirmacaoManual?: { canal: string; observacao: string } | null;
  /** `descartado` */
  motivoDescarte?: MotivoDescarte | null;
  /** `oportunidade` */
  familias?: Familia[];
  responsavelId?: string | null;
}

export interface ResultadoDoMovimento {
  estado: EstadoProspeccao;
  /** Onde o registro vive agora, quando a movimentação o levou para outro módulo. */
  destino: { rota: string; rotulo: string } | null;
  oportunidadeIds?: string[];
}

/**
 * A porta do arrastar-e-soltar. A UI nunca escreve `prospeccao_estado`: ela
 * pede o movimento, o backend valida a transição e executa o comando de domínio
 * que carrega as regras (cadência válida, evidência de resposta, motivo de
 * descarte, passagem real para Pré-vendas, criação de oportunidade).
 */
export async function moverProspect(p: PedidoDeMovimento): Promise<ResultadoDoMovimento> {
  if (!(ESTADOS_PROSPECCAO as readonly string[]).includes(p.para)) {
    throw new RegraDeNegocio("estado_invalido", "Estado de destino inválido.");
  }
  const base = { organizacaoId: p.organizacaoId, leadId: p.leadId, ator: p.ator };

  switch (p.para) {
    case "em_cadencia":
      if (!p.cadenceDefinitionId) throw new RegraDeNegocio("cadencia_obrigatoria", "Escolha a cadência para iniciar a abordagem.", { rotulo: "Escolher cadência", tipo: "escolher_cadencia" });
      await inscreverEmCadencia({ ...base, cadenceDefinitionId: p.cadenceDefinitionId });
      return { estado: "em_cadencia", destino: null };
    case "respondeu":
      await registrarResposta({ ...base, confirmacaoManual: p.confirmacaoManual ?? null });
      return { estado: "respondeu", destino: null };
    case "sem_resposta":
      await marcarSemResposta(base);
      return { estado: "sem_resposta", destino: null };
    case "pre_qualificado":
      await preQualificar(base);
      return { estado: "pre_qualificado", destino: { rota: `/pre-vendas/${encodeURIComponent(p.leadId)}`, rotulo: "Abrir em Pré-vendas" } };
    case "oportunidade": {
      const r = await criarOportunidadeDireta({
        ...base, familias: p.familias ?? [], responsavelId: p.responsavelId ?? "",
      });
      const primeira = r.oportunidades[0];
      return {
        estado: "oportunidade",
        destino: primeira ? { rota: `/pipeline/${primeira.id}`, rotulo: "Abrir no Pipeline" } : { rota: "/pipeline", rotulo: "Abrir Pipeline" },
        oportunidadeIds: r.oportunidades.map((o) => o.id),
      };
    }
    case "descartado":
      if (!p.motivoDescarte) throw new RegraDeNegocio("descarte_exige_motivo", "Escolha um motivo para o descarte.", { rotulo: "Escolher motivo", tipo: "escolher_motivo" });
      await descartar({ ...base, motivo: p.motivoDescarte });
      return { estado: "descartado", destino: null };
    default:
      throw new RegraDeNegocio("transicao_invalida", "Esta mudança de estado não é permitida.");
  }
}

/** Retoma a cadência pausada do prospect (espelho de `pausarCadencia`). */
export async function retomarCadencia(params: { organizacaoId: string; leadId: string; ator: Ator }): Promise<void> {
  const prospect = await carregarProspect(params.organizacaoId, params.leadId);
  if (prospect.estado !== "em_cadencia") {
    throw new RegraDeNegocio("sem_cadencia", "Só dá para retomar a cadência de quem está em cadência.");
  }
  const retomadas = await db.execute<{ id: string; passo: string | null }>(sql`
    UPDATE cadence_enrollments
       SET status = 'active', scheduled_at = now(), next_eval_at = now(), claimed_until = NULL,
           cancel_reason = NULL, updated_at = now()
     WHERE organizacao_id = ${params.organizacaoId}::uuid
       AND entity_type = 'lead' AND entity_id = ${params.leadId}::uuid AND status = 'paused'
    RETURNING id::text, current_step_id AS passo`);
  if (retomadas.length === 0) throw new RegraDeNegocio("sem_cadencia", "Não há cadência pausada para retomar.");
  for (const r of retomadas) {
    await db.execute(sql`INSERT INTO cadence_enrollment_events (enrollment_id, step_id, status, resultado)
      VALUES (${r.id}::uuid, ${r.passo ?? "-"}, 'resume',
              ${JSON.stringify({ actorId: params.ator.usuarioId, origem: "prospeccao" })}::jsonb)`);
  }
}
