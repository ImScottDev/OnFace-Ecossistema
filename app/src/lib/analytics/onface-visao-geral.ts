import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  getAgendaHoje, getClientesAtivos, getMrrSeries, getPrecisaAtencao,
} from "@/lib/analytics/inicio";
import {
  getAtendimentoResumo, getFinanceiroResumo, getImplantacaoResumo, getMrrAtivo, getMrrComparativo,
} from "@/lib/analytics/command-center";
import { getMetaComercialAgregada } from "@/lib/metas";
import {
  getOperacaoDetalhe, getOperacoesAtivas, getOperacoesPrioritarias, LIMITE_ESTAGNACAO_DIAS,
} from "@/lib/analytics/onface-inicio";
import type {
  Agenda, BlocoAgenda, CompromissoAgenda, DadosVisaoGeral, EstadoEtapa,
  ItemProgresso, JornadaChave, Operacao, Pendencia, SerieGrafico, TipoRegistro,
} from "@/components/onface/visao-geral/types";

/**
 * Visão Geral ONFACE ligada ao banco.
 *
 * Regra da rodada, igual à que o `command-center` já segue: recorte novo de
 * dado que existe pode ser feito aqui; conceito que não existe no domínio NÃO
 * é inventado, vira `null` e a tela mostra indisponível. O que está faltando
 * fica listado em `PENDENCIAS_DE_DADO`, no fim do arquivo.
 */

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const brlCompacto = (v: number) =>
  v >= 1000
    ? `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`
    : brl(v);

const pct = (d: number | null) =>
  d === null ? null : `${d >= 0 ? "+" : "−"} ${Math.abs(d).toFixed(0)}%`;

const tendencia = (d: number | null) =>
  d === null ? "neutra" : d >= 0 ? "alta" : "baixa";

const dataCurta = (d: Date | null) =>
  d ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

/** Normaliza uma série no seu próprio intervalo, com folga em cima e embaixo
 * para a linha não encostar nas bordas do card. */
function normalizar(valores: number[]): number[] {
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  if (max === min) return valores.map(() => 0.5);
  const folga = (max - min) * 0.15;
  const piso = min - folga;
  const teto = max + folga;
  return valores.map((v) => (v - piso) / (teto - piso));
}

/**
 * A jornada sai do tipo do registro e, para entregas, da própria etapa que a
 * consulta já devolve ("Onboarding" para Callface AI, "Implantação" para o
 * resto). Não existe campo "jornada" no banco: ele é derivado, e continua
 * derivado enquanto os pipelines forem configuráveis por tenant.
 *
 * Cobrança é Financeiro, não CS: o que o registro diz é que há fatura em
 * aberto, não que existe um acompanhamento de sucesso rodando.
 */
function jornadaDe(tipo: string, etapa: string): JornadaChave {
  if (tipo === "entrega") return etapa === "Onboarding" ? "Onboarding" : "Implantação";
  if (tipo === "cobranca") return "Financeiro";
  return "Vendas";
}

const TIPO_REGISTRO: Record<string, TipoRegistro> = {
  negocio: "oportunidade",
  proposta: "oportunidade",
  entrega: "implantacao",
  cobranca: "cliente",
  tarefa: "oportunidade",
};

const ROTULO_JORNADA: Record<JornadaChave, string> = {
  "Pré-vendas": "Pré-vendas",
  Vendas: "Vendas",
  "Implantação": "Implantação",
  Onboarding: "Onboarding",
  Financeiro: "Financeiro",
};

const TITULO_POR_TIPO: Record<TipoRegistro, { titulo: string; sub: string; selo: string }> = {
  lead: { titulo: "Detalhe do lead", sub: "De onde veio e qual é o próximo contato.", selo: "Lead" },
  oportunidade: { titulo: "Detalhe da oportunidade", sub: "Onde a negociação está e o que falta para fechar.", selo: "Oportunidade" },
  implantacao: { titulo: "Detalhe da implantação", sub: "Progresso por frente e o que está travando a entrega.", selo: "Implantação" },
  cliente: { titulo: "Detalhe do cliente", sub: "Saúde da conta em operação, suporte e financeiro.", selo: "Cliente" },
  upgrade: { titulo: "Detalhe do upgrade", sub: "Contrato atual e o incremento em negociação.", selo: "Upgrade" },
};

