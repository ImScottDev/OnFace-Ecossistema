/**
 * Motor de Pré-vendas.
 *
 * Bloco 01 §19: humano e IA executam os MESMOS comandos. Não existe um fluxo
 * para a equipe e outro para o NEXO — muda só o `Ator` que chega junto. Toda
 * rota HTTP, ação de tela e passo de agente entra por aqui.
 *
 * O Lead é o processo temporário de Pré-vendas de uma Empresa (Bloco 01 §1).
 * Ele mora na tabela `leads`, que no legado também carrega os dados da pessoa;
 * isso é preservado para leitura, mas toda entrada nova resolve Empresa e
 * Pessoa de verdade antes de criar o processo.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { ExecutorDb } from "./executor";
import { registrarEvento, registrarMudancaDeEtapa } from "./eventos";
import { resolverNomes } from "./resolver-ids";
import {
  resolverEmpresa, resolverPessoa, registrarTouchpoint, telefoneParaGravar,
  type DadosEmpresa, type Touchpoint,
} from "./identidade";
import {
  MOTIVOS_DESQUALIFICACAO, MOTIVOS_NUTRICAO, RegraDeNegocio,
  type Ator, type EstagioPreVendas, type EtapaPreVendas,
  type MotivoDesqualificacao, type MotivoNutricao, type Qualificacao,
} from "./dominio";
import { resolverPorRegra } from "@/lib/agentes/distribuicao";

/* ── Entrada de Lead (Bloco 01 §3) ─────────────────────────────────────── */

export interface EntradaDeLead {
  organizacaoId: string;
  /**
   * Bloco 01 §3: todo formulário inbound deve possuir Empresa.
   *
   * Aceita `null` porque a realidade ainda não cumpre isso: existe formulário
   * publicado que não pergunta a empresa, e recusar a captura perderia o lead.
   * O lead entra sem empresa, aparece na tela com "Associar empresa", e o
   * comando de criar oportunidade continua bloqueado até a associação — que é
   * exatamente o que Bloco 05 §3 pede para os fluxos B2B.
   */
  empresa: DadosEmpresa | null;
  pessoa: {
    nome: string;
    sobrenome?: string | null;
    email?: string | null;
    telefone?: string | null;
    whatsapp?: string | null;
    cargo?: string | null;
  };
  touchpoint: Touchpoint;
  origem?: string | null;
  servicosInteresse?: string[] | null;
  responsavelId?: string | null;
  /** Vindo de Prospecção com pré-qualificação (Bloco 04 §11). */
  preQualificado?: boolean;
  observacoes?: string | null;
}

export interface LeadCriado {
  leadId: string;
  empresaId: string | null;
  pessoaId: string;
  empresaJaExistia: boolean;
  pessoaJaExistia: boolean;
}

type SettingsOrganizacao = { preVendas?: { responsavelInboundId?: unknown } };

function eEntradaInbound(tipoOrigem: string): boolean {
  return ["campanha", "organica", "formulario", "site"].includes(tipoOrigem);
}

/**
 * O dono da fila de inbound é uma política da organização, não um nome
 * gravado no código. Sem configuração válida, devolve `null`: um lead pode
 * entrar, mas nunca é falsamente atribuído a alguém que não existe mais.
 */
export async function resolverResponsavelInbound(organizacaoId: string): Promise<string | null> {
  const [org] = await db.execute<{ settings: SettingsOrganizacao | null }>(sql`
    SELECT settings FROM organizacoes WHERE id = ${organizacaoId}::uuid
  `);
  const candidato = org?.settings?.preVendas?.responsavelInboundId ?? null;
  if (typeof candidato !== "string") return null;

  const [usuario] = await db.execute<{ id: string }>(sql`
    SELECT id::text FROM usuarios
     WHERE id = ${candidato}::uuid
       AND organizacao_id = ${organizacaoId}::uuid
       AND ativo = true
  `);
  return usuario?.id ?? null;
}

/** Cria a pendência operacional que impede o inbound de ficar invisível. */
export async function garantirAtividadePrimeiroContato(params: {
  organizacaoId: string;
  leadId: string;
  empresaId: string | null;
  responsavelId: string | null;
}): Promise<void> {
  await db.execute(sql`
    WITH bloqueio AS MATERIALIZED (
      SELECT pg_advisory_xact_lock(hashtext(${`primeiro_contato_inbound:${params.organizacaoId}:${params.leadId}`}))
    ), lead_sem_contato AS (
      SELECT id FROM leads
       WHERE id = ${params.leadId}::uuid
         AND organizacao_id = ${params.organizacaoId}::uuid
         AND primeiro_contato_at IS NULL
    )
    INSERT INTO tarefas (
      organizacao_id, lead_id, empresa_id, usuario_id,
      titulo, descricao, tipo, prioridade, origem, motivo, status
    )
    SELECT
      ${params.organizacaoId}::uuid, ${params.leadId}::uuid, ${params.empresaId}::uuid, ${params.responsavelId}::uuid,
      'Fazer primeiro contato', 'Lead inbound aguardando primeira tentativa de contato.',
      'follow_up', 'alta', 'AUTOMACAO', 'primeiro_contato_inbound', 'a_fazer'
      FROM bloqueio, lead_sem_contato
     WHERE NOT EXISTS (
      SELECT 1 FROM tarefas
       WHERE organizacao_id = ${params.organizacaoId}::uuid
         AND lead_id = ${params.leadId}::uuid
         AND motivo = 'primeiro_contato_inbound'
         AND status NOT IN ('concluida', 'declinada')
    )
  `);
}

