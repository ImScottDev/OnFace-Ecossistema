/**
 * Checador de INVARIANTES dos relatórios (T7 do PLANO-ACAO-RELATORIOS.md).
 * Roda contra DATABASE_URL e falha (exit 1) se alguma régua quebrar — pega de volta
 * os bugs da auditoria de 21/07 (soma por vendedor ≠ total, receita individual maior
 * que a total, funil não-monotônico) antes de chegarem na tela.
 *
 * Uso:
 *   npm run check:relatorios                    # mês atual (clampado no go-live)
 *   npm run check:relatorios -- 2026-07-01 2026-07-21
 */
import postgres from "postgres";

const GO_LIVE_ISO = "2026-07-01";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não definida.");
  process.exit(1);
}
const sql = postgres(url, { max: 1 });

const [argSince, argUntil] = process.argv.slice(2);
const now = new Date();
const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
const since = argSince ?? (mesAtual < GO_LIVE_ISO ? GO_LIVE_ISO : mesAtual);
const until = argUntil ?? now.toISOString().slice(0, 10);

let falhas = 0;
const ok = (msg: string) => console.log(`  ✔ ${msg}`);
const falha = (msg: string) => { falhas++; console.error(`  ✘ FALHA: ${msg}`); };
const aviso = (msg: string) => console.warn(`  ⚠ ${msg}`);

