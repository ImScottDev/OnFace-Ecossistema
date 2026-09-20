"use client";

/** Seção Quadro do laboratório.
 *
 * Documentação de kanban só prova alguma coisa se o cartão se mover: aqui o
 * quadro é o componente real, com estado real. Arraste, solte, reordene — o
 * que ficar na tela continua lá quando você mexer no playground. */

import * as React from "react";
import { Bloco, Chave, Playground, Regras, Secao } from "../lab";
import { Quadro } from "../Quadro";
import { ETAPAS_QUADRO, NEGOCIOS, brl, type Negocio } from "../dados";

/** Só o funil de trabalho entra no quadro. Ganho e Perdido são saída, não
 *  coluna: cartão que chega lá não volta a ser arrastado. */
const DO_FUNIL = NEGOCIOS.filter((n) => ETAPAS_QUADRO.includes(n.etapa));

export function SecaoQuadro() {
  const [negocios, setNegocios] = React.useState<Negocio[]>(DO_FUNIL);
  const [mostrarValor, setMostrarValor] = React.useState(true);
  const [marcarUrgentes, setMarcarUrgentes] = React.useState(true);

  /* Board reduzido só para mostrar a coluna sem cartão. Estado próprio: mexer
     aqui não pode bagunçar o quadro de cima. */
  const [enxuto, setEnxuto] = React.useState<Negocio[]>(() =>
    DO_FUNIL.filter((n) => n.etapa === "Qualificação").slice(0, 2),
  );

  const total = negocios.reduce((soma, n) => soma + n.valor, 0);

  return (
    <Secao
      titulo="Quadro"
      chamada="O funil visto de lado. Mesmo dado da lista, outra leitura: em vez de comparar linha por linha, o vendedor vê onde o dinheiro está parado e empurra o cartão para a frente."
    >
      <Bloco
        titulo="Quadro de negócios"
        descricao={`Arraste entre colunas e dentro da coluna. Clique no cartão para abrir a gaveta, Enter faz o mesmo pelo teclado. Contagem e soma de cada etapa saem do estado, não de um número escrito à mão: ${brl(total)} em ${negocios.length} negócios no funil.`}
      >
        <Playground>
          <Chave
            id="qd-valor"
            rotulo="Mostrar valor no cartão"
            valor={mostrarValor}
            aoMudar={setMostrarValor}
          />
          <Chave
            id="qd-urgentes"
            rotulo="Marcar urgentes"
            valor={marcarUrgentes}
            aoMudar={setMarcarUrgentes}
          />
        </Playground>

        <div style={{ marginTop: "var(--space-16)" }}>
          <Quadro
            negocios={negocios}
            aoMudar={setNegocios}
            mostrarValor={mostrarValor}
            marcarUrgentes={marcarUrgentes}
          />
        </div>
      </Bloco>

      <Bloco
        titulo="Coluna vazia"
        descricao="Coluna sem cartão continua sendo alvo de soltura e diz o que fazer, em vez de virar um buraco no layout. Arraste um dos dois cartões para qualquer etapa e ela volta a se preencher."
      >
        <Quadro negocios={enxuto} aoMudar={setEnxuto} marcarUrgentes={false} />
      </Bloco>

      <Regras
        faca={{
          titulo: "Mesmo dado da lista",
          texto:
            "O cartão carrega os mesmos badges, o mesmo responsável e o mesmo valor da linha correspondente na lista. Trocar de visão troca o formato de leitura, nunca o conteúdo: o filtro aplicado na lista continua valendo no quadro.",
        }}
        naoFaca={{
          titulo: "Quadro com verdade própria",
          texto:
            "Nada de etapa que só existe aqui, badge inventado para o cartão ou total somado de outro jeito. Arrastar é escrita de negócio, com aviso e desfazer, não um ajuste visual que a lista não enxerga.",
        }}
      />
    </Secao>
  );
}
