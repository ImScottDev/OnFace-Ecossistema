import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type {
  Atividade, ColunaKanban, DadosAtividades, GrupoPrazo, GrupoTabela, OpcaoFiltro,
  PrioridadeAtividade, ResumoAtividades, StatusAtividade, VinculoAtividade,
} from "@/components/onface/atividades/types";

/**
 * Atividades ONFACE.
 *
 * Atividade não é entidade nova: é a tabela `tarefas`, que já nasce com os
 * vínculos que a tela precisa (`lead_id`, `negocio_id`, `empresa_id`,
 * `servico_canonico_id`) e com `origem`, que é a jornada de onde a atividade
 * veio. Criar uma tabela paralela duplicaria o que a operação já usa.
 *
 * O kanban usa `tarefas.status`, campo real desde a migration 0046
 * (a_fazer | em_andamento | aguardando | concluida | declinada). Antes ele era
 * derivado de data de vencimento, o que descrevia o prazo e não o trabalho.
 *
 * O prazo continua derivado, e agrupa a tabela: atrasada, hoje, próximos sete
 * dias, em breve, sem data.
 */

/**
 * Rótulo da jornada a partir de `tarefas.origem`, que é campo real.
 *
 * Diferente da Visão Geral, aqui a jornada não é palpite: a coluna diz de onde
 * a atividade veio. O mapa cobre todos os valores que o domínio prevê, mesmo os
 * que ainda não aparecem no banco de dev (hoje só MANUAL, PLAYBOOK e BILLING),
 * porque o filtro monta a lista a partir do que existe e não do mapa.
 */
const JORNADA_POR_ORIGEM: Record<string, string> = {
  MANUAL: "Manual",
  PLAYBOOK: "Playbook",
  BILLING: "Financeiro",
  ONBOARDING: "Onboarding",
  IMPLANTACAO: "Implantação",
  RENOVACAO: "CS",
  RISCO: "CS",
  EXPANSAO: "Expansão",
  AUTOMACAO: "Automação",
};

const PRIORIDADE: Record<string, PrioridadeAtividade> = {
  alta: "alta",
  media: "media",
  baixa: "baixa",
};

/** "16 de set de 2026". O locale devolve "set." com ponto, que destoa do resto
 * do produto. */
const dataLonga = (d: Date | null) =>
  d ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).replace(".", "") : "Sem data";

const iniciais = (nome: string | null) =>
  (nome || "?").split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

/** Dias entre hoje e o vencimento, em dias inteiros de calendário. */
function diasAte(venc: Date | null, hoje: Date): number | null {
  if (!venc) return null;
  const a = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime();
  const b = new Date(venc.getFullYear(), venc.getMonth(), venc.getDate()).getTime();
  return Math.round((b - a) / 86_400_000);
}

const STATUS_VALIDOS: StatusAtividade[] = ["a_fazer", "em_andamento", "aguardando", "concluida", "declinada"];

function statusDe(bruto: string, concluida: boolean): StatusAtividade {
  if (STATUS_VALIDOS.includes(bruto as StatusAtividade)) return bruto as StatusAtividade;
  return concluida ? "concluida" : "a_fazer";
}

function grupoPrazoDe(venc: Date | null, hoje: Date): GrupoPrazo {
  if (!venc) return "sem-data";
  const dias = diasAte(venc, hoje) ?? 0;
  if (dias < 0) return "atrasada";
  if (dias === 0) return "hoje";
  if (dias <= 7) return "semana";
  return "breve";
}

function textoPrazo(venc: Date | null, hoje: Date, concluida: boolean) {
  if (concluida) return { texto: "Concluída", tom: "neutro" as const };
  if (!venc) return { texto: "Sem data", tom: "neutro" as const };
  const dias = diasAte(venc, hoje) ?? 0;
  if (dias < 0) return { texto: `${Math.abs(dias)} ${Math.abs(dias) === 1 ? "dia" : "dias"} em atraso`, tom: "atrasado" as const };
  if (dias === 0) return { texto: "Vence hoje", tom: "hoje" as const };
  if (dias === 1) return { texto: "Vence amanhã", tom: "proximo" as const };
  return { texto: `Vence em ${dias} dias`, tom: "proximo" as const };
}

