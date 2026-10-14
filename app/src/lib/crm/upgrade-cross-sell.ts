/**
 * Upgrade, downgrade, cross-sell e renovação: regras PURAS (sem `db`, as telas e os testes importam).
 * Modelo: `docs/produto/upgrade-e-cross-sell.md`; decisões do dono em `docs/operacao/matriz-jornada-comercial.md`, cenário 8.
 *
 *  - CROSS-SELL e EXPANSÃO: SOMAM. Serviço novo ao lado do que existe; nada do que havia é tocado.
 *  - UPGRADE e DOWNGRADE: o serviço canônico passa a refletir o que o cliente tem HOJE, e o que ele tinha
 *    vira histórico (`SUPERSEDED`, que a carteira, o CS e as métricas já excluem por filtrarem `ACTIVE`).
 *    Nunca por heurística de valor: só pelo vínculo declarado na venda (`servico_origem_id`), pelo contrato
 *    base ou por haver UM candidato inequívoco. Na dúvida, soma e avisa (ver `motivo`).
 *  - RENOVAÇÃO: não cria serviço, onboarding nem recebível. O que o cliente tem continua o mesmo.
 */

export type EfeitoDaVenda = "SOMA" | "RENOVACAO" | "UPGRADE" | "DOWNGRADE";

/** Tipo que o vendedor escolheu ao abrir a oportunidade (gravado em `negocios.campos_custom.tipo_venda`). */
export const TIPOS_DE_VENDA = ["expansao", "upgrade", "downgrade", "crosssell", "renovacao"] as const;
export type TipoDeVendaGravado = (typeof TIPOS_DE_VENDA)[number];

export function efeitoDaVenda(v: { motion: string | null; tipoVenda: string | null; tipoContratual: string | null }): EfeitoDaVenda {
  // O documento da proposta é o que o cliente assinou: fala mais alto que a intenção do vendedor na abertura.
  if (v.tipoContratual === "UPGRADE" || v.tipoContratual === "DOWNGRADE" || v.tipoContratual === "RENOVACAO") {
    return v.tipoContratual === "RENOVACAO" ? "RENOVACAO" : v.tipoContratual;
  }
  if (v.tipoVenda === "upgrade") return "UPGRADE";
  if (v.tipoVenda === "downgrade") return "DOWNGRADE";
  if (v.tipoVenda === "renovacao" || v.motion === "RENEWAL") return "RENOVACAO";
  return "SOMA";
}

export interface ServicoCandidato {
  id: string;
  canonicalProduct: string | null;
  contratoId: string | null;
}

export type MotivoSubstituicao = "origem_declarada" | "contrato_base" | "candidato_unico" | "mesmo_produto" | "ambiguo" | "nenhum";

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/**
 * Qual(is) serviço(s) ATIVO(S) de mesma família e natureza recorrente o upgrade/downgrade encerra.
 * `candidatos` já vem filtrado (mesma empresa, mesma família, MRR, ACTIVE) e SEM os serviços recém-criados.
 */
export function servicosSubstituidos(p: {
  origemId: string | null;
  contratoBaseId: string | null;
  produtosNovos: (string | null)[];
  candidatos: ServicoCandidato[];
}): { ids: string[]; motivo: MotivoSubstituicao } {
  const { candidatos } = p;
  if (candidatos.length === 0) return { ids: [], motivo: "nenhum" };
  if (p.origemId && candidatos.some((c) => c.id === p.origemId)) return { ids: [p.origemId], motivo: "origem_declarada" };

  const doContrato = p.contratoBaseId ? candidatos.filter((c) => c.contratoId === p.contratoBaseId) : [];
  const pool = doContrato.length > 0 ? doContrato : candidatos;
  const viaContrato = doContrato.length > 0;
  if (pool.length === 1) return { ids: [pool[0].id], motivo: viaContrato ? "contrato_base" : "candidato_unico" };

  const produtos = new Set(p.produtosNovos.map(norm).filter(Boolean));
  const mesmos = pool.filter((c) => produtos.has(norm(c.canonicalProduct)));
  if (mesmos.length > 0) return { ids: mesmos.map((c) => c.id), motivo: "mesmo_produto" };
  return { ids: [], motivo: "ambiguo" };
}

/**
 * Renovação: o item não vira serviço novo quando o cliente já tem serviço ATIVO da família.
 * Devolve o serviço que a renovação cobre (mesmo produto; senão o primeiro da família) ou null se a família
 * está vazia (aí não há o que renovar e o item é materializado normalmente).
 */
export function servicoRenovado(produto: string | null, ativosDaFamilia: ServicoCandidato[]): string | null {
  if (ativosDaFamilia.length === 0) return null;
  const igual = ativosDaFamilia.find((c) => norm(c.canonicalProduct) === norm(produto) && norm(produto) !== "");
  return (igual ?? ativosDaFamilia[0]).id;
}
