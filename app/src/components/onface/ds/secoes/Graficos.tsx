"use client";

/** Seção "Gráficos" do laboratório.
 *
 * A seção abre pelo assunto — a métrica herói — e só depois vem o playground,
 * junto dos gráficos que ele controla. Abrir por uma barra de controles fazia
 * a documentação começar pela ferramenta em vez do conteúdo, e nenhuma outra
 * seção operacional começa assim: "Dados" abre por resumo, sinal e ação.
 *
 * Os três estados (dado, carregando, vazio) continuam num playground só: o
 * que interessa não é cada gráfico isolado, é ver os seis trocarem de estado
 * juntos, que é o que acontece quando um filtro do painel muda. Documentação
 * que só mostra o caso feliz esconde exatamente o estado que o time esquece
 * de implementar. */

import * as React from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Bloco, Chave, Playground, Regras, Secao } from "../lab";
import { FundoGrafico } from "../marca";
import {
  AreaComparativa, BarrasPorEtapa, FunilComercial, MetaPorResponsavel, Minitendencia, RoscaOrigem,
} from "../graficos";
import {
  AdocaoRadial, AreaSimples, BarrasInterativas, CascataDoFunil, LinhasPorCanal,
  MapaDeContato, RadarDesempenho, RadarGradeCircular, VolumeEConversao,
} from "../graficos-avancados";
import {
  AlocacaoDoFunil, AssinaturasPorPlano, EntradasPorOrigem, PaineisDeArco,
} from "../graficos-medidores";
import {
  AreaEmDegrau, AreaHachurada, FunilNoTempo, PainelOperacaoEscuro,
  RadarGradiente, RankingHorizontal, SaldoComReferencia,
} from "../graficos-series";
import { compacto, RECEITA_SEMANAL } from "../dados";

const TOTAL_ATUAL = RECEITA_SEMANAL.reduce((soma, ponto) => soma + ponto.atual, 0);
const TOTAL_ANTERIOR = RECEITA_SEMANAL.reduce((soma, ponto) => soma + ponto.anterior, 0);
const VARIACAO = Math.round((TOTAL_ATUAL / TOTAL_ANTERIOR - 1) * 100);
const SERIE_MINI = RECEITA_SEMANAL.map((ponto) => ponto.atual);
const RESUMO_MINI = `Receita ganha nas últimas 12 semanas, ${
  VARIACAO > 0 ? "alta" : "queda"
} de ${Math.abs(VARIACAO)}% sobre o período anterior`;

