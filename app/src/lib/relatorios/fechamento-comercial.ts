/**
 * Fechamento Comercial (20/08, URGENTE — Financeiro fechando julho/2026).
 *
 * Regra de ouro: rastreabilidade > estética. Toda linha tem que levar de volta
 * ao registro original (negócio/proposta/contrato/Stripe). Nada aqui inventa
 * relação que não está no dado — quando a evidência não existe, o campo vem
 * `null`/vazio e a UI mostra "Não disponível", nunca um valor fabricado.
 *
 * Mesma janela e mesma regra de receita das outras superfícies (status='ganho',
 * `ganho_at` na janela) — os totais desta tela SEMPRE batem com a aba
 * Comercial/Meu desempenho, de propósito.
 *
 * A regra de receita vem de `decomporVenda` (`receita-fechada-shared.ts`) e de
 * mais lugar nenhum: `valorVendido` é o booking (recorrente + setup) e
 * `valorAvulso` é projeto/avulso, separado. Até 21/10/2026 esta tela calculava
 * `avulso ? valor_total : mrr_fechado`, que PERDIA o setup da venda recorrente.
 *
 * Achado real de auditoria (20/08, não é bug desta feature): não existe role
 * de usuário "sdr" hoje — o time foi reorganizado depois de julho (Jenifer
 * Matos, SDR real do período, hoje tem role "gerente"; Mayara/Mayra, closers
 * hoje, também aparecem como "responsável do lead" em alguns casos por terem
 * feito qualificação direta). `usuarios.role` NÃO é fonte confiável pra "quem
 * foi SDR quando" — a fonte real e histórica é `status_changes` (quem executou
 * a transição, no momento em que ela aconteceu), exatamente como já
 * documentado em docs/produto/relatorios-sdr.md (21-22/07). `leads.agenda_closer_id`
 * existe no schema mas tem 0% de cobertura em produção — não é usado aqui.
 */
import { assinaturaDoCrm, faturaDoCrm } from "@/lib/financeiro/espelho-crm";
import { decomporVenda } from "@/lib/relatorios/receita-fechada-shared";
import { ehAutoatendimento, nomeDoVendedor } from "@/lib/relatorios/autoatendimento";
import { db } from "@/lib/db";
import { negocios, leads, empresas, usuarios, contratos, propostas, assinaturas, statusChanges, faturas } from "@/lib/db/schema";
import { eq, and, gte, lt, inArray, sql, asc, desc } from "drizzle-orm";

const num = (v: unknown): number => Number(v ?? 0) || 0;

/**
 * O que serve de comprovante de uma venda, em ordem de força.
 *
 * Regra do Scott (09/11/2026): "dá ganho só com contrato assinado ou pagamento
 * confirmado, então tudo precisa ter comprovante — contrato ou recibo. Se está
 * sem, provavelmente tem alguma cagada." Logo, venda sem nenhum destes é um
 * defeito a investigar, não uma linha normal do relatório.
 *
 * `recibo` é o link hospedado da fatura paga; `contrato` é o PDF assinado (ou o
 * link público da assinatura). `recibo_da_empresa` é o mesmo recibo, mas achado
 * pelo vínculo com a empresa em vez do contrato ou do lead da venda — vale como
 * prova e é rotulado assim para ninguém confundir. `stripe` é o painel: evidência
 * de que existe cobrança, sem ser o documento.
 */
export type ComprovanteTipo = "recibo" | "contrato" | "recibo_da_empresa" | "stripe";

const ROTULO_COMPROVANTE: Record<ComprovanteTipo, string> = {
  recibo: "Recibo",
  contrato: "Contrato assinado",
  recibo_da_empresa: "Recibo (da empresa)",
  stripe: "Assinatura no Stripe",
};

export function escolherComprovante(fontes: {
  reciboDoContrato?: string | null;
  reciboDoLead?: string | null;
  contratoAssinado?: string | null;
  reciboDaEmpresa?: string | null;
  stripeSubscriptionId?: string | null;
  stripeCustomerId?: string | null;
}): { url: string; tipo: ComprovanteTipo; rotulo: string } | null {
  const escolha = (url: string | null | undefined, tipo: ComprovanteTipo) =>
    url ? { url, tipo, rotulo: ROTULO_COMPROVANTE[tipo] } : null;
  return escolha(fontes.reciboDoContrato, "recibo")
    ?? escolha(fontes.reciboDoLead, "recibo")
    ?? escolha(fontes.contratoAssinado, "contrato")
    ?? escolha(fontes.reciboDaEmpresa, "recibo_da_empresa")
    ?? escolha(fontes.stripeSubscriptionId ? `https://dashboard.stripe.com/subscriptions/${fontes.stripeSubscriptionId}` : null, "stripe")
    ?? escolha(fontes.stripeCustomerId ? `https://dashboard.stripe.com/customers/${fontes.stripeCustomerId}` : null, "stripe");
}

