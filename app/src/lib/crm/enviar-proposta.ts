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
import { propostas, propostaItens, leads, atividades, catalogoPrecos, usuarios } from "@/lib/db/schema";
import { eq, asc, and } from "drizzle-orm";
import { type ResendResult } from "@/lib/email/resend";
import { enviarResendRegistrado } from "@/lib/email/entrega";
import { enviarPelaCaixaDoUsuario } from "@/lib/email/enviar-como-usuario";
import { enviarTextoParaLead } from "@/lib/whatsapp/enviar";
import { buildPropostaEmail } from "@/lib/email/proposta-email";
import { publicarEvento } from "@/lib/events/outbox";
import { syncOportunidadeItensFromProposta } from "@/lib/crm/composicao-comercial";
import { formarGruposComerciais, vincularContratoPreparadoAoGrupo } from "@/lib/crm/grupo-comercial";
import { exigeContrato } from "@/lib/crm/commercial-model";
import { gerarContratoDeTemplate, conferirContratoDoGrupo } from "@/lib/crm/contrato-template";
import { periodoDoItemSql } from "@/lib/catalogo/descricao-do-item";
import { appUrl } from "@/lib/app-url";
import { dataValidadePadrao } from "@/lib/crm/proposta-regras";

type PropostaRow = typeof propostas.$inferSelect;


/** Por onde o e-mail saiu: a caixa do usuário (Outlook/Google/IMAP) ou o Resend do sistema. */
export type ViaEmail = "conta" | "resend";
export type ResultadoEmailEnviado = ResendResult & { via: ViaEmail; de?: string | null; avisoConta?: string | null; emailId?: string | null };

/**
 * O e-mail que leva o link público ao cliente. Uma porta só: o envio legado
 * (Hono /propostas/:id/enviar) e o envio do módulo Vendas (`acaoEnviar`) usam
 * esta função. O envio novo só gravava `status = enviada` e a tela dizia "avisa
 * o cliente por e-mail": ninguém recebia o link.
 *
 * Com `usuario`, sai da CAIXA de quem clicou em enviar (Outlook, Google ou
 * IMAP; registrado em `emails`). Sem caixa conectada, ou se ela falhar, cai no
 * Resend sem travar o fluxo, e o resultado diz `via: "resend"`. No Resend o
 * `replyTo` é o e-mail de quem enviou: o e-mail pede "responda este e-mail" e
 * a resposta não pode morrer num no-reply.
 *
 * PENDÊNCIA CONHECIDA (decisão do dono, 13/10/2026): o texto do e-mail é o
 * template fixo de `buildPropostaEmail`. O assunto, a introdução e o CC
 * editados no passo 5 do Builder continuam sendo descartados; o template será
 * refeito à parte (variáveis, viés comercial). Não corrigir aqui.
 */
