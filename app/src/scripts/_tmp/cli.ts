import { clientesCrm2Routes } from "@/api-server/routes/clientes-crm2";
import { sessaoDeSmoke } from "../_sessao-de-smoke";
async function main() {
  const s = await sessaoDeSmoke();
  const r = await clientesCrm2Routes.request("http://local/clientes-crm2/resumo", { headers: { cookie: s.cookie } });
  console.log("HTTP", r.status);
  console.log(JSON.stringify(await r.json(), null, 1).slice(0, 700));
  process.exit(0);
}
main();
