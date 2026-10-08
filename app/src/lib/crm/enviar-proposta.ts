/**
 * Envio de proposta pro cliente: SÓ deixa a proposta disponível na página
 * pública (/p/{id}) + dispara o email branded via Resend. NÃO cria mais
 * checkout Stripe aqui (Commercial Core v2, ADR-EXEC-021) — criar/enviar
 * proposta não significa que o cliente decidiu comprar. Checkout só nasce
 * quando existe intenção comercial real: automaticamente após o ACEITE
 * (ver lib/crm/proposta-aceite.ts) ou manualmente pelo vendedor (ver
 * lib/crm/checkout.ts::criarCheckoutParaGrupo, origem="manual_vendedor").
 *
 * Compartilhado entre a rota Next (local) e a rota Hono (prod) pra manter paridade.
 */
import { db } from "@/lib/db";
import { propostas, propostaItens, leads, atividades } from "@/lib/db/schema";
import { eq, asc, and } from "drizzle-orm";
import { sendResendEmail, type ResendResult } from "@/lib/email/resend";
import { buildPropostaEmail } from "@/lib/email/proposta-email";
import { publicarEvento } from "@/lib/events/outbox";
import { syncOportunidadeItensFromProposta } from "@/lib/crm/composicao-comercial";
import { formarGruposComerciais, vincularContratoPreparadoAoGrupo } from "@/lib/crm/grupo-comercial";
import { exigeContrato } from "@/lib/crm/commercial-model";
import { gerarContratoDeTemplate, conferirContratoDoGrupo } from "@/lib/crm/contrato-template";
import { appUrl } from "@/lib/app-url";

type PropostaRow = typeof propostas.$inferSelect;

function validadePadraoIso(): string {
  const data = new Date();
  data.setUTCDate(data.getUTCDate() + 10);
  return data.toISOString().slice(0, 10);
}

/**
 * O e-mail que leva o link público ao cliente. Uma porta só: o envio legado
 * (Hono /propostas/:id/enviar) e o envio do módulo Vendas (`acaoEnviar`) usam
 * esta função. O envio novo só gravava `status = enviada` e a tela dizia "avisa
 * o cliente por e-mail": ninguém recebia o link.
 */
export async function dispararEmailDaProposta(p: {
  para: string; clienteNome: string; empresa?: string | null;
  proposta: Pick<PropostaRow, "numero" | "versao" | "moeda">;
  itens: Array<{ nome: string; tipo: string; subtotal: number }>;
  totalRecorrente: number; totalAvulso: number; linkPublico: string;
  validade?: string | null; remetenteNome?: string | null;
}) {
  const { subject, html } = buildPropostaEmail({
    clienteNome: p.clienteNome, empresa: p.empresa, numero: p.proposta.numero, versao: p.proposta.versao,
    moeda: p.proposta.moeda || "BRL", itens: p.itens, totalRecorrente: p.totalRecorrente, totalAvulso: p.totalAvulso,
    checkoutUrl: p.linkPublico, validade: p.validade, remetenteNome: p.remetenteNome ?? null,
  });
  return sendResendEmail({ to: p.para, subject, html });
}

/**
 * Depois de `lib/vendas/propostas.enviarProposta` marcar a proposta como
 * enviada: manda o e-mail com o link e registra na timeline o que de fato
 * aconteceu (enviado, sem provedor de e-mail configurado, falhou, sem
 * destinatário). Nunca lança: o envio da proposta já aconteceu.
 */
