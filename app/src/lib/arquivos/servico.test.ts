/**
 * Serviço de arquivos (SPEC §32).
 *
 * As regras que este teste trava são as que a implementação anterior não tinha:
 * limite de tamanho, lista de tipos permitidos, checksum, deduplicação e
 * isolamento por organização no próprio caminho do arquivo.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  guardarArquivo, entregarArquivo, adaptadorLocal, sha256, escolherAdaptador,
  TAMANHO_MAXIMO, type RepositorioArquivos,
} from "@onface/platform-storage";

/** Repositório em memória: o serviço não deve precisar de banco para ser testado. */
function repoFalso(): RepositorioArquivos & { linhas: Map<string, Record<string, unknown>>; vinculos: unknown[] } {
  const linhas = new Map<string, Record<string, unknown>>();
  const vinculos: unknown[] = [];
  let seq = 0;
  return {
    linhas, vinculos,
    async registrar(d) {
      const id = `file-${++seq}`;
      linhas.set(id, { ...d, id, deletedAt: null });
      return id;
    },
    async vincular(fileObjectId, organizacaoId, vinculo, criadoPorId) {
      vinculos.push({ fileObjectId, organizacaoId, ...vinculo, criadoPorId });
    },
    async buscar(id, organizacaoId) {
      const l = linhas.get(id);
      if (!l || l.organizacaoId !== organizacaoId) return null;
      return l as never;
    },
    async acharPorChecksum(organizacaoId, checksum) {
      for (const l of linhas.values()) {
        if (l.organizacaoId === organizacaoId && l.checksum === checksum && !l.deletedAt) {
          return { id: l.id as string, storageKey: l.storageKey as string };
        }
      }
      return null;
    },
    async marcarRemovido(id) {
      const l = linhas.get(id);
      if (l) l.deletedAt = new Date();
    },
  };
}

const conteudo = (texto: string) => new TextEncoder().encode(texto);

test("guarda o binário e o metadado, e a chave isola a organização", async () => {
  const raiz = await mkdtemp(join(tmpdir(), "onface-storage-"));
  const repo = repoFalso();
  const ad = adaptadorLocal(raiz);

  const r = await guardarArquivo(repo, ad, sha256, {
    organizacaoId: "org-1", nomeOriginal: "proposta.pdf", mimeType: "application/pdf",
    conteudo: conteudo("conteudo da proposta"),
    vinculos: [{ tipo: "proposta", id: "prop-1", papel: "documento" }],
  });

  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.jaExistia, false);
  assert.equal(r.arquivo.checksum, sha256(conteudo("conteudo da proposta")));

  // O tenant vai no caminho, não só na consulta: um bug de consulta não vaza
  // arquivo de outro cliente.
  assert.ok(r.arquivo.storageKey.startsWith("org-1/"), "a chave precisa isolar a organização");
  assert.ok(r.arquivo.storageKey.endsWith(".pdf"), "a extensão original se perdeu no caminho");

  const gravado = await readFile(join(raiz, r.arquivo.storageKey));
  assert.equal(gravado.toString(), "conteudo da proposta");
  assert.equal(repo.vinculos.length, 1);
});

test("o mesmo conteúdo não vira dois arquivos, só ganha outro vínculo", async () => {
  const raiz = await mkdtemp(join(tmpdir(), "onface-storage-"));
  const repo = repoFalso();
  const ad = adaptadorLocal(raiz);
  const base = {
    organizacaoId: "org-1", nomeOriginal: "contrato.pdf",
    mimeType: "application/pdf", conteudo: conteudo("mesmo pdf"),
  };

  const a = await guardarArquivo(repo, ad, sha256, { ...base, vinculos: [{ tipo: "contrato" as const, id: "c1" }] });
  const b = await guardarArquivo(repo, ad, sha256, { ...base, vinculos: [{ tipo: "empresa" as const, id: "e1" }] });

  assert.equal(a.ok && b.ok, true);
  if (!a.ok || !b.ok) return;
  assert.equal(b.jaExistia, true, "o mesmo conteúdo deveria reusar o arquivo");
  assert.equal(a.arquivo.id, b.arquivo.id);
  assert.equal(repo.linhas.size, 1, "dois registros para o mesmo conteúdo");
  assert.equal(repo.vinculos.length, 2, "cada envio precisa do seu vínculo");
});

