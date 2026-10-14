/**
 * Quem PERDE acesso a conversa de WhatsApp com a regra da migration 0126 (13/10/2026).
 *
 * Só leitura, só CONTAGENS e rótulos de número: nenhuma mensagem, nenhum telefone. Compara, usuário
 * por usuário da organização, o que a regra ANTIGA entregava (cargo = organização inteira para
 * admin/director/operations/super_admin; time para gerente/coordinator) com o que a regra nova entrega
 * (as minhas + supervisão explícita; super admin = não privadas). Rode ANTES do deploy, em homologação
 * (banco cópia), e use a saída para decidir quem recebe supervisão (POST /api/whatsapp/supervisao).
 *
 *   npx tsx --env-file=.env src/scripts/relatorio-acesso-whatsapp.ts
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { condicaoConversa, superAdminAgindo } from "@/lib/whatsapp/acesso";

/** A regra ANTIGA, congelada aqui só para a comparação: o cargo decidia. */
function regraAntiga(role: string, userId: string) {
  const minhas = sql`(c.responsavel_id = ${userId}::uuid
    OR EXISTS (SELECT 1 FROM whatsapp_sessao w WHERE w.id = c.sessao_id AND (w.usuario_id = ${userId}::uuid
         OR EXISTS (SELECT 1 FROM whatsapp_sessao_acesso a WHERE a.sessao_id = w.id AND a.usuario_id = ${userId}::uuid)))
    OR (c.responsavel_id IS NULL AND c.sessao_id IS NULL))`;
  if (["super_admin", "admin", "director", "operations"].includes(role)) return sql`TRUE`;
  if (role === "gerente" || role === "coordinator") {
    const time = sql`(SELECT u.id FROM usuarios u WHERE u.id = ${userId}::uuid
        OR u.team_id IN (SELECT t.id FROM teams t WHERE t.manager_id = ${userId}::uuid)
        OR (u.team_id IS NOT NULL AND u.team_id = (SELECT me.team_id FROM usuarios me WHERE me.id = ${userId}::uuid)))`;
    return sql`(${minhas} OR c.responsavel_id IN ${time}
      OR EXISTS (SELECT 1 FROM whatsapp_sessao w2 WHERE w2.id = c.sessao_id AND w2.usuario_id IN ${time}))`;
  }
  return minhas;
}

async function main() {
  const orgs = await db.execute<{ id: string; nome: string }>(sql`SELECT id::text, nome FROM organizacoes ORDER BY nome`);
  for (const org of orgs) {
    const pessoas = await db.execute<{ id: string; nome: string; role: string }>(sql`
      SELECT id::text, nome, role FROM usuarios WHERE organizacao_id = ${org.id}::uuid AND ativo AND tipo <> 'agente' ORDER BY nome`);
    const [tot] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM contatos WHERE organizacao_id = ${org.id}::uuid AND canal = 'whatsapp'`);
    const privados = await db.execute<{ label: string; dono: string | null }>(sql`
      SELECT COALESCE(NULLIF(btrim(s.label), ''), s.session_name) AS label, u.nome AS dono
        FROM whatsapp_sessao s LEFT JOIN usuarios u ON u.id = s.usuario_id
       WHERE s.organizacao_id = ${org.id}::uuid AND s.privado ORDER BY label`);
    console.log(`\n== ${org.nome}: ${tot?.n ?? 0} conversas de WhatsApp; números PRIVADOS: ${privados.map((p) => `${p.label} (${p.dono ?? "sem dono"})`).join(", ") || "nenhum"}`);
    console.log("pessoa | cargo | via cargo (antes) | agora (equipe) | perde | perde conversas de");
    for (const p of pessoas) {
      const ator = { userId: p.id, userRole: p.role, realRole: p.role, organizacaoId: org.id };
      const [r] = await db.execute<{ antes: number; agora: number; perde: number }>(sql`
        SELECT count(*) FILTER (WHERE ${regraAntiga(p.role, p.id)})::int AS antes,
               count(*) FILTER (WHERE ${condicaoConversa(ator, "equipe", sql`c.responsavel_id`, sql`c.sessao_id`)})::int AS agora,
               count(*) FILTER (WHERE ${regraAntiga(p.role, p.id)} AND NOT ${condicaoConversa(ator, "equipe", sql`c.responsavel_id`, sql`c.sessao_id`)})::int AS perde
          FROM contatos c WHERE c.organizacao_id = ${org.id}::uuid AND c.canal = 'whatsapp'`);
      if (r.perde === 0) continue;
      const donos = await db.execute<{ dono: string | null; n: number }>(sql`
        SELECT u.nome AS dono, count(*)::int AS n
          FROM contatos c LEFT JOIN whatsapp_sessao s ON s.id = c.sessao_id LEFT JOIN usuarios u ON u.id = s.usuario_id
         WHERE c.organizacao_id = ${org.id}::uuid AND c.canal = 'whatsapp'
           AND ${regraAntiga(p.role, p.id)} AND NOT ${condicaoConversa(ator, "equipe", sql`c.responsavel_id`, sql`c.sessao_id`)}
         GROUP BY 1 ORDER BY 2 DESC LIMIT 6`);
      console.log(`${p.nome} | ${p.role}${superAdminAgindo(ator) ? " (super)" : ""} | ${r.antes} | ${r.agora} | ${r.perde} | ${donos.map((d) => `${d.dono ?? "sem número"}: ${d.n}`).join("; ")}`);
    }
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
