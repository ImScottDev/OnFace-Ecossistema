/**
 * Destrava venda ACEITA que não fechou.
 *
 * Nasceu em 23/10/2026, depois de cinco defeitos diferentes no mesmo trecho
 * (aceite → cobrança → ganho) deixarem sete vendas paradas. As correções
 * consertam o FLUXO; os casos já parados continuam parados, porque o fato que
 * faltava (a evidência, o ganho, a cobrança certa) nunca foi gravado.
 *
 * Não é script de um dia: enquanto houver um caminho de cobrança que possa
 * falhar no meio, vai existir venda aceita e não fechada — e esta é a
 * ferramenta para olhar e destravar, sem abrir o banco na mão.
 *
 * O que faz, por caso:
 *   evidência gravada e negócio não ganho    → pede o Ganho pelas portas de sempre
 *   checkout pago e evidência ausente        → grava a evidência e pede o Ganho
 *   checkout aberto com desconto em recorrente → REGERA (o link antigo cobra
 *                                              o preço de tabela do 2º mês em diante)
 *   contrato aguardando assinatura           → não toca: está esperando o cliente
 *
 * Nada aqui inventa fato comercial: o Ganho continua passando por
 * `marcarNegocioGanhoSeAindaNao`, que consulta a política da oferta. Se a
 * política disser não, o script respeita e explica.
 *
 * Uso (no servidor, dentro do container; a imagem leva o bundle em dist/):
 *   docker exec -w /repo/app <container> node dist/destravar-vendas-paradas.mjs
 *   ... --aplicar            # executa
 *   ... --proposta 1570      # só uma proposta
 *
 * Uso (local, com tsx):
 *   tsx --env-file=.env src/scripts/destravar-vendas-paradas.ts            # só mostra
 *   tsx --env-file=.env src/scripts/destravar-vendas-paradas.ts --aplicar  # executa
 *   ... --proposta 1570        # só uma proposta, pelo número
 */
import { db, fecharConexao } from "@/lib/db";
import { sql } from "drizzle-orm";
import { fecharFilas } from "@/lib/queue";

const APLICAR = process.argv.includes("--aplicar");
const sohEsta = (() => {
  const i = process.argv.indexOf("--proposta");
  return i >= 0 ? Number(process.argv[i + 1]) : null;
})();

interface Parada extends Record<string, unknown> {
  proposta_id: string;
  numero: number;
  organizacao_id: string;
  negocio_id: string | null;
  grupo_id: string | null;
  empresa: string | null;
  status_negocio: string;
  tem_evidencia: boolean;
  checkout_id: string | null;
  checkout_status: string | null;
  desconto_recorrente: string | null;
  contrato_pendente: boolean;
}

async function paradas(): Promise<Parada[]> {
  const r = await db.execute<Parada>(sql`
    SELECT p.id::text AS proposta_id, p.numero, p.organizacao_id::text, p.negocio_id::text,
           (SELECT g.id::text FROM proposta_grupo_comercial g WHERE g.proposta_id = p.id ORDER BY g.created_at LIMIT 1) AS grupo_id,
           e.nome AS empresa, n.status AS status_negocio,
           EXISTS (SELECT 1 FROM comercial_evidencia ev WHERE ev.negocio_id = p.negocio_id) AS tem_evidencia,
           (SELECT ck.id::text FROM checkouts ck WHERE ck.proposta_id = p.id ORDER BY ck.criado_em DESC LIMIT 1) AS checkout_id,
           (SELECT ck.status FROM checkouts ck WHERE ck.proposta_id = p.id ORDER BY ck.criado_em DESC LIMIT 1) AS checkout_status,
           (SELECT round(sum(i.valor_tabela * i.quantidade - i.subtotal), 2)::text
              FROM proposta_itens i
             WHERE i.proposta_id = p.id AND i.tipo = 'recorrente'
               AND i.valor_tabela IS NOT NULL AND i.valor_unitario < i.valor_tabela) AS desconto_recorrente,
           EXISTS (SELECT 1 FROM contratos c WHERE c.negocio_id = p.negocio_id
                     AND coalesce(c.assinatura_status,'') <> 'assinado') AS contrato_pendente
      FROM propostas p
      JOIN negocios n ON n.id = p.negocio_id
      LEFT JOIN empresas e ON e.id = n.empresa_id
     WHERE p.status = 'aceita' AND n.status <> 'ganho'
       ${sohEsta ? sql`AND p.numero = ${sohEsta}` : sql``}
     ORDER BY p.numero DESC`);
  return r as unknown as Parada[];
}

