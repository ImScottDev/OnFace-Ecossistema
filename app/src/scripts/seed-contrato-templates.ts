/**
 * Carrega os contratos oficiais da Callface em `contrato_templates`.
 * Arquivo muda -> nova versão (a anterior fica inativa, nunca é apagada).
 *
 *   npx tsx --env-file=.env src/scripts/seed-contrato-templates.ts [--dry]
 */
import { carregarModelosOficiais } from "@/lib/crm/modelos-contrato";

carregarModelosOficiais({ atualizar: true, dry: process.argv.includes("--dry"), log: console.log })
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
