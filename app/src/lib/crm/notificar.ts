/**
 * Notificações de eventos comerciais (sino do header — NotificationDropdown).
 * Pedido Kauã 21/07: avisar o time quando um negócio dá GANHO, com link direto
 * pro card. Compartilhado entre o caminho manual (PATCH Hono /api/negocios) e o
 * automático (proposta aceita via pagamento Stripe — marcarPropostaAceita).
 */
import { db } from "@/lib/db";
import { notificacoes, usuarios, negocios, leads, fulfillments, servicosCanonicos, empresas, atividades } from "@/lib/db/schema";
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
    const link = `/clientes/entrega/${f.id}`;

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
 * Onboarding (Callface AI — White Label é Implantação, não Onboarding)
 * criado automaticamente após o Won (25/08, spec do Kauã: "nada disso deve
 * depender de alguém clicar em novo onboarding" — precisa gerar
 * notificação pro responsável e registrar evento na timeline sozinho).
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
    const link = `/clientes/onboarding/${f.id}`;

    if (f.responsavelId) {
      await db.insert(notificacoes).values({
        usuarioId: f.responsavelId,
        tipo: "onboarding_criado",
        titulo: `Novo onboarding atribuído a você — ${quem}`,
        mensagem: "O Won gerou um novo onboarding. A primeira ação é agendar a reunião com o cliente.",
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
        tipo: "onboarding_criado",
        titulo: "Onboarding criado",
        descricao: "Onboarding de Callface AI criado automaticamente após o Won.",
        dados: { fulfillmentId: f.id },
      });
    } else {
      console.warn(`[notificar] fulfillment ${f.id}: sem lead vinculado, atividade de onboarding criado não registrada (gap real, não fabricado).`);
    }
  } catch (e) {
    console.error("[notificar] falha ao notificar onboarding criado:", e);
  }
}