export async function concluirAtividadePrimeiroContato(params: {
  organizacaoId: string;
  leadId: string;
}): Promise<void> {
  await db.execute(sql`
    UPDATE tarefas
       SET status = 'concluida', concluida = true, concluida_em = now()
     WHERE organizacao_id = ${params.organizacaoId}::uuid
       AND lead_id = ${params.leadId}::uuid
       AND motivo = 'primeiro_contato_inbound'
       AND status NOT IN ('concluida', 'declinada')
  `);
}

/**
 * Cria o Lead seguindo a entrada canônica da spec:
 * Empresa → Pessoa → vínculo → touchpoint → Lead → NOVO.
 *
 * **Não cria oportunidade.** Bloco 01 §3 e §29 são explícitos: formulário
 * inbound criar oportunidade automaticamente está entre as coisas proibidas.
 * A oportunidade nasce depois, por comando explícito.
 *
 * A mesma Empresa pode ter vários Leads históricos de propósito (§4): resolver
 * a empresa evita duplicar a identidade, não reaproveita o processo antigo.
 */
/**
 * Guarda de tenant para o responsável.
 *
 * O responsavelId vinha do cliente e ia direto ao `responsavel_id`, sem
 * conferir a organização. Um id de usuário de OUTRA empresa era aceito: o lead
 * sumia das listas da equipe e passava a aparecer para o outro cliente. A
 * atribuição só pode apontar para usuário ativo da mesma organização. null é
 * válido (lead sem dono).
 */
export async function exigirResponsavelDaOrg(
  organizacaoId: string,
  responsavelId: string | null | undefined,
): Promise<void> {
  if (!responsavelId) return;
  const dono = await db.execute<{ id: string }>(sql`
    SELECT id::text FROM usuarios
     WHERE id = ${responsavelId}::uuid
       AND organizacao_id = ${organizacaoId}::uuid
       AND ativo = true
     LIMIT 1
  `);
  if (dono.length === 0) {
    // RegraDeNegocio, não Error: Error vira "tente de novo em instantes" na tela,
    // e nenhuma tentativa conserta um responsável de outra organização.
    throw new RegraDeNegocio("responsavel_invalido", "Responsável inválido: não é um usuário ativo desta organização.");
  }
}

