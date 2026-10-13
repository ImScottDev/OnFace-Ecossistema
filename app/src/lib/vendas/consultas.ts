/**
 * Leitura do Módulo Vendas.
 *
 * As telas não montam SQL: elas pedem o que precisam aqui. Isso mantém a
 * tradução do legado num lugar só e garante que board, detalhe e relatório
 * contem a mesma história.
 *
 * Duas regras que se repetem em todas as consultas:
 *   - **Empresa-first** (Bloco 01 §5, Bloco 04 §4): o card mostra a Empresa
 *     como protagonista e a Pessoa como o contato através do qual se trabalha.
 *   - **Contador de resumo nunca sai de lista truncada**: os totais vêm de
 *     `count()` sobre a tabela inteira, não do array que a página carregou.
 */
import { origemCanonica } from "./origem-canonica";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  ROTULO_ETAPA_PIPELINE, ROTULO_ETAPA_PRE_VENDAS, ROTULO_FAMILIA,
  ROTULO_ESTADO_PROSPECCAO, ROTULO_RELACIONAMENTO,
  ETAPAS_PIPELINE, ETAPAS_FECHADAS, ETAPAS_PRE_VENDAS,
  SAIDAS_PRE_VENDAS, ESTADOS_PROSPECCAO,
  POR_PAGINA_PROSPECCAO, type EstadoProspeccao, type EstagioPreVendas, type EtapaPipeline,
  type RelacionamentoEmpresa,
} from "./dominio";
import { HORAS_ATRASO } from "./sla";
import { VIEWS_PRE_VENDAS, ehView, type ViewPreVendas } from "./dominio";
import { resumoSlaPreVendas } from "./sla-lead";
import { boardDeAquisicoes, somenteDePreVendas, type EstagioAquisicao } from "@onface/acquisition";
import { boardDeOportunidades } from "@onface/sales";

const LIMITE_PADRAO = 400;

/**
 * O teto de cartões do Pipeline, por etapa (o pacote divide pelas seis).
 *
 * 400 dava 67 por coluna, e o cabeçalho do quadro CONTA os cartões que
 * recebeu: Entrada anunciava 67 tendo 251, Proposta 67 tendo 190. Número que
 * mente é pior que número ausente, porque ninguém desconfia dele.
 *
 * 1800 = 300 por coluna, que cobre a maior etapa aberta (Entrada, 251) com
 * folga. Ganho e Perdido têm mais que isso e continuam cortadas — nascem
 * colapsadas, e são bucket de consulta, não fila de trabalho.
 */
const LIMITE_PIPELINE = 1800;

/**
 * Cartões por coluna.
 *
 * SEM limite operacional, por decisão do Kauã (24/09): o board mostra a etapa
 * inteira. O teto de 4.000 é só uma trava contra consulta patológica — a maior
 * etapa hoje tem 644 registros, e o board inteiro soma ~1.150.
 *
 * Eu vinha defendendo 120 com "montar milhares de cartões trava o navegador".
 * O número real desmente o argumento nesta base, e a decisão é de quem opera a
 * tela: quem trabalha a fila precisa chegar no fim dela sem pedir licença.
 */
const POR_COLUNA_PADRAO = 4000;

/* As views rápidas moram em `dominio.ts` — são vocabulário, não consulta, e a
   barra da tela (Client Component) precisa da lista. Importar daqui puxava o
   driver do Postgres para o bundle do navegador e derrubava a rota inteira com
   "Can't resolve 'fs'". Reexportadas para quem já as importava deste módulo. */
import { textoSimples, nomeCompleto, nomeEmpresaSql } from "./texto";
import { CHAVE_RASTREIO_META, valorLegivel, ajustarSiglas, rastreioMetaDeCampos, comIdentidadeDoFormulario } from "./respostas-formulario";

export { VIEWS_PRE_VENDAS, ehView, type ViewPreVendas };

/**
 * Lista de chaves como literal de array do Postgres.
 *
 * `= ANY(${array})` não funciona: o template do Drizzle espalha o array em um
 * parâmetro por item, e o Postgres recebe `ANY($2, $3, ...)`, que não é array.
 * Passar o literal como UM parâmetro de texto e deixar o Postgres fazer o cast
 * resolve. As chaves vêm sempre de constantes do domínio, nunca do usuário.
 */
function literalDeArray(valores: readonly string[]): string {
  return `{${valores.join(",")}}`;
}

/* ── Pré-vendas ────────────────────────────────────────────────────────── */

/**
 * `text[]` lido por `db.execute` cru às vezes chega como a string literal do
 * Postgres (`{"Callface AI",PABX}`), não como array — o driver só converte os
 * tipos que conhece. O export de Pré-vendas quebrava com
 * "servicos?.join is not a function". Normalizar aqui serve todo consumidor.
 */
function comoLista(v: unknown): string[] | null {
  if (v == null) return null;
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") {
    const corpo = v.replace(/^\{|\}$/g, "");
    if (!corpo) return [];
    return corpo.split(",").map((x) => x.trim().replace(/^"|"$/g, ""));
  }
  return null;
}

export interface CardPreVendas {
  leadId: string;
  /** Protagonista do card. */
  empresa: string;
  empresaId: string | null;
  /** Contato através do qual se trabalha a empresa. */
  pessoa: string | null;
  cargo: string | null;
  etapa: EstagioPreVendas;
  origem: string | null;
  campanha: string | null;
  servicos: string[] | null;
  /** A Tag do lead (tabela `labels`) — o segundo chip do cartão. */
  tag: string | null;
  responsavel: string | null;
  responsavelIniciais: string | null;
  /** Fato histórico, não posição no board (Bloco 01 §10). */
  qualificado: boolean;
  preQualificado: boolean;
  temWhatsapp: boolean;
  temEmail: boolean;
  temTelefone: boolean;
  /** Horas desde a última interação: é daqui que sai o sinal de SLA. */
  horasSemInteracao: number | null;
  horasNaEtapa: number | null;
  /** O lead tem a tag "No-show": faltou à reunião e precisa ser remarcado. */
  noShow: boolean;
  criadoEm: string;
  nutricaoRetomarEm: string | null;
  desqualificacaoMotivo: string | null;
  /** Quando o lead já concluiu o handoff, para onde ele leva. */
  oportunidadeId: string | null;
  /** O que alguém já preencheu em `leads.qualificacao`. Sem isto a gaveta abre
   *  em branco e mover o card pede preencher tudo de novo. */
  qualificacao: Record<string, unknown> | null;
  /** Próxima ação: a Task real, nunca uma string digitada no card. */
  proximaAcao: { id: string; titulo: string; venceEm: string | null } | null;
}

export interface FiltrosPreVendas {
  busca?: string | null;
  responsavelId?: string | null;
  origem?: string | null;
  campanha?: string | null;
  servico?: string | null;
  /** "ativos" | "nutricao" | "desqualificados" (Bloco 01 §22). */
  aba?: "ativos" | "nutricao" | "desqualificados";
  /** Recorte do board para aquisições sem responsável. */
  semDono?: boolean;
  desde?: string | null;
  /** View rápida. A tradução para condição de SQL mora em `FILTRO_DA_VIEW`. */
  view?: ViewPreVendas;
  /** Quem está olhando — só a view "meus" usa. */
  usuarioId?: string | null;
  /** Cartões por coluna. A tela aumenta com "ver mais"; o padrão cobre a
   *  primeira dobra sem carregar milhares de cartões de uma vez. */
  porColuna?: number;
}

/**
 * Quantos cada view rápida pega, sobre o universo inteiro.
 *
 * Uma consulta só, com `FILTER`: seis consultas separadas custariam seis
 * varreduras da mesma tabela para responder a mesma pergunta em seis recortes.
 *
 * Os contadores contam ABERTAS (exceto "todos"), e isso é regra: acusar atraso
 * de um lead desqualificado é pedir ação sobre algo que saiu do funil.
 */
async function contadoresDeViews(
  organizacaoId: string, usuarioId: string | null | undefined,
): Promise<Record<ViewPreVendas, number>> {
  const [c] = await db.execute<{
    todos: number; meus: number; hoje: number;
    atrasados: number; sem_dono: number; sem_proxima_acao: number;
  }>(sql`
    WITH base AS (
      SELECT a.closed_at, a.responsavel_id, a.last_touch_at, a.first_touch_at,
             a.created_at, px.vence_em
        FROM aquisicoes a
        -- Mesmo recorte do board: sem ele o chip "Sem dono" contaria 37
        -- prospects de outbound que coluna nenhuma mostra.
        LEFT JOIN leads lg ON lg.id = a.lead_legado_id
        LEFT JOIN LATERAL (
          SELECT COALESCE(t.vence_em, t.data_vencimento::timestamptz) AS vence_em
            FROM tarefas t
           WHERE t.lead_id = a.lead_legado_id
             AND t.organizacao_id = a.organizacao_id
             AND t.status NOT IN ('concluida', 'declinada')
           ORDER BY COALESCE(t.vence_em, t.data_vencimento::timestamptz) ASC NULLS LAST
           LIMIT 1
        ) px ON TRUE
       WHERE a.organizacao_id = ${organizacaoId}::uuid
         AND ${somenteDePreVendas(sql)}
    )
    SELECT
      count(*)::int AS todos,
      count(*) FILTER (
        WHERE closed_at IS NULL
          AND ${usuarioId ?? null}::uuid IS NOT NULL
          AND responsavel_id = ${usuarioId ?? null}::uuid
      )::int AS meus,
      -- "Hoje" é até o FIM do dia, não as próximas 24h: quem abre às 9h
      -- precisa ver o que vence às 15h.
      count(*) FILTER (
        WHERE closed_at IS NULL AND vence_em IS NOT NULL
          AND vence_em < date_trunc('day', now()) + interval '1 day'
      )::int AS hoje,
      count(*) FILTER (
        WHERE closed_at IS NULL
          AND (vence_em < now()
               OR COALESCE(last_touch_at, first_touch_at, created_at)
                  < now() - make_interval(hours => ${HORAS_ATRASO}))
      )::int AS atrasados,
      count(*) FILTER (WHERE closed_at IS NULL AND responsavel_id IS NULL)::int AS sem_dono,
      count(*) FILTER (WHERE closed_at IS NULL AND vence_em IS NULL)::int AS sem_proxima_acao
      FROM base`);

  return {
    todos: c?.todos ?? 0,
    meus: c?.meus ?? 0,
    hoje: c?.hoje ?? 0,
    atrasados: c?.atrasados ?? 0,
    "sem-dono": c?.sem_dono ?? 0,
    "sem-proxima-acao": c?.sem_proxima_acao ?? 0,
  };
}

/**
 * Traduz a view escolhida nas condições que a consulta canônica entende.
 *
 * "Hoje" é até o FIM do dia, não as próximas 24 horas: quem abre o board às 9h
 * quer ver o que vence às 15h, e um corte rolante esconderia metade da agenda
 * do próprio dia.
 */
function filtroDaView(view: ViewPreVendas | undefined, usuarioId: string | null | undefined) {
  const agora = new Date();
  switch (view) {
    case "meus":
      return { responsavelId: usuarioId ?? null };
    case "hoje": {
      const fimDoDia = new Date(agora);
      fimDoDia.setHours(23, 59, 59, 999);
      return { proximaAcaoAte: fimDoDia.toISOString() };
    }
    case "atrasados":
      return { atrasado: { agora: agora.toISOString(), semToqueHa: HORAS_ATRASO } };
    case "sem-dono":
      return { semDono: true };
    case "sem-proxima-acao":
      return { semProximaAcao: true };
    default:
      return {};
  }
}

export interface BoardPreVendas {
  colunas: Array<{ chave: EstagioPreVendas; rotulo: string; total: number; cards: CardPreVendas[] }>;
  resumo: {
    ativos: number; nutricao: number; desqualificados: number;
    semResponsavel: number; semPrimeiroContato: number;
    semProximaAcao: number; qualificadosNoMes: number;
    /** Média de horas entre a chegada e o primeiro toque, ou null se ninguém foi contatado. */
    horasAteContato: number | null;
  };
  filtros: { responsaveis: Array<{ id: string; nome: string; papel?: string | null }>; origens: string[]; campanhas: string[] };
  /** Quantos cada view rápida encontra. Sem isto a view é um botão às cegas. */
  contadores: Record<ViewPreVendas, number>;
}