export async function dispararEmailDaProposta(p: {
  para: string; clienteNome: string; empresa?: string | null;
  proposta: Pick<PropostaRow, "id" | "organizacaoId" | "leadId" | "numero" | "versao" | "moeda">;
  /** `periodo` é o do Price (mensal | anual | unico): o e-mail separa mensalidade, anuidade e itens únicos. */
  itens: Array<{ nome: string; tipo: string; subtotal: number; periodo?: string | null }>;
  totalRecorrente: number; totalAvulso: number; linkPublico: string;
  validade?: string | null; remetenteNome?: string | null;
  /** Quem clicou em enviar. Sem isto, sai pelo Resend (sistema). */
  usuario?: { organizacaoId: string; userId: string; leadId?: string | null };
}): Promise<ResultadoEmailEnviado> {
  const { subject, html } = buildPropostaEmail({
    clienteNome: p.clienteNome, empresa: p.empresa, numero: p.proposta.numero, versao: p.proposta.versao,
    moeda: p.proposta.moeda || "BRL", itens: p.itens, totalRecorrente: p.totalRecorrente, totalAvulso: p.totalAvulso,
    checkoutUrl: p.linkPublico, validade: p.validade, remetenteNome: p.remetenteNome ?? null,
  });
  let avisoConta: string | null = null;
  let replyTo: string | undefined;
  if (p.usuario) {
    const pela = await enviarPelaCaixaDoUsuario({ ...p.usuario, para: p.para, assunto: subject, html, origem: { tipo: "proposta", id: p.proposta.id } });
    if (pela?.enviado) return { sent: true, via: "conta", de: pela.de, emailId: pela.emailId };
    if (pela && !pela.enviado) avisoConta = `A caixa ${pela.de} falhou (${pela.erro}); enviado pelo e-mail do sistema.`;
    const [u] = await db.select({ email: usuarios.email }).from(usuarios)
      .where(and(eq(usuarios.id, p.usuario.userId), eq(usuarios.organizacaoId, p.usuario.organizacaoId))).limit(1);
    replyTo = u?.email || undefined;
  }
  try {
    // Registra em `emails` com o id do provedor: é por ele que a ficha descobre bounce/suppressed depois.
    const r = await enviarResendRegistrado(
      { to: p.para, subject, html, ...(replyTo ? { replyTo } : {}) },
      { organizacaoId: p.proposta.organizacaoId, leadId: p.proposta.leadId, enviadoPorId: p.usuario?.userId ?? null, origem: { tipo: "proposta", id: p.proposta.id } },
    );
    return { ...r, via: "resend", de: null, avisoConta };
  } catch (e) {
    // A trava de destino do ambiente lança; vira "falhou" com o motivo, sem derrubar o envio da proposta.
    return { sent: false, error: e instanceof Error ? e.message : String(e), via: "resend", de: null, avisoConta };
  }
}

export type ResultadoEmail = "enviado" | "nao_solicitado" | "sem_destinatario" | "sem_provedor" | "falhou";
/** O que aconteceu com o WhatsApp. Só `enviado` é "saiu pelo número de quem clicou". */
export type ResultadoWhatsapp = "enviado" | "nao_solicitado" | "sem_sessao" | "desconectada" | "sem_telefone" | "falhou";

/**
 * Quem recebe o e-mail. `enviarEmail=false` é "só o link": nunca há destino, nem
 * o e-mail do lead entra como reserva. Com `enviarEmail=true`, vale o destinatário
 * escolhido e, só então, o e-mail do contato.
 */
export function decidirDestinoEmail(o: { enviarEmail: boolean; destinatarioEmail?: string | null; emailDoLead?: string | null }): string {
  if (!o.enviarEmail) return "";
  return (o.destinatarioEmail || o.emailDoLead || "").trim();
}

/** Texto do WhatsApp com o link SEMPRE dentro: o vendedor pode ter apagado o link ao editar. */
export function textoWhatsappDaProposta(o: { mensagem?: string | null; link: string; nome?: string | null; numero: number; versao: number }): string {
  const m = (o.mensagem || "").trim();
  if (m) return m.includes(o.link) ? m : `${m}\n\n${o.link}`;
  const primeiro = (o.nome || "").trim().split(/\s+/)[0];
  return `${primeiro ? `Olá, ${primeiro}!` : "Olá!"} Segue a proposta P-${String(o.numero).padStart(3, "0")}-v${o.versao} da Callface:\n${o.link}`;
}

/**
 * Depois de `lib/vendas/propostas.enviarProposta` marcar a proposta como
 * enviada: manda o e-mail e o WhatsApp com o link e registra na timeline o que
 * de fato aconteceu. Nunca lança: o envio da proposta já aconteceu.
 *
 * E-mail: caixa de quem enviou, senão Resend (ver `dispararEmailDaProposta`).
 * WhatsApp: SÓ pelo número de quem enviou; sem número conectado devolve
 * `sem_sessao`/`desconectada` e não sai por outro número.
 */
