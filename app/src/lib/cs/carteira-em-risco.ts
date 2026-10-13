/**
 * A carteira em risco, vista de cima (Documento Mestre v0.13, Módulo 08).
 *
 * A tela `/clientes/risco` era um placeholder honesto: dizia "o módulo ainda
 * não foi construído" e listava duas dependências. As duas **já estavam
 * resolvidas** quando esta leitura foi escrita:
 *
 *   "Definir o que conta como sinal de risco" → `lib/cs/riscos` calcula 12
 *   tipos e mantém 491 riscos abertos no banco.
 *
 *   "66% do churn é pagamento recusado, a tela precisa separar os dois" → o
 *   tipo do risco já separa. Falta agrupar.
 *
 * Nada de motor novo. Isto é leitura sobre `cs_riscos`, que o sweep já
 * alimenta, com o agrupamento que a tela precisa.
 *
 * A SEPARAÇÃO É A DECISÃO CENTRAL. Fatura vencida e assinatura irregular são
 * risco de COBRANÇA: quem resolve é o Financeiro, e o cliente pode nem saber
 * que está em risco. Silêncio e falta de próxima ação são risco de
 * RELACIONAMENTO: quem resolve é o CS, ligando. Misturar os dois numa lista só
 * é o que faz o time atacar 249 "sem próxima ação" e não ver as 15 contas
 * prestes a cair por cartão recusado.
 */
import { mrrOficialLinhas } from "@/lib/metricas/mrr-oficial";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { nomeEmpresaSql } from "@/lib/vendas/texto";
import { ROTULO_RISCO, PESO_SEVERIDADE, type Severidade, type TipoRisco } from "@/lib/cs/riscos";

/** Quem resolve o risco. Não é rótulo: é roteamento de trabalho. */
export type Natureza = "cobranca" | "relacionamento" | "entrega";

const NATUREZA_DO_TIPO: Record<string, Natureza> = {
  FATURA_ATRASADA: "cobranca",
  PAGAMENTO_FALHOU: "cobranca",
  ASSINATURA_INADIMPLENTE: "cobranca",
  ENTREGA_PARADA: "entrega",
  SEM_INTERACAO: "relacionamento",
  SEM_PROXIMA_ACAO: "relacionamento",
  TAREFA_VENCIDA: "relacionamento",
  RENOVACAO_SEM_CONTATO: "relacionamento",
  PEDIDO_CANCELAMENTO: "relacionamento",
  INTENCAO_SAIDA: "relacionamento",
  NPS_BAIXO: "relacionamento",
  HEALTH_CHECK_BAIXO: "relacionamento",
};

export interface ContaEmRisco {
  empresaId: string;
  empresaNome: string;
  /** Pior severidade entre os riscos abertos da conta. */
  severidade: Severidade;
  /** Soma dos pesos: entre duas contas críticas, a com mais sinais vem antes. */
  peso: number;
  naturezas: Natureza[];
  riscos: Array<{ tipo: string; rotulo: string; severidade: Severidade; desdeDias: number | null; motivo: string | null }>;
  mrr: number;
  responsavelId: string | null;
  responsavelNome: string | null;
}

export interface CarteiraEmRisco {
  contas: ContaEmRisco[];
  /** O que a liderança lê primeiro. */
  resumo: {
    contas: number;
    porSeveridade: Record<Severidade, number>;
    /** MRR POR SEVERIDADE, nunca um total.
     *
     *  Um "MRR exposto" somando tudo daria R$ 425.619,39 — a carteira inteira —
     *  porque quase toda conta tem pelo menos um risco de ATENÇÃO aberto
     *  ("sem próxima ação" sozinho são 249). Esse número não informa nada e
     *  ainda assusta: o que decide ação é quanto está em CRÍTICO. */
    mrrPorSeveridade: Record<Severidade, number>;
    porNatureza: Record<Natureza, number>;
    /** Contas sem dono: ninguém vai agir nelas. */
    semResponsavel: number;
  };
}

interface Linha extends Record<string, unknown> {
  empresa_id: string; empresa_nome: string | null;
  tipo: string; severidade: string; motivo: string | null;
  desde_dias: number | null; mrr: string | null;
  responsavel_id: string | null; responsavel_nome: string | null;
}