export async function boardPreVendas(organizacaoId: string, filtros: FiltrosPreVendas = {}): Promise<BoardPreVendas> {
  // KANBAN ÚNICO (Documento Mestre v0.13, Módulo 01 §2).
  //
  // "Pré-vendas passa a ter um único Kanban operacional, com todas as
  // situações visíveis no mesmo espaço", com SETE colunas — Nutrição e
  // Desqualificado deixam de ser abas separadas.
  //
  // `aba` continua aceito e continua filtrando: as telas legadas do CRM2 ainda
  // chamam com ela, e removê-la agora quebraria o board antigo antes da
  // substituição. Sem `aba`, o board é o único.
  const aba = filtros.aba ?? null;
  const TODAS: EstagioPreVendas[] = [...ETAPAS_PRE_VENDAS, ...SAIDAS_PRE_VENDAS];
  const etapasDaAba: EstagioPreVendas[] = aba === null
    ? TODAS
    : aba === "ativos" ? [...ETAPAS_PRE_VENDAS]
    : aba === "nutricao" ? ["nutricao"] : ["desqualificado"];

  // CUTOVER DE LEITURA (fase 17). A fonte passou a ser `aquisicoes`.
  //
  // O que isto conserta: a consulta anterior filtrava
  // `WHERE estagio_pre_vendas = ANY(...)`, e 2.392 dos 3.989 leads têm esse
  // campo NULO. Eles existiam no banco, com dono e origem, e não apareciam em
  // tela nenhuma. No canônico não há registro sem estado: aquisição aberta e
  // não qualificada é "novo", que é um estado, não um vazio.
  // A view entra DEPOIS dos filtros explícitos e pode sobrescrevê-los: quem
  // clica em "Meus" está dizendo de quem é o board, e isso vence um
  // `responsavel=` que tivesse sobrado na URL.
  const daView = filtroDaView(filtros.view, filtros.usuarioId);

  const board = await boardDeAquisicoes(db as never, sql as never, organizacaoId, {
    etapas: etapasDaAba as EstagioAquisicao[],
    responsavelId: filtros.responsavelId ?? null,
    semDono: filtros.semDono ?? false,
    origem: filtros.origem ?? null,
    busca: filtros.busca ?? null,
    campanha: filtros.campanha ?? null,
    desde: filtros.desde ?? null,
    // Nutrição e desqualificado vivem em aquisição encerrada: o Kanban único
    // precisa delas, e a aba "ativos" continua sem.
    incluirEncerradas: aba !== "ativos",
    limite: LIMITE_PADRAO,
    porColuna: filtros.porColuna ?? POR_COLUNA_PADRAO,
    ...daView,
  });

  // Enriquecimento legado — TEMPORÁRIO, sai na fase 26 junto com as leituras
  // de fallback. São os campos que ainda não têm dono no modelo canônico:
  // interesse declarado, campanha, pré-qualificação e o negócio em aberto.
  const leadIds = board.cards.map((c) => c.leadId).filter((id): id is string => Boolean(id));
  const legado = new Map<string, {
    estagio: string | null; servicos: string[] | null;
    pre_qualificado: boolean; whatsapp: string | null; etapa_desde: string | null;
    negocio_ativo_id: string | null; qualificacao: Record<string, unknown> | null;
  }>();
  if (leadIds.length > 0) {
    const linhas = await db.execute<{
      id: string; estagio: string | null; servicos: string[] | null;
      pre_qualificado: boolean; whatsapp: string | null; etapa_desde: string | null;
      negocio_ativo_id: string | null; qualificacao: Record<string, unknown> | null;
    }>(sql`
      SELECT id::text, estagio_pre_vendas AS estagio,
             servicos_interesse AS servicos, pre_qualificado, whatsapp,
             /* Quando entrou na etapa ATUAL: a última mudança para ela. Sem histórico
                (lead que nunca mudou), vale o primeiro contato ou a criação. */
             COALESCE((SELECT max(sc.created_at) FROM status_changes sc
                        WHERE sc.lead_id = leads.id AND sc.para_status = leads.estagio_pre_vendas),
                      contato_desde_at, created_at)::text AS etapa_desde,
             negocio_ativo_id::text, qualificacao
        FROM leads WHERE id = ANY(${literalDeArray(leadIds)}::uuid[])`);
    for (const l of linhas) legado.set(l.id, l);
  }

  /* A tag do cartão — decisão do Kauã: é a Tag de verdade, não o serviço de
     interesse (que já tem chip próprio e filtro próprio).
     A tabela chama `labels`, e o vínculo canônico é `entity_labels`;
     `lead_labels` é a legada e ainda carrega vínculo que a canônica não tem,
     então as duas entram. Uma tag por lead: o cartão do protótipo mostra uma. */
  const tagPorLead = new Map<string, string>();
  const noShowPorLead = new Set<string>();
  if (leadIds.length > 0) {
    const linhas = await db.execute<{ lead_id: string; nome: string }>(sql`
      SELECT DISTINCT ON (v.lead_id) v.lead_id::text AS lead_id, l.nome
        FROM (
          SELECT entity_id AS lead_id, label_id FROM entity_labels
           WHERE entity_type = 'lead' AND entity_id = ANY(${literalDeArray(leadIds)}::uuid[])
          UNION
          SELECT lead_id, label_id FROM lead_labels
           WHERE lead_id = ANY(${literalDeArray(leadIds)}::uuid[])
        ) v
        JOIN labels l ON l.id = v.label_id AND l.organizacao_id = ${organizacaoId}::uuid
       ORDER BY v.lead_id, l.nome`);
    for (const t of linhas) tagPorLead.set(t.lead_id, t.nome);
    const faltaram = await db.execute<{ lead_id: string }>(sql`
      SELECT DISTINCT v.lead_id::text AS lead_id
        FROM (
          SELECT entity_id AS lead_id, label_id FROM entity_labels
           WHERE entity_type = 'lead' AND entity_id = ANY(${literalDeArray(leadIds)}::uuid[])
          UNION
          SELECT lead_id, label_id FROM lead_labels
           WHERE lead_id = ANY(${literalDeArray(leadIds)}::uuid[])
        ) v
        JOIN labels l ON l.id = v.label_id AND l.organizacao_id = ${organizacaoId}::uuid
       WHERE lower(l.nome) = 'no-show'`);
    for (const t of faltaram) noShowPorLead.add(t.lead_id);
  }

  const agora = Date.now();
  const horasDesde = (iso: string | null) =>
    iso ? Math.max(0, Math.floor((agora - new Date(iso).getTime()) / 3_600_000)) : null;

  const cards: CardPreVendas[] = board.cards
    .map((c) => {
      const l = c.leadId ? legado.get(c.leadId) : undefined;
      // O legado só refina onde ele sabe algo que o canônico NÃO deriva:
      // "qualificacao", um estado intermediário que não tem prova própria.
      //
      // Para o resto o canônico manda, e a razão é factual: `estagio_pre_vendas`
      // é um campo que alguém precisa lembrar de atualizar, e 2.392 leads
      // provam que ninguém lembra. Deixar o legado sobrescrever punha o card em
      // "Novo" enquanto o contador do canônico dizia "Em contato 531" — total e
      // cards discordando dentro da mesma tela.
      const etapa = (l?.estagio === "qualificacao" ? "qualificacao" : c.etapa) as EstagioPreVendas;
      return {
        leadId: c.leadId ?? c.aquisicaoId,
        empresa: c.empresa?.trim() || "Empresa não informada",
        empresaId: c.empresaId,
        pessoa: c.pessoa,
        cargo: c.cargo,
        etapa,
        origem: origemCanonica(c.origem),
        campanha: c.campanha,
        servicos: comoLista(l?.servicos),
        tag: (c.leadId ? tagPorLead.get(c.leadId) : null) ?? null,
        responsavel: c.responsavel,
        responsavelIniciais: iniciais(c.responsavel),
        qualificado: c.qualificado,
        preQualificado: Boolean(l?.pre_qualificado),
        temWhatsapp: Boolean(l?.whatsapp || c.telefone),
        temEmail: Boolean(c.email),
        temTelefone: Boolean(c.telefone),
        horasSemInteracao: horasDesde(c.ultimoToque ?? c.criadoEm),
        horasNaEtapa: horasDesde(l?.etapa_desde ?? c.criadoEm),
        noShow: Boolean(c.leadId && noShowPorLead.has(c.leadId)),
        criadoEm: c.criadoEm,
        nutricaoRetomarEm: c.retomarEm,
        desqualificacaoMotivo: c.motivoDesqualificacao,
        oportunidadeId: l?.negocio_ativo_id ?? null,
        qualificacao: l?.qualificacao ?? null,
        proximaAcao: c.proximaAcao,
      };
    })
    .filter((c) => etapasDaAba.includes(c.etapa))
    .filter((c) => !filtros.servico || (c.servicos ?? []).includes(filtros.servico));

  const colunas = (aba === "ativos" ? [...ETAPAS_PRE_VENDAS] : etapasDaAba).map((chave) => {
    // A ordem é a do fluxo, e as duas saídas ficam no fim: novo, em contato,
    // qualificação, qualificado, oportunidade, nutrição, desqualificado.
    const daColuna = cards.filter((c) => c.etapa === chave);
    return {
      chave, rotulo: ROTULO_ETAPA_PRE_VENDAS[chave],
      // O total vem de count() sobre a tabela inteira, nunca do array: com
      // limite de 400 cards, contar a página faria a coluna dizer 400 onde há
      // 2.756.
      total: board.totaisPorEtapa[chave] ?? daColuna.length,
      cards: daColuna,
    };
  });

  // Resumo sobre o universo canônico inteiro.
  const [resumo] = await db.execute<{
    ativos: number; nutricao: number; desqualificados: number;
    sem_responsavel: number; sem_primeiro_contato: number;
    sem_proxima_acao: number; qualificados_no_mes: number; horas_ate_contato: number | null;
  }>(sql`
    SELECT
      count(*) FILTER (WHERE a.closed_at IS NULL AND a.desqualificado_em IS NULL
                         AND COALESCE(a.nutricao_status,'') = '')::int AS ativos,
      count(*) FILTER (WHERE COALESCE(a.nutricao_status,'') <> '')::int AS nutricao,
      count(*) FILTER (WHERE a.desqualificado_em IS NOT NULL)::int AS desqualificados,
      count(*) FILTER (WHERE a.closed_at IS NULL AND a.responsavel_id IS NULL)::int AS sem_responsavel,
      -- "Sem 1o contato" e NAO ter havido toque DEPOIS da chegada, e nao
      -- last_touch_at nulo.
      --
      -- first_touch_at e a chegada do lead, e isso e um toque de verdade: ele
      -- veio ate nos. last_touch_at cai para a mesma data quando ninguem o
      -- contatou depois. Entao a condicao antiga nunca era verdadeira: ZERO de
      -- 3.989 aquisicoes tem last_touch_at nulo, e o cartao mostrava zero com
      -- alerta desligado enquanto 3.060 leads abertos jamais foram contatados.
      -- Um KPI que so sabe dizer "esta tudo bem".
      --
      -- Conferido por um segundo caminho, independente do canonico: leads
      -- abertos com last_contact_at nulo dao exatamente os mesmos 3.060.
      count(*) FILTER (
        WHERE a.closed_at IS NULL
          AND (a.last_touch_at IS NULL OR a.last_touch_at <= a.first_touch_at)
      )::int AS sem_primeiro_contato,
      -- Os tres abaixo existem porque a faixa de indicadores do protótipo
      -- nomeia estes cinco, e três deles não tinham número nenhum: a tela
      -- mostrava outros três, escolhidos por serem os que já existiam aqui.
      --
      -- "Sem próxima ação" é a mesma definição do cartão: lead aberto sem
      -- tarefa em aberto. O join é pelo lead legado, igual ao resto do arquivo.
      count(*) FILTER (
        WHERE a.closed_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM tarefas t
             WHERE t.lead_id = a.lead_legado_id
               AND t.organizacao_id = a.organizacao_id
               AND t.status NOT IN ('concluida', 'declinada')
          )
      )::int AS sem_proxima_acao,
      count(*) FILTER (
        WHERE a.qualificado_em >= date_trunc('month', now())
      )::int AS qualificados_no_mes,
      -- Tempo até 1º contato: NÃO é calculado aqui, ver lib/vendas/sla-lead.ts
      -- (a conta antiga, último toque menos chegada, crescia a cada mensagem).
      NULL::float AS horas_ate_contato
      FROM aquisicoes a
      -- Idem: o resumo soma o mesmo universo que as colunas, ou a tela diz
      -- "ativos 975" com 938 cartões embaixo.
      LEFT JOIN leads lg ON lg.id = a.lead_legado_id
     WHERE a.organizacao_id = ${organizacaoId}::uuid
       AND ${somenteDePreVendas(sql)}
  `);

  const contadores = await contadoresDeViews(organizacaoId, filtros.usuarioId);

  const responsaveis = await db.execute<{ id: string; nome: string; papel: string | null }>(sql`
    SELECT DISTINCT u.id::text, u.nome, u.role AS papel FROM usuarios u
     WHERE u.organizacao_id = ${organizacaoId}::uuid AND u.ativo = true ORDER BY u.nome
  `);
  const origens = await db.execute<{ origem: string }>(sql`
    SELECT DISTINCT origem FROM aquisicoes
     WHERE organizacao_id = ${organizacaoId}::uuid AND origem IS NOT NULL
     ORDER BY origem LIMIT 40
  `);
  const campanhas = await db.execute<{ campanha: string }>(sql`
    SELECT DISTINCT campaign AS campanha FROM pontos_contato
     WHERE organizacao_id = ${organizacaoId}::uuid AND campaign IS NOT NULL
     ORDER BY campaign LIMIT 40
  `);

  return {
    colunas,
    resumo: {
      ativos: resumo?.ativos ?? 0,
      nutricao: resumo?.nutricao ?? 0,
      desqualificados: resumo?.desqualificados ?? 0,
      semResponsavel: resumo?.sem_responsavel ?? 0,
      semPrimeiroContato: resumo?.sem_primeiro_contato ?? 0,
      semProximaAcao: resumo?.sem_proxima_acao ?? 0,
      qualificadosNoMes: resumo?.qualificados_no_mes ?? 0,
      // Coorte dos últimos 90 dias: a carga histórica chegou toda de uma vez e distorce a mediana.
      horasAteContato: (await resumoSlaPreVendas(organizacaoId, { desde: new Date(Date.now() - 90 * 86_400_000) })).horasAteContato,
    },
    filtros: {
      responsaveis: responsaveis.map((r) => ({ id: r.id, nome: r.nome, papel: r.papel ?? null })),
      origens: origens.map((o) => o.origem),
      campanhas: campanhas.map((c) => c.campanha),
    },
    contadores,
  };
}

/* ── Pipeline ──────────────────────────────────────────────────────────── */

/** Proposta que ainda pode virar "aceita" — é o que o badge chama de aberta. */
const EM_ABERTO = new Set(["enviada", "visualizada", "ajuste_solicitado"]);

export interface CardPipeline {
  id: string;
  empresa: string;
  empresaId: string | null;
  titulo: string;
  familia: string | null;
  familiaRotulo: string;
  etapa: EtapaPipeline;
  /** Bloco 02 §14: o card mostra VALOR, não MRR. */
  valor: number | null;
  responsavel: string | null;
  responsavelIniciais: string | null;
  proximaAcao: string | null;
  proximaAcaoEm: string | null;
  diasNaEtapa: number | null;
  /** Badges contextuais (Bloco 02 §26). Badge nunca vira coluna. */
  badges: string[];
  leadId: string | null;
  bundleId: string | null;
  propostas: number;
  /**
   * As propostas da oportunidade, da mais antiga para a mais nova.
   *
   * O cartão precisa do STATUS da proposta vigente (o chip) e o gate de
   * "Proposta" precisa saber se existe alguma — nenhum dos dois se resolve
   * com a contagem. Vem da mesma varredura que antes só contava, então não
   * custa uma ida a mais ao banco.
   *
   * Sem `itens`: somar item a item para todos os cartões do quadro seria caro
   * e o cartão não mostra a soma — quem mostra é o detalhe, que carrega sob
   * demanda.
   */
  propostasLista: Array<{ numero: number; versao: number; status: string; enviadaEm: string | null; total: number | null; totalRecorrente: number | null }>;
  /** Quem é a conversa. O cartão mostra "Pessoa · Cargo" abaixo da empresa. */
  pessoa: string | null;
  cargo: string | null;
  motivoPerda: string | null;
  /** Nomes das tags da oportunidade. */
  tags: string[];
}

export interface FiltrosPipeline {
  busca?: string | null;
  responsavelId?: string | null;
  familia?: string | null;
  /** Ausente (ou null) = board ÚNICO, com as seis colunas. */
  aba?: "abertas" | "ganhas" | "perdidas" | null;
  motion?: string | null;
  /** Next Step Invariant: só as oportunidades sem próximo passo combinado. */
  semProximaAcao?: boolean;
}

export interface BoardPipeline {
  colunas: Array<{
    chave: EtapaPipeline; rotulo: string; total: number; valorTotal: number; cards: CardPipeline[];
    /** Ganho e Perdido moram na mesma linha, mas fechadas — abrem sob clique. */
    colapsada: boolean;
    /** Ganho nunca é alcançado arrastando (§04), e perda exige motivo. */
    aceitaDrop: boolean;
  }>;
  resumo: { abertas: number; ganhas: number; perdidas: number; semProximaAcao: number; valorEmAberto: number };
  filtros: { responsaveis: Array<{ id: string; nome: string }>; familias: string[] };
}