export async function criarLead(entrada: EntradaDeLead, ator: Ator): Promise<LeadCriado> {
  const { organizacaoId } = entrada;

  /* Regra de distribuição (Ajustes > Leads) primeiro: "novos leads em Novo -> humano, agente ou
     rodízio", com dia/horário. Sem regra vigente vale o padrão de antes (responsável de inbound). */
  const porRegra = entrada.responsavelId ? null : await resolverPorRegra({ organizacaoId, etapa: "novo" });
  const responsavelId = entrada.responsavelId
    ?? porRegra?.responsavelId
    ?? (eEntradaInbound(entrada.touchpoint.tipoOrigem)
      ? await resolverResponsavelInbound(organizacaoId)
      : null);

  await exigirResponsavelDaOrg(organizacaoId, responsavelId);

  const empresa = entrada.empresa
    ? await resolverEmpresa(organizacaoId, entrada.empresa, ator)
    : null;

  const pessoa = await resolverPessoa(organizacaoId, {
    ...entrada.pessoa,
    empresaId: empresa?.empresaId ?? null,
  }, ator);

  /* Regra do Scott (06/10): se a pessoa já tem uma aquisição ABERTA, a entrada
     (webhook, site, rota HTTP) devolve o lead existente em vez de criar outro.
     Antes nascia um lead órfão, sem aquisição, que nunca aparecia no board.
     A tela manual continua recusando com mensagem (guarda em pre-vendas/actions.ts). */
  const [aberta] = await db.execute<{ lead: string }>(sql`
    SELECT a.lead_legado_id::text AS lead FROM aquisicoes a
     WHERE a.organizacao_id = ${organizacaoId}::uuid AND a.pessoa_id = ${pessoa.pessoaId}::uuid
       AND a.closed_at IS NULL AND a.lead_legado_id IS NOT NULL
     ORDER BY a.created_at DESC LIMIT 1`);
  if (aberta) {
    return {
      leadId: aberta.lead, empresaId: empresa?.empresaId ?? null, pessoaId: pessoa.pessoaId,
      empresaJaExistia: empresa ? !empresa.criada : false, pessoaJaExistia: true,
    };
  }

  const nomeCompleto = [entrada.pessoa.nome, entrada.pessoa.sobrenome].filter(Boolean).join(" ").trim();

  const [lead] = await db.execute<{ id: string }>(sql`
    INSERT INTO leads (
      organizacao_id, nome, sobrenome, email, telefone, whatsapp, cargo,
      empresa_id, empresa, origem, servicos_interesse, responsavel_id,
      tipo, status, sdr_status, estagio_pre_vendas,
      pre_qualificado, pre_qualificado_em, pre_qualificado_por,
      utm_source, utm_medium, utm_campaign, utm_term, utm_content, landing_page
    ) VALUES (
      ${organizacaoId}::uuid,
      ${entrada.pessoa.nome},
      ${entrada.pessoa.sobrenome ?? null},
      ${entrada.pessoa.email ?? null},
      ${telefoneParaGravar(entrada.pessoa.telefone)},
      ${telefoneParaGravar(entrada.pessoa.whatsapp)},
      ${entrada.pessoa.cargo ?? null},
      ${empresa?.empresaId ?? null}::uuid,
      ${entrada.empresa?.nome ?? null},
      ${entrada.origem ?? entrada.touchpoint.source ?? null},
      ${literalDeTexto(entrada.servicosInteresse)}::text[],
      ${responsavelId}::uuid,
      'lead', 'novo', 'pending', 'novo',
      ${entrada.preQualificado ?? false},
      ${entrada.preQualificado ? new Date().toISOString() : null}::timestamptz,
      ${entrada.preQualificado ? (ator.usuarioId ?? null) : null}::uuid,
      ${entrada.touchpoint.source ?? null},
      ${entrada.touchpoint.medium ?? null},
      ${entrada.touchpoint.campaign ?? null},
      ${entrada.touchpoint.term ?? null},
      ${entrada.touchpoint.content ?? null},
      ${entrada.touchpoint.landingPage ?? null}
    )
    RETURNING id::text
  `);

  // A pessoa nasceu ANTES do lead (o lead precisa da empresa e do contato já resolvidos) e sem
  // saber a que lead pertence. Sem `lead_id_legado` a ficha não acha a pessoa: vincular outra
  // empresa recusa com "sem cadastro de pessoa". Mesmo vínculo que `prospeccao.ts` faz.
  await db.execute(sql`
    UPDATE pessoas SET lead_id_legado = ${lead.id}::uuid
     WHERE id = ${pessoa.pessoaId}::uuid AND organizacao_id = ${organizacaoId}::uuid AND lead_id_legado IS NULL`);

  // A aquisição canônica nasce AQUI, não em cada chamador.
  //
  // O board de pré-vendas lê `aquisicoes`. Sem esta chamada, lead criado pela
  // tela de pré-vendas ou pela página da empresa não tinha aquisição e **não
  // aparecia no board onde acabara de ser criado** — o pior formato de bug,
  // porque quem cria não consegue nem reportar.
  //
  // Só a rota HTTP (`POST /leads`) e o webhook do site chamavam a porta. As
  // duas server actions do CRM2 não chamavam. Pôr a chamada dentro de
  // `criarLead` serve os quatro caminhos de uma vez, que é a regra que este
  // refactor vem aplicando: guarda na função compartilhada, não em cada
  // chamador.
  //
  // `garantirEntradaCanonica` reaproveita aquisição aberta da mesma pessoa em
  // vez de criar uma segunda, então chamar de novo no webhook não duplica.
  const { garantirEntradaCanonica } = await import("./ponte-canonica");
  await garantirEntradaCanonica({
    organizacaoId,
    // `tipo_origem` do touchpoint distingue prospecção de entrada espontânea.
    tipo: entrada.touchpoint?.tipoOrigem === "outbound" ? "OUTBOUND" : "INBOUND",
    origem: entrada.origem ?? null,
    pessoa: entrada.pessoa,
    empresa: entrada.empresa,
    responsavelId: entrada.responsavelId ?? null,
    idempotencyKey: `lead:${lead.id}`,
  } as never, lead.id);

  await registrarTouchpoint({
    organizacaoId,
    pessoaId: pessoa.pessoaId,
    empresaId: empresa?.empresaId ?? null,
    leadIdLegado: lead.id,
    touchpoint: entrada.touchpoint,
  });

  await registrarMudancaDeEtapa({
    organizacaoId, ator, leadId: lead.id, de: null, para: "novo",
    tipo: "StageChanged",
    motivo: "Lead criado",
    timeline: {
      tipo: "nota",
      titulo: "Lead criado em Pré-vendas",
      descricao: `${entrada.empresa?.nome ?? "Sem empresa"} · ${nomeCompleto}`,
    },
  });

  await registrarEvento({
    organizacaoId, tipo: "LeadCreated", ator,
    leadId: lead.id, empresaId: empresa?.empresaId ?? null, pessoaId: pessoa.pessoaId,
    contexto: {
      origem: entrada.origem ?? entrada.touchpoint.source ?? null,
      // Lead sem empresa é um gap de dado conhecido, não um sucesso silencioso:
      // fica registrado no evento para aparecer em auditoria de qualidade.
      semEmpresa: !empresa,
      empresaJaExistia: empresa ? !empresa.criada : false,
      empresaResolvidaPor: empresa?.resolvidaPor ?? null,
      pessoaJaExistia: !pessoa.criada,
      preQualificado: entrada.preQualificado ?? false,
    },
  });

  if (responsavelId) {
    await registrarEvento({
      organizacaoId, tipo: "LeadAssigned", ator, leadId: lead.id,
      contexto: {
        responsavelId,
        origemAtribuicao: entrada.responsavelId ? "manual" : porRegra ? "regra_distribuicao" : "politica_inbound",
        regraId: porRegra?.regraId ?? null,
      },
    });
  }

  if (eEntradaInbound(entrada.touchpoint.tipoOrigem)) {
    await garantirAtividadePrimeiroContato({
      organizacaoId, leadId: lead.id, empresaId: empresa?.empresaId ?? null, responsavelId,
    });
  }

  return {
    leadId: lead.id,
    empresaId: empresa?.empresaId ?? null,
    pessoaId: pessoa.pessoaId,
    empresaJaExistia: empresa ? !empresa.criada : false,
    pessoaJaExistia: !pessoa.criada,
  };
}

