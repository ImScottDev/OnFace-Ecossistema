"use client";

/** ONFACE Design System — Linguagem visual.
 *
 * As outras seções documentam PEÇAS (token, componente, layout). Esta documenta
 * a DECISÃO: por que a mesma informação, com os mesmos tokens, pode sair
 * lavada ou sair ONFACE. Por isso quase tudo aqui é comparação lado a lado —
 * regra escrita em parágrafo ninguém aplica, composição errada ao lado da
 * certa ninguém esquece.
 *
 * Contraste não é cor nova. A paleta é a mesma de sempre (grafite, papel,
 * coral) e o que muda entre um lado e o outro é escala, peso, superfície,
 * densidade e posição. O blur test do primeiro bloco existe justamente para
 * provar isso: desfocada, a versão certa continua dizendo onde olhar. */

import * as React from "react";
import { ArrowUpRight, Ban, Check, Image as ImageIcon, X } from "lucide-react";
import { Bloco, Chave, Regras, Secao } from "../lab";
import { CampoNexo, FundoGrafico, Momento } from "../marca";
import { FUNIL, INSIGHTS, NEGOCIOS, RECEITA_SEMANAL, brl, compacto } from "../dados";
import { Button } from "@/components/ui/button";
import "./linguagem.css";

/* ── Dados reais do laboratório ──────────────────────────────────────────
   Nenhum número escrito à mão: a composição lavada e a composição ONFACE
   mostram exatamente os mesmos valores, senão a comparação seria desonesta. */
const SEMANA = RECEITA_SEMANAL[RECEITA_SEMANAL.length - 1] ?? { semana: "—", atual: 0, anterior: 1 };
const DELTA = Math.round(((SEMANA.atual - SEMANA.anterior) / SEMANA.anterior) * 1000) / 10;
const PROPOSTA = FUNIL.find((f) => f.etapa === "Proposta") ?? { etapa: "Proposta", quantidade: 1, valor: 0 };
const TICKET = Math.round(PROPOSTA.valor / PROPOSTA.quantidade);
/** Em aberto = tudo que ainda dá para trabalhar. Ganho já saiu do funil. */
const EM_ABERTO = FUNIL.filter((f) => f.etapa !== "Ganho").reduce((soma, f) => soma + f.valor, 0);
const GANHO = NEGOCIOS.find((n) => n.etapa === "Ganho") ?? NEGOCIOS[0];
const INSIGHT = INSIGHTS[0];

/* Os dois números da demo da regra de sinal saem da mesma fonte que o bento
   usa, para a documentação e a tela não divergirem. Perdido também está "sem
   tarefa" e não entra: ele não está parado, acabou. */
const GANHO_MES = FUNIL.find((f) => f.etapa === "Ganho")?.valor ?? 0;
const PARADOS = NEGOCIOS.filter(
  (n) => n.situacao === "sem-tarefa" && n.etapa !== "Ganho" && n.etapa !== "Perdido",
).length;

const METRICAS = [
  { rotulo: "Receita ganha · semana", valor: brl(SEMANA.atual) },
  { rotulo: "Negócios em proposta", valor: String(PROPOSTA.quantidade) },
  { rotulo: "Ticket médio", valor: brl(TICKET) },
  { rotulo: "Semana anterior", valor: brl(SEMANA.anterior) },
];

/* ── Campo do NEXO: estágios ─────────────────────────────────────────────
   Derivado do próprio componente para a lista não envelhecer separada dele. */
