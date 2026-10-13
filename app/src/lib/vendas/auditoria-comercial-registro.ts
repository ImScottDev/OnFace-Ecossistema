/**
 * Auditoria estruturada das alterações comerciais da proposta (parte com banco).
 *
 * Não cria caminho paralelo: o registro sai pela porta de eventos
 * (`registrarEvento`), que grava em `vendas_eventos` (quem, quando, contexto),
 * espelha na timeline da oportunidade e é lido por `lerAlteracoesDaProposta`
 * para a própria proposta. A comparação e o texto moram em
 * `auditoria-comercial.ts` (puro, testado).
 *
 * Quem altera a proposta lê a foto ANTES e DEPOIS da escrita, dentro da mesma
 * transação, e chama `registrarAlteracaoComercial`: a mudança e o registro dela
 * existem juntos ou não existem.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { registrarEvento, type TipoEventoVendas } from "./eventos";
import type { ExecutorDb } from "./executor";
import { ROTULO_MODO_FECHAMENTO, type Ator, type ModoFechamento } from "./dominio";
import {
  chavesDosItens, compararFotos, descricaoDaTimeline, resumoDasAlteracoes, totalDaFoto,
  type AlteracaoComercial, type FotoComercial, type RegistroDeAlteracao,
} from "./auditoria-comercial";

/** O retrato comercial da proposta agora. */
export async function lerFotoComercial(tx: ExecutorDb, organizacaoId: string, propostaId: string): Promise<FotoComercial> {
  const [p] = await tx.execute<{
    observacoes: string | null; prazo: number | null; parcelas: number | null; validade_dias: number | null;
    data_validade: string | null; modo: string | null; contato: string | null;
  }>(sql`
    SELECT p.observacoes, p.prazo_contrato_meses AS prazo, p.parcelas, p.validade_dias,
           p.data_validade::text, p.modo_fechamento AS modo,
           NULLIF(trim(COALESCE(l.nome, '') || ' ' || COALESCE(l.sobrenome, '')), '') AS contato
      FROM propostas p LEFT JOIN leads l ON l.id = p.lead_id
     WHERE p.id = ${propostaId}::uuid AND p.organizacao_id = ${organizacaoId}::uuid`);
  const linhas = await tx.execute<{
    id: string; catalogo_preco_id: string | null; nome: string; quantidade: string;
    valor_unitario: string; desconto: string; desconto_tipo: string | null; subtotal: string;
  }>(sql`
    SELECT id::text, catalogo_preco_id::text, nome, quantidade::text, valor_unitario::text,
           desconto::text, desconto_tipo, subtotal::text
      FROM proposta_itens WHERE proposta_id = ${propostaId}::uuid ORDER BY ordem, id`);
  const chaves = chavesDosItens(linhas.map((l) => ({ id: l.id, catalogoPrecoId: l.catalogo_preco_id })));
  return {
    itens: linhas.map((l, i) => {
      const quantidade = Number(l.quantidade) || 0;
      const bruto = quantidade * (Number(l.valor_unitario) || 0);
      const d = Number(l.desconto) || 0;
      return {
        chave: chaves[i], nome: l.nome, quantidade,
        valorUnitario: Number(l.valor_unitario) || 0,
        // A linha guarda o desconto em reais; o legado em % vira reais para a comparação não mentir.
        desconto: l.desconto_tipo === "percentual" ? Math.round(bruto * d) / 100 : d,
        subtotal: Number(l.subtotal) || 0,
      };
    }),
    observacoes: p?.observacoes ?? null,
    prazoContratoMeses: p?.prazo ?? null,
    parcelas: p?.parcelas ?? null,
    validadeDias: p?.validade_dias ?? null,
    dataValidade: p?.data_validade ?? null,
    // O rótulo, não o código: "Contrato" → "Pré-pago" é o que a pessoa lê no registro.
    modoFechamento: p?.modo ? (ROTULO_MODO_FECHAMENTO[p.modo as ModoFechamento] ?? p.modo) : null,
    contato: p?.contato ?? null,
  };
}

