/**
 * A venda que ninguém vendeu: alguém assina sozinho na plataforma Callface AI,
 * paga no Stripe, e isso precisa virar venda no ONFACE na hora.
 *
 * Até 09/11/2026 não virava. O sync já enxergava a assinatura da plataforma, mas
 * só a reconhecia quando o Customer tinha carimbo do CRM (`crm_company_id`) —
 * e quem compra sozinho nunca tem esse carimbo, então caía num `continue` e
 * sumia. As 21 vendas que existem vieram de carga manual (21/10 e 09/11), e foi
 * assim que SMOV Digital e Scale X ficaram dois meses pagando sem existir como
 * venda. Decisão do Scott (09/11/2026): "é dinheiro entrando" — tem que cair
 * sozinho, com empresa, contato, Cliente 360 e a marca de onde veio.
 *
 * O que este módulo faz, por assinatura da plataforma:
 *   1. acha a empresa (carimbo do CRM → e-mail do contato → nome normalizado) ou cria;
 *   2. acha o contato pelo e-mail ou cria, e abre o par canônico (pessoa + aquisição);
 *   3. materializa o serviço canônico (`reconhecerClienteDoSaas`, fora do portfólio);
 *   4. cria a VENDA: `negocios` ganho, `origem_negocio = 'self_checkout'`, sem
 *      responsável (ninguém vendeu), valor e data vindos da assinatura;
 *   5. garante o Cliente 360 com a data real de entrada.
 *
 * ── Três travas, e por que cada uma existe ──────────────────────────────────
 *
 * **Idempotência pela assinatura.** O vínculo é `negocios.servico_origem_id` →
 * serviço canônico → `current_subscription_id`, com índice único parcial
 * (migration 0146). O webhook reentrega e o sync roda de 30 em 30 minutos: sem
 * isso, a mesma assinatura viraria venda nova a cada passada.
 *
 * **Corte de data.** O automático só registra assinatura que começou a partir de
 * `DESDE`. O sync varre TODAS as assinaturas da conta, inclusive as antigas; sem
 * o corte, ele criaria venda retroativa para os 16 clientes da plataforma que já
 * têm venda registrada pelo comercial — contando o mesmo dinheiro duas vezes,
 * que é exatamente o defeito corrigido em 03/11. O passado foi conferido à mão
 * em 09/11 (37 empresas, 21 vendas) e está em dia; o que vier antes do corte
 * continua sendo trabalho de carga, com olho humano.
 *
 * **Só assinatura viva.** `canceled`/`incomplete_expired` não viram venda: se
 * nunca chegou a cobrar, não houve receita. O serviço canônico continua sendo
 * atualizado pelo sync normalmente.
 *
 * O valor é o `mrr` da assinatura (mensalidade equivalente, anual dividido por
 * 12 — a mesma régua de `mrrOf` no sync), gravado em `mrr_fechado`, que é o que
 * o fechamento e a meta leem. `valor_total` recebe o mesmo número para a ficha
 * não mostrar venda sem valor.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { reconhecerClienteDoSaas, empresaCarimbadaNoCustomer, VIVA } from "@/lib/integrations/cliente-do-saas";
import { garantirEntradaCanonica } from "@/lib/vendas/ponte-canonica";
import { garantirContaCsPorEmpresa } from "@/lib/cs/handoff";
import { ORIGEM_AUTOATENDIMENTO } from "@/lib/relatorios/autoatendimento";

/**
 * De quando o automático passa a valer. Assinatura anterior a isto é passado, e
 * passado se resolve com carga conferida, nunca sozinho (ver "Corte de data").
 */
export const DESDE = new Date("2026-11-09T00:00:00Z");

