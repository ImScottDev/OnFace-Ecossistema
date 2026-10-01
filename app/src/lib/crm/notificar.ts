/**
 * Notificações de eventos comerciais (sino do header — NotificationDropdown).
 * Pedido Kauã 21/07: avisar o time quando um negócio dá GANHO, com link direto
 * pro card. Compartilhado entre o caminho manual (PATCH Hono /api/negocios) e o
 * automático (proposta aceita via pagamento Stripe — marcarPropostaAceita).
 */
import { db } from "@/lib/db";
import { notificacoes, usuarios, negocios, leads, fulfillments, servicosCanonicos, empresas, atividades, contratos } from "@/lib/db/schema";
import { and, eq, inArray, desc } from "drizzle-orm";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Avisa gestão (admin/gerente ativos) + o responsável do negócio. Fire-and-forget:
 * NUNCA deixa uma falha de notificação derrubar o fluxo de ganho (dinheiro > aviso).
 */
export async function notificarNegocioGanho(negocioId: string): Promise<void> {
  try {
    const [neg] = await db
      .select({
        id: negocios.id,
        titulo: negocios.titulo,
        organizacaoId: negocios.organizacaoId,
        responsavelId: negocios.responsavelId,
        mrrFechado: negocios.mrrFechado,
        valorTotal: negocios.valorTotal,
        leadId: negocios.leadId,
      })
      .from(negocios)
      .where(eq(negocios.id, negocioId))
      .limit(1);
    if (!neg) return;

    const [lead] = neg.leadId
      ? await db.select({ nome: leads.nome, empresa: leads.empresa }).from(leads).where(eq(leads.id, neg.leadId)).limit(1)
      : [];
    const quem = lead?.empresa || lead?.nome || neg.titulo;
    const mrr = parseFloat(String(neg.mrrFechado ?? "")) || 0;
    const valor = mrr > 0 ? `${brl(mrr)}/mês` : brl(parseFloat(String(neg.valorTotal ?? "")) || 0);

    const gestores = await db
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(and(
        eq(usuarios.organizacaoId, neg.organizacaoId),
        inArray(usuarios.role, ["admin", "gerente", "super_admin"]),
        eq(usuarios.ativo, true),
      ));
    const destinatarios = new Set<string>(gestores.map((g) => g.id));
    if (neg.responsavelId) destinatarios.add(neg.responsavelId);
    if (destinatarios.size === 0) return;

    await db.insert(notificacoes).values(
      [...destinatarios].map((usuarioId) => ({
        usuarioId,
        tipo: "negocio_ganho",
        titulo: `Negócio ganho — ${quem}`,
        mensagem: `${neg.titulo} fechou: ${valor}.`,
        link: `/negocios/${neg.id}`,
      })),
    );
  } catch (e) {
    console.error("[notificar] falha ao notificar negócio ganho:", e);
  }
}

/**
 * Formulário de implantação recebido (20/08, pedido Kauã) — chamado pela
 * rota pública quando o cliente submete o formulário de implantação PABX.
 * Mesmo princípio de fire-and-forget de notificarNegocioGanho: nunca deixa
 * uma falha de notificação/atividade derrubar a submissão do formulário.
 * Notifica o `responsavelId` do fulfillment (nível projeto — item 1 desta
 * rodada trouxe responsável por item, mas quem entrega o formulário é o
 * projeto como um todo). Também registra uma atividade real (mesma tabela
 * `atividades` de qualquer outra Timeline do CRM), vinculada ao primeiro
 * lead real da empresa (leads.empresaId — mesma fonte que já alimenta
 * "Atividades recentes" no FulfillmentDetail). Se a empresa não tiver
 * nenhum lead vinculado (gap real observado no fulfillment de teste
 * HOSPITAL CARE, sem negócio/lead formal no CRM), a atividade é pulada
 * honestamente — não inventa um leadId falso só pra satisfazer o NOT NULL.
 */

