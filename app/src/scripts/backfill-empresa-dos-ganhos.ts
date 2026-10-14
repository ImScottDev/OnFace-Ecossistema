/**
 * Backfill de `negocios.empresa_id` dos negócios GANHOS sem empresa.
 *
 * Medido em 14/10 (cópia de produção): 150 de 632 ganhos sem empresa, todos com lead e evidência de ganho. Cliente 360,
 * serviço canônico, conta de CS e implantação dependem de `empresa_id`. Em 120 o lead JÁ tinha empresa (o negócio
 * copiou o campo antes de o lead recebê-la); em 17 só havia o nome; em 13 não há dado utilizável.
 *
 * Usa a MESMA porta do Ganho (`garantirEmpresaDoNegocio`, lib/vendas/empresa-do-negocio.ts): negócio, lead,
 * oportunidade, CNPJ, domínio corporativo único, nome normalizado igual; só cria empresa quando nada casa, e cria
 * por `resolverEmpresa` (CNPJ > domínio > nome, sob lock), nunca com INSERT solto. O que não decide com segurança
 * vira caso em `reconciliacao_casos` (fase 'ganho-empresa', tipo GANHO_SEM_EMPRESA), nunca chute.
 *
 * Além do negócio, preenche `empresa_id` NULL dos filhos que apontam para ele (oportunidade, serviço canônico
 * criado pelo pós-venda, contratos, propostas, tarefas, atividades). Só preenche vazio; nunca troca valor.
 *
 * Garantias:
 *  - `--simular` é o padrão: roda TUDO dentro de uma transação e a desfaz no fim (nada fica no banco).
 *  - `--aplicar` faz tudo numa ÚNICA transação, com a tabela de backup `ganhos_empresa_bkp_<aaaammddhhmmss>`
 *    (tabela, id, organizacao_id, empresa_id_anterior, acao). Desfazer: para acao='preencheu' volte
 *    `empresa_id = empresa_id_anterior` (NULL) na `tabela` pelo id; para acao='empresa_criada' apague a empresa
 *    (se nada mais a usar).
 *  - Idempotente: depois de aplicado, só reaparecem os casos sem solução, e o caso aberto não duplica.
 *  - `organizacao_id` vem da linha do negócio; toda escrita confere id + organizacao_id.
 *  - Relógio preservado: `updated_at = updated_at` onde a tabela tem a coluna.
 *
 * NÃO cria serviço, entrega nem conta de CS por padrão (decisão humana: ver o relatório de pós-venda impresso).
 * `--conta-cs` (só com --aplicar, depois do commit) chama `garantirContaCsPorEmpresa`, idempotente, para cada empresa.
 *
 * Uso (da pasta app/):
 *   npx tsx --env-file=.env src/scripts/backfill-empresa-dos-ganhos.ts              # simula (padrão)
 *   npx tsx --env-file=.env src/scripts/backfill-empresa-dos-ganhos.ts --aplicar    # ESCREVE no banco
 *   ... --org=<uuid>   restringe a uma organização;   --listar   imprime os ids do pós-venda pendente
 */
export {}; // módulo próprio: sem isto o `main` cai no escopo global e colide com o de outro script.

const args = process.argv.slice(2);
const aplicar = args.includes("--aplicar");
const contaCs = args.includes("--conta-cs");
const listar = args.includes("--listar");
const org = args.find((a) => a.startsWith("--org="))?.slice(6) ?? null;

class DesfazerSimulacao extends Error {}

