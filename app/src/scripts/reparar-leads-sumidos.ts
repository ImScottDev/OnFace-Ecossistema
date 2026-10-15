/**
 * Os leads que saíram de Pré-vendas e do Pipeline e viraram "Contato".
 *
 * O time relatou que "sumiram coisas". Sumiram mesmo, e o caminho é este: a
 * reunião marcada por ligação converte o lead dentro da transação do rodízio de
 * closers, e ali três coisas davam errado juntas (corrigidas no runtime em
 * 15/10/2026, commits 4470cec e 28a679f):
 *
 *   1. O negócio nascia **sem `etapa`** — só `status` era preenchido. Quem
 *      classifica (lib/vendas/classificacao.ts) só conta como "Lead" com
 *      `etapa IN ('entrada','diagnostico','proposta','negociacao')`, então o
 *      lead deixava de ser Lead.
 *   2. O fechamento da aquisição ia pelo `db` global mesmo dentro da transação:
 *      o lead saía de Pré-vendas na hora.
 *   3. O dual-write lia o negócio recém-criado pelo `db` global, não o
 *      enxergava e saía calado — a linha em `oportunidades`, que é de onde o
 *      Pipeline lê, nunca nascia.
 *
 * Somados: fora de Pré-vendas (aquisição fechada), fora do Pipeline (sem
 * oportunidade) e fora de "Lead" (sem etapa). Sobrava aparecer em Contatos &
 * Empresas como "Contato" — exatamente o que o Scott viu na ficha do Sicolos.
 *
 * Este script é o reparo do passivo. Ele NÃO mexe na etapa de quem está sendo
 * trabalhado e NÃO reabre aquisição fechada: devolver um lead para Pré-vendas
 * depois que ele virou oportunidade seria duplicá-lo nas duas telas. O que ele
 * repara é o que faltou — a etapa do negócio e a linha canônica —, que é o que
 * faz o lead voltar a aparecer no Pipeline e a ser classificado como Lead.
 *
 *   npx tsx --env-file=.env src/scripts/reparar-leads-sumidos.ts            # simula (padrão)
 *   npx tsx --env-file=.env src/scripts/reparar-leads-sumidos.ts --aplicar  # grava
 *
 * Cada caso sai com o MOTIVO, porque o Scott pediu para ver por que aconteceu —
 * e porque motivo sem correção automática (mescla, prospecção, desqualificação)
 * precisa de decisão humana, não de script.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { syncOportunidadeFromNegocio } from "@/lib/crm/sync-domain-model";

const aplicar = process.argv.includes("--aplicar");

/** As etapas que o Pipeline considera em aberto (classificacao.ts:73). */
const ETAPAS_ABERTAS = ["entrada", "diagnostico", "proposta", "negociacao"];

interface Sumido extends Record<string, unknown> {
  lead_id: string;
  lead_nome: string | null;
  empresa: string | null;
  negocio_id: string;
  negocio_titulo: string | null;
  etapa: string | null;
  status: string | null;
  ganho_at: string | null;
  tem_oportunidade: boolean;
  aquisicao_fechada: boolean;
  criado_em: string;
  origem_qualificacao: string | null;
}

/**
 * Negócio vivo cujo lead não aparece em lugar nenhum.
 *
 * "Vivo" aqui é o negócio que ninguém encerrou: sem `ganho_at` e sem etapa de
 * desfecho. Um negócio perdido SOMEM de propósito do board — não é defeito.
 */
