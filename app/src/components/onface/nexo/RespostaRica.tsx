"use client";
/* Resposta do NEXO desenhada por blocos (título, tabela, lista, citação),
 * a partir do markdown que o modelo devolve. Links internos navegam pela casca. */
import * as React from "react";
import { blocos, type Trecho } from "@/lib/nexo/markdown";

const cor = "#1f252c";
const sutil = "#5b6570";

function Trechos({ t, navegar }: { t: Trecho[]; navegar: (href: string) => void }) {
  return <>{t.map((x, i) => {
    const conteudo = x.negrito ? <strong style={{ fontWeight: 650 }}>{x.texto}</strong> : x.texto;
    return x.href
      ? <a key={i} href={x.href} onClick={(e) => { e.preventDefault(); navegar(x.href!); }} style={{ color: "#b8321a", textDecoration: "underline", textUnderlineOffset: 2 }}>{conteudo}</a>
      : <React.Fragment key={i}>{conteudo}</React.Fragment>;
  })}</>;
}

export function RespostaRica({ texto, navegar }: { texto: string; navegar: (href: string) => void }) {
  const bs = React.useMemo(() => blocos(texto), [texto]);
  return <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
    {bs.map((b, i) => {
      switch (b.tipo) {
        case "titulo": return <div key={i} style={{ fontSize: b.nivel === 1 ? 14.5 : 13.5, fontWeight: 700, color: cor, marginTop: i ? 4 : 0, letterSpacing: "-0.01em" }}><Trechos t={b.trechos} navegar={navegar} /></div>;
        case "paragrafo": return <p key={i} style={{ margin: 0 }}><Trechos t={b.trechos} navegar={navegar} /></p>;
        case "lista": return <ul key={i} style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 5 }}>
          {b.itens.map((it, j) => <li key={j} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <span style={{ flex: "0 0 auto", width: 5, height: 5, borderRadius: "50%", background: "#c8ccc9", marginTop: 7 }} />
            <span style={{ flex: 1, minWidth: 0 }}><Trechos t={it} navegar={navegar} /></span>
          </li>)}
        </ul>;
        case "tabela": return <div key={i} style={{ overflowX: "auto", borderRadius: 8, boxShadow: "inset 0 0 0 1px #e3e6e5", background: "#fff" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12.5 }}>
            <thead><tr>{b.cabecalho.map((c, j) => <th key={j} style={{ textAlign: j ? "right" : "left", padding: "7px 10px", fontWeight: 650, color: sutil, borderBottom: "1px solid #e3e6e5", whiteSpace: "nowrap" }}><Trechos t={c} navegar={navegar} /></th>)}</tr></thead>
            <tbody>{b.linhas.map((l, j) => <tr key={j}>{l.map((c, k) => <td key={k} style={{ textAlign: k ? "right" : "left", padding: "6px 10px", borderBottom: j < b.linhas.length - 1 ? "1px solid #eef0ef" : 0, color: cor, fontVariantNumeric: "tabular-nums" }}><Trechos t={c} navegar={navegar} /></td>)}</tr>)}</tbody>
          </table>
        </div>;
        case "citacao": return <div key={i} style={{ borderLeft: "2px solid #dbdede", paddingLeft: 9, color: sutil, fontSize: 12 }}><Trechos t={b.trechos} navegar={navegar} /></div>;
        case "regua": return <hr key={i} style={{ border: 0, borderTop: "1px solid #e3e6e5", margin: "2px 0" }} />;
      }
    })}
  </div>;
}
