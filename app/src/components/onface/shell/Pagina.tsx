import type { ReactNode } from "react";
import Link from "next/link";
import "./pagina.css";

/**
 * Estrutura de página do ONFACE.
 *
 * Substitui o par faixa-grafite + canvas-branco. Aquele desenho nasceu quando
 * a casca tinha topbar grafite e a faixa era a continuação dela. Com a casca
 * em papel, a faixa virou uma laje escura no meio da tela, e o conteúdo caía
 * num contêiner branco dentro de outro contêiner branco.
 *
 * Três decisões que valem para toda tela:
 *
 * 1. **O título não repete a trilha.** A topbar já diz "Comercial / Pipeline"
 *    (§1.2 proíbe a repetição). O cabeçalho aqui é compacto e existe para
 *    carregar a AÇÃO primária, não para anunciar de novo onde a pessoa está.
 *    O `h1` continua no documento pela semântica.
 *
 * 2. **Resumo tem hierarquia.** Quatro caixas do mesmo tamanho não informam
 *    nada: se tudo tem o mesmo peso, o olho não sabe onde pousar. Aqui existe
 *    um valor de destaque e os demais recuam. Um número que pede ação é
 *    `sinal` e vira coral clicável — o número deixa de ser enfeite e vira o
 *    filtro que resolve o problema que ele acusa.
 *
 * 3. **Sem contêiner extra.** A página é a superfície. Card dentro de card é
 *    proibido pelo piso de qualidade e o detector pega.
 */
export function Pagina({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className ? `onface-pagina ${className}` : "onface-pagina"}>
      {children}
    </div>
  );
}

/**
 * Cabeçalho compacto: identidade da página à esquerda, ação primária à direita.
 *
 * `descricao` é opcional de propósito. A direção proíbe "todos os títulos
 * acompanhados por descrição desnecessária": só passe uma quando ela disser
 * algo que o título não diz, como uma regra de domínio que muda a leitura da
 * tela.
 */
export function PaginaCabecalho({
  titulo,
  descricao,
  acoes,
}: {
  titulo: string;
  descricao?: string;
  acoes?: ReactNode;
}) {
  return (
    <header className="onface-pagina-cabecalho">
      <div className="onface-pagina-identidade">
        <h1 className="onface-pagina-titulo">{titulo}</h1>
        {descricao ? (
          <p className="onface-pagina-descricao">{descricao}</p>
        ) : null}
      </div>
      {acoes ? <div className="onface-pagina-acoes">{acoes}</div> : null}
    </header>
  );
}

export type ItemResumo = {
  rotulo: string;
  valor: string | number;
  /** Uma linha curta abaixo do valor. Só quando explica algo que o rótulo não
   * explica — não repita o rótulo em outras palavras. */
  detalhe?: string;
  /** O valor que domina o bloco. Um por resumo: dois destaques é nenhum. */
  destaque?: boolean;
  /** Número que acusa um problema. Fica coral e, com `href`, vira o recorte
   * que resolve o problema. Se o valor for zero, o sinal se apaga sozinho:
   * "0 sem próxima ação" é boa notícia, não alerta. */
  sinal?: boolean;
  href?: string;
  /** Torna a coluna um filtro da própria tela.
   *
   * É o caso do CS: "Em risco 7" não é enfeite, é o recorte da fila. Com
   * `href` o número LEVA a outro lugar; com `aoSelecionar` ele RECORTA aqui,
   * preservando o contexto — que é o que a spec pede de Quick View. Os dois
   * juntos não fazem sentido, e `aoSelecionar` vence. */
  aoSelecionar?: () => void;
  /** Recorte vigente. Só com `aoSelecionar`. */
  ativo?: boolean;
};

/**
 * Faixa de resumo com hierarquia.
 *
 * Não é um grid de cards. É uma linha de fatos onde um domina, os outros
 * apoiam e os que pedem ação são clicáveis.
 */
export function PaginaResumo({ itens }: { itens: ItemResumo[] }) {
  return (
    <section className="onface-resumo" aria-label="Resumo da página">
      {itens.map((item) => {
        const acusa = Boolean(item.sinal) && Number(item.valor) !== 0;
        const conteudo = (
          <>
            <span className="onface-resumo-rotulo">{item.rotulo}</span>
            <strong className="onface-resumo-valor">{item.valor}</strong>
            {item.detalhe ? (
              <span className="onface-resumo-detalhe">{item.detalhe}</span>
            ) : null}
          </>
        );

        const props = {
          className: "onface-resumo-item",
          "data-destaque": item.destaque ? "true" : undefined,
          "data-sinal": acusa ? "true" : undefined,
        };

        // Filtro da própria tela: o recorte acontece aqui, sem trocar de rota.
        // `aria-pressed` e não `aria-selected` porque cada coluna liga e
        // desliga sozinha — não é uma lista onde só um pode estar escolhido.
        if (item.aoSelecionar) {
          return (
            <button
              key={item.rotulo}
              type="button"
              onClick={item.aoSelecionar}
              aria-pressed={Boolean(item.ativo)}
              {...props}
              data-ativo={item.ativo ? "true" : undefined}
            >
              {conteudo}
            </button>
          );
        }

        // Sinal com destino vira o recorte. Sem destino, continua sendo só a
        // leitura — nunca um link que não leva a lugar nenhum.
        return item.href && acusa ? (
          <Link key={item.rotulo} href={item.href} {...props}>
            {conteudo}
            <span className="onface-resumo-cta">Ver estas</span>
          </Link>
        ) : (
          <div key={item.rotulo} {...props}>
            {conteudo}
          </div>
        );
      })}
    </section>
  );
}
