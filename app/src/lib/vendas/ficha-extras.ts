/**
 * O que as fichas de Pessoa e de Empresa mostram e que não vem de `detalheLead`
 * nem de `empresa360`: cadência viva, empresas extras da pessoa, arquivos e os
 * campos de enriquecimento da empresa.
 *
 * Cada item aqui existe porque a ficha guardava o dado num store local da tela
 * (some ao recarregar) e o botão avisava que gravava. A leitura mora numa
 * consulta própria para não crescer `consultas.ts`; a escrita está em
 * `app/(produto)/contatos/actions.ts`. As duas pontas falam das mesmas tabelas,
 * então editar numa tela aparece em todas.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { textoSimples } from "./texto";
import { ROTULO_ETAPA_PIPELINE, ROTULO_ETAPA_PRE_VENDAS, type EstagioPreVendas, type EtapaPipeline } from "./dominio";
import { emailNormalizado, mesmaPessoa, telefoneDeIdentidade, type IdentidadeDoLead } from "./mesma-pessoa";

export interface CadenciaDoLead {
  /** Nome da cadência (definição) em que o lead está inscrito. */
  nome: string;
  pausada: boolean;
}

/** A inscrição viva (ativa ou pausada) do lead, ou null. */
export async function cadenciaDoLead(organizacaoId: string, leadId: string): Promise<CadenciaDoLead | null> {
  const [r] = await db.execute<{ nome: string; status: string }>(sql`
    SELECT cd.nome, ce.status
      FROM cadence_enrollments ce
      JOIN cadence_definitions cd ON cd.id = ce.cadence_definition_id
     WHERE ce.organizacao_id = ${organizacaoId}::uuid AND ce.entity_type = 'lead'
       AND ce.entity_id = ${leadId}::uuid AND ce.status IN ('active', 'waiting', 'waiting_reply', 'paused')
     ORDER BY ce.started_at DESC LIMIT 1`);
  return r ? { nome: r.nome, pausada: r.status === "paused" } : null;
}

export interface EmpresaExtraDaPessoa { empresaId: string; nome: string; papel: string }

/**
 * As OUTRAS empresas a que a pessoa está vinculada (vínculo aberto), fora a
 * principal do lead. A pessoa canônica é a espelhada pelo lead (`lead_id_legado`).
 */
export async function empresasExtrasDaPessoa(organizacaoId: string, leadId: string): Promise<EmpresaExtraDaPessoa[]> {
  const linhas = await db.execute<{ empresa_id: string; nome: string; papel: string; cargo: string | null }>(sql`
    SELECT v.empresa_id::text, e.nome, v.papel, v.cargo
      FROM pessoas p
      JOIN pessoa_empresa_vinculos v ON v.pessoa_id = p.id AND v.encerrado_em IS NULL
      JOIN empresas e ON e.id = v.empresa_id
      JOIN leads l ON l.id = p.lead_id_legado
     WHERE p.organizacao_id = ${organizacaoId}::uuid AND l.id = ${leadId}::uuid
       AND v.empresa_id IS DISTINCT FROM l.empresa_id
     ORDER BY v.created_at`);
  return linhas.map((l) => ({ empresaId: l.empresa_id, nome: l.nome, papel: l.cargo || ROTULO_PAPEL[l.papel] || "Vinculada" }));
}

const ROTULO_PAPEL: Record<string, string> = {
  contato_principal: "Contato principal", decisor: "Decisor", influenciador: "Influenciador",
  financeiro: "Financeiro", tecnico: "Técnico", usuario: "Usuário", outro: "Vinculada",
};

export interface ArquivoDaEmpresa { id: string; nome: string; mime: string; bytes: number; em: string }

/** Os arquivos enviados para a empresa (acervo canônico, vínculo `empresa`). */
export async function arquivosDaEmpresa(organizacaoId: string, empresaId: string): Promise<ArquivoDaEmpresa[]> {
  const linhas = await db.execute<{ id: string; nome: string; mime: string; bytes: string; em: string }>(sql`
    SELECT fo.id::text, fo.nome_original AS nome, fo.mime_type AS mime, fo.tamanho_bytes::text AS bytes, fl.created_at::text AS em
      FROM file_links fl
      JOIN file_objects fo ON fo.id = fl.file_object_id AND fo.deleted_at IS NULL
     WHERE fl.organizacao_id = ${organizacaoId}::uuid AND fl.entity_type = 'empresa'
       AND fl.entity_id = ${empresaId}::uuid AND fl.papel = 'arquivo'
     ORDER BY fl.created_at DESC LIMIT 100`);
  return linhas.map((l) => ({ id: l.id, nome: l.nome, mime: l.mime, bytes: Number(l.bytes), em: l.em }));
}

