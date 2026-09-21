/**
 * Fase 05 do refactor — backfill de identidade (SPEC §40).
 *
 * Preenche `pessoas` e `pessoa_empresa_vinculos` a partir de `leads` e
 * `contatos`, que hoje carregam a identidade humana misturada com processo
 * comercial.
 *
 * Princípios que este script respeita, todos do SPEC §40 e §56:
 *
 *   - resolução DETERMINÍSTICA: e-mail normalizado, depois telefone
 *     normalizado, depois a própria linha de origem. Nunca nome aproximado.
 *   - ambiguidade não vira palpite: abre caso em `reconciliacao_casos`.
 *   - idempotente: rodar de novo não duplica nada, porque toda criação passa
 *     por `backfill_provenance`, que tem chave única por (entidade, origem).
 *   - nada de origem é alterado ou apagado. Este script só INSERE.
 *
 * Uso:
 *   pnpm tsx --env-file=.env src/scripts/backfill/05-identidade.ts          # simulação
 *   pnpm tsx --env-file=.env src/scripts/backfill/05-identidade.ts --aplicar
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

const APLICAR = process.argv.includes("--aplicar");

/** E-mail comparável: caixa baixa, sem espaço. Não remove subendereço (+tag),
 *  porque `joao+crm@acme.com` pode ser conta distinta de propósito. */
function normalizarEmail(v: string | null): string | null {
  const e = (v ?? "").trim().toLowerCase();
  if (!e || !e.includes("@") || e.length < 5) return null;
  return e;
}

/** Só dígitos, sem o 55 do país. Menos de 10 dígitos não identifica ninguém
 *  no Brasil (DDD + 8), então não serve como chave. */
function normalizarTelefone(v: string | null): string | null {
  const d = (v ?? "").replace(/\D/g, "");
  const semPais = d.startsWith("55") && d.length > 11 ? d.slice(2) : d;
  return semPais.length >= 10 ? semPais : null;
}

type LinhaLead = {
  id: string; organizacao_id: string; nome: string | null; sobrenome: string | null;
  email: string | null; telefone: string | null; cargo: string | null;
  empresa_id: string | null; created_at: Date;
};

