"use client";

/** ONFACE Design System — índice do laboratório.
 *
 * É a primeira tela que alguém abre, então ela responde três perguntas antes
 * de qualquer componente: o que é isto, o que já existe de verdade, e como
 * uma tela do produto se monta a partir daqui. O inventário é honesto de
 * propósito: o que ainda não existe aparece marcado como previsto, porque
 * biblioteca que promete tela inexistente vira retrabalho na sprint seguinte.
 */

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  CalendarDays,
  LayoutTemplate,
  Workflow,
  ChartArea,
  Check,
  Clock,
  Database,
  FileSignature,
  FileText,
  Kanban,
  Layers,
  LayoutGrid,
  MessagesSquare,
  Palette,
  PanelsTopLeft,
  PhoneCall,
  Shapes,
  Sparkles,
  Target,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bloco, Regras, Secao } from "../lab";
import { Momento } from "../marca";
import { NEGOCIOS, brl } from "../dados";
import "./visao-geral.css";

/* ── Destinos ─────────────────────────────────────────────────────────────
   Mesmos ícones da navegação do laboratório: o cartão e o item do índice
   precisam ser reconhecidos como a mesma coisa.

   A ordem não é alfabética nem a da navegação: Primitivas vem primeiro e vem
   maior porque é a seção que se abre todo dia. Nove cartões idênticos tratam
   uma consulta rara e uma consulta diária como a mesma coisa. */
const DESTINOS = [
  { slug: "componentes", icone: Boxes, titulo: "Primitivas", linha: "O shadcn do repo já vestido de ONFACE: botão, campo, seleção, aba, tabela e diálogo. É a primeira parada de toda tela nova, e a resposta mais frequente é “já existe, usa”.", destaque: true },
  { slug: "fundacoes", icone: Palette, titulo: "Fundações", linha: "Cor, tipografia, espaço, raio, elevação, densidade e breakpoints." },
  { slug: "movimento", icone: Waves, titulo: "Movimento", linha: "Duração, curva e mola. Quando mover e quando ficar parado." },
  { slug: "linguagem", icone: Shapes, titulo: "Linguagem visual", linha: "Fundo gráfico, momento expressivo e as assinaturas da marca." },
  { slug: "dados", icone: Database, titulo: "Dados e tabela", linha: "Negócios com ordenação, filtro, seleção em massa e densidade." },
  { slug: "graficos", icone: ChartArea, titulo: "Gráficos", linha: "Funil, receita por semana e origem, com as séries da marca." },
  { slug: "quadro", icone: Kanban, titulo: "Quadro", linha: "Kanban de negócios com arraste real e coluna vazia." },
  { slug: "registro", icone: Target, titulo: "Registro e CRM", linha: "Cabeçalho de entidade, linha do tempo e indicadores do cliente." },
  { slug: "nexo", icone: Sparkles, titulo: "NEXO e IA", linha: "Sugestão, passos e insight, sempre com uma ação no fim." },
  { slug: "layouts", icone: LayoutGrid, titulo: "Layouts", linha: "Como casca, faixa escura e canvas montam uma tela inteira." },
] as const;

/* ── Regra de ouro ────────────────────────────────────────────────────────
   Abre a seção como momento expressivo (grafite + fundo gráfico), não como
   mais um cartão claro. É a única decisão da página que muda o que a pessoa
   vai fazer em seguida, então é a única que ganha peso de momento. */
const REGRAS_OURO = [
  {
    titulo: "Existe no shadcn? Usa.",
    texto:
      "A fundação é o shadcn do repo, já reapontado para os tokens ONFACE. Componente novo custa manutenção para sempre; composição de dois existentes custa uma tarde.",
  },
  {
    titulo: "A casca é lei.",
    texto:
      "Topbar, moldura grafite, canvas claro e a escala em --onface-u não são negociáveis por tela. Quem precisa de outro layout está descrevendo um layout novo da casca, não uma exceção.",
  },
  {
    titulo: "Coral é ação e sinal.",
    texto:
      "Ação principal, estado ativo, alerta que exige decisão. Nunca fundo de seção, nunca enfeite de cartão, nunca “para dar vida”. Se tudo é coral, nada é.",
  },
] as const;