export async function avisarClienteDaPropostaEnviada(opts: {
  propostaId: string; organizacaoId: string; userId: string; userName?: string | null; para?: string | null;
}): Promise<{ link: string; email: "enviado" | "sem_destinatario" | "sem_provedor" | "falhou"; erro: string | null }> {
  const link = `${appUrl()}/p/${opts.propostaId}`;
  try {
    const [proposta] = await db.select().from(propostas)
      .where(and(eq(propostas.id, opts.propostaId), eq(propostas.organizacaoId, opts.organizacaoId))).limit(1);
    if (!proposta) return { link, email: "falhou", erro: "Proposta não encontrada" };
    const [lead] = await db.select({ nome: leads.nome, sobrenome: leads.sobrenome, empresa: leads.empresa, email: leads.email })
      .from(leads).where(eq(leads.id, proposta.leadId)).limit(1);
    const destino = (opts.para || lead?.email || "").trim();
    const itens = await db.select({ nome: propostaItens.nome, tipo: propostaItens.tipo, subtotal: propostaItens.subtotal })
      .from(propostaItens).where(eq(propostaItens.propostaId, opts.propostaId)).orderBy(asc(propostaItens.ordem));

    let email: "enviado" | "sem_destinatario" | "sem_provedor" | "falhou" = "sem_destinatario";
    let erro: string | null = null;
    if (destino) {
      const r = await dispararEmailDaProposta({
        para: destino, clienteNome: [lead?.nome, lead?.sobrenome].filter(Boolean).join(" ") || lead?.nome || "", empresa: lead?.empresa,
        proposta, itens: itens.map((i) => ({ nome: i.nome, tipo: i.tipo, subtotal: parseFloat(i.subtotal || "0") })),
        totalRecorrente: parseFloat(proposta.totalRecorrente || "0"), totalAvulso: parseFloat(proposta.totalAvulso || "0"),
        linkPublico: link, validade: proposta.dataValidade, remetenteNome: opts.userName ?? null,
      });
      email = r.sent ? "enviado" : r.skipped ? "sem_provedor" : "falhou";
      erro = r.error ?? null;
    }
    await db.insert(atividades).values({
      organizacaoId: opts.organizacaoId, leadId: proposta.leadId, negocioId: proposta.negocioId, usuarioId: opts.userId,
      tipo: "proposta_enviada",
      titulo: `Link da proposta #P-${String(proposta.numero).padStart(3, "0")}-v${proposta.versao}: ${
        email === "enviado" ? `e-mail enviado para ${destino}` : email === "sem_provedor" ? "e-mail não disparado (provedor de e-mail não configurado)"
        : email === "falhou" ? "falha ao enviar o e-mail" : "sem e-mail do contato, envie o link manualmente"}`,
      descricao: erro ?? link,
      dados: { propostaId: proposta.id, linkPublico: link, email, para: destino || null },
    });
    return { link, email, erro };
  } catch (e) {
    console.error("[enviar-proposta] aviso ao cliente falhou:", e);
    return { link, email: "falhou", erro: e instanceof Error ? e.message : String(e) };
  }
}

export type EnviarPropostaResult =
  | {
      ok: true;
      proposta: PropostaRow;
      checkoutUrl: string; // link público (/p/{id}) — não mais um link de pagamento direto
      emailSent: boolean;
      emailSkipped: boolean;
      emailError: string | null;
    }
  | { ok: false; status: number; error: string };

