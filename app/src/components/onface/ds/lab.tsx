"use client";

/** Andaime da documentação do laboratório.
 *
 * Todo bloco documentado tem a mesma forma: número, título ancorado por um fio,
 * uma linha de porquê, a demo de verdade, o caminho para o código e, quando
 * existe regra, o par faça/não faça. Se um bloco precisar de layout próprio, ele
 * está pedindo para virar componente, não para ganhar exceção aqui.
 *
 * A gramática editorial (numeração 01, 02, 03…, fio hairline sob o título e o
 * degrau página → cartão → rebaixado) mora aqui de propósito: é o andaime que
 * carrega a identidade para TODAS as seções de uma vez. Quando ela ficava só na
 * casca grafite, o canvas desfocado era Storybook padrão. */

import * as React from "react";
import { toast } from "sonner";
import { Copy, FileCode2, Link2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

/** Posição da seção no índice do laboratório.
 *
 * Só o `LabShell` conhece a ordem das seções, e as onze seções não podem ganhar
 * uma prop nova sem editar onze arquivos de outra equipe. O contexto resolve
 * isso sem tocar em nenhuma delas. */
export const OrdemSecao = React.createContext<{ ordem: number; total: number } | null>(null);

const doisDigitos = (n: number) => String(n).padStart(2, "0");

/** Âncora estável a partir do título: o endereço de um bloco é o texto que a
 * pessoa lê, não um índice que muda quando alguém reordena a página. */
function idDeTitulo(titulo: string) {
  return titulo
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function Secao({
  titulo,
  chamada,
  children,
}: {
  titulo: string;
  chamada: string;
  children: React.ReactNode;
}) {
  const posicao = React.useContext(OrdemSecao);
  const raiz = React.useRef<HTMLDivElement>(null);
  const [blocos, setBlocos] = React.useState<{ id: string; titulo: string }[]>([]);

  /* O sumário é lido do DOM depois da montagem, não de `React.Children`: em
     Primitivas os blocos vêm dentro de `<Familia>`, então varrer os filhos
     diretos só acharia os wrappers. A consulta acha todos, na ordem em que a
     página é lida, que é a mesma ordem do contador CSS da numeração. */
  React.useEffect(() => {
    const nos = raiz.current?.querySelectorAll<HTMLElement>("[data-ds-bloco]");
    setBlocos(nos ? Array.from(nos, (no) => ({ id: no.id, titulo: no.dataset.dsBloco ?? "" })) : []);
  }, []);

  return (
    <div className="ds-lab-conteudo" ref={raiz}>
      <header className="ds-lab-cabecalho">
        <div className="ds-lab-cabecalho-linha">
          {posicao ? (
            <span className="ds-lab-cabecalho-ordem">
              {doisDigitos(posicao.ordem)}
              <i aria-hidden>/</i>
              {doisDigitos(posicao.total)}
            </span>
          ) : null}
          {/* h2 porque o h1 da página é o título da faixa grafite. Dois h1 numa
              página deixam o leitor de tela sem saber qual é o assunto. */}
          <h2>{titulo}</h2>
          <span className="ds-fio" aria-hidden />
        </div>
        <p className="ds-lab-cabecalho-chamada">{chamada}</p>
      </header>

      {/* Sumário só onde ele paga o próprio espaço. Abaixo de três blocos a
          seção inteira já cabe na tela e o índice vira ruído. */}
      {blocos.length >= 3 ? (
        <nav className="ds-lab-sumario" aria-label={`Blocos de ${titulo}`}>
          <p className="ds-lab-sumario-rotulo">Nesta seção</p>
          <ol>
            {blocos.map((bloco, indice) => (
              <li key={bloco.id}>
                <a href={`#${bloco.id}`}>
                  <span>{doisDigitos(indice + 1)}</span>
                  {bloco.titulo}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      {children}
    </div>
  );
}

export function Bloco({
  titulo,
  descricao,
  acoes,
  fundo,
  plano,
  arquivo,
  importar,
  id: idExplicito,
  children,
}: {
  titulo: string;
  descricao?: string;
  acoes?: React.ReactNode;
  /** `sunken` quando a demo tem superfície branca por dentro (card, tabela). */
  fundo?: "sunken";
  /** Demo que já traz a própria borda: o container não põe outra por fora. */
  plano?: boolean;
  /** Caminho do arquivo dentro de `components/onface`, ex.: "ds/DataGrid.tsx". */
  arquivo?: string;
  /** Linha de import pronta para colar, ex.: `import { DataGrid } from "…"`. */
  importar?: string;
  /** Âncora fixa. Sem ela o id sai do título — o que já é estável para leitura,
   * mas muda se alguém reescrever o título. Onde o link já foi divulgado, vale
   * fixar aqui. */
  id?: string;
  children: React.ReactNode;
}) {
  const id = idExplicito ?? idDeTitulo(titulo);
  const temMeta = Boolean(arquivo || importar);

  return (
    <section className="ds-bloco" id={id} data-ds-bloco={titulo}>
      <div className="ds-bloco-topo">
        <div className="ds-bloco-linha">
          {/* h3: abaixo do h2 da seção. A numeração vem de contador CSS, então
              ela continua certa mesmo quando os blocos estão dentro de um
              agrupador (Primitivas monta os blocos dentro de <Familia>). */}
          <h3 className="ds-bloco-titulo">
            {titulo}
            <a className="ds-bloco-ancora" href={`#${id}`} aria-label={`Link permanente para ${titulo}`}>
              <Link2 aria-hidden />
            </a>
          </h3>
          <span className="ds-fio" aria-hidden />
          {acoes ? <div className="ds-linha">{acoes}</div> : null}
        </div>
        {descricao ? <p className="ds-bloco-desc">{descricao}</p> : null}
      </div>

      <div
        className="ds-demo"
        data-fundo={fundo}
        data-plano={plano ? "true" : undefined}
        data-meta={temMeta ? "true" : undefined}
      >
        {children}
      </div>

      {temMeta ? <CaminhoDoCodigo arquivo={arquivo} importar={importar} /> : null}
    </section>
  );
}

/** Onde o componente mora e como importá-lo.
 *
 * É o plano rebaixado do bloco: a documentação acaba aqui e o código começa.
 * Sem isto, achar o arquivo depois de ver a demo era grep. */
function CaminhoDoCodigo({ arquivo, importar }: { arquivo?: string; importar?: string }) {
  async function copiar() {
    if (!importar) return;
    try {
      await navigator.clipboard.writeText(importar);
      toast.success("Import copiado");
    } catch {
      /* `navigator.clipboard` exige contexto seguro; quando ele não existe o
         certo é avisar, não falhar calado e o botão parecer quebrado. */
      toast.error("Não deu para copiar. Selecione a linha e copie na mão.");
    }
  }

  return (
    <div className="ds-bloco-meta">
      {arquivo ? (
        <span className="ds-bloco-arquivo">
          <FileCode2 aria-hidden />
          {arquivo}
        </span>
      ) : null}
      {importar ? (
        <>
          <code className="ds-bloco-import">{importar}</code>
          <button type="button" className="ds-bloco-copiar" onClick={copiar}>
            <Copy aria-hidden />
            Copiar import
          </button>
        </>
      ) : null}
    </div>
  );
}

export function Linha({ children, rotulo }: { children: React.ReactNode; rotulo?: string }) {
  return (
    <div className="ds-linha">
      {rotulo ? <span className="ds-rotulo-estado">{rotulo}</span> : null}
      {children}
    </div>
  );
}

export function Coluna({ children }: { children: React.ReactNode }) {
  return <div className="ds-coluna">{children}</div>;
}

export function Regras({
  faca,
  naoFaca,
}: {
  faca: { titulo: string; texto: string };
  naoFaca: { titulo: string; texto: string };
}) {
  return (
    <div className="ds-regras">
      <div className="ds-regra" data-tom="sim">
        <strong>Faça · {faca.titulo}</strong>
        {faca.texto}
      </div>
      <div className="ds-regra" data-tom="nao">
        <strong>Não faça · {naoFaca.titulo}</strong>
        {naoFaca.texto}
      </div>
    </div>
  );
}

/** Controle de playground. O componente ao lado precisa reagir de verdade:
 * documentação que só mostra print não prova que o estado existe. */
export function Chave({
  id,
  rotulo,
  valor,
  aoMudar,
}: {
  id: string;
  rotulo: string;
  valor: boolean;
  aoMudar: (v: boolean) => void;
}) {
  return (
    <span className="ds-controle">
      <Switch id={id} checked={valor} onCheckedChange={aoMudar} />
      <Label htmlFor={id} style={{ cursor: "pointer" }}>
        {rotulo}
      </Label>
    </span>
  );
}

export function Playground({ children }: { children: React.ReactNode }) {
  return <div className="ds-playground">{children}</div>;
}

/** Cartão de estado vazio, reaproveitado por várias seções. */
export function Vazio({
  icone,
  titulo,
  texto,
  acoes,
}: {
  icone: React.ReactNode;
  titulo: string;
  texto: string;
  acoes?: React.ReactNode;
}) {
  return (
    <div className="ds-vazio">
      <span className="ds-vazio-figura">{icone}</span>
      <strong>{titulo}</strong>
      <p>{texto}</p>
      {acoes ? <div className="ds-linha" style={{ marginTop: "var(--space-8)" }}>{acoes}</div> : null}
    </div>
  );
}
