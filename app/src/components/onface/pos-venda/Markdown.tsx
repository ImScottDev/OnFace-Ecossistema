/**
 * Markdown mínimo e SEGURO para o playbook das tarefas.
 *
 * Monta elementos React, nunca HTML: não há `dangerouslySetInnerHTML`, então
 * um playbook editado em Ajustes não consegue injetar script. Cobre só o que o
 * playbook usa: títulos (#, ## e ###, todos como h4), listas (- e 1.), citação (>), negrito,
 * itálico, código e link http(s)/relativo.
 *
 * Não existe biblioteca de markdown no projeto e não se instala uma para isto.
 */
import type { ReactNode } from "react";

const LINK = /^(https?:\/\/|\/)/i;

function inline(texto: string, chave: string): ReactNode[] {
  const saida: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;
  let ultimo = 0;
  let i = 0;
  for (const m of texto.matchAll(re)) {
    const ini = m.index ?? 0;
    if (ini > ultimo) saida.push(texto.slice(ultimo, ini));
    const t = m[0];
    const k = `${chave}-${i++}`;
    if (t.startsWith("**")) saida.push(<strong key={k}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) saida.push(<code key={k}>{t.slice(1, -1)}</code>);
    else if (t.startsWith("*")) saida.push(<em key={k}>{t.slice(1, -1)}</em>);
    else {
      const [, rotulo, url] = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(t) ?? [];
      saida.push(
        rotulo && LINK.test(url) ? (
          <a key={k} href={url} target={url.startsWith("/") ? undefined : "_blank"} rel="noreferrer noopener">{rotulo}</a>
        ) : (
          t
        ),
      );
    }
    ultimo = ini + t.length;
  }
  if (ultimo < texto.length) saida.push(texto.slice(ultimo));
  return saida;
}

export function Markdown({ fonte }: { fonte: string }) {
  const linhas = fonte.replace(/\r\n?/g, "\n").split("\n");
  const blocos: ReactNode[] = [];
  let i = 0;
  let n = 0;

  while (i < linhas.length) {
    const l = linhas[i];
    if (!l.trim()) { i++; continue; }
    const k = `b${n++}`;

    const h = /^(#{1,3})\s+(.*)$/.exec(l);
    if (h) {
      // Todo título do playbook é subseção de "Playbook" (h3 da tela): h4, qualquer que seja o nível escrito.
      blocos.push(<h4 key={k}>{inline(h[2], k)}</h4>);
      i++;
      continue;
    }
    if (/^\s*[-*]\s+/.test(l)) {
      const itens: string[] = [];
      while (i < linhas.length && /^\s*[-*]\s+/.test(linhas[i])) itens.push(linhas[i++].replace(/^\s*[-*]\s+/, ""));
      blocos.push(<ul key={k}>{itens.map((t, j) => <li key={j}>{inline(t, `${k}-${j}`)}</li>)}</ul>);
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(l)) {
      const itens: string[] = [];
      while (i < linhas.length && /^\s*\d+[.)]\s+/.test(linhas[i])) itens.push(linhas[i++].replace(/^\s*\d+[.)]\s+/, ""));
      blocos.push(<ol key={k}>{itens.map((t, j) => <li key={j}>{inline(t, `${k}-${j}`)}</li>)}</ol>);
      continue;
    }
    if (/^>\s?/.test(l)) {
      const partes: string[] = [];
      while (i < linhas.length && /^>\s?/.test(linhas[i])) partes.push(linhas[i++].replace(/^>\s?/, ""));
      blocos.push(<blockquote key={k}>{inline(partes.join(" "), k)}</blockquote>);
      continue;
    }
    const par: string[] = [];
    while (i < linhas.length && linhas[i].trim() && !/^(#{1,3}\s|\s*[-*]\s+|\s*\d+[.)]\s+|>\s?)/.test(linhas[i])) par.push(linhas[i++]);
    blocos.push(<p key={k}>{inline(par.join(" "), k)}</p>);
  }

  return <div className="pv-md">{blocos}</div>;
}