export interface EnriquecimentoDaEmpresa {
  funcionarios: string | null; faturamento: string | null; linkedin: string | null; tecnologias: string | null;
  /** Veio do Apollo (a empresa tem `apollo_id`/`enriched_at`); sem isto os valores são digitados. */
  deApollo: boolean;
}

/** Campos do card "Dados da empresa" que a ficha de `empresa360` não traz. */
export async function enriquecimentoDaEmpresa(organizacaoId: string, empresaId: string): Promise<EnriquecimentoDaEmpresa> {
  const [e] = await db.execute<{ funcionarios: string | null; faturamento: string | null; linkedin: string | null; tecnologias: string | null; deApollo: boolean }>(sql`
    SELECT coalesce(nullif(campos_custom->>'funcionarios', ''), employee_count::text) AS funcionarios,
           annual_revenue AS faturamento, linkedin,
           nullif(campos_custom->>'tecnologias', '') AS tecnologias,
           (apollo_id IS NOT NULL OR enriched_at IS NOT NULL) AS "deApollo"
      FROM empresas WHERE id = ${empresaId}::uuid AND organizacao_id = ${organizacaoId}::uuid`);
  return e ?? { funcionarios: null, faturamento: null, linkedin: null, tecnologias: null, deApollo: false };
}

export interface TarefaDoLead {
  id: string; titulo: string; tipo: string | null; status: string;
  descricao: string | null; venceEm: string | null; responsavel: string | null;
}

/**
 * As atividades do lead: a tabela `tarefas` (a mesma de /tarefas e da peça de
 * Atividade). É a mesma consulta de `detalheOportunidade`, trocando o vínculo
 * de negócio por lead; a próxima ação do cartão (`proximaAcaoLateral`) sai
 * daqui também, então a lista e o cartão nunca discordam.
 */
export async function tarefasDoLead(organizacaoId: string, leadId: string): Promise<TarefaDoLead[]> {
  const linhas = await db.execute<{
    id: string; titulo: string; tipo: string | null; status: string; descricao: string | null; vence_em: string | null; responsavel: string | null;
  }>(sql`
    SELECT t.id::text, t.titulo, t.tipo, t.status, t.descricao,
           COALESCE(t.vence_em, t.data_vencimento)::text AS vence_em, u.nome AS responsavel
      FROM tarefas t LEFT JOIN usuarios u ON u.id = t.usuario_id
     WHERE t.lead_id = ${leadId}::uuid AND t.organizacao_id = ${organizacaoId}::uuid
     ORDER BY (t.status IN ('concluida','declinada')), COALESCE(t.vence_em, t.data_vencimento) NULLS LAST, t.created_at DESC
     LIMIT 100`);
  return linhas.map((t) => ({
    id: t.id, titulo: t.titulo, tipo: t.tipo, status: t.status, descricao: textoSimples(t.descricao),
    venceEm: t.vence_em, responsavel: t.responsavel,
  }));
}

export interface NotaDoLead { id: string; texto: string; autor: string | null; em: string }

/** Notas do lead (`notas.lead_id`): as mesmas que a ficha da Pessoa lê por /api/notas. */
export async function notasDoLead(organizacaoId: string, leadId: string): Promise<NotaDoLead[]> {
  const linhas = await db.execute<{ id: string; texto: string | null; autor: string | null; em: string }>(sql`
    SELECT n.id::text, COALESCE(n.conteudo, n.conteudo_raw) AS texto,
           COALESCE(u.nome, n.autor_display_name) AS autor, n.created_at::text AS em
      FROM notas n LEFT JOIN usuarios u ON u.id = n.autor_id
     WHERE n.lead_id = ${leadId}::uuid AND n.organizacao_id = ${organizacaoId}::uuid
     ORDER BY n.created_at DESC LIMIT 100`);
  return linhas.map((n) => ({ id: n.id, texto: textoSimples(n.texto) ?? "", autor: n.autor, em: n.em }));
}

/* ── Aquisições da PESSOA ──────────────────────────────────────────────── */

