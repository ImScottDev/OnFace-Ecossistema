/**
 * Conferência de banco da entrega de automações/atendimento de 20/10/2026
 * (migrations 0131 e 0132: números operacionais, captação rastreável,
 * distribuição por campanha e Lia no pool operacional).
 *
 * SÓ LÊ. Tudo roda numa transação READ ONLY (o Postgres recusa qualquer
 * escrita, mesmo que alguém acrescente uma por engano), e cada checagem num
 * savepoint próprio: objeto que não existe vira FAIL com a explicação, sem
 * derrubar as checagens seguintes. Antes de consultar coluna ou tabela nova,
 * confere se ela existe.
 *
 * Saída: uma linha por checagem, PASS / FAIL / AVISO / INFO. Sai com código 1
 * se houver qualquer FAIL. AVISO e INFO não reprovam.
 *
 *     cd app && npx tsx --env-file=.env src/scripts/checar-automacoes-homolog.ts
 *
 * Roteiro de aceite que usa este script:
 * docs/operacao/aceite-automacoes-atendimento-20261020.md
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { listarMigrations } from "@/lib/db/migrar";

type Nivel = "PASS" | "FAIL" | "AVISO" | "INFO";
const COR: Record<Nivel, string> = { PASS: "\x1b[32m", FAIL: "\x1b[31m", AVISO: "\x1b[33m", INFO: "\x1b[36m" };
let falhas = 0;
let avisos = 0;
function linha(nivel: Nivel, msg: string) {
  if (nivel === "FAIL") falhas++;
  if (nivel === "AVISO") avisos++;
  console.log(`${COR[nivel]}${nivel.padEnd(5)}\x1b[0m ${msg}`);
}

const MIGRATIONS = ["0131", "0132"] as const;
const COLUNAS: Array<[tabela: string, coluna: string]> = [
  ["whatsapp_sessao", "operacional"],
  ["leads", "distribuicao_regra_id"],
  ["leads", "distribuicao_motivo"],
  ["leads", "sessao_whatsapp_preferida_id"],
  ["regras_distribuicao_leads", "utm_campaign"],
  ["regras_distribuicao_leads", "utm_source"],
  ["regras_distribuicao_leads", "origem"],
  ["regras_distribuicao_leads", "meta_campaign_ids"],
  ["regras_distribuicao_leads", "formulario"],
  ["regras_distribuicao_leads", "sessao_whatsapp_id"],
];
const CHECK_PRIVADO = "whatsapp_sessao_privado_nao_operacional";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function main() {
  console.log("\n── automações/atendimento 20/10: conferência de banco (somente leitura) ──\n");

  await db.transaction(async (tx) => {
    await tx.execute(sql`SET TRANSACTION READ ONLY`);

    /** Roda uma checagem num savepoint: erro vira FAIL e não envenena a transação. */
    const checar = async (nome: string, fn: (t: Tx) => Promise<void>) => {
      try {
        await tx.transaction(async (sp) => { await fn(sp); });
      } catch (e) {
        linha("FAIL", `${nome}: erro ao consultar (${e instanceof Error ? e.message.split("\n")[0] : String(e)})`);
      }
    };

    const existeTabela = async (t: Tx, nome: string) => {
      const [r] = await t.execute<{ ok: boolean }>(sql`SELECT to_regclass(${`public.${nome}`}) IS NOT NULL AS ok`);
      return Boolean(r?.ok);
    };
    const existeColuna = async (t: Tx, tabela: string, coluna: string) => {
      const [r] = await t.execute<{ ok: boolean }>(sql`
        SELECT EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_schema = 'public' AND table_name = ${tabela} AND column_name = ${coluna}) AS ok`);
      return Boolean(r?.ok);
    };

    // ── 1. migrations registradas pelo runner ──
    console.log("migrations");
    await checar("migrations 0131/0132", async (t) => {
      if (!(await existeTabela(t, "_migracoes_aplicadas"))) {
        linha("FAIL", "tabela _migracoes_aplicadas não existe: este banco não foi migrado pelo runner (src/lib/db/migrar.ts); não dá para provar que 0131/0132 foram aplicadas por ele");
        return;
      }
      let arquivos: Map<string, { nome: string; hash: string }> | null = null;
      try {
        arquivos = new Map(listarMigrations().map((m) => [m.nome.slice(0, 4), m]));
      } catch {
        linha("INFO", "pasta de migrations não encontrada a partir daqui; o hash não será comparado com o arquivo do repositório");
      }
      for (const num of MIGRATIONS) {
        const rows = await t.execute<{ nome: string; hash: string; aplicada_em: string; baseline: boolean }>(sql`
          SELECT nome, hash, aplicada_em::text, baseline FROM _migracoes_aplicadas WHERE nome LIKE ${`${num}\\_%`} ORDER BY nome`);
        if (rows.length === 0) { linha("FAIL", `migration ${num} não está em _migracoes_aplicadas`); continue; }
        const r = rows[0];
        const arq = arquivos?.get(num);
        if (arq && arq.hash !== r.hash) {
          linha("FAIL", `migration ${r.nome}: hash registrado difere do arquivo do repositório (arquivo editado depois de aplicado?)`);
        } else {
          linha("PASS", `migration ${r.nome} aplicada em ${r.aplicada_em}${r.baseline ? " (baseline, sem executar)" : ""}${arq ? ", hash confere" : ""}`);
        }
      }
    });

    // ── 2. schema da 0131 ──
    console.log("\nschema (0131)");
    const colunaOk = new Map<string, boolean>();
    await checar("colunas", async (t) => {
      for (const [tabela, coluna] of COLUNAS) {
        const ok = await existeColuna(t, tabela, coluna);
        colunaOk.set(`${tabela}.${coluna}`, ok);
        linha(ok ? "PASS" : "FAIL", `coluna ${tabela}.${coluna}${ok ? "" : " não existe"}`);
      }
    });
    let temEntregas = false;
    await checar("captacao_entregas", async (t) => {
      temEntregas = await existeTabela(t, "captacao_entregas");
      linha(temEntregas ? "PASS" : "FAIL", `tabela captacao_entregas${temEntregas ? "" : " não existe"}`);
    });
    await checar("CHECK privado/operacional", async (t) => {
      const [c] = await t.execute<{ validada: boolean; def: string }>(sql`
        SELECT convalidated AS validada, pg_get_constraintdef(oid) AS def
          FROM pg_constraint WHERE conname = ${CHECK_PRIVADO} AND conrelid = to_regclass('public.whatsapp_sessao')`);
      if (!c) { linha("FAIL", `CHECK ${CHECK_PRIVADO} não existe em whatsapp_sessao`); return; }
      linha(c.validada ? "PASS" : "FAIL", `CHECK ${CHECK_PRIVADO} ${c.validada ? "existe e está validada" : "existe mas NÃO está validada"}: ${c.def}`);
    });

    // ── 3. números de WhatsApp ──
    console.log("\nnúmeros de WhatsApp");
    const temOperacional = () => colunaOk.get("whatsapp_sessao.operacional") === true;
    await checar("privado e operacional", async (t) => {
      if (!temOperacional()) { linha("FAIL", "sem a coluna operacional: não dá para conferir número privado no pool"); return; }
      const rows = await t.execute<{ id: string; label: string | null; phone_number: string | null }>(sql`
        SELECT id, label, phone_number FROM whatsapp_sessao WHERE privado AND operacional`);
      if (rows.length === 0) linha("PASS", "nenhum número é privado e operacional ao mesmo tempo");
      else for (const r of rows) linha("FAIL", `número privado no pool operacional: ${r.label ?? "(sem rótulo)"} ${r.phone_number ?? ""} [${r.id}]`);
    });
    await checar("privado como padrão", async (t) => {
      const rows = await t.execute<{ id: string; label: string | null; org: string }>(sql`
        SELECT s.id, s.label, coalesce(o.slug, o.nome, s.organizacao_id::text) AS org
          FROM whatsapp_sessao s LEFT JOIN organizacoes o ON o.id = s.organizacao_id
         WHERE s.privado AND s.is_default`);
      if (rows.length === 0) linha("PASS", "nenhum número privado é o padrão da organização");
      else for (const r of rows) linha("FAIL", `número privado marcado como padrão (is_default) em ${r.org}: ${r.label ?? "(sem rótulo)"} [${r.id}] — a automação falaria pelo número pessoal`);
    });
    await checar("pool operacional por organização", async (t) => {
      if (!temOperacional()) { linha("FAIL", "sem a coluna operacional: não dá para contar o pool"); return; }
      // Organizações com número de WhatsApp ou com a Lia: é nelas que o pool importa.
      const rows = await t.execute<{ org: string; total: number; operacionais: number; conectados: number; lia: boolean }>(sql`
        WITH orgs AS (
          SELECT organizacao_id AS id FROM whatsapp_sessao
          UNION SELECT organizacao_id FROM ai_agents WHERE slug = 'lia-sdr'
        )
        SELECT coalesce(o.slug, o.nome, orgs.id::text) AS org,
               count(s.id)::int AS total,
               count(s.id) FILTER (WHERE s.operacional AND NOT s.privado)::int AS operacionais,
               count(s.id) FILTER (WHERE s.operacional AND NOT s.privado AND s.status = 'connected')::int AS conectados,
               EXISTS (SELECT 1 FROM ai_agents a WHERE a.organizacao_id = orgs.id AND a.slug = 'lia-sdr') AS lia
          FROM orgs
          LEFT JOIN organizacoes o ON o.id = orgs.id
          LEFT JOIN whatsapp_sessao s ON s.organizacao_id = orgs.id
         GROUP BY 1, orgs.id ORDER BY 1`);
      if (rows.length === 0) { linha("INFO", "nenhuma organização com número de WhatsApp ou com a Lia nesta base"); return; }
      for (const r of rows) {
        const resumo = `${r.org}: ${r.total} número(s), ${r.operacionais} operacional(is), ${r.conectados} operacional(is) conectado(s)`;
        if (r.conectados === 0) {
          linha("AVISO", `${resumo} — Lia não atende${r.lia ? "" : " (e não há Lia nesta organização)"}: marque número operacional e conectado em Ajustes › WhatsApp`);
        } else {
          linha("INFO", resumo);
        }
      }
    });

    // ── 4. Lia no pool (0132) ──
    console.log("\nLia no pool operacional (0132)");
    await checar("versões da Lia", async (t) => {
      const rows = await t.execute<{ id: string; org: string; status: string; pool: string | null; tem_sessoes: boolean; fixo: string | null }>(sql`
        SELECT v.id, coalesce(o.slug, o.nome, a.organizacao_id::text) AS org, v.status,
               v.guardrail_config->'canais'->>'pool' AS pool,
               (v.guardrail_config->'canais' ? 'sessoes') AS tem_sessoes,
               v.channel_session_id::text AS fixo
          FROM ai_agent_versions v
          JOIN ai_agents a ON a.id = v.agent_id
          LEFT JOIN organizacoes o ON o.id = a.organizacao_id
         WHERE a.slug = 'lia-sdr'
         ORDER BY org, v.status`);
      if (rows.length === 0) { linha("AVISO", "nenhuma versão de agente com slug 'lia-sdr' nesta base (nada para conferir)"); return; }
      const ok = rows.filter((r) => r.pool === "operacional" && !r.tem_sessoes && !r.fixo);
      const ruins = rows.filter((r) => !ok.includes(r));
      for (const r of ruins) {
        const porque = [r.pool !== "operacional" && `canais.pool = ${r.pool ?? "(ausente)"}`, r.tem_sessoes && "ainda tem canais.sessoes", r.fixo && `channel_session_id = ${r.fixo}`].filter(Boolean).join(", ");
        linha("FAIL", `Lia (${r.org}) versão ${r.status} [${r.id}]: ${porque}`);
      }
      if (ok.length) {
        const publicadas = ok.filter((r) => r.status === "published").length;
        linha("PASS", `${ok.length}/${rows.length} versão(ões) da Lia com guardrail_config.canais.pool = 'operacional' e sem número fixo (${publicadas} publicada(s))`);
      }
    });

    // ── 5. caixa de entrada da captação ──
    console.log("\ncaptação");
    await checar("entregas que falharam", async (t) => {
      if (!temEntregas) { linha("INFO", "sem captacao_entregas: nada a listar"); return; }
      const porCanal = await t.execute<{ canal: string; status: string; n: number }>(sql`
        SELECT canal, status, count(*)::int AS n FROM captacao_entregas
         WHERE created_at > now() - interval '24 hours' GROUP BY 1, 2 ORDER BY 1, 2`);
      linha("INFO", porCanal.length
        ? `entregas nas últimas 24h: ${porCanal.map((r) => `${r.canal}/${r.status}=${r.n}`).join(", ")}`
        : "nenhuma entrega nas últimas 24h");
      const falhou = await t.execute<{ id: string; canal: string; erro: string | null; created_at: string }>(sql`
        SELECT id, canal, left(coalesce(erro, ''), 140) AS erro, created_at::text FROM captacao_entregas
         WHERE status = 'falhou' AND created_at > now() - interval '24 hours'
         ORDER BY created_at DESC LIMIT 10`);
      if (falhou.length === 0) linha("INFO", "nenhuma entrega com status 'falhou' nas últimas 24h");
      else {
        linha("INFO", `${falhou.length} entrega(s) 'falhou' nas últimas 24h (até 10; reprocessar por POST /api/captacao/entregas/:id/reprocessar):`);
        for (const f of falhou) console.log(`        ${f.created_at}  ${f.canal}  ${f.id}  ${f.erro}`);
      }
    });
  });

  console.log(`\n${falhas === 0 ? "\x1b[32mOK" : `\x1b[31m${falhas} FAIL`}\x1b[0m · ${avisos} aviso(s)\n`);
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((e) => { console.error("FAIL  erro inesperado:", e instanceof Error ? e.message : e); process.exit(1); });
