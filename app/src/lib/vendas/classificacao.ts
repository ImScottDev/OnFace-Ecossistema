/**
 * Classificação de relacionamento: Cliente, Lead, Prospect, Contato.
 *
 * REGRA: docs/produto/classificacao-relacionamento.md. Esta é a ÚNICA função que
 * decide a classe de uma pessoa ou de uma empresa; lista de Contatos, fichas,
 * Cliente 360, drawers, busca e NEXO leem daqui e não derivam por conta própria.
 *
 * `classificar` é pura (testável). `fatosDeLeads` / `fatosDeEmpresas` leem os
 * fatos no banco em lote, e `classificarLeads` / `classificarEmpresas` juntam as duas.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { MOTIVOS_DESQUALIFICACAO, MOTIVOS_NUTRICAO, MOTIVOS_PERDA } from "./dominio";

import type { Classe } from "./classificacao-rotulos";
export { ROTULO_CLASSE, type Classe } from "./classificacao-rotulos";

export interface FatosDeClassificacao {
  /** Conta com serviço ativo (da pessoa ou da empresa dela). */
  servicoAtivo: boolean;
  /** Aquisição ABERTA em Pré-vendas (novo, em contato, qualificação, qualificado; não encerrada). */
  aquisicaoAberta: boolean;
  /** Etapa de Pré-vendas aberta, para o texto do estágio. */
  etapaAberta?: string | null;
  /** Oportunidade aberta no Pipeline (não ganha, não perdida). */
  oportunidadeAberta: boolean;
  nutricao: boolean;
  desqualificado: boolean;
  /** Perdido no Pipeline (e sem nada vivo). */
  perdido: boolean;
  /** `leads.prospeccao_estado`: entrou em Prospecção (outbound). */
  prospeccaoEstado?: string | null;
  /** Chave do motivo (desqualificação, nutrição ou perda). */
  motivo?: string | null;
}

export interface Classificacao { classe: Classe; motivo: string | null; estagio: string | null }

const ETAPA_ROTULO: Record<string, string> = {
  novo: "Novo", em_contato: "Em contato", qualificacao: "Qualificação", qualificado: "Qualificado",
};

function rotuloDeMotivo(chave: string | null | undefined): string | null {
  if (!chave) return null;
  for (const cat of [MOTIVOS_DESQUALIFICACAO, MOTIVOS_NUTRICAO, MOTIVOS_PERDA]) {
    const m = (cat as ReadonlyArray<{ chave: string; rotulo: string }>).find((x) => x.chave === chave);
    if (m) return m.rotulo;
  }
  return chave;
}

/**
 * Precedência: Cliente vence tudo; depois o que está VIVO (aquisição aberta ou
 * oportunidade aberta) é Lead; nutrição e desqualificado são Contato com motivo
 * (vencem Prospecção: quem foi descartado não volta a ser prospect porque a lista
 * de outbound o cita); Prospecção; perdido é Contato com motivo; o resto é avulso.
 */
export function classificar(f: FatosDeClassificacao): Classificacao {
  if (f.servicoAtivo) return { classe: "cliente", motivo: null, estagio: "Cliente ativo" };
  if (f.oportunidadeAberta) return { classe: "lead", motivo: null, estagio: "Pipeline" };
  if (f.aquisicaoAberta) {
    return { classe: "lead", motivo: null, estagio: `Pré-vendas${f.etapaAberta ? ` · ${ETAPA_ROTULO[f.etapaAberta] ?? f.etapaAberta}` : ""}` };
  }
  if (f.nutricao) return { classe: "contato", motivo: rotuloDeMotivo(f.motivo), estagio: "Nutrição" };
  if (f.desqualificado) return { classe: "contato", motivo: rotuloDeMotivo(f.motivo), estagio: "Desqualificado" };
  if (f.prospeccaoEstado && f.prospeccaoEstado !== "descartado") return { classe: "prospect", motivo: null, estagio: "Prospecção" };
  if (f.perdido) return { classe: "contato", motivo: rotuloDeMotivo(f.motivo), estagio: "Perdido" };
  return { classe: "contato", motivo: null, estagio: null };
}

