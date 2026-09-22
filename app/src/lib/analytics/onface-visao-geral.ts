import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  getAgendaHoje, getClientesAtivos, getMrrSeries, getPrecisaAtencao,
} from "@/lib/analytics/inicio";
import { getMrrAtivo, getMrrComparativo } from "@/lib/analytics/command-center";
import {
  getOperacaoDetalhe, getOperacoesAtivas, getOperacoesPrioritarias,
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

/** Meta de MRR do mês: soma dos alvos cadastrados no período.
 * Fonte: tabela `metas`, tipo `mrr_fechado`. Sem meta cadastrada devolve null
 * em vez de zero, porque zero mentiria dizendo que a meta foi batida. */
async function getMetaMrrDoMes(orgId: string, hoje: Date): Promise<number | null> {
  const periodo = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
  const [row] = await db.execute<{ alvo: string | null }>(sql`
    SELECT SUM(valor_alvo)::text AS alvo
      FROM metas
     WHERE organizacao_id = ${orgId}::uuid
       AND tipo = 'mrr_fechado'
       AND periodo = ${periodo}::date
  `);
  const alvo = Number(row?.alvo ?? 0);
  return alvo > 0 ? alvo : null;
}

const SEVERIDADE_PARA_PRIORIDADE = {
  critico: "critico",
  alto: "alto",
  medio: "moderado",
  moderado: "moderado",
  baixo: "moderado",
} as const;

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
): Promise<DadosVisaoGeral> {
  const [mrrAtivo, mrrMes, series, clientes, operacoesAtivas, prioritarias, atencao, agendaCru, metaMrr] =
    await Promise.all([
      getMrrAtivo(orgId),
      getMrrComparativo(orgId, hoje),
      getMrrSeries(orgId, hoje),
      getClientesAtivos(orgId),
      getOperacoesAtivas(orgId),
      getOperacoesPrioritarias(orgId, 9),
      getPrecisaAtencao(orgId, hoje),
      getAgendaHoje(orgId, usuarioId, hoje),
      getMetaMrrDoMes(orgId, hoje),
    ]);

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
      detalhe: {
        tituloCard: rotulos.titulo,
        subtituloCard: rotulos.sub,
        tipoLabel: rotulos.selo,
        servico: linha.descricao,
        responsavel: detalheEntrega?.responsavel?.nome ?? "Sem responsável",
        responsavelIniciais: (detalheEntrega?.responsavel?.nome ?? "?")
          .split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase(),
        responsavelCargo: rotulos.selo,
        progresso: {
          titulo: detalheEntrega?.etapas.length ? "Progresso por frente" : "Situação",
          itens: progresso,
        },
        // O sinal só existe quando há sinal: SLA vencido é o único que o
        // modelo sabe afirmar hoje para qualquer tipo.
        sinal: atrasada
          ? {
              titulo: "Prazo vencido",
              texto: linha.diasPrazo !== null
                ? `Esta operação está ${Math.abs(linha.diasPrazo)} dias além do prazo combinado.`
                : "Esta operação passou do prazo combinado.",
              acaoLabel: "Abrir registro",
              acaoHref: linha.href,
            }
          : undefined,
        indicadores: [
          { label: "Valor", valor: linha.valor > 0 ? brl(linha.valor) : "—", apoio: linha.descricao },
          { label: "Etapa", valor: linha.etapa, apoio: rotulos.selo },
          {
            label: "Prazo", valor: linha.prazo ? dataCurta(linha.prazo) : "Sem prazo",
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
  const compromissos: CompromissoAgenda[] = agendaCru.map((item) => ({
    id: item.id,
    data: hoje.toISOString().slice(0, 10),
    hora: item.hora,
    duracao: "—",
    titulo: item.titulo,
    descricao: item.detalhe,
    cliente: item.detalhe,
    contatoCliente: null,
    organizador: nomeUsuario,
    tipo: item.icone === "reuniao" ? "reuniao" : item.icone === "onboarding" ? "kickoff" : "follow-up",
    status: "confirmado",
    participantes: [],
    online: item.icone === "reuniao",
    linkReuniao: null,
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
    subtitulo: "Reuniões e tarefas de hoje. Participantes e link entram com o Microsoft 365.",
    proximo: compromissos[0]
      ? {
          rotulo: "Próximo",
          titulo: compromissos[0].titulo,
          cliente: compromissos[0].cliente,
          quando: `Hoje, ${compromissos[0].hora}`,
          participantes: [],
        }
      : null,
    resumoDia: [
      { label: "Compromissos hoje", valor: String(compromissos.length) },
      { label: "Reuniões", valor: String(compromissos.filter((c) => c.tipo === "reuniao").length) },
      { label: "Tarefas e follow-ups", valor: String(compromissos.filter((c) => c.tipo !== "reuniao").length) },
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
      prioridade: SEVERIDADE_PARA_PRIORIDADE[item.severidade as keyof typeof SEVERIDADE_PARA_PRIORIDADE] ?? "moderado",
      area,
      areaLabel: item.area,
      titulo: item.titulo,
      descricao: item.detalhe,
      cliente: "—",
      prazoTexto: "Ver registro",
      prazoTom: item.severidade === "critico" ? "atrasado" : "neutro",
      responsavel: null,
      responsavelIniciais: null,
      acaoLabel: ACAO_POR_ICONE[item.icone] ?? "Abrir",
      acaoHref: item.href,
      detalhe: {
        criadaEm: "—",
        criadaPor: "Sinal automático da operação",
        atualizadaEm: "agora",
        vinculo: {
          tipo: area === "financeiro" || area === "cs" ? "Cliente" : area === "implantacao" || area === "onboarding" ? "Entrega" : "Negócio",
          nome: item.titulo,
          apoio: item.area,
          href: item.href,
        },
        campos: [
          { label: "Área", valor: item.area },
          { label: "Severidade", valor: item.severidade },
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

  const atingidoPct = metaMrr ? Math.min(100, Math.round((mrrMes.atual / metaMrr) * 100)) : 0;
  const falta = metaMrr ? Math.max(0, metaMrr - mrrMes.atual) : 0;

  return {
    saudacao: primeiroNome ? `${periodo}, ${primeiroNome}.` : `${periodo}.`,
    data: `${dataBruta.charAt(0).toUpperCase()}${dataBruta.slice(1)} · Callface`,
    tagline: ["MAIS POSSIBILIDADES.", "MAIS RESULTADOS."],
    ctaPrincipal: { label: "Nova Atividade", href: "/tarefas?nova=1" },
    metricas: [
      {
        chave: "receita", icone: "receita", label: "Receita do mês",
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
        tendencia: "neutra", apoio: "com serviço ativo no portfólio",
      },
      {
        chave: "novo-faturamento", icone: "faturamento", label: "Novo faturamento",
        valor: brl(mrrMes.atual), delta: pct(mrrMes.deltaPct),
        tendencia: tendencia(mrrMes.deltaPct), apoio: "novas vendas no mês",
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
      itens: [
        { chave: "operacao", label: "Operação", estado: `${operacoesAtivas} em curso`, icone: "operacao", href: "/atendimento", destaque: true },
        { chave: "comercial", label: "Comercial", estado: `${brlCompacto(mrrMes.atual)} no mês`, icone: "comercial", href: "/vendas" },
        { chave: "financeiro", label: "Financeiro", estado: `${brlCompacto(mrrAtivo.atual)} de MRR`, icone: "financeiro", href: "/clientes/financeiro" },
        { chave: "suporte", label: "Suporte", estado: `${atencao.length} sinais abertos`, icone: "suporte", href: "/atendimento" },
      ],
    },
    assistente: {
      nome: "Assistente Nexo",
      assinatura: "Sempre ao seu lado.",
      saudacao: primeiroNome ? `Olá, ${primeiroNome}!` : "Olá!",
      destaqueQuantidade: String(atencao.length),
      destaqueTexto: atencao.length === 1 ? "item precisa de atenção agora." : "itens precisam de atenção agora.",
      ctaLabel: "Ver prioridades",
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
    listaCompleta: { label: "Ver todas as operações", href: "/clientes" },
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
          titulo: "Meta do mês",
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