type EstagioNexo = NonNullable<React.ComponentProps<typeof CampoNexo>["estagio"]>;
const ESTAGIOS: { valor: EstagioNexo; rotulo: string; legenda: string }[] = [
  { valor: "ocioso", rotulo: "Ocioso", legenda: "Estrutura visível, nenhum nó aceso. O NEXO está disponível e não está fazendo nada." },
  { valor: "escutando", rotulo: "Escutando", legenda: "Entrada chegando: transcrição de ligação, mensagem, comando. Dois nós acesos, movimento mínimo." },
  { valor: "pensando", rotulo: "Pensando", legenda: "Estado padrão de trabalho. É o que aparece enquanto a resposta ainda não tem forma." },
  { valor: "buscando", rotulo: "Buscando", legenda: "Varrendo base, histórico e negócios parecidos. Mais caminhos desenhando." },
  { valor: "analisando", rotulo: "Analisando", legenda: "Comparando o que achou. Quase toda a malha converge para o núcleo." },
  { valor: "executando", rotulo: "Executando", legenda: "Escrevendo no CRM: tarefa, etapa, proposta. Aqui já mexe em dado de verdade." },
  { valor: "concluido", rotulo: "Concluído", legenda: "Malha cheia e parada. O movimento acabou, a estrutura fica como prova do caminho." },
];

const GRAFICOS = [
  {
    variante: "malha" as const,
    nome: "Malha",
    usar: "Centro de comando, processamento, tela que resume a operação inteira. Mede no mesmo múltiplo de --onface-u do layout.",
    evitar: "Atrás de tabela, formulário ou qualquer coisa que a pessoa leia linha por linha.",
  },
  {
    variante: "pontos" as const,
    nome: "Pontos",
    usar: "Superfície grafite que precisa de textura sem estrutura: rodapé de momento, faixa de identidade, estado vazio importante.",
    evitar: "Repetir na mesma tela junto com a malha. Duas texturas brigando viram sujeira.",
  },
  {
    variante: "arcos" as const,
    nome: "Arcos",
    usar: "Momento de decisão ou de conclusão: proposta enviada, negócio ganho, meta batida. É o 'O' do logotipo virando horizonte.",
    evitar: "Lista, kanban, dashboard recorrente. Arco em tudo tira o peso de quando a coisa importa.",
  },
  {
    variante: "conexoes" as const,
    nome: "Conexões",
    usar: "Onde existe ligação real: automação, jornada, integração, NEXO puxando dado de várias fontes.",
    evitar: "Como enfeite de card. Se não há nada ligado a nada, o desenho está mentindo.",
  },
];

