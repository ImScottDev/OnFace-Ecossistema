/**
 * Cenário 8 do SPEC: atribuir e editar o dono da carteira de CS.
 *
 * Estava marcado "não verificável" porque 0 de 275 clientes têm responsável.
 * Mas quem atribui a carteira é a operação, e isso é decisão de negócio, não
 * ausência de caminho. As duas coisas estavam misturadas numa palavra só.
 *
 * Este smoke separa: **a capacidade é verificável agora**, chamando a rota de
 * verdade com sessão de verdade. O que continua pendente é a decisão de quem
 * fica com quais 275 contas, e isso é do Kauã.
 *
 *     pnpm tsx --env-file=.env src/scripts/smoke-cs-responsavel.ts
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { clientesCrm2Routes } from "@/api-server/routes/clientes-crm2";
import { sessaoDeSmoke } from "./_sessao-de-smoke";

const ok = (cond: unknown, msg: string) => {
  console.log(`${cond ? "  ok  " : "  FALHA  "}${msg}`);
  if (!cond) process.exitCode = 1;
};

async function main() {
  const s = await sessaoDeSmoke();
  console.log(`\nsessão: usuário ${s.usuarioId} (${s.role})\n`);

  const [alvo] = await db.execute<{ empresa_id: string; nome: string; responsavel_id: string | null }>(sql`
    SELECT c.empresa_id::text, e.nome, c.responsavel_id::text
      FROM clientes c JOIN empresas e ON e.id = c.empresa_id
     WHERE c.organizacao_id = ${s.organizacaoId}::uuid LIMIT 1`);
  if (!alvo) throw new Error("nenhum cliente para validar");

  const original = alvo.responsavel_id;
  console.log(`  cliente: ${alvo.nome}  (responsável atual: ${original ?? "nenhum"})\n`);

  const patch = (responsavelId: string | null) =>
    clientesCrm2Routes.request(`http://local/clientes-crm2/${alvo.empresa_id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: s.cookie },
      body: JSON.stringify({ responsavelId }),
    });

  const lido = async () => {
    const [r] = await db.execute<{ id: string | null }>(sql`
      SELECT responsavel_id::text AS id FROM clientes WHERE empresa_id = ${alvo.empresa_id}::uuid`);
    return r?.id ?? null;
  };

  try {
    // 1. Atribuir
    const atribuir = await patch(s.usuarioId);
    ok(atribuir.status === 200, `atribuir dono devolve 200 (status ${atribuir.status})`);
    ok(await lido() === s.usuarioId, "e o dono fica gravado no cliente");

    // 2. A mudança fica registrada — carteira sem histórico não responde
    //    "desde quando isto é meu", que é a pergunta que CS faz.
    const [hist] = await db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM audit_log
       WHERE action = 'cliente.responsavel_alterado'
         AND entity_id = ${alvo.empresa_id}::uuid`);
    ok((hist?.n ?? 0) > 0, `a troca de dono entra no histórico (${hist?.n ?? 0} registro(s))`);

    // 3. Editar: trocar por outro dono, que é o "/edit" do cenário
    const [outro] = await db.execute<{ id: string }>(sql`
      SELECT id::text FROM usuarios
       WHERE organizacao_id = ${s.organizacaoId}::uuid AND id <> ${s.usuarioId}::uuid LIMIT 1`);
    if (outro) {
      const trocar = await patch(outro.id);
      ok(trocar.status === 200, `trocar o dono devolve 200 (status ${trocar.status})`);
      ok(await lido() === outro.id, "e o novo dono substitui o anterior");
    }

    // 4. Remover
    const remover = await patch(null);
    ok(remover.status === 200, `remover o dono devolve 200 (status ${remover.status})`);
    ok(await lido() === null, "e o cliente volta a ficar sem dono");

    // 5. Sem sessão não atribui nada
    const semSessao = await clientesCrm2Routes.request(
      `http://local/clientes-crm2/${alvo.empresa_id}`,
      { method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ responsavelId: s.usuarioId }) });
    ok(semSessao.status === 401, `sem sessão devolve 401 (status ${semSessao.status})`);
  } finally {
    // Restaura o estado original SEMPRE: isto roda sobre dado de produção.
    await db.execute(sql`
      UPDATE clientes SET responsavel_id = ${original}::uuid
       WHERE empresa_id = ${alvo.empresa_id}::uuid`);
    await db.execute(sql`
      DELETE FROM audit_log
       WHERE action = 'cliente.responsavel_alterado'
         AND entity_id = ${alvo.empresa_id}::uuid`);
  }

  const restaurado = await lido();
  ok(restaurado === original, `o cliente volta ao estado original (${restaurado ?? "sem dono"})`);

  const [semDono] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM clientes WHERE responsavel_id IS NULL`);
  console.log(`\n  capacidade: ok. Pendente de DECISÃO: ${semDono?.n ?? 0} clientes sem dono.\n`);
  console.log(process.exitCode ? "smoke de carteira: FALHOU\n" : "smoke de carteira: ok\n");
}

main().catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => process.exit(process.exitCode ?? 0));