export interface AquisicaoDaPessoa {
  id: string;
  etapa: string;
  etapaRotulo: string;
  origem: string | null;
  criadoEm: string;
  responsavel: string | null;
  pessoa: string;
  nutricao: { motivo: string | null; desde: string | null; retomarEm: string | null } | null;
}
export interface OportunidadeDaPessoa { id: string; titulo: string; etapa: string; etapaRotulo: string; familia: string | null }

/**
 * Todas as aquisições (e as oportunidades delas) da pessoa que a ficha mostra.
 *
 * Modelo: pessoa e lead são 1:1 (`pessoas.lead_id_legado` e
 * `aquisicoes.lead_legado_id` únicos; hoje 1 aquisição por pessoa). Mas a MESMA
 * pessoa entra mais de uma vez (36 e-mails repetidos, 52 leads ligados por
 * `canonical_lead_id`), e é isso que "todas as aquisições dela" tem de cobrir.
 * A consulta traz os candidatos por e-mail, telefone e vínculo canônico; quem
 * decide se são a mesma pessoa é `mesmaPessoa` (telefone sozinho não basta).
 *
 * A etapa é a do BOARD (gravada na aquisição, com o legado só refinando
 * "qualificacao"), e a nutrição traz motivo e a data em que entrou.
 */