async function main() {
  console.log(`Invariantes dos relatórios · janela ${since} → ${until}\n`);

  const orgs = await sql`SELECT id, nome FROM organizacoes`;
  for (const org of orgs) {
    console.log(`Org: ${org.nome}`);

    // ── 1/2. Fechado por responsável × total (mesma janela ganho_at, mesma regra) ──
    const [tot] = await sql`
      SELECT count(*)::int AS ganhos,
        COALESCE(sum(CASE WHEN tipo_receita IN ('avulso','projeto') THEN valor_total ELSE mrr_fechado END),0)::numeric(14,2) AS receita
      FROM negocios
      WHERE organizacao_id = ${org.id} AND status='ganho'
        AND ganho_at >= ${since}::date AND ganho_at < (${until}::date + 1)`;
    const porResp = await sql`
      SELECT coalesce(responsavel_id::text,'(sem responsável)') AS resp, count(*)::int AS ganhos,
        COALESCE(sum(CASE WHEN tipo_receita IN ('avulso','projeto') THEN valor_total ELSE mrr_fechado END),0)::numeric(14,2) AS receita
      FROM negocios
      WHERE organizacao_id = ${org.id} AND status='ganho'
        AND ganho_at >= ${since}::date AND ganho_at < (${until}::date + 1)
      GROUP BY 1`;
    const somaGanhos = porResp.reduce((s, r) => s + Number(r.ganhos), 0);
    const somaReceita = porResp.reduce((s, r) => s + Number(r.receita), 0);
    if (somaGanhos === Number(tot.ganhos)) ok(`Σ ganhos por responsável = total (${tot.ganhos})`);
    else falha(`Σ ganhos por responsável (${somaGanhos}) ≠ total (${tot.ganhos})`);
    if (Math.abs(somaReceita - Number(tot.receita)) < 0.01) ok(`Σ receita por responsável = receita total (R$ ${tot.receita})`);
    else falha(`Σ receita por responsável (${somaReceita.toFixed(2)}) ≠ total (${tot.receita})`);
    for (const r of porResp) {
      if (Number(r.receita) > Number(tot.receita) + 0.01) falha(`receita de ${r.resp} (${r.receita}) MAIOR que a receita total (${tot.receita})`);
    }
    const semResp = porResp.find((r) => r.resp === "(sem responsável)");
    if (semResp) aviso(`${semResp.ganhos} negócio(s) ganho(s) sem responsável — somem das tabelas por vendedor`);

    // ── 3. Funil da esteira SDR monotônico (mesma classificação do board) ──
    const [f] = await sql`
      WITH l AS (
        SELECT ld.id, coalesce(ld.sdr_status,'pending') s,
          EXISTS(SELECT 1 FROM negocios n WHERE n.lead_id = ld.id) has_neg
        FROM leads ld
        WHERE ld.organizacao_id = ${org.id}
          AND ld.created_at >= ${since}::date AND ld.created_at < (${until}::date + 1)
      ), cls AS (
        SELECT CASE
          WHEN s='disqualified' THEN 'dq'
          WHEN has_neg THEN 'q'
          WHEN s IN ('sdr_sem_retorno','sdr_sem_interesse','sdr_retomar_depois') THEN 'st'
          WHEN s='contacted' THEN 'c'
          WHEN s='qualifying' THEN 'qg'
          ELSE 'n' END col
        FROM l
      )
      SELECT
        count(*) FILTER (WHERE col <> 'st')::int AS esteira,
        count(*) FILTER (WHERE col IN ('c','qg','q','dq'))::int AS contato,
        count(*) FILTER (WHERE col IN ('qg','q'))::int AS qualificando,
        count(*) FILTER (WHERE col = 'q')::int AS qualificado
      FROM cls`;
    const seq = [Number(f.esteira), Number(f.contato), Number(f.qualificando), Number(f.qualificado)];
    if (seq.every((v, i) => i === 0 || v <= seq[i - 1])) ok(`funil SDR monotônico (${seq.join(" ≥ ")})`);
    else falha(`funil SDR não-monotônico (${seq.join(", ")})`);

    // ── 4. Funil de vendas por evento monotônico ──
    const ordem = ["reuniao_agendada", "reuniao_realizada", "trial", "proposta_apresentada", "negociacao_iniciada", "ganho"];
    const ev = await sql`
      SELECT DISTINCT sc.lead_id, sc.para_status
      FROM status_changes sc JOIN leads l ON l.id = sc.lead_id
      WHERE l.organizacao_id = ${org.id}
        AND sc.created_at >= ${since}::date AND sc.created_at < (${until}::date + 1)
        AND sc.para_status = ANY(${ordem})`;
    const maxIdx = new Map<string, number>();
    for (const r of ev) {
      const i = ordem.indexOf(r.para_status);
      const cur = maxIdx.get(r.lead_id);
      if (cur == null || i > cur) maxIdx.set(r.lead_id, i);
    }
    const funilV = ordem.map((_, i) => [...maxIdx.values()].filter((m) => m >= i).length);
    if (funilV.every((v, i) => i === 0 || v <= funilV[i - 1])) ok(`funil de vendas (evento) monotônico (${funilV.join(" ≥ ")})`);
    else falha(`funil de vendas (evento) não-monotônico (${funilV.join(", ")})`);

    // ── 5. Reuniões por evento — sanidade ──
    const [re] = await sql`
      SELECT
        count(DISTINCT sc.lead_id) FILTER (WHERE sc.para_status='reuniao_agendada')::int AS ag,
        count(DISTINCT sc.lead_id) FILTER (WHERE sc.para_status='reuniao_realizada')::int AS fe
      FROM status_changes sc JOIN leads l ON l.id = sc.lead_id
      WHERE l.organizacao_id = ${org.id}
        AND sc.created_at >= ${since}::date AND sc.created_at < (${until}::date + 1)`;
    if (Number(re.ag) > 0 && Number(re.fe) === 0) aviso(`há ${re.ag} reuniões agendadas e 0 realizadas por evento — conferir processo de mover o card`);
    else ok(`reuniões por evento: ${re.ag} agendadas / ${re.fe} realizadas`);

    console.log("");
  }

  await sql.end();
  if (falhas > 0) {
    console.error(`${falhas} invariante(s) quebrada(s).`);
    process.exit(1);
  }
  console.log("Todas as invariantes OK.");
}

main().catch((e) => { console.error(e); process.exit(1); });
