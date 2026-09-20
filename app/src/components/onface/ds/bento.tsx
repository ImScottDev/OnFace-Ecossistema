"use client";

/** Sistema de layout do ONFACE.
 *
 * Existe porque toda tela do produto estava virando a mesma coisa: título,
 * quatro cartões do mesmo tamanho e uma tabela embaixo. Isso não é layout, é
 * a ausência de uma decisão de hierarquia — quando tudo tem o mesmo peso, o
 * operador precisa ler tudo para descobrir o que importa.
 *
 * Três peças cobrem a maioria das telas:
 *   Bento + BentoCartao — grade de 4 colunas com cartões de tamanhos diferentes.
 *   MestreDetalhe       — lista de um lado, registro do outro.
 *   PainelDividido      — dois painéis com divisor que o usuário move.
 *
 * Nenhuma delas conhece o domínio. Quem sabe o que é negócio, conversa e
 * atividade é a tela que compõe; aqui só existe estrutura. */

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import "./layouts.css";

/* ═══ Compacto ════════════════════════════════════════════════════════════
   O corte de 760 é o mesmo do ds.css. Ele está aqui em JS porque no telefone
   não basta esconder o painel de detalhe: ele precisa virar outra coisa (uma
   gaveta), e isso é troca de componente, não de CSS. Começa em `false` para
   o servidor e o cliente renderizarem a mesma árvore no primeiro paint. */
function useCompacto(): boolean {
  const [compacto, setCompacto] = React.useState(false);

  React.useEffect(() => {
    const consulta = window.matchMedia("(max-width: 760px)");
    const aplicar = () => setCompacto(consulta.matches);
    aplicar();
    consulta.addEventListener("change", aplicar);
    return () => consulta.removeEventListener("change", aplicar);
  }, []);

  return compacto;
}

/* ═══ Bento ═══════════════════════════════════════════════════════════════ */

export type SpanBento = "normal" | "larga" | "cheia";

export function Bento({
  children,
  /** `escuro` quando a grade vive sobre a casca grafite (faixa de topo, TV de
   *  operação). Número e rótulo vão bem ali; gráfico não vai, e por isso a
   *  versão escura recebe só métrica. */
  tom,
  rotulo,
}: {
  children: React.ReactNode;
  tom?: "escuro";
  /** Dá nome à região para leitor de tela quando a grade é a tela inteira. */
  rotulo?: string;
}) {
  return (
    <div
      className="ds-bento lay-bento"
      data-tom={tom}
      role={rotulo ? "region" : undefined}
      aria-label={rotulo}
    >
      {children}
    </div>
  );
}

type BaseCartao = {
  titulo?: string;
  apoio?: string;
  span?: SpanBento;
  /** Ocupa duas linhas da grade. Serve para conteúdo naturalmente alto:
   *  histórico, lista longa, gráfico vertical. */
  alta?: boolean;
  /** Slot herói: o cartão que responde a pergunta da tela. Não muda de cor —
   *  domina por escala, peso e espaço, que é o contraste que sobra depois que
   *  a paleta já está decidida. Um por composição; dois heróis é nenhum. */
  destaque?: boolean;
  tom?: "escuro";
  /** `false` quando o filho já é uma superfície (Metrica, tabela, gráfico com
   *  moldura). Sem isto sai borda dentro de borda. */
  superficie?: boolean;
  children?: React.ReactNode;
};

/* O cartão clicável não pode receber `acao`: botão dentro de botão não é
   alcançável por teclado e o leitor de tela anuncia um alvo só. O tipo impede
   a combinação em vez de deixar o bug aparecer no navegador. */
export type PropsBentoCartao =
  | (BaseCartao & { aoAbrir: () => void; rotuloAcesso?: string; acao?: never })
  | (BaseCartao & { aoAbrir?: undefined; rotuloAcesso?: never; acao?: React.ReactNode });