/** Nome comparável: sem acento, sem pontuação, sem caixa — a mesma régua do relatório de duplicadas. */
export function chaveDoNome(n: string): string {
  return n.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Nome normalizado → empresa. Uma leitura só, para quem processa várias assinaturas. */
export async function carregarEmpresasPorNome(organizacaoId: string): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  const linhas = (await db.execute(sql`
    SELECT id::text, nome FROM empresas WHERE organizacao_id = ${organizacaoId}::uuid
  `)) as unknown as Array<{ id: string; nome: string }>;
  for (const e of linhas) {
    const k = chaveDoNome(e.nome ?? "");
    if (k && !mapa.has(k)) mapa.set(k, e.id);
  }
  return mapa;
}

export interface CustomerDaPlataforma {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  metadata?: Record<string, string> | null;
}

export interface AssinaturaDaPlataforma {
  id: string;
  status: string;
  /** `start_date` da assinatura: quando a relação começou de verdade. */
  inicio: Date;
  /** Mensalidade equivalente, já normalizada (anual / 12). */
  valorMensal: number;
  produto: string | null;
  customer: CustomerDaPlataforma | null;
}

export type ResultadoVenda =
  | { criou: true; negocioId: string; empresaId: string; valor: number }
  | { criou: false; motivo: string };

/**
 * Registra (ou reconhece) a venda de uma assinatura nascida na plataforma.
 * Idempotente: chamar de novo com a mesma assinatura não cria segunda venda.
 */