export async function boardPipeline(organizacaoId: string, filtros: FiltrosPipeline = {}): Promise<BoardPipeline> {
  const aba = filtros.aba ?? null;
  // BOARD ÚNICO (v0.13 §02.2): "Ganho e Perdido ficam na mesma linha do
  // Kanban, colapsados por padrão" e são buckets de consulta, não etapas
  // livres de drag.
  //
  // `aba` continua aceito para o board legado do CRM2 não quebrar antes da
  // substituição; sem ela, as seis colunas vêm juntas.
  const etapas: EtapaPipeline[] = aba === null
    ? [...ETAPAS_PIPELINE, ...ETAPAS_FECHADAS]
    : aba === "abertas" ? [...ETAPAS_PIPELINE]
    : aba === "ganhas" ? ["ganho"] : ["perdido"];
  const busca = filtros.busca?.trim() ? `%${filtros.busca.trim().toLowerCase()}%` : null;

  // CUTOVER DE LEITURA (fase 17). A fonte passou a ser `oportunidades`.
  //
  // As duas tabelas contam a mesma história hoje — 527 abertas dos dois lados
  // e R$ 1.100 de diferença, que é um único negócio sem identidade, já virado
  // caso de reconciliação. Mas só uma delas é o modelo final, e enquanto a tela
  // ler a legada, a legada não morre.
  const board = await boardDeOportunidades(db as never, sql as never, organizacaoId, {
    etapas: etapas as string[],
    responsavelId: filtros.responsavelId ?? null,
    familia: filtros.familia ?? null,
    motion: filtros.motion ?? null,
    busca: filtros.busca ?? null,
    semProximaAcao: filtros.semProximaAcao ?? false,
    limite: LIMITE_PIPELINE,
  });

  // Enriquecimento legado — TEMPORÁRIO, sai na fase 26. São os sinais de
  // condução da venda que ainda não têm dono no canônico: próxima ação,
  // no-show, trial, estagnação e contagem de propostas.
  const negocioIds = board.cards.map((c) => c.negocioId).filter((id): id is string => Boolean(id));
  const legado = new Map<string, {
    proxima_acao: string | null; proxima_acao_em: string | null; etapa_desde: string | null;
    no_show_em: string | null; trial_iniciado_em: string | null; trial_encerrado_em: string | null;
    motivo_estagnacao: string | null; lead_id: string | null;
    propostas: Array<{ numero: number; versao: number; status: string; enviada_em: string | null; total: string | number | null; total_recorrente: string | number | null }> | null;
    pessoa: string | null; cargo: string | null; tags: string[] | null;
  }>();
  if (negocioIds.length > 0) {
    const linhas = await db.execute<{
      id: string; proxima_acao: string | null; proxima_acao_em: string | null;
      etapa_desde: string | null; no_show_em: string | null; trial_iniciado_em: string | null;
      trial_encerrado_em: string | null; motivo_estagnacao: string | null; lead_id: string | null;
        propostas: Array<{ numero: number; versao: number; status: string; enviada_em: string | null; total: string | number | null; total_recorrente: string | number | null }> | null;
      pessoa: string | null; cargo: string | null; tags: string[] | null;
    }>(sql`
      SELECT n.id::text,
             -- Próxima ação É tarefa (SPEC §23). A coluna legada fica como
             -- fallback, e não como segunda verdade: quem manda é a tarefa.
             COALESCE(t.titulo, n.proxima_acao) AS proxima_acao,
             COALESCE(t.vence_em, n.proxima_acao_em)::text AS proxima_acao_em,
             n.etapa_desde::text,
             -- No-show é estado da reunião (SPEC §23). A coluna legada fica
             -- como fallback dos 4 casos históricos que a 0082 não moveu sem
             -- palpite; quem manda é a reunião.
             COALESCE(r.faltou_em, n.no_show_em)::text AS no_show_em,
             COALESCE(oc.trial_iniciado_em, n.trial_iniciado_em)::text AS trial_iniciado_em,
             COALESCE(oc.trial_encerrado_em, n.trial_encerrado_em)::text AS trial_encerrado_em,
             COALESCE(oc.motivo_estagnacao, n.motivo_estagnacao) AS motivo_estagnacao,
             n.lead_id::text,
             -- O contato: o cartão mostra "Pessoa · Cargo" abaixo da empresa,
             -- e sem isto ele identifica a conta mas não com quem se fala.
             COALESCE(ps.nome, l.nome) AS pessoa,
             COALESCE(ps.cargo, l.cargo) AS cargo,
             -- Proposta é canônica (SPEC §13.1); o vínculo é que tem duas portas.
             --
             -- Uma varredura só, trazendo a LISTA. Antes eram três contagens
             -- sobre a mesma tabela (total, abertas, aceitas) e nenhuma delas
             -- dizia o status da proposta vigente, que é o que o cartão mostra.
             -- Contar em JS sobre o array custa nada e dá as três respostas.
             pr.propostas,
             -- Tags: canônica (entity_labels) ∪ legada (negocio_labels).
             to_json(ARRAY(SELECT lb.nome FROM labels lb
                    WHERE lb.organizacao_id = n.organizacao_id
                      AND lb.id IN (SELECT label_id FROM entity_labels
                                     WHERE entity_type = 'negocio' AND entity_id = n.id
                                    UNION SELECT label_id FROM negocio_labels WHERE negocio_id = n.id)
                    ORDER BY lb.nome)) AS tags
        FROM negocios n
        LEFT JOIN LATERAL (
          SELECT titulo, COALESCE(vence_em, data_vencimento) AS vence_em
            FROM tarefas
           WHERE negocio_id = n.id AND status IN ('a_fazer','em_andamento','aguardando')
           ORDER BY COALESCE(vence_em, data_vencimento) NULLS LAST LIMIT 1
        ) t ON TRUE
        LEFT JOIN LATERAL (
          SELECT max(data) AS faltou_em FROM reunioes
           WHERE negocio_id = n.id AND status = 'no_show'
        ) r ON TRUE
        LEFT JOIN oportunidades oc ON oc.negocio_id_legado = n.id
        LEFT JOIN leads l ON l.id = n.lead_id
        -- A pessoa canônica vence o lead quando existe: é o cadastro.
        LEFT JOIN pessoas ps ON ps.id = oc.pessoa_id
        LEFT JOIN LATERAL (
          SELECT json_agg(json_build_object(
                   'numero', p.numero, 'versao', p.versao, 'status', p.status,
                   'enviada_em', p.enviada_em::text, 'total', p.total_geral,
                   'total_recorrente', p.total_recorrente
                 ) ORDER BY p.numero, p.versao) AS propostas
            FROM propostas p
           WHERE p.negocio_id = n.id OR p.oportunidade_id = oc.id
        ) pr ON TRUE
       WHERE n.id = ANY(${literalDeArray(negocioIds)}::uuid[])`);
    for (const l of linhas) legado.set(l.id, l);
  }

  const agora = Date.now();
  const cards: CardPipeline[] = board.cards.map((c) => {
    const l = c.negocioId ? legado.get(c.negocioId) : undefined;
    // `json_agg` devolve NULL quando não há linha, e não um array vazio.
    const propostas = (l?.propostas ?? []).map((p) => ({
      numero: p.numero, versao: p.versao, status: p.status,
      enviadaEm: p.enviada_em,
      total: p.total == null ? null : Number(p.total),
      totalRecorrente: p.total_recorrente == null ? null : Number(p.total_recorrente),
    }));
    const badges: string[] = [];
    if (l?.no_show_em) badges.push("No-show");
    if (l?.trial_iniciado_em && !l.trial_encerrado_em) badges.push("Trial ativo");
    if (propostas.some((p) => p.status === "aceita")) badges.push("Proposta aceita");
    else if (propostas.some((p) => EM_ABERTO.has(p.status))) badges.push("Proposta aberta");
    if (l?.motivo_estagnacao) badges.push(rotuloEstagnacao(l.motivo_estagnacao));
    if (!l?.proxima_acao && !c.ganho && !c.perdido) badges.push("Sem próxima ação");
    else if (l?.proxima_acao_em && new Date(l.proxima_acao_em).getTime() < agora) badges.push("Atrasado");

    return {
      // O id continua sendo o do negócio: é por ele que a tela abre o detalhe e
      // move a etapa. A escrita migra na fase 25, depois da leitura.
      id: c.negocioId ?? c.oportunidadeId,
      empresa: c.empresa?.trim() || "Empresa não informada",
      empresaId: c.empresaId,
      titulo: c.titulo,
      familia: c.familia,
      familiaRotulo: ROTULO_FAMILIA[(c.familia ?? "UNKNOWN") as keyof typeof ROTULO_FAMILIA] ?? c.familia ?? "Não classificada",
      etapa: c.etapa as EtapaPipeline,
      valor: c.valor,
      responsavel: c.responsavel,
      responsavelIniciais: iniciais(c.responsavel),
      proximaAcao: l?.proxima_acao ?? null,
      proximaAcaoEm: l?.proxima_acao_em ?? null,
      diasNaEtapa: l?.etapa_desde
        ? Math.max(0, Math.floor((agora - new Date(l.etapa_desde).getTime()) / 86_400_000))
        : null,
      badges,
      leadId: l?.lead_id ?? null,
      bundleId: c.bundleId,
      propostas: propostas.length,
      propostasLista: propostas,
      pessoa: l?.pessoa ?? null,
      cargo: l?.cargo ?? null,
      motivoPerda: c.motivoPerda,
      tags: l?.tags ?? [],
    };
  });

  const totalDaEtapa = new Map(Object.entries(board.totaisPorEtapa));

  const colunas = etapas.map((chave) => {
    const daColuna = cards.filter((c) => c.etapa === chave);
    const agregado = totalDaEtapa.get(chave);
    const fechada = (ETAPAS_FECHADAS as readonly string[]).includes(chave);
    return {
      chave, rotulo: ROTULO_ETAPA_PIPELINE[chave],
      total: agregado?.n ?? daColuna.length,
      valorTotal: agregado?.valor ?? daColuna.reduce((soma, c) => soma + (c.valor ?? 0), 0),
      cards: daColuna,
      // Ganho e Perdido nascem colapsados e NÃO aceitam drop: são buckets de
      // consulta. Ganho nunca é alcançado arrastando (v0.13 §02.3) e perda
      // exige motivo estruturado, que é um fluxo, não um drop.
      colapsada: fechada,
      aceitaDrop: !fechada,
    };
  });

  const [resumo] = await db.execute<{
    abertas: number; ganhas: number; perdidas: number; sem_proxima: number; valor_aberto: string | null;
  }>(sql`
    SELECT
      count(*) FILTER (WHERE o.etapa IN ('entrada','diagnostico','proposta','negociacao'))::int AS abertas,
      count(*) FILTER (WHERE o.etapa = 'ganho')::int AS ganhas,
      count(*) FILTER (WHERE o.etapa = 'perdido')::int AS perdidas,
      -- "Sem próxima ação" tem que olhar a Task real, como o cartao faz
      -- (ha tarefa aberta, entao tem proxima acao), e nao so a coluna legada
      -- proxima_acao, que esta vazia em quase tudo. Olhar so o legado dava o
      -- numero certo por coincidencia (533 de 536), e divergiria do board no
      -- instante em que alguem definisse uma proxima acao por tarefa.
      count(*) FILTER (WHERE o.etapa IN ('entrada','diagnostico','proposta','negociacao')
                         AND n.proxima_acao IS NULL
                         AND NOT EXISTS (
                           SELECT 1 FROM tarefas t
                            WHERE t.negocio_id = n.id
                              AND t.status IN ('a_fazer','em_andamento','aguardando')
                         ))::int AS sem_proxima,
      COALESCE(SUM(o.valor) FILTER (WHERE o.etapa IN ('entrada','diagnostico','proposta','negociacao')), 0)::text AS valor_aberto
      FROM oportunidades o
      LEFT JOIN negocios n ON n.id = o.negocio_id_legado
     WHERE o.organizacao_id = ${organizacaoId}::uuid
  `);

  const responsaveis = await db.execute<{ id: string; nome: string }>(sql`
    SELECT id::text, nome FROM usuarios
     WHERE organizacao_id = ${organizacaoId}::uuid AND ativo = true ORDER BY nome
  `);
  const familias = await db.execute<{ familia: string }>(sql`
    SELECT DISTINCT service_family AS familia FROM oportunidades
     WHERE organizacao_id = ${organizacaoId}::uuid AND service_family IS NOT NULL ORDER BY 1
  `);

  return {
    colunas,
    resumo: {
      abertas: resumo?.abertas ?? 0,
      ganhas: resumo?.ganhas ?? 0,
      perdidas: resumo?.perdidas ?? 0,
      semProximaAcao: resumo?.sem_proxima ?? 0,
      valorEmAberto: Number(resumo?.valor_aberto ?? 0),
    },
    filtros: {
      responsaveis: responsaveis.map((r) => ({ id: r.id, nome: r.nome })),
      familias: familias.map((f) => f.familia),
    },
  };
}

function rotuloEstagnacao(chave: string): string {
  switch (chave) {
    case "sem_retorno": return "Sem retorno";
    case "trava_negociacao": return "Trava na negociação";
    case "trava_assinatura": return "Trava na assinatura";
    case "outra_data": return "Outra data";
    default: return chave;
  }
}

/* ── Prospecção ────────────────────────────────────────────────────────── */

