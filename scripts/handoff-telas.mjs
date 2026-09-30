#!/usr/bin/env node
/**
 * As telas canônicas do handoff e o nome que cada uma recebe no produto.
 *
 * O mapa é explícito, e não derivado do nome do arquivo, por um motivo
 * concreto: derivar tirando os caracteres não alfanuméricos transforma
 * "Pre-vendas" em "Prevendas", e num sistema de arquivos que ignora maiúscula
 * — o macOS — esse arquivo SOBRESCREVE "PreVendasDesenho.tsx" mantendo o nome
 * antigo no disco. O import gerado aponta para um `.css` que passa a não
 * existir, e a tela cai com 500 sem que o nome do arquivo denuncie nada.
 *
 * Uso:
 *   node scripts/handoff-telas.mjs <pasta-do-handoff> [<pasta-de-destino>]
 */

import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import { join } from "node:path";

/** `OnFace <arquivo>.dc.html` → nome do componente no produto. */
export const TELAS = [
  ["Casca", "CascaDesenho"],
  ["Pecas", "PecasDesenho"],
  ["Pre-vendas", "PreVendasDesenho"],
  ["Pipeline", "PipelineDesenho"],
  ["Oportunidade", "OportunidadeDesenho"],
  ["Propostas", "PropostasDesenho"],
  ["Proposta", "PropostaDesenho"],
  ["Contatos", "ContatosDesenho"],
  ["Empresa", "EmpresaDesenho"],
  ["Pessoa", "PessoaDesenho"],
  ["Cliente", "ClienteDesenho"],
  ["Clientes", "ClientesDesenho"],
  ["Atendimento", "AtendimentoDesenho"],
  ["Atividades", "AtividadesDesenho"],
  ["Atividade", "AtividadeDesenho"],
  ["Projeto", "ProjetoDesenho"],
  ["Onboarding", "OnboardingDesenho"],
  ["CS", "CsDesenho"],
  ["Calendario", "CalendarioDesenho"],
  ["Reuniao", "ReuniaoDesenho"],
  ["Relatorio Ligacao", "RelatorioLigacaoDesenho"],
  ["Iniciar Relacao", "IniciarRelacaoDesenho"],
  ["Tags Oportunidade", "TagsOportunidadeDesenho"],
];

/* `file://${argv[1]}` não bate quando o caminho tem espaço — e este repo
   mora em "Scott Studio". `pathToFileURL` faz o escape certo. */
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const handoff = process.argv[2];
  const destino = process.argv[3] ?? "app/src/components/onface/proto";
  if (!handoff) {
    console.error("uso: node scripts/handoff-telas.mjs <pasta-do-handoff> [destino]");
    process.exit(1);
  }

  /* Nomes que colidem sem diferenciar maiúscula seriam o mesmo arquivo no
     macOS — melhor recusar aqui do que descobrir por um 500 depois. */
  const vistos = new Map();
  for (const [, nome] of TELAS) {
    const chave = nome.toLowerCase();
    if (vistos.has(chave)) {
      console.error(`colisão de nome ignorando maiúsculas: ${nome} e ${vistos.get(chave)}`);
      process.exit(1);
    }
    vistos.set(chave, nome);
  }

  let ok = 0;
  const faltando = [];
  for (const [arquivo, nome] of TELAS) {
    const origem = join(handoff, `OnFace ${arquivo}.dc.html`);
    if (!existsSync(origem)) { faltando.push(arquivo); continue; }
    execFileSync("node", [
      "scripts/dc-para-tsx.mjs", origem, join(destino, `${nome}.tsx`), nome,
    ], { stdio: "pipe" });
    ok += 1;
  }

  console.log(`${ok} tela(s) convertida(s) em ${destino}`);
  if (faltando.length) console.log(`não encontradas no handoff: ${faltando.join(", ")}`);
}