export async function avisarClienteDaPropostaEnviada(opts: {
  propostaId: string; organizacaoId: string; userId: string; userName?: string | null;
  /** Obrigatório: o vendedor escolheu e-mail ou só o link. Não há valor padrão. */
  enviarEmail: boolean; destinatarioEmail?: string | null;
  /** Escolha explícita, como o e-mail. Padrão: não envia. */
  enviarWhatsapp?: boolean; telefoneWhatsapp?: string | null; mensagemWhatsapp?: string | null;
}): Promise<{
  link: string; email: ResultadoEmail; erro: string | null; destinatario: string | null;
  emailVia: ViaEmail | null; emailDe: string | null; avisoEmail: string | null;
  whatsapp: ResultadoWhatsapp; whatsappErro: string | null; whatsappPara: string | null;
}> {
  const link = `${appUrl()}/p/${opts.propostaId}`;
  const falha = (erro: string) => ({
    link, email: "falhou" as ResultadoEmail, erro, destinatario: null, emailVia: null, emailDe: null, avisoEmail: null,
    whatsapp: "falhou" as ResultadoWhatsapp, whatsappErro: erro, whatsappPara: null,
  });
  try {
    const [proposta] = await db.select().from(propostas)
      .where(and(eq(propostas.id, opts.propostaId), eq(propostas.organizacaoId, opts.organizacaoId))).limit(1);
    if (!proposta) return falha("Proposta não encontrada");
    const [lead] = await db.select({ nome: leads.nome, sobrenome: leads.sobrenome, empresa: leads.empresa, email: leads.email })
      .from(leads).where(eq(leads.id, proposta.leadId)).limit(1);
    const destino = decidirDestinoEmail({ enviarEmail: opts.enviarEmail, destinatarioEmail: opts.destinatarioEmail, emailDoLead: lead?.email });
    const itens = await db.select({ nome: propostaItens.nome, tipo: propostaItens.tipo, subtotal: propostaItens.subtotal, periodo: periodoDoItemSql })
      .from(propostaItens).leftJoin(catalogoPrecos, eq(catalogoPrecos.id, propostaItens.catalogoPrecoId))
      .where(eq(propostaItens.propostaId, opts.propostaId)).orderBy(asc(propostaItens.ordem));
    const clienteNome = [lead?.nome, lead?.sobrenome].filter(Boolean).join(" ") || lead?.nome || "";

    let email: ResultadoEmail = opts.enviarEmail ? "sem_destinatario" : "nao_solicitado";
    let erro: string | null = null;
    let emailVia: ViaEmail | null = null, emailDe: string | null = null, avisoEmail: string | null = null;
    if (destino) {
      const r = await dispararEmailDaProposta({
        para: destino, clienteNome, empresa: lead?.empresa,
        proposta, itens: itens.map((i) => ({ nome: i.nome, tipo: i.tipo, subtotal: parseFloat(i.subtotal || "0"), periodo: i.periodo })),
        totalRecorrente: parseFloat(proposta.totalRecorrente || "0"), totalAvulso: parseFloat(proposta.totalAvulso || "0"),
        linkPublico: link, validade: proposta.dataValidade, remetenteNome: opts.userName ?? null,
        usuario: { organizacaoId: opts.organizacaoId, userId: opts.userId, leadId: proposta.leadId },
      });
      email = r.sent ? "enviado" : r.skipped ? "sem_provedor" : "falhou";
      erro = r.error ?? null;
      if (r.sent) { emailVia = r.via; emailDe = r.de ?? null; }
      avisoEmail = r.avisoConta ?? null;
    }

    let whatsapp: ResultadoWhatsapp = "nao_solicitado";
    let whatsappErro: string | null = null;
    let whatsappPara: string | null = null;
    if (opts.enviarWhatsapp) {
      const r = await enviarTextoParaLead({
        organizacaoId: opts.organizacaoId, userId: opts.userId, leadId: proposta.leadId,
        telefone: opts.telefoneWhatsapp,
        conteudo: textoWhatsappDaProposta({ mensagem: opts.mensagemWhatsapp, link, nome: clienteNome, numero: proposta.numero, versao: proposta.versao }),
      });
      if (r.ok) { whatsapp = "enviado"; whatsappPara = opts.telefoneWhatsapp ?? null; }
      else { whatsapp = r.motivo; whatsappErro = r.erro; }
    }

    const numero = `#P-${String(proposta.numero).padStart(3, "0")}-v${proposta.versao}`;
    const parteEmail = email === "enviado" ? `e-mail enviado para ${destino}${emailVia === "conta" ? ` pela caixa ${emailDe}` : " pelo e-mail do sistema"}`
      : email === "sem_provedor" ? "e-mail não disparado (provedor de e-mail não configurado)"
      : email === "falhou" ? "falha ao enviar o e-mail" : email === "nao_solicitado" ? "nenhum e-mail enviado"
      : "sem e-mail do contato, envie o link manualmente";
    const parteWa = whatsapp === "enviado" ? "WhatsApp enviado pelo número de quem enviou"
      : whatsapp === "nao_solicitado" ? "WhatsApp não solicitado" : `WhatsApp NÃO enviado (${whatsappErro})`;
    await db.insert(atividades).values({
      organizacaoId: opts.organizacaoId, leadId: proposta.leadId, negocioId: proposta.negocioId, usuarioId: opts.userId,
      tipo: "proposta_enviada",
      titulo: `Link da proposta ${numero}: ${parteEmail}; ${parteWa}`,
      descricao: [erro, avisoEmail, whatsappErro].filter(Boolean).join(" | ") || link,
      dados: { propostaId: proposta.id, linkPublico: link, email, para: destino || null, emailVia, emailDe, whatsapp, whatsappPara },
    });
    return { link, email, erro, destinatario: destino || null, emailVia, emailDe, avisoEmail, whatsapp, whatsappErro, whatsappPara };
  } catch (e) {
    console.error("[enviar-proposta] aviso ao cliente falhou:", e);
    return falha(e instanceof Error ? e.message : String(e));
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
    .select({ nome: propostaItens.nome, tipo: propostaItens.tipo, subtotal: propostaItens.subtotal, commercialModel: propostaItens.commercialModel, periodo: periodoDoItemSql })
    .from(propostaItens)
    .leftJoin(catalogoPrecos, eq(catalogoPrecos.id, propostaItens.catalogoPrecoId))
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
  const dataValidadeEfetiva = proposta.dataValidade || dataValidadePadrao();
  const base = appUrl();
  const clienteNome = [lead?.nome, lead?.sobrenome].filter(Boolean).join(" ") || lead?.nome || "";
  const linkPublico = `${base}/p/${proposta.id}`;

  const emailResult: ResendResult = !skipEmail && lead?.email
    ? await dispararEmailDaProposta({
        para: lead.email, clienteNome, empresa: lead.empresa, proposta,
        itens: itens.map((i) => ({ nome: i.nome, tipo: i.tipo, subtotal: parseFloat(i.subtotal || "0"), periodo: i.periodo })),
        totalRecorrente, totalAvulso, linkPublico, validade: dataValidadeEfetiva, remetenteNome: userName ?? null,
        usuario: { organizacaoId, userId, leadId: proposta.leadId },
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
    // O que o provedor respondeu, não o que se pretendia: "enviada por email" com e-mail que falhou enganava a timeline.
    titulo: `Proposta #P-${String(proposta.numero).padStart(3, "0")}-v${proposta.versao} ${skipEmail ? "ativada (link gerado)" : emailResult.sent ? "enviada por email" : "ativada, mas o e-mail NÃO saiu"}`,
    descricao: skipEmail
      ? `Link público gerado (${valorTimeline}). Email não disparado (Salvar).`
      : emailResult.sent
        ? `Enviada para ${lead?.email} (${valorTimeline}). Cliente decide o próximo passo na página pública.`
        : `E-mail para ${lead?.email} NÃO saiu (${emailResult.error ?? (emailResult.skipped ? "provedor de e-mail não configurado" : "falha no envio")}). Link público: ${linkPublico} (${valorTimeline}).`,
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
