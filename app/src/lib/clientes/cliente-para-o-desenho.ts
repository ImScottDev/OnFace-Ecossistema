/* ─────────────────────────────────────────────────────────────────────────
 * Cliente 360 (desenho do handoff) — a leitura.
 *
 * Arquivo PRÓPRIO da tela: compõe o que já existe (empresa360, billingDaConta,
 * healthDaEmpresa, lerLinhaDoTempo) e só traz em SQL o que nenhuma delas dá —
 * linha de `clientes`, carteira por família, contratos + itens, anexos,
 * closer, tarefas abertas e a equipe.
 *
 * Regra que vale para o arquivo todo: campo que o banco não tem volta null.
 * Quem decide como mostrar a ausência ("—") é o adaptador, nunca esta camada
 * inventando um default plausível.
 * ───────────────────────────────────────────────────────────────────────── */

import { doCrm } from "@/lib/financeiro/espelho-crm";
import { db } from "@/lib/db";
import { mrrOficialLinhas } from "@/lib/metricas/mrr-oficial";
import { faturamentoMensal, type FaturamentoMes } from "@/lib/financeiro/faturamento-mensal";
import { sql } from "drizzle-orm";
import { empresa360, type Empresa360 } from "@/lib/vendas/consultas";
import type { Classificacao } from "@/lib/vendas/classificacao-rotulos";
import { billingDaConta, type FaturaResumo, type BillingDoServico } from "@/lib/cs/billing";
import type { StatusAssinatura } from "@/lib/clientes/financeiro-regras";
import { healthDaEmpresa } from "@/lib/cs/health";
import { lerLinhaDoTempo, type LinhaDoTempo } from "@/lib/vendas/eventos";
import { resolveLocalPath } from "@/lib/storage/legacy-attachment-storage";

export interface ServicoDoCliente {
  id: string;
  familia: string;
  produto: string | null;
  valor: number;
  /** Quantos itens o cliente tem deste serviço (2 usuários, 5 licenças...). */
  quantidade: number;
  billingStatus: string | null;
  lifecycle: string | null;
  contratoId: string | null;
  /** Status REAL da assinatura do serviço no Stripe (vencida, cancelamento agendado...). null = sem assinatura. */
  assinaturaStatus: StatusAssinatura | null;
  /** Nome do produto como o Stripe o nomeia; a família não é nome de produto. */
  produtoReal: string | null;
  /** `servicos_canonicos.billing_source`: diz se o nome do produto é histórico do legado. */
  origem: string | null;
}

/** A assinatura como o Cliente 360 a mostra: o mesmo objeto que `billingDaConta` monta. */
export type AssinaturaDoCliente = Omit<NonNullable<BillingDoServico["assinatura"]>, "mrr"> & { mrr: number | null };

/**
 * Contrato de verdade = o que foi ASSINADO pelo Documenso ou o contrato do
 * legado (Zoho). Assinatura do Stripe (`sub_...`, valor por mês) é cobrança,
 * mora em `assinaturas`, e NUNCA entra em `contratos`. Regra única: toda tela
 * que lista contrato de uma conta passa por `origemDoContrato`.
 */
export type OrigemDoContrato = "documenso" | "legado" | "assinatura_stripe" | "proposta";

export function origemDoContrato(c: {
  signature_provider: string | null; codigo: string | null; tipo: string; stripe_subscription_id: string | null;
}): OrigemDoContrato {
  if (c.signature_provider === "documenso") return "documenso";
  if (c.codigo || c.tipo === "legado_zoho") return "legado";
  if (c.stripe_subscription_id) return "assinatura_stripe";
  return "proposta"; // gerado da proposta, sem assinatura nem legado: ainda não é contrato
}

export interface ContratoDoCliente {
  id: string;
  origem: "documenso" | "legado";
  /** Documenso: assinado e com o PDF final baixável em /api/contratos/:id/pdf-final. */
  pdfFinal: boolean;
  assinadoEm: string | null;
  tipo: string;
  status: string;
  mrr: number | null;
  inicio: string | null;
  vencimento: string | null;
  codigo: string | null;
  stripeSubscriptionId: string | null;
  familia: string | null;
  produto: string | null;
  itens: Array<{ nome: string; quantidade: number; valorUnitario: number; subtotal: number; familia: string | null; natureza: string | null }>;
}