/* ── Inventário ───────────────────────────────────────────────────────────
   `onda` separa o que está no ar do que está só planejado. */
type ItemInventario = { onda: "atual" | "proxima"; titulo: string; nota: string; icone: LucideIcon };

const INVENTARIO: ItemInventario[] = [
  { onda: "atual", titulo: "Fundações de cor, tipo, espaço, raio e elevação", nota: "Tokens lidos do CSS, com o px nominal e o px entregue lado a lado e a razão de contraste medida na hora.", icone: Palette },
  { onda: "atual", titulo: "Movimento tokenizado", nota: "Duração, curva, mola e prefers-reduced-motion num lugar só, com o default marcado.", icone: Waves },
  // Estava faltando: a seção existe, tem rota e é um dos dez destinos acima.
  // Inventário que esquece o que já está no ar mente igual ao que promete o
  // que não existe.
  { onda: "atual", titulo: "Linguagem visual da marca", nota: "Fundo gráfico, momento expressivo, campo do NEXO e as assinaturas do ONFACE.", icone: Shapes },
  { onda: "atual", titulo: "Primitivas shadcn reapontadas", nota: "Ponte cf2 → ONFACE: os componentes do CLI falando a marca sem fork.", icone: Boxes },
  { onda: "atual", titulo: "Tabela de dados", nota: "Ordenação, filtro, seleção em massa, densidade e linha expandida.", icone: Database },
  { onda: "atual", titulo: "Gráficos de funil, receita e origem", nota: "Recharts com as séries da marca e coral só na série principal.", icone: ChartArea },
  { onda: "atual", titulo: "Quadro kanban com arraste", nota: "dnd-kit, coluna vazia e cartão urgente marcado por borda.", icone: Kanban },
  { onda: "atual", titulo: "Registro 360 e linha do tempo", nota: "Cabeçalho de entidade, atividades e indicadores de saúde.", icone: Target },
  { onda: "atual", titulo: "NEXO", nota: "Resposta em streaming, passos de execução e cartão de insight.", icone: Sparkles },
  { onda: "atual", titulo: "Layouts de página", nota: "Casca, faixa escura, canvas, bento, mestre-detalhe e estados vazios.", icone: PanelsTopLeft },
  { onda: "atual", titulo: "Agenda", nota: "Mês com categoria por dia, agenda do dia e agendador com faixa de horários.", icone: CalendarDays },
  { onda: "atual", titulo: "Fluxos e passos", nota: "Assistente de proposta, onboarding de implantação e canvas de automação.", icone: Workflow },
  { onda: "atual", titulo: "Padrões de tela", nota: "Convite, configurações com auditoria, changelog e tela de entrada.", icone: LayoutTemplate },

  { onda: "proxima", titulo: "Comunicação e inbox", nota: "Lista de conversas, thread por canal e resposta rápida. Hoje só existe a casca de mestre-detalhe.", icone: MessagesSquare },
  { onda: "proxima", titulo: "Telefonia", nota: "Discador, chamada ativa, transferência e pós-chamada.", icone: PhoneCall },
  { onda: "proxima", titulo: "Semana por hora na agenda", nota: "Grade de horários, conflito e reagendamento por arraste.", icone: CalendarDays },
  { onda: "proxima", titulo: "Document builder", nota: "Blocos de documento, variáveis do negócio e versões. O assistente de proposta cobre só a montagem.", icone: FileText },
  { onda: "proxima", titulo: "Proposta pública", nota: "Página do cliente fora da casca, aceite e assinatura.", icone: FileSignature },
];

/* ── Arranjos da moldura ─────────────────────────────────────────────────
   Só a topbar e o canvas são obrigatórios. A faixa entra quando a página abre
   com decisão; o canvas escuro entra quando a tela é para olhar, não para
   digitar. */
