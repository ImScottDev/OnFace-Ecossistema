"use client";

/** Seção "Fluxos" do laboratório.
 *
 * Abre pelo assistente de proposta porque é o que o produto mais precisa: hoje
 * a proposta do Callface é montada fora do CRM e volta como PDF, então o
 * assistente é a peça que fecha o buraco entre o negócio e o Documenso.
 *
 * Depois vêm os outros três tempos do mesmo trabalho: o que a operação executa
 * em dias (implantação), o que a máquina executa sozinha (automação) e o que o
 * time acompanha de cima (quadro). A ordem é essa de propósito: cada um é mais
 * longo e menos interativo que o anterior. */

import * as React from "react";
import { Bloco, Regras, Secao } from "../lab";
import { AssistenteProposta, CanvasAutomacao, OnboardingImplantacao } from "../fluxos";
import { Quadro } from "../Quadro";
import { NEGOCIOS, type Etapa, type Negocio } from "../dados";
import "../fluxos.css";

/** As seis etapas do funil, incluindo as duas de saída.
 *
 * A prop `etapas` do Quadro é tipada como `Etapa[]`, e `Etapa` é uma união
 * fechada em `dados.ts`. Então "seis estágios" aqui são os seis que o domínio
 * já tem, não seis nomes de implantação inventados para a demo. */
const SEIS_ETAPAS: Etapa[] = [
  "Qualificação",
  "Negociação",
  "Proposta",
  "Fechamento",
  "Ganho",
  "Perdido",
];

export function SecaoFluxos() {
  const [roadmap, setRoadmap] = React.useState<Negocio[]>(NEGOCIOS);

  return (
    <Secao
      titulo="Fluxos"
      chamada="Trabalho que tem ordem: montar uma proposta, implantar uma conta, deixar a automação rodando e acompanhar o que está de pé. Passo aqui não é tela bonita, é compromisso — quem avança sabe o que ficou decidido atrás, e quem volta não perde o que digitou."
    >
      <Bloco
        titulo="Assistente de proposta"
        descricao="Quatro passos à esquerda, a proposta montando ao vivo à direita. Mexa na quantidade de ramais ou no desconto e o total muda no mesmo instante. O avanço trava quando falta o mínimo do passo (apague a empresa, ou remova todos os itens, e o motivo aparece), e voltar não apaga nada."
        arquivo="ds/fluxos.tsx"
        importar={'import { AssistenteProposta } from "@/components/onface/ds/fluxos";'}
      >
        <AssistenteProposta />
      </Bloco>

      <Regras
        faca={{
          titulo: "O preview é o documento",
          texto:
            "O que está à direita é a proposta que o cliente recebe, montada do mesmo estado do formulário. Valor, desconto e total saem da conta, nunca de um número escrito à mão na demo. Se um campo não aparece no preview, ele não pertence ao assistente.",
        }}
        naoFaca={{
          titulo: "Passo que perde o passo anterior",
          texto:
            "Nada de remontar o formulário a cada avanço, nem de desabilitar o botão sem dizer por quê: botão apagado não explica o bloqueio e some da navegação por teclado. Quem volta encontra tudo como deixou; quem é barrado lê a frase que diz o que falta.",
        }}
      />

      <Bloco
        titulo="Onboarding de implantação"
        descricao="Implantação de PABX leva dias e troca de mão no meio, então o roteiro é vertical e persistente. À esquerda a lateral grafite com a identidade da conta e o campo do NEXO ganhando densidade a cada etapa concluída; à direita o que fazer agora. Conclua uma etapa e volte: o estado continua lá."
        arquivo="ds/fluxos.tsx"
        importar={'import { OnboardingImplantacao } from "@/components/onface/ds/fluxos";'}
        fundo="sunken"
      >
        <OnboardingImplantacao />
      </Bloco>

      <Regras
        faca={{
          titulo: "Um lado fixo, um lado que muda",
          texto:
            "A lateral carrega o que não muda durante a implantação (cliente, plano, progresso) e é onde a linguagem gráfica da marca aparece. O painel carrega só a etapa atual. Separar os dois é o que permite abrir a tela no terceiro dia e entender onde parou em um olhar.",
        }}
        naoFaca={{
          titulo: "Ordem como decoração",
          texto:
            "Se qualquer etapa pode ser marcada em qualquer ordem sem consequência, o stepper está mentindo sobre o processo. Etapa que depende de terceiro (portabilidade) mostra a dependência; etapa concluída pode ser reaberta, porque na operação real ela volta atrás.",
        }}
      />

      <Bloco
        titulo="Canvas de automação"
        descricao="A jornada do lead do Meta Ads até o WhatsApp do NEXO. Cada nó diz o que é (gatilho, condição, ação), de quem é, quanto tempo leva em média e como terminou a última execução. Clique num nó para acender o caminho que passa por ele."
        arquivo="ds/fluxos.tsx"
        importar={'import { CanvasAutomacao } from "@/components/onface/ds/fluxos";'}
      >
        <CanvasAutomacao />
      </Bloco>

      <Regras
        faca={{
          titulo: "Nó carrega a última execução",
          texto:
            "Dono, duração média e resultado da última rodada ficam no cartão, não escondidos num painel lateral. É por isso que alguém abre esta tela: para achar onde a automação está falhando ou custando tempo, sem abrir o log.",
        }}
        naoFaca={{
          titulo: "Diagrama por diagrama",
          texto:
            "Canvas sem dado de execução é desenho de arquitetura, não ferramenta de operação. E não se instala biblioteca de fluxo para isto: o layout é grid e os conectores são SVG medido a partir da posição real dos cartões. Arrastar nó entra quando o produto pedir edição de fluxo, não antes.",
        }}
      />

      <Bloco
        titulo="Quadro de implantação"
        descricao="Roadmap comercial em seis estágios, usando o Quadro que já existe: mesmo componente, mesma escrita de negócio, mesma acessibilidade de arraste por teclado. Aqui ele recebe as seis etapas do funil em vez das quatro de trabalho, incluindo as duas de saída."
        arquivo="ds/Quadro.tsx"
        importar={'import { Quadro } from "@/components/onface/ds/Quadro";'}
        fundo="sunken"
      >
        {/* `fx-quadro` só ajusta a contagem de colunas: `quadro.css` fixa quatro
            e este recorte tem seis. É estilo, não um segundo componente. */}
        <div className="fx-quadro">
          <Quadro negocios={roadmap} etapas={SEIS_ETAPAS} aoMudar={setRoadmap} />
        </div>
      </Bloco>

      <Regras
        faca={{
          titulo: "Reusar o Quadro, mudar só as etapas",
          texto:
            "O Quadro já é controlado (`negocios` + `aoMudar`) e já aceita outra lista de etapas. Uma visão nova de kanban é uma lista de etapas e um estado diferentes, nunca uma cópia do componente: duplicar traria junto a cópia do arraste, dos anúncios de leitor de tela e do desfazer.",
        }}
        naoFaca={{
          titulo: "Forçar campo que o domínio não tem",
          texto:
            "Limitação registrada, não contornada: o cartão não mostra peso porque `Negocio` não tem esse campo, e as etapas são as do funil porque `Etapa` é união fechada em `dados.ts`. Peso e etapas de implantação exigem mexer em `dados.ts` e em `Quadro.tsx`, que são de outra equipe. Até lá, documenta-se a falta em vez de inventar um quadro paralelo.",
        }}
      />
    </Secao>
  );
}
