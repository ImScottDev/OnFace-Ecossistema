import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { MOTIVOS_DESQUALIFICACAO, MOTIVOS_NUTRICAO, MOTIVOS_PERDA } from "@/lib/vendas/dominio";
import { classificar, fatosDaLinha, FATOS_DO_LEAD_SQL, type Classe, type LinhaDeFatos } from "@/lib/vendas/classificacao";

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
  /** Quando o registro entrou na base. Sem interação, é ele que ordena a lista:
   *  o registro novo aparece no topo em vez de sumir sob o corte de 500. */
  criadoEm: string | null;
  /** Motivo de saída: desqualificação, nutrição ou perda do negócio. Sempre
   *  que o relacionamento é "contato", é isto que explica o porquê. */
  motivo: { chave: string; rotulo: string; detalhe: string | null } | null;
  /** cliente | lead | prospect | contato, derivado no banco. */
  relacionamento: Relacionamento;
  /** Estágio que explica a classe (ex.: "Pré-vendas · Novo", "Nutrição"). */
  estagioDaClasse: string | null;
  /** Negócios abertos ligados ao lead desta pessoa. */
  negocios: Array<{ titulo: string; etapa: string }>;
  /** Negócios abertos da EMPRESA inteira — é o que o painel de empresa lista. */
  empresaNegocios: Array<{ titulo: string; etapa: string }>;
}

/** Empresa cadastrada que nenhuma pessoa da lista aponta: sem esta linha ela não existia na tela. */
export interface EmpresaSemPessoas {
  empresaId: string;
  nome: string;
  setor: string | null;
  cidade: string | null;
  dominio: string | null;
  telefone: string | null;
  origem: string | null;
  criadoEm: string;
  relEmpresa: NonNullable<LinhaContato["relEmpresa"]>;
  negocios: Array<{ titulo: string; etapa: string }>;
}

export interface TotaisContatos { pessoas: number; empresas: number }

/** Contagem por relacionamento sobre a BASE INTEIRA, não sobre a página. */
export type PorRelacionamento = Record<Relacionamento, number>;
export type Relacionamento = Classe;

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

/* A classe (cliente, lead, prospect, contato) vem de `lib/vendas/classificacao.ts`,
 * a função única da regra (docs/produto/classificacao-relacionamento.md). */