export async function notificarFormularioImplantacaoRecebido(fulfillmentId: string): Promise<void> {
  try {
    const [f] = await db
      .select({
        id: fulfillments.id,
        organizacaoId: fulfillments.organizacaoId,
        responsavelId: fulfillments.responsavelId,
        empresaId: empresas.id,
        empresaNome: empresas.nome,
      })
      .from(fulfillments)
      .innerJoin(servicosCanonicos, eq(servicosCanonicos.id, fulfillments.servicoCanonicoId))
      .leftJoin(empresas, eq(empresas.id, servicosCanonicos.empresaId))
      .where(eq(fulfillments.id, fulfillmentId))
      .limit(1);
    if (!f) return;

    const quem = f.empresaNome || "cliente sem nome cadastrado";
    // O detalhe de qualquer entrega é o Projeto ONFACE (/projetos/:id, o id é
    // o do fulfillment). /clientes/entrega/:id virou redirect para ele.
    const link = `/projetos/${f.id}`;

    if (f.responsavelId) {
      await db.insert(notificacoes).values({
        usuarioId: f.responsavelId,
        tipo: "fulfillment_formulario_recebido",
        titulo: `Formulário de implantação recebido — ${quem}`,
        mensagem: "O cliente enviou as informações do formulário de implantação. Confira e siga com o levantamento.",
        link,
      });
    }

    if (f.empresaId) {
      const [lead] = await db
        .select({ id: leads.id })
        .from(leads)
        .where(eq(leads.empresaId, f.empresaId))
        .orderBy(desc(leads.createdAt))
        .limit(1);
      if (lead) {
        await db.insert(atividades).values({
          organizacaoId: f.organizacaoId,
          leadId: lead.id,
          tipo: "formulario_implantacao_recebido",
          titulo: "Formulário de implantação recebido",
          descricao: `${quem} enviou o formulário de implantação (portabilidade, ramais e URA).`,
          dados: { fulfillmentId: f.id },
        });
      } else {
        console.warn(`[notificar] fulfillment ${f.id}: sem lead vinculado à empresa, atividade não registrada (gap real, não fabricado).`);
      }
    }
  } catch (e) {
    console.error("[notificar] falha ao notificar formulário de implantação recebido:", e);
  }
}

/**
 * Entrega criada automaticamente após o Won (25/08, spec do Kauã: "nada disso
 * deve depender de alguém clicar em novo onboarding" — precisa gerar
 * notificação pro responsável e registrar evento na timeline sozinho).
 *
 * Frente 2C.1: deixou de ser "onboarding" hardcoded e passou a usar a TRILHA
 * real da família (`politica-familia.ts`) — Onboarding pra Callface AI,
 * Implantação White Label pra White Label. O link e o texto seguem a trilha,
 * não um rótulo fixo.
 * Mesmo padrão fire-and-forget e mesma busca de lead via `leads.empresaId`
 * de `notificarFormularioImplantacaoRecebido` — chamada por
 * `criarFulfillmentsParaServicos` (lib/crm/fulfillment.ts) assim que o
 * fulfillment de onboarding é criado.
 */
