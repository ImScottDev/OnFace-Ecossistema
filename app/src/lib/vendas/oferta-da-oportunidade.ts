/**
 * A oferta comercial da oportunidade — atribuída no runtime, não só por backfill.
 *
 * POR QUE ISTO EXISTE
 *
 * A oferta é quem carrega a política de ganho (`CONTRACT_FULLY_SIGNED` x
 * `PAYMENT_CONFIRMED`). Sem ela, `decidirGanhoPelaOferta` devolve
 * `{ aplicavel: false }` e a decisão canônica é **silenciosamente desligada**,
 * caindo na política por família — que é justamente o defeito que as ofertas
 * vieram resolver, porque Callface AI tem dois modos com regras opostas.
 *
 * Medido em produção em 22/10/2026: **nenhum caminho de runtime** gravava
 * `oportunidades.oferta_comercial_id`, `propostas.oportunidade_id` ou
 * `contratos.oportunidade_id` — só os backfills das fases 08 e 09. Resultado:
 * a Direcional assinou contrato com as três partes, a evidência foi registrada
 * pelo webhook do Documenso, e o Ganho ficou recusado com "falta oferta
 * comercial vinculada". Não era dívida histórica: todo caso novo nascia assim.
 *
 * A regra de escolha é a MESMA de `scripts/backfill/08-oferta-comercial.ts`,
 * determinística e por evidência, nunca por default:
 *
 *   CALLFACE_AI com contrato → CALLFACE_AI_CONTRACT   (ganha na assinatura)
 *   CALLFACE_AI sem contrato → CALLFACE_AI_DIRECT     (ganha no pagamento)
 *   PABX / WHITE_LABEL       → a oferta única da família
 *
 * Oportunidade sem família continua sem oferta: escolher uma ali seria chutar a
 * política de ganho, e a fase 07 já abre caso de reconciliação para esses.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/** Aceita a instância da aplicação ou a transação do chamador. */
type Executor = Pick<typeof db, "execute">;

/**
 * Garante que a oportunidade do negócio tenha oferta e devolve o id dela.
 *
 * `porContrato` força a oferta de contrato: quem chama ao CRIAR o contrato sabe
 * o modo de fechamento, e sem isso a oportunidade ficaria com a oferta escolhida
 * no tempo da proposta (quando ainda não havia contrato, logo `DIRECT`) e o
 * Ganho passaria a exigir pagamento de uma venda fechada por assinatura.
 *
 * Idempotente e sem efeito colateral: **não toca `updated_at`**, porque
 * descobrir a política de ganho não é alguém ter trabalhado a oportunidade — o
 * board ordena por essa coluna e a métrica de "parada há X dias" lê dela.
 */
export async function oportunidadeComOferta(
  organizacaoId: string,
  negocioId: string | null | undefined,
  opts: { porContrato?: boolean; exec?: Executor } = {},
): Promise<string | null> {
  if (!negocioId) return null;
  const exec = opts.exec ?? db;

  /* O CASE repete a regra do backfill 08 de propósito: ela é a definição da
     escolha, e uma segunda formulação em TypeScript divergiria no primeiro
     produto novo. `ativo` evita ressuscitar oferta desligada. */
  const codigo = sql`CASE
        WHEN o.service_family = 'CALLFACE_AI'
             AND (${opts.porContrato ?? false}::boolean
                  OR EXISTS (SELECT 1 FROM contratos c WHERE c.negocio_id = o.negocio_id_legado))
          THEN 'CALLFACE_AI_CONTRACT'
        WHEN o.service_family = 'CALLFACE_AI' THEN 'CALLFACE_AI_DIRECT'
        WHEN o.service_family = 'PABX' THEN 'PABX_CONTRACT'
        WHEN o.service_family = 'WHITE_LABEL' THEN 'WHITE_LABEL_CONTRACT'
      END`;

  try {
    await exec.execute(sql`
      UPDATE oportunidades o SET oferta_comercial_id = oc.id
        FROM ofertas_comerciais oc
       WHERE o.negocio_id_legado = ${negocioId}::uuid
         AND o.organizacao_id = ${organizacaoId}::uuid
         AND o.service_family IS NOT NULL
         AND oc.organizacao_id = o.organizacao_id
         AND oc.ativo
         AND oc.codigo = ${codigo}
         AND (o.oferta_comercial_id IS NULL OR o.oferta_comercial_id IS DISTINCT FROM oc.id)`);
  } catch (e) {
    // Vincular a oferta é enriquecimento: não pode derrubar a criação da
    // proposta nem a geração do contrato. Sem ela o Ganho cai no legado, que é
    // o comportamento de antes — ruim, mas não perde a venda.
    console.error("[oferta-da-oportunidade] não consegui vincular a oferta:", e);
  }

  const [op] = (await exec.execute(sql`
    SELECT o.id::text AS id FROM oportunidades o
     WHERE o.negocio_id_legado = ${negocioId}::uuid
       AND o.organizacao_id = ${organizacaoId}::uuid
     LIMIT 1`)) as unknown as Array<{ id: string }>;
  return op?.id ?? null;
}
