/**
 * Loops abertos de Vendas — o Next Step Invariant (Documento Mestre v0.13).
 *
 * A regra: **oportunidade aberta sem próximo passo é um loop aberto**, e loop
 * aberto precisa ser visível e endereçável. Não é um relatório bonito: é a
 * diferença entre "527 sem próxima ação" como número morto no topo do board e
 * uma fila em que dá para clicar e resolver.
 *
 * O número já existia. O que não existia era o caminho: `boardPipeline` contava
 * 527 e não havia filtro, rota nem lista — o operador via o problema e não
 * tinha para onde ir.
 *
 * DERIVADO DE SINAL REAL, nunca tabela própria — mesma decisão de `lib/cs/fila`:
 * uma "tabela de loops" estaria dessincronizada no minuto seguinte.
 *
 * NADA AQUI CRIA PRÓXIMA AÇÃO. As 527 oportunidades sem próximo passo ficam
 * como estão: inventar um follow-up para cada uma seria fabricar combinado que
 * ninguém fez. A fila mostra; quem resolve é o dono, por
 * `definirProximaAcao`, que continua sendo a porta única.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export type MotivoLoop =
  | "SEM_PROXIMA_ACAO"
  | "PROPOSTA_SEM_DESFECHO"
  | "PARADA"
  | "SEM_RESPONSAVEL";

export interface ItemLoop {
  /** Único por oportunidade + motivo: a mesma oportunidade pode ter dois loops. */
  chave: string;
  oportunidadeId: string;
  negocioId: string;
  titulo: string;
  empresaNome: string | null;
  motivo: MotivoLoop;
  rotulo: string;
  detalhe: string;
  urgencia: "CRITICA" | "ALTA" | "MEDIA";
  /** Há quantos dias o loop está aberto. Null quando não há data que sustente. */
  diasAberto: number | null;
  valor: string | null;
  etapa: string | null;
  responsavelId: string | null;
  responsavelNome: string | null;
}

const ORDEM: Record<ItemLoop["urgencia"], number> = { CRITICA: 0, ALTA: 1, MEDIA: 2 };

/** Dias que uma oportunidade pode ficar sem toque antes de virar loop. */
const DIAS_PARADA = 14;
/** Dias que uma proposta enviada pode ficar sem desfecho. */
const DIAS_PROPOSTA = 7;

export interface FiltrosLoop {
  organizacaoId: string;
  responsavelId?: string | null;
  /** Oportunidade sem dono é um caso à parte e o filtro precisa alcançá-la. */
  semDono?: boolean;
  motivos?: MotivoLoop[];
  limite?: number;
}

interface Linha extends Record<string, unknown> {
  oportunidade_id: string;
  negocio_id: string;
  titulo: string | null;
  empresa_nome: string | null;
  valor: string | null;
  etapa: string | null;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  dias: number | null;
  detalhe: string | null;
}

/** Recorte comum: oportunidade ABERTA, com dono e empresa resolvidos. */
function baseAberta(f: FiltrosLoop) {
  const porDono = f.semDono
    ? sql`AND o.responsavel_id IS NULL`
    : f.responsavelId
      ? sql`AND o.responsavel_id = ${f.responsavelId}::uuid`
      : sql``;
  return sql`
      FROM oportunidades o
      JOIN negocios n ON n.id = o.negocio_id_legado
      LEFT JOIN empresas e ON e.id = o.empresa_id
      LEFT JOIN leads l ON l.id = n.lead_id
      LEFT JOIN usuarios u ON u.id = o.responsavel_id
     WHERE o.organizacao_id = ${f.organizacaoId}::uuid
       AND o.ganho_at IS NULL AND o.perdido_at IS NULL
       ${porDono}`;
}

const SELECAO = sql`
    SELECT o.id::text AS oportunidade_id, o.negocio_id_legado::text AS negocio_id,
           coalesce(n.titulo, e.nome, l.empresa, l.nome, 'Oportunidade') AS titulo,
           -- 284 das 527 abertas não têm empresa canônica; sem cair no lead a
           -- fila entregaria linha sem nome, e linha sem nome não é acionável.
           coalesce(e.nome, l.empresa, l.nome) AS empresa_nome, o.valor::text AS valor, n.etapa AS etapa,
           o.responsavel_id::text AS responsavel_id, u.nome AS responsavel_nome`;