/**
 * Registra o que mudou entre as duas fotos, quando mudou algo.
 *
 * `tipo` é `ProposalCreated` (a primeira foto é a vazia: tudo é "item
 * adicionado") ou `ProposalEdited`. Devolve as alterações, para o chamador
 * decidir se tem mais a dizer.
 */
export async function registrarAlteracaoComercial(tx: ExecutorDb, p: {
  organizacaoId: string;
  propostaId: string;
  ator: Ator;
  antes: FotoComercial;
  depois: FotoComercial;
  tipo?: Extract<TipoEventoVendas, "ProposalEdited" | "ProposalCreated">;
  motivo?: string | null;
  /** Campos extras no contexto do evento (família, revisão...). */
  contexto?: Record<string, unknown>;
  /** Título da timeline, quando o padrão ("Proposta #N vX editada · …") não descreve a ocasião. */
  titulo?: string;
}): Promise<AlteracaoComercial[]> {
  const alteracoes = compararFotos(p.antes, p.depois);
  const tipo = p.tipo ?? "ProposalEdited";
  if (alteracoes.length === 0 && tipo === "ProposalEdited") return alteracoes;

  const [prop] = await tx.execute<{ negocio_id: string | null; lead_id: string; numero: number; versao: number; empresa_id: string | null }>(sql`
    SELECT p.negocio_id::text, p.lead_id::text, p.numero, p.versao, n.empresa_id::text
      FROM propostas p LEFT JOIN negocios n ON n.id = p.negocio_id
     WHERE p.id = ${p.propostaId}::uuid AND p.organizacao_id = ${p.organizacaoId}::uuid`);
  if (!prop) return alteracoes;

  const motivo = p.motivo?.trim() || null;
  const resumo = resumoDasAlteracoes(alteracoes);
  await registrarEvento({
    organizacaoId: p.organizacaoId, tipo, ator: p.ator,
    propostaId: p.propostaId, negocioId: prop.negocio_id, leadId: prop.lead_id,
    contexto: {
      ...(p.contexto ?? {}),
      numero: prop.numero, versao: prop.versao, resumo, motivo,
      totalAntes: totalDaFoto(p.antes), totalDepois: totalDaFoto(p.depois),
      alteracoes,
    },
    timeline: {
      tipo: "nota",
      titulo: p.titulo ?? (tipo === "ProposalCreated"
        ? `Proposta #${prop.numero} criada`
        : `Proposta #${prop.numero} v${prop.versao} editada · ${resumo}`),
      descricao: descricaoDaTimeline(alteracoes, motivo),
    },
  }, tx);
  return alteracoes;
}

/**
 * O histórico de alterações de UMA proposta, do mais recente para o mais antigo.
 * É o que aparece para quem abre a proposta (página e gaveta).
 */
export async function lerAlteracoesDaProposta(organizacaoId: string, propostaId: string, limite = 60): Promise<RegistroDeAlteracao[]> {
  const linhas = await db.execute<{
    id: string; ator_tipo: string; quem: string | null; em: string; contexto: Record<string, unknown> | null;
  }>(sql`
    SELECT e.id::text, e.ator_tipo, u.nome AS quem, e.ocorrido_em::text AS em, e.contexto
      FROM vendas_eventos e LEFT JOIN usuarios u ON u.id = e.usuario_id
     WHERE e.organizacao_id = ${organizacaoId}::uuid AND e.proposta_id = ${propostaId}::uuid
       AND e.tipo IN ('ProposalEdited', 'ProposalCreated')
       AND e.contexto->'alteracoes' IS NOT NULL
     ORDER BY e.ocorrido_em DESC LIMIT ${limite}`);
  return linhas.map((l) => {
    const c = l.contexto ?? {};
    const alteracoes = Array.isArray(c.alteracoes) ? (c.alteracoes as AlteracaoComercial[]) : [];
    return {
      id: l.id, quem: l.quem, atorTipo: l.ator_tipo, em: l.em,
      motivo: typeof c.motivo === "string" && c.motivo.trim() ? c.motivo : null,
      totalAntes: typeof c.totalAntes === "number" ? c.totalAntes : null,
      totalDepois: typeof c.totalDepois === "number" ? c.totalDepois : null,
      alteracoes,
    };
  });
}