async function main() {
  const t0 = Date.now();
  console.log(`\nBackfill de identidade — ${APLICAR ? "APLICANDO" : "SIMULAÇÃO (use --aplicar para gravar)"}\n`);

  const leads = await db.execute<LinhaLead>(sql`
    SELECT id, organizacao_id, nome, sobrenome, email, telefone, cargo, empresa_id, created_at
    FROM leads ORDER BY created_at ASC, id ASC
  `);

  // Agrupa por chave de identidade. A ordem de precedência importa: quem tem
  // e-mail é agrupado por e-mail mesmo que também tenha telefone, senão duas
  // pessoas que dividem um telefone de empresa virariam uma só.
  const grupos = new Map<string, { chave: string; metodo: string; leads: LinhaLead[] }>();
  const semIdentificador: LinhaLead[] = [];

  for (const l of leads) {
    const email = normalizarEmail(l.email);
    const tel = normalizarTelefone(l.telefone);
    let chave: string, metodo: string;
    if (email) { chave = `email:${email}`; metodo = "EMAIL"; }
    else if (tel) { chave = `telefone:${tel}`; metodo = "TELEFONE"; }
    else {
      // Sem e-mail e sem telefone não há como saber se duas linhas são a mesma
      // pessoa. Cada uma vira uma pessoa própria, com a origem registrada.
      semIdentificador.push(l);
      chave = `lead:${l.id}`; metodo = "ORIGEM_UNICA";
    }
    if (!grupos.has(chave)) grupos.set(chave, { chave, metodo, leads: [] });
    grupos.get(chave)!.leads.push(l);
  }

  // Ambiguidade de EMPRESA dentro de um grupo: a mesma pessoa aparecendo com
  // empresas diferentes é fato real (trocou de emprego), mas qual é a atual
  // não se decide por heurística. Vira vínculo múltiplo + caso aberto.
  const casos: { chave: string; evidencia: unknown }[] = [];
  let pessoasNovas = 0, vinculosNovos = 0, jaExistiam = 0;

  for (const g of grupos.values()) {
    const empresas = [...new Set(g.leads.map((l) => l.empresa_id).filter(Boolean))] as string[];
    if (empresas.length > 1) {
      casos.push({
        chave: g.chave,
        evidencia: { leads: g.leads.map((l) => l.id), empresas, motivo: "mesma identidade com mais de uma empresa" },
      });
    }

    // O registro mais antigo do grupo define os dados base; os seguintes só
    // completam campo vazio. Assim o backfill não sobrescreve o dado original
    // com uma versão posterior pior.
    const base = g.leads[0];
    const completo = <K extends keyof LinhaLead>(campo: K): LinhaLead[K] =>
      g.leads.find((l) => l[campo] != null && String(l[campo]).trim() !== "")?.[campo] ?? base[campo];

    if (!APLICAR) { pessoasNovas++; vinculosNovos += empresas.length; continue; }

    const r = await db.execute<{ id: string; criada: boolean }>(sql`
      WITH ja AS (
        SELECT id_canonico AS id FROM backfill_provenance
        WHERE entidade_canonica = 'pessoa' AND tabela_origem = 'leads' AND id_origem = ${base.id}::text
      ), nova AS (
        INSERT INTO pessoas (organizacao_id, empresa_id, nome, sobrenome, email, telefone, cargo, lead_id_legado, metadata, created_at)
        SELECT ${base.organizacao_id}::uuid, ${empresas[0] ?? null}::uuid,
               ${completo("nome") ?? "Sem nome"}, ${completo("sobrenome")},
               ${completo("email")}, ${completo("telefone")}, ${completo("cargo")},
               ${base.id}::uuid,
               ${JSON.stringify({ backfill: { fase: "05", chave: g.chave, metodo: g.metodo, leads: g.leads.map((l) => l.id) } })}::jsonb,
               ${base.created_at}
        WHERE NOT EXISTS (SELECT 1 FROM ja)
        RETURNING id
      )
      SELECT id, true AS criada FROM nova
      UNION ALL SELECT id, false AS criada FROM ja LIMIT 1
    `);
    const pessoaId = r[0]?.id;
    if (!pessoaId) continue;
    if (r[0].criada) pessoasNovas++; else jaExistiam++;

    // Provenance de cada lead do grupo, não só do primeiro: é o que permite
    // responder depois "de onde veio esta pessoa" para qualquer origem.
    for (const l of g.leads) {
      await db.execute(sql`
        INSERT INTO backfill_provenance (organizacao_id, fase, entidade_canonica, id_canonico, tabela_origem, id_origem, chave_identidade, metodo)
        VALUES (${l.organizacao_id}::uuid, '05', 'pessoa', ${pessoaId}::uuid, 'leads', ${l.id}::text, ${g.chave}, ${g.metodo})
        ON CONFLICT (entidade_canonica, tabela_origem, id_origem) DO NOTHING
      `);
    }

    // Vínculo por empresa distinta. `principal` fica com a primeira só quando
    // há uma única empresa; havendo mais de uma, nenhuma é marcada principal e
    // o caso de reconciliação decide.
    for (const empresaId of empresas) {
      const res = await db.execute<{ id: string }>(sql`
        INSERT INTO pessoa_empresa_vinculos (organizacao_id, pessoa_id, empresa_id, papel, cargo, principal)
        SELECT ${base.organizacao_id}::uuid, ${pessoaId}::uuid, ${empresaId}::uuid, 'contato_principal', ${completo("cargo")}, ${empresas.length === 1}
        WHERE NOT EXISTS (
          SELECT 1 FROM pessoa_empresa_vinculos WHERE pessoa_id = ${pessoaId}::uuid AND empresa_id = ${empresaId}::uuid
        )
        RETURNING id
      `);
      if (res[0]) vinculosNovos++;
    }
  }

  if (APLICAR) {
    for (const c of casos) {
      await db.execute(sql`
        INSERT INTO reconciliacao_casos (organizacao_id, fase, tipo, entidade_alvo, origens, evidencia, sugestao)
        VALUES ((SELECT id FROM organizacoes LIMIT 1), '05', 'IDENTIDADE_MULTIPLA_EMPRESA', ${c.chave},
                ${JSON.stringify(c.evidencia)}::jsonb, ${JSON.stringify(c.evidencia)}::jsonb,
                ${JSON.stringify({ acao: "definir qual vínculo é o principal; nenhum foi marcado" })}::jsonb)
        ON CONFLICT (fase, tipo, entidade_alvo, status) DO NOTHING
      `);
    }
  }

  const porMetodo = new Map<string, number>();
  for (const g of grupos.values()) porMetodo.set(g.metodo, (porMetodo.get(g.metodo) ?? 0) + 1);

  console.log("RELATÓRIO DE RECONCILIAÇÃO — fase 05, identidade\n");
  console.log(`  linhas de origem (leads)      ${leads.length}`);
  console.log(`  grupos de identidade          ${grupos.size}`);
  for (const [m, n] of [...porMetodo].sort()) console.log(`    por ${m.toLowerCase().padEnd(24)}${n}`);
  console.log(`  colapso por chave repetida    ${leads.length - grupos.size}`);
  console.log(`  sem e-mail e sem telefone     ${semIdentificador.length}  (viraram pessoa própria)`);
  console.log(`  pessoas criadas               ${pessoasNovas}`);
  console.log(`  pessoas que já existiam       ${jaExistiam}`);
  console.log(`  vínculos pessoa-empresa       ${vinculosNovos}`);
  console.log(`  casos de reconciliação        ${casos.length}  (identidade com mais de uma empresa)`);
  console.log(`\n  ${Math.round((Date.now() - t0) / 100) / 10}s\n`);

  if (!APLICAR) console.log("  Nada foi gravado. Rode com --aplicar para efetivar.\n");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
