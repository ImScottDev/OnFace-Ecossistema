/**
 * Verifica, contra a Graph API real, o que o token da Meta alcança.
 *
 * Responde três perguntas que só a Meta pode responder, e que o produto vinha
 * tratando como suposição:
 *
 *   1. o token enxerga a Página do formulário?
 *   2. ele tem `leads_retrieval`, que é o que permite LER o lead?
 *   3. ele tem `ads_read`, que é o que permite ler gasto e resultado?
 *
 * **Nunca imprime o valor do token.** Só o que ele alcança. Um diagnóstico que
 * ecoa credencial transforma log de suporte em vazamento.
 *
 *     pnpm tsx --env-file=.env src/scripts/checar-token-meta.ts
 */
import { credenciaisLeadAds, credenciaisAds, metaApiVersion } from "@onface/integrations-meta";

const ok = (cond: unknown, msg: string) => {
  console.log(`${cond ? "  ok  " : "  FALHA  "}${msg}`);
  if (!cond) process.exitCode = 1;
};
const info = (msg: string) => console.log(`  --    ${msg}`);

const V = metaApiVersion();
const GRAPH = `https://graph.facebook.com/${V}`;

async function graph<T>(caminho: string, token: string): Promise<{ ok: true; dados: T } | { ok: false; erro: string; codigo?: number }> {
  const sep = caminho.includes("?") ? "&" : "?";
  const r = await fetch(`${GRAPH}/${caminho}${sep}access_token=${encodeURIComponent(token)}`);
  const corpo = await r.json().catch(() => ({})) as Record<string, unknown>;
  if (!r.ok || corpo.error) {
    const e = corpo.error as { message?: string; code?: number } | undefined;
    return { ok: false, erro: e?.message ?? `HTTP ${r.status}`, codigo: e?.code };
  }
  return { ok: true, dados: corpo as T };
}

