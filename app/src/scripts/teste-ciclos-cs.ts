/**
 * Prova da régua 3/6/9/12 recorrente: semeia o ciclo 1, conclui todos os
 * marcos até o M12, verifica que o ciclo 2 abriu com as datas certas, e que
 * repetir a operação não duplica nada. Usa uma empresa de teste própria e
 * limpa tudo no fim.
 */
import { db } from "@/lib/db";
import { organizacoes, usuarios, empresas, clientes, csMarcos, tarefas, atividades, npsRespostas, csRiscos, negocios } from "@/lib/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { iniciarJornadaCs, cicloAtual } from "@/lib/cs/jornada";
import { executarCheckpoint } from "@/lib/cs/checkpoint";
import { marcosDoCiclo } from "@/lib/cs/playbooks";

let passou = 0, falhou = 0;
function ok(n: string, cond: boolean, d = "") {
  if (cond) { passou++; console.log(`  OK   ${n}${d ? ` — ${d}` : ""}`); }
  else { falhou++; console.log(`  FALHA ${n}${d ? ` — ${d}` : ""}`); }
}

async function main() {
  const [org] = await db.select().from(organizacoes).limit(1);
  const [user] = await db.select().from(usuarios)
    .where(and(eq(usuarios.organizacaoId, org.id), eq(usuarios.ativo, true))).limit(1);

  // Empresa própria com entrada há 13 meses: o ciclo 1 inteiro já venceu,
  // que é exatamente o caso em que a virada de ciclo importa.
  const entrada = new Date(Date.now() - 395 * 86_400_000);
  const [empresa] = await db.insert(empresas).values({
    organizacaoId: org.id, nome: "[CICLO-TESTE] Cliente de régua",
  }).returning();
  await db.insert(clientes).values({
    organizacaoId: org.id, empresaId: empresa.id,
    clienteDesde: entrada, entrouCarteiraEm: entrada, responsavelId: user.id,
  });

  console.log(`Empresa de teste: ${empresa.id}\n`);

  console.log("── ciclo 1 ──");
  const c1 = await iniciarJornadaCs(empresa.id);
  ok("ciclo 1 semeado", c1.criados === 7, `${c1.criados} marcos (D0,D7,D30,M3,M6,M9,M12)`);
  ok("ciclo 1 tem os 7 marcos do playbook", marcosDoCiclo(1).length === 7);
  ok("ciclo 2 teria só os recorrentes", marcosDoCiclo(2).length === 4, marcosDoCiclo(2).map((m) => m.codigo).join(","));

  const repet = await iniciarJornadaCs(empresa.id);
  ok("resemear não duplica", repet.criados === 0 && repet.jaExistiam === 7);

  const doCiclo1 = await db.select().from(csMarcos)
    .where(and(eq(csMarcos.empresaId, empresa.id), eq(csMarcos.ciclo, 1))).orderBy(csMarcos.dueDate);
  ok("todos vencidos nascem PULADO (entrada há 13 meses)", doCiclo1.every((m) => m.status === "PULADO"),
    doCiclo1.map((m) => `${m.codigo}:${m.status}`).join(" "));

  // Pra exercitar a virada, reabre o M12 como pendente — é o estado em que
  // ele estaria num cliente acompanhado desde o início.
  const m12 = doCiclo1.find((m) => m.codigo === "M12")!;
  await db.update(csMarcos).set({ status: "PENDENTE", resultado: null }).where(eq(csMarcos.id, m12.id));

  console.log("\n── executando o checkpoint M12 ──");
  const saida = await executarCheckpoint({
    marcoId: m12.id, organizacaoId: org.id, usuarioId: user.id,
    resultado: { checklist: { "Satisfação do ano": true }, nota: "[CICLO-TESTE] ano fechado" },
    healthCheck: { nps: 4, adocao: 2, intencao_continuidade: true, dificuldades: "[CICLO-TESTE] time não adotou" },
    risco: { severidade: "EM_RISCO", motivo: "[CICLO-TESTE] adoção baixa" },
    expansao: { titulo: "[CICLO-TESTE] mais ramais", tipo: "usuarios" },
    proximaAcao: { titulo: "[CICLO-TESTE] treinar time", venceEm: new Date(Date.now() + 5 * 86_400_000).toISOString() },
  });
  ok("checkpoint executado", !!saida);
  ok("ciclo 2 aberto", saida?.cicloAberto === 2, `ciclo ${saida?.cicloAberto}`);
  ok("health check registrado", !!saida?.healthCheckId);
  ok("risco aberto no checkpoint", !!saida?.riscoId);
  ok("expansão virou negócio", !!saida?.negocioExpansaoId);
  ok("próxima ação criada", !!saida?.proximaAcaoId);

  const [expansao] = saida?.negocioExpansaoId
    ? await db.select().from(negocios).where(eq(negocios.id, saida.negocioExpansaoId)) : [];
  ok("expansão é oportunidade comercial", expansao?.commercialMotion === "EXPANSION");

  // Health check ruim deve ter aberto risco próprio, além do manual.
  const riscosDaConta = await db.select().from(csRiscos).where(eq(csRiscos.empresaId, empresa.id));
  ok("health check baixo virou sinal", riscosDaConta.some((r) => r.fonte === "nps_respostas:health_check"),
    riscosDaConta.map((r) => r.tipo).join(", "));

  console.log("\n── ciclo 2 ──");
  const doCiclo2 = await db.select().from(csMarcos)
    .where(and(eq(csMarcos.empresaId, empresa.id), eq(csMarcos.ciclo, 2))).orderBy(csMarcos.dueDate);
  ok("ciclo 2 tem 4 marcos", doCiclo2.length === 4, doCiclo2.map((m) => m.codigo).join(","));
  ok("ciclo 2 não repete D0/D7/D30", !doCiclo2.some((m) => ["D0", "D7", "D30"].includes(m.codigo)));
  ok("ciclo atual é 2", (await cicloAtual(empresa.id)) === 2);

  // Âncora do ciclo 2 = data do M12, não hoje.
  const m3c2 = doCiclo2.find((m) => m.codigo === "M3")!;
  const esperado = new Date(`${m12.dueDate}T12:00:00`);
  esperado.setDate(esperado.getDate() + 90);
  ok("M3 do ciclo 2 conta a partir do M12 do ciclo 1", m3c2.dueDate === esperado.toISOString().slice(0, 10),
    `${m3c2.dueDate} (esperado ${esperado.toISOString().slice(0, 10)})`);

  ok("histórico do ciclo 1 preservado", doCiclo1.length === 7 &&
    (await db.select().from(csMarcos).where(and(eq(csMarcos.empresaId, empresa.id), eq(csMarcos.ciclo, 1)))).length === 7);

  const m12depois = (await db.select().from(csMarcos).where(eq(csMarcos.id, m12.id)))[0];
  ok("M12 guardou o resultado", m12depois.status === "CONCLUIDO" && !!m12depois.resultado);

  console.log("\n── idempotência da virada ──");
  const { abrirProximoCiclo } = await import("@/lib/cs/jornada");
  const denovo = await abrirProximoCiclo(m12.id);
  ok("reabrir o mesmo ciclo não duplica", denovo?.criados === 0, `${denovo?.criados} criados`);
  const dupe = await executarCheckpoint({
    marcoId: m12.id, organizacaoId: org.id, usuarioId: user.id, resultado: {},
  });
  ok("checkpoint já registrado não reexecuta", dupe === null);
  const c2final = await db.select().from(csMarcos)
    .where(and(eq(csMarcos.empresaId, empresa.id), eq(csMarcos.ciclo, 2)));
  ok("ciclo 2 continua com 4 marcos", c2final.length === 4);

  // ── limpeza ──
  console.log("\n── limpando ──");
  await db.delete(npsRespostas).where(eq(npsRespostas.empresaId, empresa.id));
  await db.delete(csRiscos).where(eq(csRiscos.empresaId, empresa.id));
  await db.delete(negocios).where(eq(negocios.empresaId, empresa.id));
  await db.delete(atividades).where(eq(atividades.empresaId, empresa.id));
  await db.delete(csMarcos).where(eq(csMarcos.empresaId, empresa.id));
  await db.delete(tarefas).where(eq(tarefas.empresaId, empresa.id));
  await db.delete(clientes).where(eq(clientes.empresaId, empresa.id));
  await db.delete(empresas).where(eq(empresas.id, empresa.id));
  console.log("  limpo");

  console.log(`\n═══ ${passou} passaram, ${falhou} falharam ═══`);
  process.exit(falhou > 0 ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