/**
 * AUTOATENDIMENTO (self-checkout): o cliente assinou sozinho na plataforma e
 * pagou no Stripe, sem passar pelo comercial. É receita como qualquer outra
 * (decisão do Scott, 09/11/2026) e precisa aparecer no fechamento e na meta do
 * mês — só não tem vendedor, porque não houve vendedor.
 *
 * Fonte única do rótulo e da chave: `lib/relatorios/autoatendimento.ts`.
 */

export interface VendaFechada {
  negocioId: string;
  /** Venda nascida no self-checkout: sem closer, sem SDR, sem proposta. */
  autoatendimento?: boolean;
  ganhoAt: string | null;
  empresaId: string | null;
  empresaNome: string | null;
  contatoId: string | null;
  contatoNome: string | null;
  contatoEmail: string | null;
  closerId: string | null;
  closerNome: string | null;
  sdrId: string | null;
  sdrNome: string | null;
  sdrEvidencia: string;
  origem: string | null;
  serviceFamily: string | null;
  produtos: string[];
  tipoReceita: string | null;
  mrrFechado: number;
  valorTotal: number;
  valorSetup: number;
  /** O booking desta venda (recorrente + setup), por `decomporVenda`. A UI lê daqui. */
  valorVendido: number;
  /** Projeto/avulso desta venda. Fica FORA do booking, mostrado ao lado. */
  valorAvulso: number;
  status: string;
  propostaId: string | null;
  propostaNumero: number | null;
  propostaStatus: string | null;
  contratoId: string | null;
  contratoStatus: string | null;
  contratoZohoId: string | null;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  faturaHostedUrl: string | null;
  /** O comprovante desta venda: recibo do pagamento ou contrato assinado. */
  comprovanteUrl: string | null;
  comprovanteTipo: ComprovanteTipo | null;
  /** Como mostrar na tela e na planilha: "Recibo", "Contrato assinado"... */
  comprovanteRotulo: string | null;
}

export interface AgendaRealizada {
  leadId: string;
  leadNome: string | null;
  empresaNome: string | null;
  sdrId: string | null;
  sdrNome: string | null;
  agendadaEm: string | null;
  realizadaEm: string | null;
  tipoEvento: string | null;
  negocioId: string | null;
  negocioTitulo: string | null;
  closerId: string | null;
  closerNome: string | null;
  resultadoAtual: string | null;
  vendaRelacionada: boolean;
}

export interface VendaAtribuidaSdr {
  negocioId: string;
  sdrId: string | null;
  sdrNome: string | null;
  closerId: string | null;
  closerNome: string | null;
  empresaNome: string | null;
  ganhoAt: string | null;
  valor: number;
  serviceFamily: string | null;
  origemAtribuicao: string;
}

const POS_CALL = ["reuniao_realizada", "trial", "proposta_apresentada", "negociacao_iniciada", "ganho"];

/**
 * Bloco 1 — uma linha por venda/oportunidade Won no período. Cada entidade
 * relacionada (proposta/contrato/assinatura) é buscada em query separada e
 * casada em JS por negocioId/leadId/contratoId — de propósito, pra nunca
 * arriscar fan-out de JOIN inflando contagem/soma numa tela financeira.
 */
