/**
 * Gera os snapshots governados da base de conhecimento a partir do vault.
 * Roda na máquina que tem o vault; só lê o que está no MANIFESTO; escreve em
 * `src/lib/ai-platform/conhecimento/base/`. Depois, commitar os arquivos e
 * `carregarBaseGovernada` (seed da Lia ou rota) indexa.
 *
 *   npx tsx src/scripts/ingerir-conhecimento-vault.ts "/caminho/do/vault"
 */
import fs from "node:fs";
import path from "node:path";
import { MANIFESTO_VAULT, montarSnapshot, sanitizar } from "@/lib/ai-platform/conhecimento/vault";

function main() {
  const vault = process.argv[2] ?? "/Users/Scott/Documents/Brain - Scott Studio";
  const destino = path.join(process.cwd(), "src/lib/ai-platform/conhecimento/base");
  fs.mkdirSync(destino, { recursive: true });
  const agora = new Date().toISOString().slice(0, 10);
  for (const item of MANIFESTO_VAULT) {
    const arquivo = path.join(vault, item.origem);
    if (!fs.existsSync(arquivo)) { console.log(`AUSENTE  ${item.origem}`); continue; }
    const { texto, relatorio } = sanitizar(fs.readFileSync(arquivo, "utf8"));
    fs.writeFileSync(path.join(destino, `${item.slug}.md`), montarSnapshot(item, texto, agora));
    console.log(`${item.governanca.padEnd(9)} ${item.slug}  ${texto.length} chars  removido: ${JSON.stringify(relatorio)}`);
  }
}
main();
