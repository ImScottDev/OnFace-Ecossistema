/**
 * O card principal do Início e os Relatórios dizem "faturamento do mês" sobre o
 * MESMO universo (negócio ganho, por `ganho_at`). Quando cada um tinha a sua
 * conta, o card mostrava R$ 5.768 e a barra de meta logo abaixo R$ 8.308
 * (novembro/26: a diferença era a implantação de R$ 2.540 de uma venda de PABX).
 *
 * Este teste roda as duas leituras no banco real, no mês com mais implantação
 * vendida — justamente o que a conta antiga do Início jogava fora.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { heroFaturamento } from "./consultas";
import { getFechadoPeriodo } from "@/lib/relatorios/comercial";
import { monthRange } from "@/lib/metas-shared";

test("Início e Relatórios somam o mesmo faturamento do mês, implantação incluída", async () => {
  // O mês que mais separa as duas contas: o de maior setup vendido.
  const [alvo] = await db.execute<{ org: string; mes: string; setup: string }>(sql`
    SELECT organizacao_id::text AS org,
           to_char(ganho_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') AS mes,
           SUM(COALESCE(valor_setup, 0))::text AS setup
      FROM negocios
     WHERE status = 'ganho' AND ganho_at IS NOT NULL
     GROUP BY 1, 2
     HAVING SUM(COALESCE(valor_setup, 0)) > 0
     ORDER BY 3 DESC LIMIT 1`);
  if (!alvo) return; // banco sem venda com implantação: nada a provar aqui

  const { inicio, fim } = monthRange(`${alvo.mes}-01`);
  // `agora` dentro do mês alvo: o hero sempre lê o mês corrente.
  const agora = new Date(inicio.getTime() + (fim.getTime() - inicio.getTime()) - 1000);
  const [hero, relatorio] = await Promise.all([
    heroFaturamento({ orgId: alvo.org, userId: "", agora }),
    getFechadoPeriodo(alvo.org, inicio, fim),
  ]);

  assert.ok(Number(alvo.setup) > 0, "o mês escolhido precisa ter implantação vendida");
  assert.equal(hero.realizado, Math.round(relatorio.receita));
});