const ETAPAS_ABERTAS_PV = "('novo','em_contato','qualificacao','qualificado')";
const OPP_ABERTA = "('entrada','diagnostico','proposta','negociacao')";

/**
 * Fragmento SQL dos fatos de UM lead (aliases `l` = leads, `aq` = aquisicoes,
 * `pe` = pipeline_etapas da aquisição, `emp` = id da empresa do lead). Exportado
 * para a lista de Contatos, que classifica 500 linhas numa consulta só.
 */
export const FATOS_DO_LEAD_SQL = sql.raw(`
  COALESCE(pe.codigo, l.estagio_pre_vendas) AS etapa_pv,
  (aq.id IS NULL OR aq.closed_at IS NULL) AND COALESCE(pe.codigo, l.estagio_pre_vendas) IN ${ETAPAS_ABERTAS_PV} AS aquisicao_aberta,
  COALESCE(pe.codigo, l.estagio_pre_vendas) = 'nutricao' AS nutricao,
  COALESCE(pe.codigo, l.estagio_pre_vendas) = 'desqualificado' AS desqualificado,
  EXISTS (SELECT 1 FROM negocios n WHERE n.lead_id = l.id AND n.etapa IN ${OPP_ABERTA}) AS opp_aberta,
  EXISTS (SELECT 1 FROM negocios n WHERE n.lead_id = l.id AND n.etapa = 'perdido') AS perdido,
  EXISTS (SELECT 1 FROM servicos_canonicos s WHERE s.empresa_id = COALESCE(emp.id, l.empresa_id) AND s.commercial_lifecycle = 'ACTIVE') AS serv_ativo,
  l.prospeccao_estado,
  COALESCE(l.desqualificacao_motivo, l.nutricao_motivo,
    (SELECT n.motivo_perda FROM negocios n WHERE n.lead_id = l.id AND n.etapa = 'perdido' ORDER BY n.updated_at DESC LIMIT 1)) AS motivo`);

export type LinhaDeFatos = {
  etapa_pv: string | null; aquisicao_aberta: boolean | null; nutricao: boolean | null; desqualificado: boolean | null;
  opp_aberta: boolean | null; perdido: boolean | null; serv_ativo: boolean | null;
  prospeccao_estado: string | null; motivo: string | null;
};

