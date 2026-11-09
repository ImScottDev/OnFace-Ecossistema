/**
 * Smoke do fechamento com venda de autoatendimento (09/11/2026).
 *
 * Prova, contra o banco de verdade, as duas coisas que o Scott pediu:
 *   1. nenhuma linha do mês sai R$ 0,00;
 *   2. a venda de self-checkout aparece com o canal no lugar do vendedor.
 *
 *   npx tsx src/scripts/smoke-fechamento-autoatendimento.ts 2026-10
 */
import { listarVendasFechadas } from "@/lib/relatorios/fechamento-comercial";

const ORG = process.env.ORG_ID ?? "320a9052-dd43-4edb-9b74-34be53c5c419";
const mes = process.argv[2] ?? "2026-10";
const [ano, m] = mes.split("-").map(Number);
// Janela em horário de São Paulo (UTC-3), igual à da tela.
const since = new Date(Date.UTC(ano, m - 1, 1, 3));
const until = new Date(Date.UTC(ano, m, 1, 3));

async function main() {
  const vendas = await listarVendasFechadas(ORG, since, until);
  const zeradas = vendas.filter((v) => v.valorVendido === 0 && v.valorAvulso === 0);
  const auto = vendas.filter((v) => v.autoatendimento);
  const total = vendas.reduce((s, v) => s + v.valorVendido, 0);

  console.log(`mês ${mes}: ${vendas.length} vendas, booking R$ ${total.toFixed(2)}`);
  console.log(`linhas zeradas: ${zeradas.length}`, zeradas.map((v) => v.empresaNome));
  console.log(`autoatendimento: ${auto.length}`);
  for (const v of auto) console.log(`  ${v.empresaNome} · ${v.closerNome} · R$ ${v.valorVendido.toFixed(2)}`);

  if (zeradas.length > 0) { console.error("FALHOU: ainda há venda sem valor"); process.exit(1); }
  if (auto.some((v) => !v.closerNome)) { console.error("FALHOU: autoatendimento sem rótulo no vendedor"); process.exit(1); }
  console.log("OK");
  process.exit(0);
}

main();