async function main(): Promise<void> {
  const lista = await paradas();
  if (lista.length === 0) {
    console.log("Nenhuma venda aceita parada. Nada a fazer.");
    return;
  }
  console.log(`${lista.length} venda(s) aceita(s) sem Ganho${APLICAR ? "" : "  (simulação — use --aplicar para executar)"}\n`);

  const { registrarEvidencia, marcarNegocioGanhoSeAindaNao } = await import("@/lib/crm/won-evidence");
  const { criarCheckoutParaGrupo } = await import("@/lib/crm/checkout");

  for (const v of lista) {
    const quem = `#${v.numero} ${v.empresa ?? "(sem empresa)"}`;

    // Contrato ainda sendo assinado não é venda travada: é venda em curso.
    if (v.contrato_pendente && !v.tem_evidencia) {
      console.log(`${quem}: aguardando assinatura do cliente — nada a fazer.`);
      continue;
    }

    if (!v.negocio_id) {
      console.log(`${quem}: proposta sem negócio; precisa de olho humano.`);
      continue;
    }

    // 1. Pagou e a evidência não foi gravada (expansão no cartão, 23/10).
    if (!v.tem_evidencia && v.checkout_status === "pago") {
      console.log(`${quem}: checkout PAGO sem evidência → gravar evidência e pedir o Ganho.`);
      if (APLICAR) {
        await registrarEvidencia({
          negocioId: v.negocio_id, organizacaoId: v.organizacao_id,
          tipo: "stripe_subscription", sourceRef: v.checkout_id ?? v.proposta_id,
          grupoComercialId: v.grupo_id, metadata: { origem: "destravar-vendas-paradas" },
        });
      }
    }

    // 2. Tem a prova e não ganhou. A política da oferta decide, não o script.
    if (v.tem_evidencia || (APLICAR && v.checkout_status === "pago")) {
      console.log(`${quem}: tem evidência e está em '${v.status_negocio}' → pedir o Ganho.`);
      if (APLICAR) {
        try {
          await marcarNegocioGanhoSeAindaNao(v.negocio_id, v.organizacao_id);
          const [depois] = await db.execute<{ status: string }>(sql`SELECT status FROM negocios WHERE id = ${v.negocio_id}::uuid`) as unknown as { status: string }[];
          console.log(`    → agora: ${depois?.status ?? "?"}`);
        } catch (e) {
          console.error(`    ! o Ganho foi recusado: ${String(e).slice(0, 200)}`);
        }
      }
      continue;
    }

    // 3. Link de pagamento vivo com desconto em item recorrente: o cupom antigo
    //    vale só o 1º mês, então o cliente seria cobrado o preço de tabela a
    //    partir do 2º. Regerar cria o cupom com a duração certa.
    const desconto = Number(v.desconto_recorrente ?? 0);
    if (desconto > 0 && v.grupo_id && v.checkout_status !== "pago") {
      console.log(`${quem}: checkout '${v.checkout_status ?? "nenhum"}' com R$ ${desconto.toFixed(2)}/mês de desconto recorrente → REGERAR (o link atual cobra a mais do 2º mês em diante).`);
      if (APLICAR) {
        const r = await criarCheckoutParaGrupo({ grupoId: v.grupo_id, origem: "manual_vendedor" });
        if (!r.ok) console.error(`    ! não regerou: ${r.error}`);
        else if ("faturada" in r) console.log(`    → assinatura ${r.subscriptionId} ativada, fatura ${r.faturaUrl ?? "(no ciclo)"}`);
        else if ("expansao" in r) console.log(`    → cobrado na assinatura ${r.subscriptionId}`);
        else console.log(`    → novo link: ${r.url}`);
      }
      continue;
    }

    console.log(`${quem}: em '${v.status_negocio}', sem evidência e sem cobrança paga — aguardando o cliente.`);
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(async () => { await fecharFilas().catch(() => {}); await fecharConexao().catch(() => {}); });