async function sumidos(): Promise<Sumido[]> {
  return await db.execute<Sumido>(sql`
    SELECT l.id::text          AS lead_id,
           l.nome              AS lead_nome,
           l.empresa           AS empresa,
           n.id::text          AS negocio_id,
           n.titulo            AS negocio_titulo,
           n.etapa             AS etapa,
           n.status            AS status,
           n.ganho_at::text    AS ganho_at,
           (o.id IS NOT NULL)  AS tem_oportunidade,
           (aq.id IS NOT NULL AND aq.closed_at IS NOT NULL) AS aquisicao_fechada,
           n.created_at::text  AS criado_em,
           n.origem_qualificacao AS origem_qualificacao
      FROM negocios n
      JOIN leads l ON l.id = n.lead_id
      LEFT JOIN oportunidades o ON o.negocio_id_legado = n.id
      LEFT JOIN aquisicoes aq ON aq.lead_legado_id = l.id
     WHERE n.ganho_at IS NULL
       AND COALESCE(n.etapa, '') NOT IN ('ganho', 'perdido')
       AND l.canonical_lead_id IS NULL
       /* 'ativo' é a cópia da carteira de clientes, que o board do Pipeline
          exclui de propósito (board-pipeline.ts). Sem esta linha o script
          acusa 163 clientes ativos como "lead sumido" e um backfill os jogaria
          dentro do funil de vendas. Medido no espelho em 15/10/2026. */
       AND COALESCE(n.status, '') <> 'ativo'
       -- O sintoma: ou o negócio não tem etapa (deixa de contar como Lead),
       -- ou não tem linha canônica (o Pipeline não o enxerga). Qualquer um dos
       -- dois já tira o lead da tela.
       AND (n.etapa IS NULL OR o.id IS NULL)
     ORDER BY n.created_at DESC`);
}

/** Por que este sumiu, em uma linha, e se o script sabe consertar. */
function motivo(s: Sumido): { texto: string; reparavel: boolean } {
  const semEtapa = s.etapa === null;
  const semOportunidade = !s.tem_oportunidade;
  if (semEtapa && semOportunidade) {
    return { texto: "negócio sem etapa E sem linha canônica — fora do Pipeline e não conta como Lead", reparavel: true };
  }
  if (semEtapa) {
    return { texto: "negócio sem etapa — não conta como Lead, aparece como Contato", reparavel: true };
  }
  if (semOportunidade) {
    return { texto: `negócio em '${s.etapa}' sem linha canônica — o Pipeline lê oportunidades e não o encontra`, reparavel: ETAPAS_ABERTAS.includes(s.etapa ?? "") };
  }
  return { texto: "sem causa reconhecida — olhar à mão", reparavel: false };
}

/**
 * A outra forma de sumir: o lead tem reunião marcada e NÃO tem negócio.
 *
 * Quando a conversão falha no meio (a transação do rodízio volta atrás, ou o
 * conversor devolve erro), o que sobra é o rastro — a reunião, a atividade, a
 * tarefa "Confirmar reunião no Outlook" — sem a oportunidade que justifica o
 * lead estar em algum board. Aqui o script só RELATA: criar negócio para esses
 * leads é decisão comercial (quem é o closer, qual a oferta), não reparo.
 */
async function comReuniaoSemNegocio() {
  return await db.execute<Record<string, unknown>>(sql`
    SELECT l.id::text AS lead_id, l.nome, l.empresa,
           COALESCE(pe.codigo, l.estagio_pre_vendas) AS etapa_pv,
           (aq.closed_at IS NOT NULL) AS aquisicao_fechada,
           r.data::text AS reuniao_em
      FROM leads l
      JOIN reunioes r ON r.lead_id = l.id
      LEFT JOIN aquisicoes aq ON aq.lead_legado_id = l.id
      LEFT JOIN pipeline_etapas pe ON pe.id = aq.etapa_id
     WHERE l.canonical_lead_id IS NULL
       AND l.negocio_ativo_id IS NULL
       AND NOT EXISTS (SELECT 1 FROM negocios n WHERE n.lead_id = l.id)
     ORDER BY r.data DESC
     LIMIT 100`);
}

