/**
 * Notificações do ciclo de vida da proposta (sino do header) — mesmo padrão
 * de `lib/crm/notificar.ts` (notificarNegocioGanho): fire-and-forget, nunca
 * derruba o fluxo real por falha de notificação. Diferença aqui: aceite não
 * é sinônimo de Won (isso continua exigindo evidência real — pagamento
 * confirmado ou contrato assinado, ver ADR-EXEC-007/012), então essas
 * notificações avisam só o responsável do negócio, não a gestão inteira.
 */
import { db } from "@/lib/db";
import { notificacoes, negocios, leads } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

type TipoResposta = "aceita" | "recusada" | "ajuste_solicitado";

const TITULO: Record<TipoResposta, string> = {
  aceita: "Proposta aceita",
  recusada: "Proposta recusada",
  ajuste_solicitado: "Cliente pediu ajuste na proposta",
};

export async function notificarPropostaRespondida(opts: {
  propostaId: string;
  negocioId: string | null;
  leadId: string;
  numero: number;
  versao: number;
  tipo: TipoResposta;
  motivo?: string | null;
  /** Substitui o título padrão do tipo (ex.: aceite que não andou). */
  titulo?: string;
}): Promise<void> {
  try {
    const { propostaId, negocioId, leadId, numero, versao, tipo, motivo } = opts;

    const [lead] = await db
      .select({ nome: leads.nome, empresa: leads.empresa })
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);
    const quem = lead?.empresa || lead?.nome || "Cliente";

    let responsavelId: string | null = null;
    let negocioTitulo = "";
    if (negocioId) {
      const [neg] = await db
        .select({ responsavelId: negocios.responsavelId, titulo: negocios.titulo })
        .from(negocios)
        .where(eq(negocios.id, negocioId))
        .limit(1);
      responsavelId = neg?.responsavelId ?? null;
      negocioTitulo = neg?.titulo ?? "";
    }
    if (!responsavelId) return; // sem responsável identificável, nada pra notificar

    const numeroFmt = `#P-${String(numero).padStart(3, "0")}-v${versao}`;
    const base = `${quem}${negocioTitulo ? ` (${negocioTitulo})` : ""} — proposta ${numeroFmt}`;
    const mensagem = motivo ? `${base}. ${motivo}` : base;

    await db.insert(notificacoes).values({
      usuarioId: responsavelId,
      tipo: `proposta_${tipo}`,
      titulo: opts.titulo ?? TITULO[tipo],
      mensagem,
      link: negocioId ? `/negocios/${negocioId}` : `/propostas/${propostaId}`,
    });
  } catch (e) {
    console.error("[notificar-proposta] falha ao notificar resposta de proposta:", e);
  }
}