export async function notificarFulfillmentOnboardingCriado(fulfillmentId: string): Promise<void> {
  try {
    const [f] = await db
      .select({
        id: fulfillments.id,
        organizacaoId: fulfillments.organizacaoId,
        responsavelId: fulfillments.responsavelId,
        serviceFamily: fulfillments.serviceFamily,
        empresaId: empresas.id,
        empresaNome: empresas.nome,
        leadId: servicosCanonicos.leadId,
      })
      .from(fulfillments)
      .innerJoin(servicosCanonicos, eq(servicosCanonicos.id, fulfillments.servicoCanonicoId))
      .leftJoin(empresas, eq(empresas.id, servicosCanonicos.empresaId))
      .where(eq(fulfillments.id, fulfillmentId))
      .limit(1);
    if (!f) return;

    const quem = f.empresaNome || "cliente sem nome cadastrado";
    const { regraDaFamilia } = await import("@/lib/crm/politica-familia");
    const regra = regraDaFamilia(f.serviceFamily);
    // Onboarding e implantação abrem a mesma tela: o Projeto ONFACE
    // (/projetos/:id), que resolve o checklist pela família.
    const link = `/projetos/${f.id}`;

    if (f.responsavelId) {
      await db.insert(notificacoes).values({
        usuarioId: f.responsavelId,
        tipo: "fulfillment_criado",
        titulo: `${regra.trilhaLabel} atribuída a você — ${quem}`,
        mensagem: regra.tarefaInicial
          ? `O fechamento gerou uma nova entrega. A primeira ação é: ${regra.tarefaInicial.toLowerCase()}.`
          : "O fechamento gerou uma nova entrega. Confira o checklist e siga com o primeiro passo.",
        link,
      });
    }

    const leadIdParaAtividade = f.leadId ?? (f.empresaId
      ? (await db.select({ id: leads.id }).from(leads).where(eq(leads.empresaId, f.empresaId)).orderBy(desc(leads.createdAt)).limit(1))[0]?.id ?? null
      : null);

    if (leadIdParaAtividade) {
      await db.insert(atividades).values({
        organizacaoId: f.organizacaoId,
        leadId: leadIdParaAtividade,
        tipo: "fulfillment_criado",
        titulo: `${regra.trilhaLabel} criada`,
        descricao: `${regra.trilhaLabel} de ${f.serviceFamily} criada automaticamente após o fechamento da venda.`,
        dados: { fulfillmentId: f.id, serviceFamily: f.serviceFamily, trilha: regra.trilha },
      });
    } else {
      console.warn(`[notificar] fulfillment ${f.id}: sem lead vinculado, atividade de entrega criada não registrada (gap real, não fabricado).`);
    }
  } catch (e) {
    console.error("[notificar] falha ao notificar onboarding criado:", e);
  }
}

/**
 * Frente 2C.1 — destinatários padrão de um evento comercial: gestão ativa
 * (admin/gerente/super_admin) + responsável do negócio. Mesma régua já usada
 * em `notificarNegocioGanho`, extraída porque agora 3 avisos diferentes
 * precisam dela.
 */
async function destinatariosDoNegocio(negocioId: string): Promise<{ ids: string[]; organizacaoId: string; titulo: string; quem: string; leadId: string | null }> {
  const [neg] = await db
    .select({ id: negocios.id, titulo: negocios.titulo, organizacaoId: negocios.organizacaoId, responsavelId: negocios.responsavelId, leadId: negocios.leadId })
    .from(negocios).where(eq(negocios.id, negocioId)).limit(1);
  if (!neg) return { ids: [], organizacaoId: "", titulo: "", quem: "", leadId: null };

  const [lead] = neg.leadId
    ? await db.select({ nome: leads.nome, empresa: leads.empresa }).from(leads).where(eq(leads.id, neg.leadId)).limit(1)
    : [];

  const gestores = await db.select({ id: usuarios.id }).from(usuarios).where(and(
    eq(usuarios.organizacaoId, neg.organizacaoId),
    inArray(usuarios.role, ["admin", "gerente", "super_admin"]),
    eq(usuarios.ativo, true),
  ));
  const ids = new Set<string>(gestores.map((g) => g.id));
  if (neg.responsavelId) ids.add(neg.responsavelId);
  return { ids: [...ids], organizacaoId: neg.organizacaoId, titulo: neg.titulo, quem: lead?.empresa || lead?.nome || neg.titulo, leadId: neg.leadId };
}

