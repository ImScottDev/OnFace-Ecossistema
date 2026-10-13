import * as React from "react";

/* A aba Arquivos da oportunidade (página e drawer do quadro): UMA lista, UM jeito de
   abrir. O desenho só imprime `nome` e `meta`; `nome` aceita elemento, então o link
   mora aqui e o markup gerado continua intocado.

   Tudo abre por rota autenticada do servidor: anexo e acervo em /api/arquivos/:id,
   legado Zoho em /api/anexos-legado/:id/download, PDF da proposta em
   /api/propostas/:id/pdf. PDF e imagem abrem em nova aba; o resto baixa. */

const ABRE_NA_ABA = /\.(pdf|png|jpe?g|gif|webp)$/i;

export function linkDeArquivo(nome: string, url: string | null | undefined): React.ReactNode {
  if (!url) return nome;
  const abre = ABRE_NA_ABA.test(nome);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, maxWidth: "100%" }}>
      <a
        href={url}
        {...(abre ? { target: "_blank", rel: "noreferrer" } : { download: nome })}
        title={abre ? "Abrir em nova aba" : "Baixar"}
        style={{ color: "inherit", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis" }}
      >
        {nome}
      </a>
      <a
        href={url}
        download={nome}
        title="Baixar"
        aria-label={"Baixar " + nome}
        style={{ flex: "0 0 auto", fontSize: 11.5, fontWeight: 600, color: "#c2330f", textDecoration: "none" }}
      >
        Baixar
      </a>
    </span>
  );
}

type Prop = { id?: string; codigo: string; versao?: number; status: string; enviadaEm?: string | null };
type Anexo = { nome: string; url?: string | null; quando?: string; autor?: string };

/** `rotuloStatus` traduz o status da proposta; `resp` é o autor de fallback. */
export function arquivosDaOpp(props: Prop[], anexos: Anexo[], rotuloStatus: Record<string, string>, resp: string) {
  return props
    .map((p) => ({
      nome: linkDeArquivo("Proposta #" + p.codigo + "-v" + (p.versao || 1) + ".pdf", p.id ? `/api/propostas/${p.id}/pdf` : null),
      meta: (rotuloStatus[p.status] || "") + (p.enviadaEm ? " · enviada " + p.enviadaEm : ""),
    }))
    .concat(anexos.map((n) => ({
      nome: linkDeArquivo(n.nome, n.url),
      meta: "Anexado " + (n.quando || "hoje") + " · " + (n.autor || resp),
    })));
}