export interface LinhaProspeccao {
  leadId: string;
  empresa: string;
  empresaId: string | null;
  pessoa: string | null;
  cargo: string | null;
  email: string | null;
  telefone: string | null;
  setor: string | null;
  porte: string | null;
  estado: EstadoProspeccao;
  estadoRotulo: string;
  responsavel: string | null;
  responsavelId: string | null;
  lista: string | null;
  fonte: string | null;
  cadencia: string | null;
  /** Status do motor da matrícula mais recente (active, paused, completed, failed…). */
  cadenciaStatus: string | null;
  /** Posição derivada: ações já executadas + a próxima, e `totalPassos` = ações da cadência. */
  passoAtual: number | null;
  passosExecutados: number | null;
  totalPassos: number | null;
  proximaAcaoEm: string | null;
  preQualificado: boolean;
  descarteMotivo: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export const ORDENS_PROSPECCAO = ["atividade", "empresa", "estado", "responsavel", "cadencia", "proxima", "criado"] as const;
export type OrdemProspeccao = (typeof ORDENS_PROSPECCAO)[number];
/** Filas derivadas (indicadores), nunca estados novos no banco. */
export const FILAS_PROSPECCAO = ["sem_responsavel", "sem_contato", "cadencia_pausada", "cadencia_com_falha"] as const;
export type FilaProspeccao = (typeof FILAS_PROSPECCAO)[number];

export interface FiltrosProspeccao {
  busca?: string | null;
  /** UUID, ou "sem" para quem não tem responsável. */
  responsavelId?: string | null;
  estado?: EstadoProspeccao | null;
  lista?: string | null;
  /** UUID da definição, ou "sem" para quem não está em cadência viva. */
  cadenciaId?: string | null;
  fila?: FilaProspeccao | null;
  ordem?: OrdemProspeccao | null;
  direcao?: "asc" | "desc" | null;
  pagina?: number | null;
  porPagina?: number | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * FROM + joins da Prospecção. Um só lugar para o que a lista, o Kanban e os
 * totais enxergam, para que os números das abas sejam os mesmos da tabela.
 *
 * Posição na cadência: o motor guarda `current_step_id` (id, não número) e o
 * passo pode ser espera ou condição. A posição confiável vem dos EVENTOS
 * persistidos: quantas ações distintas da versão pinada já foram executadas.
 */
const FROM_PROSPECCAO = sql`
  FROM leads l
  LEFT JOIN empresas e ON e.id = l.empresa_id
  LEFT JOIN usuarios u ON u.id = l.responsavel_id
  LEFT JOIN LATERAL (
    SELECT * FROM cadence_enrollments x
     WHERE x.entity_type = 'lead' AND x.entity_id = l.id
     ORDER BY x.started_at DESC LIMIT 1
  ) ce ON true
  LEFT JOIN cadence_definitions cd ON cd.id = ce.cadence_definition_id
  LEFT JOIN cadence_versions cv ON cv.id = ce.cadence_version_id
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM cadence_enrollment_events ev
              WHERE ev.enrollment_id = ce.id AND ev.status = 'executado' AND ev.step_id = s.passo ->> 'id'
           ))::int AS feitos
      FROM jsonb_array_elements(COALESCE(cv.compiled_steps, cd.steps, '[]'::jsonb)) AS s(passo)
     WHERE s.passo ->> 'tipo' = 'action'
  ) pos ON ce.id IS NOT NULL
`;

function filtrosDeProspeccao(organizacaoId: string, f: FiltrosProspeccao, comEstado: boolean) {
  const busca = f.busca?.trim() ? `%${f.busca.trim().toLowerCase()}%` : null;
  const digitos = f.busca?.replace(/\D/g, "") ?? "";
  const buscaFone = digitos.length >= 4 ? `%${digitos}%` : null;
  const resp = f.responsavelId && f.responsavelId !== "sem" && UUID_RE.test(f.responsavelId) ? f.responsavelId : null;
  const semResp = f.responsavelId === "sem";
  const cad = f.cadenciaId && f.cadenciaId !== "sem" && UUID_RE.test(f.cadenciaId) ? f.cadenciaId : null;
  const semCad = f.cadenciaId === "sem";
  const fila = f.fila ?? null;

  return sql`
    WHERE l.organizacao_id = ${organizacaoId}::uuid
      AND l.prospeccao_estado IS NOT NULL
      ${comEstado && f.estado ? sql`AND l.prospeccao_estado = ${f.estado}` : sql``}
      ${resp ? sql`AND l.responsavel_id = ${resp}::uuid` : sql``}
      ${semResp ? sql`AND l.responsavel_id IS NULL` : sql``}
      ${cad ? sql`AND ce.cadence_definition_id = ${cad}::uuid` : sql``}
      ${semCad ? sql`AND (ce.id IS NULL OR ce.status NOT IN ('active','waiting','waiting_reply','paused'))` : sql``}
      ${f.lista ? sql`AND EXISTS (
        SELECT 1 FROM lead_labels ll_lista JOIN labels lb_lista ON lb_lista.id = ll_lista.label_id
         WHERE ll_lista.lead_id = l.id AND lb_lista.organizacao_id = l.organizacao_id AND lb_lista.nome = ${f.lista})` : sql``}
      ${fila === "sem_responsavel" ? sql`AND l.responsavel_id IS NULL` : sql``}
      ${fila === "sem_contato" ? sql`AND COALESCE(trim(l.email),'') = '' AND COALESCE(trim(l.telefone),'') = '' AND COALESCE(trim(l.whatsapp),'') = ''` : sql``}
      ${fila === "cadencia_pausada" ? sql`AND ce.status = 'paused'` : sql``}
      ${fila === "cadencia_com_falha" ? sql`AND ce.status = 'failed'` : sql``}
      ${busca ? sql`AND (lower(COALESCE(e.nome, l.empresa, '')) LIKE ${busca}
            OR lower(concat_ws(' ', l.nome, l.sobrenome)) LIKE ${busca}
            OR lower(COALESCE(l.email, '')) LIKE ${busca}
            OR lower(COALESCE(e.setor, '')) LIKE ${busca}
            ${buscaFone ? sql`OR regexp_replace(COALESCE(l.telefone, l.whatsapp, ''), '\\D', '', 'g') LIKE ${buscaFone}` : sql``})` : sql``}
  `;
}

const ORDEM_SQL: Record<OrdemProspeccao, string> = {
  atividade: "l.updated_at",
  empresa: "lower(COALESCE(e.nome, l.empresa, ''))",
  estado: "array_position(ARRAY['novo','em_cadencia','respondeu','sem_resposta','pre_qualificado','oportunidade','descartado'], l.prospeccao_estado)",
  responsavel: "lower(COALESCE(u.nome, ''))",
  cadencia: "lower(COALESCE(cd.nome, ''))",
  proxima: "ce.scheduled_at",
  criado: "l.created_at",
};

const COLUNAS_PROSPECCAO = sql`
  SELECT l.id::text AS lead_id, COALESCE(e.nome, l.empresa) AS empresa, l.empresa_id::text,
         NULLIF(trim((CASE WHEN COALESCE(trim(l.sobrenome),'')='' THEN trim(l.nome) WHEN lower(trim(l.sobrenome))=lower(trim(l.nome)) OR lower(trim(l.sobrenome)) LIKE lower(trim(l.nome))||' %' THEN trim(l.sobrenome) WHEN lower(trim(l.nome)) LIKE '% '||lower(trim(l.sobrenome)) THEN trim(l.nome) ELSE trim(l.nome)||' '||trim(l.sobrenome) END)), '') AS pessoa, l.cargo,
         l.email, COALESCE(l.telefone, l.whatsapp) AS telefone,
         e.setor, e.porte, l.prospeccao_estado AS estado, u.nome AS responsavel, l.responsavel_id::text AS responsavel_id,
         (SELECT lb.nome FROM lead_labels ll JOIN labels lb ON lb.id = ll.label_id
           WHERE ll.lead_id = l.id ORDER BY lb.nome LIMIT 1) AS lista,
         (SELECT COALESCE(pc.source, pc.tipo_origem) FROM pontos_contato pc
           WHERE pc.lead_id_legado = l.id ORDER BY pc.is_first_touch DESC, pc.ocorrido_em ASC LIMIT 1) AS fonte,
         cd.nome AS cadencia, ce.status AS cadencia_status,
         pos.feitos AS passos_feitos, pos.total AS total_passos,
         CASE WHEN ce.status IN ('active','waiting','waiting_reply') THEN ce.scheduled_at::text END AS proxima_acao_em,
         l.pre_qualificado, l.prospeccao_descarte_motivo AS descarte_motivo,
         l.created_at::text AS criado_em, l.updated_at::text AS atualizado_em
`;

type LinhaBruta = {
  lead_id: string; empresa: string | null; empresa_id: string | null;
  pessoa: string | null; cargo: string | null; email: string | null; telefone: string | null;
  setor: string | null; porte: string | null;
  estado: string; responsavel: string | null; responsavel_id: string | null; lista: string | null; fonte: string | null;
  cadencia: string | null; cadencia_status: string | null; passos_feitos: number | null; total_passos: number | null;
  proxima_acao_em: string | null; pre_qualificado: boolean;
  descarte_motivo: string | null; criado_em: string; atualizado_em: string;
};

/**
 * Posição derivada do motor. Matrícula ativa: a próxima ação a executar
 * (feitos + 1, limitado ao total). Encerrada (completa, cancelada, falha):
 * quantas foram de fato executadas. Sem matrícula: nada a mostrar.
 */
export function passoDaCadencia(
  status: string | null, feitos: number | null, total: number | null,
): { passoAtual: number | null; passosExecutados: number | null } {
  if (!status || total == null) return { passoAtual: null, passosExecutados: null };
  const f = Math.max(0, Math.min(feitos ?? 0, total));
  const viva = ["active", "waiting", "waiting_reply", "paused"].includes(status);
  if (status === "completed") return { passoAtual: total, passosExecutados: total };
  return { passoAtual: viva ? Math.min(f + 1, total) : f, passosExecutados: f };
}

function linhaDeProspeccao(l: LinhaBruta): LinhaProspeccao {
  const { passoAtual, passosExecutados } = passoDaCadencia(l.cadencia_status, l.passos_feitos, l.total_passos);
  return {
    leadId: l.lead_id,
    empresa: l.empresa?.trim() || "Empresa não informada",
    empresaId: l.empresa_id,
    pessoa: l.pessoa,
    cargo: l.cargo,
    email: l.email,
    telefone: l.telefone,
    setor: l.setor,
    porte: l.porte,
    estado: l.estado as EstadoProspeccao,
    estadoRotulo: ROTULO_ESTADO_PROSPECCAO[l.estado as EstadoProspeccao] ?? l.estado,
    responsavel: l.responsavel,
    responsavelId: l.responsavel_id,
    lista: l.lista,
    fonte: l.fonte,
    cadencia: l.cadencia,
    cadenciaStatus: l.cadencia_status,
    passoAtual,
    passosExecutados,
    totalPassos: l.total_passos,
    proximaAcaoEm: l.proxima_acao_em,
    preQualificado: l.pre_qualificado,
    descarteMotivo: l.descarte_motivo,
    criadoEm: l.criado_em,
    atualizadoEm: l.atualizado_em,
  };
}

async function opcoesDeFiltroProspeccao(organizacaoId: string) {
  const [responsaveis, listas, cadencias] = await Promise.all([
    db.execute<{ id: string; nome: string }>(sql`
      SELECT id::text, nome FROM usuarios WHERE organizacao_id = ${organizacaoId}::uuid AND ativo = true ORDER BY nome`),
    db.execute<{ nome: string }>(sql`
      SELECT DISTINCT lb.nome FROM labels lb
        JOIN lead_labels ll ON ll.label_id = lb.id
        JOIN leads l ON l.id = ll.lead_id
       WHERE lb.organizacao_id = ${organizacaoId}::uuid AND l.prospeccao_estado IS NOT NULL
       ORDER BY 1 LIMIT 40`),
    db.execute<{ id: string; nome: string }>(sql`
      SELECT DISTINCT cd.id::text, cd.nome FROM cadence_enrollments ce
        JOIN cadence_definitions cd ON cd.id = ce.cadence_definition_id
        JOIN leads l ON l.id = ce.entity_id AND ce.entity_type = 'lead'
       WHERE l.organizacao_id = ${organizacaoId}::uuid AND l.prospeccao_estado IS NOT NULL
       ORDER BY 2 LIMIT 40`),
  ]);
  return {
    responsaveis: responsaveis.map((r) => ({ id: r.id, nome: r.nome })),
    listas: listas.map((l) => l.nome),
    cadencias: cadencias.map((c) => ({ id: c.id, nome: c.nome })),
  };
}

/** Contagem por estado dentro dos MESMOS filtros (menos o de estado): os
 *  números das abas acompanham a busca, em vez de contar a base inteira. */
async function resumoPorEstado(organizacaoId: string, filtros: FiltrosProspeccao): Promise<Record<EstadoProspeccao, number>> {
  const linhas = await db.execute<{ estado: string; n: number }>(sql`
    SELECT l.prospeccao_estado AS estado, count(*)::int AS n
    ${FROM_PROSPECCAO} ${filtrosDeProspeccao(organizacaoId, filtros, false)}
    GROUP BY 1`);
  const resumo = Object.fromEntries(ESTADOS_PROSPECCAO.map((e) => [e, 0])) as Record<EstadoProspeccao, number>;
  for (const r of linhas) resumo[r.estado as EstadoProspeccao] = r.n;
  return resumo;
}


export async function listaProspeccao(organizacaoId: string, filtros: FiltrosProspeccao = {}): Promise<{
  linhas: LinhaProspeccao[];
  resumo: Record<EstadoProspeccao, number>;
  filtros: { responsaveis: Array<{ id: string; nome: string }>; listas: string[]; cadencias: Array<{ id: string; nome: string }> };
  /** Total do recorte (com o filtro de estado) e a janela devolvida. */
  paginacao: { total: number; pagina: number; porPagina: number; paginas: number };
}> {
  const porPagina = (POR_PAGINA_PROSPECCAO as readonly number[]).includes(filtros.porPagina ?? 0) ? filtros.porPagina! : 25;
  const direcao = filtros.direcao === "asc" ? "ASC" : "DESC";
  const ordem = filtros.ordem && ORDEM_SQL[filtros.ordem] ? filtros.ordem : "atividade";
  // Empresa/responsável/cadência/estado leem melhor ascendentes quando o usuário não escolheu.
  const dir = filtros.direcao ? direcao : ["empresa", "responsavel", "cadencia", "estado"].includes(ordem) ? "ASC" : "DESC";
  const nulos = ordem === "proxima" ? "NULLS LAST" : "";

  const [{ n: total }] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n ${FROM_PROSPECCAO} ${filtrosDeProspeccao(organizacaoId, filtros, true)}`);
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const pagina = Math.min(Math.max(1, Math.trunc(filtros.pagina ?? 1) || 1), paginas);

  const linhas = await db.execute<LinhaBruta>(sql`
    ${COLUNAS_PROSPECCAO} ${FROM_PROSPECCAO} ${filtrosDeProspeccao(organizacaoId, filtros, true)}
     ORDER BY ${sql.raw(ORDEM_SQL[ordem])} ${sql.raw(dir)} ${sql.raw(nulos)}, l.id
     LIMIT ${porPagina} OFFSET ${(pagina - 1) * porPagina}`);

  const [resumo, opcoes] = await Promise.all([resumoPorEstado(organizacaoId, filtros), opcoesDeFiltroProspeccao(organizacaoId)]);

  return {
    linhas: linhas.map(linhaDeProspeccao),
    resumo,
    filtros: opcoes,
    paginacao: { total, pagina, porPagina, paginas },
  };
}

/** Colunas do Kanban: as três operacionais (o resto são desfechos, tratados como filas). */
export const COLUNAS_KANBAN_PROSPECCAO = ["novo", "em_cadencia", "respondeu"] as const;

/**
 * Cartões do Kanban de Prospecção, `porColuna` por estado, mais recentes
 * primeiro. Mesmo recorte de filtros da lista (menos o de estado: o board é
 * quem mostra os estados). O total de cada coluna vem do resumo, não do corte.
 */
export async function kanbanProspeccao(organizacaoId: string, filtros: FiltrosProspeccao = {}, porColuna = 25): Promise<{
  colunas: Array<{ estado: EstadoProspeccao; total: number; cards: LinhaProspeccao[] }>;
  resumo: Record<EstadoProspeccao, number>;
  filtros: { responsaveis: Array<{ id: string; nome: string }>; listas: string[]; cadencias: Array<{ id: string; nome: string }> };
}> {
  const limite = Math.min(Math.max(Math.trunc(porColuna) || 25, 10), 500);
  const linhas = await db.execute<LinhaBruta>(sql`
    SELECT * FROM (
      ${COLUNAS_PROSPECCAO},
             row_number() OVER (PARTITION BY l.prospeccao_estado ORDER BY l.updated_at DESC, l.id) AS rn
      ${FROM_PROSPECCAO} ${filtrosDeProspeccao(organizacaoId, { ...filtros, estado: null }, false)}
        AND l.prospeccao_estado = ANY(ARRAY['novo','em_cadencia','respondeu'])
    ) t WHERE rn <= ${limite} ORDER BY rn`);
  const [resumo, opcoes] = await Promise.all([resumoPorEstado(organizacaoId, filtros), opcoesDeFiltroProspeccao(organizacaoId)]);
  const todas = linhas.map(linhaDeProspeccao);
  return {
    colunas: COLUNAS_KANBAN_PROSPECCAO.map((estado) => ({
      estado, total: resumo[estado] ?? 0, cards: todas.filter((c) => c.estado === estado),
    })),
    resumo,
    filtros: opcoes,
  };
}

/* ── Operação / Fila BDR (indicadores REAIS) ───────────────────────────── */

export interface OperacaoProspeccao {
  total: number;
  porEstado: Record<EstadoProspeccao, number>;
  /** Indicadores derivados de dados persistidos. `null` = sem base para calcular. */
  indicadores: {
    novosSemResponsavel: number;
    semContato: number;
    cadenciaAtiva: number;
    cadenciaPausada: number;
    cadenciaComFalha: number;
    /** Quem respondeu e ainda não foi tratado: o dado mais quente parado. */
    respondeuAguardando: number;
    respondeuMaisAntigoHoras: number | null;
    adicionadosUltimos7Dias: number;
  };
  /** Quantos chegaram a cada marco (status_changes), com taxa sobre a base. */
  funil: { base: number; chegaramEmCadencia: number; responderam: number; preQualificados: number; oportunidades: number; descartados: number };
  descartePorMotivo: Array<{ motivo: string; n: number }>;
  filaPorResponsavel: Array<{ responsavelId: string | null; nome: string; novo: number; emCadencia: number; respondeu: number; total: number }>;
  /** Listas (etiquetas) em uso na base, com o total de empresas. */
  listas: Array<{ nome: string; total: number; abertas: number }>;
  /** Cadências que já receberam prospects, com o que de fato aconteceu. */
  cadencias: Array<{ id: string; nome: string; matriculados: number; ativos: number; responderam: number; concluidos: number; falhas: number }>;
}

export async function operacaoProspeccao(organizacaoId: string): Promise<OperacaoProspeccao> {
  const [ind] = await db.execute<{
    total: number; novos_sem_resp: number; sem_contato: number; cad_ativa: number; cad_pausada: number; cad_falha: number;
    respondeu_aguardando: number; respondeu_mais_antigo_h: number | null; novos_7d: number;
  }>(sql`
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE l.prospeccao_estado = 'novo' AND l.responsavel_id IS NULL)::int AS novos_sem_resp,
           count(*) FILTER (WHERE l.prospeccao_estado IN ('novo','em_cadencia','respondeu','sem_resposta')
                              AND COALESCE(trim(l.email),'') = '' AND COALESCE(trim(l.telefone),'') = '' AND COALESCE(trim(l.whatsapp),'') = '')::int AS sem_contato,
           count(*) FILTER (WHERE ce.status IN ('active','waiting','waiting_reply'))::int AS cad_ativa,
           count(*) FILTER (WHERE ce.status = 'paused')::int AS cad_pausada,
           count(*) FILTER (WHERE ce.status = 'failed')::int AS cad_falha,
           count(*) FILTER (WHERE l.prospeccao_estado = 'respondeu')::int AS respondeu_aguardando,
           floor(extract(epoch FROM now() - min(l.updated_at) FILTER (WHERE l.prospeccao_estado = 'respondeu')) / 3600)::int AS respondeu_mais_antigo_h,
           count(*) FILTER (WHERE l.created_at > now() - interval '7 days')::int AS novos_7d
      FROM leads l
      LEFT JOIN LATERAL (
        SELECT status FROM cadence_enrollments x WHERE x.entity_type = 'lead' AND x.entity_id = l.id
         ORDER BY x.started_at DESC LIMIT 1) ce ON true
     WHERE l.organizacao_id = ${organizacaoId}::uuid AND l.prospeccao_estado IS NOT NULL
  `);

  const porEstadoLinhas = await db.execute<{ estado: string; n: number }>(sql`
    SELECT prospeccao_estado AS estado, count(*)::int AS n FROM leads
     WHERE organizacao_id = ${organizacaoId}::uuid AND prospeccao_estado IS NOT NULL GROUP BY 1`);
  const porEstado = Object.fromEntries(ESTADOS_PROSPECCAO.map((e) => [e, 0])) as Record<EstadoProspeccao, number>;
  for (const r of porEstadoLinhas) porEstado[r.estado as EstadoProspeccao] = r.n;

  // Marcos pelo HISTÓRICO (status_changes): quem já passou por um estado conta
  // mesmo que tenha seguido adiante.
  const [marcos] = await db.execute<{ cad: number; resp: number; opp: number; desc: number }>(sql`
    SELECT count(DISTINCT sc.lead_id) FILTER (WHERE sc.para_status = 'prospeccao:em_cadencia')::int AS cad,
           count(DISTINCT sc.lead_id) FILTER (WHERE sc.para_status = 'prospeccao:respondeu')::int AS resp,
           count(DISTINCT sc.lead_id) FILTER (WHERE sc.para_status = 'prospeccao:oportunidade')::int AS opp,
           count(DISTINCT sc.lead_id) FILTER (WHERE sc.para_status = 'prospeccao:descartado')::int AS desc
      FROM status_changes sc JOIN leads l ON l.id = sc.lead_id
     WHERE l.organizacao_id = ${organizacaoId}::uuid AND l.prospeccao_estado IS NOT NULL`);

  const descartes = await db.execute<{ motivo: string; n: number }>(sql`
    SELECT prospeccao_descarte_motivo AS motivo, count(*)::int AS n FROM leads
     WHERE organizacao_id = ${organizacaoId}::uuid AND prospeccao_estado = 'descartado' AND prospeccao_descarte_motivo IS NOT NULL
     GROUP BY 1 ORDER BY 2 DESC`);

  const fila = await db.execute<{ id: string | null; nome: string | null; novo: number; cad: number; resp: number; total: number }>(sql`
    SELECT l.responsavel_id::text AS id, u.nome,
           count(*) FILTER (WHERE l.prospeccao_estado = 'novo')::int AS novo,
           count(*) FILTER (WHERE l.prospeccao_estado = 'em_cadencia')::int AS cad,
           count(*) FILTER (WHERE l.prospeccao_estado = 'respondeu')::int AS resp,
           count(*)::int AS total
      FROM leads l LEFT JOIN usuarios u ON u.id = l.responsavel_id
     WHERE l.organizacao_id = ${organizacaoId}::uuid AND l.prospeccao_estado IN ('novo','em_cadencia','respondeu')
     GROUP BY 1, 2 ORDER BY 6 DESC, 2`);

  const listas = await db.execute<{ nome: string; total: number; abertas: number }>(sql`
    SELECT lb.nome, count(DISTINCT l.id)::int AS total,
           count(DISTINCT l.id) FILTER (WHERE l.prospeccao_estado IN ('novo','em_cadencia','respondeu','sem_resposta'))::int AS abertas
      FROM labels lb JOIN lead_labels ll ON ll.label_id = lb.id JOIN leads l ON l.id = ll.lead_id
     WHERE lb.organizacao_id = ${organizacaoId}::uuid AND l.organizacao_id = ${organizacaoId}::uuid AND l.prospeccao_estado IS NOT NULL
     GROUP BY lb.nome ORDER BY 2 DESC, 1 LIMIT 30`);

  const cadencias = await db.execute<{ id: string; nome: string; matriculados: number; ativos: number; responderam: number; concluidos: number; falhas: number }>(sql`
    SELECT cd.id::text, cd.nome, count(*)::int AS matriculados,
           count(*) FILTER (WHERE ce.status IN ('active','waiting','waiting_reply','paused'))::int AS ativos,
           count(*) FILTER (WHERE ce.last_inbound_at IS NOT NULL)::int AS responderam,
           count(*) FILTER (WHERE ce.status = 'completed')::int AS concluidos,
           count(*) FILTER (WHERE ce.status = 'failed')::int AS falhas
      FROM cadence_enrollments ce
      JOIN cadence_definitions cd ON cd.id = ce.cadence_definition_id
      JOIN leads l ON l.id = ce.entity_id AND ce.entity_type = 'lead'
     WHERE l.organizacao_id = ${organizacaoId}::uuid AND l.prospeccao_estado IS NOT NULL
     GROUP BY cd.id, cd.nome ORDER BY 3 DESC LIMIT 30`);

  return {
    listas, cadencias,
    total: ind?.total ?? 0,
    porEstado,
    indicadores: {
      novosSemResponsavel: ind?.novos_sem_resp ?? 0,
      semContato: ind?.sem_contato ?? 0,
      cadenciaAtiva: ind?.cad_ativa ?? 0,
      cadenciaPausada: ind?.cad_pausada ?? 0,
      cadenciaComFalha: ind?.cad_falha ?? 0,
      respondeuAguardando: ind?.respondeu_aguardando ?? 0,
      respondeuMaisAntigoHoras: ind?.respondeu_mais_antigo_h ?? null,
      adicionadosUltimos7Dias: ind?.novos_7d ?? 0,
    },
    funil: {
      base: ind?.total ?? 0, chegaramEmCadencia: marcos?.cad ?? 0, responderam: marcos?.resp ?? 0,
      preQualificados: porEstado.pre_qualificado, oportunidades: porEstado.oportunidade, descartados: porEstado.descartado,
    },
    descartePorMotivo: descartes.map((d) => ({ motivo: d.motivo, n: d.n })),
    filaPorResponsavel: fila.map((f) => ({
      responsavelId: f.id, nome: f.nome ?? "Sem responsável", novo: f.novo, emCadencia: f.cad, respondeu: f.resp, total: f.total,
    })),
  };
}

/* ── Contatos & Empresas (Bloco 05) ────────────────────────────────────── */

export interface LinhaEmpresa {
  id: string;
  nome: string;
  cnpj: string | null;
  setor: string | null;
  cidade: string | null;
  relacionamento: RelacionamentoEmpresa;
  relacionamentoRotulo: string;
  pessoas: number;
  oportunidadesAbertas: number;
  servicosAtivos: number;
  responsavel: string | null;
  ultimaAtividade: string | null;
}

/**
 * Diretório de empresas.
 *
 * O relacionamento é DERIVADO na consulta (Bloco 05 §7), na mesma ordem de
 * precedência de `derivarRelacionamento`: serviço ativo ganha de oportunidade
 * aberta, que ganha de lead ativo. Não existe coluna de status editável, e é
 * de propósito — a spec proíbe "Cliente" como campo que alguém troca à mão.
 */
export async function diretorioEmpresas(organizacaoId: string, filtros: {
  busca?: string | null; relacionamento?: RelacionamentoEmpresa | null; limite?: number;
} = {}): Promise<{ linhas: LinhaEmpresa[]; total: number; porRelacionamento: Record<RelacionamentoEmpresa, number> }> {
  const busca = filtros.busca?.trim() ? `%${filtros.busca.trim().toLowerCase()}%` : null;

  const linhas = await db.execute<{
    id: string; nome: string; cnpj: string | null; setor: string | null; cidade: string | null;
    pessoas: number; oportunidades_abertas: number; servicos_ativos: number;
    servicos_historicos: number; leads_ativos: number;
    responsavel: string | null; ultima_atividade: string | null;
  }>(sql`
    WITH base AS (
      SELECT e.id, e.nome, e.cnpj, e.setor, e.cidade,
        (SELECT count(*)::int FROM pessoas p WHERE p.empresa_id = e.id
           AND NOT EXISTS (SELECT 1 FROM leads l2 WHERE l2.id = p.lead_id_legado AND l2.canonical_lead_id IS NOT NULL))
          + (SELECT count(*)::int FROM leads l WHERE l.empresa_id = e.id AND l.canonical_lead_id IS NULL AND NOT EXISTS (
               SELECT 1 FROM pessoas p2 WHERE p2.lead_id_legado = l.id)) AS pessoas,
        (SELECT count(*)::int FROM negocios n WHERE n.empresa_id = e.id
          AND n.etapa IN ('entrada','diagnostico','proposta','negociacao')) AS oportunidades_abertas,
        (SELECT count(*)::int FROM servicos_canonicos s WHERE s.empresa_id = e.id
          AND s.commercial_lifecycle = 'ACTIVE') AS servicos_ativos,
        (SELECT count(*)::int FROM servicos_canonicos s WHERE s.empresa_id = e.id) AS servicos_historicos,
        (SELECT count(*)::int FROM leads l WHERE l.empresa_id = e.id
          AND l.estagio_pre_vendas IN ('novo','em_contato','qualificacao','qualificado')) AS leads_ativos,
        (SELECT u.nome FROM clientes c JOIN usuarios u ON u.id = c.responsavel_id
          WHERE c.empresa_id = e.id LIMIT 1) AS responsavel,
        -- A atividade chega à empresa por DOIS caminhos, e só um estava aqui.
        -- Medido em 22/09: das 2.250 empresas, ZERO tinham atividade por
        -- a.empresa_id e 1.575 têm pelo lead. O campo direto existe no schema e
        -- está 100% NULL: as 13.044 atividades vieram da migração do CRM
        -- legado, onde ele não existia, e quem escreve hoje só o preenche
        -- quando o chamador passa a empresa.
        -- O Cliente 360 (clientes-crm2) já fazia essa união; esta listagem não,
        -- e por isso a coluna "última atividade" vinha vazia para 70% da base.
        (SELECT max(a.created_at)::text FROM atividades a
          WHERE a.empresa_id = e.id
             OR a.lead_id IN (SELECT l2.id FROM leads l2 WHERE l2.empresa_id = e.id)) AS ultima_atividade
        FROM empresas e
       WHERE e.organizacao_id = ${organizacaoId}::uuid
         AND (${busca}::text IS NULL OR lower(e.nome) LIKE ${busca}
              OR lower(COALESCE(e.cnpj, '')) LIKE ${busca}
              OR lower(COALESCE(e.dominio, '')) LIKE ${busca})
    )
    SELECT * FROM base
     -- O relacionamento é derivado, então filtrar por ele também precisa ser.
     -- Filtrar depois, sobre a lista já truncada, devolveria um punhado de
     -- linhas e daria a impressão de que quase não existe empresa naquele estado.
     WHERE ${filtros.relacionamento ?? null}::text IS NULL OR
       CASE
         WHEN servicos_ativos > 0 THEN 'cliente'
         WHEN oportunidades_abertas > 0 THEN 'em_oportunidade'
         WHEN leads_ativos > 0 THEN 'em_pre_vendas'
         WHEN servicos_historicos > 0 THEN 'ex_cliente'
         ELSE 'cadastrada'
       END = ${filtros.relacionamento ?? null}
     ORDER BY servicos_ativos DESC, oportunidades_abertas DESC, nome
     LIMIT ${filtros.limite ?? 200}
  `);

  const [total] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM empresas WHERE organizacao_id = ${organizacaoId}::uuid
  `);

