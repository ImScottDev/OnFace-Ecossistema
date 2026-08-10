/**
 * Lembrete automático de reunião 30min antes, via WhatsApp — automação real
 * pedida pelo Kauã (10/08). Diferente das automações do motor real
 * (`automacao-engine.ts`, disparadas por evento síncrono), essa é baseada em
 * tempo (sweep periódico via worker, mesmo padrão de `event-outbox-sweep`/
 * `cadence-sweep`) — não existe gatilho por horário no motor de automações
 * hoje, então isso não passa por lá, mas usa a mesma infra real de envio de
 * WhatsApp (`whatsappOutgoingQueue`) que o resto do sistema.
 *
 * Janela de disparo: reunião com `data` entre agora+25min e agora+35min
 * (sweep roda a cada 5min — janela de 10min garante que toda reunião passa
 * por pelo menos 1 execução do sweep dentro da janela de 30min-ish, mesmo
 * com jitter). `lembrete30minEnviadoEm` evita duplicar envio.
 */
import { db } from "@/lib/db";
import { reunioes, leads, usuarios, whatsappSessao, whatsappMensagens } from "@/lib/db/schema";
import { and, eq, gte, lte, isNull, desc } from "drizzle-orm";
import { whatsappOutgoingQueue } from "@/lib/queue";
import { normalizePhone } from "@/lib/whatsapp/phone-utils";

function firstName(nome: string | null | undefined): string {
  return (nome || "").trim().split(/\s+/)[0] || "";
}

async function resolveSessaoResponsavel(organizacaoId: string, responsavelId: string | null): Promise<string | null> {
  if (!responsavelId) return null;
  const [sessao] = await db.select({ id: whatsappSessao.id })
    .from(whatsappSessao)
    .where(and(eq(whatsappSessao.organizacaoId, organizacaoId), eq(whatsappSessao.usuarioId, responsavelId)))
    .orderBy(desc(whatsappSessao.isDefault))
    .limit(1);
  return sessao?.id ?? null;
}

export async function enviarLembretesReunioes30min(): Promise<{ enviados: number; falhados: number }> {
  const agora = new Date();
  const inicioJanela = new Date(agora.getTime() + 25 * 60 * 1000);
  const fimJanela = new Date(agora.getTime() + 35 * 60 * 1000);

  const devidas = await db
    .select({
      id: reunioes.id,
      organizacaoId: reunioes.organizacaoId,
      titulo: reunioes.titulo,
      data: reunioes.data,
      link: reunioes.link,
      leadId: reunioes.leadId,
      responsavelId: reunioes.responsavelId,
    })
    .from(reunioes)
    .where(and(
      eq(reunioes.status, "agendada"),
      gte(reunioes.data, inicioJanela),
      lte(reunioes.data, fimJanela),
      isNull(reunioes.lembrete30minEnviadoEm),
    ));

  let enviados = 0;
  let falhados = 0;

  for (const reuniao of devidas) {
    try {
      if (!reuniao.leadId) { continue; }
      const [lead] = await db.select({ nome: leads.nome, telefone: leads.telefone })
        .from(leads).where(eq(leads.id, reuniao.leadId)).limit(1);
      if (!lead?.telefone) { continue; }

      const [responsavel] = reuniao.responsavelId
        ? await db.select({ nome: usuarios.nome }).from(usuarios).where(eq(usuarios.id, reuniao.responsavelId)).limit(1)
        : [];

      const hora = new Date(reuniao.data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
      const conteudo = `Oi, ${firstName(lead.nome)}! Passando pra lembrar que nossa reunião${responsavel?.nome ? ` com ${firstName(responsavel.nome)}` : ""} é em 30 minutos, às ${hora}.${reuniao.link ? `\n\nLink: ${reuniao.link}` : ""}`;

      const phone = normalizePhone(lead.telefone);
      const sessaoId = await resolveSessaoResponsavel(reuniao.organizacaoId, reuniao.responsavelId);

      const [message] = await db.insert(whatsappMensagens).values({
        contatoId: null,
        leadId: reuniao.leadId,
        sessaoId,
        telefone: phone,
        direcao: "out",
        tipo: "text",
        conteudo,
        status: "pending",
        dados: { lembreteReuniao: { reuniaoId: reuniao.id } },
      }).returning();

      await whatsappOutgoingQueue.add("send", {
        messageId: message.id,
        phone,
        conteudo,
        tipo: "text",
        ...(sessaoId ? { sessaoId } : {}),
      });

      await db.update(reunioes).set({ lembrete30minEnviadoEm: new Date() }).where(eq(reunioes.id, reuniao.id));
      enviados++;
    } catch (err) {
      falhados++;
      console.error(`[lembrete-reuniao] falha ao processar reunião ${reuniao.id}:`, err);
    }
  }

  return { enviados, falhados };
}
