import { eq, and, desc, inArray, sql } from "drizzle-orm";
import {
  leads,
  negocios,
  negocioLeads,
  statusChanges,
  atividades,
  reunioes,
  usuarios,
  pipelines,
  labels,
  leadLabels,
  cadenceEnrollments,
} from "../db/schema";
import { encerrarAquisicaoConvertida } from "../vendas/sincronizar-aquisicao";
import { syncPessoaFromLead, syncOportunidadeFromNegocio } from "./sync-domain-model";

// Lógica de "Converter em oportunidade" (handover SDR → closer), extraída da rota
// POST /leads/:id/converter-oportunidade pra ser reaproveitada tanto pelo endpoint
// HTTP (fluxo manual, SDR arrasta o card / usa o modal) quanto pelo worker do Agente
// SDR (fluxo automático, `schedule_meeting`). Mesmo comportamento pros dois caminhos —
// ver callface/ai-sdr-agente-spec.md seção 6.

export interface ReuniaoInput {
  data: string | Date;
  tipo?: "call" | "presencial" | "video";
  duracao?: number;
  titulo?: string;
  notas?: string;
  link?: string;
}

export interface ConverterOportunidadeInput {
  organizacaoId: string;
  leadId: string;
  usuarioId: string | null; // quem disparou (humano) ou null (Agente SDR)
  closerId?: string | null;
  titulo?: string;
  valorProjeto?: string;
  tipoReceita?: string;
  reuniao?: ReuniaoInput | null;
  /**
   * Qualificação DIRETA (closer atuando como SDR): cria o negócio no pipeline
   * da própria closer sem exigir reunião. Não consome a vez de ninguém no
   * rodízio (o round-robin é baseado em reuniões criadas — sem reunião, sem giro).
   */
  semReuniao?: boolean;
}

