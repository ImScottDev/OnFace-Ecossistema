/**
 * Smoke do acervo de arquivos, contra o banco de verdade (SPEC §32).
 *
 * O pacote tinha teste de unidade verde e zero callers. Teste de unidade com
 * repositório falso nunca ia dizer que nada em runtime chamava aquilo, nem que
 * a união de tipos declarava `cliente` e `comunicacao` enquanto o CHECK do
 * banco só aceita `servico_canonico` e `communication`. Este smoke escreve,
 * deduplica, vincula, entrega e apaga — no Postgres carregado com produção.
 *
 *     pnpm tsx --env-file=.env src/scripts/smoke-acervo-arquivos.ts
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { guardarNoAcervo, entregarDoAcervo, removerDoAcervo, adaptadorDeArquivos } from "@/lib/arquivos/servico";
import { uploadsRoutes } from "@/api-server/routes/uploads";

const ok = (cond: unknown, msg: string) => {
  console.log(`${cond ? "  ok  " : "  FALHA  "}${msg}`);
  if (!cond) process.exitCode = 1;
};

/**
 * Objetos criados, registrados NA HORA em que nascem.
 *
 * Registrar só no fim da função já deixou lixo no banco duas vezes nesta
 * refatoração: bastou uma falha no meio para o objeto ficar órfão.
 */
const paraLimpar: string[] = [];

async function limpar(organizacaoId: string) {
  for (const id of paraLimpar) {
    await db.execute(sql`DELETE FROM file_links WHERE file_object_id = ${id}::uuid`);
    await removerDoAcervo(id, organizacaoId).catch(() => undefined);
    await db.execute(sql`DELETE FROM file_objects WHERE id = ${id}::uuid`);
  }
}