const ARRANJOS = [
  {
    id: "simples" as const,
    rotulo: "Topbar + canvas",
    faixa: false,
    canvas: "claro" as const,
    quando: "O padrão. Lista, tabela, configuração, formulário: a tela começa no conteúdo, sem cabeçalho de módulo.",
  },
  {
    id: "faixa" as const,
    rotulo: "Com faixa",
    faixa: true,
    canvas: "claro" as const,
    quando: "Quando a página abre com decisão: métrica que manda, cabeçalho de módulo, centro de comando. O canvas sobe por baixo da faixa.",
  },
  {
    id: "escuro" as const,
    rotulo: "Canvas escuro",
    faixa: false,
    canvas: "escuro" as const,
    quando: "Tela para olhar, não para digitar: monitoramento, painel de parede, apresentação. Mesma geometria, tokens invertidos no escopo.",
  },
];

type Filtro = "tudo" | "atual" | "proxima";

const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: "tudo", rotulo: "Tudo" },
  { valor: "atual", rotulo: "Nesta onda" },
  { valor: "proxima", rotulo: "Previsto" },
];

/* ── Camadas ──────────────────────────────────────────────────────────────
   A ordem importa: quem pula a casca acaba desenhando a própria página. */
const CAMADAS = [
  {
    id: "casca",
    icone: PanelsTopLeft,
    titulo: "A casca",
    resumo: "OnfaceTopbar + OnfacePage",
    texto:
      "Obrigatório são dois: a topbar grafite fixa e o canvas. A faixa escura é OPCIONAL, entra quando a página abre com decisão (métrica que manda, cabeçalho de módulo, centro de comando) e fica de fora quando a tela é só lista, tabela ou configuração. O canvas também tem dois tons: papel para trabalho denso, grafite para monitoramento, parede e apresentação. A moldura não é decoração, é o alinhamento: o gutter é um só e as colunas caem no mesmo lugar nos três arranjos.",
    codigo:
      "<OnfacePage>\n  {/* faixa só quando a página abre com decisão */}\n  <OnfacePageBand>{cabeçalho}</OnfacePageBand>\n  <OnfacePageSurface sobreposto tom=\"claro\">{conteúdo}</OnfacePageSurface>\n</OnfacePage>",
  },
  {
    id: "primitiva",
    icone: Boxes,
    titulo: "A primitiva",
    resumo: "@/components/ui",
    texto:
      "Botão, campo, seleção, aba, tabela e diálogo vêm do shadcn que já está no repo. A ponte cf2 → ONFACE do ds.css reaponta os tokens que esses componentes consomem, então eles passam a falar ONFACE sem que ninguém edite um arquivo de componente. Componente novo aqui só quando a primitiva não existe.",
    codigo: '<Button variant="default" size="sm">Enviar proposta</Button>',
  },
  {
    id: "produto",
    icone: Layers,
    titulo: "O componente de produto",
    resumo: "@/components/onface",
    texto:
      "O que só existe na Callface: quadro de negócios, linha do tempo do registro, cartão do NEXO, métrica de funil. Ele compõe a casca com as primitivas e fala o domínio, não o widget. É a única camada que conhece etapa, origem, responsável e valor.",
    codigo: "<QuadroNegocios etapas={ETAPAS_QUADRO} negocios={NEGOCIOS} />",
  },
] as const;

type CamadaId = (typeof CAMADAS)[number]["id"];

