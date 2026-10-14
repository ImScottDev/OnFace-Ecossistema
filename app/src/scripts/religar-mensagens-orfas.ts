/**
 * Mensagem gravada sem conversa volta para a conversa do Atendimento.
 *
 * REGRA (Scott, 14/10/2026): *"cada vírgula, cada ponto tem que aparecer na aba
 * de atendimento, independente do canal"*. Mensagem com `contato_id` nulo existe
 * no banco e é **invisível para quem atende** — foi assim que o lembrete de
 * reunião do INVEST BANK saiu pelo WhatsApp da Mayra, foi entregue ao cliente, e
 * ela escreveu de novo 43 minutos depois sem saber que o sistema já tinha falado.
 *
 * A causa já está fechada (lembrete e cadência resolvem a conversa antes de
 * gravar, via `conversaParaEnvio`, e a trava `mensagem-cai-na-conversa.test.ts`
 * impede a volta). Este script é o reparo do histórico: 932 mensagens medidas em
 * produção em 14/10/2026.
 *
 * Usa a MESMA porta do envio (`conversaParaEnvio`): casa pelo telefone dentro da
 * sessão que enviou, depois pelo lead, e só então cria a conversa. Nada de regra
 * paralela de casamento.
 *
 *   npx tsx --env-file=.env src/scripts/religar-mensagens-orfas.ts            # simula
 *   npx tsx --env-file=.env src/scripts/religar-mensagens-orfas.ts --aplicar
 */

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { conversaParaEnvio } from "@/lib/atendimento/garantir-conversa";

const aplicar = process.argv.includes("--aplicar");

interface Orfa extends Record<string, unknown> {
  id: string;
  telefone: string;
  sessao_id: string | null;
  lead_id: string | null;
  organizacao_id: string | null;
  criado_em: string;
}

async function main() {
  /* `whatsapp_mensagens` não guarda organização: ela vem da sessão que enviou ou
     do lead. Sem nenhuma das duas não há tenant para resolver a conversa — essas
     ficam de fora e são contadas no fim, em vez de virarem conversa de ninguém. */
  const orfas = await db.execute<Orfa>(sql`
    SELECT m.id::text, m.telefone, m.sessao_id::text, m.lead_id::text,
           COALESCE(s.organizacao_id, l.organizacao_id)::text AS organizacao_id,
           m.created_at::text AS criado_em
      FROM whatsapp_mensagens m
      LEFT JOIN whatsapp_sessao s ON s.id = m.sessao_id
      LEFT JOIN leads l ON l.id = m.lead_id
     WHERE m.contato_id IS NULL
     ORDER BY m.created_at`);

  const semTenant = orfas.filter((m) => !m.organizacao_id);
  const tratáveis = orfas.filter((m) => m.organizacao_id && m.telefone?.replace(/\D/g, ""));
  console.log(`mensagens sem conversa: ${orfas.length} · sem tenant: ${semTenant.length} · tratáveis: ${tratáveis.length}`);

  if (!aplicar) {
    const porMes = new Map<string, number>();
    for (const m of tratáveis) porMes.set(m.criado_em.slice(0, 7), (porMes.get(m.criado_em.slice(0, 7)) ?? 0) + 1);
    for (const [mes, n] of [...porMes].sort()) console.log(`  ${mes}: ${n}`);
    console.log("simulação — rode com --aplicar para gravar.");
    return;
  }

  let religadas = 0;
  let semConversa = 0;
  for (const m of tratáveis) {
    const contatoId = await conversaParaEnvio(m.organizacao_id!, {
      leadId: m.lead_id,
      telefone: m.telefone,
      sessaoId: m.sessao_id,
    });
    if (!contatoId) { semConversa += 1; continue; }
    await db.execute(sql`
      UPDATE whatsapp_mensagens SET contato_id = ${contatoId}::uuid
       WHERE id = ${m.id}::uuid AND contato_id IS NULL`);
    religadas += 1;
  }

  const [sobrou] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM whatsapp_mensagens WHERE contato_id IS NULL`);
  console.log(`religadas: ${religadas} · sem conversa possível: ${semConversa} · ainda órfãs: ${sobrou.n}`);
}

void main().then(() => process.exit(0));