/* ── Leitura de apoio ──────────────────────────────────────────────────── */

interface LeadInterno extends Record<string, unknown> {
  id: string;
  organizacao_id: string;
  estagio_pre_vendas: EstagioPreVendas | null;
  qualificado: boolean;
  empresa_id: string | null;
  responsavel_id: string | null;
  primeiro_contato_at: string | null;
}

async function carregarLead(organizacaoId: string, leadId: string, tx: ExecutorDb = db): Promise<LeadInterno> {
  const [lead] = await tx.execute<LeadInterno>(sql`
    -- B4: a etapa vem da aquisição (é o que o board mostra). Ler
    -- leads.estagio_pre_vendas cru dava 'de' errado e, em lead cuja etapa só
    -- existe na aquisição (a carga), tratava reativação como movimento comum.
    -- 'qualificacao' é o único estado que só o legado conhece, igual ao board.
    SELECT l.id::text, l.organizacao_id::text,
           CASE WHEN l.estagio_pre_vendas = 'qualificacao' THEN 'qualificacao'
                ELSE COALESCE(pe.codigo, l.estagio_pre_vendas) END AS estagio_pre_vendas,
           l.qualificado, l.empresa_id::text, l.responsavel_id::text, l.primeiro_contato_at::text
      FROM leads l
      LEFT JOIN aquisicoes a ON a.lead_legado_id = l.id
      LEFT JOIN pipeline_etapas pe ON pe.id = a.etapa_id
     WHERE l.id = ${leadId}::uuid AND l.organizacao_id = ${organizacaoId}::uuid
  `);
  if (!lead) throw new RegraDeNegocio("lead_nao_encontrado", "Lead não encontrado.");
  return lead;
}

/* ── Comandos ──────────────────────────────────────────────────────────── */

/** Bloco 01 §25: todo Lead trabalhado tem responsabilidade clara, e a troca
 *  precisa de histórico. */
export async function atribuirResponsavel(params: {
  organizacaoId: string;
  leadId: string;
  responsavelId: string | null;
  origemAtribuicao?: "manual" | "automacao" | "round_robin" | "agente";
  ator: Ator;
  /** Agente responsável assume sem ser acionada agora (a delegação tem o calendário próprio de toques). */
  semAcionarAgente?: boolean;
}): Promise<void> {
  const lead = await carregarLead(params.organizacaoId, params.leadId);
  // Gatilho "agente virou responsável" (e o inverso): vale para a mudança e também para repetir a atribuição, que converge.
  const aoAtribuir = async () => {
    const { aoMudarResponsavel } = await import("@/lib/ai-platform/operacao/atribuicoes");
    await aoMudarResponsavel({
      organizacaoId: params.organizacaoId, entidade: "lead", entidadeId: params.leadId, anteriorId: lead.responsavel_id, novoId: params.responsavelId,
      ator: { usuarioId: params.ator.usuarioId }, semAcionar: params.semAcionarAgente,
    });
  };

  await exigirResponsavelDaOrg(params.organizacaoId, params.responsavelId);

  /* Nada a mudar no legado — mas o board NÃO lê o legado.
   *
   * O atalho era `return` seco, e ele criava uma divergência permanente: se o
   * lead já tivesse esse responsável e a aquisição não (propagação que falhou
   * antes, backfill que não cobriu, lead atribuído por caminho legado), toda
   * tentativa futura caía aqui e saía sem tocar em `aquisicoes`. O card ficava
   * "Sem responsável" para sempre, e reatribuir pela tela não resolvia —
   * porque do ponto de vista do legado não havia o que fazer.
   *
   * Medido em 22/09: 6 atribuições, 5 chegaram ao board. A que faltou era
   * exatamente uma cujo lead já apontava para aquele responsável.
   *
   * Sincronizar aqui é o que torna a ação convergente: repetir a atribuição
   * conserta o espelho em vez de virar operação nula. */
  if (lead.responsavel_id === params.responsavelId) {
    const { sincronizarAquisicaoDoLead } = await import("./sincronizar-aquisicao");
    await sincronizarAquisicaoDoLead(params.leadId);
    await aoAtribuir();
    return;
  }

  await db.execute(sql`
    UPDATE leads SET responsavel_id = ${params.responsavelId}::uuid, updated_at = now()
     WHERE id = ${params.leadId}::uuid
  `);

  const nomes = await resolverNomes(params.organizacaoId, [lead.responsavel_id, params.responsavelId].filter((x): x is string => !!x));
  await registrarEvento({
    organizacaoId: params.organizacaoId,
    tipo: lead.responsavel_id ? "OwnerChanged" : "LeadAssigned",
    ator: params.ator,
    leadId: params.leadId,
    contexto: {
      de: lead.responsavel_id,
      para: params.responsavelId,
      deNome: lead.responsavel_id ? nomes.get(lead.responsavel_id) ?? null : null,
      paraNome: params.responsavelId ? nomes.get(params.responsavelId) ?? null : null,
      origemAtribuicao: params.origemAtribuicao ?? "manual",
    },
    timeline: { tipo: "nota", titulo: "Responsável alterado" },
  });
  await aoAtribuir();
}