interface LinhaCrua extends Record<string, unknown> {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  prioridade: string;
  origem: string;
  status: string;
  concluida: boolean;
  vence_em: string | null;
  data_vencimento: string | null;
  concluida_em: string | null;
  created_at: string;
  responsavel: string | null;
  empresa_nome: string | null;
  empresa_id: string | null;
  lead_nome: string | null;
  lead_sobrenome: string | null;
  lead_id: string | null;
  negocio_titulo: string | null;
  negocio_id: string | null;
  servico: string | null;
}

/** O vínculo é o que dá sentido à atividade: ela sempre pertence a alguém.
 * A ordem de precedência segue a do domínio (entrega, negócio, empresa, lead). */
function vinculoDe(l: LinhaCrua): VinculoAtividade {
  if (l.servico && l.empresa_nome) {
    return { tipo: "Entrega", nome: l.empresa_nome, apoio: l.servico, href: "/clientes/implantacao" };
  }
  if (l.negocio_id) {
    return {
      tipo: "Negócio",
      nome: l.negocio_titulo || l.empresa_nome || "Negócio",
      apoio: l.empresa_nome || "Sem empresa",
      href: `/negocios/${l.negocio_id}`,
    };
  }
  if (l.empresa_id && l.empresa_nome) {
    return { tipo: "Cliente", nome: l.empresa_nome, apoio: "Conta da base", href: `/clientes?empresa=${l.empresa_id}` };
  }
  if (l.lead_id) {
    const nome = [l.lead_nome, l.lead_sobrenome].filter(Boolean).join(" ");
    return { tipo: "Lead", nome: l.empresa_nome || nome || "Lead", apoio: nome || "Sem contato", href: `/pre-vendas` };
  }
  return { tipo: "Avulsa", nome: "Sem vínculo", apoio: "Atividade solta", href: "/tarefas" };
}