export function BentoCartao({
  titulo,
  apoio,
  span = "normal",
  alta = false,
  destaque = false,
  tom,
  superficie = true,
  aoAbrir,
  rotuloAcesso,
  acao,
  children,
}: PropsBentoCartao) {
  const classes = [
    superficie ? "ds-bento-cartao" : "lay-cartao-nu",
    "lay-cartao",
    span === "larga" ? "ds-bento-larga" : "",
    span === "cheia" ? "ds-bento-cheia" : "",
    alta ? "ds-bento-alta" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const cabecalho = titulo ? (
    <header className="lay-cartao-topo">
      <span className="lay-cartao-identidade">
        <strong>{titulo}</strong>
        {apoio ? <small>{apoio}</small> : null}
      </span>
      {acao}
    </header>
  ) : null;

  const destaqueAttr = destaque ? "true" : undefined;

  if (aoAbrir) {
    return (
      <button
        type="button"
        className={classes}
        data-tom={tom}
        data-destaque={destaqueAttr}
        data-interativo="true"
        aria-label={rotuloAcesso ?? titulo}
        onClick={aoAbrir}
      >
        {cabecalho}
        {children}
      </button>
    );
  }

  return (
    <div className={classes} data-tom={tom} data-destaque={destaqueAttr}>
      {cabecalho}
      {children}
    </div>
  );
}

/* ═══ Mestre-detalhe ══════════════════════════════════════════════════════ */

export type PropsMestreDetalhe<T> = {
  itens: T[];
  chave: (item: T) => string;
  /** Nome curto do item, usado no título da gaveta no telefone. */
  titulo: (item: T) => string;
  resumo: (item: T, selecionado: boolean) => React.ReactNode;
  detalhe: (item: T) => React.ReactNode;
  /** Nome da lista para leitor de tela: "Conversas", "Negócios". */
  rotuloLista: string;
  cabecalhoLista?: React.ReactNode;
  /** O que ocupa o painel enquanto nada está selecionado. Painel branco sem
   *  explicação parece tela quebrada. */
  vazio: React.ReactNode;
  aoSelecionar?: (item: T | null) => void;
};

export function MestreDetalhe<T>({
  itens,
  chave,
  titulo,
  resumo,
  detalhe,
  rotuloLista,
  cabecalhoLista,
  vazio,
  aoSelecionar,
}: PropsMestreDetalhe<T>) {
  const [selecionado, setSelecionado] = React.useState<string | null>(null);
  const compacto = useCompacto();

  const item = itens.find((candidato) => chave(candidato) === selecionado) ?? null;

  function selecionar(alvo: T | null) {
    setSelecionado(alvo ? chave(alvo) : null);
    aoSelecionar?.(alvo);
  }

  /* Seta anda na lista sem sair dela. Numa caixa de entrada com 40 conversas,
     tabular item por item até o painel é caminho longo demais. */
  function navegar(evento: React.KeyboardEvent<HTMLDivElement>) {
    if (evento.key !== "ArrowDown" && evento.key !== "ArrowUp") return;
    const botoes = Array.from(
      evento.currentTarget.querySelectorAll<HTMLButtonElement>("[data-lay-item]"),
    );
    const atual = botoes.indexOf(document.activeElement as HTMLButtonElement);
    if (atual < 0 || botoes.length === 0) return;
    evento.preventDefault();
    const passo = evento.key === "ArrowDown" ? 1 : -1;
    botoes[(atual + passo + botoes.length) % botoes.length]?.focus();
  }

  return (
    <div className="lay-md">
      <div className="lay-md-coluna">
        {cabecalhoLista ? <div className="lay-md-cabecalho">{cabecalhoLista}</div> : null}
        <div className="lay-md-lista" role="list" aria-label={rotuloLista} onKeyDown={navegar}>
          {itens.map((candidato) => {
            const id = chave(candidato);
            const ativo = id === selecionado;
            return (
              <div role="listitem" key={id}>
                <button
                  type="button"
                  data-lay-item
                  className="lay-md-item"
                  aria-current={ativo ? "true" : undefined}
                  onClick={() => selecionar(candidato)}
                >
                  {resumo(candidato, ativo)}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* No desktop o detalhe é painel. No telefone ele existe só dentro da
          gaveta, e o CSS esconde este lado para não renderizar dois. */}
      <div className="lay-md-detalhe">{item ? detalhe(item) : vazio}</div>

      <Sheet
        open={compacto && item !== null}
        onOpenChange={(aberta) => {
          if (!aberta) selecionar(null);
        }}
      >
        <SheetContent side="bottom" className="lay-md-gaveta">
          <SheetHeader className="lay-md-gaveta-topo">
            <SheetTitle>{item ? titulo(item) : rotuloLista}</SheetTitle>
            <SheetDescription>Detalhe do item selecionado na lista.</SheetDescription>
          </SheetHeader>
          <div className="lay-md-gaveta-corpo">{item ? detalhe(item) : null}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ═══ Painel dividido ═════════════════════════════════════════════════════ */

function limitar(valor: number, minimo: number, maximo: number) {
  return Math.min(maximo, Math.max(minimo, valor));
}

export type PropsPainelDividido = {
  inicio: React.ReactNode;
  fim: React.ReactNode;
  rotuloInicio: string;
  rotuloFim: string;
  /** Largura inicial do painel da esquerda, em porcentagem do container. */
  proporcao?: number;
  minimo?: number;
  maximo?: number;
  rotuloDivisor?: string;
};

/** Dois painéis com divisor arrastável.
 *
 * Editor e prévia de documento, conversa e ficha do cliente no atendimento:
 * são telas em que ninguém concorda com uma proporção fixa. Quem escreve quer
 * o editor largo; quem confere quer a prévia larga. O divisor devolve essa
 * decisão para a pessoa em vez de o design escolher por ela.
 *
 * O arraste é `pointer`, não `mouse`: o mesmo código atende mouse, caneta e
 * toque. `setPointerCapture` mantém o evento no divisor mesmo quando o
 * ponteiro corre mais rápido que o layout e sai de cima dele.
 * Teclado é obrigatório aqui, não cortesia: divisor só com arraste é uma
 * funcionalidade que não existe para quem não usa ponteiro. */
export function PainelDividido({
  inicio,
  fim,
  rotuloInicio,
  rotuloFim,
  proporcao = 50,
  minimo = 25,
  maximo = 75,
  rotuloDivisor = "Ajustar largura dos painéis",
}: PropsPainelDividido) {
  const [percentual, setPercentual] = React.useState(() => limitar(proporcao, minimo, maximo));
  const [arrastando, setArrastando] = React.useState(false);
  const caixa = React.useRef<HTMLDivElement>(null);
  const idInicio = React.useId();

  function moverPara(clientX: number) {
    const area = caixa.current?.getBoundingClientRect();
    if (!area || area.width === 0) return;
    setPercentual(limitar(((clientX - area.left) / area.width) * 100, minimo, maximo));
  }

  function porTeclado(evento: React.KeyboardEvent<HTMLDivElement>) {
    // Passo curto para ajuste fino; com Shift, o passo grosso de quem só quer
    // "mais espaço aqui" sem apertar a seta doze vezes.
    const passo = evento.shiftKey ? 10 : 2;
    const mapa: Record<string, number | undefined> = {
      ArrowLeft: percentual - passo,
      ArrowRight: percentual + passo,
      Home: minimo,
      End: maximo,
    };
    const destino = mapa[evento.key];
    if (destino === undefined) return;
    evento.preventDefault();
    setPercentual(limitar(destino, minimo, maximo));
  }

  return (
    <div
      ref={caixa}
      className="lay-split"
      data-arrastando={arrastando ? "true" : undefined}
      style={{ "--lay-split": `${percentual}%` } as React.CSSProperties}
    >
      <section className="lay-split-painel" id={idInicio} aria-label={rotuloInicio}>
        <p className="lay-split-rotulo">{rotuloInicio}</p>
        <div className="lay-split-corpo">{inicio}</div>
      </section>

      <div
        className="lay-split-divisor"
        role="separator"
        aria-orientation="vertical"
        aria-label={rotuloDivisor}
        aria-controls={idInicio}
        aria-valuenow={Math.round(percentual)}
        aria-valuemin={minimo}
        aria-valuemax={maximo}
        tabIndex={0}
        onKeyDown={porTeclado}
        onPointerDown={(evento) => {
          evento.currentTarget.setPointerCapture(evento.pointerId);
          setArrastando(true);
        }}
        onPointerMove={(evento) => {
          if (arrastando) moverPara(evento.clientX);
        }}
        onPointerUp={(evento) => {
          evento.currentTarget.releasePointerCapture(evento.pointerId);
          setArrastando(false);
        }}
        onLostPointerCapture={() => setArrastando(false)}
        // Volta ao ponto de partida sem obrigar a mirar a proporção original.
        onDoubleClick={() => setPercentual(limitar(proporcao, minimo, maximo))}
      />

      <section className="lay-split-painel" data-lado="fim" aria-label={rotuloFim}>
        <p className="lay-split-rotulo">{rotuloFim}</p>
        <div className="lay-split-corpo">{fim}</div>
      </section>
    </div>
  );
}
