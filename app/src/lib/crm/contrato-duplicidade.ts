/**
 * F4 (Commercial) — classificação de contrato "ativo" duplicado.
 *
 * Escrito do zero a partir dos requisitos já documentados na auditoria
 * original (PLANO-MRR-CONTRATOS-DUPLICADOS.md, achado confirmado 08/08:
 * 36 pares, R$17.449,30/mês de excesso) — NÃO copiado da branch `homolog`
 * (backup do Kauã, ele revisa sozinho depois, ver ADR-EXEC-008).
 *
 * Causa raiz do bug: `syncStripe()` decide criar-vs-atualizar contrato
 * olhando só a tabela `assinaturas`, nunca `contratos` — toda venda por
 * checkout Stripe cria um 2º contrato pra mesma assinatura (um via
 * `marcarPropostaAceita`, com negocioId; outro via `syncStripe()`, sem).
 *
 * IMPORTANTE: "2+ contrato ativo do mesmo lead+produto" NÃO é
 * automaticamente duplicata — pode ser upsell real (2 assinaturas Stripe
 * rodando em paralelo pro mesmo produto). A tabela `assinaturas` (espelho
 * local do Stripe) é quem desempata, nunca uma heurística "manter o mais
 * recente" aplicada sem evidência.
 */
import { db } from "@/lib/db";
import { contratos, assinaturas } from "@/lib/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";

export type ClassificacaoContratoAtivo = "upsell_confirmado" | "obsoleto_confirmado" | "ambiguo";

export interface ContratoAtivoAvaliado {
  contrato: typeof contratos.$inferSelect;
  classificacao: ClassificacaoContratoAtivo;
}

const STATUS_ASSINATURA_VIVA = ["active", "trialing", "past_due"];

/**
 * Avalia todos os contratos `status='ativo'` já existentes do mesmo
 * lead+produto (pode já haver mais de um duplicado acumulado) e classifica
 * cada um em 3 casos, nunca decidindo sozinho o caso ambíguo:
 *
 * - "upsell_confirmado": tem assinatura active/trialing/past_due -> real,
 *   não é duplicata, NÃO TOCAR.
 * - "obsoleto_confirmado": tem assinatura canceled/incomplete_expired ->
 *   morreu de verdade, seguro marcar como substituído.
 * - "ambiguo": NENHUMA assinatura vinculada -> não prova nada (pode ser
 *   contrato manual/PABX legítimo, que nunca passa pelo Stripe). Não decide
 *   sozinho — quem chama decide o que fazer (ex.: notificar humano).
 */
export async function avaliarContratosAtivosDuplicados(
  leadId: string,
  produto: string | null | undefined,
  organizacaoId: string,
  excluirContratoId?: string
): Promise<ContratoAtivoAvaliado[]> {
  const condicoes = [
    eq(contratos.leadId, leadId),
    eq(contratos.organizacaoId, organizacaoId),
    eq(contratos.status, "ativo"),
    produto ? eq(contratos.produto, produto) : isNull(contratos.produto),
  ];

  const existentes = await db.select().from(contratos).where(and(...condicoes));
  const filtrados = excluirContratoId ? existentes.filter((c) => c.id !== excluirContratoId) : existentes;
  if (filtrados.length === 0) return [];

  const resultado: ContratoAtivoAvaliado[] = [];
  for (const contrato of filtrados) {
    const assinaturasDoContrato = await db
      .select({ status: assinaturas.status })
      .from(assinaturas)
      .where(eq(assinaturas.contratoId, contrato.id));

    if (assinaturasDoContrato.length === 0) {
      resultado.push({ contrato, classificacao: "ambiguo" });
      continue;
    }
    const vivo = assinaturasDoContrato.some((a) => STATUS_ASSINATURA_VIVA.includes(a.status));
    resultado.push({ contrato, classificacao: vivo ? "upsell_confirmado" : "obsoleto_confirmado" });
  }
  return resultado;
}

export interface GrupoDuplicidade {
  leadId: string;
  produto: string | null;
  avaliados: ContratoAtivoAvaliado[];
}

export interface RelatorioDuplicidade {
  grupos: GrupoDuplicidade[];
  totalUpsell: number;
  totalObsoleto: number;
  totalAmbiguo: number;
  mrrExcesso: number;
}

/**
 * Gera o relatório de duplicidade pra UMA organização, usando o MESMO
 * helper (`avaliarContratosAtivosDuplicados`) que o código de produção usa
 * pra decidir upsell vs. renovação — nunca reimplementa a classificação.
 * Extraído do script `db:relatorio-duplicidade-contratos` pra ser
 * reusável (CLI e UI chamam a mesma função, evita duplicar a lógica em
 * dois lugares — o mesmo padrão de bug que já causou o achado de MRR).
 */
export async function gerarRelatorioDuplicidade(organizacaoId: string): Promise<RelatorioDuplicidade> {
  const gruposBrutos = await db.execute<{ lead_id: string; produto: string | null }>(sql`
    select lead_id, produto
    from contratos
    where status = 'ativo' and organizacao_id = ${organizacaoId}
    group by lead_id, produto
    having count(*) > 1
  `);

  const grupos: GrupoDuplicidade[] = [];
  let totalUpsell = 0, totalObsoleto = 0, totalAmbiguo = 0;

  for (const g of gruposBrutos) {
    const avaliados = await avaliarContratosAtivosDuplicados(g.lead_id, g.produto, organizacaoId);
    if (avaliados.length === 0) continue;
    grupos.push({ leadId: g.lead_id, produto: g.produto, avaliados });
    for (const { classificacao } of avaliados) {
      if (classificacao === "upsell_confirmado") totalUpsell++;
      else if (classificacao === "obsoleto_confirmado") totalObsoleto++;
      else totalAmbiguo++;
    }
  }

  const [mrrRow] = await db.execute<{ total: string }>(sql`
    with ranked as (
      select id, mrr, stripe_subscription_id,
             row_number() over (partition by stripe_subscription_id order by created_at asc) as rn
      from contratos
      where status = 'ativo' and organizacao_id = ${organizacaoId} and stripe_subscription_id is not null
    )
    select coalesce(sum(mrr), 0)::text as total from ranked where rn > 1
  `);

  return { grupos, totalUpsell, totalObsoleto, totalAmbiguo, mrrExcesso: Number(mrrRow.total) || 0 };
}

/**
 * Marca um contrato como substituído por um mais novo (renovação/upgrade
 * real, não churn) — só chamar para contratos já classificados como
 * "obsoleto_confirmado". Preserva nota anterior, se existir.
 */
export async function marcarContratoComoRenovado(contratoAntigoId: string, contratoNovoId: string): Promise<void> {
  const [existente] = await db.select({ notas: contratos.notas }).from(contratos).where(eq(contratos.id, contratoAntigoId)).limit(1);
  const notaNova = `[F4] Substituído pelo contrato ${contratoNovoId} — mesma assinatura Stripe, classificado como obsoleto_confirmado (assinatura antiga canceled/incomplete_expired).`;
  await db
    .update(contratos)
    .set({
      status: "renovado",
      finalizadoAt: new Date(),
      notas: existente?.notas ? sql`${existente.notas} || E'\n\n' || ${notaNova}` : notaNova,
      updatedAt: new Date(),
    })
    .where(eq(contratos.id, contratoAntigoId));
}