export function SecaoLinguagem() {
  const [desfocar, setDesfocar] = React.useState(false);
  const [estagio, setEstagio] = React.useState<EstagioNexo>("analisando");
  const atual = ESTAGIOS.find((e) => e.valor === estagio) ?? ESTAGIOS[2];

  return (
    <Secao
      titulo="Linguagem visual"
      chamada="O sistema já estava correto e ainda assim saía lavado: tudo cinza claro, borda quase invisível, tudo no mesmo peso. Esta seção é a camada que faltava — como usar grafite, papel e coral para que uma tela tenha foco, profundidade e momento sem nenhuma cor nova."
    >
      {/* ── 1. Princípios de contraste ─────────────────────────────────── */}
      <Bloco
        titulo="Princípios de contraste"
        descricao="Mesma informação, mesmos tokens, duas composições. À esquerda, quatro caixas idênticas: mesma superfície, mesmo tamanho, mesmo peso, borda que quase não existe. À direita, a métrica que decide muda de superfície (grafite), de escala e de peso, e o apoio divide uma superfície só, resolvido por separador e alinhamento. Ligue o blur test: a versão lavada vira uma mancha cinza, a versão ONFACE continua dizendo onde olhar."
        fundo="sunken"
        acoes={
          <Chave id="lng-blur" rotulo="Blur test" valor={desfocar} aoMudar={setDesfocar} />
        }
      >
        <div className="lng-provas lng-escopo">
          <article className="lng-prova">
            <p className="lng-prova-rotulo" data-tom="nao">
              <X aria-hidden /> Lavada
            </p>
            <div className="lng-palco-blur" data-desfocado={desfocar}>
              <div className="lng-lavada">
                {METRICAS.map((m) => (
                  <div className="lng-lavada-item" key={m.rotulo}>
                    <span>{m.rotulo}</span>
                    <strong>{m.valor}</strong>
                  </div>
                ))}
              </div>
            </div>
            <p className="lng-prova-nota">
              Quatro pesos iguais. Sem um ponto de entrada, a leitura começa em qualquer lugar — e a
              borda a 1px de distância do fundo nem separa os blocos.
            </p>
          </article>

          <article className="lng-prova">
            <p className="lng-prova-rotulo" data-tom="sim">
              <Check aria-hidden /> ONFACE
            </p>
            <div className="lng-palco-blur" data-desfocado={desfocar}>
              <div className="lng-certa">
                <div className="lng-foco">
                  <p className="lng-foco-rotulo">Receita ganha · {SEMANA.semana}</p>
                  <div>
                    <strong className="lng-foco-valor">{brl(SEMANA.atual)}</strong>
                    <span className="lng-foco-delta">
                      <ArrowUpRight aria-hidden />
                      {DELTA.toLocaleString("pt-BR")}% vs. semana anterior
                    </span>
                  </div>
                </div>
                {/* Apoio numa superfície só: informação relacionada não precisa
                    de um card por item para ficar agrupada. */}
                <div className="lng-apoio">
                  {METRICAS.slice(1).map((m) => (
                    <div className="lng-apoio-linha" key={m.rotulo}>
                      <span>{m.rotulo}</span>
                      <b>{m.valor}</b>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <p className="lng-prova-nota">
              Cinco alavancas, nenhuma cor nova: superfície (grafite contra papel), escala (40u contra
              14u), peso, densidade (apoio mais apertado) e posição (o foco vem primeiro).
            </p>
          </article>
        </div>
      </Bloco>

      <Regras
        faca={{
          titulo: "Uma métrica manda na composição",
          texto:
            "Escolha o número que muda a decisão e dê a ele superfície, escala e peso. O resto é apoio e pode ficar denso, pequeno e neutro. O teste dos 3 segundos precisa responder: onde estou, qual é a informação principal, o que exige atenção, qual é a ação.",
        }}
        naoFaca={{
          titulo: "Democracia visual",
          texto:
            "Dar o mesmo tratamento a tudo é o que produz a tela lavada. Se todos os blocos têm o mesmo tamanho, o mesmo cinza e a mesma borda, a hierarquia foi delegada para a ordem de leitura — que ninguém segue.",
        }}
      />

      {/* ── 1b. Regra de sinal ─────────────────────────────────────────────
          Curto de propósito: é regra de semântica, não de estilo, e cabe em
          três casos. Entra logo depois do contraste porque decide QUANDO cada
          cor aparece — o bloco anterior decide com que peso. */}
      <Bloco
        titulo="Regra de sinal"
        descricao="Verde, coral e cinza não são três tons de “destaque”: são três significados diferentes, e cada um responde a uma pergunta distinta. Verde diz o que já aconteceu e deu certo. Coral diz o que quer sua atenção agora. Cinza diz que não há consequência. Duas pílulas com a mesma seta em cores diferentes na mesma linha é bug de semântica, não decisão de estilo — a forma empatou e a cor virou enfeite."
        fundo="sunken"
      >
        <div className="lng-sinais lng-escopo">
          <div className="lng-sinal-caso">
            <span className="lng-pilula" data-sinal="ok">
              <ArrowUpRight aria-hidden />
              +18,4%
            </span>
            <strong>Verde · resultado consumado</strong>
            <p>
              O fato já aconteceu e foi bom: negócio ganho, meta batida, delta positivo de
              performance. Verde nunca pede ação — se ainda dá para fazer algo, não é verde.
            </p>
          </div>

          <div className="lng-sinal-caso">
            <span className="lng-pilula" data-sinal="acao">Exige ação</span>
            <strong>Coral · atenção agora</strong>
            <p>
              Atrasado, parado, sem próxima tarefa, em risco, ou a ação principal da tela. Coral é
              sempre um convite a fazer alguma coisa, e por isso não carrega seta de tendência: seta
              conta variação, não urgência.
            </p>
          </div>

          <div className="lng-sinal-caso">
            <span className="lng-pilula" data-sinal="neutro">14 em proposta</span>
            <strong>Cinza · informativo</strong>
            <p>
              Contagem, rótulo, período, estado sem consequência. A maior parte de um painel é cinza,
              e é isso que permite verde e coral significarem alguma coisa quando aparecem.
            </p>
          </div>
        </div>

        <div className="lng-provas lng-escopo" style={{ marginTop: "var(--space-20)" }}>
          <article className="lng-prova">
            <p className="lng-prova-rotulo" data-tom="nao">
              <X aria-hidden /> Duas famílias na mesma linha
            </p>
            <div className="lng-sinal-linha">
              <span className="lng-sinal-kpi">
                <small>Receita ganha</small>
                <b>{compacto(GANHO_MES)}</b>
                <span className="lng-pilula" data-sinal="ok">
                  <ArrowUpRight aria-hidden />
                  +18,4% vs. mês anterior
                </span>
              </span>
              <span className="lng-sinal-kpi">
                <small>Sem próxima tarefa</small>
                <b>{PARADOS}</b>
                <span className="lng-pilula" data-sinal="acao">
                  <ArrowUpRight aria-hidden />
                  +12% na semana
                </span>
              </span>
            </div>
            <p className="lng-prova-nota">
              A mesma seta subindo nos dois, em duas cores. O olho lê “dois indicadores de tendência”
              e precisa parar para descobrir que um é comemoração e o outro é alarme.
            </p>
          </article>

          <article className="lng-prova">
            <p className="lng-prova-rotulo" data-tom="sim">
              <Check aria-hidden /> Cada sinal no seu papel
            </p>
            <div className="lng-sinal-linha">
              <span className="lng-sinal-kpi">
                <small>Receita ganha</small>
                <b>{compacto(GANHO_MES)}</b>
                <span className="lng-pilula" data-sinal="ok">
                  <ArrowUpRight aria-hidden />
                  +18,4% vs. mês anterior
                </span>
              </span>
              <span className="lng-sinal-kpi">
                <small>Sem próxima tarefa</small>
                <b>{PARADOS}</b>
                <span className="lng-pilula" data-sinal="acao">Exige ação</span>
              </span>
            </div>
            <p className="lng-prova-nota">
              O verde continua contando variação, com seta. O coral perde a seta e passa a dizer o que
              é: um estado que pede ação. Formas diferentes, leitura instantânea.
            </p>
          </article>
        </div>
      </Bloco>

      {/* ── 2. Hierarquia de superfície ────────────────────────────────── */}
      <Bloco
        titulo="Hierarquia de superfície"
        descricao="Quatro planos, cada um com um papel. Trocar de plano é a forma mais barata de criar contraste, porque não gasta cor nem escala. A regra de leitura é constante: quanto mais escuro, mais estrutural e menos operacional."
        fundo="sunken"
      >
        <div className="ds-planos lng-escopo">
          <div className="ds-plano lng-plano" data-plano="casca">
            <small>Plano 1</small>
            <div>
              <strong>Casca grafite</strong>
              <span>Topbar, navegação, menus e toasts. Não se trabalha aqui: orienta e identifica.</span>
            </div>
          </div>
          <div className="ds-plano lng-plano" data-plano="pagina">
            <small>Plano 2</small>
            <div>
              <strong>Papel da página</strong>
              <span>O fundo do trabalho. Carrega cards, quadros e filtros, e nunca recebe texto longo direto.</span>
            </div>
          </div>
          <div className="ds-plano lng-plano" data-plano="canvas">
            <small>Plano 3</small>
            <div>
              <strong>Canvas branco</strong>
              <span>Onde o dado vive: tabela, formulário, registro, gráfico. É o plano mais legível.</span>
            </div>
          </div>
          <div className="ds-plano lng-plano" data-plano="afundada">
            <small>Plano 4</small>
            <div>
              <strong>Superfície afundada</strong>
              <span>Coluna de kanban, playground, detalhe expandido. Diz &ldquo;isto está dentro daquilo&rdquo;.</span>
            </div>
          </div>
        </div>
      </Bloco>

      {/* ── 3. Profundidade ────────────────────────────────────────────── */}
      <Bloco
        titulo="Profundidade"
        descricao="A escala honesta tem quatro degraus e só dois deles são sombra. Profundidade no ONFACE vem de superfície, borda e sobreposição; sombra é reservada para o que flutua de verdade, ou seja, para o que some quando você clica fora."
        fundo="sunken"
      >
        <div className="lng-profundidade lng-escopo">
          <div className="lng-prof">
            <div className="lng-prof-palco">
              <div className="lng-cartao-raso">
                <b>TechCorp Telecom</b>
                <span>Proposta · {brl(42600)}</span>
              </div>
            </div>
            <div>
              <strong>Hairline</strong>
              <code>1px solid var(--line-hairline)</code>
              <p>Card, painel, linha de tabela, barra de filtro. É o degrau padrão: card comum não flutua.</p>
            </div>
          </div>

          <div className="lng-prof">
            <div className="lng-prof-palco">
              <div className="lng-anel-amostra">
                <span className="lng-anel-avatar">MR</span>
                <span className="lng-anel-pilula">Mayara Ribeiro</span>
              </div>
            </div>
            <div>
              <strong>Inset ring</strong>
              <code>--ring-inset-avatar · --ring-inset-hairline</code>
              <p>Avatar, pílula, chip, controle pequeno. Dá borda sem gastar 1px do tamanho útil da peça.</p>
            </div>
          </div>

          <div className="lng-prof">
            <div className="lng-prof-palco">
              <div className="lng-popover">
                <div className="lng-popover-item" data-ativo="true">Marcar como ganho</div>
                <div className="lng-popover-item">Mover etapa</div>
                <div className="lng-popover-item">Arquivar</div>
              </div>
            </div>
            <div>
              <strong>Sombra de popover</strong>
              <code>--shadow-popover</code>
              <p>Só em superfície temporária: dropdown, popover, dialog, drawer, overlay de arraste.</p>
            </div>
          </div>

          <div className="lng-prof">
            <div className="lng-prof-palco" data-fundo="escuro">
              <div className="lng-popover-shell">
                <div className="lng-popover-item" data-ativo="true">Notificações</div>
                <div className="lng-popover-item">Preferências</div>
                <div className="lng-popover-item">Sair</div>
              </div>
            </div>
            <div>
              <strong>Sombra de casca</strong>
              <code>--shadow-popover-shell</code>
              <p>O mesmo caso anterior, mas ancorado na casca grafite: a sombra é mais densa porque o fundo é escuro.</p>
            </div>
          </div>
        </div>
      </Bloco>

      <Regras
        faca={{
          titulo: "Sombra é sinal de temporário",
          texto:
            "Se a peça some quando você clica fora, ela pode flutuar. Popover, dropdown, dialog, drawer e o overlay do cartão arrastado — nada além disso.",
        }}
        naoFaca={{
          titulo: "Card flutuando",
          texto:
            "Card, KPI, tabela e painel ficam colados na página. Sombra em elemento permanente cria uma profundidade falsa: tudo parece hover, nada parece clicável de verdade.",
        }}
      />

      {/* ── 4. Elementos gráficos ──────────────────────────────────────── */}
      <Bloco
        titulo="Elementos gráficos"
        descricao="Quatro variantes de FundoGrafico, todas derivadas de duas formas que a marca já tem: a malha hairline e o arco do 'O'. O fundo entra quando conversa com o conteúdo — e não porque a tela estava vazia."
        fundo="sunken"
      >
        <div className="lng-graficos lng-escopo">
          {GRAFICOS.map((g) => (
            <div className="lng-gr" key={g.variante}>
              <div className="lng-gr-amostra lng-palco">
                <FundoGrafico variante={g.variante} superficie="escura" intensidade="media" />
              </div>
              <div>
                <strong>{g.nome}</strong>
                <div className="lng-gr-uso">
                  <span data-tom="sim"><b>Usar</b>{g.usar}</span>
                  <span data-tom="nao"><b>Evitar</b>{g.evitar}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="lng-halo lng-escopo">
          <div className="lng-halo-amostra lng-palco">
            <FundoGrafico variante="arcos" superficie="escura" halo />
            <b>Com halo</b>
            <p>
              Iluminação coral localizada no topo, presa ao ponto focal. Serve para dizer &ldquo;é aqui&rdquo; em
              um momento expressivo, uma vez por composição.
            </p>
          </div>
          <div className="lng-halo-amostra lng-palco">
            <FundoGrafico variante="arcos" superficie="escura" />
            <b>Sem halo</b>
            <p>
              O padrão. Fundo estrutural sem foco: a mesma superfície quando o destaque já está sendo
              feito pelo número ou pela ação.
            </p>
          </div>
        </div>
      </Bloco>

      {/* ── 5. Campo do NEXO ───────────────────────────────────────────── */}
      <Bloco
        titulo="Campo do NEXO"
        descricao="A assinatura da IA do produto não é um spinner nem um blob: é a mesma malha de nós do resto do sistema convergindo para um núcleo coral. O estágio muda quantos nós e caminhos estão acesos, nunca a cor. Troque o estágio e compare nas duas superfícies."
        fundo="sunken"
      >
        <div className="lng-escopo">
          <div className="lng-seg" role="group" aria-label="Estágio do NEXO">
            {ESTAGIOS.map((e) => (
              <button
                key={e.valor}
                type="button"
                aria-pressed={estagio === e.valor}
                onClick={() => setEstagio(e.valor)}
              >
                {e.rotulo}
              </button>
            ))}
          </div>

          {/* Região viva: quem navega por leitor de tela ouve a legenda trocar
              junto com o campo, em vez de só ver o desenho mudar. */}
          <p className="lng-nexo-atual" aria-live="polite">
            <strong>{atual.rotulo}</strong> · {atual.legenda}
          </p>

          <div className="lng-nexo-par">
            <div className="lng-nexo-painel" data-superficie="escura">
              <small>Sobre a casca</small>
              <CampoNexo estagio={estagio} superficie="escura" altura={120} />
              <p className="lng-nexo-legenda">
                Caminho apagado usa a linha escura da casca. É assim que o NEXO aparece em toast,
                painel de comando e overlay ancorado na topbar.
              </p>
            </div>
            <div className="lng-nexo-painel" data-superficie="clara">
              <small>Sobre o canvas</small>
              <CampoNexo estagio={estagio} superficie="clara" altura={120} />
              <p className="lng-nexo-legenda">
                Mesma geometria, mesmo coral, linha clara. É assim que o NEXO aparece dentro do
                registro, da conversa e do resumo de ligação.
              </p>
            </div>
          </div>
        </div>
      </Bloco>

      {/* ── 6. Momentos expressivos ────────────────────────────────────── */}
      <Bloco
        titulo="Momentos expressivos"
        descricao="Superfície grafite com fundo gráfico, número grande, contexto curto e ação. O momento existe pelo contraste com o resto seco: se toda tela for um momento, nenhuma é. Dois por produto, não dois por página."
        fundo="sunken"
        plano
      >
        <div className="lng-momentos lng-escopo">
          <Momento
            rotulo={`Centro de comando · ${SEMANA.semana}`}
            titulo="O funil está cheio e parado no mesmo lugar"
            apoio={INSIGHT?.detalhe}
            variante="malha"
            acoes={
              <>
                <Button size="sm">{INSIGHT?.acao ?? "Revisar"}</Button>
                <button type="button" className="lng-acao-clara">Ver funil completo</button>
              </>
            }
          >
            <div className="lng-momento-numeros">
              <span className="ds-momento-numero">{compacto(EM_ABERTO)}</span>
              <span className="lng-momento-apoio-num">
                <b>{PROPOSTA.quantidade}</b>
                <span>em proposta</span>
              </span>
              <span className="lng-momento-apoio-num">
                <b>{brl(TICKET)}</b>
                <span>ticket médio</span>
              </span>
            </div>
          </Momento>

          <Momento
            rotulo="Fechado"
            titulo={`${GANHO?.empresa ?? "Cliente"} renovou por mais 12 meses`}
            apoio={`${GANHO?.titulo ?? ""} · fechado por ${GANHO?.responsavel.nome ?? ""}. O contrato já está no registro do cliente.`}
            variante="arcos"
            acoes={<button type="button" className="lng-acao-clara">Ver contrato</button>}
          >
            <div className="lng-momento-numeros">
              <span className="ds-momento-numero">{brl(GANHO?.valor ?? 0)}</span>
              <span className="lng-momento-apoio-num">
                <b>{GANHO?.produto ?? "—"}</b>
                <span>produto</span>
              </span>
              <span className="lng-momento-apoio-num">
                <b>{GANHO?.origem ?? "—"}</b>
                <span>origem</span>
              </span>
            </div>
          </Momento>
        </div>
      </Bloco>

      <Regras
        faca={{
          titulo: "O momento muda o próximo passo",
          texto:
            "Centro de comando, conclusão, proposta, processamento do NEXO, vazio importante. Se o bloco altera o que a pessoa vai fazer em seguida, ele merece grafite, fundo gráfico e número grande.",
        }}
        naoFaca={{
          titulo: "Momento por estética",
          texto:
            "Card comum vestido de grafite continua sendo card comum, só que mais pesado e mais difícil de ler. Dois momentos na mesma tela anulam um ao outro: o segundo já não é exceção.",
        }}
      />

      {/* ── 7. Assinaturas visuais ─────────────────────────────────────── */}
      <Bloco
        titulo="Assinaturas visuais"
        descricao="O que faz uma tela ser reconhecivelmente ONFACE mesmo com o logo coberto. Nada aqui é marca nova: é o que a identidade já fazia, transformado em regra para não se perder tela a tela."
        fundo="sunken"
      >
        <div className="ds-assinaturas lng-escopo">
          <div className="ds-assinatura">
            <div className="ds-assinatura-amostra">
              <div className="lng-assi-casca">
                <span className="lng-assi-marca">ONFACE</span>
                <span className="lng-assi-pilula" data-ativo="true">Vendas</span>
                <span className="lng-assi-pilula">Clientes</span>
              </div>
            </div>
            <strong>Casca grafite permanente</strong>
            <p>A navegação nunca é branca. O produto abre com uma faixa escura fixa, e o trabalho acontece abaixo dela.</p>
          </div>

          <div className="ds-assinatura">
            <div className="ds-assinatura-amostra">
              <div className="lng-assi-foco">
                <i className="lng-assi-ponto" />
                <i className="lng-assi-ponto" />
                <i className="lng-assi-ponto" data-foco="true" />
                <i className="lng-assi-ponto" />
                <i className="lng-assi-ponto" />
              </div>
            </div>
            <strong>Um foco coral por composição</strong>
            <p>Coral é ação e sinal, nunca decoração. Duas coisas coral na mesma tela e nenhuma delas é urgente.</p>
          </div>

          <div className="ds-assinatura">
            <div className="ds-assinatura-amostra">
              <div className="lng-assi-hairline">
                <i />
                <i />
              </div>
            </div>
            <strong>Hairline no lugar de sombra</strong>
            <p>A definição vem de 1px e de troca de superfície. O produto é plano de propósito; só o temporário flutua.</p>
          </div>

          <div className="ds-assinatura">
            <div className="ds-assinatura-amostra">
              <div className="lng-assi-numero">{compacto(SEMANA.atual)}</div>
            </div>
            <strong>Número em display, tabular</strong>
            <p>Valor que decide sai em Plus Jakarta, peso bold e <code>tabular-nums</code>: coluna de número não dança entre linhas.</p>
          </div>

          <div className="ds-assinatura">
            <div className="ds-assinatura-amostra">
              <div className="lng-assi-malha lng-palco">
                <FundoGrafico variante="malha" superficie="escura" intensidade="media" />
              </div>
            </div>
            <strong>Malha na mesma unidade do layout</strong>
            <p>O fundo mede em múltiplo de <code>--onface-u</code>, igual ao resto da tela. Textura que obedece à grade, não wallpaper.</p>
          </div>
        </div>
      </Bloco>

      {/* ── 8. Anti-padrões ────────────────────────────────────────────── */}
      <Bloco
        titulo="Anti-padrões"
        descricao="O errado, desenhado. Todos os exemplos abaixo usam tokens da paleta oficial — é justamente esse o ponto: cor certa não salva decisão errada."
        fundo="sunken"
      >
        <div className="lng-antis lng-escopo">
          <div className="lng-anti">
            <div className="lng-anti-amostra"><div className="lng-err-gradiente" /></div>
            <strong><Ban aria-hidden /> Gradiente decorativo</strong>
            <p>Duas cores da marca borradas uma na outra não dizem nada. Fundo é malha, pontos, arcos ou conexões — e só quando fala do conteúdo.</p>
          </div>

          <div className="lng-anti">
            <div className="lng-anti-amostra"><div className="lng-err-glow" /></div>
            <strong><Ban aria-hidden /> Glow coral</strong>
            <p>Sombra colorida com a cor da marca. A sombra do ONFACE é neutra; coral vive em preenchimento, texto e borda.</p>
          </div>

          <div className="lng-anti">
            <div className="lng-anti-amostra"><div className="lng-err-glass"><i /></div></div>
            <strong><Ban aria-hidden /> Glassmorphism</strong>
            <p>Vidro desfocado apaga o contraste do texto e amarra a leitura ao que passa por baixo. Superfície é opaca, sempre.</p>
          </div>

          <div className="lng-anti">
            <div className="lng-anti-amostra"><div className="lng-err-raio" /></div>
            <strong><Ban aria-hidden /> Raio exagerado</strong>
            <p>Card em cápsula. O raio é token (<code>--radius-card</code>); pílula é só para chip, badge e avatar.</p>
          </div>

          <div className="lng-anti">
            <div className="lng-anti-amostra">
              <span className="lng-err-ilustracao"><ImageIcon aria-hidden /></span>
            </div>
            <strong><Ban aria-hidden /> Ilustração genérica</strong>
            <p>Boneco pastel de banco de imagem em estado vazio. O vazio do ONFACE é ícone de linha, texto direto e a ação que resolve.</p>
          </div>

          <div className="lng-anti">
            <div className="lng-anti-amostra">
              <div className="lng-err-aninhado"><i /><i /></div>
            </div>
            <strong><Ban aria-hidden /> Card dentro de card</strong>
            <p>Borda dentro de borda dobra o ruído e não agrupa nada. Informação relacionada divide a mesma superfície com separador e alinhamento.</p>
          </div>

          <div className="lng-anti">
            <div className="lng-anti-amostra">
              <div className="lng-err-coral"><i /><i /></div>
            </div>
            <strong><Ban aria-hidden /> Tudo coral</strong>
            <p>Quando o bloco inteiro é de acento, o acento deixa de existir. Coral marca um elemento: a ação, o alerta ou o número que decide.</p>
          </div>

          <div className="lng-anti">
            <div className="lng-anti-amostra">
              <div className="lng-err-operacional lng-palco">
                <FundoGrafico variante="malha" superficie="clara" intensidade="media" />
                <div className="lng-err-linhas"><i /><i /><i /></div>
              </div>
            </div>
            <strong><Ban aria-hidden /> Fundo gráfico em tela operacional</strong>
            <p>Malha atrás de tabela ou formulário compete com o dado. O fundo é do momento; a área de trabalho fica limpa.</p>
          </div>
        </div>
      </Bloco>
    </Secao>
  );
}