export async function filaDeLoops(f: FiltrosLoop): Promise<ItemLoop[]> {
  const quer = (m: MotivoLoop) => !f.motivos?.length || f.motivos.includes(m);
  const itens: ItemLoop[] = [];

  // 1. Sem próxima ação. O loop mais comum e o mais barato de fechar.
  if (quer("SEM_PROXIMA_ACAO")) {
    const linhas = await db.execute<Linha>(sql`
      ${SELECAO}, extract(day FROM now() - o.updated_at)::int AS dias, NULL::text AS detalhe
      ${baseAberta(f)} AND n.proxima_acao IS NULL
      ORDER BY o.valor DESC NULLS LAST`);
    for (const l of linhas) {
      itens.push(monta(l, "SEM_PROXIMA_ACAO", "Sem próxima ação",
        "ninguém combinou o próximo passo desta oportunidade",
        (l.dias ?? 0) > DIAS_PARADA ? "CRITICA" : "ALTA"));
    }
  }

  // 2. Proposta enviada e sem desfecho. Aqui o loop custa dinheiro parado.
  if (quer("PROPOSTA_SEM_DESFECHO")) {
    // A proposta mais antiga em aberto é a que manda: é ela que está esperando
    // resposta há mais tempo.
    const linhas = await db.execute<Linha>(sql`
      ${SELECAO},
             (SELECT extract(day FROM now() - min(p.enviada_em))::int
                FROM propostas p
               WHERE p.negocio_id = o.negocio_id_legado
                 AND p.enviada_em < now() - ${`${DIAS_PROPOSTA} days`}::interval
                 AND p.aceita_em IS NULL
                 AND lower(coalesce(p.status,'')) NOT IN ('recusada','cancelada')) AS dias,
             NULL::text AS detalhe
      ${baseAberta(f)}
        AND EXISTS (SELECT 1 FROM propostas p2
                     WHERE p2.negocio_id = o.negocio_id_legado
                       AND p2.enviada_em < now() - ${`${DIAS_PROPOSTA} days`}::interval
                       AND p2.aceita_em IS NULL
                       AND lower(coalesce(p2.status,'')) NOT IN ('recusada','cancelada'))
      ORDER BY o.valor DESC NULLS LAST`);
    for (const l of linhas) {
      itens.push(monta(l, "PROPOSTA_SEM_DESFECHO", "Proposta sem resposta",
        `enviada há ${l.dias ?? "?"} dias e ainda sem aceite nem recusa`, "CRITICA"));
    }
  }

  // 3. Parada. Não é estagnação declarada (que tem motivo e é outra coisa):
  // é ausência de qualquer toque.
  if (quer("PARADA")) {
    const linhas = await db.execute<Linha>(sql`
      ${SELECAO}, extract(day FROM now() - o.updated_at)::int AS dias, NULL::text AS detalhe
      ${baseAberta(f)} AND o.updated_at < now() - ${`${DIAS_PARADA} days`}::interval
      ORDER BY o.updated_at ASC`);
    for (const l of linhas) {
      itens.push(monta(l, "PARADA", "Parada",
        `sem nenhum movimento há ${l.dias ?? "?"} dias`,
        (l.dias ?? 0) > DIAS_PARADA * 3 ? "CRITICA" : "MEDIA"));
    }
  }

  // 4. Sem responsável. Loop que ninguém vai fechar porque não é de ninguém.
  if (quer("SEM_RESPONSAVEL")) {
    const linhas = await db.execute<Linha>(sql`
      ${SELECAO}, extract(day FROM now() - o.created_at)::int AS dias, NULL::text AS detalhe
      FROM oportunidades o
      JOIN negocios n ON n.id = o.negocio_id_legado
      LEFT JOIN empresas e ON e.id = o.empresa_id
      LEFT JOIN leads l ON l.id = n.lead_id
      LEFT JOIN usuarios u ON u.id = o.responsavel_id
     WHERE o.organizacao_id = ${f.organizacaoId}::uuid
       AND o.ganho_at IS NULL AND o.perdido_at IS NULL
       AND o.responsavel_id IS NULL
     ORDER BY o.created_at ASC`);
    for (const l of linhas) {
      itens.push(monta(l, "SEM_RESPONSAVEL", "Sem responsável",
        "aberta e sem dono: ninguém é cobrado por ela", "CRITICA"));
    }
  }

  itens.sort((a, b) =>
    ORDEM[a.urgencia] - ORDEM[b.urgencia] ||
    Number(b.valor ?? 0) - Number(a.valor ?? 0) ||
    (b.diasAberto ?? 0) - (a.diasAberto ?? 0));

  return f.limite ? itens.slice(0, f.limite) : itens;
}

function monta(
  l: Linha, motivo: MotivoLoop, rotulo: string, detalhe: string,
  urgencia: ItemLoop["urgencia"],
): ItemLoop {
  return {
    chave: `${motivo}:${l.oportunidade_id}`,
    oportunidadeId: l.oportunidade_id,
    negocioId: l.negocio_id,
    titulo: l.titulo ?? "Oportunidade",
    empresaNome: l.empresa_nome,
    motivo, rotulo, detalhe, urgencia,
    diasAberto: l.dias ?? null,
    valor: l.valor,
    etapa: l.etapa,
    responsavelId: l.responsavel_id,
    responsavelNome: l.responsavel_nome,
  };
}

export interface ResumoLoops {
  total: number;
  /** Oportunidades DISTINTAS com pelo menos um loop — o total conta loops. */
  oportunidades: number;
  porMotivo: Record<MotivoLoop, number>;
  /** Valor parado nos loops, contando cada oportunidade uma vez só. */
  valorParado: number;
}

export async function resumoDeLoops(organizacaoId: string, responsavelId?: string | null): Promise<ResumoLoops> {
  const itens = await filaDeLoops({ organizacaoId, responsavelId });
  const porMotivo = {
    SEM_PROXIMA_ACAO: 0, PROPOSTA_SEM_DESFECHO: 0, PARADA: 0, SEM_RESPONSAVEL: 0,
  } as Record<MotivoLoop, number>;
  const vistos = new Map<string, number>();
  for (const i of itens) {
    porMotivo[i.motivo]++;
    // A mesma oportunidade aparece em vários motivos; o dinheiro conta uma vez.
    if (!vistos.has(i.oportunidadeId)) vistos.set(i.oportunidadeId, Number(i.valor ?? 0));
  }
  return {
    total: itens.length,
    oportunidades: vistos.size,
    porMotivo,
    valorParado: Math.round([...vistos.values()].reduce((s, v) => s + v, 0) * 100) / 100,
  };
}