export async function linhasDeContato(organizacaoId: string, opcoes: { busca?: string | null; limite?: number } = {}): Promise<{
  linhas: LinhaContato[]; empresasSemPessoas: EmpresaSemPessoas[]; totais: TotaisContatos; porRelacionamento: PorRelacionamento;
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
    ultima: string | null; criado_em: string | null; negocios: Array<{ titulo: string; etapa: string }> | null;
    emp_negocios: Array<{ titulo: string; etapa: string }> | null;
    serv_hist: boolean | null; emp_opps: number | null; emp_lead_ativo: boolean | null;
    motivo_chave: string | null; motivo_detalhe: string | null;
  } & LinhaDeFatos>(sql`
    WITH ident AS (
      SELECT p.id, 'pessoa'::text AS fonte, p.lead_id_legado AS lead_id,
             NULLIF(trim((CASE WHEN COALESCE(trim(p.sobrenome),'')='' THEN trim(p.nome) WHEN lower(trim(p.sobrenome))=lower(trim(p.nome)) OR lower(trim(p.sobrenome)) LIKE lower(trim(p.nome))||' %' THEN trim(p.sobrenome) WHEN lower(trim(p.nome)) LIKE '% '||lower(trim(p.sobrenome)) THEN trim(p.nome) ELSE trim(p.nome)||' '||trim(p.sobrenome) END)), '') AS nome,
             COALESCE(p.cargo, l.cargo) AS cargo,
             COALESCE(p.email, l.email) AS email,
             COALESCE(p.telefone, l.telefone) AS telefone,
             COALESCE(p.whatsapp, l.whatsapp) AS whatsapp,
             COALESCE(p.empresa_id, l.empresa_id) AS empresa_id,
             l.empresa AS empresa_texto, p.created_at AS criado
        FROM pessoas p
        LEFT JOIN leads l ON l.id = p.lead_id_legado
       WHERE p.organizacao_id = ${organizacaoId}::uuid
      UNION ALL
      SELECT l.id, 'lead', l.id,
             NULLIF(trim((CASE WHEN COALESCE(trim(l.sobrenome),'')='' THEN trim(l.nome) WHEN lower(trim(l.sobrenome))=lower(trim(l.nome)) OR lower(trim(l.sobrenome)) LIKE lower(trim(l.nome))||' %' THEN trim(l.sobrenome) WHEN lower(trim(l.nome)) LIKE '% '||lower(trim(l.sobrenome)) THEN trim(l.nome) ELSE trim(l.nome)||' '||trim(l.sobrenome) END)), ''),
             l.cargo, l.email, l.telefone, l.whatsapp, l.empresa_id, l.empresa, l.created_at
        FROM leads l
       WHERE l.organizacao_id = ${organizacaoId}::uuid
         AND NOT EXISTS (SELECT 1 FROM pessoas p WHERE p.lead_id_legado = l.id)
    ), ult AS (
      -- Última atividade por lead agregada UMA vez. A subconsulta correlata por
      -- linha varria atividades 4 mil vezes antes do LIMIT (7s medido).
      SELECT a.lead_id, max(a.created_at) AS ts, max(a.created_at)::text AS ultima
        FROM atividades a WHERE a.lead_id IS NOT NULL GROUP BY a.lead_id
    ), base AS (
      SELECT i.*, COALESCE(e.nome, i.empresa_texto) AS empresa,
             e.setor, e.cidade, e.estado, e.dominio,
             l.origem, l.utm_campaign AS campanha, u.nome AS responsavel, l.estagio_pre_vendas AS estagio,
             l.desqualificacao_motivo, l.desqualificacao_detalhe,
             l.nutricao_motivo, ul.ultima, ul.ts AS ultima_ts,
             ${FATOS_DO_LEAD_SQL}
        FROM ident i
        LEFT JOIN empresas e ON e.id = i.empresa_id
        LEFT JOIN empresas emp ON emp.id = i.empresa_id
        LEFT JOIN leads l ON l.id = i.lead_id
        LEFT JOIN aquisicoes aq ON aq.lead_legado_id = l.id
        LEFT JOIN pipeline_etapas pe ON pe.id = aq.etapa_id
        LEFT JOIN usuarios u ON u.id = l.responsavel_id
        LEFT JOIN ult ul ON ul.lead_id = i.lead_id
       WHERE ${busca}::text IS NULL
          OR lower(COALESCE(i.nome, '')) LIKE ${busca}
          OR lower(COALESCE(i.email, '')) LIKE ${busca}
          OR regexp_replace(COALESCE(i.telefone, ''), '\\D', '', 'g') LIKE ${busca}
          OR lower(COALESCE(e.nome, i.empresa_texto, '')) LIKE ${busca}
       ORDER BY COALESCE(ul.ts, i.criado) DESC, nome
       LIMIT ${limite}
    ), linha AS (
    SELECT b.id::text, b.fonte, b.lead_id::text, b.nome, b.cargo, b.email, b.telefone, b.whatsapp,
           b.empresa_id::text, b.empresa, b.setor, b.cidade, b.estado, b.dominio,
           COALESCE(b.origem, (SELECT t.source FROM pontos_contato t WHERE b.fonte = 'pessoa' AND t.pessoa_id = b.id ORDER BY t.ocorrido_em DESC LIMIT 1)) AS origem,
           b.campanha, b.responsavel, b.estagio, b.ultima, b.criado::text AS criado_em, COALESCE(b.ultima_ts, b.criado) AS ordem_ts,
           (SELECT json_agg(json_build_object('titulo', n.titulo, 'etapa', n.etapa))
              FROM negocios n WHERE n.lead_id = b.lead_id AND n.etapa IN ${ETAPAS_ABERTAS}) AS negocios,
           b.etapa_pv, b.aquisicao_aberta, b.nutricao, b.desqualificado, b.opp_aberta, b.perdido, b.serv_ativo, b.motivo,
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
           b.opp_aberta AS tem_negocio_aberto
      FROM base b
    )
    SELECT linha.*
      FROM linha
     ORDER BY ordem_ts DESC, nome
  `);

  /* Contagem do FILTRO: sobre a base inteira, não sobre a página. Contar o
     array carregado dizia "Cliente 29" com 500 linhas na mão e 4.084 no banco. */
  const contagens = await db.execute<LinhaDeFatos & { n: number }>(sql`
    WITH ident AS (
      SELECT p.id, p.lead_id_legado AS lead_id, COALESCE(p.empresa_id, l.empresa_id) AS empresa_id
        FROM pessoas p LEFT JOIN leads l ON l.id = p.lead_id_legado
       WHERE p.organizacao_id = ${organizacaoId}::uuid
      UNION ALL
      SELECT l.id, l.id, l.empresa_id FROM leads l
       WHERE l.organizacao_id = ${organizacaoId}::uuid
         AND NOT EXISTS (SELECT 1 FROM pessoas p WHERE p.lead_id_legado = l.id)
    )
    SELECT x.*, count(*)::int AS n FROM (
      SELECT ${FATOS_DO_LEAD_SQL}
        FROM ident i
        LEFT JOIN leads l ON l.id = i.lead_id
        LEFT JOIN empresas emp ON emp.id = i.empresa_id
        LEFT JOIN aquisicoes aq ON aq.lead_legado_id = l.id
        LEFT JOIN pipeline_etapas pe ON pe.id = aq.etapa_id
    ) x GROUP BY 1,2,3,4,5,6,7,8,9`);

  const porRelacionamento: PorRelacionamento = { cliente: 0, lead: 0, prospect: 0, contato: 0 };
  for (const c of contagens) porRelacionamento[classificar(fatosDaLinha(c)).classe] += c.n;

  const [totais] = await db.execute<{ pessoas: number; empresas: number }>(sql`
    SELECT (SELECT count(*)::int FROM pessoas WHERE organizacao_id = ${organizacaoId}::uuid)
         + (SELECT count(*)::int FROM leads l WHERE l.organizacao_id = ${organizacaoId}::uuid
              AND NOT EXISTS (SELECT 1 FROM pessoas p WHERE p.lead_id_legado = l.id)) AS pessoas,
           (SELECT count(*)::int FROM empresas WHERE organizacao_id = ${organizacaoId}::uuid) AS empresas
  `);

  /* Empresas que nenhuma linha acima carrega (cadastradas sem pessoa): a lista
     nasce de pessoas e leads, então elas ficavam invisíveis. Mesma regra de
     "quem aponta para a empresa" do `ident` acima. */
  const semPessoas = await db.execute<{
    id: string; nome: string; setor: string | null; cidade: string | null; estado: string | null; dominio: string | null;
    telefone: string | null; origem: string | null; criado_em: string; serv_ativo: boolean; serv_hist: boolean;
    opps: number; negocios: Array<{ titulo: string; etapa: string }> | null;
  }>(sql`
    SELECT e.id::text, e.nome, e.setor, e.cidade, e.estado, e.dominio, e.telefone, e.created_at::text AS criado_em,
           (SELECT t.source FROM pontos_contato t WHERE t.empresa_id = e.id ORDER BY t.ocorrido_em DESC LIMIT 1) AS origem,
           EXISTS (SELECT 1 FROM servicos_canonicos s WHERE s.empresa_id = e.id AND s.commercial_lifecycle = 'ACTIVE') AS serv_ativo,
           EXISTS (SELECT 1 FROM servicos_canonicos s WHERE s.empresa_id = e.id) AS serv_hist,
           (SELECT count(*)::int FROM negocios n WHERE n.empresa_id = e.id AND n.etapa IN ${ETAPAS_ABERTAS}) AS opps,
           (SELECT json_agg(json_build_object('titulo', n.titulo, 'etapa', n.etapa))
              FROM negocios n WHERE n.empresa_id = e.id AND n.etapa IN ${ETAPAS_ABERTAS}) AS negocios
      FROM empresas e
     WHERE e.organizacao_id = ${organizacaoId}::uuid
       AND NOT EXISTS (SELECT 1 FROM pessoas p LEFT JOIN leads l ON l.id = p.lead_id_legado
                        WHERE p.organizacao_id = ${organizacaoId}::uuid AND COALESCE(p.empresa_id, l.empresa_id) = e.id)
       AND NOT EXISTS (SELECT 1 FROM leads l WHERE l.organizacao_id = ${organizacaoId}::uuid AND l.empresa_id = e.id
                        AND NOT EXISTS (SELECT 1 FROM pessoas p WHERE p.lead_id_legado = l.id))
       AND (${busca}::text IS NULL OR lower(e.nome) LIKE ${busca} OR lower(COALESCE(e.dominio, '')) LIKE ${busca})
     ORDER BY e.created_at DESC
     LIMIT ${limite}
  `);

  return {
    empresasSemPessoas: semPessoas.map((e) => ({
      empresaId: e.id, nome: e.nome, setor: e.setor,
      cidade: e.cidade ? [e.cidade, e.estado].filter(Boolean).join(" / ") : null,
      dominio: e.dominio, telefone: e.telefone, origem: e.origem?.trim() || null, criadoEm: e.criado_em,
      relEmpresa: e.serv_ativo ? "cliente" : e.opps > 0 ? "em_oportunidade" : e.serv_hist ? "ex_cliente" : "cadastrada",
      negocios: e.negocios ?? [],
    })),
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
      relacionamento: classificar(fatosDaLinha(l)).classe,
      estagioDaClasse: classificar(fatosDaLinha(l)).estagio,
      motivo: l.motivo_chave ? { chave: l.motivo_chave, rotulo: rotuloDeMotivo(l.motivo_chave), detalhe: l.motivo_detalhe } : null,
      ultimaInteracao: l.ultima,
      criadoEm: l.criado_em,
      negocios: l.negocios ?? [],
      empresaNegocios: l.emp_negocios ?? [],
    })),
    totais: { pessoas: totais?.pessoas ?? 0, empresas: totais?.empresas ?? 0 },
    porRelacionamento,
  };
}
