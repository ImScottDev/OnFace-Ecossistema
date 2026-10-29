import { sql, type SQL } from "drizzle-orm";

/**
 * "Esta pessoa é desta empresa" é UM critério só, para toda consulta que lista
 * ou conta gente de uma empresa.
 *
 * Pessoa pode estar em mais de uma empresa: o vínculo mora em
 * `pessoa_empresa_vinculos`, e `pessoas.empresa_id` guarda apenas a PRINCIPAL
 * (e o legado de quem nasceu antes da tabela). Quem lia só por `empresa_id` não
 * enxergava quem foi adicionada como secundária: em 29/10/2026, Mateus Santana
 * foi vinculado ao Instituto Dra Suelen, a ficha continuou mostrando "Pessoas
 * vinculadas" vazia, e a trava de duplicata — que já lia as duas fontes —
 * recusou o novo cadastro dizendo que ele já estava lá. Mesmo fato, duas
 * leituras.
 */
export const pessoaDaEmpresa = (alias: "p" | "p2", empresa: SQL) => sql`(${sql.raw(alias)}.empresa_id = ${empresa}
  OR EXISTS (SELECT 1 FROM pessoa_empresa_vinculos pev
              WHERE pev.pessoa_id = ${sql.raw(alias)}.id AND pev.empresa_id = ${empresa} AND pev.encerrado_em IS NULL))`;