async function main() {
  if (aplicar && args.includes("--simular")) { console.error("Use --simular OU --aplicar, não os dois."); process.exit(2); }
  if (contaCs && !aplicar) { console.error("--conta-cs só vale com --aplicar."); process.exit(2); }
  if (org && !/^[0-9a-f-]{36}$/i.test(org)) { console.error("--org precisa ser um uuid."); process.exit(2); }
  const { db } = await import("../lib/db");
  const { sql } = await import("drizzle-orm");
  const { garantirEmpresaDoNegocio } = await import("../lib/vendas/empresa-do-negocio");

  console.log(aplicar ? "MODO: APLICAR (escreve no banco, com backup)" : "MODO: SIMULAR (tudo roda e é desfeito no fim; nada fica)");

  const alvos = await db.execute<{ id: string; organizacao_id: string }>(sql`
    SELECT id::text, organizacao_id::text FROM negocios
     WHERE status = 'ganho' AND empresa_id IS NULL
       AND (${org}::uuid IS NULL OR organizacao_id = ${org}::uuid)
     ORDER BY organizacao_id, ganho_at, id`);
  console.log(`Ganhos sem empresa: ${alvos.length}.`);
  if (alvos.length === 0) return;

  const lote = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const tabela = `ganhos_empresa_bkp_${lote}`; // só dígitos: seguro como identificador
  const porOrigem: Record<string, number> = {};
  const semSolucao: { id: string; org: string; motivo: string; pista: Record<string, unknown> }[] = [];
  const resolvidos: { id: string; org: string; empresaId: string }[] = [];
  const criadas = new Set<string>();
  const filhosPreenchidos: Record<string, number> = {};
  let posvenda: { id: string; cobertura: string }[] = [];

  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql.raw(`CREATE TABLE ${tabela} (tabela text NOT NULL, id uuid NOT NULL, organizacao_id uuid NOT NULL, empresa_id_anterior uuid, acao text NOT NULL)`));
      const ids = `{${alvos.map((a) => a.id).join(",")}}`; // array nunca vai direto ao Postgres: literal text[]
      // Backup do que vai ser tocado ANTES de tocar: negócios, oportunidades e leads sem empresa desses negócios.
      await tx.execute(sql.raw(`
        INSERT INTO ${tabela} SELECT 'negocios', id, organizacao_id, empresa_id, 'preencheu' FROM negocios WHERE id = ANY('${ids}'::uuid[])`));
      await tx.execute(sql.raw(`
        INSERT INTO ${tabela} SELECT 'oportunidades', id, organizacao_id, empresa_id, 'preencheu' FROM oportunidades
         WHERE negocio_id_legado = ANY('${ids}'::uuid[]) AND empresa_id IS NULL`));
      await tx.execute(sql.raw(`
        INSERT INTO ${tabela} SELECT DISTINCT 'leads', l.id, l.organizacao_id, l.empresa_id, 'preencheu' FROM leads l
          JOIN negocios n ON n.lead_id = l.id AND n.organizacao_id = l.organizacao_id
         WHERE n.id = ANY('${ids}'::uuid[]) AND l.empresa_id IS NULL`));

      for (const a of alvos) {
        const r = await garantirEmpresaDoNegocio(a.organizacao_id, a.id, tx);
        if (!r.ok) { semSolucao.push({ id: a.id, org: a.organizacao_id, motivo: r.motivo, pista: r.pista }); continue; }
        porOrigem[r.origem] = (porOrigem[r.origem] ?? 0) + 1;
        resolvidos.push({ id: a.id, org: a.organizacao_id, empresaId: r.empresaId });
        if (r.origem === "criada") criadas.add(`${a.organizacao_id}|${r.empresaId}`);
      }

      for (const c of criadas) {
        const [o, e] = c.split("|");
        await tx.execute(sql`INSERT INTO ${sql.raw(tabela)} VALUES ('empresas', ${e}::uuid, ${o}::uuid, NULL, 'empresa_criada')`);
      }

      // Filhos do negócio com empresa vazia: herdam a do negócio (só vazio; nunca troca).
      if (resolvidos.length > 0) {
        const rids = `{${resolvidos.map((r) => r.id).join(",")}}`;
        const filhos: { tabela: string; chave: string; atualiza: string }[] = [
          { tabela: "servicos_canonicos", chave: "x.evidence->>'negocioId' = n.id::text", atualiza: ", updated_at = x.updated_at" },
          { tabela: "contratos", chave: "x.negocio_id = n.id", atualiza: ", updated_at = x.updated_at" },
          { tabela: "propostas", chave: "x.negocio_id = n.id", atualiza: ", updated_at = x.updated_at" },
          { tabela: "tarefas", chave: "x.negocio_id = n.id", atualiza: "" },
          { tabela: "atividades", chave: "x.negocio_id = n.id", atualiza: "" },
        ];
        for (const f of filhos) {
          const escopo = `n.id = ANY('${rids}'::uuid[]) AND n.organizacao_id = x.organizacao_id AND n.empresa_id IS NOT NULL AND x.empresa_id IS NULL AND ${f.chave}`;
          await tx.execute(sql.raw(`
            INSERT INTO ${tabela} SELECT DISTINCT '${f.tabela}', x.id, x.organizacao_id, NULL::uuid, 'preencheu'
              FROM ${f.tabela} x JOIN negocios n ON TRUE WHERE ${escopo}`));
          const feito = await tx.execute<{ n: number }>(sql.raw(`
            WITH u AS (UPDATE ${f.tabela} x SET empresa_id = n.empresa_id${f.atualiza}
                         FROM negocios n WHERE ${escopo} RETURNING x.id)
            SELECT count(*)::int AS n FROM u`));
          filhosPreenchidos[f.tabela] = feito[0]?.n ?? 0;
        }

        // O que falta do pós-venda, por negócio resolvido (nada é criado aqui).
        const cob = await tx.execute<{ id: string; cobertura: string }>(sql.raw(`
          SELECT n.id::text AS id,
                 CASE
                   WHEN EXISTS (SELECT 1 FROM servicos_canonicos s WHERE s.organizacao_id = n.organizacao_id AND s.evidence->>'negocioId' = n.id::text)
                     THEN 'servico_do_negocio'
                   WHEN EXISTS (SELECT 1 FROM servicos_canonicos s JOIN fulfillments f ON f.servico_canonico_id = s.id
                                 WHERE s.organizacao_id = n.organizacao_id AND s.empresa_id = n.empresa_id)
                     THEN 'empresa_ja_tem_entrega'
                   ELSE 'sem_posvenda'
                 END AS cobertura
            FROM negocios n WHERE n.id = ANY('${rids}'::uuid[])`));
        posvenda = [...cob];
      }

      // Pendência visível: um caso aberto por negócio sem solução (não duplica).
      for (const s of semSolucao) {
        await tx.execute(sql`
          INSERT INTO reconciliacao_casos (organizacao_id, fase, tipo, entidade_alvo, origens, evidencia, sugestao)
          VALUES (${s.org}::uuid, 'ganho-empresa', 'GANHO_SEM_EMPRESA', ${"negocio:" + s.id},
                  ${JSON.stringify([{ tabela: "negocios", id: s.id }])}::jsonb,
                  ${JSON.stringify({ motivo: s.motivo, ...s.pista })}::jsonb,
                  ${JSON.stringify({ acao: "vincular ou cadastrar a empresa do negócio" })}::jsonb)
          ON CONFLICT DO NOTHING`);
      }

      if (resolvidos.length === 0) await tx.execute(sql.raw(`DROP TABLE ${tabela}`)); // nada mudou: sem backup à toa

      if (!aplicar) throw new DesfazerSimulacao();
    });
  } catch (e) {
    if (!(e instanceof DesfazerSimulacao)) throw e;
  }

  const cobertura: Record<string, number> = {};
  for (const p of posvenda) cobertura[p.cobertura] = (cobertura[p.cobertura] ?? 0) + 1;
  console.log(`Resolvidos: ${resolvidos.length} (por origem)`, porOrigem, `| empresas criadas: ${criadas.size}`);
  console.log(`Sem solução (viram caso em reconciliacao_casos): ${semSolucao.length}`);
  console.table(semSolucao.map((s) => ({ negocio: s.id, motivo: s.motivo, lead: s.pista.leadNome, email: s.pista.leadEmail })));
  console.log("Filhos com empresa preenchida:", filhosPreenchidos);
  console.log("Pós-venda dos resolvidos:", cobertura);
  if (listar) console.log("sem_posvenda (candidatos a `posvenda:reprocessar`):\n" + posvenda.filter((p) => p.cobertura === "sem_posvenda").map((p) => p.id).join("\n"));

  if (!aplicar) { console.log("Nada foi escrito (transação desfeita). Use --aplicar para gravar."); return; }
  console.log(resolvidos.length > 0 ? `Aplicado. Backup: ${tabela}` : "Nada a gravar.");

  if (contaCs && resolvidos.length > 0) {
    const { garantirContaCsPorEmpresa } = await import("../lib/cs/handoff");
    const vistos = new Set<string>();
    let novas = 0;
    for (const r of resolvidos) {
      if (vistos.has(r.empresaId)) continue;
      vistos.add(r.empresaId);
      const [lead] = await db.execute<{ lead_id: string | null; ganho_at: string | null }>(sql`
        SELECT lead_id::text, ganho_at::text FROM negocios WHERE id = ${r.id}::uuid AND organizacao_id = ${r.org}::uuid`);
      const { criada } = await garantirContaCsPorEmpresa({
        organizacaoId: r.org, empresaId: r.empresaId, leadId: lead?.lead_id ?? null, entrouEm: lead?.ganho_at ? new Date(lead.ganho_at) : null,
      });
      if (criada) novas++;
    }
    console.log(`Contas de CS: ${novas} criadas, ${vistos.size - novas} já existiam.`);
  }
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
