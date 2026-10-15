/**
 * O lead de uma conversa de WhatsApp, casado pelo telefone.
 *
 * Quem chega pelo WhatsApp gera conversa em `contatos` sem `lead_id`: a criação
 * nunca consultou `leads` por telefone. Medido em produção em 14/10/2026:
 * **2.024 de 2.683 conversas sem lead, e 769 delas casam por telefone com um
 * lead que já existe**. A conversa existe, a ficha existe, e as duas não se
 * conhecem — a mensagem vive fora de qualquer ficha e o marco de primeiro
 * contato nunca é escrito, porque o envio não sabe a qual lead pertence.
 *
 * Porta ÚNICA do casamento: criação da conversa, envio pelo Atendimento e o
 * script de reparo (`scripts/religar-conversa-ao-lead.ts`) usam esta função.
 * Regra paralela de casamento foi exatamente como as duas verdades nasceram.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { phoneLastDigits } from "@/lib/whatsapp/phone-utils";

/**
 * O lead daquele número na organização, ou `null`.
 *
 * Casa pelos últimos 9 dígitos (DDD + número), que é o mesmo critério de
 * `phoneLastDigits` já usado no cross-save e na busca de conversa: o lead de
 * Pré-vendas costuma vir sem o 55 e o contato do WhatsApp sempre vem com ele.
 *
 * Com mais de um candidato, vence o processo de Pré-vendas ainda aberto e, entre
 * iguais, o mais recentemente tocado — nunca um cadastro encerrado anos atrás.
 */
export async function leadPorTelefone(organizacaoId: string, telefone: string | null | undefined): Promise<string | null> {
  const ultimos = phoneLastDigits(telefone ?? "");
  if (ultimos.length < 9) return null;
  const [lead] = await db.execute<{ id: string }>(sql`
    SELECT l.id::text
      FROM leads l
     WHERE l.organizacao_id = ${organizacaoId}::uuid
       -- '[^0-9]' e não '\D': o template do Drizzle consome a barra invertida
       -- do literal JS, e '\D' chegaria no Postgres como a letra D.
       AND (right(regexp_replace(COALESCE(l.telefone, ''), '[^0-9]', '', 'g'), 9) = ${ultimos}
         OR right(regexp_replace(COALESCE(l.whatsapp, ''), '[^0-9]', '', 'g'), 9) = ${ultimos})
     ORDER BY (l.tipo = 'lead') DESC,
              (COALESCE(l.estagio_pre_vendas, 'novo') NOT IN ('desqualificado', 'nutricao')) DESC,
              COALESCE(l.updated_at, l.created_at) DESC
     LIMIT 1`);
  return lead?.id ?? null;
}

/**
 * Liga a conversa ao lead do mesmo número e devolve o lead da conversa.
 *
 * Idempotente e não rouba: `COALESCE` mantém o vínculo que já existe, então
 * conversa já ligada a OUTRO lead continua dele. Devolve o `lead_id` final da
 * conversa — o antigo quando havia, o casado quando não.
 */
export async function ligarConversaAoLead(params: {
  organizacaoId: string;
  contatoId: string;
  telefone: string | null | undefined;
}): Promise<string | null> {
  const casado = await leadPorTelefone(params.organizacaoId, params.telefone);
  if (!casado) return null;
  const [linha] = await db.execute<{ lead_id: string | null }>(sql`
    UPDATE contatos
       SET lead_id = COALESCE(lead_id, ${casado}::uuid), updated_at = now()
     WHERE id = ${params.contatoId}::uuid AND organizacao_id = ${params.organizacaoId}::uuid
       /* idx_contatos_lead_responsavel é único por (lead, responsável): o
          produto quer UMA conversa por lead para cada atendente. Quando o mesmo
          número já tem conversa ligada àquele lead com o mesmo responsável,
          ligar a segunda estouraria o índice e derrubaria quem só queria
          gravar. Nesse caso a conversa fica como está — o histórico já tem
          dono, e juntar as duas é decisão de produto, não de reparo. */
       AND NOT EXISTS (
         SELECT 1 FROM contatos o
          WHERE o.organizacao_id = ${params.organizacaoId}::uuid
            AND o.lead_id = ${casado}::uuid
            AND o.id <> ${params.contatoId}::uuid
            AND o.responsavel_id IS NOT DISTINCT FROM contatos.responsavel_id)
     RETURNING lead_id::text`);
  return linha?.lead_id ?? null;
}

/**
 * O lead com que uma conversa NOVA pode já nascer ligada, ou `null`.
 *
 * Mesmo casamento de `leadPorTelefone`, respeitando o limite que
 * `idx_contatos_lead_responsavel` impõe: UMA conversa por lead para cada
 * atendente. Quando aquele lead já tem conversa com esse mesmo responsável, a
 * nova nasce SEM lead em vez de estourar o índice — e estourar aqui não é um
 * vínculo a menos, é a MENSAGEM DO CLIENTE PERDIDA: o insert da conversa
 * acontece antes do insert da mensagem, e o job inteiro morre.
 *
 * Mesma escolha de `ligarConversaAoLead`: a conversa fica sem vínculo e o
 * Atendimento religa depois, porque juntar duas conversas do mesmo lead é
 * decisão de produto, não de gravação.
 */
export async function leadParaNovaConversa(params: {
  organizacaoId: string;
  telefone: string | null | undefined;
  responsavelId: string | null;
}): Promise<string | null> {
  const casado = await leadPorTelefone(params.organizacaoId, params.telefone);
  if (!casado) return null;
  const [irma] = await db.execute<{ id: string }>(sql`
    SELECT o.id::text
      FROM contatos o
     WHERE o.organizacao_id = ${params.organizacaoId}::uuid
       AND o.lead_id = ${casado}::uuid
       AND o.responsavel_id IS NOT DISTINCT FROM ${params.responsavelId}::uuid
     LIMIT 1`);
  return irma ? null : casado;
}
