/**
 * Conversa de WhatsApp volta a encontrar o lead — e o marco de primeiro contato
 * é derivado da primeira mensagem de saída.
 *
 * Duas coisas medidas em produção em 14/10/2026, com a mesma causa:
 *
 *   - **2.024 de 2.683 conversas sem `lead_id`**, porque a criação da conversa
 *     nunca consultou `leads` por telefone. **769 casam** com um lead que já
 *     existe. A conversa existe, a ficha existe, e as duas não se conhecem.
 *   - **3.589 leads sem `primeiro_contato_at`, 542 deles já com mensagem de
 *     saída.** O SLA de Pré-vendas errava por um fator de ~7 nesse recorte.
 *
 * A ordem aqui importa e é o motivo de ser UM script: ligar a conversa ao lead é
 * o que torna a mensagem atribuível, e só então o marco pode ser derivado dela.
 *
 * A causa já está fechada no runtime: a porta `ligarConversaAoLead`
 * (lib/atendimento/lead-da-conversa.ts) casa por telefone no envio pelo
 * Atendimento, e `marcarPrimeiroContatoPorEtapa` (lib/vendas/pre-vendas.ts)
 * grava o marco em toda etapa de trabalho. Este script é o reparo do passivo.
 *
 * O marco entra pela porta canônica (`registrarPrimeiroContato`), com a data da
 * mensagem — não "agora", que mentiria no relatório de tempo até o 1º contato. E
 * **sem mover o card**: remexer a etapa de centenas de leads antigos mudaria o
 * board de quem está operando, e o que falta é o marco, não a posição.
 *
 *   npx tsx --env-file=.env src/scripts/religar-conversa-ao-lead.ts              # simula (padrão)
 *   npx tsx --env-file=.env src/scripts/religar-conversa-ao-lead.ts --simular    # idem, explícito
 *   npx tsx --env-file=.env src/scripts/religar-conversa-ao-lead.ts --aplicar    # grava
 *
 * Simulado no espelho de produção em 14/10/2026: 739 conversas casam por
 * telefone (17.709 mensagens voltam para uma ficha) e 714 leads recebem o marco.
 */

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { leadPorTelefone, ligarConversaAoLead } from "@/lib/atendimento/lead-da-conversa";
import { registrarPrimeiroContato } from "@/lib/vendas/pre-vendas";
import { ATOR_SISTEMA } from "@/lib/vendas/dominio";

const aplicar = process.argv.includes("--aplicar");

interface ConversaSemLead extends Record<string, unknown> {
  id: string;
  organizacao_id: string;
  telefone: string | null;
  mensagens: number;
}

interface LeadSemMarco extends Record<string, unknown> {
  id: string;
  organizacao_id: string;
  primeiro: string;
}

async function conversas(): Promise<void> {
  const linhas = await db.execute<ConversaSemLead>(sql`
    SELECT c.id::text, c.organizacao_id::text, c.telefone,
           (SELECT count(*)::int FROM whatsapp_mensagens m WHERE m.contato_id = c.id) AS mensagens
      FROM contatos c
     WHERE c.lead_id IS NULL AND c.telefone IS NOT NULL
     ORDER BY c.created_at`);

  let ligadas = 0;
  let semLead = 0;
  let mensagensRecuperadas = 0;
  for (const c of linhas) {
    const leadId = aplicar
      ? await ligarConversaAoLead({ organizacaoId: c.organizacao_id, contatoId: c.id, telefone: c.telefone })
      /* Simulação não escreve: pergunta só o casamento, pela MESMA função. */
      : await leadPorTelefone(c.organizacao_id, c.telefone);
    if (!leadId) { semLead += 1; continue; }
    ligadas += 1;
    mensagensRecuperadas += c.mensagens;
  }

  console.log(`conversas sem lead: ${linhas.length} · casam por telefone: ${ligadas} · sem lead possível: ${semLead}`);
  console.log(`  mensagens que voltam para uma ficha: ${mensagensRecuperadas}`);
}

async function primeiroContato(): Promise<void> {
  /* `min(created_at)` da saída: a mensagem mais antiga é o primeiro contato real.
     Olha a mensagem ligada ao lead E a ligada à conversa dele — a segunda só
     existe depois do passo acima, que é por isso que ele vem primeiro. */
  const linhas = await db.execute<LeadSemMarco>(sql`
    SELECT l.id::text, l.organizacao_id::text, pc.primeiro::text
      FROM leads l
      JOIN LATERAL (
        SELECT min(m.created_at) AS primeiro
          FROM whatsapp_mensagens m
         WHERE m.direcao = 'out'
           AND (m.lead_id = l.id
                OR m.contato_id IN (SELECT c.id FROM contatos c WHERE c.lead_id = l.id))
      ) pc ON pc.primeiro IS NOT NULL
     WHERE l.primeiro_contato_at IS NULL
     ORDER BY pc.primeiro`);

  console.log(`leads sem primeiro contato que já receberam mensagem de saída: ${linhas.length}`);
  if (!aplicar) {
    /* Na simulação o passo 1 não gravou, então este número é o piso: com as
       conversas religadas, mais mensagens passam a ser atribuíveis a um lead. */
    console.log("  (piso: conta só o que já está ligado hoje)");
    return;
  }

  let gravados = 0;
  let falhas = 0;
  for (const l of linhas) {
    try {
      const { registrado } = await registrarPrimeiroContato({
        organizacaoId: l.organizacao_id, leadId: l.id, canal: "whatsapp",
        ator: ATOR_SISTEMA, ocorridoEm: new Date(l.primeiro),
        origem: "backfill_mensagem_de_saida", moverParaEmContato: false,
      });
      if (registrado) gravados += 1;
    } catch (e) {
      falhas += 1;
      console.warn(`  lead ${l.id} não recebeu o marco:`, e instanceof Error ? e.message : e);
    }
  }
  console.log(`  marcos gravados: ${gravados} · falhas: ${falhas}`);
}

async function main() {
  console.log(aplicar ? "APLICANDO" : "SIMULAÇÃO (rode com --aplicar para gravar)");

  console.log("\n[1/2] conversa → lead");
  await conversas();

  console.log("\n[2/2] primeiro contato ← primeira mensagem de saída");
  await primeiroContato();

  const [resto] = await db.execute<{ conversas: number; leads: number }>(sql`
    SELECT (SELECT count(*)::int FROM contatos WHERE lead_id IS NULL) AS conversas,
           (SELECT count(*)::int FROM leads WHERE primeiro_contato_at IS NULL) AS leads`);
  console.log(`\nainda sem lead: ${resto.conversas} conversas · ainda sem primeiro contato: ${resto.leads} leads`);
}

void main().then(() => process.exit(0));
