"use client";

/** Linguagem gráfica do ONFACE.
 *
 * Um só sistema de fundo, não cinquenta SVGs soltos: `FundoGrafico` com
 * variante. Todo desenho sai de duas formas que a marca já tem — a malha
 * hairline e o arco do "O" — e de nenhuma cor fora dos tokens.
 *
 * Onde usar: momento que decide alguma coisa (centro de comando, NEXO
 * processando, conclusão, proposta, vazio importante). Onde não usar: tela
 * operacional. É o contraste entre as duas que faz o momento existir; se todo
 * lugar tiver fundo, nenhum lugar tem. */

import * as React from "react";
import "./marca.css";

export type VarianteFundo = "malha" | "pontos" | "arcos" | "conexoes";

export function FundoGrafico({
  variante = "malha",
  superficie = "escura",
  intensidade = "padrao",
  halo = false,
}: {
  variante?: VarianteFundo;
  superficie?: "clara" | "escura";
  intensidade?: "apagada" | "padrao" | "media";
  /** Iluminação coral localizada. Só no ponto focal, nunca na tela toda. */
  halo?: boolean;
}) {
  return (
    <div
      className="ds-fundo"
      data-variante={variante}
      data-superficie={superficie}
      data-intensidade={intensidade}
      data-halo={halo ? "true" : undefined}
      aria-hidden
    >
      {variante === "conexoes" ? <MalhaDeConexoes /> : null}
    </div>
  );
}

/** Nós ligados por caminhos: automação, jornada, integração. Geometria fixa
 * (nada de Math.random) para o fundo não "piscar" entre renders. */
function MalhaDeConexoes() {
  const nos = [
    [8, 30], [22, 14], [22, 52], [38, 34], [54, 18], [54, 56], [70, 38], [86, 22], [86, 60],
  ] as const;
  const ligacoes = [
    [0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [3, 5], [4, 6], [5, 6], [6, 7], [6, 8],
  ] as const;
  return (
    <svg className="ds-fundo-svg" viewBox="0 0 100 70" preserveAspectRatio="xMidYMid slice">
      {ligacoes.map(([a, b], i) => (
        <line
          key={`l-${i}`}
          x1={nos[a][0]} y1={nos[a][1]} x2={nos[b][0]} y2={nos[b][1]}
          className={i === 3 || i === 8 ? "ds-fundo-caminho-acento" : undefined}
        />
      ))}
      {nos.map(([x, y], i) => (
        <circle key={`n-${i}`} cx={x} cy={y} r={i === 3 ? 1.8 : 1.2} className={i === 3 ? "ds-fundo-no-acento" : undefined} />
      ))}
    </svg>
  );
}

/** Campo do NEXO: a assinatura visual da IA do produto.
 *
 * Não é loader genérico nem "blob de IA": é a mesma malha de nós do resto do
 * sistema convergindo para um núcleo coral. Serve para escutando, pensando,
 * buscando, analisando, executando — o estágio muda quantos nós estão ativos,
 * não a cor. */
export function CampoNexo({
  estagio = "pensando",
  superficie = "escura",
  altura = 120,
}: {
  estagio?: "ocioso" | "escutando" | "pensando" | "buscando" | "analisando" | "executando" | "concluido";
  superficie?: "clara" | "escura";
  /** Altura em unidades de desenho (u), não px. */
  altura?: number;
}) {
  const animando = estagio !== "ocioso" && estagio !== "concluido";
  const intensidade: Record<string, number> = {
    ocioso: 0, escutando: 2, pensando: 4, buscando: 6, analisando: 8, executando: 9, concluido: 9,
  };
  const ativos = intensidade[estagio] ?? 4;

  const nos = [
    [10, 24], [24, 10], [24, 40], [40, 18], [40, 34], [58, 12], [58, 40], [74, 24], [88, 16], [88, 34],
  ] as const;
  const ligacoes = [
    [0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [4, 6], [3, 7], [4, 7], [5, 8], [6, 9], [7, 8], [7, 9],
  ] as const;

  return (
    <span
      className="ds-campo-nexo"
      data-superficie={superficie}
      data-animando={animando ? "true" : "false"}
      style={{ height: `calc(${altura} * var(--onface-u))` }}
      role="img"
      aria-label={`NEXO ${estagio}`}
    >
      <svg viewBox="0 0 100 50" preserveAspectRatio="xMidYMid meet" style={{ height: "100%" }}>
        {ligacoes.map(([a, b], i) => (
          <path
            key={`c-${i}`}
            d={`M ${nos[a][0]} ${nos[a][1]} L ${nos[b][0]} ${nos[b][1]}`}
            className={i < ativos ? "caminho caminho-ativo" : "caminho"}
          />
        ))}
        {nos.map(([x, y], i) => (
          <circle key={`p-${i}`} cx={x} cy={y} r="2" className={i < ativos ? "no no-ativo" : "no"} />
        ))}
        {/* Núcleo: para onde tudo converge. É o único elemento sempre coral. */}
        <circle cx="74" cy="24" r="3.4" className="nucleo" />
      </svg>
    </span>
  );
}

/** Momento expressivo: superfície grafite com fundo gráfico.
 *
 * Existe para carregar decisão, não enfeite. Se o bloco não muda o que a
 * pessoa vai fazer em seguida, ele não é um momento — é um card comum. */
export function Momento({
  rotulo,
  titulo,
  apoio,
  variante = "arcos",
  halo = true,
  acoes,
  children,
}: {
  rotulo?: string;
  titulo: string;
  apoio?: string;
  variante?: VarianteFundo;
  halo?: boolean;
  acoes?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="ds-momento">
      <FundoGrafico variante={variante} superficie="escura" halo={halo} />
      {rotulo ? <p className="ds-momento-rotulo">{rotulo}</p> : null}
      <h3 className="ds-momento-titulo">{titulo}</h3>
      {apoio ? <p className="ds-momento-apoio">{apoio}</p> : null}
      {children}
      {acoes ? <div className="ds-linha" style={{ marginTop: "var(--space-20)" }}>{acoes}</div> : null}
    </section>
  );
}
