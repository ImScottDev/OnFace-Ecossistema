/**
 * Sync de volta Outlook → CRM (job "outlook-reuniao-sync", a cada 15 min).
 *
 * Reunião reagendada ou cancelada DIRETO no Outlook (fora do CRM) precisa
 * refletir no card do pipeline. Time pequeno → polling periódico simples
 * resolve; webhook do Graph seria overkill aqui (decisão do prompt 22/07).
 *
 * Regras:
 *  - Só reuniões `agendada` com outlook_event_id e closer com conta Microsoft ativa.
 *  - Evento apagado/cancelado no Outlook → reuniões.status = 'cancelada'.
 *  - Data/hora diferente → atualiza reuniões.data (e duração, se mudou).
 *  - Erro de token de UMA conta não derruba o sync das outras.
 */
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { emailContas, reunioes } from "../db/schema";
import { getOutlookEvent } from "../email/microsoft";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function syncOutlookReunioes(db: any): Promise<{ verificadas: number; atualizadas: number; canceladas: number }> {
  // Janela: futuras + últimas 24h (reagendamento de última hora ainda importa).
  const desde = new Date(Date.now() - 24 * 3600 * 1000);
  const lista = await db
    .select({
      id: reunioes.id,
      data: reunioes.data,
      duracao: reunioes.duracao,
      outlookEventId: reunioes.outlookEventId,
      responsavelId: reunioes.responsavelId,
    })
    .from(reunioes)
    // ISO string em vez de Date no WHERE: gotcha do driver postgres-js do projeto
    .where(and(eq(reunioes.status, "agendada"), isNotNull(reunioes.outlookEventId), sql`${reunioes.data} >= ${desde.toISOString()}`))
    .limit(200);

  if (lista.length === 0) return { verificadas: 0, atualizadas: 0, canceladas: 0 };

  // Conta Microsoft ativa por closer (uma query, não uma por reunião)
  const responsaveis = [...new Set(lista.map((r: { responsavelId: string | null }) => r.responsavelId).filter(Boolean))] as string[];
  const contas = responsaveis.length
    ? await db
        .select({ id: emailContas.id, usuarioId: emailContas.usuarioId })
        .from(emailContas)
        .where(and(inArray(emailContas.usuarioId, responsaveis), eq(emailContas.tipo, "microsoft"), eq(emailContas.syncStatus, "active")))
    : [];
  const contaPorUsuario = new Map(contas.map((c: { id: string; usuarioId: string }) => [c.usuarioId, c.id]));

  let verificadas = 0;
  let atualizadas = 0;
  let canceladas = 0;

  for (const r of lista) {
    const contaId = r.responsavelId ? contaPorUsuario.get(r.responsavelId) : null;
    if (!contaId || !r.outlookEventId) continue;
    try {
      const ev = await getOutlookEvent(contaId as string, r.outlookEventId);
      verificadas++;

      if (!ev.existe || ev.cancelado) {
        await db
          .update(reunioes)
          .set({ status: "cancelada", updatedAt: new Date() })
          .where(eq(reunioes.id, r.id));
        canceladas++;
        continue;
      }

      if (ev.inicioISO) {
        const novoInicio = new Date(ev.inicioISO);
        const atual = new Date(r.data);
        const novaDuracao = ev.fimISO ? Math.round((new Date(ev.fimISO).getTime() - novoInicio.getTime()) / 60000) : null;
        const mudouData = Math.abs(novoInicio.getTime() - atual.getTime()) > 60 * 1000;
        const mudouDuracao = novaDuracao != null && novaDuracao > 0 && novaDuracao !== r.duracao;
        if (mudouData || mudouDuracao) {
          await db
            .update(reunioes)
            .set({
              data: novoInicio,
              ...(mudouDuracao ? { duracao: novaDuracao } : {}),
              updatedAt: new Date(),
            })
            .where(eq(reunioes.id, r.id));
          atualizadas++;
        }
      }
    } catch (e) {
      // token expirado/erro de uma conta não pode travar as demais
      console.error(`[OutlookReuniaoSync] falha na reunião ${r.id} (closer ${r.responsavelId}):`, String(e).slice(0, 200));
    }
  }

  console.log(`[OutlookReuniaoSync] ${verificadas} verificadas, ${atualizadas} reagendadas, ${canceladas} canceladas`);
  return { verificadas, atualizadas, canceladas };
}