async function main() {
  const orfaos = await comReuniaoSemNegocio();
  if (orfaos.length > 0) {
    console.log(`\n${orfaos.length} lead(s) com reunião marcada e NENHUM negócio — a conversão não chegou ao fim:`);
    for (const o of orfaos.slice(0, 20)) {
      console.log(`  ${String(o.empresa || o.nome).slice(0, 40).padEnd(42)} etapa=${o.etapa_pv ?? "—"}  aquisição=${o.aquisicao_fechada ? "fechada" : "aberta"}  reunião=${String(o.reuniao_em).slice(0, 16)}`);
    }
    console.log("  (só relatório: criar o negócio é decisão comercial, não reparo de script)\n");
  }

  const lista = await sumidos();
  console.log(`\n${lista.length} negócio(s) vivo(s) com o lead fora das telas.\n`);
  if (lista.length === 0) return;

  const porMotivo = new Map<string, Sumido[]>();
  for (const s of lista) {
    const m = motivo(s).texto;
    porMotivo.set(m, [...(porMotivo.get(m) ?? []), s]);
  }
  for (const [m, itens] of porMotivo) {
    console.log(`── ${itens.length}× ${m}`);
    for (const s of itens.slice(0, 10)) {
      console.log(`     ${(s.empresa || s.lead_nome || s.lead_id).slice(0, 40).padEnd(42)} etapa=${s.etapa ?? "NULL"}  canônica=${s.tem_oportunidade ? "sim" : "NÃO"}  aquisição=${s.aquisicao_fechada ? "fechada" : "aberta"}  ${s.criado_em.slice(0, 10)}`);
    }
    if (itens.length > 10) console.log(`     … e mais ${itens.length - 10}`);
    console.log("");
  }

  /* "Por que aconteceu": a origem e o mês contam a história. O conversor
     legado nunca gravou `etapa` — então todo negócio que nasceu por conversão
     (reunião marcada, qualificação direta, agente) saiu sem ela, não só os da
     ligação. Ver a distribuição é o que separa "um caminho quebrou" de "o
     conversor sempre foi assim". */
  const porOrigemEMes = new Map<string, number>();
  for (const s of lista) {
    const chave = `${s.criado_em.slice(0, 7)}  origem=${s.origem_qualificacao ?? "—"}  status=${s.status ?? "—"}`;
    porOrigemEMes.set(chave, (porOrigemEMes.get(chave) ?? 0) + 1);
  }
  console.log("Quando e como nasceram:");
  for (const [k, v] of [...porOrigemEMes.entries()].sort()) console.log(`  ${String(v).padStart(4)}×  ${k}`);
  console.log("");

  const reparaveis = lista.filter((s) => motivo(s).reparavel);
  const manuais = lista.filter((s) => !motivo(s).reparavel);
  console.log(`${reparaveis.length} reparável(is) por este script; ${manuais.length} precisa(m) de olho humano.\n`);

  if (!aplicar) {
    console.log("Simulação. Para gravar: --aplicar\n");
    return;
  }

  let etapas = 0;
  let canonicas = 0;
  for (const s of reparaveis) {
    /* A etapa que faltou. 'entrada' é onde a porta nova (criarOportunidade) faz
       o negócio nascer — este é o valor que o conversor deveria ter gravado, e
       grava desde 4470cec. `etapa_desde` recebe a criação do negócio, não
       agora: o cartão não pode parecer novo num board que mede tempo de etapa. */
    if (s.etapa === null) {
      await db.execute(sql`
        UPDATE negocios
           SET etapa = 'entrada',
               etapa_desde = COALESCE(etapa_desde, created_at),
               updated_at = updated_at
         WHERE id = ${s.negocio_id}::uuid AND etapa IS NULL`);
      etapas += 1;
    }
    // A linha canônica. Idempotente: se já existir, só atualiza.
    await syncOportunidadeFromNegocio(s.negocio_id);
    canonicas += 1;
  }

  console.log(`Gravado: ${etapas} etapa(s) preenchida(s), ${canonicas} linha(s) canônica(s) sincronizada(s).\n`);
  if (manuais.length > 0) {
    console.log("Os que ficaram de fora (decisão humana):");
    for (const s of manuais.slice(0, 20)) console.log(`  ${s.negocio_id}  ${s.empresa || s.lead_nome}  — ${motivo(s).texto}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