export function SecaoGraficos() {
  const [carregando, setCarregando] = React.useState(false);
  const [vazio, setVazio] = React.useState(false);

  // `undefined` deixa o componente cair no próprio dado padrão, então o
  // playground não precisa saber o formato de cada série.
  const semDado = vazio ? [] : undefined;

  return (
    <Secao
      titulo="Gráficos"
      chamada="Seis formas, uma disciplina de cor: coral é a série que a pessoa veio ver, o resto é apoio em cinza. Todo gráfico daqui tem os três estados que acontecem em produção, e o tooltip fala em real, não em número solto."
    >
      {/* Métrica herói: a seção precisa de um ponto de entrada, e ele é o
          assunto, não o controle. Grafite + número em escala grande decidem
          onde o olho começa; os gráficos abaixo são a apuração, não a
          manchete. Mesmo papel do resumo que abre "Dados". */}
      <section className="of-g-hero">
        <FundoGrafico variante="malha" superficie="escura" halo />
        <div className="of-g-hero-conteudo">
          <div>
            <p className="of-g-hero-rotulo">Receita ganha · 12 semanas</p>
            <p className="of-g-hero-numero">{vazio ? "—" : compacto(TOTAL_ATUAL)}</p>
            <p className="of-g-hero-apoio">
              {vazio
                ? "Nenhum negócio ganho no intervalo selecionado."
                : `contra ${compacto(TOTAL_ANTERIOR)} no intervalo anterior`}
            </p>
          </div>
          <div className="of-g-hero-tendencia">
            <p className="of-g-hero-legenda">
              <span>Semana a semana</span>
              {vazio ? null : (
                <span className="of-g-hero-delta" data-sentido={VARIACAO < 0 ? "queda" : "alta"}>
                  {VARIACAO < 0 ? <TrendingDown aria-hidden /> : <TrendingUp aria-hidden />}
                  {VARIACAO > 0 ? "+" : ""}
                  {VARIACAO}%
                </span>
              )}
            </p>
            <Minitendencia
              dados={vazio ? [] : SERIE_MINI}
              rotulo={RESUMO_MINI}
              carregando={carregando}
            />
          </div>
        </div>
      </section>

      {/* O playground desce para cá: ele governa os seis gráficos que vêm
          abaixo, então mora junto deles. Tracejado e rotulado para não ser
          confundido com controle de produto. */}
      <div className="ds-play-meta">
        <span>Controles da documentação · valem para os seis gráficos</span>
        <Playground>
          <Chave id="g-carregando" rotulo="Carregando" valor={carregando} aoMudar={setCarregando} />
          <Chave id="g-vazio" rotulo="Sem dados" valor={vazio} aoMudar={setVazio} />
        </Playground>
      </div>

      <Bloco
        titulo="Área comparativa"
        descricao="Receita ganha por semana contra o mesmo intervalo anterior. A série atual é coral com preenchimento; o período anterior é linha tracejada cinza, porque ele é régua e não assunto. O tooltip mostra as duas e a legenda vem do próprio config do gráfico."
      >
        <AreaComparativa dados={semDado} carregando={carregando} />
      </Bloco>

      {/* Dois a dois: quem lê "onde estão os negócios" lê logo em seguida "de
          onde eles vieram". Seis blocos de largura cheia em fila viram rolagem
          sem ritmo, e todo gráfico acaba com o mesmo peso. */}
      <div className="of-g-par">
        <Bloco
          titulo="Barras por etapa"
          descricao="Quantidade de negócios por etapa do funil. A altura é a quantidade; o valor em aberto vive no tooltip, porque dezenas e centenas de milhares no mesmo eixo achatam uma das duas leituras."
        >
          <BarrasPorEtapa dados={semDado} carregando={carregando} />
        </Bloco>

        <Bloco
          titulo="Rosca de origem"
          descricao="Participação de cada origem no pipeline. Coral fica com a origem líder, calculada no dado; as outras descem uma escada de cinza. O centro mostra o total e vira a fatia quando o ponteiro, o foco ou o toque entra nela."
        >
          <RoscaOrigem dados={semDado} carregando={carregando} />
        </Bloco>
      </div>

      <Bloco
        titulo="Funil comercial"
        descricao="Largura proporcional à quantidade da etapa e a taxa de passagem entre elas. Abaixo de 50% a passagem é marcada como gargalo. Clique em uma etapa para abrir o ticket médio dela. Ganho fica fora: não é a passagem da mesma coorte, e a taxa sairia acima de 100%."
      >
        <FunilComercial dados={semDado} carregando={carregando} />
      </Bloco>

      <div className="of-g-par">
        <Bloco
          titulo="Minitendência dentro de KPI"
          descricao="Sparkline sem eixo, grade ou tooltip: ela responde 'subiu ou caiu', e o número exato é o KPI logo acima. Entra como imagem com rótulo para o leitor de tela receber a conclusão, não doze pontos soltos."
          fundo="sunken"
        >
          <div className="ds-metrica" style={{ maxWidth: "calc(280 * var(--onface-u))" }}>
            <div className="ds-metrica-topo">
              <span className="ds-metrica-rotulo">Receita ganha</span>
            </div>
            <span className="ds-metrica-valor">{compacto(TOTAL_ATUAL)}</span>
            <Minitendencia dados={vazio ? [] : SERIE_MINI} rotulo={RESUMO_MINI} carregando={carregando} />
            <span className="ds-metrica-apoio">
              12 semanas · {VARIACAO > 0 ? "+" : ""}{VARIACAO}% sobre o período anterior
            </span>
          </div>
        </Bloco>

        <Bloco
          titulo="Meta por responsável"
          descricao="Realizado contra meta, com a marca do ritmo esperado para hoje. Quem está abaixo do ritmo fica em coral, porque é quem precisa de ação agora; quem está no ritmo vai para o cinza neutro. O botão troca a leitura entre realizado e o que falta."
        >
          <MetaPorResponsavel dados={semDado} carregando={carregando} />
        </Bloco>
      </div>

      {/* ── Segunda leva: as formas que o produto ainda ia precisar ─────────
          Cada uma entrou por uma pergunta que o CRM faz e que os seis
          primeiros não respondiam. Nenhuma entrou por ser bonita. */}

      <Bloco
        titulo="Área simples"
        descricao="Uma série, sem comparação. É o gráfico mais usado do produto: 'como isso vem andando'. Comparar período é outro gráfico, não uma opção deste."
        arquivo="ds/graficos-avancados.tsx"
        importar={'import { AreaSimples } from "@/components/onface/ds/graficos-avancados"'}
      >
        <AreaSimples />
      </Bloco>

      <Bloco
        titulo="Barras com métrica selecionável"
        descricao="O cabeçalho é o controle: cada métrica mostra o total do período e vira a série ao ser escolhida. Três gráficos empilhados diriam a mesma coisa ocupando três vezes o espaço, e ninguém compararia nada. Clique em Ligações, WhatsApp e E-mails."
        arquivo="ds/graficos-avancados.tsx"
        importar={'import { BarrasInterativas } from "@/components/onface/ds/graficos-avancados"'}
      >
        <BarrasInterativas />
      </Bloco>

      <Bloco
        titulo="Linhas por canal, com série que liga e desliga"
        descricao="Com tudo ligado o gráfico responde qual canal cresce; com um só, como aquele canal está. São duas perguntas diferentes no mesmo espaço, e a legenda é o que troca entre elas."
        arquivo="ds/graficos-avancados.tsx"
        importar={'import { LinhasPorCanal } from "@/components/onface/ds/graficos-avancados"'}
      >
        <LinhasPorCanal />
      </Bloco>

      <Bloco
        titulo="Volume e conversão no mesmo quadro"
        descricao="Barra é quanto a operação falou (eixo da esquerda), linha é quanto disso virou negócio (eixo da direita). Em dois cartões separados ninguém cruza as duas, que é justamente onde está a resposta."
        arquivo="ds/graficos-avancados.tsx"
        importar={'import { VolumeEConversao } from "@/components/onface/ds/graficos-avancados"'}
      >
        <VolumeEConversao />
      </Bloco>

      <Bloco
        titulo="Radar de desempenho"
        descricao="Perfil em cinco eixos contra a régua do time. Serve para comparar UMA pessoa com a média, não para empilhar o time inteiro: cinco polígonos viram sopa. À direita, a mesma leitura com grade circular e sem raios, para quando os eixos já estão nomeados e o raio vira ruído."
        arquivo="ds/graficos-avancados.tsx"
        importar={'import { RadarDesempenho, RadarGradeCircular } from "@/components/onface/ds/graficos-avancados"'}
      >
        <div className="of-g-par">
          <RadarDesempenho />
          <RadarGradeCircular />
        </div>
      </Bloco>

      <Bloco
        titulo="Cascata do funil"
        descricao="De onde saiu e para onde foi o dinheiro do mês. Saldo sozinho não explica nada: R$ 1,7 MM pode ser um mês ótimo ou o resultado de ganhar pouco e perder menos ainda. Verde entra, salmão sai, coral é o saldo."
        arquivo="ds/graficos-avancados.tsx"
        importar={'import { CascataDoFunil } from "@/components/onface/ds/graficos-avancados"'}
      >
        <CascataDoFunil />
      </Bloco>

      <Bloco
        titulo="Adoção em barra radial"
        descricao="Quatro anéis concêntricos leem a comparação de uma vez; quatro anéis soltos lado a lado obrigam a comparar de memória. Use para percentual de um todo em até cinco categorias."
        arquivo="ds/graficos-avancados.tsx"
        importar={'import { AdocaoRadial } from "@/components/onface/ds/graficos-avancados"'}
      >
        <AdocaoRadial />
      </Bloco>

      <Bloco
        titulo="Mapa de contato"
        descricao="Quando vale a pena ligar. Um gráfico cartesiano responderia quantos contatos por hora; o mapa responde qual é a janela, que é a pergunta que a operação faz de verdade. Uma cor só, com intensidade: duas cores virariam duas leituras. Passe o mouse ou navegue com Tab."
        arquivo="ds/graficos-avancados.tsx"
        importar={'import { MapaDeContato } from "@/components/onface/ds/graficos-avancados"'}
        fundo="sunken"
      >
        <MapaDeContato />
      </Bloco>

      {/* ── Terceira leva: medidores e séries ───────────────────────────────
          Os medidores respondem "quanto de um todo" sem eixo nem grade; as
          séries respondem "como isso andou". Entraram juntas porque um painel
          real do CRM é feito dos dois: a manchete é medidor, a apuração é
          série. */}

      <Bloco
        titulo="Arco segmentado com pilha de responsáveis"
        descricao="Use para uma fração de um todo que a diretoria lê de relance: saúde da base, meta do período, SLA. O arco é cortado em blocos porque bloco é régua — em traço contínuo ninguém distingue 62% de 68%. Clique num avatar para abrir a leitura da pessoa. Não use quando a pergunta é evolução: medidor não tem tempo, e 'subiu ou caiu' pede linha."
        arquivo="ds/graficos-medidores.tsx"
        importar={'import { PaineisDeArco } from "@/components/onface/ds/graficos-medidores"'}
      >
        <PaineisDeArco />
      </Bloco>

      <div className="of-g-par">
        <Bloco
          titulo="Distribuição por origem, com período"
          descricao="Uma barra, quatro faixas: de onde veio a receita. Use quando o total importa tanto quanto a divisão. Não use acima de cinco faixas — a quinta já sai fina demais para ser clicada, e o resto vira Outros."
          arquivo="ds/graficos-medidores.tsx"
          importar={'import { EntradasPorOrigem } from "@/components/onface/ds/graficos-medidores"'}
          plano
        >
          <EntradasPorOrigem />
        </Bloco>

        <Bloco
          titulo="Alocação do funil, com abas"
          descricao="Mesma barra, outro controle: abas quando os recortes são uma escada de tempo (semana, mês, ano), menu quando são uma lista sem ordem natural. O total vira manchete porque a pergunta aqui começa por 'quanto tem em aberto'."
          arquivo="ds/graficos-medidores.tsx"
          importar={'import { AlocacaoDoFunil } from "@/components/onface/ds/graficos-medidores"'}
          plano
        >
          <AlocacaoDoFunil />
        </Bloco>
      </div>

      <Bloco
        titulo="Assinaturas por plano e o que vence"
        descricao="A composição da base e a lista de renovações no mesmo cartão: separados, o time vê a base sem ver o que está prestes a sair dela. Clicar num plano na legenda filtra a lista. Não use este par quando a lista passa de umas oito linhas — aí ela é a tela, e o medidor é o resumo dela."
        arquivo="ds/graficos-medidores.tsx"
        importar={'import { AssinaturasPorPlano } from "@/components/onface/ds/graficos-medidores"'}
        plano
      >
        <AssinaturasPorPlano />
      </Bloco>

      <Bloco
        titulo="Linha com média, pico e vale"
        descricao="Use quando 'subiu ou caiu' não basta e a pessoa precisa saber se o número é bom: a régua tracejada é a média do período e os dois extremos ficam apontados, porque em doze pontos ninguém acha o maior olhando. Não use a régua para meta — meta é linha de referência com rótulo próprio e cor de status, não a média do próprio dado."
        arquivo="ds/graficos-series.tsx"
        importar={'import { SaldoComReferencia } from "@/components/onface/ds/graficos-series"'}
        plano
      >
        <SaldoComReferencia />
      </Bloco>

      <Bloco
        titulo="Funil no tempo, em área empilhada"
        descricao="O funil comercial acima responde onde os negócios estão hoje; este responde se o funil engorda ou seca, e em qual etapa. Os tiles trazem a passagem de cada etapa no período, porque volume subindo com passagem caindo é topo inflado, não crescimento. Não troque um pelo outro: coorte de hoje e série no tempo são perguntas diferentes."
        arquivo="ds/graficos-series.tsx"
        importar={'import { FunilNoTempo } from "@/components/onface/ds/graficos-series"'}
        plano
      >
        <FunilNoTempo />
      </Bloco>

      <Bloco
        titulo="Painel escuro de operação"
        descricao="Grafite para tela de parede, monitoramento e momento de decisão. O escuro vem do escopo data-onface-superficie='escura' que já existe na fundação: ele reaponta a camada semântica inteira, então eixo, grade, tooltip e abas saem legíveis sem uma linha de cor no componente. Não crie tema escuro por gráfico, e não use grafite no meio de uma tela de papel só por contraste visual."
        arquivo="ds/graficos-series.tsx"
        importar={'import { PainelOperacaoEscuro } from "@/components/onface/ds/graficos-series"'}
        plano
      >
        <PainelOperacaoEscuro />
      </Bloco>

      <Bloco
        titulo="Barras horizontais para ranking"
        descricao="Use sempre que o rótulo for nome: deitada, 'Imobiliária Costa Verde' cabe na linha, e em pé ela vira reticências ou texto girado. Só o primeiro colocado fica em coral — a ordem já está na posição, então a cor marca quem responde à pergunta. Não use acima de dez itens: aí a leitura é tabela ordenável, não gráfico."
        arquivo="ds/graficos-series.tsx"
        importar={'import { RankingHorizontal } from "@/components/onface/ds/graficos-series"'}
        plano
      >
        <RankingHorizontal />
      </Bloco>

      <Bloco
        titulo="Área em degrau com preenchimento pontilhado"
        descricao="Degrau para o que muda em salto: licença contratada, plano, número de PAs. Curva entre dois patamares desenha um crescimento que nunca existiu. O pontilhado marca capacidade (o teto contratado) contra uso (chapado): padrão em vez de mais uma cor, porque o teto é o fundo da leitura, não uma segunda série disputando atenção. Não use degrau em dado contínuo como receita diária."
        arquivo="ds/graficos-series.tsx"
        importar={'import { AreaEmDegrau } from "@/components/onface/ds/graficos-series"'}
      >
        <AreaEmDegrau />
      </Bloco>

      <Bloco
        titulo="Área empilhada com hachura cruzada"
        descricao="Faixas coladas no mesmo eixo, distinguidas só por tom, é onde quem não separa os dois cinzas perde o gráfico — e onde a impressão em preto e branco morre. A hachura muda de ângulo por série, então a diferença sobrevive à cor. Use quando as faixas se tocam; em gráfico de série separada a textura é ruído."
        arquivo="ds/graficos-series.tsx"
        importar={'import { AreaHachurada } from "@/components/onface/ds/graficos-series"'}
      >
        <AreaHachurada />
      </Bloco>

      <Bloco
        titulo="Radar com preenchimento em degradê"
        descricao="Variante do radar acima para quando há UM polígono só: o degradê de opacidade da mesma cor tira o peso da mancha central, onde os cinco eixos se sobrepõem e o chapado empasta, sem perder a silhueta. Com duas séries no mesmo quadro volte ao chapado, porque dois degradês sobrepostos não deixam ler nenhum dos dois. Degradê de matiz continua proibido."
        arquivo="ds/graficos-series.tsx"
        importar={'import { RadarGradiente } from "@/components/onface/ds/graficos-series"'}
      >
        <div className="of-g-par">
          <RadarDesempenho comMedia={false} />
          <RadarGradiente />
        </div>
      </Bloco>

      <Regras
        faca={{
          titulo: "Textura para separar série, cor para hierarquia",
          texto: "Quando duas faixas se tocam, separe por padrão (<pattern> em token, ângulo diferente por série) e mantenha a disciplina de cor: coral na série que responde, cinza no resto. Funciona para daltônico e sobrevive à impressão.",
        }}
        naoFaca={{
          titulo: "Textura como enfeite",
          texto: "Hachura em gráfico de uma série só, ou em barras já separadas por espaço, não codifica nada: vira vibração na tela e atrapalha a leitura do valor no eixo.",
        }}
      />

      <Regras
        faca={{
          titulo: "Uma série em coral por gráfico",
          texto: "O coral marca a série que responde à pergunta do painel. Comparativo, apoio e contexto ficam nos cinzas de --cf2-serie-3 e 4. Se toda série é destaque, nenhuma é.",
        }}
        naoFaca={{
          titulo: "Colorir cada série de uma cor",
          texto: "Paleta de arco-íris obriga a pessoa a consultar a legenda a cada olhada e transforma o painel em borrão laranja. Acima de quatro categorias, agrupe o resto em Outros.",
        }}
      />

      <Regras
        faca={{
          titulo: "Preenchimento chapado com opacidade baixa",
          texto: "A área usa a própria cor da linha com fillOpacity de 0,12: o volume aparece sem competir com o traço. Rosca e barra ficam sólidas, sem contorno colorido.",
        }}
        naoFaca={{
          titulo: "Gradiente, sombra e brilho decorativos",
          texto: "Degradê sob a área e sombra colorida atrás da barra não codificam nenhum dado, sujam o valor lido no eixo e quebram a regra de superfície plana do ONFACE.",
        }}
      />
    </Secao>
  );
}
