/**
 * F6 (Analytics) — Data Quality Layer.
 *
 * 10 checks do blueprint (bloco 82) — mapeiam quase 1:1 pros bugs reais já
 * achados manualmente ao longo de meses (MRR duplicado, lead sem
 * responsável, produto NULL em contrato, etc.). Este módulo é o painel
 * que teria detectado esses problemas antes de virarem incidente.
 *
 * SÓ LEITURA — nenhum check aqui corrige nada, só mede e reporta.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export interface ResultadoCheck {
  check: string;
  descricao: string;
  problemas: number;
  amostras: unknown[];
}

async function contarEAmostrar(nomeCheck: string, descricao: string, queryContagem: ReturnType<typeof sql>, queryAmostra: ReturnType<typeof sql>): Promise<ResultadoCheck> {
  const [{ n }] = await db.execute<{ n: number }>(queryContagem);
  const amostras = Number(n) > 0 ? await db.execute(queryAmostra) : [];
  return { check: nomeCheck, descricao, problemas: Number(n), amostras: amostras as unknown[] };
}

export async function rodarDataQuality(organizacaoId: string): Promise<ResultadoCheck[]> {
  const org = organizacaoId;
  const resultados: ResultadoCheck[] = [];

  // 1. Duplicate — contratos duplicados pela mesma assinatura Stripe (mesmo achado de F4)
  resultados.push(await contarEAmostrar(
    "Duplicate",
    "Contratos ativos duplicados pela mesma assinatura Stripe (stripe_subscription_id repetido)",
    sql`select count(*)::int as n from (select stripe_subscription_id from contratos where organizacao_id=${org} and status='ativo' and stripe_subscription_id is not null group by stripe_subscription_id having count(*) > 1) x`,
    sql`select stripe_subscription_id, count(*) as qtd, sum(mrr) as mrr_total from contratos where organizacao_id=${org} and status='ativo' and stripe_subscription_id is not null group by stripe_subscription_id having count(*) > 1 order by mrr_total desc limit 10`
  ));

  // 2. Missing Owner — leads sem responsável (tipo='lead' é o padrão do bug
  // real de 03/08 recorrendo; tipo='cliente' pode ser esperado pós-venda —
  // não presumir bug sem separar os dois, reportar ambos.
  resultados.push(await contarEAmostrar(
    "Missing Owner",
    "Leads (tipo='lead', ativos/qualificando) sem responsável — mesmo padrão do bug real de 03/08, este check monitora recorrência",
    sql`select count(*)::int as n from leads where organizacao_id=${org} and responsavel_id is null and tipo='lead'`,
    sql`select id, nome, origem, created_at from leads where organizacao_id=${org} and responsavel_id is null and tipo='lead' order by created_at desc limit 10`
  ));

  // 3. Missing Source — leads sem nenhuma informação de origem
  resultados.push(await contarEAmostrar(
    "Missing Source",
    "Leads sem origem nem UTM (atribuição impossível de reconstruir)",
    sql`select count(*)::int as n from leads where organizacao_id=${org} and origem is null and utm_source is null`,
    sql`select id, nome, created_at from leads where organizacao_id=${org} and origem is null and utm_source is null order by created_at desc limit 10`
  ));

  // 4. Invalid Contact — leads tipo=cliente sem nenhuma forma de contato
  resultados.push(await contarEAmostrar(
    "Invalid Contact",
    "Leads tipo=cliente sem e-mail nem telefone (impossível contatar um cliente ativo)",
    sql`select count(*)::int as n from leads where organizacao_id=${org} and tipo='cliente' and email is null and telefone is null`,
    sql`select id, nome, empresa from leads where organizacao_id=${org} and tipo='cliente' and email is null and telefone is null limit 10`
  ));

  // 5. Invalid Company — empresas com contrato ativo mas sem CNPJ (bloqueia NF)
  resultados.push(await contarEAmostrar(
    "Invalid Company",
    "Empresas com contrato ativo mas sem CNPJ cadastrado (bloqueia nota fiscal)",
    sql`select count(distinct e.id)::int as n from empresas e join leads l on l.empresa_id=e.id join contratos c on c.lead_id=l.id where e.organizacao_id=${org} and c.status='ativo' and (e.cnpj is null or e.cnpj = '')`,
    sql`select distinct e.id, e.nome from empresas e join leads l on l.empresa_id=e.id join contratos c on c.lead_id=l.id where e.organizacao_id=${org} and c.status='ativo' and (e.cnpj is null or e.cnpj = '') limit 10`
  ));

  // 6. Inconsistent Stage — negócios com status que não existe em nenhum
  // pipeline configurado nem nos 3 terminais óbvios. NOTA: nem todo achado
  // aqui é erro de dado — pode ser status operacional real (ex: "ativo" =
  // pós-venda recorrente, "sem_retorno"/"trava_negociacao" = operacional)
  // que nunca foi formalizado na config do pipeline. O check mede a
  // divergência entre "o que o pipeline diz que é válido" e "o que o time
  // usa na prática" — decisão de formalizar ou não é do Kauã, não do check.
  resultados.push(await contarEAmostrar(
    "Inconsistent Stage",
    "Negócios com status fora da config formal do pipeline (schema não tem enum/CHECK — pode ser status operacional real nunca formalizado, não necessariamente erro de dado)",
    sql`select count(*)::int as n from negocios n where n.organizacao_id=${org} and n.status not in ('ganho','perdido','no_show') and not exists (select 1 from pipelines p, jsonb_array_elements(p.stages) s where p.organizacao_id=n.organizacao_id and s->>'key' = n.status)`,
    sql`select id, titulo, status from negocios n where n.organizacao_id=${org} and n.status not in ('ganho','perdido','no_show') and not exists (select 1 from pipelines p, jsonb_array_elements(p.stages) s where p.organizacao_id=n.organizacao_id and s->>'key' = n.status) limit 10`
  ));

  // 7. Invalid Amount — contrato ativo com mrr <= 0 (receita zerada numa venda "fechada")
  resultados.push(await contarEAmostrar(
    "Invalid Amount",
    "Contratos ativos com MRR zero ou negativo",
    sql`select count(*)::int as n from contratos where organizacao_id=${org} and status='ativo' and (mrr is null or mrr <= 0) and valor_setup is null`,
    sql`select id, tipo, mrr, valor_setup, created_at from contratos where organizacao_id=${org} and status='ativo' and (mrr is null or mrr <= 0) and valor_setup is null limit 10`
  ));

  // 8. Orphan Deal — negócios cujo lead_id não existe mais (não deveria acontecer via FK, mas negocio_origem_id não tem FK real)
  resultados.push(await contarEAmostrar(
    "Orphan Deal",
    "Negócios com negocio_origem_id apontando pra um negócio que não existe (campo sem FK real no schema)",
    sql`select count(*)::int as n from negocios n where n.organizacao_id=${org} and n.negocio_origem_id is not null and not exists (select 1 from negocios n2 where n2.id = n.negocio_origem_id)`,
    sql`select id, titulo, negocio_origem_id from negocios n where n.organizacao_id=${org} and n.negocio_origem_id is not null and not exists (select 1 from negocios n2 where n2.id = n.negocio_origem_id) limit 10`
  ));

  // 9. Missing Product — contrato ativo com produto NULL (some da aba Financeiro filtrada por produto)
  resultados.push(await contarEAmostrar(
    "Missing Product",
    "Contratos ativos com produto NULL (somem do filtro 'Callface AI' na aba Financeiro — achado real já documentado)",
    sql`select count(*)::int as n from contratos where organizacao_id=${org} and status='ativo' and produto is null`,
    sql`select id, tipo, mrr, created_at from contratos where organizacao_id=${org} and status='ativo' and produto is null order by created_at desc limit 10`
  ));

  // 10. Financial mismatch — MRR em excesso por duplicidade (mesmo número de F4, aqui monitorado continuamente)
  const [{ total }] = await db.execute<{ total: string }>(sql`
    with ranked as (
      select id, mrr, stripe_subscription_id,
             row_number() over (partition by stripe_subscription_id order by created_at asc) as rn
      from contratos where organizacao_id=${org} and status='ativo' and stripe_subscription_id is not null
    )
    select coalesce(sum(mrr),0)::text as total from ranked where rn > 1
  `);
  resultados.push({
    check: "Financial mismatch",
    descricao: "MRR em excesso (soma das linhas duplicadas por assinatura Stripe) — mesmo critério do achado original",
    problemas: Number(total) > 0 ? 1 : 0,
    amostras: [{ mrr_excesso: `R$${total}` }],
  });

  // 11. Domain Model Sync — Leads (F1). NOTA: "sem pessoa via leadIdLegado"
  // NÃO é o critério certo sozinho — 32 leads reais são reengajamento
  // deduplicado por e-mail (leadIdLegado aponta pro lead ORIGINAL que criou
  // a pessoa, não pra todo lead que compartilha o e-mail). Achado real ao
  // construir este check: só conta como problema se também não bater por
  // e-mail com NENHUMA pessoa da org.
  resultados.push(await contarEAmostrar(
    "Domain Model Sync (Leads)",
    "Leads sem pessoa correspondente no Domain Model novo (nem por leadIdLegado, nem por e-mail — dedup de reengajamento já considerado)",
    sql`select count(*)::int as n from leads l where l.organizacao_id=${org} and not exists (select 1 from pessoas p where p.lead_id_legado = l.id) and not exists (select 1 from pessoas p2 where p2.organizacao_id = l.organizacao_id and l.email is not null and lower(p2.email) = lower(l.email))`,
    sql`select l.id, l.nome, l.email, l.tipo, l.created_at from leads l where l.organizacao_id=${org} and not exists (select 1 from pessoas p where p.lead_id_legado = l.id) and not exists (select 1 from pessoas p2 where p2.organizacao_id = l.organizacao_id and l.email is not null and lower(p2.email) = lower(l.email)) order by l.created_at desc limit 10`
  ));

  // 12. Domain Model Sync — Negócios (F1). Aqui é 1:1 de verdade (sem dedup), mais simples.
  resultados.push(await contarEAmostrar(
    "Domain Model Sync (Negócios)",
    "Negócios sem oportunidade correspondente no Domain Model novo",
    sql`select count(*)::int as n from negocios n where n.organizacao_id=${org} and not exists (select 1 from oportunidades o where o.negocio_id_legado = n.id)`,
    sql`select id, titulo, status, created_at from negocios n where n.organizacao_id=${org} and not exists (select 1 from oportunidades o where o.negocio_id_legado = n.id) order by created_at desc limit 10`
  ));

  return resultados;
}

/** Score simples: % de checks com zero problema. Não é o objetivo final (o objetivo é ver ONDE está o problema), mas dá um número pra acompanhar tendência. */
export function calcularScoreSaude(resultados: ResultadoCheck[]): number {
  const semProblema = resultados.filter((r) => r.problemas === 0).length;
  return Math.round((semProblema / resultados.length) * 100);
}