  // Contagem por relacionamento sobre a base INTEIRA. Contar as linhas
  // carregadas daria o número da página, não o da empresa — e a página está
  // ordenada por serviço ativo, então diria "todas são clientes".
  const [agregado] = await db.execute<{
    cliente: number; em_oportunidade: number; em_pre_vendas: number; ex_cliente: number; cadastrada: number;
  }>(sql`
    WITH fatos AS (
      SELECT e.id,
        EXISTS (SELECT 1 FROM servicos_canonicos s WHERE s.empresa_id = e.id AND s.commercial_lifecycle = 'ACTIVE') AS tem_ativo,
        EXISTS (SELECT 1 FROM servicos_canonicos s WHERE s.empresa_id = e.id) AS teve_servico,
        EXISTS (SELECT 1 FROM negocios n WHERE n.empresa_id = e.id
                 AND n.etapa IN ('entrada','diagnostico','proposta','negociacao')) AS tem_oportunidade,
        EXISTS (SELECT 1 FROM leads l WHERE l.empresa_id = e.id
                 AND l.estagio_pre_vendas IN ('novo','em_contato','qualificacao','qualificado')) AS tem_lead
        FROM empresas e WHERE e.organizacao_id = ${organizacaoId}::uuid
    )
    SELECT
      count(*) FILTER (WHERE tem_ativo)::int AS cliente,
      count(*) FILTER (WHERE NOT tem_ativo AND tem_oportunidade)::int AS em_oportunidade,
      count(*) FILTER (WHERE NOT tem_ativo AND NOT tem_oportunidade AND tem_lead)::int AS em_pre_vendas,
      count(*) FILTER (WHERE NOT tem_ativo AND NOT tem_oportunidade AND NOT tem_lead AND teve_servico)::int AS ex_cliente,
      count(*) FILTER (WHERE NOT tem_ativo AND NOT tem_oportunidade AND NOT tem_lead AND NOT teve_servico)::int AS cadastrada
      FROM fatos
  `);

  const mapeadas = linhas.map((l) => {
    const relacionamento: RelacionamentoEmpresa =
      l.servicos_ativos > 0 ? "cliente"
      : l.oportunidades_abertas > 0 ? "em_oportunidade"
      : l.leads_ativos > 0 ? "em_pre_vendas"
      : l.servicos_historicos > 0 ? "ex_cliente"
      : "cadastrada";

    return {
      id: l.id, nome: l.nome, cnpj: l.cnpj, setor: l.setor, cidade: l.cidade,
      relacionamento, relacionamentoRotulo: ROTULO_RELACIONAMENTO[relacionamento],
      pessoas: l.pessoas, oportunidadesAbertas: l.oportunidades_abertas,
      servicosAtivos: l.servicos_ativos, responsavel: l.responsavel,
      ultimaAtividade: l.ultima_atividade,
    };
  });

  return {
    linhas: mapeadas,
    total: total?.n ?? 0,
    porRelacionamento: {
      cliente: agregado?.cliente ?? 0,
      em_oportunidade: agregado?.em_oportunidade ?? 0,
      em_pre_vendas: agregado?.em_pre_vendas ?? 0,
      ex_cliente: agregado?.ex_cliente ?? 0,
      cadastrada: agregado?.cadastrada ?? 0,
    },
  };
}

export interface LinhaPessoa {
  id: string;
  /** `pessoas` para o modelo novo, `leads` para a identidade legada. */
  fonte: "pessoa" | "lead";
  nome: string;
  cargo: string | null;
  email: string | null;
  telefone: string | null;
  whatsapp: string | null;
  empresaId: string | null;
  empresa: string | null;
}

type LinhaPessoaDb = {
  id: string; fonte: string; nome: string | null; cargo: string | null;
  email: string | null; telefone: string | null; whatsapp: string | null;
  empresa_id: string | null; empresa: string | null;
};

function mapearLinhaPessoa(linha: LinhaPessoaDb): LinhaPessoa {
  return {
    id: linha.id,
    fonte: linha.fonte as "pessoa" | "lead",
    nome: linha.nome ?? "Sem nome",
    cargo: linha.cargo,
    email: linha.email,
    telefone: linha.telefone,
    whatsapp: linha.whatsapp,
    empresaId: linha.empresa_id,
    empresa: linha.empresa,
  };
}

/**
 * Diretório de pessoas.
 *
 * Lê `pessoas` (modelo novo) **e** `leads` (onde a identidade das pessoas
 * ainda mora no legado), sem duplicar: o lead que já foi materializado em
 * `pessoas` aparece uma vez só. É a "compatibilidade de leitura" que a spec
 * autoriza em Bloco 05 §26, enquanto entradas novas nascem nos dois lados.
 *
 * Bloco 05 §3: Pessoa pode existir sem Empresa, e isso não é erro.
 */
export async function diretorioPessoas(organizacaoId: string, filtros: {
  busca?: string | null; empresaId?: string | null; semEmpresa?: boolean; limite?: number;
} = {}): Promise<LinhaPessoa[]> {
  const busca = filtros.busca?.trim() ? `%${filtros.busca.trim().toLowerCase()}%` : null;

  const linhas = await db.execute<LinhaPessoaDb>(sql`
    SELECT p.id::text, 'pessoa' AS fonte,
           NULLIF(trim((CASE WHEN COALESCE(trim(p.sobrenome),'')='' THEN trim(p.nome) WHEN lower(trim(p.sobrenome))=lower(trim(p.nome)) OR lower(trim(p.sobrenome)) LIKE lower(trim(p.nome))||' %' THEN trim(p.sobrenome) WHEN lower(trim(p.nome)) LIKE '% '||lower(trim(p.sobrenome)) THEN trim(p.nome) ELSE trim(p.nome)||' '||trim(p.sobrenome) END)), '') AS nome,
           p.cargo, p.email, p.telefone, p.whatsapp,
           p.empresa_id::text, e.nome AS empresa
      FROM pessoas p
      LEFT JOIN empresas e ON e.id = p.empresa_id
     WHERE p.organizacao_id = ${organizacaoId}::uuid
       AND NOT EXISTS (SELECT 1 FROM leads l2 WHERE l2.id = p.lead_id_legado AND l2.canonical_lead_id IS NOT NULL)
       AND (${filtros.empresaId ?? null}::uuid IS NULL OR p.empresa_id = ${filtros.empresaId ?? null}::uuid)
       AND (${filtros.semEmpresa ?? false} = false OR p.empresa_id IS NULL)
       AND (${busca}::text IS NULL OR lower(concat_ws(' ', p.nome, p.sobrenome)) LIKE ${busca}
            OR lower(COALESCE(p.email, '')) LIKE ${busca})

    UNION ALL

    SELECT l.id::text, 'lead' AS fonte,
           NULLIF(trim((CASE WHEN COALESCE(trim(l.sobrenome),'')='' THEN trim(l.nome) WHEN lower(trim(l.sobrenome))=lower(trim(l.nome)) OR lower(trim(l.sobrenome)) LIKE lower(trim(l.nome))||' %' THEN trim(l.sobrenome) WHEN lower(trim(l.nome)) LIKE '% '||lower(trim(l.sobrenome)) THEN trim(l.nome) ELSE trim(l.nome)||' '||trim(l.sobrenome) END)), '') AS nome,
           l.cargo, l.email, l.telefone, l.whatsapp,
           l.empresa_id::text, COALESCE(e.nome, l.empresa) AS empresa
      FROM leads l
      LEFT JOIN empresas e ON e.id = l.empresa_id
     WHERE l.organizacao_id = ${organizacaoId}::uuid
       AND NOT EXISTS (SELECT 1 FROM pessoas p WHERE p.lead_id_legado = l.id)
       AND l.canonical_lead_id IS NULL
       AND (${filtros.empresaId ?? null}::uuid IS NULL OR l.empresa_id = ${filtros.empresaId ?? null}::uuid)
       AND (${filtros.semEmpresa ?? false} = false OR l.empresa_id IS NULL)
       AND (${busca}::text IS NULL OR lower(concat_ws(' ', l.nome, l.sobrenome)) LIKE ${busca}
            OR lower(COALESCE(l.email, '')) LIKE ${busca})

     ORDER BY nome
     LIMIT ${filtros.limite ?? 200}
  `);

  return linhas.map(mapearLinhaPessoa);
}

/** Carrega uma identidade sem depender do limite da listagem do diretório. */
export async function pessoaPorId(organizacaoId: string, pessoaId: string): Promise<LinhaPessoa | null> {
  const [linha] = await db.execute<LinhaPessoaDb>(sql`
    SELECT p.id::text, 'pessoa' AS fonte,
           NULLIF(trim((CASE WHEN COALESCE(trim(p.sobrenome),'')='' THEN trim(p.nome) WHEN lower(trim(p.sobrenome))=lower(trim(p.nome)) OR lower(trim(p.sobrenome)) LIKE lower(trim(p.nome))||' %' THEN trim(p.sobrenome) WHEN lower(trim(p.nome)) LIKE '% '||lower(trim(p.sobrenome)) THEN trim(p.nome) ELSE trim(p.nome)||' '||trim(p.sobrenome) END)), '') AS nome,
           p.cargo, p.email, p.telefone, p.whatsapp,
           p.empresa_id::text, e.nome AS empresa
      FROM pessoas p
      LEFT JOIN empresas e ON e.id = p.empresa_id
     WHERE p.id = ${pessoaId}::uuid AND p.organizacao_id = ${organizacaoId}::uuid

    UNION ALL

    SELECT l.id::text, 'lead' AS fonte,
           NULLIF(trim((CASE WHEN COALESCE(trim(l.sobrenome),'')='' THEN trim(l.nome) WHEN lower(trim(l.sobrenome))=lower(trim(l.nome)) OR lower(trim(l.sobrenome)) LIKE lower(trim(l.nome))||' %' THEN trim(l.sobrenome) WHEN lower(trim(l.nome)) LIKE '% '||lower(trim(l.sobrenome)) THEN trim(l.nome) ELSE trim(l.nome)||' '||trim(l.sobrenome) END)), '') AS nome,
           l.cargo, l.email, l.telefone, l.whatsapp,
           l.empresa_id::text, COALESCE(e.nome, l.empresa) AS empresa
      FROM leads l
      LEFT JOIN empresas e ON e.id = l.empresa_id
     WHERE l.id = ${pessoaId}::uuid AND l.organizacao_id = ${organizacaoId}::uuid
       AND NOT EXISTS (SELECT 1 FROM pessoas p WHERE p.lead_id_legado = l.id)
       AND l.canonical_lead_id IS NULL
     LIMIT 1
  `);
  return linha ? mapearLinhaPessoa(linha) : null;
}

/* ── Empresa 360 comercial (Bloco 05 §8) ───────────────────────────────── */

export interface Empresa360 {
  id: string;
  nome: string;
  razaoSocial: string | null;
  cnpj: string | null;
  setor: string | null;
  porte: string | null;
  cidade: string | null;
  estado: string | null;
  website: string | null;
  dominio: string | null;
  /** Campos que a produção mostrava e a tela perdeu (680 e 362 empresas). */
  telefone: string | null;
  observacoes: string | null;
  /** Maior lead_score entre os leads da empresa; null = nenhum pontuado. */
  leadScore: number | null;
  /** Respostas do formulário (Meta/RD/site) de cada lead, com o anúncio de origem. */
  formularios: Array<{ leadId: string; nome: string | null; criadoEm: string; metaAdId: string | null; respostas: Array<{ pergunta: string; resposta: string }> }>;
  endereco: { logradouro: string | null; numero: string | null; complemento: string | null; bairro: string | null; cep: string | null };
  relacionamento: RelacionamentoEmpresa;
  relacionamentoRotulo: string;
  dadosJuridicosCompletos: boolean;
  /** Rótulos dos campos que faltam, na mesma ordem do formulário. Existe para
   *  a tela dizer o que falta em vez de só dizer que falta alguma coisa. */
  dadosJuridicosFaltando: string[];
  pessoas: Array<{ id: string; fonte: "pessoa" | "lead"; nome: string; cargo: string | null; papel: string | null; email: string | null; telefone: string | null }>;
  /** Aquisições da empresa: etapa do board, de quem é, e a nutrição com motivo e data de entrada. */
  leads: Array<{
    id: string; etapa: string; etapaRotulo: string; origem: string | null; criadoEm: string;
    pessoa: string | null; responsavel: string | null;
    nutricao: { motivo: string | null; desde: string | null; retomarEm: string | null } | null;
  }>;
  oportunidades: Array<{ id: string; titulo: string; etapa: string; etapaRotulo: string; familia: string | null; valor: number | null; responsavel: string | null }>;
  propostas: Array<{ id: string; numero: number; versao: number; status: string; total: number | null; enviadaEm: string | null }>;
  servicos: Array<{ id: string; familia: string; produto: string | null; valor: number; ativo: boolean }>;
  /** Existe a ficha de Cliente 360 (/clientes/<empresa>): é o gate da própria rota. */
  fichaDeCliente: boolean;
}