/** Contrato assinado — aviso pro time comercial (fire-and-forget). */
export async function notificarContratoAssinado(contratoId: string): Promise<void> {
  try {
    const [c] = await db
      .select({ id: contratos.id, negocioId: contratos.negocioId, assinadoNome: contratos.assinadoNome, serviceFamily: contratos.serviceFamily })
      .from(contratos).where(eq(contratos.id, contratoId)).limit(1);
    if (!c?.negocioId) return;
    const dest = await destinatariosDoNegocio(c.negocioId);
    if (dest.ids.length === 0) return;

    await db.insert(notificacoes).values(dest.ids.map((usuarioId) => ({
      usuarioId,
      tipo: "contrato_assinado",
      titulo: `Contrato assinado — ${dest.quem}`,
      mensagem: c.assinadoNome ? `Assinado por ${c.assinadoNome}.` : "O contrato foi assinado.",
      link: `/negocios/${c.negocioId}`,
    })));
  } catch (e) {
    console.error("[notificar] falha ao notificar contrato assinado:", e);
  }
}

/**
 * Pagamento pendente de uma venda JÁ ganha (PABX/White Label fechados por
 * contrato). É o aviso que impede o cliente de entrar na carteira com
 * dinheiro em aberto e ninguém saber.
 */
export async function notificarPagamentoPendente(opts: {
  negocioId: string;
  organizacaoId: string;
  valor: number;
  vencimento: Date | null;
  serviceFamily: string;
}): Promise<void> {
  try {
    const dest = await destinatariosDoNegocio(opts.negocioId);
    if (dest.ids.length === 0) return;
    const quando = opts.vencimento
      ? `Vence em ${opts.vencimento.toLocaleDateString("pt-BR")}.`
      : "Sem data de vencimento definida na condição de pagamento da proposta.";

    await db.insert(notificacoes).values(dest.ids.map((usuarioId) => ({
      usuarioId,
      tipo: "pagamento_pendente",
      titulo: `Pagamento pendente — ${dest.quem}`,
      mensagem: `Venda fechada por contrato (${opts.serviceFamily}) com ${brl(opts.valor)} em aberto. ${quando}`,
      link: `/clientes/financeiro`,
    })));
  } catch (e) {
    console.error("[notificar] falha ao notificar pagamento pendente:", e);
  }
}

/** Pagamento confirmado — fecha o ciclo do aviso de pendência. */
export async function notificarPagamentoConfirmado(opts: { negocioId: string; valor: number | null }): Promise<void> {
  try {
    const dest = await destinatariosDoNegocio(opts.negocioId);
    if (dest.ids.length === 0) return;
    await db.insert(notificacoes).values(dest.ids.map((usuarioId) => ({
      usuarioId,
      tipo: "pagamento_confirmado",
      titulo: `Pagamento confirmado — ${dest.quem}`,
      mensagem: opts.valor ? `${brl(opts.valor)} confirmados.` : "O pagamento foi confirmado.",
      link: `/negocios/${opts.negocioId}`,
    })));
  } catch (e) {
    console.error("[notificar] falha ao notificar pagamento confirmado:", e);
  }
}

/**
 * Família sem regra clara de fechamento: a proposta foi aceita mas o sistema
 * NÃO marca ganho sozinho. Alguém precisa validar na mão — por isso o aviso
 * vai pra gestão, não fica só no status do grupo.
 */
export async function notificarValidacaoManualNecessaria(opts: { negocioId: string; motivo: string }): Promise<void> {
  try {
    const dest = await destinatariosDoNegocio(opts.negocioId);
    if (dest.ids.length === 0) return;
    await db.insert(notificacoes).values(dest.ids.map((usuarioId) => ({
      usuarioId,
      tipo: "validacao_manual_necessaria",
      titulo: `Aceite precisa de validação — ${dest.quem}`,
      mensagem: opts.motivo,
      link: `/negocios/${opts.negocioId}`,
    })));
  } catch (e) {
    console.error("[notificar] falha ao notificar validação manual necessária:", e);
  }
}