async function main() {
  const leads = credenciaisLeadAds();
  const ads = credenciaisAds();

  console.log(`\n  Graph API ${V}\n`);

  if (!leads.accessToken) {
    console.log("  META_LEADS_ACCESS_TOKEN não configurado.\n");
    process.exitCode = 1;
    return;
  }
  // O que se pode dizer de um segredo sem vazá-lo: tamanho e prefixo.
  console.log(`  token: ${leads.accessToken.length} caracteres, começa em "${leads.accessToken.slice(0, 4)}"`);
  console.log(`  página configurada: ${leads.pageId ?? "(nenhuma)"}\n`);

  // ── 1. Quem é o token ───────────────────────────────────────────────────
  const eu = await graph<{ id: string; name?: string }>("me?fields=id,name", leads.accessToken);
  if (!eu.ok) {
    ok(false, `o token não é aceito pela Meta: ${eu.erro}`);
    console.log("\n  Sem token válido não há o que verificar adiante.\n");
    return;
  }
  ok(true, `o token é válido e identifica ${eu.dados.name ?? "(sem nome)"} (${eu.dados.id})`);

  // ── 2. Escopos, da própria Meta ─────────────────────────────────────────
  const dbg = await graph<{ data: {
    type?: string; app_id?: string; application?: string; scopes?: string[];
    expires_at?: number; is_valid?: boolean; profile_id?: string;
  } }>(`debug_token?input_token=${encodeURIComponent(leads.accessToken)}`, leads.accessToken);

  let escopos: string[] = [];
  if (dbg.ok) {
    const d = dbg.dados.data;
    escopos = d.scopes ?? [];
    ok(d.is_valid !== false, "a Meta confirma o token como válido");
    info(`tipo: ${d.type ?? "?"} · app: ${d.application ?? d.app_id ?? "?"}`);
    info(d.expires_at ? `expira em ${new Date(d.expires_at * 1000).toISOString().slice(0, 10)}` : "sem data de expiração");
    info(`escopos (${escopos.length}): ${escopos.join(", ") || "(nenhum)"}`);
  } else {
    info(`não consegui ler os escopos: ${dbg.erro}`);
  }
  console.log();

  ok(escopos.includes("leads_retrieval"), "tem leads_retrieval (ler o lead do formulário)");
  ok(escopos.includes("pages_show_list") || escopos.includes("pages_manage_ads") || escopos.includes("pages_read_engagement"),
     "tem alguma permissão de Página");
  const temAdsRead = escopos.includes("ads_read");
  console.log(`  ${temAdsRead ? "ok  " : "--    "}${temAdsRead ? "tem ads_read (gasto e resultado de campanha)" : "NÃO tem ads_read: Ads Insights segue sem token"}`);

  // ── 3. A Página, que é o que estava bloqueado ───────────────────────────
  console.log();
  if (leads.pageId) {
    const pg = await graph<{ id: string; name?: string }>(`${leads.pageId}?fields=id,name`, leads.accessToken);
    ok(pg.ok, pg.ok ? `alcança a Página: ${pg.dados.name ?? pg.dados.id}` : `NÃO alcança a Página ${leads.pageId}: ${pg.erro}`);

    // Listar formulários exige PAGE ACCESS TOKEN, não o de System User: a Meta
    // recusa com (#190) "This method must be called with a Page Access Token".
    // Não é falta de permissão — é outro tipo de token para outro endpoint, e
    // o System User que enxerga a Página consegue trocar por um.
    //
    // O retrieval do lead em si funciona com o token de System User direto,
    // testado: os dois devolvem o mesmo lead. Por isso a integração não
    // precisa guardar Page Token; a troca serve ao diagnóstico.
    const troca = await graph<{ access_token?: string }>(
      `${leads.pageId}?fields=access_token`, leads.accessToken);
    const tokenDaPagina = troca.ok ? troca.dados.access_token : null;
    ok(Boolean(tokenDaPagina), tokenDaPagina
      ? "troca por Page Access Token (o System User alcança a Página)"
      : `não consegue Page Access Token: ${troca.ok ? "a Meta não devolveu" : troca.erro}`);

    const forms = await graph<{ data: { id: string; name?: string; status?: string; leads_count?: number }[] }>(
      `${leads.pageId}/leadgen_forms?fields=id,name,status,leads_count&limit=25`,
      tokenDaPagina ?? leads.accessToken);
    if (forms.ok) {
      const lista = forms.dados.data ?? [];
      ok(true, `lista os formulários de Lead Ads da Página (${lista.length})`);
      for (const f of lista.slice(0, 10)) {
        console.log(`          ${f.id}  ${f.status ?? "?"}  ${f.leads_count ?? 0} lead(s)  ${f.name ?? ""}`);
      }
      const comLead = lista.filter((f) => (f.leads_count ?? 0) > 0);
      const totalLeads = lista.reduce((a, f) => a + (f.leads_count ?? 0), 0);
      info(comLead.length
        ? `${comLead.length} formulário(s) com lead, ${totalLeads} leads no total`
        : "nenhum formulário tem lead: o retrieval real não tem o que buscar");

      // A prova que importa: buscar um lead de verdade com o token de System
      // User, que é o que a integração usa em runtime.
      if (comLead.length && tokenDaPagina) {
        const maior = comLead.sort((a, b) => (b.leads_count ?? 0) - (a.leads_count ?? 0))[0];
        const amostra = await graph<{ data: { id: string }[] }>(`${maior.id}/leads?limit=1`, tokenDaPagina);
        if (amostra.ok && amostra.dados.data?.[0]) {
          const lg = amostra.dados.data[0].id;
          const lead = await graph<{ field_data?: { name: string }[]; ad_id?: string; platform?: string }>(
            `${lg}?fields=id,created_time,ad_id,campaign_id,field_data,platform`, leads.accessToken);
          ok(lead.ok, lead.ok
            ? `o token de System User LÊ um lead real (${(lead.dados.field_data ?? []).length} campos, plataforma ${lead.dados.platform ?? "?"})`
            : `não lê o lead ${lg}: ${lead.erro}`);
          if (lead.ok) {
            info(`campos do formulário: ${(lead.dados.field_data ?? []).map((f) => f.name).join(", ")}`);
          }
        }
      }
    } else {
      ok(false, `não lista formulários de Lead Ads: ${forms.erro}${forms.codigo ? ` (code ${forms.codigo})` : ""}`);
    }
  } else {
    info("META_PAGE_ID não configurado: não dá para verificar a Página");
  }

  // ── 4. Ads Insights ─────────────────────────────────────────────────────
  console.log();
  if (temAdsRead && ads.adAccountId) {
    const conta = ads.adAccountId.startsWith("act_") ? ads.adAccountId : `act_${ads.adAccountId}`;
    const ins = await graph<{ data: unknown[] }>(`${conta}/insights?fields=spend&date_preset=last_7d&limit=1`, leads.accessToken);
    ok(ins.ok, ins.ok
      ? `o MESMO token lê Ads Insights da conta ${conta}`
      : `tem ads_read mas não lê a conta ${conta}: ${ins.erro}`);
  } else if (!temAdsRead) {
    info("Ads Insights continua bloqueado: falta um token com ads_read");
  }

  console.log(process.exitCode ? "\n  verificação: com falhas\n" : "\n  verificação: ok\n");
}

main().catch((e) => {
  console.error(`\n  FALHOU: ${e instanceof Error ? e.message : e}\n`);
  process.exitCode = 1;
}).finally(() => process.exit(process.exitCode ?? 0));