export async function listarVendasFechadas(orgId: string, since: Date, until: Date): Promise<VendaFechada[]> {
  const negociosGanhos = await db
    .select({
      id: negocios.id, leadId: negocios.leadId, empresaId: negocios.empresaId,
      responsavelId: negocios.responsavelId, ganhoAt: negocios.ganhoAt, status: negocios.status,
      tipoReceita: negocios.tipoReceita, mrrFechado: negocios.mrrFechado, valorTotal: negocios.valorTotal,
      valorSetup: negocios.valorSetup, servicosInteresse: negocios.servicosInteresse,
    })
    .from(negocios)
    .where(and(
      eq(negocios.organizacaoId, orgId),
      eq(negocios.status, "ganho"),
      gte(negocios.ganhoAt, since),
      lt(negocios.ganhoAt, until),
    ));

  // `service_family` existe na coluna real de `negocios` (reconciliação
  // semântica aplicada direto no banco) mas nunca foi mapeada em schema.ts —
  // achado de auditoria, não corrigido aqui (fora de escopo tocar o schema
  // compartilhado por uma feature read-only). Busca via SQL cru, isolado.
  const familiaPorNegocio = new Map<string, string | null>();
  // `origem_negocio` entra na MESMA busca: venda de autoatendimento (self-checkout)
  // não tem closer, e sem isso a coluna sairia "—" como se faltasse dado. Ver
  // AUTOATENDIMENTO abaixo.
  const origemPorNegocio = new Map<string, string | null>();
  if (negociosGanhos.length > 0) {
    const negocioIdsIniciais = negociosGanhos.map((n) => n.id);
    const familiaRows = await db.execute<{ id: string; service_family: string | null; origem_negocio: string | null }>(sql`
      SELECT id, service_family, origem_negocio FROM negocios WHERE id IN (${sql.join(negocioIdsIniciais.map((id) => sql`${id}`), sql`,`)})
    `);
    for (const r of familiaRows) {
      familiaPorNegocio.set(r.id, r.service_family);
      origemPorNegocio.set(r.id, r.origem_negocio);
    }
  }

  if (negociosGanhos.length === 0) return [];

  const negocioIds = negociosGanhos.map((n) => n.id);
  const leadIds = [...new Set(negociosGanhos.map((n) => n.leadId).filter((v): v is string => !!v))];
  const responsavelIds = [...new Set(negociosGanhos.map((n) => n.responsavelId).filter((v): v is string => !!v))];

  // Achado real (20/08, feedback do Kauã com dado ao vivo): `leads.stripe_customer_id`
  // cobre 44/58 vendas de julho — quase o dobro da cobertura via
  // `contratos.stripe_subscription_id`+`assinaturas` (23/58). Cliente pode ter
  // Customer real no Stripe sem Subscription sincronizada ainda (boleto/PIX
  // manual, ou sync incompleto) — mostrar o Customer já é uma evidência real e
  // útil pro Financeiro, mesmo sem a Subscription.
  const leadsRows = leadIds.length > 0
    ? await db.select({ id: leads.id, nome: leads.nome, sobrenome: leads.sobrenome, email: leads.email, origem: leads.origem, empresaId: leads.empresaId, empresaTexto: leads.empresa, stripeCustomerId: leads.stripeCustomerId }).from(leads).where(inArray(leads.id, leadIds))
    : [];
  // Empresa: `negocios.empresaId` cobre só 11/58 — `leads.empresaId` (fallback)
  // sobe pra 22/58. O resto (36/58) genuinamente não tem empresa vinculada em
  // lugar nenhum do CRM — gap real de dado, não desta feature, mostrado como
  // "—" honestamente, nunca inventado.
  const empresaIdsDosNegocios = negociosGanhos.map((n) => n.empresaId).filter((v): v is string => !!v);
  const empresaIdsDosLeads = leadsRows.map((l) => l.empresaId).filter((v): v is string => !!v);
  const empresaIds = [...new Set([...empresaIdsDosNegocios, ...empresaIdsDosLeads])];
  const empresasRows = empresaIds.length > 0
    ? await db.select({ id: empresas.id, nome: empresas.nome }).from(empresas).where(inArray(empresas.id, empresaIds))
    : [];
  const usuariosRows = responsavelIds.length > 0
    ? await db.select({ id: usuarios.id, nome: usuarios.nome }).from(usuarios).where(inArray(usuarios.id, responsavelIds))
    : [];

  // Contrato/proposta mais recente por negócio (evita fan-out quando há mais de 1).
  const contratosRows = await db.select({
    id: contratos.id, negocioId: contratos.negocioId, status: contratos.status, zohoId: contratos.zohoId,
    stripeSubscriptionId: contratos.stripeSubscriptionId, createdAt: contratos.createdAt,
    // O contrato assinado é comprovante tanto quanto o recibo (Scott, 09/11/2026):
    // "dá ganho só com contrato assinado ou pagamento confirmado".
    documentoFinalUrl: contratos.documentoFinalUrl, signaturePublicUrl: contratos.signaturePublicUrl,
    signatureStatus: contratos.signatureStatus, assinadoEm: contratos.assinadoEm,
  }).from(contratos).where(inArray(contratos.negocioId, negocioIds));
  const propostasRows = await db.select({ id: propostas.id, negocioId: propostas.negocioId, numero: propostas.numero, status: propostas.status, createdAt: propostas.createdAt })
    .from(propostas).where(inArray(propostas.negocioId, negocioIds));

  const contratoPorNegocio = new Map<string, typeof contratosRows[number]>();
  for (const c of contratosRows) {
    if (!c.negocioId) continue;
    const atual = contratoPorNegocio.get(c.negocioId);
    if (!atual || c.createdAt > atual.createdAt) contratoPorNegocio.set(c.negocioId, c);
  }
  const propostaPorNegocio = new Map<string, typeof propostasRows[number]>();
  for (const p of propostasRows) {
    if (!p.negocioId) continue;
    const atual = propostaPorNegocio.get(p.negocioId);
    if (!atual || p.createdAt > atual.createdAt) propostaPorNegocio.set(p.negocioId, p);
  }

  // Stripe: vínculo real é por stripe_subscription_id (texto) — assinaturas.contrato_id
  // está com 0% de cobertura em produção pra vendas recentes (achado de auditoria,
  // não corrigido aqui: não é escopo desta feature reescrever histórico).
  const stripeSubIds = [...new Set([...contratoPorNegocio.values()].map((c) => c.stripeSubscriptionId).filter((v): v is string => !!v))];
  const assinaturasRows = stripeSubIds.length > 0
    ? await db.select({ stripeSubscriptionId: assinaturas.stripeSubscriptionId, stripeCustomerId: assinaturas.stripeCustomerId })
        .from(assinaturas).where(and(inArray(assinaturas.stripeSubscriptionId, stripeSubIds), assinaturaDoCrm))
    : [];
  const assinaturaPorStripeSub = new Map(assinaturasRows.map((a) => [a.stripeSubscriptionId, a]));

  // Comprovante real (pedido do Kauã 18/08: link do pagamento, não do painel
  // Customer/Subscription) — `faturas.hosted_invoice_url` é o link hospedado
  // pelo Stripe da fatura em si. Vínculo por contratoId (preferencial) com
  // fallback por leadId; pega a fatura mais recente com URL preenchida.
  const contratoIds = [...contratoPorNegocio.values()].map((c) => c.id);
  /* Casar SÓ por contrato e lead deixava venda paga sem comprovante na tela.
     Medido em 09/11/2026 nas vendas de novembro: Chatpro e MENOLIFT têm fatura
     paga, com link do Stripe, presa a OUTRO lead da mesma empresa (a empresa tem
     vários), e apareciam como "sem evidência" para o Financeiro. A empresa é a
     identidade do cliente, então ela entra como terceiro caminho — rotulada como
     recibo DA EMPRESA, porque é vínculo mais frouxo que o do contrato. */
  const faturasRows = (contratoIds.length > 0 || leadIds.length > 0 || empresaIds.length > 0)
    ? await db.select({ contratoId: faturas.contratoId, leadId: faturas.leadId, empresaId: faturas.empresaId, hostedInvoiceUrl: faturas.hostedInvoiceUrl, createdAt: faturas.createdAt })
        .from(faturas)
        .where(and(
          faturaDoCrm,
          sql`${faturas.hostedInvoiceUrl} IS NOT NULL`,
          sql`(${contratoIds.length > 0 ? inArray(faturas.contratoId, contratoIds) : sql`false`}
               OR ${leadIds.length > 0 ? inArray(faturas.leadId, leadIds) : sql`false`}
               OR ${empresaIds.length > 0 ? inArray(faturas.empresaId, empresaIds) : sql`false`})`,
        ))
        .orderBy(desc(faturas.createdAt))
    : [];
  const faturaPorContrato = new Map<string, string>();
  const faturaPorLead = new Map<string, string>();
  const faturaPorEmpresa = new Map<string, string>();
  for (const f of faturasRows) {
    if (f.contratoId && f.hostedInvoiceUrl && !faturaPorContrato.has(f.contratoId)) faturaPorContrato.set(f.contratoId, f.hostedInvoiceUrl);
    if (f.leadId && f.hostedInvoiceUrl && !faturaPorLead.has(f.leadId)) faturaPorLead.set(f.leadId, f.hostedInvoiceUrl);
    if (f.empresaId && f.hostedInvoiceUrl && !faturaPorEmpresa.has(f.empresaId)) faturaPorEmpresa.set(f.empresaId, f.hostedInvoiceUrl);
  }

  // "Quem qualificou" — primeiro evento real `→ reuniao_agendada` na vida do
  // lead (mesma definição de docs/produto/relatorios-sdr.md). usuario_id null = Agente SDR (IA).
  const primeiroEventoAgendamento = leadIds.length > 0
    ? await db.execute<{ lead_id: string; usuario_id: string | null; created_at: string }>(sql`
        SELECT DISTINCT ON (lead_id) lead_id, usuario_id, created_at
        FROM status_changes
        WHERE lead_id IN (${sql.join(leadIds.map((id) => sql`${id}`), sql`,`)}) AND para_status = 'reuniao_agendada'
        ORDER BY lead_id, created_at ASC
      `)
    : [];
  const eventoPorLead = new Map(primeiroEventoAgendamento.map((e) => [e.lead_id, e]));
  const sdrIds = [...new Set(primeiroEventoAgendamento.map((e) => e.usuario_id).filter((v): v is string => !!v))];
  const sdrUsuarios = sdrIds.length > 0
    ? await db.select({ id: usuarios.id, nome: usuarios.nome }).from(usuarios).where(inArray(usuarios.id, sdrIds))
    : [];
  const sdrUsuarioPorId = new Map(sdrUsuarios.map((u) => [u.id, u.nome]));

  const leadPorId = new Map(leadsRows.map((l) => [l.id, l]));
  const empresaPorId = new Map(empresasRows.map((e) => [e.id, e]));
  const usuarioPorId = new Map(usuariosRows.map((u) => [u.id, u.nome]));

  return negociosGanhos.map((n) => {
    const lead = n.leadId ? leadPorId.get(n.leadId) : null;
    const empresaIdResolvido = n.empresaId ?? lead?.empresaId ?? null;
    const empresa = empresaIdResolvido ? empresaPorId.get(empresaIdResolvido) : null;
    const contrato = contratoPorNegocio.get(n.id);
    const proposta = propostaPorNegocio.get(n.id);
    const assinatura = contrato?.stripeSubscriptionId ? assinaturaPorStripeSub.get(contrato.stripeSubscriptionId) : undefined;
    const evento = n.leadId ? eventoPorLead.get(n.leadId) : undefined;
    const sdrNome = evento ? (evento.usuario_id ? sdrUsuarioPorId.get(evento.usuario_id) ?? null : "Agente SDR (IA)") : null;
    const receita = decomporVenda({
      tipoReceita: n.tipoReceita,
      mrrFechado: num(n.mrrFechado),
      valorSetup: num(n.valorSetup),
      valorTotal: num(n.valorTotal),
      serviceFamily: familiaPorNegocio.get(n.id) ?? null,
    });

    return {
      negocioId: n.id,
      ganhoAt: n.ganhoAt ? n.ganhoAt.toISOString() : null,
      empresaId: empresaIdResolvido,
      // Fallback final: nome livre de `leads.empresa` quando não há registro
      // de Empresa vinculado em lugar nenhum (não deveria mais ocorrer depois
      // da vinculação retroativa de 18/08, mas mantido como rede de segurança
      // honesta em vez de mostrar "—" quando existe algum nome real).
      empresaNome: empresa?.nome ?? lead?.empresaTexto ?? null,
      contatoId: n.leadId,
      contatoNome: lead ? `${lead.nome}${lead.sobrenome ? ` ${lead.sobrenome}` : ""}` : null,
      contatoEmail: lead?.email ?? null,
      closerId: n.responsavelId,
      // Venda de autoatendimento não tem closer porque ninguém vendeu: o cliente
      // assinou sozinho e pagou. "—" aqui lia como dado faltando; o rótulo diz o
      // que de fato aconteceu, sem inventar uma pessoa. `closerId` segue null.
      closerNome: nomeDoVendedor(
        n.responsavelId ? usuarioPorId.get(n.responsavelId) : null,
        origemPorNegocio.get(n.id),
      ),
      autoatendimento: ehAutoatendimento(origemPorNegocio.get(n.id)),
      sdrId: evento?.usuario_id ?? null,
      sdrNome,
      sdrEvidencia: evento ? `evento reunião agendada em ${new Date(evento.created_at).toLocaleDateString("pt-BR")}` : "sem evento de agendamento encontrado — atribuição indisponível",
      origem: lead?.origem ?? null,
      serviceFamily: familiaPorNegocio.get(n.id) ?? null,
      produtos: n.servicosInteresse ?? [],
      tipoReceita: n.tipoReceita,
      mrrFechado: num(n.mrrFechado),
      valorTotal: num(n.valorTotal),
      valorSetup: num(n.valorSetup),
      valorVendido: receita.booking,
      valorAvulso: receita.avulso,
      status: n.status,
      propostaId: proposta?.id ?? null,
      propostaNumero: proposta?.numero ?? null,
      propostaStatus: proposta?.status ?? null,
      contratoId: contrato?.id ?? null,
      contratoStatus: contrato?.status ?? null,
      contratoZohoId: contrato?.zohoId ?? null,
      stripeSubscriptionId: contrato?.stripeSubscriptionId ?? null,
      stripeCustomerId: assinatura?.stripeCustomerId ?? lead?.stripeCustomerId ?? null,
      faturaHostedUrl: (contrato?.id ? faturaPorContrato.get(contrato.id) : undefined) ?? (n.leadId ? faturaPorLead.get(n.leadId) : undefined) ?? null,
      ...(() => {
        const c = escolherComprovante({
          reciboDoContrato: contrato?.id ? faturaPorContrato.get(contrato.id) : null,
          reciboDoLead: n.leadId ? faturaPorLead.get(n.leadId) : null,
          // Só conta como contrato o que foi REALMENTE assinado: contrato em
          // rascunho ou aguardando assinatura não prova venda nenhuma.
          contratoAssinado: contrato && (contrato.assinadoEm || contrato.signatureStatus === "signed")
            ? contrato.documentoFinalUrl ?? contrato.signaturePublicUrl ?? null
            : null,
          reciboDaEmpresa: empresaIdResolvido ? faturaPorEmpresa.get(empresaIdResolvido) : null,
          stripeSubscriptionId: contrato?.stripeSubscriptionId ?? null,
          stripeCustomerId: assinatura?.stripeCustomerId ?? lead?.stripeCustomerId ?? null,
        });
        return { comprovanteUrl: c?.url ?? null, comprovanteTipo: c?.tipo ?? null, comprovanteRotulo: c?.rotulo ?? null };
      })(),
    };
  }).sort((a, b) => (b.ganhoAt ?? "").localeCompare(a.ganhoAt ?? ""));
}