export async function registrarVendaDeAutoatendimento(
  organizacaoId: string,
  a: AssinaturaDaPlataforma,
  opts?: { ignorarCorteDeData?: boolean; empresasPorNome?: Map<string, string> },
): Promise<ResultadoVenda> {
  if (!VIVA.has(a.status)) return { criou: false, motivo: `assinatura ${a.status}: não houve receita` };
  if (!opts?.ignorarCorteDeData && a.inicio < DESDE) {
    return { criou: false, motivo: `assinatura de ${a.inicio.toISOString().slice(0, 10)}, anterior ao corte do automático` };
  }
  if (a.valorMensal <= 0) return { criou: false, motivo: "assinatura sem valor recorrente" };

  const c = a.customer;
  if (!c) return { criou: false, motivo: "assinatura sem customer expandido" };

  const email = (c.email ?? "").trim().toLowerCase();
  const nomePessoa = (c.name ?? c.metadata?.user_name ?? "").trim();
  const nomeEmpresa = (c.metadata?.company ?? "").trim() || nomePessoa || email;
  if (!nomeEmpresa) return { criou: false, motivo: "customer sem nome e sem e-mail" };

  // ── 1. Empresa: reusar é mais importante que criar ────────────────────────
  const carimbada = empresaCarimbadaNoCustomer(c.metadata);
  const [leadExistente] = email
    ? ((await db.execute(sql`
        SELECT id::text, empresa_id::text FROM leads
         WHERE organizacao_id = ${organizacaoId}::uuid AND lower(btrim(email)) = ${email} LIMIT 1
      `)) as unknown as Array<{ id: string; empresa_id: string | null }>)
    : [];
  /* O casamento por nome roda em memória com `chaveDoNome`, a MESMA régua da
     carga de 21/10 e do relatório de duplicadas — em SQL ela não existe (o banco
     não tem `unaccent`), e uma régua parecida é como se cria empresa duplicada.
     Quem chama em lote (o sync) passa o mapa pronto e evita reler a tabela. */
  const porNome = opts?.empresasPorNome ?? (await carregarEmpresasPorNome(organizacaoId));
  const empresaPorNome = porNome.get(chaveDoNome(nomeEmpresa)) ?? null;

  let empresaId = carimbada ?? leadExistente?.empresa_id ?? empresaPorNome ?? null;
  if (!empresaId) {
    const [nova] = (await db.execute(sql`
      INSERT INTO empresas (organizacao_id, nome, stripe_customer_id)
      VALUES (${organizacaoId}::uuid, ${nomeEmpresa}, ${c.id})
      RETURNING id::text`)) as unknown as Array<{ id: string }>;
    empresaId = nova!.id;
    // Entra no mapa na hora: duas assinaturas do mesmo cliente na mesma rodada
    // criariam duas empresas, que é o defeito que o dedup existe para evitar.
    porNome.set(chaveDoNome(nomeEmpresa), empresaId);
  }

  // ── 2. Contato: lead + par canônico (pessoa e aquisição) ──────────────────
  let leadId = leadExistente?.id ?? null;
  if (!leadId) {
    const [novoLead] = (await db.execute(sql`
      INSERT INTO leads (organizacao_id, nome, email, telefone, empresa_id, tipo, status, origem, stripe_customer_id)
      VALUES (${organizacaoId}::uuid, ${nomePessoa || nomeEmpresa}, ${email || null}, ${c.phone ?? null},
              ${empresaId}::uuid, 'cliente', 'novo', 'plataforma', ${c.id})
      RETURNING id::text`)) as unknown as Array<{ id: string }>;
    leadId = novoLead!.id;

    /* Sem pessoa e sem aquisição o contato não existe para quem vende: a ficha
       não acha ninguém. Mesma ponte da carga de 21/10. A falha aqui não derruba
       a venda — o dinheiro entrou de qualquer jeito —, mas vai para o log. */
    const canonico = await garantirEntradaCanonica({
      organizacaoId,
      tipo: "INBOUND",
      origem: "plataforma",
      provider: "callface_ai",
      pessoa: { nome: nomePessoa || nomeEmpresa, email: email || null, telefone: c.phone ?? null },
      empresa: { nome: nomeEmpresa },
      idempotencyKey: `plataforma:${c.id}`,
      ocorridoEm: a.inicio,
    }, leadId);
    if (!canonico.ok) console.error(`[autoatendimento] ${a.id}: sem par canônico (${canonico.codigo ?? canonico.erro})`);
  }

  // ── 3. Serviço canônico da assinatura (fora do portfólio, como já era) ────
  await reconhecerClienteDoSaas(organizacaoId, { id: a.id, status: a.status, empresaId, produto: a.produto });
  const [servico] = (await db.execute(sql`
    SELECT id::text FROM servicos_canonicos
     WHERE organizacao_id = ${organizacaoId}::uuid AND canonical_key = ${`STRIPE:${a.id}`} LIMIT 1
  `)) as unknown as Array<{ id: string }>;
  if (!servico) return { criou: false, motivo: "serviço canônico não materializou" };

  // ── 4. A venda ────────────────────────────────────────────────────────────
  const titulo = `Autoatendimento · ${a.produto ?? "Callface AI"}`;
  const valor = a.valorMensal.toFixed(2);
  const [negocio] = (await db.execute(sql`
    INSERT INTO negocios (organizacao_id, empresa_id, lead_id, servico_origem_id, titulo, status,
                          tipo_receita, valor_total, mrr_fechado, origem_negocio, service_family,
                          commercial_motion, ganho_at)
    SELECT ${organizacaoId}::uuid, ${empresaId}::uuid, ${leadId}::uuid, ${servico.id}::uuid, ${titulo}, 'ganho',
           'recorrente', ${valor}::numeric, ${valor}::numeric, ${ORIGEM_AUTOATENDIMENTO},
           COALESCE((SELECT service_family FROM servicos_canonicos WHERE id = ${servico.id}::uuid), 'CALLFACE_AI'),
           'NEW_BUSINESS', ${a.inicio.toISOString()}::timestamptz
    ON CONFLICT (servico_origem_id) WHERE origem_negocio = 'self_checkout' AND servico_origem_id IS NOT NULL
    DO NOTHING
    RETURNING id::text`)) as unknown as Array<{ id: string }>;

  if (!negocio) return { criou: false, motivo: `assinatura ${a.id} já tem venda registrada` };

  // ── 5. Cliente 360, com a data em que a relação começou ───────────────────
  await garantirContaCsPorEmpresa({ organizacaoId, empresaId, leadId, entrouEm: a.inicio })
    .catch((e) => console.error(`[autoatendimento] ${a.id}: conta de CS não criada:`, e instanceof Error ? e.message : e));

  return { criou: true, negocioId: negocio.id, empresaId, valor: a.valorMensal };
}