/**
 * Primeiro contato real (Bloco 01 §6).
 *
 * Idempotente: só marca a primeira vez. É um marco de funil ("tempo até
 * primeiro contato"), então gravar de novo a cada mensagem destruiria a
 * métrica.
 */
export async function registrarPrimeiroContato(params: {
  organizacaoId: string;
  leadId: string;
  canal: "whatsapp" | "email" | "ligacao" | "outro";
  ator: Ator;
  /** Move para Em contato junto, que é o comportamento esperado do board. */
  moverParaEmContato?: boolean;
  /** Quando o contato de fato ocorreu (ex.: data da ligação). Padrão: agora. */
  ocorridoEm?: Date;
  /** De onde veio o marco (tela, atendimento, cadência...), para auditar o SLA. */
  origem?: string;
}): Promise<{ registrado: boolean }> {
  const lead = await carregarLead(params.organizacaoId, params.leadId);
  const jaTinha = Boolean(lead.primeiro_contato_at);
  const quando = params.ocorridoEm ?? new Date();

  if (!jaTinha) {
    await db.execute(sql`
      UPDATE leads SET primeiro_contato_at = ${quando.toISOString()}::timestamptz,
             last_contact_at = ${quando.toISOString()}::timestamptz, updated_at = now()
       WHERE id = ${params.leadId}::uuid
    `);
    await registrarEvento({
      organizacaoId: params.organizacaoId, tipo: "FirstContactMade", ator: params.ator,
      ocorridoEm: quando,
      leadId: params.leadId, contexto: { canal: params.canal, origem: params.origem ?? "tela" },
      timeline: { tipo: params.canal, titulo: "Primeiro contato realizado", descricao: `Canal: ${params.canal}` },
    });
    await concluirAtividadePrimeiroContato(params);
  } else {
    await db.execute(sql`UPDATE leads SET last_contact_at = now(), updated_at = now() WHERE id = ${params.leadId}::uuid`);
  }

  if ((params.moverParaEmContato ?? true) && lead.estagio_pre_vendas === "novo") {
    await moverEtapa({
      organizacaoId: params.organizacaoId, leadId: params.leadId,
      para: "em_contato", ator: params.ator, motivo: `Primeiro contato por ${params.canal}`,
    });
  }

  return { registrado: !jaTinha };
}

/**
 * Contato SAINDO por qualquer canal (WhatsApp enviado no Atendimento, ligação
 * Callface, e-mail): conta como primeiro contato se o lead ainda está em
 * Pré-vendas e nunca foi contatado. Lead já contatado, cliente ou contato
 * simples não são tocados. Best-effort: nunca derruba o envio.
 */
export async function registrarContatoSaindo(params: {
  organizacaoId: string;
  leadId: string;
  canal: "whatsapp" | "email" | "ligacao";
  ator: Ator;
  ocorridoEm?: Date;
}): Promise<void> {
  try {
    const [l] = await db.execute<{ ok: boolean }>(sql`
      SELECT (l.primeiro_contato_at IS NULL AND l.tipo = 'lead'
              AND COALESCE(l.estagio_pre_vendas, 'novo') IN ('novo', 'em_contato', 'qualificacao')) AS ok
        FROM leads l WHERE l.id = ${params.leadId}::uuid AND l.organizacao_id = ${params.organizacaoId}::uuid`);
    if (!l?.ok) return;
    await registrarPrimeiroContato({ ...params, origem: "envio", moverParaEmContato: true });
  } catch (e) {
    console.warn("[pre-vendas] primeiro contato por envio não registrado:", e);
  }
}

/**
 * Move o Lead entre as etapas do board.
 *
 * Duas etapas NÃO entram por aqui, e isso é a spec, não limitação:
 *   - `qualificado` exige o comando `qualificar`, porque precisa gravar o fato
 *     histórico (§10) e não só a posição do card;
 *   - `oportunidade` exige `criarOportunidadeDoLead`, porque é uma ação de
 *     negócio que cria uma entidade (§11), não uma troca de status.
 *
 * `nutricao` e `desqualificado` também têm comando próprio: a spec proíbe
 * nutrir ou desqualificar sem motivo.
 */