/**
 * Bloco 2 — agendas realizadas por SDR no período (distingue agendada de
 * realizada, mesma régua de `funil-eventos.ts::contarReunioes`, mas linha a
 * linha em vez de agregado). "Realizada" = lead avançou pra qualquer etapa
 * pós-call (`POS_CALL`) depois do agendamento — closers pulam a etapa literal
 * "reunião realizada" (decisão Kauã 21/07, documentada em docs/produto/relatorios-sdr.md).
 */
export async function listarAgendasRealizadas(orgId: string, since: Date, until: Date): Promise<AgendaRealizada[]> {
  const agendamentos = await db.execute<{
    lead_id: string; usuario_id: string | null; created_at: string;
  }>(sql`
    SELECT sc.lead_id, sc.usuario_id, sc.created_at
    FROM status_changes sc
    JOIN leads l ON l.id = sc.lead_id
    WHERE l.organizacao_id = ${orgId} AND sc.para_status = 'reuniao_agendada'
      AND sc.created_at >= ${since.toISOString()} AND sc.created_at < ${until.toISOString()}
  `);
  if (agendamentos.length === 0) return [];

  const leadIds = [...new Set(agendamentos.map((a) => a.lead_id))];

  const posCallEventos = await db.execute<{ lead_id: string; para_status: string; created_at: string }>(sql`
    SELECT lead_id, para_status, created_at FROM status_changes
    WHERE lead_id IN (${sql.join(leadIds.map((id) => sql`${id}`), sql`,`)})
      AND para_status IN (${sql.join(POS_CALL.map((s) => sql`${s}`), sql`,`)})
    ORDER BY created_at ASC
  `);
  const primeiroPosCallPorLead = new Map<string, { status: string; createdAt: string }>();
  for (const e of posCallEventos) {
    if (!primeiroPosCallPorLead.has(e.lead_id)) primeiroPosCallPorLead.set(e.lead_id, { status: e.para_status, createdAt: e.created_at });
  }

  const leadsRows = await db.select({ id: leads.id, nome: leads.nome, sobrenome: leads.sobrenome, empresaId: leads.empresaId, empresaTexto: leads.empresa, negocioAtivoId: leads.negocioAtivoId }).from(leads).where(inArray(leads.id, leadIds));
  const leadPorId = new Map(leadsRows.map((l) => [l.id, l]));
  const empresaIds = [...new Set(leadsRows.map((l) => l.empresaId).filter((v): v is string => !!v))];
  const empresasRows = empresaIds.length > 0 ? await db.select({ id: empresas.id, nome: empresas.nome }).from(empresas).where(inArray(empresas.id, empresaIds)) : [];
  const empresaPorId = new Map(empresasRows.map((e) => [e.id, e.nome]));

  const negocioIds = [...new Set(leadsRows.map((l) => l.negocioAtivoId).filter((v): v is string => !!v))];
  const negociosRows = negocioIds.length > 0
    ? await db.select({ id: negocios.id, titulo: negocios.titulo, status: negocios.status, responsavelId: negocios.responsavelId }).from(negocios).where(inArray(negocios.id, negocioIds))
    : [];
  const negocioPorId = new Map(negociosRows.map((n) => [n.id, n]));

  const usuarioIds = [...new Set([...agendamentos.map((a) => a.usuario_id), ...negociosRows.map((n) => n.responsavelId)].filter((v): v is string => !!v))];
  const usuariosRows = usuarioIds.length > 0 ? await db.select({ id: usuarios.id, nome: usuarios.nome }).from(usuarios).where(inArray(usuarios.id, usuarioIds)) : [];
  const usuarioPorId = new Map(usuariosRows.map((u) => [u.id, u.nome]));

  return agendamentos.map((a) => {
    const lead = leadPorId.get(a.lead_id);
    const negocio = lead?.negocioAtivoId ? negocioPorId.get(lead.negocioAtivoId) : null;
    const posCall = primeiroPosCallPorLead.get(a.lead_id);
    const realizada = !!posCall && new Date(posCall.createdAt) >= new Date(a.created_at);
    return {
      leadId: a.lead_id,
      leadNome: lead ? `${lead.nome}${lead.sobrenome ? ` ${lead.sobrenome}` : ""}` : null,
      empresaNome: (lead?.empresaId ? empresaPorId.get(lead.empresaId) : null) ?? lead?.empresaTexto ?? null,
      sdrId: a.usuario_id,
      sdrNome: a.usuario_id ? usuarioPorId.get(a.usuario_id) ?? null : "Agente SDR (IA)",
      agendadaEm: a.created_at,
      realizadaEm: realizada ? posCall!.createdAt : null,
      tipoEvento: realizada ? posCall!.status : null,
      negocioId: negocio?.id ?? null,
      negocioTitulo: negocio?.titulo ?? null,
      closerId: negocio?.responsavelId ?? null,
      closerNome: negocio?.responsavelId ? usuarioPorId.get(negocio.responsavelId) ?? null : null,
      resultadoAtual: negocio?.status ?? null,
      vendaRelacionada: negocio?.status === "ganho",
    };
  }).sort((a, b) => (b.agendadaEm ?? "").localeCompare(a.agendadaEm ?? ""));
}

/**
 * Bloco 3 — vendas Won no período cuja evidência de status_changes mostra um
 * SDR diferente do closer que fechou (handoff real, não regra de comissão
 * inventada — só exposição do fato). Reusa `listarVendasFechadas` pra nunca
 * duplicar a regra de quem é "Won" e qual é o valor.
 */
export async function listarVendasAtribuidasSdr(orgId: string, since: Date, until: Date): Promise<VendaAtribuidaSdr[]> {
  const vendas = await listarVendasFechadas(orgId, since, until);
  return vendas
    .filter((v) => v.sdrId && v.sdrId !== v.closerId)
    .map((v) => ({
      negocioId: v.negocioId,
      sdrId: v.sdrId,
      sdrNome: v.sdrNome,
      closerId: v.closerId,
      closerNome: v.closerNome,
      empresaNome: v.empresaNome,
      ganhoAt: v.ganhoAt,
      valor: v.valorVendido,
      serviceFamily: v.serviceFamily,
      origemAtribuicao: v.sdrEvidencia,
    }));
}