export function SecaoVisaoGeral() {
  const [filtro, setFiltro] = React.useState<Filtro>("tudo");
  const [arranjo, setArranjo] = React.useState<(typeof ARRANJOS)[number]["id"]>("simples");
  const arranjoAtivo = ARRANJOS.find((a) => a.id === arranjo) ?? ARRANJOS[0];
  const [camada, setCamada] = React.useState<CamadaId>("casca");

  const inventario = INVENTARIO.filter((item) => filtro === "tudo" || item.onda === filtro);
  const ativa = CAMADAS.find((c) => c.id === camada) ?? CAMADAS[0];
  const negocio = NEGOCIOS[0];

  return (
    <Secao
      titulo="ONFACE Design System"
      chamada="A biblioteca da interface do ONFACE, rodando dentro da casca real do produto. Cada página aqui é componente de verdade: o que você clica, arrasta e filtra nesta rota é o mesmo código que a tela de negócios monta."
    >
      {/* Arcos: o fundo de momento de decisão. A regra de ouro é a única coisa
          desta página que decide alguma coisa; o resto é índice. */}
      <Momento
        rotulo="Regra de ouro"
        titulo="Três frases resolvem 90% das decisões de interface"
        apoio="Elas valem antes de qualquer discussão de estilo. Quando duas pessoas discordam de um detalhe, a resposta quase sempre já está aqui."
        variante="arcos"
      >
        <ol className="vg-ouro">
          {REGRAS_OURO.map((regra, indice) => (
            <li key={regra.titulo}>
              <span className="vg-ouro-ordem">{String(indice + 1).padStart(2, "0")}</span>
              <strong>{regra.titulo}</strong>
              <p>{regra.texto}</p>
            </li>
          ))}
        </ol>
      </Momento>

      <Regras
        faca={{
          titulo: "Compor com o que existe",
          texto:
            "Primeira pergunta de toda tela: isto já existe em components/ui ou aqui no laboratório? Se existe, usa. Segunda: dá para compor com duas coisas que existem? Se dá, compõe e para por aí.",
        }}
        naoFaca={{
          titulo: "Abrir um segundo sistema",
          texto:
            "Componente paralelo, hex solto, px solto ou casca própria de tela. Se algo não cabe nos tokens, o que falta é um token novo discutido aqui, não uma exceção escondida em um arquivo.",
        }}
      />

      <Bloco
        titulo="O que tem aqui dentro"
        descricao="Uma rota por seção. O link é o endereço da conversa: em vez de “rola até o meio”, manda-se a URL do componente."
        plano
      >
        {/* Uma superfície só, dividida por fio de 1px: dez cartões soltos
            viram dez molduras competindo. O vão do grid é o separador. */}
        <div className="vg-grade">
          {DESTINOS.map((destino) => {
            const Icone = destino.icone;
            const destaque = "destaque" in destino ? destino.destaque : false;
            return (
              <Link
                key={destino.slug}
                className="vg-cartao"
                data-destaque={destaque ? "true" : undefined}
                href={`/design/onface/${destino.slug}`}
              >
                <span className="vg-cartao-topo">
                  <span className="vg-cartao-icone" aria-hidden="true">
                    <Icone />
                  </span>
                  <strong>{destino.titulo}</strong>
                  {destaque ? <ArrowRight className="vg-cartao-seta" aria-hidden="true" /> : null}
                </span>
                <p>{destino.linha}</p>
                <code>/design/onface/{destino.slug}</code>
              </Link>
            );
          })}
        </div>
      </Bloco>

      <Bloco
        titulo="Inventário"
        descricao="O que está no ar agora e o que está só planejado. Previsto aparece marcado como previsto: nenhuma tela deve ser orçada em cima de componente que ainda não existe."
        plano
        acoes={
          <div className="ds-controle-grupo" role="group" aria-label="Filtrar inventário">
            {FILTROS.map((opcao) => (
              <button
                key={opcao.valor}
                type="button"
                className="ds-chip-filtro"
                data-ativo={filtro === opcao.valor}
                aria-pressed={filtro === opcao.valor}
                onClick={() => setFiltro(opcao.valor)}
              >
                {opcao.rotulo}
              </button>
            ))}
          </div>
        }
      >
        <div className="vg-inventario">
          {inventario.map((item) => {
            const Icone = item.icone;
            const previsto = item.onda === "proxima";
            return (
              <div key={item.titulo} className="vg-item" data-estado={previsto ? "previsto" : "pronto"}>
                {previsto ? <Clock aria-hidden="true" /> : <Check aria-hidden="true" />}
                <span>
                  <strong>{item.titulo}</strong>
                  <small>{item.nota}</small>
                </span>
                {previsto ? (
                  <Badge variant="outline">
                    <Icone aria-hidden="true" />
                    Previsto
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <Icone aria-hidden="true" />
                    No ar
                  </Badge>
                )}
              </div>
            );
          })}
          <p className="vg-contagem">
            <b>{INVENTARIO.filter((i) => i.onda === "atual").length}</b> no ar
            <b>{INVENTARIO.filter((i) => i.onda === "proxima").length}</b> previstos
            <span>
              mostrando {inventario.length} de {INVENTARIO.length}
            </span>
          </p>
        </div>
      </Bloco>

      <Bloco
        titulo="Como isto vira tela"
        descricao="Três camadas, sempre nesta ordem. Clique em uma para ver o que ela resolve e o que ela nunca deve resolver."
        plano
      >
        {/* Seletor e detalhe dividem a mesma superfície: são a mesma coisa em
            dois pedaços, não dois cartões que por acaso estão perto. */}
        <div className="vg-processo">
          <div className="vg-camadas">
            {CAMADAS.map((item, indice) => {
              const Icone = item.icone;
              return (
                <button
                  key={item.id}
                  type="button"
                  className="vg-camada"
                  aria-pressed={camada === item.id}
                  aria-controls="vg-detalhe-camada"
                  onClick={() => setCamada(item.id)}
                >
                  <span className="vg-camada-ordem">
                    <Icone aria-hidden="true" />
                    Camada {indice + 1}
                  </span>
                  <strong>{item.titulo}</strong>
                  <code>{item.resumo}</code>
                </button>
              );
            })}
          </div>

          {/* `key` força a entrada curta a rodar de novo a cada troca de camada. */}
          <div className="vg-detalhe" id="vg-detalhe-camada" key={ativa.id}>
            <div>
              <p>{ativa.texto}</p>
              <code className="vg-codigo">{ativa.codigo}</code>
            </div>

            <div className="vg-prova">
              <span className="vg-prova-rotulo">Na tela</span>

              {ativa.id === "casca" ? (
                <div className="vg-arranjos">
                  {/* Três arranjos, não um. A faixa é opcional e o canvas tem
                      dois tons: o desenho tem que dizer isso, senão a primeira
                      tela que não precisa de faixa vira exceção. */}
                  <div className="vg-arranjo-seletor" role="group" aria-label="Arranjos da moldura">
                    {ARRANJOS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={arranjo === item.id}
                        onClick={() => setArranjo(item.id)}
                      >
                        {item.rotulo}
                      </button>
                    ))}
                  </div>
                  <div className="vg-mini" aria-hidden="true">
                    <i data-parte="topbar">topbar</i>
                    {arranjoAtivo.faixa ? <i data-parte="faixa">faixa escura</i> : null}
                    <i data-parte="canvas" data-tom={arranjoAtivo.canvas}>canvas {arranjoAtivo.canvas}</i>
                  </div>
                  <p className="vg-arranjo-nota">{arranjoAtivo.quando}</p>
                </div>
              ) : null}

              {ativa.id === "primitiva" ? (
                <div className="ds-linha">
                  <Button size="sm">
                    Enviar proposta
                    <ArrowRight />
                  </Button>
                  <Button variant="outline" size="sm">
                    Agendar retorno
                  </Button>
                  <Badge>Proposta</Badge>
                </div>
              ) : null}

              {ativa.id === "produto" ? (
                <div className="vg-mini-negocio">
                  <strong>{negocio.titulo}</strong>
                  <small>
                    {negocio.empresa} · {negocio.origem}
                  </small>
                  <b>{brl(negocio.valor)}</b>
                  <small>
                    {negocio.responsavel.nome} · {negocio.proximaAcao}
                  </small>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </Bloco>
    </Secao>
  );
}
