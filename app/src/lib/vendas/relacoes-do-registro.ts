/**
 * Relações de um registro (Pessoa ou Empresa) para o card "Relações em andamento".
 *
 * Pura, sem banco nem React. Recebe os vínculos já lidos e devolve só os que
 * pertencem ao alvo, com tipo, destino e tom. Quem LÊ e rotula (Cliente ativo x
 * ex-cliente, venda ganha, vazio verificado) é `components/onface/proto/relacoes-da-ficha.ts`.
 *
 * O arquivo nasceu como stub (commit 18cd515) com o teste ao lado já escrito e
 * nunca teve caller: o card caía sempre em "Nada em andamento".
 */

import { rotaDoLead } from "./rota-do-lead";

export interface VinculoDoRegistro {
  id: string;
  empresaId: string;
  pessoaId: string | null;
  leadId: string | null;
  k: "cliente" | "aquisicao" | "opp" | "proposta";
  titulo: string;
  sub: string;
  status: string;
  /** Padrão: verde para cliente, coral para o resto. */
  tom?: "verde" | "coral" | "azul" | "cinza";
}

export interface RelacaoDoRegistro extends VinculoDoRegistro {
  tipo: string;
  href: string;
  tom: "verde" | "coral" | "azul" | "cinza";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Destino da aquisição: a tela do lead (`/pre-vendas/[id]`). Era o drawer do
 * board (`/pre-vendas?lead=<id>`) enquanto a tela própria não existia; a rota
 * mora em `rota-do-lead.ts`, a mesma que o drawer e o protótipo usam.
 */
export const rotaDaAquisicao = rotaDoLead;

const TIPO = { cliente: "Cliente", aquisicao: "Pré-vendas", opp: "Oportunidade", proposta: "Proposta" } as const;

function href(v: VinculoDoRegistro): string {
  switch (v.k) {
    case "cliente": return `/clientes/${v.id}`;
    case "aquisicao": return rotaDaAquisicao(v.id);
    case "opp": return `/pipeline/${v.id}`;
    case "proposta": return `/propostas/${v.id}`;
  }
}

export function relacoesDoRegistro(
  vinculos: VinculoDoRegistro[],
  alvo: { empresaId: string; leadId?: string | null; pessoaId?: string | null },
): RelacaoDoRegistro[] {
  return vinculos
    // id inválido ("undefined", vazio) nunca vira URL de outra entidade
    .filter((v) => UUID.test(v.id) && v.empresaId === alvo.empresaId)
    // a mesma entidade chegando por dois caminhos vira uma relação só
    .filter((v, i, todos) => todos.findIndex((x) => x.k === v.k && x.id === v.id) === i)
    .filter((v) => {
      // aquisição é da PESSOA: a de outro contato da mesma conta não é dela
      if (v.k !== "aquisicao") return true;
      if (alvo.leadId) return v.leadId === alvo.leadId;
      if (alvo.pessoaId) return v.pessoaId === alvo.pessoaId;
      return true;
    })
    .map((v) => ({
      ...v,
      tipo: TIPO[v.k],
      href: href(v),
      tom: v.tom ?? (v.k === "cliente" ? "verde" : "coral"),
      ...(v.k === "cliente" ? { titulo: "Abrir Cliente 360", sub: [v.titulo, v.sub].filter(Boolean).join(" · ") } : {}),
    }));
}