test("organizações diferentes NÃO compartilham binário, mesmo com conteúdo igual", async () => {
  const raiz = await mkdtemp(join(tmpdir(), "onface-storage-"));
  const repo = repoFalso();
  const ad = adaptadorLocal(raiz);
  const base = { nomeOriginal: "x.pdf", mimeType: "application/pdf", conteudo: conteudo("igual") };

  const a = await guardarArquivo(repo, ad, sha256, { ...base, organizacaoId: "org-1" });
  const b = await guardarArquivo(repo, ad, sha256, { ...base, organizacaoId: "org-2" });
  assert.equal(a.ok && b.ok, true);
  if (!a.ok || !b.ok) return;

  // Compartilhar binário entre tenants seria vazamento esperando um bug.
  assert.notEqual(a.arquivo.id, b.arquivo.id);
  assert.equal(b.jaExistia, false);
});

test("recusa o que não deve entrar: vazio, grande demais, tipo não aceito", async () => {
  const raiz = await mkdtemp(join(tmpdir(), "onface-storage-"));
  const repo = repoFalso();
  const ad = adaptadorLocal(raiz);
  const base = { organizacaoId: "org-1", nomeOriginal: "x", mimeType: "application/pdf" };

  const vazio = await guardarArquivo(repo, ad, sha256, { ...base, conteudo: new Uint8Array(0) });
  assert.equal(vazio.ok, false);
  if (!vazio.ok) assert.equal(vazio.codigo, "VAZIO");

  const grande = await guardarArquivo(repo, ad, sha256, {
    ...base, conteudo: new Uint8Array(TAMANHO_MAXIMO + 1),
  });
  assert.equal(grande.ok, false);
  if (!grande.ok) assert.equal(grande.codigo, "TAMANHO");

  // Lista de permissão, não de bloqueio: uma lista de bloqueio está sempre uma
  // extensão atrás de quem quer burlá-la.
  const executavel = await guardarArquivo(repo, ad, sha256, {
    ...base, mimeType: "application/x-msdownload", conteudo: conteudo("MZ"),
  });
  assert.equal(executavel.ok, false);
  if (!executavel.ok) assert.equal(executavel.codigo, "TIPO");
});

test("entrega o conteúdo quando o provedor não sabe assinar", async () => {
  const raiz = await mkdtemp(join(tmpdir(), "onface-storage-"));
  const repo = repoFalso();
  const ad = adaptadorLocal(raiz);
  const r = await guardarArquivo(repo, ad, sha256, {
    organizacaoId: "org-1", nomeOriginal: "nota.txt", mimeType: "text/plain",
    conteudo: conteudo("texto"),
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;

  const entrega = await entregarArquivo(repo, ad, r.arquivo.id, "org-1");
  assert.equal(entrega.ok, true);
  if (!entrega.ok) return;
  assert.ok("conteudo" in entrega, "disco local não assina; tem que devolver o conteúdo");

  // Organização errada não acha o arquivo, mesmo com o id certo.
  const outraOrg = await entregarArquivo(repo, ad, r.arquivo.id, "org-2");
  assert.equal(outraOrg.ok, false);
});

test("a chave não consegue escapar da raiz", async () => {
  const raiz = await mkdtemp(join(tmpdir(), "onface-storage-"));
  const ad = adaptadorLocal(raiz);
  await assert.rejects(
    () => ad.guardar("../../fora.txt", conteudo("x"), "text/plain"),
    /sai da raiz/,
  );
});

test("produção sem object storage falha em vez de cair no disco local", () => {
  assert.throws(
    () => escolherAdaptador({ config: null, raizLocal: "/tmp/x", producao: true }),
    /object storage não configurado/,
    "cair no disco local em silêncio é como o produto chegou aqui",
  );
  const dev = escolherAdaptador({ config: null, raizLocal: "/tmp/x", producao: false });
  assert.equal(dev.provider, "local");
});
