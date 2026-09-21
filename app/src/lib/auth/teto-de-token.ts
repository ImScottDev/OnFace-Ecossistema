/**
 * Teto de escopo de um token de API (SPEC §31).
 *
 * Vive fora da rota por um motivo concreto: enquanto a regra era uma linha
 * dentro do handler, o único teste possível era procurar texto no arquivo — e
 * esse teste passou com a regra REMOVIDA, porque a chamada que ele procurava
 * continuava lá. Regra de segurança precisa de teste que execute a regra.
 *
 * O princípio é o mesmo do agente de IA: delegação é teto, nunca piso. Quem cria
 * uma credencial não pode dar a ela poder que o próprio papel não tem, senão a
 * tela de tokens vira o caminho curto para contornar o RBAC inteiro — e a
 * auditoria ainda mostraria a chamada vindo de "um token", não da pessoa.
 */
import type { CodigoPermissao } from "./permissoes";

/** Escopos que um token pode carregar. Configuração não entra: um token não configura o sistema. */
export const ESCOPOS_DE_TOKEN: CodigoPermissao[] = [
  "companies.read", "companies.write",
  "acquisition.read", "acquisition.manage",
  "sales.read", "sales.manage",
  "finance.read", "finance.manage",
  "cs.read", "cs.manage",
];

export type ResultadoTeto =
  | { ok: true; escopos: CodigoPermissao[] }
  | { ok: false; codigo: "DESCONHECIDO" | "ACIMA_DO_TETO"; itens: string[] };

/**
 * Decide se os escopos pedidos podem virar token nas mãos de quem pede.
 *
 * Escopo inexistente e escopo acima do teto são respostas DIFERENTES de
 * propósito: a primeira é erro de quem chama, a segunda é decisão de permissão,
 * e quem recebe precisa saber se corrige o pedido ou pede acesso.
 */
export function aplicarTetoDeToken(
  pedidos: readonly string[],
  minhas: ReadonlySet<CodigoPermissao>,
): ResultadoTeto {
  const desconhecidos = pedidos.filter((e) => !ESCOPOS_DE_TOKEN.includes(e as CodigoPermissao));
  if (desconhecidos.length) return { ok: false, codigo: "DESCONHECIDO", itens: desconhecidos };

  const acima = pedidos.filter((e) => !minhas.has(e as CodigoPermissao));
  if (acima.length) return { ok: false, codigo: "ACIMA_DO_TETO", itens: acima };

  // Sem duplicata: escopo repetido no pedido não vira escopo repetido no banco.
  return { ok: true, escopos: [...new Set(pedidos)] as CodigoPermissao[] };
}