export function fatosDaLinha(r: LinhaDeFatos): FatosDeClassificacao {
  return {
    servicoAtivo: !!r.serv_ativo, aquisicaoAberta: !!r.aquisicao_aberta,
    etapaAberta: r.aquisicao_aberta ? r.etapa_pv : null,
    oportunidadeAberta: !!r.opp_aberta, nutricao: !!r.nutricao, desqualificado: !!r.desqualificado,
    perdido: !!r.perdido, prospeccaoEstado: r.prospeccao_estado, motivo: r.motivo,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const literal = (ids: string[]) => `{${ids.filter((i) => UUID.test(i)).join(",")}}`;

/** Classe de vários leads/pessoas de uma vez (chave = id do lead). */
export async function classificarLeads(organizacaoId: string, leadIds: string[]): Promise<Map<string, Classificacao>> {
  const out = new Map<string, Classificacao>();
  if (!leadIds.length) return out;
  const linhas = await db.execute<LinhaDeFatos & { id: string }>(sql`
    SELECT l.id::text, ${FATOS_DO_LEAD_SQL}
      FROM leads l
      LEFT JOIN aquisicoes aq ON aq.lead_legado_id = l.id
      LEFT JOIN pipeline_etapas pe ON pe.id = aq.etapa_id
      LEFT JOIN empresas emp ON emp.id = l.empresa_id
     WHERE l.organizacao_id = ${organizacaoId}::uuid AND l.id = ANY(${literal(leadIds)}::uuid[])`);
  for (const r of linhas) out.set(r.id, classificar(fatosDaLinha(r)));
  return out;
}

/**
 * Classe de várias empresas (chave = id da empresa). Vale o que está vivo na
 * conta inteira: qualquer aquisição aberta ou oportunidade aberta de qualquer pessoa dela.
 */
export async function classificarEmpresas(organizacaoId: string, empresaIds: string[]): Promise<Map<string, Classificacao>> {
  const out = new Map<string, Classificacao>();
  if (!empresaIds.length) return out;
  const linhas = await db.execute<{ id: string } & LinhaDeFatos>(sql`
    SELECT e.id::text,
      (SELECT x.etapa FROM (
         SELECT COALESCE(pe.codigo, l.estagio_pre_vendas) AS etapa
           FROM leads l LEFT JOIN aquisicoes aq ON aq.lead_legado_id = l.id LEFT JOIN pipeline_etapas pe ON pe.id = aq.etapa_id
          WHERE l.empresa_id = e.id AND (aq.id IS NULL OR aq.closed_at IS NULL)
            AND COALESCE(pe.codigo, l.estagio_pre_vendas) IN ${sql.raw(ETAPAS_ABERTAS_PV)} LIMIT 1) x) AS etapa_pv,
      EXISTS (SELECT 1 FROM leads l LEFT JOIN aquisicoes aq ON aq.lead_legado_id = l.id LEFT JOIN pipeline_etapas pe ON pe.id = aq.etapa_id
               WHERE l.empresa_id = e.id AND (aq.id IS NULL OR aq.closed_at IS NULL)
                 AND COALESCE(pe.codigo, l.estagio_pre_vendas) IN ${sql.raw(ETAPAS_ABERTAS_PV)}) AS aquisicao_aberta,
      EXISTS (SELECT 1 FROM leads l LEFT JOIN aquisicoes aq ON aq.lead_legado_id = l.id LEFT JOIN pipeline_etapas pe ON pe.id = aq.etapa_id
               WHERE l.empresa_id = e.id AND COALESCE(pe.codigo, l.estagio_pre_vendas) = 'nutricao') AS nutricao,
      EXISTS (SELECT 1 FROM leads l LEFT JOIN aquisicoes aq ON aq.lead_legado_id = l.id LEFT JOIN pipeline_etapas pe ON pe.id = aq.etapa_id
               WHERE l.empresa_id = e.id AND COALESCE(pe.codigo, l.estagio_pre_vendas) = 'desqualificado') AS desqualificado,
      EXISTS (SELECT 1 FROM negocios n WHERE n.empresa_id = e.id AND n.etapa IN ${sql.raw(OPP_ABERTA)}) AS opp_aberta,
      EXISTS (SELECT 1 FROM negocios n WHERE n.empresa_id = e.id AND n.etapa = 'perdido') AS perdido,
      EXISTS (SELECT 1 FROM servicos_canonicos s WHERE s.empresa_id = e.id AND s.commercial_lifecycle = 'ACTIVE') AS serv_ativo,
      (SELECT l.prospeccao_estado FROM leads l WHERE l.empresa_id = e.id AND l.prospeccao_estado IS NOT NULL AND l.prospeccao_estado <> 'descartado' LIMIT 1) AS prospeccao_estado,
      COALESCE((SELECT l.desqualificacao_motivo FROM leads l WHERE l.empresa_id = e.id AND l.desqualificacao_motivo IS NOT NULL LIMIT 1),
               (SELECT l.nutricao_motivo FROM leads l WHERE l.empresa_id = e.id AND l.nutricao_motivo IS NOT NULL LIMIT 1),
               (SELECT n.motivo_perda FROM negocios n WHERE n.empresa_id = e.id AND n.etapa = 'perdido' ORDER BY n.updated_at DESC LIMIT 1)) AS motivo
      FROM empresas e
     WHERE e.organizacao_id = ${organizacaoId}::uuid AND e.id = ANY(${literal(empresaIds)}::uuid[])`);
  for (const r of linhas) out.set(r.id, classificar(fatosDaLinha(r)));
  return out;
}