export async function moverEtapa(params: {
  organizacaoId: string;
  leadId: string;
  para: EtapaPreVendas;
  ator: Ator;
  motivo?: string | null;
}): Promise<void> {
  if (params.para === "qualificado") {
    throw new RegraDeNegocio(
      "qualificacao_exige_comando",
      "Qualificar é um fato, não uma posição no board. Use a ação Qualificar.",
      { rotulo: "Qualificar", tipo: "qualificar" },
    );
  }
  if (params.para === "oportunidade") {
    throw new RegraDeNegocio(
      "oportunidade_exige_comando",
      "Mover para Oportunidade cria uma oportunidade real. Use a ação Criar oportunidade.",
      { rotulo: "Criar oportunidade", tipo: "criar_oportunidade" },
    );
  }

  const lead = await carregarLead(params.organizacaoId, params.leadId);
  if (lead.estagio_pre_vendas === params.para) return;

  const reativando = lead.estagio_pre_vendas === "nutricao" || lead.estagio_pre_vendas === "desqualificado";

  await db.execute(sql`
    UPDATE leads SET
      estagio_pre_vendas = ${params.para},
      qualificacao_iniciada_em = CASE
        WHEN ${params.para} = 'qualificacao' AND qualificacao_iniciada_em IS NULL THEN now()
        ELSE qualificacao_iniciada_em END,
      contato_desde_at = CASE
        WHEN ${params.para} = 'em_contato' THEN now() ELSE contato_desde_at END,
      updated_at = now()
     WHERE id = ${params.leadId}::uuid
  `);

  // Reativar de verdade: a saída (nutrição/desqualificação) precisa ser
  // desfeita no canônico também. A carga grava essas aquisições com `closed_at`
  // preenchido, e o board só mostra encerrada se ela ainda estiver desqualificada
  // ou em nutrição. Sem limpar, o lead reativado (183 em nutrição na carga) sumia
  // do board sem erro nenhum. A tarefa "Retomar lead em nutrição" é encerrada em
  // `registrarMudancaDeEtapa` (porta única das etapas): o lead já voltou.
  if (reativando) {
    await db.execute(sql`
      UPDATE leads SET desqualificado_em = NULL, desqualificacao_motivo = NULL, desqualificacao_detalhe = NULL
       WHERE id = ${params.leadId}::uuid`);
    await db.execute(sql`
      UPDATE aquisicoes SET closed_at = NULL, desqualificado_em = NULL, motivo_desqualificacao = NULL
       WHERE lead_legado_id = ${params.leadId}::uuid AND organizacao_id = ${params.organizacaoId}::uuid`);
  }

  await registrarMudancaDeEtapa({
    organizacaoId: params.organizacaoId, ator: params.ator, leadId: params.leadId,
    de: lead.estagio_pre_vendas, para: params.para, motivo: params.motivo ?? null,
    tipo: "StageChanged",
  });

  // Sair de Novo para uma etapa de trabalho é, por definição, ter contatado o
  // lead: sem este marco o card andava e o "tempo até 1º contato" ficava nulo.
  if (lead.estagio_pre_vendas === "novo" && !lead.primeiro_contato_at
      && (params.para === "em_contato" || params.para === "qualificacao")) {
    await db.execute(sql`UPDATE leads SET primeiro_contato_at = now(), last_contact_at = now() WHERE id = ${params.leadId}::uuid AND primeiro_contato_at IS NULL`);
    await registrarEvento({
      organizacaoId: params.organizacaoId, tipo: "FirstContactMade", ator: params.ator,
      leadId: params.leadId, contexto: { canal: "outro", origem: "movimento_de_etapa" },
    });
    await concluirAtividadePrimeiroContato(params);
  }

  if (params.para === "qualificacao") {
    await registrarEvento({
      organizacaoId: params.organizacaoId, tipo: "QualificationStarted",
      ator: params.ator, leadId: params.leadId,
    });
  }

  if (reativando) {
    await registrarEvento({
      organizacaoId: params.organizacaoId, tipo: "LeadReactivated", ator: params.ator,
      leadId: params.leadId, contexto: { de: lead.estagio_pre_vendas },
      timeline: { tipo: "nota", titulo: "Lead retomado" },
    });
  }
}

/**
 * Array de texto como UM parâmetro, no formato literal do Postgres.
 *
 * O template do Drizzle espalha um array JS em um parâmetro por item, então
 * `${["Callface AI"]}` chega no banco como o escalar `'Callface AI'` e o
 * cast para `text[]` estoura com "malformed array literal". Com dois itens o
 * erro muda de forma mas continua errado. É o mesmo motivo pelo qual
 * `consultas.ts` não usa `= ANY(${array})`.
 *
 * Cada elemento vai entre aspas duplas com escape, e não cru: nome de serviço
 * pode ter vírgula, e vírgula crua dentro do literal vira DOIS elementos.
 */