async function main() {
  const [org] = await db.execute<{ id: string }>(sql`SELECT id::text FROM organizacoes LIMIT 1`);
  if (!org) throw new Error("nenhuma organização no banco");

  console.log(`\nprovedor: ${adaptadorDeArquivos().provider}`);
  console.log(`organização: ${org.id}\n`);

  const conteudo = new TextEncoder().encode(`smoke do acervo ${org.id}`);

  // 1. Guardar
  const a = await guardarNoAcervo({
    organizacaoId: org.id, nomeOriginal: "smoke-acervo.txt",
    mimeType: "text/plain", conteudo,
  });
  ok(a.ok, "guarda um arquivo");
  if (!a.ok) return limpar(org.id);
  paraLimpar.push(a.arquivo.id);

  ok(!a.jaExistia, "o primeiro envio cria o binário");
  ok(a.arquivo.storageKey.startsWith(`${org.id}/`), "a organização vai na chave de armazenamento");
  ok(a.arquivo.checksum.length === 64, "o checksum é sha256");
  ok(a.arquivo.tamanhoBytes === conteudo.byteLength, "o tamanho é o do conteúdo, não o do nome");

  const [linha] = await db.execute<{ n: number }>(
    sql`SELECT count(*)::int AS n FROM file_objects WHERE id = ${a.arquivo.id}::uuid`);
  ok(linha?.n === 1, "o metadado existe em file_objects");

  // 2. Deduplicar
  const b = await guardarNoAcervo({
    organizacaoId: org.id, nomeOriginal: "outro-nome.txt",
    mimeType: "text/plain", conteudo,
  });
  ok(b.ok && b.jaExistia, "o mesmo conteúdo não vira um segundo binário");
  ok(b.ok && b.arquivo.id === a.arquivo.id, "e devolve o arquivo que já existia");

  // 3. Vincular — os tipos têm que ser os que o CHECK do banco aceita
  const [f] = await db.execute<{ id: string }>(
    sql`SELECT id::text FROM fulfillments WHERE organizacao_id = ${org.id}::uuid LIMIT 1`);
  if (f) {
    const c = await guardarNoAcervo({
      organizacaoId: org.id, nomeOriginal: "smoke-acervo-vinculado.txt", mimeType: "text/plain",
      conteudo: new TextEncoder().encode(`vinculo ${f.id}`),
      vinculos: [{ tipo: "fulfillment", id: f.id, papel: "formulario_implantacao" }],
    });
    ok(c.ok, "guarda com vínculo de fulfillment");
    if (c.ok) {
      paraLimpar.push(c.arquivo.id);
      const [v] = await db.execute<{ n: number }>(sql`
        SELECT count(*)::int AS n FROM file_links
         WHERE file_object_id = ${c.arquivo.id}::uuid AND entity_type = 'fulfillment'`);
      ok(v?.n === 1, "o vínculo entrou em file_links sem violar o CHECK");
    }
  } else {
    console.log("  --  sem fulfillment nesta organização, vínculo não verificado");
  }

  // 4. Entregar
  const r = await entregarDoAcervo(a.arquivo.id, org.id);
  ok(r.ok, "entrega o arquivo guardado");
  if (r.ok && "conteudo" in r) {
    ok(new TextDecoder().decode(r.conteudo) === new TextDecoder().decode(conteudo),
       "o conteúdo entregue é o mesmo que entrou");
    ok(r.nomeOriginal === "smoke-acervo.txt", "e o nome original sobrevive");
  }

  // 5. Isolamento. A organização é um id fixo e inexistente de propósito: este
  // banco tem um tenant só, e uma verificação que só roda quando existe um
  // segundo tenant é uma verificação que nunca rodou.
  const ORG_INEXISTENTE = "00000000-0000-4000-8000-000000000000";
  const alheio = await entregarDoAcervo(a.arquivo.id, ORG_INEXISTENTE);
  ok(!alheio.ok, "outra organização não encontra o arquivo");

  // 5b. Autorização da leitura pública, pela ROTA de verdade.
  //
  // Verificar isto com grep no arquivo não vale: a versão anterior desta rota
  // conferia só o vínculo entre arquivo e fulfillment, e um grep procurando
  // "file_links" teria aprovado exatamente o desenho errado.
  const [alvo] = await db.execute<{ id: string; token: string }>(sql`
    SELECT id::text, public_token::text AS token FROM fulfillments
     WHERE organizacao_id = ${org.id}::uuid AND public_token IS NOT NULL LIMIT 1`);

  if (alvo) {
    const anexo = await guardarNoAcervo({
      organizacaoId: org.id, nomeOriginal: "smoke-acervo-publico.txt", mimeType: "text/plain",
      conteudo: new TextEncoder().encode(`publico ${alvo.id}`),
      vinculos: [{ tipo: "fulfillment", id: alvo.id, papel: "formulario_implantacao" }],
    });
    ok(anexo.ok, "guarda anexo de formulário público");

    if (anexo.ok) {
      paraLimpar.push(anexo.arquivo.id);
      // Sem o prefixo `/api`: ele pertence ao mount em `server.ts`, não ao
      // sub-app. Com o prefixo tudo devolve 404, e os casos negativos passariam
      // pelo motivo errado.
      const chamar = (caminho: string) => uploadsRoutes.request(`http://local${caminho}`);

      const comToken = await chamar(`/arquivos/publico/${alvo.token}/${anexo.arquivo.id}`);
      ok(comToken.status === 200,
         `o token do formulário abre o anexo (status ${comToken.status})`);

      const TOKEN_FALSO = "11111111-1111-4111-8111-111111111111";
      const semToken = await chamar(`/arquivos/publico/${TOKEN_FALSO}/${anexo.arquivo.id}`);
      ok(semToken.status === 404,
         `token errado não abre, mesmo com o id certo do arquivo (status ${semToken.status})`);

      // O caso que motivou a correção: conhecer o id do fulfillment não basta.
      const porId = await chamar(`/arquivos/publico/${alvo.id}/${anexo.arquivo.id}`);
      ok(porId.status === 404,
         `o id do fulfillment no lugar do token não abre (status ${porId.status})`);

      // Token legítimo não vira chave-mestra da organização.
      const outroArquivo = await chamar(`/arquivos/publico/${alvo.token}/${a.arquivo.id}`);
      ok(outroArquivo.status === 404,
         `token válido não abre arquivo de outro fulfillment (status ${outroArquivo.status})`);

      const semSessao = await chamar(`/arquivos/${anexo.arquivo.id}`);
      ok(semSessao.status === 401,
         `a rota autenticada continua exigindo sessão (status ${semSessao.status})`);
    }
  } else {
    console.log("  --  sem fulfillment com publicToken, autorização pública não verificada");
  }

  // 6. Recusas do domínio
  const vazio = await guardarNoAcervo({
    organizacaoId: org.id, nomeOriginal: "smoke-acervo-vazio.txt", mimeType: "text/plain",
    conteudo: new Uint8Array(0),
  });
  ok(!vazio.ok && vazio.codigo === "VAZIO", "recusa arquivo vazio");

  const tipoRuim = await guardarNoAcervo({
    organizacaoId: org.id, nomeOriginal: "smoke-acervo.exe", mimeType: "application/x-msdownload",
    conteudo: new TextEncoder().encode("binario qualquer"),
  });
  ok(!tipoRuim.ok && tipoRuim.codigo === "TIPO", "recusa tipo fora do allowlist");

  const zip = await guardarNoAcervo({
    organizacaoId: org.id, nomeOriginal: "smoke-acervo.zip", mimeType: "application/zip",
    conteudo: new TextEncoder().encode("conteudo de zip para o smoke"),
  });
  ok(zip.ok, "aceita application/zip, que a rota de anexos já aceitava");
  if (zip.ok) paraLimpar.push(zip.arquivo.id);

  await limpar(org.id);

  const [resto] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM file_objects WHERE nome_original LIKE 'smoke-acervo%'`);
  ok(resto?.n === 0, "o smoke não deixa resíduo");

  console.log(process.exitCode ? "\nsmoke do acervo: FALHOU\n" : "\nsmoke do acervo: ok\n");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
}).finally(() => process.exit(process.exitCode ?? 0));