export async function relacoesDaPessoa(organizacaoId: string, leadId: string): Promise<{
  aquisicoes: AquisicaoDaPessoa[]; oportunidades: OportunidadeDaPessoa[];
}> {
  const [eu] = await db.execute<{
    id: string; nome: string; email: string | null; telefone: string | null; whatsapp: string | null;
    canonical: string | null; pessoa_id: string | null;
  }>(sql`
    SELECT l.id::text, l.nome, l.email, l.telefone, l.whatsapp, l.canonical_lead_id::text AS canonical, p.id::text AS pessoa_id
      FROM leads l LEFT JOIN pessoas p ON p.lead_id_legado = l.id
     WHERE l.id = ${leadId}::uuid AND l.organizacao_id = ${organizacaoId}::uuid`);
  if (!eu) return { aquisicoes: [], oportunidades: [] };

  type Candidato = {
    id: string; nome: string; sobrenome: string | null; email: string | null; telefone: string | null; whatsapp: string | null;
    canonical: string | null; pessoa_id: string | null; etapa: string; origem: string | null; criado_em: string;
    responsavel: string | null; nutricao_motivo: string | null; nutrido_em: string | null; retomar_em: string | null;
    tem_processo: boolean;
  };
  const identidade = (c: Candidato): IdentidadeDoLead => ({
    id: c.id, pessoaId: c.pessoa_id, canonicalLeadId: c.canonical, nome: c.nome, email: c.email, telefones: [c.telefone, c.whatsapp],
  });
  const literal = (v: string[]) => `{${v.map((x) => `"${x.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",")}}`;

  /* A pessoa é o fecho das ligações: A liga a B pelo e-mail e B liga a D pelo telefone, então
     D também é dela. Cada volta traz os candidatos das identidades já achadas, até não crescer
     (no máximo 3 voltas: um grupo de duplicatas não passa disso). */
  let procura: IdentidadeDoLead[] = [{ id: eu.id, pessoaId: eu.pessoa_id, canonicalLeadId: eu.canonical, nome: eu.nome, email: eu.email, telefones: [eu.telefone, eu.whatsapp] }];
  const achados = new Map<string, Candidato>();
  for (let volta = 0; volta < 3 && procura.length; volta++) {
    const emails = [...new Set(procura.map((p) => emailNormalizado(p.email)).filter((x): x is string => !!x))];
    /* Superset por SQL (últimos 10 dígitos); o veredito é de `mesmaPessoa`. */
    const fones = [...new Set(procura.flatMap((p) => p.telefones ?? []).map(telefoneDeIdentidade).filter((x): x is string => !!x).map((d) => d.slice(-10)))];
    const idsDaVolta = procura.map((p) => p.id);
    const canons = [...new Set(procura.map((p) => p.canonicalLeadId).filter((x): x is string => !!x))];
    const candidatos = await db.execute<Candidato>(sql`
      SELECT l.id::text, l.nome, l.sobrenome, l.email, l.telefone, l.whatsapp, l.canonical_lead_id::text AS canonical, p.id::text AS pessoa_id,
             CASE WHEN l.estagio_pre_vendas = 'qualificacao' THEN 'qualificacao'
                  ELSE COALESCE(pe.codigo, l.estagio_pre_vendas, 'novo') END AS etapa,
             (a.id IS NOT NULL OR l.estagio_pre_vendas IS NOT NULL) AS tem_processo,
             COALESCE(a.origem, l.origem) AS origem, l.created_at::text AS criado_em, u.nome AS responsavel,
             COALESCE(NULLIF(a.nutricao_status, 'em_nutricao'), l.nutricao_motivo) AS nutricao_motivo,
             COALESCE(l.nutrido_em, (SELECT max(sc.created_at) FROM status_changes sc
                                      WHERE sc.lead_id = l.id AND sc.para_status = 'nutricao'))::text AS nutrido_em,
             COALESCE(l.nutricao_retomar_em::text, (a.retomar_em AT TIME ZONE 'America/Sao_Paulo')::date::text) AS retomar_em
        FROM leads l
        LEFT JOIN pessoas p ON p.lead_id_legado = l.id
        LEFT JOIN aquisicoes a ON a.lead_legado_id = l.id
        LEFT JOIN pipeline_etapas pe ON pe.id = a.etapa_id
        LEFT JOIN usuarios u ON u.id = l.responsavel_id
       WHERE l.organizacao_id = ${organizacaoId}::uuid
         AND (l.id = ANY(${literal(idsDaVolta)}::uuid[])
           OR l.canonical_lead_id = ANY(${literal(idsDaVolta)}::uuid[])
           OR l.id = ANY(${literal(canons)}::uuid[])
           OR l.canonical_lead_id = ANY(${literal(canons)}::uuid[])
           OR lower(trim(l.email)) = ANY(${literal(emails)}::text[])
           OR right(regexp_replace(coalesce(l.telefone, ''), '[^0-9]', '', 'g'), 10) = ANY(${literal(fones)}::text[])
           OR right(regexp_replace(coalesce(l.whatsapp, ''), '[^0-9]', '', 'g'), 10) = ANY(${literal(fones)}::text[]))
       ORDER BY l.created_at DESC
       LIMIT 60`);
    const novos = candidatos.filter((c) => !achados.has(c.id) && (c.id === eu.id || procura.some((p) => mesmaPessoa(p, identidade(c)))));
    for (const c of novos) achados.set(c.id, c);
    procura = novos.map(identidade);
  }
  const meus = [...achados.values()].sort((a, b) => b.criado_em.localeCompare(a.criado_em));

  // Contato avulso (registro sem etapa e sem aquisição) é identidade, não processo: não é relação em andamento.
  const aquisicoes: AquisicaoDaPessoa[] = meus.filter((c) => c.tem_processo).map((c) => ({
    id: c.id, etapa: c.etapa, etapaRotulo: ROTULO_ETAPA_PRE_VENDAS[c.etapa as EstagioPreVendas] ?? c.etapa,
    origem: c.origem, criadoEm: c.criado_em, responsavel: c.responsavel,
    pessoa: [c.nome, c.sobrenome].filter(Boolean).join(" "),
    nutricao: c.etapa === "nutricao" ? { motivo: c.nutricao_motivo, desde: c.nutrido_em, retomarEm: c.retomar_em } : null,
  }));

  const ids = meus.map((c) => c.id);
  if (!ids.length) return { aquisicoes, oportunidades: [] };
  const oportunidades = await db.execute<{ id: string; titulo: string; etapa: string | null; familia: string | null }>(sql`
    SELECT DISTINCT ON (COALESCE(o.negocio_id_legado, o.id)) COALESCE(o.negocio_id_legado, o.id)::text AS id, o.titulo, o.etapa, o.service_family AS familia
      FROM oportunidades o
     WHERE o.organizacao_id = ${organizacaoId}::uuid
       AND (o.lead_id = ANY(${`{${ids.join(",")}}`}::uuid[])
         OR o.negocio_id_legado IN (SELECT id FROM negocios WHERE lead_id = ANY(${`{${ids.join(",")}}`}::uuid[])))
       AND COALESCE(o.stage, '') <> 'ativo'
     ORDER BY COALESCE(o.negocio_id_legado, o.id), o.created_at DESC`);
  return {
    aquisicoes,
    oportunidades: oportunidades.map((o) => ({
      id: o.id, titulo: o.titulo, etapa: o.etapa ?? "entrada",
      etapaRotulo: ROTULO_ETAPA_PIPELINE[(o.etapa ?? "entrada") as EtapaPipeline] ?? o.etapa ?? "",
      familia: o.familia,
    })),
  };
}
