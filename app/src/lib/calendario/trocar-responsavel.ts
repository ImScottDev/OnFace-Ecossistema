/**
 * Trocar o responsável de uma reunião (Módulo 09): ponto de entrada ÚNICO.
 *
 * Muda `responsavel_id`, move o evento entre os calendários (a lógica está em
 * `troca-de-agenda.ts`, chamada por `atualizarNaAgenda`) e registra o fato na timeline
 * pela porta de eventos. Rota, ação do NEXO ou tela chamam isto; ninguém mexe em
 * `responsavel_id` de reunião por fora.
 *
 * Idempotente: trocar para quem já é o responsável não grava, não registra evento e não cria
 * nem cancela nada no calendário (o gatilho do movimento é o estado, ver `troca-de-agenda.ts`).
 * Repetir a chamada depois de uma falha é o jeito de reprocessar.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { registrarEvento } from "@/lib/vendas/eventos";
import type { Ator } from "@/lib/vendas/dominio";
import { atualizarNaAgenda, marcarFalhaDeSync, type ResultadoSync } from "./sincronizar";

export class ResponsavelInvalidoError extends Error {
  constructor(mensagem = "Responsável inválido: escolha alguém ativo da equipe.") { super(mensagem); this.name = "ResponsavelInvalidoError"; }
}
export class ReuniaoNaoEncontradaError extends Error {
  constructor() { super("Reunião não encontrada"); this.name = "ReuniaoNaoEncontradaError"; }
}

/** Quem pode ser responsável: usuário ativo da MESMA organização (nunca confia no id vindo do cliente). */
export async function validarResponsavel(organizacaoId: string, usuarioId: string): Promise<string> {
  const [u] = await db.execute<{ nome: string }>(sql`
    SELECT nome FROM usuarios WHERE id = ${usuarioId}::uuid AND organizacao_id = ${organizacaoId}::uuid AND ativo = true`);
  if (!u) throw new ResponsavelInvalidoError();
  return u.nome;
}

export interface ResultadoTrocaResponsavel {
  /** O responsável mudou nesta chamada (false = já era ele). */
  mudou: boolean;
  /** A agenda foi sincronizada aqui (o chamador não precisa chamar `atualizarNaAgenda` de novo). */
  sincronizou: boolean;
  /** Frase pronta para a tela; nula quando está tudo certo. */
  aviso: string | null;
}

export async function trocarResponsavelDaReuniao(e: {
  organizacaoId: string; reuniaoId: string; novoResponsavelId: string; ator: Ator;
  /** Os participantes também mudaram na mesma edição. */
  convidados?: boolean;
}): Promise<ResultadoTrocaResponsavel> {
  const nomeNovo = await validarResponsavel(e.organizacaoId, e.novoResponsavelId);

  // O UPDATE só acontece se muda; o FOR UPDATE do CTE faz duas trocas simultâneas lerem o mesmo "antes",
  // e só a que de fato muda devolve linha (e só ela registra o evento).
  const [troca] = await db.execute<{ anterior: string | null; negocio_id: string | null; lead_id: string | null; data: Date }>(sql`
    WITH ant AS (SELECT id, responsavel_id FROM reunioes WHERE id = ${e.reuniaoId}::uuid AND organizacao_id = ${e.organizacaoId}::uuid FOR UPDATE)
    UPDATE reunioes r SET responsavel_id = ${e.novoResponsavelId}::uuid, updated_at = now()
      FROM ant WHERE r.id = ant.id AND r.responsavel_id IS DISTINCT FROM ${e.novoResponsavelId}::uuid
    RETURNING ant.responsavel_id::text AS anterior, r.negocio_id::text, r.lead_id::text, r.data`);

  const [atual] = await db.execute<{ status: string | null }>(sql`
    SELECT status FROM reunioes WHERE id = ${e.reuniaoId}::uuid AND organizacao_id = ${e.organizacaoId}::uuid`);
  if (!atual) throw new ReuniaoNaoEncontradaError();

  // Reunião viva: o evento acompanha o responsável. Já feita/cancelada: o evento é história, não se move.
  let sync: ResultadoSync | null = null;
  let aviso: string | null = null;
  if (atual.status === "agendada") {
    try {
      sync = await atualizarNaAgenda(e.organizacaoId, e.reuniaoId, { convidados: e.convidados, anteriorResponsavelId: troca?.anterior ?? null });
      aviso = sync.aviso ?? null;
    } catch (err) {
      console.error(`[calendario] troca de responsável da reunião ${e.reuniaoId}: sincronização falhou:`, err);
      aviso = "Responsável alterado, mas não consegui mover o evento para o calendário dele. Tente de novo.";
      await marcarFalhaDeSync(e.reuniaoId, `troca de responsável: ${String(err instanceof Error ? err.message : err)}`).catch(() => undefined);
    }
  }

  if (troca && (troca.negocio_id || troca.lead_id)) {
    const [antigo] = troca.anterior
      ? await db.execute<{ nome: string }>(sql`SELECT nome FROM usuarios WHERE id = ${troca.anterior}::uuid AND organizacao_id = ${e.organizacaoId}::uuid`)
      : [];
    const agenda = sync?.sincronizado === false || aviso ? "pendente" : sync?.eventId ? "movida" : "sem_evento";
    await registrarEvento({
      organizacaoId: e.organizacaoId, tipo: "OwnerChanged", ator: e.ator,
      negocioId: troca.negocio_id, leadId: troca.lead_id, reuniaoId: e.reuniaoId,
      contexto: { entidade: "reuniao", de: troca.anterior, para: e.novoResponsavelId, agenda },
      timeline: {
        tipo: "reuniao",
        titulo: "Responsável da reunião alterado",
        descricao: `${antigo?.nome ?? "sem responsável"} → ${nomeNovo}` + (agenda === "movida" ? " · evento movido para o calendário dele" : agenda === "pendente" ? " · calendário pendente" : ""),
      },
    }).catch((err) => console.error(`[calendario] evento OwnerChanged da reunião ${e.reuniaoId} não gravado:`, err));
  }

  return { mudou: Boolean(troca), sincronizou: sync !== null, aviso };
}
