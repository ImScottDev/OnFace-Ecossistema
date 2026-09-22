/**
 * O banco não fica com registro de teste depois que a bateria termina.
 *
 * Três episódios em dois dias, todos custando tempo longe da causa:
 *
 * - CP49: um smoke deixou 3 leads porque a limpeza pulava `pontos_contato` e
 *   cada DELETE tinha `.catch()` mudo. Quebrou 3 testes de reconciliação.
 * - CP56: o aceite de CS morria no final por FK, deixando 3 oportunidades sem
 *   etapa. Elas derrubaram `relatorios/cobertura.test.ts` **duas fases adiante**,
 *   onde ninguém procuraria resíduo de teste.
 * - CP58: 6 empresas, 1 tarefa e 4 eventos de outbox apontando para aquisição
 *   apagada, deixados por execuções que falharam no meio.
 *
 * O padrão é sempre o mesmo: a limpeza de cada script conhece as tabelas que
 * ELE escreve, e falha quando a escrita cresce por baixo (a ponte canônica
 * passou a criar oportunidade, o evento passou a ir para o outbox). Verificar
 * por script não resolve — por isso esta checagem é uma só, roda depois de
 * todos, e olha o banco inteiro pelas marcas que os scripts usam.
 *
 * Não limpa nada de propósito. Limpar esconderia o defeito e deixaria a próxima
 * execução sujar de novo; o que se quer é o script culpado aparecer.
 *
 *     npx tsx --env-file=.env src/scripts/checar-residuo-de-teste.ts
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

/** As marcas que os smokes e aceites usam para nomear o que criam. */
const MARCA = "smoke-|\\[ACEITE";

let falhas = 0;
const ok = (cond: unknown, msg: string) => {
  console.log(`  ${cond ? "\x1b[32mok\x1b[0m   " : "\x1b[31mFALHA\x1b[0m"} ${msg}`);
  if (!cond) falhas++;
};

/** Tabela e a coluna de texto onde a marca aparece. */
const ALVOS: Array<[tabela: string, coluna: string]> = [
  ["leads", "nome"],
  ["pessoas", "nome"],
  ["empresas", "nome"],
  ["negocios", "titulo"],
  ["oportunidades", "titulo"],
  ["atividades", "titulo"],
  ["tarefas", "titulo"],
  // `contratos` fica de fora: não tem coluna de nome livre onde a marca caberia.
];

async function main() {
  console.log("── registro marcado como teste ──");
  let total = 0;
  for (const [tabela, coluna] of ALVOS) {
    const [r] = await db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM ${sql.raw(tabela)}
       WHERE ${sql.raw(coluna)} ~* ${MARCA}`);
    total += r.n;
    if (r.n > 0) ok(false, `${tabela}: ${r.n} registro(s) de teste que ninguém limpou`);
  }
  ok(total === 0, `nenhuma das ${ALVOS.length} tabelas tem registro de teste sobrando`);

  console.log("\n── evento PENDENTE apontando para registro que não existe mais ──");
  // Só o que está PENDENTE, e de propósito.
  //
  // A primeira versão contava todo evento órfão e acusou 8 — todos já
  // processados. Evento processado cujo agregado foi apagado depois é registro
  // histórico legítimo: o fato aconteceu, e `domain_events` existe justamente
  // para guardar isso. O mesmo vale para a tabela de domínio inteira, que por
  // isso saiu desta checagem.
  //
  // O que atrapalha de verdade é o PENDENTE: o consumidor vai pegá-lo, não vai
  // achar contexto e vai gravar uma linha de auditoria que não responde nada.
  // Acusar o histórico junto seria a trava dogmática que esta leva já pagou
  // três vezes.
  const [orfaos] = await db.execute<{ outbox: number }>(sql`
    SELECT count(*)::int AS outbox FROM event_outbox o
     WHERE o.status <> 'processed' AND o.aggregate_type = 'aquisicao'
       AND NOT EXISTS (SELECT 1 FROM aquisicoes a WHERE a.id = o.aggregate_id)`);
  ok(orfaos.outbox === 0, `outbox pendente sem agregado (${orfaos.outbox})`);

  console.log("\n── o que a bateria não pode deixar para trás ──");
  // Oportunidade sem etapa foi exatamente o resíduo do CP56, e ele só apareceu
  // num teste de cobertura de outra fase. Aqui aparece na hora.
  const [semEtapa] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM oportunidades WHERE etapa IS NULL`);
  ok(semEtapa.n === 0, `oportunidade sem etapa (${semEtapa.n})`);

  console.log(falhas === 0
    ? "\n\x1b[32mbanco limpo: a bateria não deixou rastro\x1b[0m\n"
    : `\n\x1b[31m${falhas} resíduo(s) — o script que criou não limpou o que criou\x1b[0m\n`);
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