export function literalDeTexto(valores: string[] | null | undefined): string | null {
  if (!valores) return null;
  return `{${valores.map((v) => `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",")}}`;
}

/** Salva a qualificação estruturada sem decidir nada (Bloco 01 §8).
 *  Preencher os campos não qualifica: qualificar é ato explícito. */
export async function salvarQualificacao(params: {
  organizacaoId: string;
  leadId: string;
  qualificacao: Qualificacao;
  ator: Ator;
}): Promise<void> {
  await carregarLead(params.organizacaoId, params.leadId);
  await db.execute(sql`
    UPDATE leads SET
      qualificacao = COALESCE(qualificacao, '{}'::jsonb) || ${JSON.stringify(params.qualificacao)}::jsonb,
      qualificacao_iniciada_em = COALESCE(qualificacao_iniciada_em, now()),
      servicos_interesse = COALESCE(${literalDeTexto(params.qualificacao.servicosInteresse)}::text[], servicos_interesse),
      updated_at = now()
     WHERE id = ${params.leadId}::uuid
  `);
}

/**
 * Qualifica o Lead.
 *
 * Bloco 01 §9-10: qualificado significa que a empresa passou pelos critérios.
 * Não cria oportunidade, não marca reunião, não chama closer — o lead pode
 * ficar parado nesta etapa. E o fato precisa sobreviver: quando o lead estiver
 * em Oportunidade ou virar Cliente, `qualificado`/`qualificadoEm` continuam
 * contando a história.
 */
export async function qualificar(params: {
  organizacaoId: string;
  leadId: string;
  qualificacao?: Qualificacao;
  ator: Ator;
}): Promise<void> {
  const lead = await carregarLead(params.organizacaoId, params.leadId);

  if (params.qualificacao) {
    await salvarQualificacao({ ...params, qualificacao: params.qualificacao });
  }

  await db.execute(sql`
    UPDATE leads SET
      estagio_pre_vendas = 'qualificado',
      qualificado = true,
      qualificado_em = COALESCE(qualificado_em, now()),
      qualificado_por = COALESCE(qualificado_por, ${params.ator.usuarioId ?? null}::uuid),
      qualificado_por_tipo = COALESCE(qualificado_por_tipo, ${params.ator.tipo === "SYSTEM" ? "AUTOMATION" : params.ator.tipo}),
      sdr_status = 'qualified',
      updated_at = now()
     WHERE id = ${params.leadId}::uuid
  `);

  await registrarMudancaDeEtapa({
    organizacaoId: params.organizacaoId, ator: params.ator, leadId: params.leadId,
    de: lead.estagio_pre_vendas, para: "qualificado", tipo: "StageChanged",
    motivo: "Lead qualificado",
  });

  await registrarEvento({
    organizacaoId: params.organizacaoId, tipo: "LeadQualified", ator: params.ator,
    leadId: params.leadId, empresaId: lead.empresa_id,
    contexto: { porTipo: params.ator.tipo },
    timeline: { tipo: "nota", titulo: "Lead qualificado" },
  });
}

/** Bloco 01 §13: nutrição exige motivo, e alguns motivos exigem data de
 *  retomada — senão o lead entra num limbo do qual ninguém o tira. */
export async function nutrir(params: {
  organizacaoId: string;
  leadId: string;
  motivo: MotivoNutricao;
  retomarEm?: string | null;
  observacao?: string | null;
  ator: Ator;
}): Promise<void> {
  const definicao = MOTIVOS_NUTRICAO.find((m) => m.chave === params.motivo);
  if (!definicao) {
    throw new RegraDeNegocio("nutricao_motivo_invalido", "Escolha um motivo válido para nutrição.");
  }
  // A data de retomada é opcional (decisão do Scott, 07/10): quando informada,
  // cria a tarefa de retomada abaixo; quando não, o lead fica em nutrição sem
  // reaparecer na fila. Nenhum motivo bloqueia por falta de data.

  const lead = await carregarLead(params.organizacaoId, params.leadId);

  await db.execute(sql`
    UPDATE leads SET
      estagio_pre_vendas = 'nutricao',
      nutricao_motivo = ${params.motivo},
      nutricao_retomar_em = ${params.retomarEm ?? null}::date,
      nutricao_observacao = ${params.observacao ?? null},
      nutrido_em = now(),
      nutrido_por = ${params.ator.usuarioId ?? null}::uuid,
      updated_at = now()
     WHERE id = ${params.leadId}::uuid
  `);

  // Bloco 01 §13: com data futura, cria a retomada de verdade — uma atividade
  // que reaparece na fila operacional na data. Sem isso "retomar em" seria só
  // um texto que ninguém lê de novo.
  if (params.retomarEm) {
    // Nutrir de novo com outra data substitui a retomada: a antiga é cancelada, não duplicada.
    await db.execute(sql`
      UPDATE tarefas SET status = 'declinada'
       WHERE organizacao_id = ${params.organizacaoId}::uuid AND lead_id = ${params.leadId}::uuid
         AND titulo = 'Retomar lead em nutrição' AND origem = 'PLAYBOOK'
         AND status NOT IN ('concluida', 'declinada')`);
    await db.execute(sql`
      INSERT INTO tarefas (organizacao_id, lead_id, empresa_id, usuario_id, titulo, descricao,
                           tipo, prioridade, data_vencimento, vence_em, origem, status)
      VALUES (
        ${params.organizacaoId}::uuid, ${params.leadId}::uuid, ${lead.empresa_id}::uuid,
        ${lead.responsavel_id ?? params.ator.usuarioId ?? null}::uuid,
        'Retomar lead em nutrição',
        ${params.observacao ?? definicao.rotulo},
        'follow_up', 'media',
        ${params.retomarEm}::date,
        ${`${params.retomarEm}T12:00:00`}::timestamptz,
        'PLAYBOOK', 'a_fazer'
      )
    `);
  }

  await registrarMudancaDeEtapa({
    organizacaoId: params.organizacaoId, ator: params.ator, leadId: params.leadId,
    de: lead.estagio_pre_vendas, para: "nutricao", tipo: "StageChanged",
    motivo: definicao.rotulo,
  });

  await registrarEvento({
    organizacaoId: params.organizacaoId, tipo: "LeadNurtured", ator: params.ator,
    leadId: params.leadId, empresaId: lead.empresa_id,
    contexto: { motivo: params.motivo, retomarEm: params.retomarEm ?? null, observacao: params.observacao ?? null },
    timeline: { tipo: "nota", titulo: "Lead movido para nutrição", descricao: definicao.rotulo },
  });
}

/** Bloco 01 §14: desqualificar exige motivo estruturado, e o registro precisa
 *  sustentar relatório depois (etapa anterior, origem, tempo até a decisão). */
export async function desqualificar(params: {
  organizacaoId: string;
  leadId: string;
  motivo: MotivoDesqualificacao;
  detalhe?: string | null;
  ator: Ator;
}): Promise<void> {
  // Motivo precisa ser uma chave conhecida: texto livre quebra o relatório de
  // desqualificação (o rótulo não resolve e o motivo vira "cru" na tela).
  if (!params.motivo || !MOTIVOS_DESQUALIFICACAO.some((m) => m.chave === params.motivo)) {
    throw new RegraDeNegocio("desqualificacao_exige_motivo", "Escolha o motivo da desqualificação.");
  }

  const lead = await carregarLead(params.organizacaoId, params.leadId);

  await db.execute(sql`
    UPDATE leads SET
      estagio_pre_vendas = 'desqualificado',
      desqualificacao_motivo = ${params.motivo},
      desqualificacao_detalhe = ${params.detalhe ?? null},
      desqualificado_em = now(),
      desqualificado_por = ${params.ator.usuarioId ?? null}::uuid,
      desqualificado_de_etapa = ${lead.estagio_pre_vendas},
      sdr_status = 'disqualified',
      updated_at = now()
     WHERE id = ${params.leadId}::uuid
  `);

  await registrarMudancaDeEtapa({
    organizacaoId: params.organizacaoId, ator: params.ator, leadId: params.leadId,
    de: lead.estagio_pre_vendas, para: "desqualificado", tipo: "StageChanged",
    motivo: params.motivo,
  });

  await registrarEvento({
    organizacaoId: params.organizacaoId, tipo: "LeadDisqualified", ator: params.ator,
    leadId: params.leadId, empresaId: lead.empresa_id,
    contexto: { motivo: params.motivo, detalhe: params.detalhe ?? null, etapaAnterior: lead.estagio_pre_vendas },
    timeline: { tipo: "nota", titulo: "Lead desqualificado", descricao: params.detalhe ?? params.motivo },
  });
}

/**
 * Devolve o Lead para QUALIFICADO.
 *
 * Bloco 01 §15: é o que acontece depois de um no-show. A oportunidade
 * continua existindo e o Lead volta a ser trabalhável, sem perder o fato de
 * que já foi qualificado.
 */
export async function voltarParaQualificado(params: {
  organizacaoId: string;
  leadId: string;
  motivo: string;
  ator: Ator;
}): Promise<void> {
  const lead = await carregarLead(params.organizacaoId, params.leadId);
  if (lead.estagio_pre_vendas === "qualificado") return;

  await db.execute(sql`
    UPDATE leads SET estagio_pre_vendas = 'qualificado', updated_at = now()
     WHERE id = ${params.leadId}::uuid
  `);

  await registrarMudancaDeEtapa({
    organizacaoId: params.organizacaoId, ator: params.ator, leadId: params.leadId,
    de: lead.estagio_pre_vendas, para: "qualificado", tipo: "StageChanged",
    motivo: params.motivo,
  });
}

/**
 * E11: o passo da cadência de cada lead, para o card e a gaveta do Pré-vendas.
 *
 * Quem está inscrito em cadência automática mostra o nome dela. Sem inscrição
 * (o caso da carga: 1.446 toques em `cadencia_execucoes` e nenhum enrollment),
 * o último toque registrado É o passo em que o lead está, e esconder isso
 * deixava o SDR sem saber se já tinha ligado ou mandado WhatsApp.
 */
export async function passoDaCadenciaPorLead(
  organizacaoId: string,
  leadIds: string[],
): Promise<Record<string, string>> {
  if (leadIds.length === 0) return {};
  const ids = literalDeTexto(leadIds);
  /* Só a inscrição VIVA conta. Cancelada ou concluída não é "o lead está numa
     cadência": o chip ficava no cartão depois de remover o lead. E o "Toque N ·
     canal" que vinha de `cadencia_execucoes` era resto da régua antiga de
     produção — saiu. */
  const linhas = await db.execute<{ lead_id: string; texto: string }>(sql`
    SELECT l.id::text AS lead_id, 'Cadência ' || ce_def.nome AS texto
      FROM leads l
      JOIN LATERAL (
        SELECT cd.nome
          FROM cadence_enrollments ce
          JOIN cadence_definitions cd ON cd.id = ce.cadence_definition_id
         WHERE ce.entity_type = 'lead' AND ce.entity_id = l.id
           AND ce.status IN ('active', 'waiting')
         ORDER BY ce.started_at DESC LIMIT 1
      ) ce_def ON true
     WHERE l.organizacao_id = ${organizacaoId}::uuid
       AND l.id = ANY(${ids}::uuid[])`);
  return Object.fromEntries(linhas.map((r) => [r.lead_id, r.texto]));
}