export interface AnexoDoCliente {
  id: string;
  /** `upload` = enviado pelo 360 (acervo canônico, removível); `legado` = anexo do Zoho; `documenso` = PDF do contrato assinado. */
  origem: "legado" | "upload" | "documenso";
  /** Endereço de entrega do arquivo; só o upload e o Documenso têm. */
  url: string | null;
  entidadeTipo: string;
  entidadeId: string;
  categoria: string | null;
  nome: string;
  tamanhoBytes: number | null;
  criadoEm: string | null;
  disponivel: boolean;
}

export interface TarefaDoCliente {
  id: string;
  titulo: string;
  tipo: string | null;
  venceEm: string | null;
  responsavel: string | null;
}

export interface NotaDoCliente { id: string; texto: string; autor: string | null; em: string }

export interface ClienteDoDesenho {
  empresa: Empresa360;
  /**
   * Classe da conta (Cliente, Lead, Prospect, Contato) da função única
   * (`lib/vendas/classificacao.ts`, via `empresa360`). A tela não deriva classe:
   * ter linha em `clientes` abre o 360, mas quem diz se é Cliente é esta.
   */
  classificacao: Classificacao;
  /** `clientes.id`: é a chave de `notas.cliente_id`. */
  clienteId: string;
  /** Notas escritas na conta (notas.empresa_id), mais recentes primeiro. */
  notas: NotaDoCliente[];
  /** Quem é o CSM gravado (COALESCE(responsavel_cs_id, responsavel_id)). */
  csmId: string | null;
  /** `clientes.pessoa_principal_id`: o contato principal DESIGNADO (null = ninguém designado). */
  principalId: string | null;
  /** Equipe ativa com id: o menu de CS grava pelo id, nunca pelo nome. */
  equipeIds: Array<{ id: string; nome: string }>;
  clienteDesde: string | null;
  servicos: ServicoDoCliente[];
  /** Só contrato de verdade (Documenso assinado + legado). Ver `origemDoContrato`. */
  contratos: ContratoDoCliente[];
  /** Início das assinaturas do Stripe (histórico); não são contratos. */
  iniciosDeAssinatura: Array<{ inicio: string; codigo: string; mrr: number | null }>;
  faturas: FaturaResumo[];
  stripeCustomerId: string | null;
  assinaturas: AssinaturaDoCliente[];
  health: Awaited<ReturnType<typeof healthDaEmpresa>>;
  closer: string | null;
  /** CSM = COALESCE(responsavel_cs_id, responsavel_id) de `clientes` (E8). */
  csm: string | null;
  /** Faturamento mensal da empresa por natureza (cliente_receita_mensal). */
  faturamento: FaturamentoMes[];
  fulfillmentAberto: boolean;
  anexos: AnexoDoCliente[];
  tarefas: TarefaDoCliente[];
  equipe: string[];
  timeline: LinhaDoTempo[];
  /** pessoa canônica → lead legado. A ficha /pessoas/[id] é por LEAD. */
  leadDaPessoa: Record<string, string>;
  /** lead → created_at::text da última atividade visível na timeline. */
  ultimoContatoPorLead: Record<string, string>;
}