export async function empresa360(organizacaoId: string, empresaId: string): Promise<Empresa360 | null> {
  const [e] = await db.execute<{
    id: string; nome: string; razao_social: string | null; cnpj: string | null;
    setor: string | null; porte: string | null; cidade: string | null; estado: string | null;
    website: string | null; dominio: string | null; logradouro: string | null;
    numero: string | null; complemento: string | null; bairro: string | null; cep: string | null;
    telefone: string | null; observacoes: string | null;
  }>(sql`
    SELECT id::text, ${nomeEmpresaSql("nome")} AS nome, razao_social, cnpj, setor, porte, cidade, estado, website, dominio,
           logradouro, numero, complemento, bairro, cep, telefone, observacoes
      FROM empresas WHERE id = ${empresaId}::uuid AND organizacao_id = ${organizacaoId}::uuid
  `);
  if (!e) return null;

  const { derivarRelacionamento } = await import("./identidade");
  const relacionamento = await derivarRelacionamento(organizacaoId, empresaId);

  const pessoas = await db.execute<{
    id: string; fonte: string; nome: string; cargo: string | null; papel: string | null;
    email: string | null; telefone: string | null;
  }>(sql`
    SELECT p.id::text, 'pessoa' AS fonte, NULLIF(trim((CASE WHEN COALESCE(trim(p.sobrenome),'')='' THEN trim(p.nome) WHEN lower(trim(p.sobrenome))=lower(trim(p.nome)) OR lower(trim(p.sobrenome)) LIKE lower(trim(p.nome))||' %' THEN trim(p.sobrenome) WHEN lower(trim(p.nome)) LIKE '% '||lower(trim(p.sobrenome)) THEN trim(p.nome) ELSE trim(p.nome)||' '||trim(p.sobrenome) END)), '') AS nome,
           p.cargo, v.papel, p.email, p.telefone
      FROM pessoas p
      LEFT JOIN pessoa_empresa_vinculos v ON v.pessoa_id = p.id AND v.empresa_id = p.empresa_id AND v.encerrado_em IS NULL
     WHERE p.empresa_id = ${empresaId}::uuid
       AND NOT EXISTS (SELECT 1 FROM leads l2 WHERE l2.id = p.lead_id_legado AND l2.canonical_lead_id IS NOT NULL)
    UNION ALL
    SELECT l.id::text, 'lead' AS fonte, NULLIF(trim((CASE WHEN COALESCE(trim(l.sobrenome),'')='' THEN trim(l.nome) WHEN lower(trim(l.sobrenome))=lower(trim(l.nome)) OR lower(trim(l.sobrenome)) LIKE lower(trim(l.nome))||' %' THEN trim(l.sobrenome) WHEN lower(trim(l.nome)) LIKE '% '||lower(trim(l.sobrenome)) THEN trim(l.nome) ELSE trim(l.nome)||' '||trim(l.sobrenome) END)), '') AS nome,
           l.cargo, NULL AS papel, l.email, l.telefone
      FROM leads l
     WHERE l.empresa_id = ${empresaId}::uuid
       AND NOT EXISTS (SELECT 1 FROM pessoas p WHERE p.lead_id_legado = l.id)
       AND l.canonical_lead_id IS NULL
     ORDER BY nome
  `);

  // Aquisições da empresa. Era `leads ... AND estagio_pre_vendas IS NOT NULL`,
  // o mesmo filtro que escondia 2.392 registros no board: aqui ele fazia a
  // empresa parecer não ter histórico de entrada nenhum.
  const leads = await db.execute<{
    id: string; etapa: string | null; origem: string | null; criado_em: string; pessoa: string | null; responsavel: string | null;
    nutricao_motivo: string | null; nutrido_em: string | null; retomar_em: string | null;
  }>(sql`
    SELECT COALESCE(a.lead_legado_id, a.id)::text AS id,
           -- A etapa GRAVADA na aquisição manda (a mesma do board); o CASE é só o reserva
           -- de aquisição sem etapa. O legado refina "qualificacao", como no board.
           CASE WHEN l.estagio_pre_vendas = 'qualificacao' THEN 'qualificacao'
                ELSE COALESCE(pe.codigo, CASE
                  WHEN a.desqualificado_em IS NOT NULL THEN 'desqualificado'
                  WHEN a.nutricao_status IS NOT NULL AND a.nutricao_status <> '' THEN 'nutricao'
                  WHEN a.qualificado THEN 'qualificado'
                  ELSE 'novo'
                END) END AS etapa,
           a.origem, a.created_at::text AS criado_em,
           NULLIF(trim(concat_ws(' ', l.nome, l.sobrenome)), '') AS pessoa, u.nome AS responsavel,
           COALESCE(NULLIF(a.nutricao_status, 'em_nutricao'), l.nutricao_motivo) AS nutricao_motivo,
           COALESCE(l.nutrido_em, (SELECT max(sc.created_at) FROM status_changes sc
                                    WHERE sc.lead_id = l.id AND sc.para_status = 'nutricao'))::text AS nutrido_em,
           COALESCE(a.retomar_em, l.nutricao_retomar_em)::text AS retomar_em
      FROM aquisicoes a
      LEFT JOIN leads l ON l.id = a.lead_legado_id
      LEFT JOIN pipeline_etapas pe ON pe.id = a.etapa_id
      LEFT JOIN usuarios u ON u.id = COALESCE(a.responsavel_id, l.responsavel_id)
     WHERE a.empresa_id = ${empresaId}::uuid
       AND l.canonical_lead_id IS NULL -- duplicado já está contado no canônico
     ORDER BY a.created_at DESC LIMIT 20
  `);

  const oportunidades = await db.execute<{
    id: string; titulo: string; etapa: string | null; familia: string | null;
    valor: string | null; responsavel: string | null;
  }>(sql`
    SELECT COALESCE(o.negocio_id_legado, o.id)::text AS id, o.titulo, o.etapa,
           o.service_family AS familia, o.valor::text AS valor, u.nome AS responsavel
      FROM oportunidades o LEFT JOIN usuarios u ON u.id = o.responsavel_id
     WHERE o.empresa_id = ${empresaId}::uuid
       -- A cópia 'ativo' é o espelho da carteira (negocio_origem_id): o cliente já
       -- aparece em Serviços. Contá-la aqui o mostrava de novo como aberto em Entrada.
       AND COALESCE(o.stage, '') <> 'ativo'
     ORDER BY o.created_at DESC LIMIT 20
  `);

  // O que o formulário de origem respondeu, pelos leads da empresa, e o maior
  // score entre eles. Os dois sumiam da empresa: moram no lead, não nela.
  const doLead = await db.execute<{
    id: string; nome: string | null; criado_em: string; lead_score: number | null;
    campos_custom: Record<string, unknown> | null; meta_ad_id: string | null;
  }>(sql`
    SELECT l.id::text, NULLIF(trim((CASE WHEN COALESCE(trim(l.sobrenome),'')='' THEN trim(l.nome) WHEN lower(trim(l.sobrenome))=lower(trim(l.nome)) OR lower(trim(l.sobrenome)) LIKE lower(trim(l.nome))||' %' THEN trim(l.sobrenome) WHEN lower(trim(l.nome)) LIKE '% '||lower(trim(l.sobrenome)) THEN trim(l.nome) ELSE trim(l.nome)||' '||trim(l.sobrenome) END)), '') AS nome,
           l.created_at::text AS criado_em, l.lead_score, l.campos_custom, l.meta_ad_id
      FROM leads l
     WHERE l.empresa_id = ${empresaId}::uuid AND l.organizacao_id = ${organizacaoId}::uuid
     ORDER BY l.created_at DESC LIMIT 50
  `);
  const formularios = doLead
    .map((l) => ({ leadId: l.id, nome: l.nome, criadoEm: l.criado_em, metaAdId: l.meta_ad_id, respostas: respostasDoFormulario(l.campos_custom) }))
    .filter((f) => f.respostas.length > 0 || f.metaAdId);
  const scores = doLead.map((l) => l.lead_score ?? 0).filter((n) => n > 0);

  const propostas = await db.execute<{
    id: string; numero: number; versao: number; status: string; total: string | null; enviada_em: string | null;
  }>(sql`
    -- Duas rotas até a empresa, de propósito.
    --
    -- A consulta anterior exigia JOIN em negocios, e 455 das 1.550 propostas do
    -- banco não têm negócio nenhum: são propostas antigas (2024 em diante)
    -- feitas direto para um lead, antes de existir o modelo de negócio. Elas
    -- nunca apareceram nesta tela. Pela identidade canônica, 446 delas chegam
    -- à empresa — a pessoa sabe de quem é a proposta mesmo quando o processo
    -- comercial não foi registrado.
    SELECT p.id::text, p.numero, p.versao, p.status, p.total_geral::text AS total, p.enviada_em::text
      FROM propostas p
     WHERE EXISTS (SELECT 1 FROM oportunidades o
                    WHERE o.id = p.oportunidade_id AND o.empresa_id = ${empresaId}::uuid)
        OR (p.oportunidade_id IS NULL AND EXISTS (
              SELECT 1 FROM aquisicoes a
               WHERE a.lead_legado_id = p.lead_id AND a.empresa_id = ${empresaId}::uuid))
     ORDER BY p.created_at DESC LIMIT 20
  `);

  const servicos = await db.execute<{
    id: string; familia: string; produto: string | null; valor: string; ciclo: string;
  }>(sql`
    SELECT id::text, service_family AS familia, canonical_product AS produto,
           current_recurring_value::text AS valor, commercial_lifecycle AS ciclo
      FROM servicos_canonicos WHERE empresa_id = ${empresaId}::uuid
     ORDER BY current_recurring_value DESC LIMIT 20
  `);

  const [cli360] = await db.execute<{ existe: boolean }>(sql`
    SELECT EXISTS (SELECT 1 FROM clientes WHERE empresa_id = ${empresaId}::uuid
                    AND organizacao_id = ${organizacaoId}::uuid) AS existe`);

  // Mesma fonte de verdade do gate de envio da proposta: se a lista mudar lá,
  // a Empresa 360 acompanha sozinha.
  const { CAMPOS_JURIDICOS } = await import("./propostas");
  const valorJuridico: Record<string, string | null> = {
    razao_social: e.razao_social, cnpj: e.cnpj, logradouro: e.logradouro,
    numero: e.numero, bairro: e.bairro, cidade: e.cidade, estado: e.estado, cep: e.cep,
  };
  const juridicosFaltando = CAMPOS_JURIDICOS
    .filter(({ coluna }) => !valorJuridico[coluna]?.toString().trim())
    .map(({ rotulo }) => rotulo);

  return {
    id: e.id, nome: e.nome, razaoSocial: e.razao_social, cnpj: e.cnpj,
    telefone: e.telefone, observacoes: e.observacoes,
    leadScore: scores.length ? Math.max(...scores) : null, formularios,
    setor: e.setor, porte: e.porte, cidade: e.cidade, estado: e.estado,
    website: e.website, dominio: e.dominio,
    endereco: { logradouro: e.logradouro, numero: e.numero, complemento: e.complemento, bairro: e.bairro, cep: e.cep },
    relacionamento, relacionamentoRotulo: ROTULO_RELACIONAMENTO[relacionamento],
    dadosJuridicosCompletos: juridicosFaltando.length === 0,
    dadosJuridicosFaltando: juridicosFaltando,
    pessoas: pessoas.map((p) => ({
      id: p.id, fonte: p.fonte as "pessoa" | "lead", nome: p.nome ?? "Sem nome",
      cargo: p.cargo, papel: p.papel, email: p.email, telefone: p.telefone,
    })),
    leads: leads.map((l) => ({
      id: l.id, etapa: l.etapa ?? "novo",
      etapaRotulo: ROTULO_ETAPA_PRE_VENDAS[(l.etapa ?? "novo") as EstagioPreVendas] ?? l.etapa ?? "",
      origem: origemCanonica(l.origem), criadoEm: l.criado_em,
      pessoa: l.pessoa, responsavel: l.responsavel,
      nutricao: l.etapa === "nutricao" ? { motivo: l.nutricao_motivo, desde: l.nutrido_em, retomarEm: l.retomar_em } : null,
    })),
    oportunidades: oportunidades.map((o) => ({
      id: o.id, titulo: o.titulo, etapa: o.etapa ?? "entrada",
      etapaRotulo: ROTULO_ETAPA_PIPELINE[(o.etapa ?? "entrada") as EtapaPipeline] ?? o.etapa ?? "",
      familia: o.familia, valor: o.valor === null ? null : Number(o.valor), responsavel: o.responsavel,
    })),
    propostas: propostas.map((p) => ({
      id: p.id, numero: p.numero, versao: p.versao, status: p.status,
      total: p.total === null ? null : Number(p.total), enviadaEm: p.enviada_em,
    })),
    servicos: servicos.map((s) => ({
      id: s.id, familia: s.familia, produto: s.produto,
      valor: Number(s.valor), ativo: s.ciclo === "ACTIVE",
    })),
    fichaDeCliente: !!cli360?.existe,
  };
}

/* ── Utilitário ────────────────────────────────────────────────────────── */

