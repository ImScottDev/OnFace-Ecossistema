import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { MOTIVOS_DESQUALIFICACAO, MOTIVOS_NUTRICAO, MOTIVOS_PERDA } from "@/lib/vendas/dominio";

/* ─────────────────────────────────────────────────────────────────────────
 * Contatos — a consulta da tela do handoff.
 *
 * Arquivo PRÓPRIO de propósito: `diretorioPessoas` (consultas.ts) é
 * compartilhado e não traz o que a tela do protótipo mostra por linha —
 * origem, campanha, responsável, última interação, negócios abertos e o
 * relacionamento derivado. Em vez de engordar a consulta de todo mundo, esta
 * devolve exatamente a linha que o adaptador precisa.
 *
 * Mesma regra de identidade do diretório: lê `pessoas` (modelo novo) e os
 * `leads` que ainda não viraram pessoa, sem duplicar.
 * ───────────────────────────────────────────────────────────────────────── */

export interface LinhaContato {
  /** id da pessoa, ou do lead quando a identidade ainda mora no legado. */
  id: string;
  fonte: "pessoa" | "lead";
  leadId: string | null;
  nome: string;
  cargo: string | null;
  email: string | null;
  telefone: string | null;
  whatsapp: string | null;
  empresaId: string | null;
  empresa: string | null;
  empresaSetor: string | null;
  empresaCidade: string | null;
  empresaDominio: string | null;
  /** Relacionamento derivado da EMPRESA (mesma precedência de diretorioEmpresas). */
  relEmpresa: "cliente" | "em_oportunidade" | "em_pre_vendas" | "ex_cliente" | "cadastrada" | null;
  empresaOppsAbertas: number;
  origem: string | null;
  campanha: string | null;
  responsavel: string | null;
  estagio: string | null;
  ultimaInteracao: string | null;
  /** Motivo de saída: desqualificação, nutrição ou perda do negócio. Sempre
   *  que o relacionamento é "contato", é isto que explica o porquê. */
  motivo: { chave: string; rotulo: string; detalhe: string | null } | null;
  /** cliente | lead | prospect | contato, derivado no banco. */
  relacionamento: Relacionamento;
  /** Negócios abertos ligados ao lead desta pessoa. */
  negocios: Array<{ titulo: string; etapa: string }>;
  /** Negócios abertos da EMPRESA inteira — é o que o painel de empresa lista. */
  empresaNegocios: Array<{ titulo: string; etapa: string }>;
}

export interface TotaisContatos { pessoas: number; empresas: number }

/** Contagem por relacionamento sobre a BASE INTEIRA, não sobre a página. */
export type PorRelacionamento = Record<Relacionamento, number>;
export type Relacionamento = "cliente" | "lead" | "prospect" | "contato";

const ETAPAS_ABERTAS = sql`('entrada','diagnostico','proposta','negociacao')`;

/** Chave crua ("sem_fit") não serve numa tela nem num export: vira o rótulo do
 *  catálogo do domínio, e só cai no texto cru quando a chave é desconhecida. */
function rotuloDeMotivo(chave: string): string {
  for (const cat of [MOTIVOS_DESQUALIFICACAO, MOTIVOS_NUTRICAO, MOTIVOS_PERDA]) {
    const m = (cat as ReadonlyArray<{ chave: string; rotulo: string }>).find((x) => x.chave === chave);
    if (m) return m.rotulo;
  }
  return chave;
}

/* Relacionamento no vocabulário do Scott (06/10):
 *   cliente  — tem serviço ativo;
 *   prospect — está em PROSPECÇÃO e ainda não entrou em jornada comercial;
 *   lead     — está em jornada comercial, em Pré-vendas ou no Pipeline;
 *   contato  — só contato: perdido, desqualificado ou em nutrição.
 * A ordem importa: desqualificado/nutrição ganha de prospecção (quem foi
 * descartado não volta a ser prospect só porque a lista de outbound o cita), e
 * negócio aberto ganha de tudo que não seja serviço ativo.
 * `prospeccao_estado` já existe na base (78 leads); o código antigo dizia que
 * "Prospect não é derivável" e por isso o filtro mostrava zero. */