export async function montarAtividades(
  orgId: string,
  hoje = new Date(),
): Promise<DadosAtividades> {
  const [linhas, responsaveis, totais] = await Promise.all([
    db.execute<LinhaCrua>(sql`
      SELECT t.id::text, t.titulo, t.descricao, t.tipo, t.prioridade, t.origem, t.status,
             t.concluida, t.vence_em::text, t.data_vencimento::text,
             t.concluida_em::text, t.created_at::text,
             u.nome        AS responsavel,
             e.nome        AS empresa_nome,
             e.id::text    AS empresa_id,
             l.nome        AS lead_nome,
             l.sobrenome   AS lead_sobrenome,
             l.id::text    AS lead_id,
             n.titulo      AS negocio_titulo,
             n.id::text    AS negocio_id,
             COALESCE(sc.canonical_product, sc.canonical_key) AS servico
        FROM tarefas t
        LEFT JOIN usuarios u  ON u.id = t.usuario_id
        LEFT JOIN empresas e  ON e.id = t.empresa_id
        LEFT JOIN leads l     ON l.id = t.lead_id
        LEFT JOIN negocios n  ON n.id = t.negocio_id
        LEFT JOIN servicos_canonicos sc ON sc.id = t.servico_canonico_id
       WHERE t.organizacao_id = ${orgId}::uuid
       ORDER BY (t.status IN ('concluida','declinada')) ASC,
                COALESCE(t.vence_em, t.data_vencimento::timestamptz) ASC NULLS LAST,
                t.created_at DESC
       LIMIT 300
    `),
    db.execute<{ id: string; nome: string }>(sql`
      SELECT DISTINCT u.id::text, u.nome
        FROM tarefas t
        JOIN usuarios u ON u.id = t.usuario_id
       WHERE t.organizacao_id = ${orgId}::uuid
       ORDER BY u.nome
    `),
    // Os cartões contam a tabela inteira, não a página carregada. Derivar o
    // resumo da lista truncada fazia "concluídas no mês" ficar em zero logo
    // depois de concluir uma: a linha saía da janela de 300 e sumia da conta.
    db.execute<{
      abertas: number; atrasadas: number; vencem_hoje: number;
      concluidas_mes: number; sem_dono: number;
    }>(sql`
      SELECT
        COUNT(*) FILTER (WHERE status NOT IN ('concluida','declinada'))::int AS abertas,
        COUNT(*) FILTER (
          WHERE status NOT IN ('concluida','declinada')
            AND COALESCE(vence_em::date, data_vencimento) < CURRENT_DATE
        )::int AS atrasadas,
        COUNT(*) FILTER (
          WHERE status NOT IN ('concluida','declinada')
            AND COALESCE(vence_em::date, data_vencimento) = CURRENT_DATE
        )::int AS vencem_hoje,
        COUNT(*) FILTER (
          WHERE concluida_em >= date_trunc('month', CURRENT_DATE)
        )::int AS concluidas_mes,
        COUNT(*) FILTER (
          WHERE status NOT IN ('concluida','declinada') AND usuario_id IS NULL
        )::int AS sem_dono
      FROM tarefas
     WHERE organizacao_id = ${orgId}::uuid
    `),
  ]);

  const atividades: Atividade[] = linhas.map((l) => {
    const venc = l.vence_em ? new Date(l.vence_em) : l.data_vencimento ? new Date(`${l.data_vencimento}T12:00:00`) : null;
    const prazo = textoPrazo(venc, hoje, l.concluida);
    const criada = new Date(l.created_at);

    return {
      id: l.id,
      titulo: l.titulo,
      descricao: l.descricao || "",
      tipo: l.tipo,
      jornada: JORNADA_POR_ORIGEM[l.origem] ?? "Manual",
      prioridade: PRIORIDADE[l.prioridade] ?? "media",
      status: statusDe(l.status, l.concluida),
      grupoPrazo: grupoPrazoDe(venc, hoje),
      responsavel: l.responsavel,
      responsavelIniciais: l.responsavel ? iniciais(l.responsavel) : null,
      vencimento: venc ? venc.toISOString().slice(0, 10) : null,
      vencimentoTexto: dataLonga(venc),
      diasAteVencimento: diasAte(venc, hoje),
      prazoTexto: prazo.texto,
      prazoTom: prazo.tom,
      vinculo: vinculoDe(l),
      criadaEm: dataLonga(criada),
      concluidaEm: l.concluida_em ? dataLonga(new Date(l.concluida_em)) : null,
      // `origem` conta se a atividade nasceu da mão de alguém ou de uma régua.
      automatica: l.origem !== "MANUAL",
    };
  });

  const t = totais[0];
  const resumo: ResumoAtividades = {
    abertas: t?.abertas ?? 0,
    atrasadas: t?.atrasadas ?? 0,
    vencemHoje: t?.vencem_hoje ?? 0,
    concluidasNoMes: t?.concluidas_mes ?? 0,
    semResponsavel: t?.sem_dono ?? 0,
  };

  const jornadas = [...new Set(atividades.map((a) => a.jornada))].sort();
  const filtrosJornada: OpcaoFiltro[] = [
    { valor: "todas", label: "Todas as jornadas" },
    ...jornadas.map((j) => ({ valor: j, label: j })),
  ];

  const filtrosResponsavel: OpcaoFiltro[] = [
    { valor: "todos", label: "Todos os responsáveis" },
    { valor: "sem-dono", label: "Sem responsável" },
    ...responsaveis.map((r) => ({ valor: r.nome, label: r.nome })),
  ];

  const colunas: ColunaKanban[] = [
    { chave: "a_fazer", label: "A fazer", apoio: "Ainda não começou" },
    { chave: "em_andamento", label: "Em andamento", apoio: "Alguém está tocando" },
    { chave: "aguardando", label: "Aguardando retorno", apoio: "Depende de terceiro" },
    { chave: "concluida", label: "Concluídas", apoio: "Fechadas" },
    { chave: "declinada", label: "Declinadas", apoio: "Não vai acontecer" },
  ];

  // A tabela agrupa por prazo porque é assim que a operação lê a fila: o que
  // estourou, o que é hoje, o que é desta semana, o resto.
  const grupos: GrupoTabela[] = [
    { chave: "atrasada", label: "Atrasadas", apoio: "Passaram do vencimento" },
    { chave: "hoje", label: "Hoje", apoio: "Vencem hoje" },
    { chave: "semana", label: "Próximos 7 dias", apoio: "Esta semana" },
    { chave: "breve", label: "Em breve", apoio: "Depois desta semana" },
    { chave: "sem-data", label: "Sem data", apoio: "Ninguém marcou prazo" },
  ];

  return {
    titulo: "Atividades",
    subtitulo: "Tudo que a operação precisa fazer, em um lugar só.",
    resumo,
    atividades,
    colunas,
    grupos,
    filtrosJornada,
    filtrosResponsavel,
    filtrosVencimento: [
      { valor: "todas", label: "Qualquer data" },
      { valor: "atrasadas", label: "Atrasadas" },
      { valor: "hoje", label: "Vencem hoje" },
      { valor: "semana", label: "Próximos 7 dias" },
      { valor: "sem-data", label: "Sem data" },
    ],
  };
}

