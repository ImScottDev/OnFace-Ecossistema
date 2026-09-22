/**
 * O health da conta é calculado, explicável e materializado (Módulo 07).
 *
 * `cs_health_snapshots` existia desde a migration 0057 com ZERO escritores:
 * nenhum código calculava score. O resto do motor de CS estava vivo — 514
 * riscos reais, job cs-sweep rodando, painel lendo. Este smoke prova que o
 * score entrou sem reconstruir nada disso.
 *
 *     pnpm tsx --env-file=.env src/scripts/smoke-cs-health.ts
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { calcularHealth, healthDaEmpresa, avaliar, VERSAO_CALCULO, type Fator } from "@/lib/cs/health";

let saida = 0;
const ok = (cond: unknown, msg: string) => {
  console.log(`${cond ? "  ok    " : "  FALHA "}${msg}`);
  if (!cond) saida = 1;
};

async function main() {
  const [org] = await db.execute<{ id: string }>(sql`SELECT id::text FROM organizacoes LIMIT 1`);

  console.log("\n═══ cálculo puro: dado ausente não vira nota ═══");
  const semDado = avaliar({
    empresa_id: "x", riscos_criticos: 0, riscos_em_risco: 0, riscos_atencao: 0,
    faturas_vencidas: 0, dias_sem_interacao: null, tem_comunicacao: false,
    entrega_parada: 0, uso_dias_sem_atividade: null, tem_uso: false,
  });
  const desconhecidos = semDado.fatores.filter((f: Fator) => f.estado === "desconhecido");
  ok(desconhecidos.length === 2, `conta sem comunicação e sem uso tem 2 fatores desconhecidos (${desconhecidos.length})`);
  ok(desconhecidos.every((f: Fator) => f.penalidade === 0), "fator desconhecido NÃO tira ponto");
  ok(semDado.score === 100, `sem problema observado o score é 100 (${semDado.score})`);
  ok(semDado.cobertura < 100, `e a cobertura denuncia o que não se sabe (${semDado.cobertura}%)`);

  const critico = avaliar({
    empresa_id: "x", riscos_criticos: 1, riscos_em_risco: 0, riscos_atencao: 0,
    faturas_vencidas: 2, dias_sem_interacao: 90, tem_comunicacao: true,
    entrega_parada: 0, uso_dias_sem_atividade: null, tem_uso: false,
  });
  ok(critico.status === "em_risco", `risco crítico + fatura vencida + 90 dias mudos = em risco (score ${critico.score})`);
  ok(critico.fatores.every((f: Fator) => f.evidencia.length > 0),
     "todo fator carrega a evidência numérica que o produziu");

  console.log("\n═══ materialização contra o banco real ═══");
  // O snapshot é DIÁRIO: um por conta por dia. Contar o total da tabela era
  // afirmação dependente de relógio — passou 21/09 e quebrou sozinha em 22/09,
  // com 275 snapshots de cada dia somando 550. O invariante real é por dia.
  const doDia = async () => {
    const [r] = await db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM cs_health_snapshots
       WHERE (calculated_at AT TIME ZONE 'UTC')::date = (now() AT TIME ZONE 'UTC')::date`);
    return r?.n ?? 0;
  };

  const r = await calcularHealth(org.id);
  ok(r.contas > 0, `avaliou ${r.contas} conta(s)`);
  console.log(`         saudáveis ${r.saudaveis} · atenção ${r.atencao} · em risco ${r.emRisco} · cobertura média ${r.coberturaMedia}%`);

  const depois = await doDia();
  ok(depois === r.contas, `gravou um snapshot por conta HOJE (${depois} de ${r.contas})`);

  const r2 = await calcularHealth(org.id);
  const final = await doDia();
  ok(final === depois, `rodar de novo no mesmo dia ATUALIZA, não empilha (${depois} → ${final})`);

  // E o histórico não é apagado: o snapshot de ontem continua lá.
  const [total] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM cs_health_snapshots`);
  ok(total.n >= depois, `o histórico é preservado (${total.n} snapshots no total)`);
  ok(r2.contas === r.contas, "mesma cobertura na reexecução");

  console.log("\n═══ leitura para o Cliente 360 ═══");
  const [umaConta] = await db.execute<{ empresa_id: string }>(sql`
    SELECT empresa_id::text FROM cs_health_snapshots ORDER BY score ASC LIMIT 1`);
  const h = await healthDaEmpresa(org.id, umaConta.empresa_id);
  ok(h !== null, "a conta devolve health");
  ok((h?.fatores.length ?? 0) >= 5, `com os fatores explicáveis (${h?.fatores.length})`);
  ok(h?.calculadoEm != null, "e a data do cálculo");

  const [versao] = await db.execute<{ v: string }>(sql`
    SELECT DISTINCT calculation_version AS v FROM cs_health_snapshots LIMIT 1`);
  ok(versao.v === VERSAO_CALCULO, `o snapshot é versionado (${versao.v})`);

  if (h) {
    const piores = h.fatores.filter((f) => f.penalidade > 0).map((f) => `${f.rotulo}: ${f.evidencia}`);
    console.log(`\n  pior conta (score ${h.score}, ${h.status}):`);
    for (const p of piores.slice(0, 4)) console.log(`    · ${p}`);
    if (!piores.length) console.log("    · nenhum fator penalizou");
  }

  console.log(saida === 0 ? "\ncs health: ok\n" : "\ncs health: FALHOU\n");
}

main().then(() => process.exit(saida)).catch((e) => { console.error(e); process.exit(1); });