export interface ConverterOportunidadeResult {
  ok: true;
  negocioId: string;
  titulo: string;
  reuniaoId: string | null;
  closerId: string | null;
  recovered?: boolean;
  alreadyConverted?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function converterLeadEmOportunidade(
  db: any,
  input: ConverterOportunidadeInput
): Promise<ConverterOportunidadeResult | { error: string; status: number }> {
  const { organizacaoId, leadId, usuarioId } = input;

  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.organizacaoId, organizacaoId)))
    .limit(1);

  if (!lead) {
    return { error: "Lead não encontrado", status: 404 };
  }

  const isOutbound = String(lead.origem || "").toLowerCase() === "outbound";
  if (isOutbound) {
    // A origem continua sendo a fonte estrutural; a tag torna o handoff
    // visível para quem opera Pré-vendas sem duplicar pessoa/empresa.
    const [existingOutboundLabel] = await db
      .select({ id: labels.id })
      .from(labels)
      .where(and(eq(labels.organizacaoId, organizacaoId), sql`lower(${labels.nome}) = 'outbound'`))
      .limit(1);
    let outboundLabelId = existingOutboundLabel?.id as string | undefined;
    if (!outboundLabelId) {
      const [createdLabel] = await db
        .insert(labels)
        .values({ organizacaoId, nome: "Outbound", cor: "#2563EB" })
        .returning({ id: labels.id });
      outboundLabelId = createdLabel.id;
    }
    await db.insert(leadLabels).values({ leadId, labelId: outboundLabelId }).onConflictDoNothing();

    // Uma cadência outbound não pode continuar enviando depois do handoff.
    await db
      .update(cadenceEnrollments)
      .set({ status: "cancelled", cancelledAt: new Date(), cancelReason: "Prospect qualificado e enviado para Pré-vendas", updatedAt: new Date() })
      .where(and(
        eq(cadenceEnrollments.organizacaoId, organizacaoId),
        eq(cadenceEnrollments.entityType, "lead"),
        eq(cadenceEnrollments.entityId, leadId),
        inArray(cadenceEnrollments.status, ["active", "waiting"]),
      ));
  }

  // Evita converter duas vezes: se já tem negócio aberto vinculado, devolve ele
  const existingLinks = await db
    .select({ negocioId: negocioLeads.negocioId })
    .from(negocioLeads)
    .where(eq(negocioLeads.leadId, leadId));

  if (existingLinks.length > 0) {
    const ativos = await db
      .select({ id: negocios.id, status: negocios.status })
      .from(negocios)
      .where(eq(negocios.leadId, leadId));

    const noShow = ativos.find((n: { status: string }) => n.status === "no_show");
    if (noShow) {
      await db.update(negocios).set({ status: "reuniao_agendada", updatedAt: new Date() }).where(eq(negocios.id, noShow.id));
      await db.update(leads).set({ negocioAtivoId: noShow.id, sdrStatus: "qualified", updatedAt: new Date() }).where(eq(leads.id, leadId));
      await db.insert(statusChanges).values({
        leadId,
        negocioId: noShow.id,
        deStatus: "no_show",
        paraStatus: "reuniao_agendada",
        usuarioId,
        motivo: "Recuperação de no-show (reagendado)",
      });
      return { ok: true, recovered: true, negocioId: noShow.id, titulo: lead.empresa || lead.nome, reuniaoId: null, closerId: null };
    }

    const aberto = ativos.find((n: { status: string }) => !["perdido", "churned", "no_show"].includes(n.status));
    if (aberto) {
      // Remarcação: negócio ainda em "reuniao_agendada" (nada avançou de verdade)
      // e veio uma nova data — atualiza a reunião existente em vez de ignorar.
      if (aberto.status === "reuniao_agendada" && input.reuniao?.data) {
        const dataReuniao = new Date(input.reuniao.data);
        if (Number.isNaN(dataReuniao.getTime())) {
          return { error: "Data da reunião inválida", status: 400 };
        }
        const [reuniaoExistente] = await db
          .select({ id: reunioes.id })
          .from(reunioes)
          .where(eq(reunioes.negocioId, aberto.id))
          .orderBy(desc(reunioes.createdAt))
          .limit(1);

        if (reuniaoExistente) {
          await db
            .update(reunioes)
            .set({
              data: dataReuniao,
              duracao: input.reuniao.duracao || 30,
              tipo: input.reuniao.tipo || "call",
              status: "agendada",
              notas: input.reuniao.notas || undefined,
              responsavelId: input.closerId || undefined,
              updatedAt: new Date(),
            })
            .where(eq(reunioes.id, reuniaoExistente.id));

          await db.insert(statusChanges).values({
            leadId,
            negocioId: aberto.id,
            deStatus: "reuniao_agendada",
            paraStatus: "reuniao_agendada",
            usuarioId,
            motivo: "Reunião remarcada",
          });

          return { ok: true, alreadyConverted: true, negocioId: aberto.id, titulo: lead.empresa || lead.nome, reuniaoId: reuniaoExistente.id, closerId: input.closerId || null };
        }
      }

      return { ok: true, alreadyConverted: true, negocioId: aberto.id, titulo: lead.empresa || lead.nome, reuniaoId: null, closerId: null };
    }
  }

  let closerId: string | null = null;
  let closerNome: string | null = null;
  if (input.closerId) {
    const [closer] = await db
      .select({ id: usuarios.id, nome: usuarios.nome })
      .from(usuarios)
      .where(and(eq(usuarios.id, input.closerId), eq(usuarios.organizacaoId, organizacaoId), eq(usuarios.ativo, true)))
      .limit(1);
    if (!closer) {
      return { error: "Closer inválido (usuário não encontrado ou inativo)", status: 400 };
    }
    closerId = closer.id;
    closerNome = closer.nome;
  }

  const titulo = input.titulo || (lead.empresa ? `${lead.empresa} - Novo negócio` : `${lead.nome} - Novo negócio`);

  const [defaultPipeline] = await db
    .select({ id: pipelines.id })
    .from(pipelines)
    .where(and(eq(pipelines.organizacaoId, organizacaoId), eq(pipelines.ativo, true)))
    .orderBy(desc(pipelines.isDefault))
    .limit(1);

  const [negocio] = await db
    .insert(negocios)
    .values({
      organizacaoId,
      leadId: lead.id,
      empresaId: lead.empresaId,
      titulo,
      tipoReceita: input.tipoReceita || lead.tipoReceita || undefined,
      valorProjeto: input.valorProjeto || lead.valorProjeto || undefined,
      servicosInteresse: lead.servicosInteresse || undefined,
      concorrenteAtual: lead.concorrenteAtual || undefined,
      origemNegocio: "novo",
      // Dado pros relatórios desde já: veio com reunião marcada ou qualificação direta?
      // Sem data de reunião = nasceu direto (mesmo sem a flag semReuniao explícita).
      origemQualificacao: input.reuniao?.data ? "reuniao" : "direta",
      status: "reuniao_agendada",
      pipelineId: defaultPipeline?.id || null,
      responsavelId: closerId || lead.responsavelId || undefined,
    })
    .returning();

  await db.insert(negocioLeads).values({ negocioId: negocio.id, leadId: lead.id, papel: "contato" });

  await db.update(leads).set({ negocioAtivoId: negocio.id, sdrStatus: "qualified", updatedAt: new Date() }).where(eq(leads.id, lead.id));
  await encerrarAquisicaoConvertida(lead.id); // handoff: a aquisição sai de Pré-vendas como convertida

  await db.insert(statusChanges).values({
    leadId: lead.id,
    negocioId: negocio.id,
    deStatus: lead.sdrStatus || null,
    paraStatus: "reuniao_agendada",
    usuarioId,
    motivo: input.semReuniao
      ? "Qualificação direta sem reunião (closer atuando como SDR)"
      : "Convertido em oportunidade (handover SDR → vendas)",
  });

  let reuniaoId: string | null = null;
  if (input.reuniao?.data) {
    const dataReuniao = new Date(input.reuniao.data);
    if (Number.isNaN(dataReuniao.getTime())) {
      return { error: "Data da reunião inválida", status: 400 };
    }
    const reuniaoTitulo = input.reuniao.titulo?.trim() || `Reunião de qualificação · ${lead.empresa || lead.nome}`;

    const [reuniao] = await db
      .insert(reunioes)
      .values({
        organizacaoId,
        negocioId: negocio.id,
        leadId: lead.id,
        titulo: reuniaoTitulo,
        data: dataReuniao,
        duracao: input.reuniao.duracao || 30,
        tipo: input.reuniao.tipo || "call",
        status: "agendada",
        notas: input.reuniao.notas || null,
        link: input.reuniao.link?.trim() || null,
        responsavelId: closerId || usuarioId,
      })
      .returning();
    reuniaoId = reuniao.id;

    const quando = dataReuniao.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    await db.insert(atividades).values({
      organizacaoId,
      leadId: lead.id,
      negocioId: negocio.id,
      usuarioId,
      tipo: "reuniao",
      titulo: "Reunião agendada com o closer",
      descricao: closerNome ? `${reuniaoTitulo} · ${quando} · closer ${closerNome}` : `${reuniaoTitulo} · ${quando}`,
      dados: { reuniaoId, closerId, closerNome, data: dataReuniao.toISOString(), tipo: input.reuniao.tipo || "call" },
    });
  }

  if (isOutbound) {
    await db.insert(atividades).values({
      organizacaoId,
      leadId: lead.id,
      negocioId: negocio.id,
      usuarioId,
      tipo: "nota",
      titulo: "Prospect outbound enviado para Pré-vendas",
      descricao: "Qualificado na operação de Prospecção e disponibilizado na coluna Qualificado de Pré-vendas.",
      dados: { origem: "outbound", handoff: "prospeccao_para_pre_vendas" },
    });
  }

  // F1/dual-write: sincroniza Domain Model novo — best-effort, nunca bloqueia
  // a conversão real (usada tanto pelo endpoint manual quanto pelo Agente SDR).
  await syncPessoaFromLead(lead.id);
  await syncOportunidadeFromNegocio(negocio.id);

  return { ok: true, negocioId: negocio.id, titulo, reuniaoId, closerId };
}