/** Empresas para o vínculo da nova atividade.
 * O fluxo é empresa primeiro, pessoa depois: no ONFACE quem entra em
 * pré-vendas é a empresa, e a pessoa é o contato dentro dela. */
export async function buscarEmpresas(orgId: string, termo: string, limite = 20) {
  const like = `%${termo.trim()}%`;
  return db.execute<{ id: string; nome: string; apoio: string | null; ehCliente: boolean }>(sql`
    SELECT e.id::text, e.nome,
           e.setor AS apoio,
           EXISTS (
             SELECT 1 FROM servicos_canonicos sc
              WHERE sc.empresa_id = e.id
                AND sc.commercial_lifecycle = 'ACTIVE'
           ) AS "ehCliente"
      FROM empresas e
     WHERE e.organizacao_id = ${orgId}::uuid
       -- A base tem nome com espaço solto, "?" e "." vindos de importação
       -- antiga. Escolher empresa numa lista dessas é impossível, então o
       -- lixo fica fora do seletor (continua no cadastro, não some do banco).
       AND length(TRIM(e.nome)) > 2
       AND (${termo.trim() === ""} OR e.nome ILIKE ${like})
     ORDER BY TRIM(e.nome)
     LIMIT ${limite}
  `);
}

/** Contatos de uma empresa. Pode ser lead de pré-vendas ou contato de conta
 * ativa: o que muda é o estágio da empresa, não o cadastro da pessoa. */
export async function buscarContatos(orgId: string, empresaId: string, limite = 30) {
  return db.execute<{ id: string; nome: string; cargo: string | null; email: string | null }>(sql`
    SELECT l.id::text,
           TRIM(CONCAT(l.nome, ' ', COALESCE(l.sobrenome, ''))) AS nome,
           l.cargo, l.email
      FROM leads l
     WHERE l.organizacao_id = ${orgId}::uuid
       AND l.empresa_id = ${empresaId}::uuid
     ORDER BY l.nome
     LIMIT ${limite}
  `);
}

/** Negócios abertos da empresa, para amarrar a atividade à oportunidade certa. */
export async function buscarNegociosDaEmpresa(orgId: string, empresaId: string, limite = 20) {
  return db.execute<{ id: string; titulo: string; status: string }>(sql`
    SELECT n.id::text, n.titulo, n.status
      FROM negocios n
     WHERE n.organizacao_id = ${orgId}::uuid
       AND n.empresa_id = ${empresaId}::uuid
       AND n.status NOT IN ('ganho','perdido')
     ORDER BY n.created_at DESC
     LIMIT ${limite}
  `);
}