export async function carteiraEmRisco(organizacaoId: string, responsavelId?: string | null): Promise<CarteiraEmRisco> {
  const linhas = await db.execute<Linha>(sql`
    SELECT r.empresa_id::text, ${nomeEmpresaSql("e.nome")} AS empresa_nome,
           r.tipo, r.severidade, r.motivo,
           extract(day FROM now() - r.aberto_em)::int AS desde_dias,
           -- MRR da conta = o oficial (mrr_atual): MRR faturado no último fechamento; sem linha no
           -- fechamento (cliente novo), a assinatura ativa. Era servicos_canonicos (contratado),
           -- que dava R$ 385 mil contra os R$ 476 mil do resto do produto.
           COALESCE(m.mrr, 0)::text AS mrr,
           r.responsavel_id::text, u.nome AS responsavel_nome
      FROM cs_riscos r
      LEFT JOIN empresas e ON e.id = r.empresa_id
      LEFT JOIN usuarios u ON u.id = r.responsavel_id
      LEFT JOIN (SELECT empresa_id, sum(valor) AS mrr
                   FROM (${mrrOficialLinhas(organizacaoId, {
                     empresas: sql`SELECT empresa_id FROM cs_riscos WHERE organizacao_id = ${organizacaoId}::uuid AND resolvido_em IS NULL`,
                   })}) o GROUP BY 1) m ON m.empresa_id = r.empresa_id
     WHERE r.organizacao_id = ${organizacaoId}::uuid
       AND r.resolvido_em IS NULL
       ${responsavelId ? sql`AND r.responsavel_id = ${responsavelId}::uuid` : sql``}
     ORDER BY r.aberto_em ASC`);

  const porEmpresa = new Map<string, ContaEmRisco>();
  for (const l of linhas) {
    const atual = porEmpresa.get(l.empresa_id) ?? {
      empresaId: l.empresa_id,
      empresaNome: l.empresa_nome ?? "Empresa sem nome",
      severidade: "ATENCAO" as Severidade,
      peso: 0, naturezas: [], riscos: [],
      mrr: Number(l.mrr ?? 0),
      responsavelId: l.responsavel_id, responsavelNome: l.responsavel_nome,
    };
    const sev = (l.severidade as Severidade) ?? "ATENCAO";
    atual.riscos.push({
      tipo: l.tipo,
      rotulo: ROTULO_RISCO[l.tipo as TipoRisco] ?? l.tipo,
      severidade: sev,
      desdeDias: l.desde_dias,
      motivo: l.motivo,
    });
    atual.peso += PESO_SEVERIDADE[sev] ?? 1;
    if ((PESO_SEVERIDADE[sev] ?? 1) > (PESO_SEVERIDADE[atual.severidade] ?? 1)) atual.severidade = sev;
    const nat = NATUREZA_DO_TIPO[l.tipo];
    // Tipo novo sem natureza declarada cai em relacionamento, que é o padrão
    // seguro: aparece para o CS em vez de sumir da tela.
    const natFinal = nat ?? "relacionamento";
    if (!atual.naturezas.includes(natFinal)) atual.naturezas.push(natFinal);
    // O responsável do risco pode vir nulo numa linha e preenchido em outra.
    if (!atual.responsavelId && l.responsavel_id) {
      atual.responsavelId = l.responsavel_id;
      atual.responsavelNome = l.responsavel_nome;
    }
    porEmpresa.set(l.empresa_id, atual);
  }

  const contas = [...porEmpresa.values()].sort((a, b) =>
    (PESO_SEVERIDADE[b.severidade] ?? 0) - (PESO_SEVERIDADE[a.severidade] ?? 0) ||
    b.mrr - a.mrr || b.peso - a.peso);

  const porSeveridade: Record<Severidade, number> = { CRITICO: 0, EM_RISCO: 0, ATENCAO: 0 };
  const mrrPorSeveridade: Record<Severidade, number> = { CRITICO: 0, EM_RISCO: 0, ATENCAO: 0 };
  const porNatureza: Record<Natureza, number> = { cobranca: 0, relacionamento: 0, entrega: 0 };
  for (const c of contas) {
    porSeveridade[c.severidade]++;
    mrrPorSeveridade[c.severidade] += c.mrr;
    // Uma conta com risco de cobrança E de relacionamento conta nos dois: são
    // dois times diferentes precisando agir nela.
    for (const n of c.naturezas) porNatureza[n]++;
  }

  return {
    contas,
    resumo: {
      contas: contas.length,
      porSeveridade,
      mrrPorSeveridade: {
        CRITICO: Math.round(mrrPorSeveridade.CRITICO * 100) / 100,
        EM_RISCO: Math.round(mrrPorSeveridade.EM_RISCO * 100) / 100,
        ATENCAO: Math.round(mrrPorSeveridade.ATENCAO * 100) / 100,
      },
      porNatureza,
      semResponsavel: contas.filter((c) => !c.responsavelId).length,
    },
  };
}