export async function clienteParaODesenho(organizacaoId: string, empresaId: string): Promise<ClienteDoDesenho | null> {
  /* "Cliente desde" vem da PRIMEIRA EVIDÊNCIA REAL de relação comercial:
   * negócio ganho, início de contrato ou primeira fatura paga.
   *
   * `clientes.cliente_desde` sozinho mentia: 90 clientes têm 16/08/2026, que é
   * o dia da carga de reconciliação, não o dia em que viraram clientes. Ele só
   * entra como último recurso, e só se a data não for um dia de carga em massa
   * — medido pelo próprio dado (mais de 20 clientes no mesmo dia), para não
   * depender de uma data escrita no código. */
  const [cli] = await db.execute<{ cliente_desde: string | null; cliente_id: string; csm_id: string | null; principal_id: string | null }>(sql`
    SELECT c.id::text AS cliente_id,
           COALESCE(c.responsavel_cs_id, c.responsavel_id)::text AS csm_id,
           c.pessoa_principal_id::text AS principal_id,
           COALESCE(
             LEAST(
               (SELECT min(n.ganho_at) FROM negocios n LEFT JOIN leads nl ON nl.id = n.lead_id
                 WHERE COALESCE(n.empresa_id, nl.empresa_id) = c.empresa_id AND n.organizacao_id = c.organizacao_id AND n.ganho_at IS NOT NULL),
               (SELECT min(ct.inicio)::timestamptz FROM contratos ct
                 WHERE ct.empresa_id = c.empresa_id AND ct.inicio IS NOT NULL),
               (SELECT min(f.paga_em) FROM faturas f
                 WHERE f.empresa_id = c.empresa_id AND ${doCrm("f")} AND f.paga_em IS NOT NULL)
             ),
             CASE WHEN (SELECT count(*) FROM clientes c2
                         WHERE c2.organizacao_id = c.organizacao_id
                           AND c2.cliente_desde::date = c.cliente_desde::date) > 20
                  THEN NULL ELSE c.cliente_desde END
           )::text AS cliente_desde
      FROM clientes c
     WHERE c.organizacao_id = ${organizacaoId}::uuid AND c.empresa_id = ${empresaId}::uuid`);
  // Sem linha em `clientes` a empresa não é cliente: a rota responde 404 em
  // vez de montar um 360 de quem nunca comprou.
  if (!cli) return null;

  const [empresa, billing, health, timeline] = await Promise.all([
    empresa360(organizacaoId, empresaId),
    billingDaConta(organizacaoId, empresaId),
    healthDaEmpresa(organizacaoId, empresaId),
    lerLinhaDoTempo({ organizacaoId, empresaId, limite: 60 }),
  ]);
  if (!empresa) return null;

  const servicos = await db.execute<{
    id: string; familia: string; produto: string | null; valor: string; quantidade: string | null;
    billing_status: string | null; lifecycle: string | null; contrato_id: string | null; origem?: string | null;
    assinatura_id?: string | null;
  }>(sql`
    SELECT id::text, service_family AS familia, canonical_product AS produto,
           current_recurring_value::text AS valor, quantidade::text AS quantidade,
           billing_status, billing_source AS origem,
           commercial_lifecycle AS lifecycle, contrato_id::text,
           -- A assinatura que este serviço representa: é por ela que se sabe se
           -- a assinatura já está na tela, e não pela família (ver abaixo).
           COALESCE(current_subscription_id, NULLIF(split_part(canonical_key, 'STRIPE:', 2), '')) AS assinatura_id
      FROM servicos_canonicos
     WHERE organizacao_id = ${organizacaoId}::uuid AND empresa_id = ${empresaId}::uuid
       -- + o serviço que o Ganho acabou de criar (CRM_POSVENDA): nasce fora do portfólio de receita
       -- de propósito (valor 0, não entra no MRR), mas o cliente comprou e o 360 não pode mostrar
       -- "0 produtos" com o onboarding em curso.
       -- + o que o cliente assina na plataforma (CALLFACE_AI): também nasce fora do
       -- portfólio de propósito (não é venda comercial, não entra no MRR), mas é o
       -- produto que ele usa e paga — esconder deixava a ficha dizendo "Não
       -- classificado" com "Callface AI - Starter" cobrado todo mês.
       AND (portfolio_included = true OR billing_source IN ('CRM_POSVENDA', 'CALLFACE_AI'))
     ORDER BY current_recurring_value DESC NULLS LAST`);

  /* Cliente que FATURA MRR numa família sem serviço de portfólio ficava com a
   * aba Produtos vazia e MRR 0 no cabeçalho (Matte e Broker, White Label: o
   * serviço canônico existe com valor 0 e portfolio_included = false). Mesma
   * fonte da carteira: o MRR faturado no último mês, por família. Só entra a
   * família que o portfólio não cobre — não mexe em quem já tem serviço. */
  const faturadoMrr = await db.execute<{ familia: string; valor: string }>(sql`
    SELECT familia, SUM(valor)::text AS valor
      FROM (${mrrOficialLinhas(organizacaoId, { empresaId, incluirTestes: true })}) m
     WHERE origem = 'fechamento' AND familia <> 'UNKNOWN'
     GROUP BY 1`);
  for (const f of faturadoMrr) {
    if (servicos.some((x) => x.familia === f.familia)) continue;
    servicos.push({ id: "receita:" + f.familia, familia: f.familia, produto: null, valor: f.valor, quantidade: null, billing_status: null, lifecycle: null, contrato_id: null });
  }

  /* Contrato não tem um caminho só até a empresa. Os três (empresa_id direto,
     negócio/lead por COALESCE — a regra da rota Hono, que respeita o cliente
     final numa revenda — e o contrato do serviço canônico) viram UNIÃO de ids
     numa CTE. Nunca OR na condição de JOIN: isso já travou este Postgres. */
  const contratosTodos = await db.execute<{
    id: string; tipo: string; status: string; mrr: string | null; inicio: string | null;
    vencimento: string | null; codigo: string | null; stripe_subscription_id: string | null;
    familia: string | null; produto: string | null; signature_provider: string | null;
    assinatura_status: string; assinado_em: string | null; tem_pdf: boolean;
  }>(sql`
    WITH ids AS (
      SELECT id FROM contratos WHERE organizacao_id = ${organizacaoId}::uuid AND empresa_id = ${empresaId}::uuid
      UNION
      SELECT c.id FROM contratos c
        LEFT JOIN negocios n ON n.id = c.negocio_id
        LEFT JOIN leads l ON l.id = c.lead_id
       WHERE c.organizacao_id = ${organizacaoId}::uuid AND COALESCE(n.empresa_id, l.empresa_id) = ${empresaId}::uuid
      UNION
      SELECT contrato_id FROM servicos_canonicos
       WHERE empresa_id = ${empresaId}::uuid AND contrato_id IS NOT NULL
    )
    SELECT c.id::text, c.tipo, c.status, c.mrr::text, c.inicio::text, c.vencimento::text,
           COALESCE(c.codigo_legado, c.zoho_id) AS codigo, c.stripe_subscription_id,
           c.service_family AS familia, c.produto, c.signature_provider, c.assinatura_status,
           c.assinado_em::text, (c.assinatura_status = 'assinado' AND c.signature_provider_ref IS NOT NULL) AS tem_pdf
      FROM contratos c JOIN ids ON ids.id = c.id
     ORDER BY c.inicio DESC NULLS LAST, c.created_at DESC`);

  const origemDe = (c: typeof contratosTodos[number]) => origemDoContrato(c);
  const contratos = contratosTodos.filter((c) => { const o = origemDe(c); return o === "documenso" || o === "legado"; });
  const idsContrato = contratos.map((c) => c.id);
  const itens = idsContrato.length ? await db.execute<{
    contrato_id: string; nome: string; quantidade: string; valor_unitario: string; subtotal: string;
    familia: string | null; natureza: string | null;
  }>(sql`
    SELECT contrato_id::text, nome, quantidade::text, valor_unitario::text, subtotal::text,
           service_family AS familia, revenue_nature AS natureza
      FROM contrato_itens WHERE contrato_id IN (${sql.join(idsContrato.map((id) => sql`${id}::uuid`), sql`, `)})
     ORDER BY created_at`) : [];

  const [closer] = await db.execute<{ nome: string | null }>(sql`
    SELECT u.nome FROM negocios n JOIN usuarios u ON u.id = n.responsavel_id LEFT JOIN leads nl ON nl.id = n.lead_id
     WHERE COALESCE(n.empresa_id, nl.empresa_id) = ${empresaId}::uuid AND n.etapa = 'ganho'
     ORDER BY n.ganho_at ASC NULLS LAST LIMIT 1`);

  const [csmRow] = await db.execute<{ nome: string | null }>(sql`
    SELECT u.nome FROM clientes c JOIN usuarios u ON u.id = COALESCE(c.responsavel_cs_id, c.responsavel_id)
     WHERE c.organizacao_id = ${organizacaoId}::uuid AND c.empresa_id = ${empresaId}::uuid
     ORDER BY c.updated_at DESC NULLS LAST LIMIT 1`);
  const faturamento = await faturamentoMensal(organizacaoId, { empresaId });

  const [fulfill] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM fulfillments f
     WHERE f.servico_canonico_id IN (SELECT id FROM servicos_canonicos WHERE empresa_id = ${empresaId}::uuid)
       AND f.completed_at IS NULL AND f.cancelled_at IS NULL`);

  const negocioIds = (await db.execute<{ id: string }>(sql`
    SELECT n.id::text FROM negocios n LEFT JOIN leads nl ON nl.id = n.lead_id
     WHERE COALESCE(n.empresa_id, nl.empresa_id) = ${empresaId}::uuid`)).map((r) => r.id);

  /* Anexos do Zoho ligados à empresa, aos contratos e aos negócios dela. O
     binário só existe onde `resolveLocalPath` acha — `disponivel` é a mesma
     regra da rota de download, então o botão não promete o que a rota recusa. */
  const leadIdsDaEmpresa = (await db.execute<{ id: string }>(sql`
    SELECT id::text FROM leads WHERE organizacao_id = ${organizacaoId}::uuid AND empresa_id = ${empresaId}::uuid`)).map((r) => r.id);
  const alvosAnexo = [empresaId, ...idsContrato, ...negocioIds, ...leadIdsDaEmpresa];
  const anexosLegado = await db.execute<{
    id: string; entidade_tipo: string; entidade_id: string; categoria: string | null; nome_arquivo: string;
    tamanho_bytes: number | null; criado_em: string | null; storage_path: string | null;
  }>(sql`
    SELECT id::text, entidade_tipo, entidade_id::text, categoria, nome_arquivo, tamanho_bytes,
           criado_em_original::text AS criado_em, storage_path
      FROM anexos_legado
     WHERE organizacao_id = ${organizacaoId}::uuid
       AND entidade_id IN (${sql.join(alvosAnexo.map((id) => sql`${id}::uuid`), sql`, `)})
     ORDER BY criado_em_original DESC NULLS LAST`);

  /* Arquivos enviados pelo próprio 360 (acervo canônico, `file_links` com
     entidade empresa). Mesma lista da aba, origem diferente: estes se removem. */
  const uploads = await db.execute<{ id: string; file_id: string; nome: string; tamanho: string | null; criado_em: string }>(sql`
    SELECT fl.id::text AS id, fo.id::text AS file_id, fo.nome_original AS nome,
           fo.tamanho_bytes::text AS tamanho, fo.created_at::text AS criado_em
      FROM file_links fl JOIN file_objects fo ON fo.id = fl.file_object_id
     WHERE fl.organizacao_id = ${organizacaoId}::uuid AND fl.entity_type = 'empresa'
       AND fl.entity_id = ${empresaId}::uuid AND fo.deleted_at IS NULL
     ORDER BY fo.created_at DESC`);

  const notas = await db.execute<{ id: string; texto: string; autor: string | null; em: string }>(sql`
    SELECT n.id::text, n.conteudo AS texto, COALESCE(u.nome, n.autor_display_name) AS autor, n.created_at::text AS em
      FROM notas n LEFT JOIN usuarios u ON u.id = n.autor_id
     WHERE n.organizacao_id = ${organizacaoId}::uuid
       AND (n.empresa_id = ${empresaId}::uuid OR n.cliente_id = ${cli.cliente_id}::uuid)
     ORDER BY n.created_at DESC LIMIT 100`);

  const equipeIds = await db.execute<{ id: string; nome: string }>(sql`
    SELECT id::text, nome FROM usuarios WHERE organizacao_id = ${organizacaoId}::uuid AND ativo = true ORDER BY (tipo = 'agente' OR agente_id IS NOT NULL), nome`);

  const tarefas = await db.execute<{
    id: string; titulo: string; tipo: string | null; vence_em: string | null; responsavel: string | null;
  }>(sql`
    WITH alvo AS (
      SELECT id FROM tarefas WHERE empresa_id = ${empresaId}::uuid
      UNION
      SELECT t.id FROM tarefas t JOIN negocios n ON n.id = t.negocio_id WHERE n.empresa_id = ${empresaId}::uuid
      UNION
      SELECT t.id FROM tarefas t JOIN leads l ON l.id = t.lead_id WHERE l.empresa_id = ${empresaId}::uuid
    )
    SELECT t.id::text, t.titulo, t.tipo, COALESCE(t.vence_em::text, t.data_vencimento::text) AS vence_em, u.nome AS responsavel
      FROM tarefas t JOIN alvo ON alvo.id = t.id LEFT JOIN usuarios u ON u.id = t.usuario_id
     WHERE NOT t.concluida
     ORDER BY COALESCE(t.vence_em, t.data_vencimento) ASC NULLS LAST LIMIT 20`);

  const equipe = (await db.execute<{ nome: string }>(sql`
    SELECT nome FROM usuarios WHERE organizacao_id = ${organizacaoId}::uuid AND ativo = true ORDER BY (tipo = 'agente' OR agente_id IS NOT NULL), nome`))
    .map((u) => u.nome);

  const leadDaPessoa = Object.fromEntries((await db.execute<{ id: string; lead: string }>(sql`
    SELECT id::text, lead_id_legado::text AS lead FROM pessoas
     WHERE empresa_id = ${empresaId}::uuid AND lead_id_legado IS NOT NULL`)).map((r) => [r.id, r.lead]));

  // "Último contato" por pessoa: a atividade mora no lead (atividades.lead_id).
  const leadIds = [...new Set(empresa.pessoas.map((p) => p.fonte === "lead" ? p.id : leadDaPessoa[p.id]).filter(Boolean))];
  const ultimoContatoPorLead = leadIds.length ? Object.fromEntries((await db.execute<{ lead: string; ultimo: string }>(sql`
    SELECT lead_id::text AS lead, max(created_at)::text AS ultimo FROM atividades
     WHERE timeline_visible AND lead_id IN (${sql.join(leadIds.map((id) => sql`${id}::uuid`), sql`, `)})
     GROUP BY lead_id`)).map((r) => [r.lead, r.ultimo])) : {};

  // Faturas: o billing agrupa por serviço e devolve as não atribuídas à
  // parte. A tela quer a conta inteira, sem repetir.
  const vistas = new Set<string>();
  const faturas: FaturaResumo[] = [];
  for (const b of [...billing.porServico, ...(billing.naoAtribuido ? [billing.naoAtribuido] : [])]) {
    for (const f of b.faturas) if (!vistas.has(f.id)) { vistas.add(f.id); faturas.push(f); }
  }
  const assinaturas = [...billing.porServico, ...(billing.naoAtribuido ? [billing.naoAtribuido] : [])]
    .map((b) => b.assinatura).filter((a): a is NonNullable<typeof a> => !!a)
    .map((a) => ({ ...a, mrr: a.mrr === null ? null : Number(a.mrr) }));
  const assinaturaDoServico = new Map(billing.porServico.filter((b) => b.servicoId && b.assinatura).map((b) => [b.servicoId!, b.assinatura!]));

  /* Cliente que fechou DEPOIS do último fechamento (a planilha vai até set/26 e
   * hoje é outubro) não tem competência nem serviço de portfólio ainda: o 360
   * mostrava MRR R$0 e "sem histórico de faturamento" para quem acabou de assinar.
   * Mesma regra da métrica oficial `mrr_atual` da carteira: na ausência de
   * faturamento fechado, o MRR é o da assinatura ATIVA. Só entra a família que
   * nem o portfólio nem a receita faturada já cobrem. */
  for (const b of [...billing.porServico, ...(billing.naoAtribuido ? [billing.naoAtribuido] : [])]) {
    const a = b.assinatura;
    if (!a || a.status !== "active" || a.mrr === null) continue;
    const familia = b.serviceFamily ?? "UNKNOWN";
    // Assinatura sem serviço atribuído: o único serviço ainda zerado é o dono
    // dela. Com mais de um candidato não se escolhe no chute — vira linha própria.
    const zerados = servicos.filter((x) => Number(x.valor ?? 0) === 0);
    /* Casar pela ASSINATURA primeiro, não pela família.
     *
     * A família era o único critério, e quando a assinatura chegava sem
     * família ela virava "UNKNOWN", não achava par (o serviço está gravado
     * como CALLFACE_AI) e ganhava uma linha nova com o MESMO dinheiro. O 360
     * mostrava o produto duas vezes e o MRR DOBRADO — medido em 23/10/2026 na
     * Maíra cred (R$ 180 + R$ 180 = R$ 360 para uma assinatura de R$ 179,90) e
     * na LIVA (R$ 2.159 para um contrato de R$ 719,40).
     *
     * A assinatura é identidade de verdade: se um serviço já representa este
     * `sub_...`, a assinatura já está na tela, com família ou sem. */
    const jaTem = (a.stripeSubscriptionId ? servicos.find((x) => x.assinatura_id === a.stripeSubscriptionId) : undefined)
      ?? servicos.find((x) => x.familia === familia)
      ?? (b.serviceFamily === null && zerados.length === 1 ? zerados[0] : undefined);
    if (jaTem) {
      // Serviço existe mas ainda sem valor (portfólio criado antes do primeiro
      // fechamento): quem sabe o MRR é a assinatura.
      if (Number(jaTem.valor ?? 0) === 0) jaTem.valor = a.mrr;
      continue;
    }
    servicos.push({
      id: "assinatura:" + a.stripeSubscriptionId, familia, produto: b.produtoCanonico ?? a.produto,
      valor: a.mrr, quantidade: a.quantidade === null ? null : String(a.quantidade),
      billing_status: a.status, lifecycle: null, contrato_id: null,
    });
    assinaturaDoServico.set("assinatura:" + a.stripeSubscriptionId, a);
  }

  return {
    empresa,
    classificacao: empresa.classificacao,
    clienteId: cli.cliente_id,
    notas,
    csmId: cli.csm_id,
    principalId: cli.principal_id,
    equipeIds,
    clienteDesde: cli.cliente_desde,
    servicos: servicos.map((s) => ({
      id: s.id, familia: s.familia, produto: s.produto, valor: Number(s.valor ?? 0),
      /* Pelo menos 1: o serviço existe, então o cliente tem ao menos uma
         unidade dele. Quantidade ausente é dado que falta, não zero itens. */
      quantidade: Math.max(1, Math.round(Number(s.quantidade ?? 1)) || 1),
      billingStatus: s.billing_status, lifecycle: s.lifecycle, contratoId: s.contrato_id,
      assinaturaStatus: assinaturaDoServico.get(s.id)?.statusFin ?? null,
      produtoReal: assinaturaDoServico.get(s.id)?.produtoReal ?? null,
      origem: s.origem ?? null,
    })),
    iniciosDeAssinatura: contratosTodos.filter((c) => origemDe(c) === "assinatura_stripe" && c.inicio)
      .map((c) => ({ inicio: c.inicio!, codigo: c.stripe_subscription_id!, mrr: c.mrr === null ? null : Number(c.mrr) })),
    contratos: contratos.map((c) => ({
      origem: origemDe(c) as "documenso" | "legado", pdfFinal: c.tem_pdf, assinadoEm: c.assinado_em,
      id: c.id, tipo: c.tipo, status: c.status, mrr: c.mrr === null ? null : Number(c.mrr),
      inicio: c.inicio, vencimento: c.vencimento, codigo: c.codigo,
      stripeSubscriptionId: c.stripe_subscription_id, familia: c.familia, produto: c.produto,
      itens: itens.filter((i) => i.contrato_id === c.id).map((i) => ({
        nome: i.nome, quantidade: Number(i.quantidade), valorUnitario: Number(i.valor_unitario),
        subtotal: Number(i.subtotal), familia: i.familia, natureza: i.natureza,
      })),
    })),
    faturas,
    stripeCustomerId: billing.stripeCustomerId,
    assinaturas,
    health,
    closer: closer?.nome ?? null,
    csm: csmRow?.nome ?? null,
    faturamento,
    fulfillmentAberto: (fulfill?.n ?? 0) > 0,
    anexos: [
      ...contratos.filter((c) => c.tem_pdf).map((c): AnexoDoCliente => ({
        id: c.id, origem: "documenso", url: "/api/contratos/" + c.id + "/pdf-final", entidadeTipo: "contrato", entidadeId: c.id,
        categoria: "documento_assinado", nome: "Contrato assinado · " + (c.produto ?? c.familia ?? c.tipo) + ".pdf",
        tamanhoBytes: null, criadoEm: c.assinado_em, disponivel: true,
      })),
      ...uploads.map((u): AnexoDoCliente => ({
        id: u.id, origem: "upload", url: "/api/arquivos/" + u.file_id, entidadeTipo: "empresa", entidadeId: empresaId,
        categoria: null, nome: u.nome, tamanhoBytes: u.tamanho === null ? null : Number(u.tamanho), criadoEm: u.criado_em, disponivel: true,
      })),
      ...anexosLegado.map((a): AnexoDoCliente => ({
        id: a.id, origem: "legado", url: null, entidadeTipo: a.entidade_tipo, entidadeId: a.entidade_id, categoria: a.categoria, nome: a.nome_arquivo,
        tamanhoBytes: a.tamanho_bytes, criadoEm: a.criado_em, disponivel: resolveLocalPath(a.storage_path) !== null,
      })),
    ],
    tarefas: tarefas.map((t) => ({ id: t.id, titulo: t.titulo, tipo: t.tipo, venceEm: t.vence_em, responsavel: t.responsavel })),
    equipe,
    timeline,
    leadDaPessoa,
    ultimoContatoPorLead,
  };
}