function estadoDaEtapa(sla: string, diasPrazo: number | null): EstadoEtapa {
  if (sla === "vencido") return "alerta";
  if (diasPrazo !== null && diasPrazo <= 2) return "alerta";
  if (diasPrazo === null) return "aguardando";
  return "andamento";
}

/**
 * Série de MRR ATIVO por mês, reconstruída para trás a partir do MRR de hoje.
 *
 * `getMrrSeries` entrega o MRR *fechado* em cada mês (quanto entrou de novo),
 * que é outra coisa: no banco de dev ela mostrava "receita" de R$ 10k a R$ 60k
 * enquanto o MRR ativo é R$ 428k. Num gráfico chamado "Receita", isso seria
 * simplesmente errado.
 *
 * A base recorrente por mês não existe materializada, mas dá para reconstruir:
 * o ledger `mrr_movimentos` guarda cada delta com data, então o MRR ao fim do
 * mês M é o MRR de hoje menos tudo que se moveu depois de M.
 */
async function getMrrAtivoPorMes(orgId: string, mrrHoje: number, meses: number, hoje: Date) {
  // Date cru não sobrevive ao template de `sql`; vai como ISO com cast
  // explícito, que é a convenção já usada no resto do projeto.
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - (meses - 1), 1).toISOString();
  const linhas = await db.execute<{ mes: string; delta: string }>(sql`
    SELECT to_char(date_trunc('month', ocorrido_em), 'YYYY-MM') AS mes,
           COALESCE(SUM(delta), 0)::text                        AS delta
      FROM mrr_movimentos
     WHERE organizacao_id = ${orgId}::uuid
       AND ocorrido_em >= ${inicio}::timestamptz
     GROUP BY 1
  `);
  const porMes = new Map(linhas.map((l) => [l.mes, Number(l.delta) || 0]));

  // Caminha do mês corrente para trás, descontando o que entrou depois.
  const pontos: Array<{ label: string; valor: number }> = [];
  let acumulado = mrrHoje;
  for (let i = 0; i < meses; i += 1) {
    const ref = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const chave = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`;
    const nome = ref.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
    pontos.unshift({ label: nome.charAt(0).toUpperCase() + nome.slice(1), valor: acumulado });
    acumulado -= porMes.get(chave) ?? 0;
  }
  return pontos;
}

/**
 * Rota canônica de cada registro.
 *
 * As consultas compartilhadas (`getOperacoesPrioritarias`, `getAgendaHoje`)
 * ainda devolvem links do CRM antigo: `/negocios/:id` abre a tela anterior à
 * Oportunidade do handoff, `/leads/:id` redireciona para `/contatos` e perde o
 * registro, e `/clientes/implantacao/:id` não existe (404). Aqui o link é
 * reescrito para a rota da arquitetura nova — `/pipeline/:id`,
 * `/pessoas/:id` (a ficha usa o id do lead), `/projetos/:id` (o id do projeto É o do fulfillment).
 */
export function rotaCanonica(href: string): string {
  return href
    .replace(/^\/negocios\/([^/?#]+)$/, "/pipeline/$1")
    .replace(/^\/leads\/([^/?#]+)$/, "/pessoas/$1")
    .replace(/^\/clientes\/implantacao\/([0-9a-f-]{36})$/, "/projetos/$1");
}

/** Nome da organização para o cabeçalho. Era "Callface" fixo no código: em
 * qualquer outro tenant a tela de entrada diria o nome errado. */
async function getNomeOrganizacao(orgId: string): Promise<string | null> {
  const [row] = await db.execute<{ nome: string | null }>(sql`
    SELECT nome FROM organizacoes WHERE id = ${orgId}::uuid
  `);
  return row?.nome ?? null;
}

/**
 * Responsável de negócios e propostas do quadro de prioridades.
 *
 * A consulta compartilhada só traz responsável para entregas; para o resto o
 * card dizia "Sem responsável" mesmo quando o negócio tem dono no banco. A
 * proposta herda o responsável do negócio a que pertence (`criado_por_id` é
 * quem digitou, não quem responde pela venda).
 */
async function getResponsaveis(orgId: string, negocioIds: string[], propostaIds: string[]) {
  const mapa = new Map<string, string>();
  if (!negocioIds.length && !propostaIds.length) return mapa;
  const linhas = await db.execute<{ id: string; nome: string }>(sql`
    SELECT n.id::text AS id, u.nome
      FROM negocios n JOIN usuarios u ON u.id = n.responsavel_id
     WHERE n.organizacao_id = ${orgId}::uuid
       AND n.id::text = ANY(${`{${negocioIds.join(",")}}`}::text[])
    UNION ALL
    SELECT p.id::text, u.nome
      FROM propostas p
      JOIN negocios n ON n.id = p.negocio_id
      JOIN usuarios u ON u.id = n.responsavel_id
     WHERE p.organizacao_id = ${orgId}::uuid
       AND p.id::text = ANY(${`{${propostaIds.join(",")}}`}::text[])
  `);
  for (const l of linhas) mapa.set(l.id, l.nome);
  return mapa;
}

const iniciais = (nome: string | null) =>
  (nome ?? "?").split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

/** `getPrecisaAtencao` fala em critico/aviso/info. O mapa antigo só conhecia
 * critico/alto/medio, e todo aviso caía em "moderado" por omissão. */
const SEVERIDADE_PARA_PRIORIDADE = {
  critico: "critico",
  aviso: "alto",
  info: "moderado",
} as const;

const ROTULO_SEVERIDADE = { critico: "Crítico", aviso: "Alto", info: "Moderado" } as const;

const AREA_POR_ICONE = {
  pagamento: "financeiro",
  implantacao: "implantacao",
  lead: "atendimento",
  negocio: "vendas",
  cs: "cs",
  proposta: "vendas",
  onboarding: "onboarding",
} as const;

const ACAO_POR_ICONE = {
  pagamento: "Cobrar",
  implantacao: "Resolver",
  lead: "Assumir",
  negocio: "Retomar",
  cs: "Ver caso",
  proposta: "Agendar",
  onboarding: "Agendar",
} as const;

export async function montarVisaoGeral(
  orgId: string,
  usuarioId: string,
  nomeUsuario: string,
  hoje = new Date(),
  /** Colaborador (não admin) vê só o que é dele; admin vê tudo. */
  somenteDoUsuario = false,
): Promise<DadosVisaoGeral> {
  const [
    mrrAtivo, mrrMes, series, clientes, operacoesAtivasOrg, prioritariasOrg, atencaoOrg, agendaCru, metaComercial,
    nomeOrg, implantacao, financeiro, atendimento,
  ] =
    await Promise.all([
      getMrrAtivo(orgId),
      getMrrComparativo(orgId, hoje),
      getMrrSeries(orgId, hoje),
      getClientesAtivos(orgId),
      getOperacoesAtivas(orgId),
      getOperacoesPrioritarias(orgId, 9),
      getPrecisaAtencao(orgId, hoje),
      getAgendaHoje(orgId, usuarioId, hoje),
      // Meta comercial é faturamento (mrr_fechado + valor_setup), com o
      // fallback para metas antigas de `mrr_fechado`. A leitura anterior
      // somava só o tipo legado contra o MRR recorrente: duas regras que o
      // resto do produto já tinha aposentado.
      getMetaComercialAgregada(orgId, hoje),
      getNomeOrganizacao(orgId),
      getImplantacaoResumo(orgId),
      getFinanceiroResumo(orgId),
      getAtendimentoResumo(orgId),
    ]);
  const metaMrr = metaComercial.valorAlvo > 0 ? metaComercial.valorAlvo : null;

  // Recorte por responsável: negócio e proposta têm dono (negocios.responsavel_id);
  // entrega, cobrança e os sinais agregados de "precisa de atenção" são da
  // organização e não têm dono no modelo, então saem da visão do colaborador
  // em vez de aparecer como se fossem dele. Pega 60 candidatas, não 9, porque o
  // filtro roda depois do teto por tipo.
  let operacoesAtivas = operacoesAtivasOrg;
  let prioritarias = prioritariasOrg;
  let atencao = atencaoOrg;
  if (somenteDoUsuario) {
    const donos = await db.execute<{ id: string; tipo: string }>(sql`
      SELECT n.id::text AS id, 'negocio' AS tipo FROM negocios n
       WHERE n.organizacao_id = ${orgId}::uuid AND n.responsavel_id = ${usuarioId}::uuid
         AND n.etapa NOT IN ('ganho','perdido')
      UNION ALL
      SELECT p.id::text, 'proposta' FROM propostas p JOIN negocios n ON n.id = p.negocio_id
       WHERE p.organizacao_id = ${orgId}::uuid AND n.responsavel_id = ${usuarioId}::uuid
    `);
    const meus = new Set(donos.map((d) => d.id));
    operacoesAtivas = donos.filter((d) => d.tipo === "negocio").length;
    prioritarias = (await getOperacoesPrioritarias(orgId, 60))
      .filter((o) => meus.has(o.id)).slice(0, 9);
    atencao = [];
  }

  const responsaveis = await getResponsaveis(
    orgId,
    prioritarias.filter((o) => o.tipo === "negocio").map((o) => o.id),
    prioritarias.filter((o) => o.tipo === "proposta").map((o) => o.id),
  );

  // ── Gráfico: os seis meses até o mês corrente ──────────────────────────
  // Duas leituras diferentes de propósito: "Receita" é a base recorrente ativa
  // (o tamanho da operação) e "Nova receita" é o que entrou de novo no mês (a
  // velocidade). Usar MRR fechado nas duas faria o gráfico dizer a mesma coisa
  // duas vezes, e com um número dez vezes menor que o real.
  const baseMensal = await getMrrAtivoPorMes(orgId, mrrAtivo.atual, 6, hoje);
  const novoPorMes = series["12M"].slice(-6);

  const seriesGrafico: SerieGrafico[] = [
    {
      chave: "receita", label: "Receita", cor: "coral",
      pontos: normalizar(baseMensal.map((p) => p.valor)),
      rotulos: baseMensal.map((p) => brlCompacto(p.valor)),
    },
    {
      chave: "nova-receita", label: "Nova receita", cor: "azul",
      pontos: normalizar(novoPorMes.map((p) => p.novo)),
      rotulos: novoPorMes.map((p) => brlCompacto(p.novo)),
    },
  ];

  // ── Operações: uma linha por registro, detalhe conforme o tipo ─────────
  // Só entrega tem função de detalhe; para os outros tipos o detalhe é montado
  // do que a própria linha carrega, sem consulta extra e sem campo inventado.
  const detalhesEntrega = new Map(
    await Promise.all(
      prioritarias
        .filter((o) => o.tipo === "entrega")
        .map(async (o) => [o.id, await getOperacaoDetalhe(orgId, o.id)] as const),
    ),
  );

  const operacoes: Operacao[] = prioritarias.map((linha) => {
    const tipo = TIPO_REGISTRO[linha.tipo] ?? "oportunidade";
    const rotulos = TITULO_POR_TIPO[tipo];
    const detalheEntrega = detalhesEntrega.get(linha.id) ?? null;

    const progresso: ItemProgresso[] = detalheEntrega?.etapas.length
      ? detalheEntrega.etapas.slice(0, 4).map((e) => ({
          chave: e.workstream,
          label: e.workstream.replace(/_/g, " "),
          pct: e.pct,
        }))
      : [
          { chave: "etapa", label: "Etapa atual", estado: linha.etapa, tom: "andamento" },
          {
            chave: "prazo", label: "Prazo",
            estado: linha.prazo ? dataCurta(linha.prazo) : "Sem prazo",
            tom: linha.sla === "vencido" ? "bloqueado" : "ok",
          },
          {
            chave: "sla", label: "SLA",
            estado: linha.sla === "vencido" ? "Atrasado" : "No prazo",
            tom: linha.sla === "vencido" ? "bloqueado" : "ok",
          },
          {
            chave: "valor", label: "Valor",
            estado: linha.valor > 0 ? brl(linha.valor) : "Sem valor",
            tom: "ok",
          },
        ];

    const atrasada = linha.sla === "vencido";
    const href = rotaCanonica(linha.href);
    const responsavel = detalheEntrega?.responsavel?.nome ?? responsaveis.get(linha.id) ?? null;
    // Para negócio, o "prazo" da consulta é a data em que ele estoura o limite
    // de estagnação (última mexida + 14 dias), não um prazo combinado com o
    // cliente. O texto precisa dizer o que o número é.
    const textoSinal = linha.tipo === "negocio"
      ? linha.diasPrazo !== null
        ? `Sem atualização há ${Math.abs(linha.diasPrazo) + LIMITE_ESTAGNACAO_DIAS} dias (limite de ${LIMITE_ESTAGNACAO_DIAS}).`
        : "Negócio parado além do limite de estagnação."
      : linha.diasPrazo !== null
        ? `Esta operação está ${Math.abs(linha.diasPrazo)} dias além do prazo.`
        : "Esta operação passou do prazo.";

    return {
      id: linha.id,
      empresa: linha.empresa || "Sem empresa",
      descricao: linha.descricao,
      etapa: linha.etapa,
      etapaEstado: estadoDaEtapa(linha.sla, linha.diasPrazo),
      jornada: jornadaDe(linha.tipo, linha.etapa),
      valor: linha.valor > 0 ? brl(linha.valor) : "—",
      status: atrasada ? "atencao" : "andamento",
      tipo,
      href,
      detalhe: {
        tituloCard: rotulos.titulo,
        subtituloCard: rotulos.sub,
        tipoLabel: rotulos.selo,
        servico: linha.descricao,
        responsavel: responsavel ?? "Sem responsável",
        responsavelIniciais: iniciais(responsavel),
        responsavelCargo: rotulos.selo,
        progresso: {
          titulo: detalheEntrega?.etapas.length ? "Progresso por frente" : "Situação",
          itens: progresso,
        },
        // O sinal só existe quando há sinal: SLA vencido é o único que o
        // modelo sabe afirmar hoje para qualquer tipo.
        sinal: atrasada
          ? {
              titulo: linha.tipo === "negocio" ? "Negócio parado" : "Prazo vencido",
              texto: textoSinal,
              acaoLabel: "Abrir registro",
              acaoHref: href,
            }
          : undefined,
        indicadores: [
          { label: "Valor", valor: linha.valor > 0 ? brl(linha.valor) : "—", apoio: linha.descricao },
          { label: "Etapa", valor: linha.etapa, apoio: rotulos.selo },
          {
            label: linha.tipo === "negocio" ? "Limite de estagnação" : "Prazo",
            valor: linha.prazo ? dataCurta(linha.prazo) : "Sem prazo",
            apoio: linha.diasPrazo !== null
              ? `${Math.abs(linha.diasPrazo)} dias ${linha.diasPrazo < 0 ? "em atraso" : "restantes"}`
              : "",
            tom: atrasada ? "negativo" : "positivo",
          },
          {
            label: "Próximo passo",
            valor: detalheEntrega?.proximoPasso?.titulo ?? "Sem item aberto",
            apoio: dataCurta(detalheEntrega?.proximoPasso?.prazo ?? null),
          },
        ],
        resumo: [
          { label: "Empresa", valor: linha.empresa || "Sem empresa" },
          { label: "Tipo", valor: rotulos.selo },
          { label: "Etapa", valor: linha.etapa, selo: "neutro" },
          { label: "Situação", valor: atrasada ? "Atrasada" : "Em dia", selo: atrasada ? "coral" : "neutro" },
          { label: "Valor", valor: linha.valor > 0 ? brl(linha.valor) : "—" },
          { label: "Prazo", valor: linha.prazo ? dataCurta(linha.prazo) : "Sem prazo" },
        ],
        tags: [rotulos.selo, ROTULO_JORNADA[jornadaDe(linha.tipo, linha.etapa)]],
      },
    };
  });

  // ── Agenda ─────────────────────────────────────────────────────────────
  // `getAgendaHoje` traz reuniões e tarefas do próprio CRM. Participante,
  // link de reunião e confirmação vivem no Microsoft 365 e só aparecem quando
  // o Graph estiver ligado: aqui ficam vazios em vez de inventados.
  // Tarefa abre direto na gaveta de Atividades (`?atv=p:<id>`, a chave que o
  // desenho usa para a lista própria); reunião abre o registro a que pertence.
  // ponytail: a gaveta só abre se a tarefa estiver entre as 300 que
  // montarAtividades carrega (onface-atividades.ts, LIMIT 300); hoje são ~287
  // abertas. Upgrade: Atividades buscar a tarefa do parâmetro `atv` fora da página.
  const compromissos: CompromissoAgenda[] = agendaCru.map((item) => ({
    id: item.id,
    hora: item.hora === "--:--" ? "Sem hora" : item.hora,
    titulo: item.titulo,
    descricao: item.detalhe,
    tipo: item.icone === "reuniao" ? "reuniao" : item.icone === "onboarding" ? "kickoff" : "follow-up",
    atrasado: item.grupo === "atrasada",
    href: item.id.startsWith("tarefa-")
      ? `/tarefas?atv=${encodeURIComponent(`p:${item.id.slice("tarefa-".length)}`)}`
      : rotaCanonica(item.href),
  }));

  const blocosAgenda: BlocoAgenda[] = compromissos.length
    ? [{
        chave: "hoje",
        label: "Hoje",
        apoio: `${compromissos.length} ${compromissos.length === 1 ? "compromisso" : "compromissos"}`,
        compromissos,
      }]
    : [];

  const agenda: Agenda = {
    titulo: "Sua agenda",
    subtitulo: "Suas reuniões de hoje e tarefas que vencem hoje ou já venceram.",
    // O próximo é o primeiro que ainda não passou; atrasado não é "próximo".
    proximo: (() => {
      const c = compromissos.find((x) => !x.atrasado) ?? null;
      return c ? { rotulo: "Próximo", id: c.id, titulo: c.titulo, apoio: c.descricao, quando: `Hoje, ${c.hora}` } : null;
    })(),
    resumoDia: [
      { label: "Compromissos hoje", valor: String(compromissos.length) },
      { label: "Reuniões", valor: String(compromissos.filter((c) => c.tipo === "reuniao").length) },
      { label: "Tarefas e follow-ups", valor: String(compromissos.filter((c) => c.tipo !== "reuniao").length) },
      {
        label: "Atrasados",
        valor: String(compromissos.filter((c) => c.atrasado).length),
        tom: compromissos.some((c) => c.atrasado) ? "negativo" : "neutro",
      },
    ],
    blocos: blocosAgenda,
    linkLabel: "Abrir calendário",
    linkHref: "/calendario",
  };

  // ── Pendências ─────────────────────────────────────────────────────────
  // `getPrecisaAtencao` entrega sinal, área e destino. Responsável, contato do
  // cliente e histórico da atividade ainda não existem nesse recorte.
  const pendencias: Pendencia[] = atencao.map((item) => {
    const area = AREA_POR_ICONE[item.icone] ?? "vendas";
    return {
      id: item.id,
      prioridade: SEVERIDADE_PARA_PRIORIDADE[item.severidade] ?? "moderado",
      area,
      areaLabel: item.area,
      titulo: item.titulo,
      descricao: item.detalhe,
      // O sinal é uma contagem agregada (ex.: "74 cobranças"), não um item de um
      // cliente só, e não tem prazo próprio: os campos ficam vazios de verdade.
      cliente: "—",
      prazoTexto: "Sem prazo",
      // Sem prazo próprio não há como estar atrasado: a severidade já aparece
      // na prioridade, pintar "Sem prazo" de vermelho se contradizia.
      prazoTom: "neutro",
      responsavel: null,
      responsavelIniciais: null,
      acaoLabel: ACAO_POR_ICONE[item.icone] ?? "Abrir",
      acaoHref: rotaCanonica(item.href),
      detalhe: {
        origem: "Sinal automático, recalculado do banco a cada abertura do Início.",
        // Todo sinal de `getPrecisaAtencao` é contagem agregada que leva a uma
        // lista filtrada, nunca a um cliente ou negócio específico.
        vinculo: {
          tipo: "Lista",
          nome: `Abrir em ${item.area}`,
          apoio: item.detalhe,
          href: rotaCanonica(item.href),
        },
        campos: [
          { label: "Área", valor: item.area },
          { label: "Severidade", valor: ROTULO_SEVERIDADE[item.severidade] ?? item.severidade },
        ],
        historico: [],
        proximoPasso: item.detalhe,
      },
    };
  });

  const primeiroNome = (nomeUsuario || "").split(" ")[0];
  const horaSp = Number(hoje.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }));
  const periodo = horaSp < 12 ? "Bom dia" : horaSp < 18 ? "Boa tarde" : "Boa noite";
  const dataBruta = hoje.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long",
  });

  // Realizado da meta = faturamento fechado pelas closers no mês, a MESMA conta
  // da página de Metas e de /vendas. Não é o MRR do card ao lado.
  const realizadoMeta = metaComercial.realizado;
  const atingidoPct = metaMrr ? Math.min(100, Math.round((realizadoMeta / metaMrr) * 100)) : 0;
  const falta = metaMrr ? Math.max(0, metaMrr - realizadoMeta) : 0;

  return {
    saudacao: primeiroNome ? `${periodo}, ${primeiroNome}.` : `${periodo}.`,
    data: `${dataBruta.charAt(0).toUpperCase()}${dataBruta.slice(1)}${nomeOrg ? ` · ${nomeOrg}` : ""}`,
    tagline: ["MAIS POSSIBILIDADES.", "MAIS RESULTADOS."],
    ctaPrincipal: { label: "Nova Atividade", href: "/tarefas?nova=1" },
    metricas: [
      {
        // É o MRR ativo da carteira (catálogo `mrr_atual`), não receita do mês:
        // o rótulo antigo prometia uma coisa e mostrava outra.
        chave: "receita", icone: "receita", label: "MRR ativo",
        valor: brl(mrrAtivo.atual), delta: pct(mrrAtivo.deltaPct),
        tendencia: tendencia(mrrAtivo.deltaPct), apoio: `vs. ${mrrAtivo.janelaDias} dias atrás`,
      },
      {
        chave: "operacoes", icone: "operacoes", label: "Operações ativas",
        valor: operacoesAtivas.toLocaleString("pt-BR"), delta: null,
        tendencia: "neutra", apoio: "negócios e entregas em curso",
      },
      {
        chave: "clientes", icone: "clientes", label: "Clientes ativos",
        valor: clientes.toLocaleString("pt-BR"), delta: null,
        // A métrica do catálogo (`clientes_ativos`) é Company + Service ACTIVE,
        // SEM filtro de portfólio — é a definição do Módulo 11. O apoio dizia
        // "no portfólio", que é outro recorte e dá outro número (medido 05/10:
        // 389 com serviço ativo, 272 com serviço ativo DE portfólio). Rótulo
        // alinhado à conta que o número de fato faz.
        tendencia: "neutra", apoio: "com serviço ativo",
      },
      {
        chave: "novo-faturamento", icone: "faturamento", label: "MRR fechado no mês",
        valor: brl(mrrMes.atual), delta: pct(mrrMes.deltaPct),
        tendencia: tendencia(mrrMes.deltaPct), apoio: "vs. mesmo período do mês anterior",
      },
    ],
    grafico: {
      titulo: "Evolução da operação",
      subtitulo: "Receita recorrente e novas vendas nos últimos seis meses.",
      periodos: baseMensal.map((p) => p.label),
      series: seriesGrafico,
    },
    areas: {
      titulo: "Áreas em destaque",
      subtitulo: "Módulos do ecossistema ONFACE.",
      // Sem "ver todos": apontava para `/inicio`, a própria página. Link que
      // recarrega onde a pessoa já está é pior que link ausente — promete
      // mais e entrega o mesmo. A lista completa de módulos é o menu lateral.
      // Cada tile mostra o número da tela para onde leva. Antes "Operação"
      // levava ao Atendimento com a contagem de negócios+entregas, e "Suporte"
      // mostrava os sinais de atenção: número e destino não conversavam.
      itens: [
        { chave: "operacao", label: "Entregas", estado: `${implantacao.ativas} ${implantacao.ativas === 1 ? "entrega em curso" : "entregas em curso"}`, icone: "operacao", href: "/pos-vendas", destaque: true },
        { chave: "comercial", label: "Comercial", estado: `${brlCompacto(mrrMes.atual)} fechados no mês`, icone: "comercial", href: "/vendas" },
        { chave: "financeiro", label: "Financeiro", estado: `${financeiro.atrasadoCount} ${financeiro.atrasadoCount === 1 ? "fatura vencida" : "faturas vencidas"}`, icone: "financeiro", href: "/clientes/financeiro" },
        { chave: "suporte", label: "Atendimento", estado: `${atendimento.whatsappAbertas.toLocaleString("pt-BR")} conversas · ${atendimento.emailPendentes.toLocaleString("pt-BR")} e-mails`, icone: "suporte", href: "/atendimento" },
      ],
    },
    assistente: {
      nome: "Assistente Nexo",
      assinatura: "Sempre ao seu lado.",
      saudacao: primeiroNome ? `Olá, ${primeiroNome}!` : "Olá!",
      destaqueQuantidade: String(atencao.length),
      destaqueTexto: atencao.length === 1 ? "item precisa de atenção agora." : "itens precisam de atenção agora.",
      // O número acima é de pendências (sinais de atenção), então o botão leva
      // à aba Pendências. Levava a Prioridades, que é outra lista.
      ctaLabel: "Ver pendências",
      ctaHref: "#operacoes",
      acoes: [
        { chave: "resumo", label: "Gerar resumo", icone: "resumo" },
        { chave: "gargalos", label: "Analisar gargalos", icone: "gargalos" },
      ],
    },
    abas: [
      { chave: "prioridades", label: "Prioridades" },
      { chave: "agenda", label: "Agenda" },
      { chave: "pendencias", label: "Pendências" },
    ],
    operacoes,
    // Sem "ver todas": não existe tela com todas as operações (negócio,
    // proposta, entrega e cobrança juntos), e /clientes era outra coisa.
    agenda,
    pendencias: {
      titulo: "Itens que exigem ação agora",
      subtitulo: "Gargalos e esperas, ordenados por impacto na operação.",
      itens: pendencias,
      // Sugestão do assistente ainda não é gerada: entra quando houver regra
      // ou modelo por trás, nunca como texto fixo.
      sugestaoNexo: null,
    },
    meta: metaMrr
      ? {
          titulo: "Meta comercial do mês",
          valor: brl(metaMrr),
          atingidoPct,
          apoio: falta > 0 ? `Faltam ${brl(falta)} para alcançar a meta.` : "Meta do mês alcançada.",
        }
      : null,
  };
}

/**
 * Campos que a tela pede e o domínio ainda não tem. Ficam aqui, no código, em
 * vez de virarem valor inventado na interface:
 *
 * 1. Jornadas de CS e Expansão. Não existe pipeline dessas jornadas, então elas
 *    saíram da tela: cobrança agora aparece como Financeiro, que é o que o
 *    registro de fato diz. Quando o CS tiver pipeline, entra aqui.
 * 2. Agenda do Microsoft 365: participante, confirmação, link da reunião e
 *    telefone do contato. Sem eles, lembrete por WhatsApp e "entrar na
 *    reunião" ficam desligados.
 * 3. Atividade como entidade própria: criada em, criada por, histórico e
 *    vínculo tipado. Hoje a pendência é um sinal calculado, não um registro.
 * 4. Responsável de cada pendência e telefone do contato do cliente.
 * 5. Sugestão do assistente na fila de pendências.
 */
export const PENDENCIAS_DE_DADO = [
  "Pipeline de CS e Expansão (a tela não usa essas jornadas até existirem)",
  "Agenda via Microsoft Graph (participantes, link, confirmação)",
  "Atividade como registro próprio (autor, histórico, vínculo)",
  "Responsável por pendência",
  "Sugestão do assistente",
] as const;