function iniciais(nome: string | null): string | null {
  if (!nome) return null;
  /* Só pedaços que COMEÇAM com letra viram inicial. A versão anterior pegava o
     primeiro caractere das duas primeiras palavras, fosse ele qual fosse:
     "Growth (Mídia Paga)" saía como "G(" no avatar dos cartões de Pré-vendas.
     Parêntese, hífen e marcador de lista são comuns em nome de fila e de time. */
  const partes = nome.split(/\s+/).filter((p) => /^\p{L}/u.test(p));
  if (partes.length === 0) return null;
  return partes.slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

/* ── Detalhe do Lead (Bloco 01 §23) ────────────────────────────────────── */

export interface DetalheLead {
  id: string;
  empresa: { id: string | null; nome: string; setor: string | null; porte: string | null; cidade: string | null; website: string | null; cnpj: string | null; telefone: string | null; observacoes: string | null };
  leadScore: number;
  /** Empresa com serviço ativo na carteira: é o que define "Cliente". */
  naCarteira: boolean;
  /** A empresa já teve serviço (ativo ou encerrado). Distingue ex-cliente de quem nunca comprou. */
  jaTeveServico: boolean;
  /** Existe a ficha de Cliente 360 (/clientes/<empresa>): é o gate da própria rota. */
  fichaDeCliente: boolean;
  /** Existe processo em Pré-vendas (aquisição ou estágio gravado). Contato avulso: false, e não é "Lead". */
  temProcesso: boolean;
  pessoa: { nome: string; cargo: string | null; email: string | null; telefone: string | null; whatsapp: string | null; linkedin: string | null; observacao: string | null; cidade: string | null };
  etapa: EstagioPreVendas;
  etapaRotulo: string;
  qualificado: boolean;
  qualificadoEm: string | null;
  qualificadoPor: string | null;
  qualificadoPorTipo: string | null;
  preQualificado: boolean;
  qualificacao: Record<string, unknown> | null;
  atribuicao: {
    origem: string | null; campanha: string | null; medium: string | null;
    conteudo: string | null; termo: string | null; landingPage: string | null;
    primeiroToque: string | null; ultimoToque: string | null;
    /** Ids da Meta: é com eles que se chega ao anúncio, ao conjunto e ao criativo. */
    metaAdId: string | null; metaAdsetId: string | null; metaCampaignId: string | null;
  };
  /** TODA resposta do formulário de origem, na ordem em que veio.
   *
   *  O formulário da Meta (e o do RD, e o do site) pode ter 3 ou 10 perguntas, e
   *  o conjunto muda quando alguém edita o formulário. Por isso isto é uma lista
   *  aberta, e não um punhado de campos fixos: pergunta nova aparece sozinha.
   *  As chaves técnicas da migração do Zoho ficam de fora — não são resposta de
   *  ninguém. */
  respostasFormulario: Array<{ pergunta: string; resposta: string }>;
  /** Rastreio da Meta (chaves `meta_*` de campos_custom), para o cartão de origem. */
  metaRastreio?: Record<string, string>;
  responsavel: { id: string | null; nome: string | null };
  servicos: string[] | null;
  /** Tags do lead (tabela `labels`). A gaveta mostra estas, não os serviços. */
  tags: Array<{ id: string; nome: string }>;
  primeiroContatoEm: string | null;
  criadoEm: string;
  /** `desde` = quando entrou em nutrição (`leads.nutrido_em`). */
  nutricao: { motivo: string | null; retomarEm: string | null; observacao: string | null; desde: string | null };
  /** `em` = quando foi desqualificado (`leads.desqualificado_em`). */
  desqualificacao: { motivo: string | null; detalhe: string | null; deEtapa: string | null; em: string | null };
  /** Quando entrou na etapa ATUAL (mesma conta do cartão do board). */
  etapaDesde: string | null;
  /** Último toque (aquisição canônica, com o legado como reserva): base do "sem interação". */
  ultimoToqueEm: string | null;
  oportunidades: Array<{ id: string; titulo: string; etapa: string; etapaRotulo: string; familia: string | null }>;
  proximaAcao: { titulo: string; venceEm: string | null } | null;
}

/** Chaves de `campos_custom` que NÃO são resposta de formulário: vieram da
 *  migração do Zoho ou são controle interno. Mostrá-las na ficha seria ruído. */
const CHAVE_NAO_E_RESPOSTA = /^(zoho|crm2_|fonte_dado|nome_derivado_do_email|recuperacao|qualificacaoSdr|observacaoContato|cidadeContato|motivo$)/i;
/* `motivo` só existe nos 92 leads do backfill de recuperação (mesma contagem de `recuperacao`) e é nota técnica, não resposta. */

/** Rótulo legível para a chave: `qual_sua_solucao` vira "Qual sua solucao". */
function rotuloDaChave(chave: string): string {
  const limpo = chave.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
  return limpo.charAt(0).toUpperCase() + limpo.slice(1);
}

/** Toda resposta do formulário de origem, seja qual for o número de perguntas.
 *
 *  O formulário da Meta muda quando alguém edita o anúncio: pergunta nova tem
 *  que aparecer sozinha na ficha, sem ninguém mexer no código. Por isso a lista
 *  nasce das chaves gravadas, e não de um conjunto fixo. */
export function respostasDoFormulario(
  campos: unknown,
  /** Campos custom definidos em Ajustes (entidade lead): dão o rótulo, a ordem e
   *  aparecem mesmo sem valor ("Não preenchido"). Sem definição, vale a chave gravada. */
  definicoes: Array<{ nome: string; label: string }> = [],
): Array<{ pergunta: string; resposta: string }> {
  const obj = campos && typeof campos === "object" && !Array.isArray(campos) ? (campos as Record<string, unknown>) : {};
  const texto = (valor: unknown): string => {
    if (valor === null || valor === undefined || valor === "") return "";
    return (typeof valor === "object" ? JSON.stringify(valor) : String(valor)).trim();
  };
  const definidas = new Set(definicoes.map((d) => d.nome));
  const saida: Array<{ pergunta: string; resposta: string }> = definicoes.map((d) => ({
    pergunta: d.label, resposta: valorLegivel(texto(obj[d.nome])) || "Não preenchido",
  }));
  for (const [chave, valor] of Object.entries(obj)) {
    if (definidas.has(chave) || CHAVE_NAO_E_RESPOSTA.test(chave) || CHAVE_RASTREIO_META.test(chave)) continue;
    const t = texto(valor);
    if (!t) continue;
    saida.push({ pergunta: ajustarSiglas(rotuloDaChave(chave)), resposta: valorLegivel(t) });
  }
  return saida;
}

/** Campos custom ativos do lead, na ordem definida em Ajustes > Campos custom. */
async function camposCustomDoLead(organizacaoId: string): Promise<Array<{ nome: string; label: string }>> {
  const r = await db.execute<{ nome: string; label: string }>(sql`
    SELECT nome, label FROM custom_fields
     WHERE organizacao_id = ${organizacaoId}::uuid AND entidade = 'lead' AND ativo = true
     ORDER BY ordem, created_at`);
  return [...r];
}

export async function detalheLead(organizacaoId: string, leadId: string): Promise<DetalheLead | null> {
  const [l] = await db.execute<{
    id: string; empresa_id: string | null; empresa_nome: string | null; setor: string | null;
    porte: string | null; cidade: string | null; website: string | null; cnpj: string | null;
    nome: string; sobrenome: string | null; cargo: string | null; email: string | null;
    telefone: string | null; whatsapp: string | null; etapa: string | null;
    qualificado: boolean; qualificado_em: string | null; qualificado_por: string | null;
    qualificado_por_tipo: string | null; pre_qualificado: boolean;
    qualificacao: Record<string, unknown> | null; origem: string | null;
    utm_campaign: string | null; utm_medium: string | null; utm_content: string | null;
    utm_term: string | null; landing_page: string | null; servicos: string[] | null;
    responsavel_id: string | null; responsavel: string | null;
    primeiro_contato_at: string | null; criado_em: string;
    nutricao_motivo: string | null; nutricao_retomar_em: string | null; nutricao_observacao: string | null;
    desq_motivo: string | null; desq_detalhe: string | null; desq_de_etapa: string | null;
    linkedin: string | null;
    campos_custom: Record<string, unknown> | null;
    meta_ad_id: string | null; meta_adset_id: string | null; meta_campaign_id: string | null;
    lead_score: number | null; emp_telefone: string | null; emp_observacoes: string | null;
    na_carteira: boolean; ja_teve_servico: boolean; ficha_de_cliente: boolean;
    etapa_canonica: string | null; tem_aquisicao: boolean; etapa_desde: string | null; ultimo_toque_em: string | null;
    nutrido_em: string | null; desqualificado_em: string | null;
  }>(sql`
    SELECT l.id::text, l.empresa_id::text, COALESCE(e.nome, l.empresa) AS empresa_nome,
           COALESCE(e.setor, l.empresa_setor) AS setor, COALESCE(e.porte, l.empresa_porte) AS porte,
           COALESCE(e.cidade, l.empresa_cidade) AS cidade, e.website, COALESCE(e.cnpj, l.empresa_cnpj) AS cnpj,
           l.nome, l.sobrenome, l.cargo, l.email, l.telefone, l.whatsapp, l.linkedin,
           l.campos_custom, l.meta_ad_id, l.meta_adset_id, l.meta_campaign_id,
           l.lead_score, e.telefone AS emp_telefone, e.observacoes AS emp_observacoes,
           -- "Cliente" = está na carteira (serviço ativo), não "teve algum ganho".
           EXISTS (SELECT 1 FROM servicos_canonicos s
                    WHERE s.empresa_id = l.empresa_id AND s.commercial_lifecycle = 'ACTIVE') AS na_carteira,
           EXISTS (SELECT 1 FROM servicos_canonicos s WHERE s.empresa_id = l.empresa_id) AS ja_teve_servico,
           EXISTS (SELECT 1 FROM clientes c WHERE c.empresa_id = l.empresa_id
                    AND c.organizacao_id = l.organizacao_id) AS ficha_de_cliente,
           l.estagio_pre_vendas AS etapa, pe.codigo AS etapa_canonica, (a.id IS NOT NULL) AS tem_aquisicao,
           /* Entrou na etapa ATUAL: a mesma conta do cartão do board (última mudança para ela;
              sem histórico, o primeiro contato ou a criação). */
           COALESCE((SELECT max(sc.created_at) FROM status_changes sc
                      WHERE sc.lead_id = l.id AND sc.para_status = COALESCE(pe.codigo, l.estagio_pre_vendas)),
                    l.contato_desde_at, l.created_at)::text AS etapa_desde,
           COALESCE(a.last_touch_at, l.last_contact_at)::text AS ultimo_toque_em,
           l.nutrido_em::text AS nutrido_em, l.desqualificado_em::text AS desqualificado_em,
           l.qualificado, l.qualificado_em::text,
           qu.nome AS qualificado_por, l.qualificado_por_tipo, l.pre_qualificado,
           l.qualificacao, COALESCE(a.origem, l.origem) AS origem,
           -- Atribuição é canônica em pontos_contato (SPEC §8.3): nenhuma
           -- verdade de atribuição continua enterrada só na tabela leads. O legado
           -- fica como fallback, e medir os dois lados campo a campo deu
           -- paridade exata (campaign 1.428, medium 1.490, content 1.278,
           -- term 1.251, zero só de um lado).
           COALESCE(pc.campaign, l.utm_campaign) AS utm_campaign,
           COALESCE(pc.medium, l.utm_medium) AS utm_medium,
           COALESCE(pc.content, l.utm_content) AS utm_content,
           COALESCE(pc.term, l.utm_term) AS utm_term,
           COALESCE(pc.landing_page, l.landing_page) AS landing_page,
           l.servicos_interesse AS servicos,
           l.responsavel_id::text, u.nome AS responsavel,
           l.primeiro_contato_at::text, to_json(l.created_at)#>>'{}' AS criado_em,
           -- Nutrição e desqualificação: o canônico guarda o estado
           -- (nutricao_status, retomar_em, motivo_desqualificacao); o
           -- legado guarda o texto livre que ainda não tem casa (observação,
           -- detalhe, etapa de origem).
           COALESCE(NULLIF(a.nutricao_status, 'em_nutricao'), l.nutricao_motivo) AS nutricao_motivo,
           COALESCE(a.retomar_em, l.nutricao_retomar_em)::text AS nutricao_retomar_em,
           l.nutricao_observacao,
           COALESCE(a.motivo_desqualificacao, l.desqualificacao_motivo) AS desq_motivo,
           l.desqualificacao_detalhe AS desq_detalhe,
           l.desqualificado_de_etapa AS desq_de_etapa
      FROM leads l
      LEFT JOIN empresas e ON e.id = l.empresa_id
      LEFT JOIN usuarios u ON u.id = l.responsavel_id
      LEFT JOIN usuarios qu ON qu.id = l.qualificado_por
      LEFT JOIN aquisicoes a ON a.lead_legado_id = l.id
      LEFT JOIN pipeline_etapas pe ON pe.id = a.etapa_id
      LEFT JOIN LATERAL (
        SELECT campaign, medium, content, term, landing_page
          FROM pontos_contato t
         WHERE t.aquisicao_id = a.id
         ORDER BY t.is_first_touch DESC, t.ocorrido_em ASC LIMIT 1
      ) pc ON TRUE
     WHERE l.id = ${leadId}::uuid AND l.organizacao_id = ${organizacaoId}::uuid
  `);
  if (!l) return null;

  const [toques] = await db.execute<{ primeiro: string | null; ultimo: string | null }>(sql`
    SELECT
      max(CASE WHEN is_first_touch THEN COALESCE(source, tipo_origem) END) AS primeiro,
      max(CASE WHEN is_last_touch THEN COALESCE(source, tipo_origem) END) AS ultimo
      FROM pontos_contato
     WHERE organizacao_id = ${organizacaoId}::uuid
       AND (lead_id_legado = ${leadId}::uuid
            OR (${l.empresa_id ?? null}::uuid IS NOT NULL AND empresa_id = ${l.empresa_id ?? null}::uuid))
  `);

  /* As Tags do lead. Mesma união do board: `entity_labels` é a canônica e
     `lead_labels` é a legada que ainda tem vínculo que a canônica não pegou. */
  const tags = await db.execute<{ id: string; nome: string }>(sql`
    SELECT DISTINCT l.id::text, l.nome
      FROM (
        SELECT label_id FROM entity_labels
         WHERE entity_type = 'lead' AND entity_id = ${leadId}::uuid
        UNION
        SELECT label_id FROM lead_labels WHERE lead_id = ${leadId}::uuid
      ) v
      JOIN labels l ON l.id = v.label_id AND l.organizacao_id = ${organizacaoId}::uuid
     ORDER BY l.nome`);

  const oportunidades = await db.execute<{
    id: string; titulo: string; etapa: string | null; familia: string | null;
  }>(sql`
    -- Oportunidades do canônico. O cabeçalho do lead acima ainda vem da tabela
    -- leads: nutrição, desqualificação e interesse declarado não têm dono no
    -- modelo canônico até a fase 26. O que é informação de VENDA já migrou.
    SELECT COALESCE(o.negocio_id_legado, o.id)::text AS id, o.titulo, o.etapa,
           o.service_family AS familia
      FROM oportunidades o
     WHERE (o.lead_id = ${leadId}::uuid
        OR o.negocio_id_legado IN (SELECT id FROM negocios WHERE lead_id = ${leadId}::uuid))
       -- Cópia 'ativo' da carteira não é oportunidade da pessoa (ver empresa360).
       AND COALESCE(o.stage, '') <> 'ativo'
     ORDER BY o.created_at DESC
  `);

  const [tarefa] = await db.execute<{ titulo: string; vence_em: string | null }>(sql`
    /* MESMA regra do card do board (proximaAcaoLateral): tarefa aberta (status fora de concluída/declinada), a de prazo mais
       próximo, com a data do dia quando só ela existe. Antes a gaveta ignorava
       data_vencimento e mostrava outra "próxima ação" que o cartão. */
    SELECT titulo, COALESCE(vence_em, data_vencimento::timestamptz)::text AS vence_em FROM tarefas
     WHERE lead_id = ${leadId}::uuid AND organizacao_id = ${organizacaoId}::uuid AND status NOT IN ('concluida', 'declinada')
     ORDER BY COALESCE(vence_em, data_vencimento::timestamptz) ASC NULLS LAST LIMIT 1
  `);

  /* A etapa que o BOARD mostra: a gravada na aquisição manda; o legado só refina
     "qualificacao" (mesma regra de `boardPreVendas`). Antes o detalhe lia só o
     campo legado, que 3 leads locais tinham defasado: o cartão dizia Qualificado
     e a ficha dizia Em contato. */
  const etapa = (l.etapa === "qualificacao" ? "qualificacao" : (l.etapa_canonica ?? l.etapa ?? "novo")) as EstagioPreVendas;

  return {
    id: l.id,
    empresa: {
      id: l.empresa_id, nome: l.empresa_nome?.trim() || "Empresa não informada",
      setor: l.setor, porte: l.porte, cidade: l.cidade, website: l.website, cnpj: l.cnpj,
      telefone: l.emp_telefone, observacoes: l.emp_observacoes,
    },
    leadScore: l.lead_score ?? 0,
    naCarteira: l.na_carteira,
    jaTeveServico: l.ja_teve_servico,
    fichaDeCliente: l.ficha_de_cliente,
    temProcesso: l.tem_aquisicao || l.etapa !== null,
    pessoa: {
      nome: nomeCompleto(l.nome, l.sobrenome) || "Sem contato",
      cargo: l.cargo, email: l.email, telefone: l.telefone, whatsapp: l.whatsapp,
      // Vazio é ausência: a ficha inventava o perfil a partir do nome.
      linkedin: l.linkedin?.trim() || null,
      observacao: typeof l.campos_custom?.observacaoContato === "string" ? (l.campos_custom.observacaoContato as string).trim() || null : null,
      cidade: typeof l.campos_custom?.cidadeContato === "string" ? (l.campos_custom.cidadeContato as string).trim() || null : null,
    },
    etapa,
    etapaRotulo: ROTULO_ETAPA_PRE_VENDAS[etapa] ?? etapa,
    qualificado: l.qualificado,
    qualificadoEm: l.qualificado_em,
    qualificadoPor: l.qualificado_por,
    qualificadoPorTipo: l.qualificado_por_tipo,
    preQualificado: l.pre_qualificado,
    qualificacao: l.qualificacao,
    atribuicao: {
      origem: origemCanonica(l.origem), campanha: l.utm_campaign, medium: l.utm_medium,
      conteudo: l.utm_content, termo: l.utm_term, landingPage: l.landing_page,
      primeiroToque: toques?.primeiro ?? null, ultimoToque: toques?.ultimo ?? null,
      metaAdId: l.meta_ad_id, metaAdsetId: l.meta_adset_id, metaCampaignId: l.meta_campaign_id,
    },
    respostasFormulario: comIdentidadeDoFormulario(
      respostasDoFormulario(l.campos_custom, await camposCustomDoLead(organizacaoId)),
      { nome: l.nome, sobrenome: l.sobrenome, email: l.email, telefone: l.telefone, empresa: l.empresa_nome, cargo: l.cargo },
    ),
    metaRastreio: rastreioMetaDeCampos(l.campos_custom),
    responsavel: { id: l.responsavel_id, nome: l.responsavel },
    servicos: comoLista(l.servicos),
    tags: tags.map((t) => ({ id: t.id, nome: t.nome })),
    primeiroContatoEm: l.primeiro_contato_at,
    criadoEm: l.criado_em,
    nutricao: { motivo: l.nutricao_motivo, retomarEm: l.nutricao_retomar_em, observacao: l.nutricao_observacao, desde: l.nutrido_em },
    desqualificacao: { motivo: l.desq_motivo, detalhe: l.desq_detalhe, deEtapa: l.desq_de_etapa, em: l.desqualificado_em },
    etapaDesde: l.etapa_desde,
    ultimoToqueEm: l.ultimo_toque_em,
    oportunidades: oportunidades.map((o) => ({
      id: o.id, titulo: o.titulo, etapa: o.etapa ?? "entrada",
      etapaRotulo: ROTULO_ETAPA_PIPELINE[(o.etapa ?? "entrada") as EtapaPipeline] ?? o.etapa ?? "",
      familia: o.familia,
    })),
    proximaAcao: tarefa ? { titulo: tarefa.titulo, venceEm: tarefa.vence_em } : null,
  };
}

/* ── Detalhe da Oportunidade (Bloco 02 §25) ────────────────────────────── */

export interface DetalheOportunidade {
  id: string;
  titulo: string;
  etapa: EtapaPipeline;
  etapaRotulo: string;
  familia: string | null;
  familiaRotulo: string;
  motion: string | null;
  sourceProcess: string | null;
  valor: number | null;
  previsaoFechamento: string | null;
  /** Quando a oportunidade nasceu (negocios.created_at). */
  criadoEm: string;
  responsavel: { id: string | null; nome: string | null };
  empresa: { id: string | null; nome: string };
  contato: { id: string; fonte: "pessoa" | "lead"; nome: string; cargo: string | null; email: string | null; telefone: string | null; whatsapp: string | null } | null;
  leadId: string | null;
  /** Qualificação herdada de Pré-vendas (Bloco 02 §25). */
  qualificacaoHerdada: Record<string, unknown> | null;
  proximaAcao: { descricao: string | null; quando: string | null };
  badges: string[];
  motivoEstagnacao: string | null;
  motivoPerda: string | null;
  noShow: { em: string | null; contagem: number };
  trial: { iniciadoEm: string | null; encerradoEm: string | null };
  propostas: Array<{
    id: string; numero: number; versao: number; status: string; total: number | null;
    enviadaEm: string | null; modoFechamento: string | null;
    /** A composição. O 360 mostra a tabela "Produtos e valores" a partir dela. */
    itens: Array<{ nome: string; natureza: string | null; quantidade: number; valorUnitario: number; subtotal: number }>;
  }>;
  /** Checklist de fechamento (v0.13 §02.4). Nulo quando não há oportunidade canônica. */
  fechamento: import("./checklist-fechamento").ChecklistFechamento | null;
  reunioes: Array<{ id: string; titulo: string; data: string; status: string }>;
  irmas: Array<{ id: string; titulo: string; etapa: string; familia: string | null }>;
  evidencias: Array<{ tipo: string; em: string }>;
  /** Atividades registradas (ligação, e-mail, reunião, nota de sistema). */
  atividades: Array<{ id: string; tipo: string; titulo: string | null; descricao: string | null; autor: string | null; em: string; audioUrl: string | null }>;
  /** Resumo escrito na oportunidade (objetivo, escopo, contexto, dor, solução); vazio = ninguém escreveu. */
  resumo: Record<string, string> | null;
  /** As atividades da oportunidade (tabela `tarefas`): a mesma estrutura de /tarefas e da peça de Atividade. */
  tarefas: Array<{ id: string; titulo: string; tipo: string | null; status: string; descricao: string | null; venceEm: string | null; responsavel: string | null }>;
  /** Notas humanas do negócio. Separadas das atividades porque o 360 as mostra em trilhas diferentes. */
  notas: Array<{ id: string; texto: string; autor: string | null; em: string }>;
  /** Os outros contatos da empresa — o 360 lista o comitê, não só o contato principal. */
  contatos: Array<{ id: string; nome: string; cargo: string | null; email: string | null; telefone: string | null }>;
  /** Nomes das tags da oportunidade: `entity_labels` (canônica) ∪ `negocio_labels` (legada). */
  tags: string[];
}

export async function detalheOportunidade(organizacaoId: string, negocioId: string): Promise<DetalheOportunidade | null> {
  const [n] = await db.execute<{
    id: string; titulo: string; etapa: string | null; familia: string | null;
    motion: string | null; source_process: string | null; valor: string | null;
    previsao: string | null; responsavel_id: string | null; responsavel: string | null;
    empresa_id: string | null; empresa: string | null; lead_id: string | null;
    lead_nome: string | null; lead_cargo: string | null; lead_email: string | null; lead_telefone: string | null; lead_whatsapp: string | null;
    qualificacao: Record<string, unknown> | null; proxima_acao: string | null;
    proxima_acao_em: string | null; motivo_estagnacao: string | null;
    motivo_perda: string | null; no_show_em: string | null; no_show_contagem: number;
    trial_iniciado_em: string | null; trial_encerrado_em: string | null; bundle_id: string | null;
    resumo: Record<string, string> | null; criado_em: string;
  }>(sql`
    SELECT n.id::text, n.titulo, n.etapa, n.campos_custom->'resumoOportunidade' AS resumo, n.created_at::text AS criado_em,
           -- Familia e origem vem do canonico quando o legado nao tem.
           --
           -- negocios.service_family e NULL em 475 das 1.561 oportunidades, e
           -- nessas a oportunidade canonica SABE a familia, deduzida no backfill
           -- por cadeia de evidencias. Esta tela mostrava "sem familia" para um
           -- negocio cujo produto o sistema conhece, e e a mesma correcao ja
           -- feita no board (/pipeline-crm2/board).
           --
           -- Nesta ordem: onde o legado tem valor, foi alguem que editou, e
           -- editar ganha de deduzir.
           COALESCE(n.service_family, o.service_family) AS familia,
           n.commercial_motion AS motion,
           COALESCE(n.source_process, o.source_process) AS source_process,
           n.valor_total::text AS valor,
           n.previsao_fechamento::text AS previsao, n.responsavel_id::text, u.nome AS responsavel,
           n.empresa_id::text, COALESCE(e.nome, l.empresa) AS empresa, n.lead_id::text,
           NULLIF(trim((CASE WHEN COALESCE(trim(l.sobrenome),'')='' THEN trim(l.nome) WHEN lower(trim(l.sobrenome))=lower(trim(l.nome)) OR lower(trim(l.sobrenome)) LIKE lower(trim(l.nome))||' %' THEN trim(l.sobrenome) WHEN lower(trim(l.nome)) LIKE '% '||lower(trim(l.sobrenome)) THEN trim(l.nome) ELSE trim(l.nome)||' '||trim(l.sobrenome) END)), '') AS lead_nome,
           l.cargo AS lead_cargo, l.email AS lead_email, l.telefone AS lead_telefone, l.whatsapp AS lead_whatsapp,
           l.qualificacao, n.proxima_acao, n.proxima_acao_em::text,
           -- Estagnação mora no canônico desde a 0084; o legado é fallback.
           COALESCE(o.motivo_estagnacao, n.motivo_estagnacao) AS motivo_estagnacao,
           n.motivo_perda_chave AS motivo_perda,
           n.no_show_em::text, n.no_show_contagem,
           -- Trial mora no canônico desde a 0085; o legado é fallback.
           COALESCE(o.trial_iniciado_em, n.trial_iniciado_em)::text AS trial_iniciado_em,
           COALESCE(o.trial_encerrado_em, n.trial_encerrado_em)::text AS trial_encerrado_em,
           n.bundle_id::text
      FROM negocios n
      LEFT JOIN empresas e ON e.id = n.empresa_id
      LEFT JOIN leads l ON l.id = n.lead_id
      LEFT JOIN usuarios u ON u.id = n.responsavel_id
      LEFT JOIN oportunidades o ON o.negocio_id_legado = n.id
     WHERE n.id = ${negocioId}::uuid AND n.organizacao_id = ${organizacaoId}::uuid
  `);
  if (!n) return null;

  const [pessoaContato] = await db.execute<{
    id: string; nome: string | null; cargo: string | null; email: string | null; telefone: string | null; whatsapp: string | null;
  }>(sql`
    SELECT p.id::text, NULLIF(trim((CASE WHEN COALESCE(trim(p.sobrenome),'')='' THEN trim(p.nome) WHEN lower(trim(p.sobrenome))=lower(trim(p.nome)) OR lower(trim(p.sobrenome)) LIKE lower(trim(p.nome))||' %' THEN trim(p.sobrenome) WHEN lower(trim(p.nome)) LIKE '% '||lower(trim(p.sobrenome)) THEN trim(p.nome) ELSE trim(p.nome)||' '||trim(p.sobrenome) END)), '') AS nome,
           p.cargo, p.email, p.telefone, p.whatsapp
      FROM pessoas p
     WHERE p.organizacao_id = ${organizacaoId}::uuid
       AND (p.lead_id_legado = ${n.lead_id}::uuid OR (p.empresa_id = ${n.empresa_id}::uuid AND ${n.empresa_id}::uuid IS NOT NULL))
     ORDER BY CASE WHEN p.lead_id_legado = ${n.lead_id}::uuid THEN 0 ELSE 1 END, p.created_at ASC
     LIMIT 1
  `);

  const propostas = await db.execute<{
    id: string; numero: number; versao: number; status: string;
    total: string | null; enviada_em: string | null; modo: string | null;
    itens: Array<{ nome: string; natureza: string | null; quantidade: string | number; valor_unitario: string | number; subtotal: string | number }> | null;
  }>(sql`
    -- Proposta é canônica (SPEC §13.1); o vínculo é que ainda tem duas portas.
    -- Casar pela oportunidade primeiro e cair no negócio depois evita perder a
    -- proposta cujo vínculo legado ficou para trás, sem atribuir a esta
    -- oportunidade nenhuma das 455 propostas que só apontam para um lead — essas
    -- são caso de reconciliação, não de palpite.
    SELECT p.id::text, p.numero, p.versao, p.status,
           -- O valor vem das LINHAS (a mesma conta da lista e do detalhe da proposta); total_geral só vale sem linha.
           COALESCE(it.soma, p.total_geral)::text AS total,
           p.enviada_em::text, p.modo_fechamento AS modo,
           -- A composição, na ordem em que foi montada. É o bloco "Produtos e
           -- valores" do 360, que sem isto dizia "crie a primeira proposta"
           -- mesmo para oportunidade com proposta fechada.
           it.itens
      FROM propostas p
      LEFT JOIN LATERAL (
        SELECT json_agg(json_build_object(
                 'nome', pi.nome, 'natureza', pi.revenue_nature,
                 'quantidade', pi.quantidade, 'valor_unitario', pi.valor_unitario,
                 'subtotal', pi.subtotal
               ) ORDER BY pi.ordem, pi.created_at) AS itens, sum(pi.subtotal) AS soma
          FROM proposta_itens pi
         WHERE pi.proposta_id = p.id
      ) it ON TRUE
     WHERE p.negocio_id = ${negocioId}::uuid
        OR p.oportunidade_id = (SELECT id FROM oportunidades WHERE negocio_id_legado = ${negocioId}::uuid)
     ORDER BY p.versao DESC, p.created_at DESC
  `);

  // Próxima ação É tarefa (SPEC §23). A coluna `negocios.proxima_acao` está
  // vazia em 1.562 de 1.562 registros da base: ler dela fazia o selo "Sem
  // próxima ação" aparecer em todo card aberto, inclusive nos que tinham
  // compromisso marcado. A coluna segue como fallback para o que for escrito
  // por caminho ainda não migrado.
  const [tarefaAberta] = await db.execute<{ titulo: string; vence_em: string | null }>(sql`
    SELECT titulo, COALESCE(vence_em, data_vencimento)::text AS vence_em
      FROM tarefas
     WHERE negocio_id = ${negocioId}::uuid
       AND status IN ('a_fazer','em_andamento','aguardando')
     ORDER BY COALESCE(vence_em, data_vencimento) NULLS LAST LIMIT 1
  `);

  const reunioes = await db.execute<{ id: string; titulo: string; data: string; status: string }>(sql`
    SELECT id::text, titulo, data::text, status FROM reunioes
     WHERE negocio_id = ${negocioId}::uuid ORDER BY data DESC LIMIT 10
  `);

  const irmas = n.bundle_id ? await db.execute<{
    id: string; titulo: string; etapa: string | null; familia: string | null;
  }>(sql`
    SELECT COALESCE(o.negocio_id_legado, o.id)::text AS id, o.titulo, o.etapa,
           o.service_family AS familia
      FROM oportunidades o
     WHERE o.bundle_id = ${n.bundle_id}::uuid
       AND COALESCE(o.negocio_id_legado::text, o.id::text) <> ${negocioId}
  `) : [];

  const evidencias = await db.execute<{ tipo: string; em: string }>(sql`
    SELECT tipo, verificado_em::text AS em FROM comercial_evidencia
     WHERE negocio_id = ${negocioId}::uuid ORDER BY verificado_em DESC
  `);

  // Atividades, notas e comitê — o que o 360 mostra e a linha do tempo não
  // cobre. `timeline_visible` existe porque parte das atividades é ruído de
  // integração que nunca foi para o olho de ninguém.
  const atividades = await db.execute<{
    id: string; tipo: string; titulo: string | null; descricao: string | null; autor: string | null; em: string; audio_url: string | null;
  }>(sql`
    SELECT a.id::text, a.tipo, a.titulo, a.dados->>'audioUrl' AS audio_url,
           COALESCE(a.descricao, a.descricao_raw) AS descricao,
           COALESCE(u.nome, a.usuario_display_name) AS autor,
           a.created_at::text AS em
      FROM atividades a
      LEFT JOIN usuarios u ON u.id = a.usuario_id
     WHERE a.negocio_id = ${negocioId}::uuid
       AND a.organizacao_id = ${organizacaoId}::uuid
       AND a.timeline_visible
       -- Eco de evento de domínio (troca de responsável, mudança de etapa...) já está na Timeline
       -- (vendas_eventos); aqui entrava como "atividade feita" e inflava o contador de Concluídas.
       AND NOT (a.tipo IN ('nota', 'reuniao') AND a.dados ? 'evento')
     ORDER BY a.created_at DESC
     LIMIT 100
  `);

  const tarefas = await db.execute<{
    id: string; titulo: string; tipo: string | null; status: string; descricao: string | null; vence_em: string | null; responsavel: string | null;
  }>(sql`
    SELECT t.id::text, t.titulo, t.tipo, t.status, t.descricao,
           COALESCE(t.vence_em, t.data_vencimento)::text AS vence_em, u.nome AS responsavel
      FROM tarefas t LEFT JOIN usuarios u ON u.id = t.usuario_id
     WHERE t.negocio_id = ${negocioId}::uuid AND t.organizacao_id = ${organizacaoId}::uuid
     ORDER BY (t.status IN ('concluida','declinada')), COALESCE(t.vence_em, t.data_vencimento) NULLS LAST, t.created_at DESC
     LIMIT 100
  `);

  const notas = await db.execute<{ id: string; texto: string; autor: string | null; em: string }>(sql`
    SELECT n.id::text, COALESCE(n.conteudo, n.conteudo_raw) AS texto,
           COALESCE(u.nome, n.autor_display_name) AS autor,
           n.created_at::text AS em
      FROM notas n
      LEFT JOIN usuarios u ON u.id = n.autor_id
     WHERE n.negocio_id = ${negocioId}::uuid
       AND n.organizacao_id = ${organizacaoId}::uuid
     ORDER BY n.created_at DESC
     LIMIT 100
  `);

  // Sem empresa não há comitê a listar — e `empresa_id IS NULL` casaria com
  // todas as pessoas soltas da organização.
  const contatos = n.empresa_id ? await db.execute<{
    id: string; nome: string; cargo: string | null; email: string | null; telefone: string | null;
  }>(sql`
    SELECT id::text, COALESCE(nome, 'Sem nome') AS nome, cargo, email, telefone
      FROM pessoas
     WHERE empresa_id = ${n.empresa_id}::uuid
       AND organizacao_id = ${organizacaoId}::uuid
     ORDER BY nome
     LIMIT 50
  `) : [];

  const tags = await db.execute<{ nome: string }>(sql`
    SELECT l.nome FROM labels l
     WHERE l.organizacao_id = ${organizacaoId}::uuid
       AND l.id IN (SELECT label_id FROM entity_labels
                     WHERE entity_type = 'negocio' AND entity_id = ${negocioId}::uuid
                    UNION SELECT label_id FROM negocio_labels WHERE negocio_id = ${negocioId}::uuid)
     ORDER BY l.nome`);

  // No-show é estado da reunião (SPEC §23). A coluna `negocios.no_show_em` é
  // fallback: cobre os 4 casos históricos que a 0082 não pôde mover sem
  // palpite (negócio sem reunião, negócio com duas, reunião já cancelada).
  const faltas = reunioes.filter((r) => r.status === "no_show");
  const noShowEm = faltas[0]?.data ?? n.no_show_em;
  const noShowContagem = faltas.length || n.no_show_contagem;

  // O checklist explica o que falta para fechar, sem virar botão: o Won
  // acontece pela evidência, não pelo clique (v0.13 §02.4).
  const { checklistDeFechamento } = await import("./checklist-fechamento");
  const fechamento = await checklistDeFechamento(organizacaoId, negocioId);

  const etapa = (n.etapa ?? "entrada") as EtapaPipeline;
  const badges: string[] = [];
  if (noShowEm) badges.push("No-show");
  if (n.trial_iniciado_em && !n.trial_encerrado_em) badges.push("Trial ativo");
  if (propostas.some((p) => p.status === "aceita")) badges.push("Proposta aceita");
  const proximaAcao = tarefaAberta
    ? { descricao: tarefaAberta.titulo, quando: tarefaAberta.vence_em }
    : { descricao: n.proxima_acao, quando: n.proxima_acao_em };
  if (!proximaAcao.descricao && etapa !== "ganho" && etapa !== "perdido") badges.push("Sem próxima ação");

  return {
    id: n.id, titulo: n.titulo, etapa,
    etapaRotulo: ROTULO_ETAPA_PIPELINE[etapa] ?? etapa,
    familia: n.familia,
    familiaRotulo: ROTULO_FAMILIA[(n.familia ?? "UNKNOWN") as keyof typeof ROTULO_FAMILIA] ?? n.familia ?? "Não classificada",
    motion: n.motion, sourceProcess: n.source_process,
    valor: n.valor === null ? null : Number(n.valor),
    previsaoFechamento: n.previsao,
    criadoEm: n.criado_em,
    responsavel: { id: n.responsavel_id, nome: n.responsavel },
    empresa: { id: n.empresa_id, nome: n.empresa?.trim() || "Empresa não informada" },
    contato: pessoaContato ? {
      id: pessoaContato.id, fonte: "pessoa", nome: pessoaContato.nome ?? "Sem nome", cargo: pessoaContato.cargo,
      email: pessoaContato.email, telefone: pessoaContato.telefone, whatsapp: pessoaContato.whatsapp,
    } : n.lead_id && n.lead_nome ? {
      id: n.lead_id, fonte: "lead", nome: n.lead_nome, cargo: n.lead_cargo,
      email: n.lead_email, telefone: n.lead_telefone, whatsapp: n.lead_whatsapp,
    } : null,
    leadId: n.lead_id,
    qualificacaoHerdada: n.qualificacao,
    proximaAcao,
    badges,
    motivoEstagnacao: n.motivo_estagnacao,
    motivoPerda: n.motivo_perda,
    noShow: { em: noShowEm, contagem: noShowContagem },
    trial: { iniciadoEm: n.trial_iniciado_em, encerradoEm: n.trial_encerrado_em },
    fechamento,
    propostas: propostas.map((p) => ({
      id: p.id, numero: p.numero, versao: p.versao, status: p.status,
      total: p.total === null ? null : Number(p.total), enviadaEm: p.enviada_em,
      modoFechamento: p.modo,
      // `json_agg` devolve NULL sem linhas, e não um array vazio.
      itens: (p.itens ?? []).map((i) => ({
        nome: i.nome,
        natureza: i.natureza,
        quantidade: Number(i.quantidade) || 1,
        valorUnitario: Number(i.valor_unitario) || 0,
        subtotal: Number(i.subtotal) || 0,
      })),
    })),
    tags: tags.map((t) => t.nome),
    reunioes: reunioes.map((r) => ({ id: r.id, titulo: r.titulo, data: r.data, status: r.status })),
    irmas: irmas.map((i) => ({ id: i.id, titulo: i.titulo, etapa: i.etapa ?? "entrada", familia: i.familia })),
    evidencias: evidencias.map((e) => ({ tipo: e.tipo, em: e.em })),
    // `textoSimples`: 575 atividades do banco trazem HTML do Zoho dentro da
    // descrição, e o React escapa tudo — o operador lia a tag no meio da frase.
    atividades: atividades.map((a) => ({
      id: a.id, tipo: a.tipo, titulo: a.titulo,
      descricao: textoSimples(a.descricao), autor: a.autor, em: a.em, audioUrl: a.audio_url,
    })),
    resumo: n.resumo && typeof n.resumo === "object" ? n.resumo : null,
    tarefas: tarefas.map((t) => ({
      id: t.id, titulo: t.titulo, tipo: t.tipo, status: t.status, descricao: textoSimples(t.descricao),
      venceEm: t.vence_em, responsavel: t.responsavel,
    })),
    notas: notas.map((x) => ({
      id: x.id, texto: textoSimples(x.texto) ?? "", autor: x.autor, em: x.em,
    })),
    contatos: contatos.map((c) => ({
      id: c.id, nome: c.nome, cargo: c.cargo, email: c.email, telefone: c.telefone,
    })),
  };
}
