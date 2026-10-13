/**
 * MRR OFICIAL: a UMA consulta que toda tela usa (Fase 3.1).
 *
 * Regra do Scott (06/10): MRR = o faturado com natureza MRR na última competência
 * fechada de `cliente_receita_mensal` + a assinatura ativa de cliente que ainda não
 * tem linha MRR nessa competência. Setup, avulso, uso e débito recuperado ficam fora
 * porque a natureza deles não é MRR (ver `receita_setup`, `receita_avulsa`, `receita_uso`).
 *
 * Existiam seis cópias deste SQL (catálogo, Financeiro, Carteira, tela de CS, carteira
 * em risco e Cliente 360). Agora elas só embrulham este recorte com o filtro que cada
 * uma precisa. Mudou a regra? Muda aqui, e as seis mudam juntas.
 *
 * Colunas devolvidas: empresa_id (uuid, pode ser NULL: linha da planilha sem empresa),
 * empresa, familia ('UNKNOWN' quando sem família), origem ('fechamento' | 'assinatura'), valor.
 * Uma linha por empresa + família + origem.
 */
import { sql, type SQL } from "drizzle-orm";
import { doCrm } from "@/lib/financeiro/espelho-crm";
import { daFamilia, nomeDeTeste, semTestes, type Familia } from "@/lib/metricas/recorte";

export interface RecorteMrrOficial {
  /** Só uma família. Omitido = todas. */
  familia?: Familia;
  /** Empresas identificadas como teste ([QA...]) ficam de fora em TODAS as telas; true devolve também. */
  incluirTestes?: boolean;
  /** Só esta empresa. */
  empresaId?: string;
  /** Só as empresas deste subselect (uma coluna de ids). Ex.: sql`SELECT empresa_id FROM conta`. */
  empresas?: SQL;
}

export function mrrOficialLinhas(org: string, o: RecorteMrrOficial = {}): SQL {
  const daEmpresa = (col: string) => o.empresaId ? sql`${sql.raw(col)} = ${o.empresaId}::uuid` : sql`TRUE`;
  const dasEmpresas = (col: string) => o.empresas ? sql`${sql.raw(col)} IN (${o.empresas})` : sql`TRUE`;
  return sql`
      WITH uc AS (SELECT max(competencia) AS c FROM cliente_receita_mensal WHERE organizacao_id = ${org}::uuid)
      SELECT r.empresa_id, e.nome AS empresa,
             COALESCE(r.service_family, 'UNKNOWN') AS familia,
             'fechamento'::text AS origem, sum(r.valor)::numeric AS valor
        FROM cliente_receita_mensal r
        JOIN uc ON r.competencia = uc.c
        LEFT JOIN empresas e ON e.id = r.empresa_id
       WHERE r.organizacao_id = ${org}::uuid AND r.revenue_nature = 'MRR'
         AND ${daEmpresa("r.empresa_id")} AND ${dasEmpresas("r.empresa_id")}
         AND ${daFamilia("r.service_family", o.familia)}
         AND ${semTestes(o.incluirTestes, nomeDeTeste("COALESCE(e.nome, '')"))}
       GROUP BY r.empresa_id, e.nome, COALESCE(r.service_family, 'UNKNOWN')
      UNION ALL
      SELECT a.empresa_id, e.nome,
             COALESCE(sc.service_family, 'UNKNOWN'), 'assinatura'::text, sum(a.mrr)::numeric
        FROM assinaturas a
        JOIN empresas e ON e.id = a.empresa_id
        LEFT JOIN servicos_canonicos sc ON sc.id = a.servico_id
       WHERE a.organizacao_id = ${org}::uuid AND ${doCrm("a")} AND a.status = 'active' AND a.empresa_id IS NOT NULL
         AND ${daEmpresa("a.empresa_id")} AND ${dasEmpresas("a.empresa_id")}
         AND a.empresa_id IN (SELECT empresa_id FROM clientes WHERE organizacao_id = ${org}::uuid)
         AND NOT EXISTS (SELECT 1 FROM cliente_receita_mensal r2, uc
                          WHERE r2.organizacao_id = ${org}::uuid AND r2.empresa_id = a.empresa_id
                            AND r2.competencia = uc.c AND r2.revenue_nature = 'MRR')
         AND ${daFamilia("COALESCE(sc.service_family, 'UNKNOWN')", o.familia)}
         AND ${semTestes(o.incluirTestes, nomeDeTeste("e.nome"))}
       GROUP BY a.empresa_id, e.nome, COALESCE(sc.service_family, 'UNKNOWN')`;
}
