/**
 * Nenhuma rota grava binário no disco por conta própria (SPEC §32).
 *
 * O acervo canônico estava inteiro — serviço, adaptadores, repositório,
 * `file_objects`/`file_links` migradas, testes verdes — e **nenhum caller**.
 * As duas rotas de upload seguiam chamando `fs.writeFileSync` num diretório da
 * máquina. É a quarta peça desta refatoração encontrada pronta e desligada, e
 * a única defesa contra a quinta é uma trava que falha no CI.
 *
 * O que o disco local custa e não aparece em teste de unidade: o anexo morre no
 * próximo deploy do container, não existe para a segunda réplica, e não tem
 * checksum nem metadado para saber o que se perdeu.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve(import.meta.dirname, "../..");

function arquivosTs(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return arquivosTs(p);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
  });
}

/** Grava binário recebido de fora. Ler e apagar continuam permitidos. */
const ESCRITA_EM_DISCO = /\bfs\.(writeFileSync|createWriteStream)\s*\(|\bwriteFile\s*\(/;

test("rota HTTP não grava arquivo no disco: passa pelo acervo", () => {
  const infratores = arquivosTs(path.join(SRC, "api-server", "routes"))
    .filter((p) => ESCRITA_EM_DISCO.test(fs.readFileSync(p, "utf8")))
    .map((p) => path.relative(SRC, p));

  assert.deepEqual(
    infratores, [],
    "estas rotas gravam binário direto no disco em vez de usar " +
    `lib/arquivos/servico (guardarNoAcervo):\n${infratores.join("\n")}`,
  );
});

test("o acervo é chamado de verdade pelas rotas de upload", () => {
  // A trava de cima é negativa: passaria também se alguém removesse o upload
  // inteiro. Esta é a afirmativa — o caminho existe e chama o serviço.
  for (const rota of ["api-server/routes/anexos.ts", "api-server/routes/perfil.ts"]) {
    const src = fs.readFileSync(path.join(SRC, rota), "utf8");
    assert.match(src, /guardarNoAcervo/, `${rota} deveria guardar pelo acervo canônico`);
  }
});

test("a entrega de arquivo não presume disco local", () => {
  // `entregarArquivo` também estava sem caller. Servir lendo o disco direto
  // manteria o acoplamento que o §32 existe para quebrar: com S3 configurado a
  // URL tem que continuar a mesma.
  const src = fs.readFileSync(path.join(SRC, "api-server/routes/uploads.ts"), "utf8");
  assert.match(src, /entregarDoAcervo/, "a rota de entrega deveria usar o acervo");
  assert.match(src, /\/arquivos\/:id/, "e endereçar pelo id do metadado, não pela chave");
});

test("disco local em produção é permissão escrita, não omissão", () => {
  // `escolherAdaptador` recusa disco local em produção. A tolerância existe só
  // porque a credencial de object storage ainda não chegou, e precisa ser
  // nominal: apagar a variável é a virada.
  const src = fs.readFileSync(path.join(SRC, "lib/arquivos/servico.ts"), "utf8");
  assert.match(src, /STORAGE_ALLOW_LOCAL/, "a tolerância tem que ter nome");
  assert.match(src, /producao:\s*process\.env\.NODE_ENV === "production"/,
    "e não pode desligar a recusa de produção por completo");
});