const REL_SQL = sql`
  CASE
    WHEN serv_ativo THEN 'cliente'
    WHEN estagio IN ('desqualificado','nutricao') THEN 'contato'
    WHEN prospeccao_estado IS NOT NULL AND NOT tem_negocio_aberto THEN 'prospect'
    WHEN tem_negocio_aberto
      OR estagio IN ('novo','em_contato','qualificacao','qualificado','oportunidade') THEN 'lead'
    ELSE 'contato'
  END`;

export async function linhasDeContato(organizacaoId: string, opcoes: { busca?: string | null; limite?: number } = {}): Promise<{
  linhas: LinhaContato[]; totais: TotaisContatos; porRelacionamento: PorRelacionamento;
}> {
  const busca = opcoes.busca?.trim() ? `%${opcoes.busca.trim().toLowerCase()}%` : null;
  /* A LISTA continua limitada: carregar as 4.084 pessoas levava o DOM a 99.645
     nós e 4 s de load. Quem conta o filtro é `porRelacionamento`, agregado no
     banco logo abaixo — a tela não precisa ter a base na mão para dizer quantos
     clientes existem. */
  const limite = opcoes.limite ?? 500;

  /* As duas metades resolvem a pessoa primeiro (identidade + lead) e só depois
     penduram empresa e fatos em subconsultas correlatas. Nada de OR em JOIN —
     travou o Postgres do CRM uma vez. */
  const linhas = await db.execute<{
    id: string; fonte: string; lead_id: string | null; nome: string | null; cargo: string | null;
    email: string | null; telefone: string | null; whatsapp: string | null;
    empresa_id: string | null; empresa: string | null; setor: string | null; cidade: string | null; estado: string | null; dominio: string | null;
    origem: string | null; campanha: string | null; responsavel: string | null; estagio: string | null;
    ultima: string | null; negocios: Array<{ titulo: string; etapa: string }> | null;
    emp_negocios: Array<{ titulo: string; etapa: string }> | null;
    serv_ativo: boolean | null; serv_hist: boolean | null; emp_opps: number | null; emp_lead_ativo: boolean | null;
    prospeccao_estado: string | null; tem_negocio_aberto: boolean | null; relacionamento: string;
    motivo_chave: string | null; motivo_detalhe: string | null;
  }>(sql`
    WITH ident AS (
      SELECT p.id, 'pessoa'::text AS fonte, p.lead_id_legado AS lead_id,
             NULLIF(trim((CASE WHEN COALESCE(trim(p.sobrenome),'')='' THEN trim(p.nome) WHEN lower(trim(p.sobrenome))=lower(trim(p.nome)) OR lower(trim(p.sobrenome)) LIKE lower(trim(p.nome))||' %' THEN trim(p.sobrenome) WHEN lower(trim(p.nome)) LIKE '% '||lower(trim(p.sobrenome)) THEN trim(p.nome) ELSE trim(p.nome)||' '||trim(p.sobrenome) END)), '') AS nome,
             COALESCE(p.cargo, l.cargo) AS cargo,
             COALESCE(p.email, l.email) AS email,
             COALESCE(p.telefone, l.telefone) AS telefone,
             COALESCE(p.whatsapp, l.whatsapp) AS whatsapp,
             COALESCE(p.empresa_id, l.empresa_id) AS empresa_id,
             l.empresa AS empresa_texto
        FROM pessoas p
        LEFT JOIN leads l ON l.id = p.lead_id_legado
       WHERE p.organizacao_id = ${organizacaoId}::uuid
      UNION ALL
      SELECT l.id, 'lead', l.id,
             NULLIF(trim((CASE WHEN COALESCE(trim(l.sobrenome),'')='' THEN trim(l.nome) WHEN lower(trim(l.sobrenome))=lower(trim(l.nome)) OR lower(trim(l.sobrenome)) LIKE lower(trim(l.nome))||' %' THEN trim(l.sobrenome) WHEN lower(trim(l.nome)) LIKE '% '||lower(trim(l.sobrenome)) THEN trim(l.nome) ELSE trim(l.nome)||' '||trim(l.sobrenome) END)), ''),
             l.cargo, l.email, l.telefone, l.whatsapp, l.empresa_id, l.empresa
        FROM leads l
       WHERE l.organizacao_id = ${organizacaoId}::uuid
         AND NOT EXISTS (SELECT 1 FROM pessoas p WHERE p.lead_id_legado = l.id)
    ), ult AS (
      -- Última atividade por lead agregada UMA vez. A subconsulta correlata por
      -- linha varria atividades 4 mil vezes antes do LIMIT (7s medido).
      SELECT a.lead_id, max(a.created_at)::text AS ultima
        FROM atividades a WHERE a.lead_id IS NOT NULL GROUP BY a.lead_id
    ), base AS (
      SELECT i.*, COALESCE(e.nome, i.empresa_texto) AS empresa,
             e.setor, e.cidade, e.estado, e.dominio,
             l.origem, l.utm_campaign AS campanha, u.nome AS responsavel, l.estagio_pre_vendas AS estagio,
             l.prospeccao_estado, l.desqualificacao_motivo, l.desqualificacao_detalhe,
             l.nutricao_motivo, ul.ultima
        FROM ident i
        LEFT JOIN empresas e ON e.id = i.empresa_id
        LEFT JOIN leads l ON l.id = i.lead_id
        LEFT JOIN usuarios u ON u.id = l.responsavel_id
        LEFT JOIN ult ul ON ul.lead_id = i.lead_id
       WHERE ${busca}::text IS NULL
          OR lower(COALESCE(i.nome, '')) LIKE ${busca}
          OR lower(COALESCE(i.email, '')) LIKE ${busca}
          OR regexp_replace(COALESCE(i.telefone, ''), '\\D', '', 'g') LIKE ${busca}
          OR lower(COALESCE(e.nome, i.empresa_texto, '')) LIKE ${busca}
       ORDER BY ultima DESC NULLS LAST, nome
       LIMIT ${limite}
    ), linha AS (
    SELECT b.id::text, b.fonte, b.lead_id::text, b.nome, b.cargo, b.email, b.telefone, b.whatsapp,
           b.empresa_id::text, b.empresa, b.setor, b.cidade, b.estado, b.dominio,
           b.origem, b.campanha, b.responsavel, b.estagio, b.ultima,
           (SELECT json_agg(json_build_object('titulo', n.titulo, 'etapa', n.etapa))
              FROM negocios n WHERE n.lead_id = b.lead_id AND n.etapa IN ${ETAPAS_ABERTAS}) AS negocios,
           EXISTS (SELECT 1 FROM servicos_canonicos s WHERE s.empresa_id = b.empresa_id AND s.commercial_lifecycle = 'ACTIVE') AS serv_ativo,
           EXISTS (SELECT 1 FROM servicos_canonicos s WHERE s.empresa_id = b.empresa_id) AS serv_hist,
           (SELECT count(*)::int FROM negocios n WHERE n.empresa_id = b.empresa_id AND n.etapa IN ${ETAPAS_ABERTAS}) AS emp_opps,
           (SELECT json_agg(json_build_object('titulo', n.titulo, 'etapa', n.etapa))
              FROM negocios n WHERE n.empresa_id = b.empresa_id AND n.etapa IN ${ETAPAS_ABERTAS}) AS emp_negocios,
           EXISTS (SELECT 1 FROM leads l2 WHERE l2.empresa_id = b.empresa_id
                    AND l2.estagio_pre_vendas IN ('novo','em_contato','qualificacao','qualificado')) AS emp_lead_ativo,
           b.prospeccao_estado,
           COALESCE(b.desqualificacao_motivo, b.nutricao_motivo,
             (SELECT n.motivo_perda FROM negocios n
               WHERE n.lead_id = b.lead_id AND n.etapa = 'perdido'
               ORDER BY n.updated_at DESC LIMIT 1)) AS motivo_chave,
           COALESCE(b.desqualificacao_detalhe,
             (SELECT n.motivo_perda_detalhe FROM negocios n
               WHERE n.lead_id = b.lead_id AND n.etapa = 'perdido'
               ORDER BY n.updated_at DESC LIMIT 1)) AS motivo_detalhe,
           EXISTS (SELECT 1 FROM negocios n WHERE n.lead_id = b.lead_id AND n.etapa IN ${ETAPAS_ABERTAS}) AS tem_negocio_aberto
      FROM base b
    )
    SELECT linha.*, ${REL_SQL} AS relacionamento
      FROM linha
     ORDER BY ultima DESC NULLS LAST, nome
  `);

  /* Contagem do FILTRO: sobre a base inteira, não sobre a página. Contar o
     array carregado dizia "Cliente 29" com 500 linhas na mão e 4.084 no banco. */
  const contagens = await db.execute<{ relacionamento: string; n: number }>(sql`
    WITH ident AS (
      SELECT p.id, p.lead_id_legado AS lead_id, COALESCE(p.empresa_id, l.empresa_id) AS empresa_id
        FROM pessoas p LEFT JOIN leads l ON l.id = p.lead_id_legado
       WHERE p.organizacao_id = ${organizacaoId}::uuid
      UNION ALL
      SELECT l.id, l.id, l.empresa_id FROM leads l
       WHERE l.organizacao_id = ${organizacaoId}::uuid
         AND NOT EXISTS (SELECT 1 FROM pessoas p WHERE p.lead_id_legado = l.id)
    ), fatos AS (
      SELECT EXISTS (SELECT 1 FROM servicos_canonicos s
                      WHERE s.empresa_id = i.empresa_id AND s.commercial_lifecycle = 'ACTIVE') AS serv_ativo,
             l.estagio_pre_vendas AS estagio, l.prospeccao_estado,
             EXISTS (SELECT 1 FROM negocios n WHERE n.lead_id = i.lead_id AND n.etapa IN ${ETAPAS_ABERTAS}) AS tem_negocio_aberto
        FROM ident i LEFT JOIN leads l ON l.id = i.lead_id
    )
    SELECT ${REL_SQL} AS relacionamento, count(*)::int AS n FROM fatos GROUP BY 1`);

  const porRelacionamento: PorRelacionamento = { cliente: 0, lead: 0, prospect: 0, contato: 0 };
  for (const c of contagens) porRelacionamento[c.relacionamento as Relacionamento] = c.n;

  const [totais] = await db.execute<{ pessoas: number; empresas: number }>(sql`
    SELECT (SELECT count(*)::int FROM pessoas WHERE organizacao_id = ${organizacaoId}::uuid)
         + (SELECT count(*)::int FROM leads l WHERE l.organizacao_id = ${organizacaoId}::uuid
              AND NOT EXISTS (SELECT 1 FROM pessoas p WHERE p.lead_id_legado = l.id)) AS pessoas,
           (SELECT count(*)::int FROM empresas WHERE organizacao_id = ${organizacaoId}::uuid) AS empresas
  `);

  return {
    linhas: linhas.map((l) => ({
      id: l.id,
      fonte: l.fonte as "pessoa" | "lead",
      leadId: l.lead_id,
      nome: l.nome ?? "Sem nome",
      cargo: l.cargo,
      email: l.email,
      telefone: l.telefone,
      whatsapp: l.whatsapp,
      empresaId: l.empresa_id,
      empresa: l.empresa?.trim() || null,
      empresaSetor: l.setor,
      empresaCidade: l.cidade ? [l.cidade, l.estado].filter(Boolean).join(" / ") : null,
      empresaDominio: l.dominio,
      relEmpresa: !l.empresa_id ? null
        : l.serv_ativo ? "cliente"
        : (l.emp_opps ?? 0) > 0 ? "em_oportunidade"
        : l.emp_lead_ativo ? "em_pre_vendas"
        : l.serv_hist ? "ex_cliente"
        : "cadastrada",
      empresaOppsAbertas: l.emp_opps ?? 0,
      origem: l.origem?.trim() || null,
      campanha: l.campanha?.trim() || null,
      responsavel: l.responsavel,
      estagio: l.estagio,
      relacionamento: l.relacionamento as Relacionamento,
      motivo: l.motivo_chave ? { chave: l.motivo_chave, rotulo: rotuloDeMotivo(l.motivo_chave), detalhe: l.motivo_detalhe } : null,
      ultimaInteracao: l.ultima,
      negocios: l.negocios ?? [],
      empresaNegocios: l.emp_negocios ?? [],
    })),
    totais: { pessoas: totais?.pessoas ?? 0, empresas: totais?.empresas ?? 0 },
    porRelacionamento,
  };
}
