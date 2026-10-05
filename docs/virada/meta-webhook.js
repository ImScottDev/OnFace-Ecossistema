// Webhook de Lead Ads da Meta -> ONFACE: mostra ou aplica a assinatura.
//
// Duas peças, e as duas precisam existir para a Meta mandar o lead:
//   1. o app (META_APP_ID) assina o objeto `page`, campo `leadgen`, apontando para a rota;
//   2. o app está instalado na Página (META_PAGE_ID) com o campo `leadgen`.
// Em 05/10/2026 faltavam as duas: o app só tinha webhook de WhatsApp e a Página não tinha app nenhum.
//
// Roda dentro do container do app, que já tem as credenciais no ambiente. Nunca imprime token.
//   ver:      docker exec -i <container-app> node - < meta-webhook.js
//   aplicar:  docker exec -i -e META_CALLBACK=https://<host>/api/webhooks/meta-leads <container-app> node - < meta-webhook.js
//
// Na hora de aplicar, a Meta chama a rota com o verify token e exige o eco do challenge:
// se a rota não estiver no ar com o mesmo META_WEBHOOK_VERIFY_TOKEN, a assinatura é recusada.
// Trocar de host é rodar de novo com outro META_CALLBACK; a Meta guarda um callback por objeto.
const v = process.env;
const G = `https://graph.facebook.com/${v.META_API_VERSION || "v26.0"}`;
const app = v.META_APP_ID;
const pagina = v.META_PAGE_ID;
const tokenDoApp = `${app}|${v.META_APP_SECRET}`;

async function graph(metodo, caminho, token, params = {}) {
  const q = new URLSearchParams({ ...params, access_token: token });
  const r = metodo === "GET" ? await fetch(`${G}/${caminho}?${q}`) : await fetch(`${G}/${caminho}`, { method: metodo, body: q });
  const j = await r.json().catch(() => ({}));
  if (j.error) throw new Error(`${metodo} ${caminho}: ${j.error.code}${j.error.error_subcode ? "/" + j.error.error_subcode : ""} ${j.error.message}`);
  return j;
}

(async () => {
  // Token de Página derivado do System User: também não expira. As chamadas de gestão da Página exigem ele.
  const { access_token: tokenDaPagina } = await graph("GET", pagina, v.META_LEADS_ACCESS_TOKEN, { fields: "access_token" });

  if (v.META_CALLBACK) {
    await graph("POST", `${app}/subscriptions`, tokenDoApp, {
      object: "page", callback_url: v.META_CALLBACK, fields: "leadgen",
      verify_token: v.META_WEBHOOK_VERIFY_TOKEN, include_values: "true",
    });
    await graph("POST", `${pagina}/subscribed_apps`, tokenDaPagina, { subscribed_fields: "leadgen" });
  }

  const assinatura = ((await graph("GET", `${app}/subscriptions`, tokenDoApp)).data || []).find((s) => s.object === "page");
  const instalado = ((await graph("GET", `${pagina}/subscribed_apps`, tokenDaPagina)).data || []).find((a) => a.id === app);
  const camposApp = (assinatura?.fields || []).map((f) => f.name);
  const camposPagina = instalado?.subscribed_fields || [];

  console.log(`app ${app}, objeto page: ${assinatura ? `${assinatura.callback_url} [${camposApp}] ativo=${assinatura.active}` : "NÃO ASSINADO"}`);
  console.log(`Página ${pagina}: ${instalado ? `app instalado [${camposPagina}]` : "app NÃO INSTALADO"}`);
  const ok = camposApp.includes("leadgen") && assinatura.active && camposPagina.includes("leadgen");
  console.log(ok ? "OK: a Meta vai entregar leadgen nesse callback." : "FALTA PEÇA: a Meta não entrega lead.");
  if (!ok) process.exitCode = 1;
})().catch((e) => { console.error("FALHOU:", e.message); process.exitCode = 1; });