export async function enviarPropostaComCheckout(opts: {
  propostaId: string;
  organizacaoId: string;
  userId: string;
  userName?: string | null;
  skipEmail?: boolean; // "Salvar": ativa (enviada) SEM disparar email
}): Promise<EnviarPropostaResult> {
  const { propostaId, organizacaoId, userId, userName, skipEmail } = opts;

  const [proposta] = await db
    .select()
    .from(propostas)
    .where(and(eq(propostas.id, propostaId), eq(propostas.organizacaoId, organizacaoId)))
    .limit(1);

  if (!proposta) return { ok: false, status: 404, error: "Proposta não encontrada" };
  if (!["rascunho", "enviada"].includes(proposta.status)) {
    return { ok: false, status: 400, error: "Só dá pra enviar propostas em rascunho ou já enviadas" };
  }

  const [lead] = await db
    .select({ nome: leads.nome, sobrenome: leads.sobrenome, empresa: leads.empresa, email: leads.email })
    .from(leads)
    .where(eq(leads.id, proposta.leadId))
    .limit(1);

  if (!skipEmail && !lead?.email) {
    return { ok: false, status: 400, error: "O lead não tem email cadastrado. Preencha o email do cliente antes de enviar." };
  }

  const itens = await db
    .select({ nome: propostaItens.nome, tipo: propostaItens.tipo, subtotal: propostaItens.subtotal, commercialModel: propostaItens.commercialModel })
    .from(propostaItens)
    .where(eq(propostaItens.propostaId, propostaId))
    .orderBy(asc(propostaItens.ordem));

  if (itens.length === 0) {
    return { ok: false, status: 400, error: "Proposta sem itens. Adicione ao menos um item antes de salvar/enviar." };
  }

  const propostaExigeContrato = itens.some((item) => item.commercialModel !== "PAGAMENTO_DIRETO");
  const signatarios = Array.isArray(proposta.signatarios) ? proposta.signatarios : [];
  if (propostaExigeContrato && signatarios.length === 0) {
    return { ok: false, status: 400, error: "Informe ao menos um signatário antes de enviar esta proposta contratual." };
  }
  if (propostaExigeContrato && (!proposta.prazoContratoMeses || proposta.prazoContratoMeses < 1)) {
    return { ok: false, status: 400, error: "Informe o prazo do contrato em meses antes de enviar esta proposta." };
  }

  // Prepara grupos e contratos ANTES de tornar a proposta pública. Nenhuma
  // assinatura é distribuída aqui; isso só ocorre depois de ProposalAccepted.
  // Assim não existe a tarefa manual "gerar contrato" após o aceite.
  if (propostaExigeContrato) {
    await syncOportunidadeItensFromProposta(propostaId);
    const grupos = await formarGruposComerciais(propostaId);
    for (const grupo of grupos) {
      if (!exigeContrato(grupo.commercialModel) || grupo.contratoId) continue;
      // O contrato é a peça que o cliente assina: se faltar dado para preencher
      // o modelo, a proposta não sai, e a mensagem diz o que completar.
      const faltando = await conferirContratoDoGrupo(grupo.id);
      if (faltando.length > 0) {
        return { ok: false, status: 400, error: `Antes de enviar, complete para gerar o contrato: ${faltando.join("; ")}.` };
      }
      const { contratoId } = await gerarContratoDeTemplate(grupo.id);
      await vincularContratoPreparadoAoGrupo(grupo.id, contratoId);
      await publicarEvento({ organizacaoId, eventType: "ContractGenerated", aggregateType: "contrato", aggregateId: contratoId, payload: { propostaId, negocioId: proposta.negocioId, grupoComercialId: grupo.id, preparadoAntesDoEnvio: true }, idempotencyKey: `contract-generated:${contratoId}` });
    }
  }

  const totalRecorrente = parseFloat(proposta.totalRecorrente || "0");
  // Proposta 100% avulso/setup (ex.: WHITE LABEL só com setup fee) tem total
  // mensal zero — o valor real está no avulso. Email e timeline precisam dele
  // pra não anunciar "Total R$ 0,00" pro cliente (fix de produção 5730112).
  const totalAvulso = parseFloat(proposta.totalAvulso || "0");
  const temRecorrente = itens.some((i) => i.tipo === "recorrente") || totalRecorrente > 0;
  // O PDF/email histórico já informava "10 dias após o recebimento" quando
  // o vendedor não preenchia uma data. Materializamos essa regra no registro
  // no momento do envio para que exibição, worker e aceite usem a mesma data.
  const dataValidadeEfetiva = proposta.dataValidade || validadePadraoIso();
  const base = appUrl();
  const clienteNome = [lead?.nome, lead?.sobrenome].filter(Boolean).join(" ") || lead?.nome || "";
  const linkPublico = `${base}/p/${proposta.id}`;

  const emailResult: ResendResult = !skipEmail && lead?.email
    ? await dispararEmailDaProposta({
        para: lead.email, clienteNome, empresa: lead.empresa, proposta,
        itens: itens.map((i) => ({ nome: i.nome, tipo: i.tipo, subtotal: parseFloat(i.subtotal || "0") })),
        totalRecorrente, totalAvulso, linkPublico, validade: dataValidadeEfetiva, remetenteNome: userName ?? null,
      })
    : ({ sent: false, skipped: true } satisfies ResendResult);

  const valorTimeline = temRecorrente
    ? `valor mensal: R$ ${totalRecorrente.toLocaleString("pt-BR")}`
    : `valor: R$ ${totalAvulso.toLocaleString("pt-BR")}`;

  const today = new Date().toISOString().split("T")[0];
  const [updated] = await db
    .update(propostas)
    .set({
      status: "enviada",
      dataEmissao: proposta.dataEmissao || today,
      dataValidade: dataValidadeEfetiva,
      enviadaEm: proposta.enviadaEm || new Date(),
      updatedAt: new Date(),
    })
    .where(eq(propostas.id, propostaId))
    .returning();

  await publicarEvento({
    organizacaoId, eventType: "ProposalSent", aggregateType: "proposta", aggregateId: proposta.id,
    payload: { propostaId: proposta.id, negocioId: proposta.negocioId, linkPublico },
  });

  await db.insert(atividades).values({
    organizacaoId,
    leadId: proposta.leadId,
    usuarioId: userId,
    tipo: "proposta_enviada",
    titulo: `Proposta #P-${String(proposta.numero).padStart(3, "0")}-v${proposta.versao} ${skipEmail ? "ativada (link gerado)" : "enviada por email"}`,
    descricao: skipEmail
      ? `Link público gerado (${valorTimeline}). Email não disparado (Salvar).`
      : `Enviada para ${lead?.email} (${valorTimeline}). Cliente decide o próximo passo na página pública.`,
    dados: { propostaId: proposta.id, linkPublico, emailId: emailResult.id ?? null },
  });

  return {
    ok: true,
    proposta: updated,
    checkoutUrl: linkPublico,
    emailSent: emailResult.sent,
    emailSkipped: emailResult.skipped ?? false,
    emailError: emailResult.error ?? null,
  };
}
