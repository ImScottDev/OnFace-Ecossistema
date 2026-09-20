"use client";

/** ONFACE Design System — layouts.
 *
 * Esta seção existe por um sintoma: toda tela do produto estava saindo igual
 * (título, quatro cartões do mesmo tamanho, tabela). O resultado é uma
 * interface sem hierarquia, em que o operador lê tudo para descobrir o que
 * importa. O que está documentado aqui é o contrário disso: grade de pesos
 * diferentes, lista com registro ao lado, painéis que o usuário dimensiona —
 * e um mapa honesto de quais padrões o sistema já sabe montar. */

import * as React from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  CircleDashed,
  Clock,
  Inbox,
  Mail,
  MessageSquare,
  PhoneCall,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bloco, Chave, Playground, Regras, Secao, Vazio } from "../lab";
import { Momento } from "../marca";
import { Bento, BentoCartao, MestreDetalhe, PainelDividido } from "../bento";
import { LinhaDoTempo, Metrica } from "../crm";
import { AreaComparativa, FunilComercial, RoscaOrigem } from "../graficos";
import { CelulaSituacao } from "../DataGrid";
import {
  ATIVIDADES,
  CONVERSAS,
  FUNIL,
  INSIGHTS,
  NEGOCIOS,
  RECEITA_SEMANAL,
  RESPONSAVEIS,
  brl,
  compacto,
  type Conversa,
} from "../dados";
import "../layouts.css";

/* ── Números derivados dos dados, não inventados ───────────────────────── */
const RECEITA_GANHA = FUNIL.find((etapa) => etapa.etapa === "Ganho")?.valor ?? 0;
const EM_PROPOSTA = FUNIL.find((etapa) => etapa.etapa === "Proposta");
/* Negócio perdido também está "sem tarefa", mas ele não está parado: acabou.
   Somar os R$ 88.000 do Atende Já como valor represado infla o número em 3x e
   manda a pessoa atrás de um negócio que não existe mais. Recorte é regra de
   negócio, não filtro de tela. */
const SEM_TAREFA = NEGOCIOS.filter(
  (n) => n.situacao === "sem-tarefa" && n.etapa !== "Ganho" && n.etapa !== "Perdido",
);
const VALOR_PARADO = SEM_TAREFA.reduce((total, n) => total + n.valor, 0);
/* Data do mais antigo, direto do dado. Nada de "há 9 dias" calculado com
   `Date.now()`: o servidor e o cliente renderizariam textos diferentes, e o
   número envelheceria sozinho na documentação. */
const DIA_MES = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
const ENTRADA_MAIS_ANTIGA = SEM_TAREFA.reduce(
  (antiga, n) => (n.criadoEm < antiga ? n.criadoEm : antiga),
  SEM_TAREFA[0]?.criadoEm ?? "",
);
const OITO_SEMANAS = RECEITA_SEMANAL.slice(-8).map((ponto) => ponto.atual);
const TAREFAS = NEGOCIOS.filter((n) => n.situacao === "hoje" || n.situacao === "atrasado");

/* ── Segunda camada dos cartões de apoio ───────────────────────────────────
   Cada prévia sai do mesmo dado que o número em cima dela, nunca de valor
   escrito à mão: prévia inventada é pior que cartão vazio, porque o vazio ao
   menos não mente. Duas linhas é o teto de propósito — a terceira já estaria
   competindo com o herói. */
const MAIORES_PROPOSTAS = NEGOCIOS.filter((n) => n.etapa === "Proposta")
  .sort((a, b) => b.valor - a.valor)
  .slice(0, 2);

const PARADOS_MAIS_ANTIGOS = [...SEM_TAREFA].sort((a, b) => a.criadoEm.localeCompare(b.criadoEm)).slice(0, 2);

const NEGOCIACAO_MAIS_ANTIGOS = NEGOCIOS.filter((n) => n.etapa === "Negociação")
  .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm))
  .slice(0, 2);

/* Etapas que mais seguram valor em aberto. É o desdobramento direto do número
   "negócios em aberto" do cartão. */
const ETAPAS_EM_ABERTO = FUNIL.filter((f) => f.etapa !== "Ganho")
  .sort((a, b) => b.valor - a.valor)
  .slice(0, 2);

const dataCurta = (iso: string) => DIA_MES.format(new Date(`${iso}T12:00:00Z`));

type LinhaPrevia = { chave: string; rotulo: string; valor: string };

/** Cartão de apoio do bento com a segunda camada.
 *
 * Sem ela o apoio estica junto com o herói e fica oco: o número ocupa o topo e
 * o resto é ar que ninguém escolheu. A prévia responde a pergunta seguinte de
 * quem leu o número ("quais?") e é ela que absorve a altura da grade. */
function ApoioBento({ metrica, previa }: { metrica: React.ReactNode; previa: LinhaPrevia[] }) {
  return (
    <div className="lay-apoio">
      {metrica}
      {/* `div`/`span` e não `ul`/`li`: metade destes cartões é um `button`
          clicável, e `button` só aceita conteúdo de frase. A semântica de lista
          seria descartada de qualquer jeito, porque o botão já carrega
          `aria-label` com o destino. */}
      <div className="lay-apoio-previa">
        {previa.map((linha) => (
          <div key={linha.chave}>
            <span>{linha.rotulo}</span>
            <b>{linha.valor}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

const ICONE_CANAL = {
  whatsapp: MessageSquare,
  email: Mail,
  ligacao: PhoneCall,
} as const;

/* ── Galeria: o mapa de padrões ────────────────────────────────────────────
   `estado` é o compromisso da biblioteca, não a vontade dela. "parcial" quer
   dizer que a estrutura existe mas o miolo do padrão ainda não; prometer
   "pronto" aqui vira retrabalho na sprint que orçar a tela. */
type EstadoPadrao = "pronto" | "parcial" | "previsto";
type TomBloco = "fraco" | "forte" | "risco";
type LinhaDiagrama = { altura: "fina" | "media" | "alta"; blocos: { peso: number; tom?: TomBloco }[] };
type Padrao = {
  nome: string;
  linha: string;
  estado: EstadoPadrao;
  onde: string;
  diagrama: LinhaDiagrama[];
};

const PADROES: Padrao[] = [
  {
    nome: "Página padrão",
    linha: "Topbar grafite, faixa escura de cabeçalho e canvas claro por baixo. Toda tela nasce aqui.",
    estado: "pronto",
    onde: "OnfacePage",
    diagrama: [
      { altura: "fina", blocos: [{ peso: 1, tom: "forte" }] },
      { altura: "media", blocos: [{ peso: 1, tom: "forte" }] },
      { altura: "alta", blocos: [{ peso: 1, tom: "fraco" }] },
    ],
  },
  {
    nome: "Lista",
    linha: "Registros em linhas de leitura, sem colunas. Serve quando o que importa é o título e uma ação.",
    estado: "parcial",
    onde: "compõe com BarraFiltros",
    diagrama: [
      { altura: "fina", blocos: [{ peso: 1, tom: "forte" }] },
      { altura: "media", blocos: [{ peso: 1, tom: "fraco" }] },
      { altura: "media", blocos: [{ peso: 1, tom: "fraco" }] },
      { altura: "media", blocos: [{ peso: 1, tom: "fraco" }] },
    ],
  },
  {
    nome: "Tabela",
    linha: "Muitas colunas comparáveis, ordenação, filtro, seleção em massa e densidade.",
    estado: "pronto",
    onde: "/design/onface/dados",
    diagrama: [
      { altura: "fina", blocos: [{ peso: 1, tom: "forte" }] },
      { altura: "fina", blocos: [{ peso: 3 }, { peso: 2 }, { peso: 1 }, { peso: 1 }] },
      { altura: "fina", blocos: [{ peso: 3 }, { peso: 2 }, { peso: 1 }, { peso: 1 }] },
      { altura: "fina", blocos: [{ peso: 3 }, { peso: 2 }, { peso: 1 }, { peso: 1 }] },
    ],
  },
  {
    nome: "Mestre-detalhe",
    linha: "Lista de um lado, registro inteiro do outro. Trabalho em fila sem sair da tela.",
    estado: "pronto",
    onde: "MestreDetalhe",
    diagrama: [
      { altura: "fina", blocos: [{ peso: 1, tom: "forte" }, { peso: 2, tom: "forte" }] },
      { altura: "alta", blocos: [{ peso: 1, tom: "fraco" }, { peso: 2 }] },
    ],
  },
  {
    nome: "Bento",
    linha: "Grade de 4 colunas com pesos diferentes. Uma coisa manda e o resto apoia.",
    estado: "pronto",
    onde: "Bento",
    diagrama: [
      { altura: "media", blocos: [{ peso: 2, tom: "forte" }, { peso: 1 }, { peso: 1 }] },
      { altura: "media", blocos: [{ peso: 1 }, { peso: 1 }] },
    ],
  },
  {
    nome: "Centro de comando",
    linha: "Herói, gráfico, insight do NEXO, histórico e fila do dia numa tela só.",
    estado: "pronto",
    onde: "Bento C",
    diagrama: [
      { altura: "fina", blocos: [{ peso: 2, tom: "forte" }, { peso: 1 }, { peso: 1 }] },
      { altura: "media", blocos: [{ peso: 1 }, { peso: 1, tom: "fraco" }] },
      { altura: "fina", blocos: [{ peso: 1, tom: "fraco" }] },
    ],
  },
  {
    nome: "Registro 360",
    linha: "Cabeçalho de entidade, abas, linha do tempo e indicadores do cliente.",
    estado: "pronto",
    onde: "/design/onface/registro",
    diagrama: [
      { altura: "media", blocos: [{ peso: 1, tom: "forte" }] },
      { altura: "fina", blocos: [{ peso: 1 }, { peso: 1 }, { peso: 1 }, { peso: 3, tom: "risco" }] },
      { altura: "alta", blocos: [{ peso: 2, tom: "fraco" }, { peso: 1 }] },
    ],
  },
  {
    nome: "Assistente / Wizard",
    linha: "Passos numerados com um objetivo por tela. Importação, onboarding, configuração longa.",
    estado: "previsto",
    onde: "próxima onda",
    diagrama: [
      { altura: "fina", blocos: [{ peso: 1, tom: "forte" }, { peso: 1, tom: "risco" }, { peso: 1, tom: "risco" }] },
      { altura: "alta", blocos: [{ peso: 1, tom: "fraco" }] },
      { altura: "fina", blocos: [{ peso: 3, tom: "risco" }, { peso: 1 }] },
    ],
  },
  {
    nome: "Editor de documento",
    linha: "Edição de um lado, prévia do outro. A estrutura existe; blocos e variáveis, não.",
    estado: "parcial",
    onde: "PainelDividido",
    diagrama: [
      { altura: "fina", blocos: [{ peso: 1, tom: "forte" }] },
      { altura: "alta", blocos: [{ peso: 1 }, { peso: 1, tom: "fraco" }] },
    ],
  },
  {
    nome: "Calendário",
    linha: "Grade de semana, evento, conflito de horário e reagendamento por arraste.",
    estado: "previsto",
    onde: "próxima onda",
    diagrama: [
      { altura: "fina", blocos: [{ peso: 1, tom: "forte" }] },
      {
        altura: "media",
        blocos: [{ peso: 1 }, { peso: 1, tom: "fraco" }, { peso: 1 }, { peso: 1, tom: "fraco" }, { peso: 1 }, { peso: 1, tom: "fraco" }, { peso: 1 }],
      },
      {
        altura: "media",
        blocos: [{ peso: 1, tom: "fraco" }, { peso: 1 }, { peso: 1, tom: "fraco" }, { peso: 1 }, { peso: 1, tom: "fraco" }, { peso: 1 }, { peso: 1, tom: "fraco" }],
      },
    ],
  },
  {
    nome: "Quadro",
    linha: "Kanban por etapa, com arraste real e coluna vazia que explica o que fazer.",
    estado: "pronto",
    onde: "/design/onface/quadro",
    diagrama: [
      { altura: "fina", blocos: [{ peso: 1, tom: "forte" }, { peso: 1, tom: "forte" }, { peso: 1, tom: "forte" }, { peso: 1, tom: "forte" }] },
      { altura: "alta", blocos: [{ peso: 1, tom: "fraco" }, { peso: 1, tom: "fraco" }, { peso: 1, tom: "fraco" }, { peso: 1, tom: "risco" }] },
    ],
  },
  {
    nome: "Caixa de entrada",
    linha: "Fila de conversas, thread por canal e ficha do cliente ao lado. Falta a thread.",
    estado: "parcial",
    onde: "MestreDetalhe",
    diagrama: [
      { altura: "fina", blocos: [{ peso: 1, tom: "forte" }, { peso: 2, tom: "forte" }, { peso: 1, tom: "forte" }] },
      { altura: "alta", blocos: [{ peso: 1, tom: "fraco" }, { peso: 2 }, { peso: 1, tom: "fraco" }] },
    ],
  },
  {
    nome: "Configurações",
    linha: "Navegação por área à esquerda, formulário longo à direita, salvamento por seção.",
    estado: "previsto",
    onde: "próxima onda",
    diagrama: [
      { altura: "fina", blocos: [{ peso: 1, tom: "forte" }] },
      { altura: "alta", blocos: [{ peso: 1, tom: "fraco" }, { peso: 3, tom: "risco" }] },
    ],
  },
  {
    nome: "Página pública / proposta",
    linha: "Fora da casca: o cliente abre sem login, lê a proposta e aceita.",
    estado: "previsto",
    onde: "próxima onda",
    diagrama: [
      { altura: "media", blocos: [{ peso: 1, tom: "forte" }] },
      { altura: "alta", blocos: [{ peso: 1, tom: "fraco" }] },
      { altura: "fina", blocos: [{ peso: 2, tom: "risco" }, { peso: 1 }] },
    ],
  },
];

const FILTROS: { valor: EstadoPadrao | "tudo"; rotulo: string }[] = [
  { valor: "tudo", rotulo: "Tudo" },
  { valor: "pronto", rotulo: "Tem componente" },
  { valor: "parcial", rotulo: "Parcial" },
  { valor: "previsto", rotulo: "Próximo passo" },
];

function SeloEstado({ estado }: { estado: EstadoPadrao }) {
  if (estado === "pronto") {
    return (
      <Badge variant="secondary">
        <Check aria-hidden />
        Pronto
      </Badge>
    );
  }
  if (estado === "parcial") {
    return (
      <Badge variant="outline">
        <CircleDashed aria-hidden />
        Parcial
      </Badge>
    );
  }
  return (
    <Badge variant="outline">
      <Clock aria-hidden />
      Previsto
    </Badge>
  );
}

/* Diagrama é figura, não conteúdo: quem lê por leitor de tela já recebe nome,
   descrição e estado em texto logo acima. */
function Diagrama({ linhas }: { linhas: LinhaDiagrama[] }) {
  return (
    <div className="lay-diagrama" aria-hidden>
      {linhas.map((linha, i) => (
        <div key={i} className="lay-diagrama-linha" data-altura={linha.altura}>
          {linha.blocos.map((bloco, j) => (
            <i key={j} className="lay-diagrama-bloco" data-tom={bloco.tom} style={{ flexGrow: bloco.peso }} />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ── Proposta de exemplo do editor ─────────────────────────────────────── */
const NEGOCIO = NEGOCIOS[0];
const VARIAVEIS: Record<string, string> = {
  empresa: NEGOCIO.empresa,
  produto: NEGOCIO.produto,
  valor: brl(NEGOCIO.valor),
  responsavel: NEGOCIO.responsavel.nome,
};
const MODELO = `Proposta comercial — {{empresa}}

Implantação de {{produto}} com 40 ramais, portabilidade dos números atuais e treinamento da equipe em duas sessões.

Investimento: {{valor}} com 12 meses de contrato.

Qualquer ajuste, me chama. — {{responsavel}}`;

export function SecaoLayouts() {
  const [escuro, setEscuro] = React.useState(true);
  const [filtro, setFiltro] = React.useState<EstadoPadrao | "tudo">("tudo");
  const [texto, setTexto] = React.useState(MODELO);

  // Substituição na hora da leitura: o documento guarda a variável, nunca o
  // valor. Gravar o valor congela a proposta no dia em que foi escrita.
  const previa = texto.replace(/\{\{(\w+)\}\}/g, (bruto, chave: string) => VARIAVEIS[chave] ?? bruto);

  const padroes = PADROES.filter((padrao) => filtro === "tudo" || padrao.estado === filtro);
  const tomEscuro = escuro ? ("escuro" as const) : undefined;

  return (
    <Secao
      titulo="Layouts"
      chamada="O sistema de layout do ONFACE. Bento para hierarquia, mestre-detalhe para trabalho em fila, painel dividido para quem precisa dimensionar a própria tela — e o mapa honesto de quais padrões o produto já sabe montar."
    >
      <Bloco
        titulo="Bento A · métrica herói"
        descricao="Um número manda na tela e o resto apoia. O herói não é só mais largo: o valor sobe para o dobro da escala do KPI comum, porque largura sozinha não cria hierarquia — quatro cartões de tamanhos diferentes com números do mesmo tamanho continuam sendo quatro cartões iguais. Apoio não é cartão pela metade: cada um traz as duas primeiras linhas do que está contando, porque quem lê “14 em proposta” pergunta “quais?” em seguida — e porque cartão de apoio ao lado de herói alto estica e fica oco se não tiver segunda camada. Os dois são clicáveis: a borda muda no hover porque eles levam a algum lugar. Repare também nos dois sinais: verde é resultado consumado (a receita subiu) e coral é o que exige ação agora (negócio parado) — cores diferentes com formas diferentes, nunca a mesma seta em duas cores."
        fundo="sunken"
      >
        <Bento rotulo="Resumo comercial do mês">
          <BentoCartao span="larga" destaque superficie={false}>
            <Metrica
              rotulo="Receita ganha no mês"
              valor={brl(RECEITA_GANHA)}
              apoio="11 negócios fechados"
              tendencia={{ variacao: 18.4, rotulo: "vs. mês anterior" }}
              faixa={OITO_SEMANAS}
            />
          </BentoCartao>

          <BentoCartao
            superficie={false}
            aoAbrir={() => toast("Abrindo os 14 negócios em Proposta")}
            rotuloAcesso="Abrir negócios em proposta"
          >
            <ApoioBento
              metrica={
                <Metrica
                  rotulo="Em proposta"
                  valor={compacto(EM_PROPOSTA?.valor ?? 0)}
                  apoio={`${EM_PROPOSTA?.quantidade ?? 0} negócios`}
                />
              }
              previa={MAIORES_PROPOSTAS.map((n) => ({
                chave: n.id,
                rotulo: n.empresa,
                valor: compacto(n.valor),
              }))}
            />
          </BentoCartao>

          <BentoCartao
            superficie={false}
            aoAbrir={() => toast(`Abrindo ${SEM_TAREFA.length} negócios sem tarefa`)}
            rotuloAcesso="Abrir negócios sem tarefa"
          >
            <ApoioBento
              metrica={
                <Metrica
                  rotulo="Sem próxima tarefa"
                  valor={String(SEM_TAREFA.length)}
                  apoio="negócios parados"
                  /* Era uma pílula de tendência "+12% na semana" com a MESMA seta
                     da pílula verde "+18,4%" do herói, na mesma linha. Duas
                     famílias de sinal com a mesma forma: o olho lê dois
                     indicadores de variação e precisa parar para descobrir que um
                     é comemoração e o outro é alarme. Além disso o número nem era
                     uma variação de performance — é um estado que pede ação.
                     Regra do sistema: verde = resultado consumado, coral = exige
                     ação agora, e coral não leva seta. */
                  icone={<span className="lay-sinal">Exige ação</span>}
                />
              }
              previa={PARADOS_MAIS_ANTIGOS.map((n) => ({
                chave: n.id,
                rotulo: n.empresa,
                valor: `desde ${dataCurta(n.criadoEm)}`,
              }))}
            />
          </BentoCartao>

          <BentoCartao
            span="cheia"
            titulo="Receita por semana"
            apoio="12 semanas, contra o mesmo intervalo anterior"
          >
            <AreaComparativa />
          </BentoCartao>
        </Bento>
      </Bloco>

      <Bloco
        titulo="Bento B · a evidência primeiro"
        descricao="Inverte a ordem quando a pergunta da tela é “onde está travando”: o gráfico vem inteiro no topo e os três apoios explicam o que ele mostra. Mesma grade, hierarquia diferente."
        fundo="sunken"
      >
        <Bento rotulo="Diagnóstico do funil">
          <BentoCartao span="cheia" titulo="Funil por etapa" apoio="Negócios abertos e taxa de passagem">
            <FunilComercial />
          </BentoCartao>

          <BentoCartao span="larga" titulo="Origem dos negócios" apoio="Participação nos últimos 90 dias">
            <RoscaOrigem />
          </BentoCartao>

          <BentoCartao superficie={false}>
            <ApoioBento
              metrica={
                <Metrica
                  rotulo="Passagem para proposta"
                  valor="38%"
                  apoio="média de 12 semanas"
                  tendencia={{ variacao: -9, rotulo: "vs. trimestre" }}
                />
              }
              previa={ETAPAS_EM_ABERTO.map((etapa) => ({
                chave: etapa.etapa,
                rotulo: etapa.etapa,
                valor: `${etapa.quantidade} · ${compacto(etapa.valor)}`,
              }))}
            />
          </BentoCartao>

          <BentoCartao superficie={false}>
            <ApoioBento
              metrica={<Metrica rotulo="Tempo em negociação" valor="11 d" apoio="mediana" tendencia={{ variacao: 4.2, invertido: true }} />}
              previa={NEGOCIACAO_MAIS_ANTIGOS.map((n) => ({
                chave: n.id,
                rotulo: n.empresa,
                valor: `desde ${dataCurta(n.criadoEm)}`,
              }))}
            />
          </BentoCartao>
        </Bento>
      </Bloco>

      <Bloco
        titulo="Bento C · centro de comando"
        descricao="A tela de abrir o dia, com as duas naturezas que ela tem. A faixa grafite do topo é a área de decisão: uma coisa só, o que está travando dinheiro agora, e um botão. Abaixo dela a grade clara é a área operacional, onde se lê número, gráfico e fila. É a troca de superfície que separa as duas — se a tela inteira fosse grafite, não existiria nem decisão nem operação, só um painel escuro."
        fundo="sunken"
      >
        <Bento rotulo="Centro de comando comercial">
          {/* Momento = superfície grafite com fundo gráfico. Entra aqui porque
              muda o que a pessoa faz em seguida; um cartão que só informa não
              ganha esse tratamento, ou o recurso deixa de significar algo. */}
          <BentoCartao span="cheia" superficie={false}>
            <Momento
              rotulo="Decisão do dia"
              titulo={`${SEM_TAREFA.length} negócios sem próxima tarefa seguram ${brl(VALOR_PARADO)}`}
              apoio="Nada sai do lugar sozinho: enquanto não houver tarefa marcada, esses negócios não aparecem na fila de ninguém e o valor fica parado no funil sem estar ganho nem perdido."
              variante="arcos"
              acoes={
                <Button onClick={() => toast(`Abrindo ${SEM_TAREFA.length} negócios parados`)}>
                  Marcar as tarefas agora
                  <ArrowUpRight />
                </Button>
              }
            >
              <div className="lay-momento-numeros">
                <span className="lay-momento-numero">
                  <b className="ds-momento-numero">{SEM_TAREFA.length}</b>
                  <span>negócios parados</span>
                </span>
                <span className="lay-momento-numero">
                  <b className="ds-momento-numero">{compacto(VALOR_PARADO)}</b>
                  <span>valor represado</span>
                </span>
                <span className="lay-momento-numero">
                  <b className="ds-momento-numero">{DIA_MES.format(new Date(`${ENTRADA_MAIS_ANTIGA}T12:00:00Z`))}</b>
                  <span>o mais antigo entrou em</span>
                </span>
              </div>
            </Momento>
          </BentoCartao>

          <BentoCartao span="larga" destaque superficie={false}>
            <Metrica
              rotulo="Receita ganha no mês"
              valor={brl(RECEITA_GANHA)}
              apoio="meta de R$ 460.000"
              tendencia={{ variacao: 18.4 }}
              faixa={OITO_SEMANAS}
            />
          </BentoCartao>

          <BentoCartao superficie={false}>
            <ApoioBento
              metrica={<Metrica rotulo="Negócios em aberto" valor="75" apoio={compacto(1484400)} />}
              previa={ETAPAS_EM_ABERTO.map((etapa) => ({
                chave: etapa.etapa,
                rotulo: etapa.etapa,
                valor: `${etapa.quantidade} · ${compacto(etapa.valor)}`,
              }))}
            />
          </BentoCartao>

          <BentoCartao superficie={false}>
            <ApoioBento
              metrica={<Metrica rotulo="No-show da semana" valor="31%" apoio="9 de 29 reuniões" tendencia={{ variacao: -6, invertido: true }} />}
              /* Desdobramento aritmético do que o apoio já diz (9 de 29), não
                 número novo: a prévia não pode saber mais do que o dado. */
              previa={[
                { chave: "realizadas", rotulo: "Realizadas", valor: "20" },
                { chave: "no-show", rotulo: "Sem comparecimento", valor: "9" },
              ]}
            />
          </BentoCartao>

          <BentoCartao span="larga" titulo="Receita por semana" apoio="período atual contra o anterior">
            <AreaComparativa />
          </BentoCartao>

          <BentoCartao span="larga" alta titulo="Atividade recente" apoio="todos os responsáveis">
            <LinhaDoTempo eventos={ATIVIDADES.slice(0, 5)} densidade="compacta" comFiltro={false} />
          </BentoCartao>

          <BentoCartao span="larga" superficie={false}>
            <div className="ds-insight">
              <span className="ds-nexo-marca" aria-hidden>
                <Sparkles />
              </span>
              <div>
                <strong>{INSIGHTS[0].titulo}</strong>
                <p>{INSIGHTS[0].detalhe}</p>
                <div className="lay-insight-acao">
                  <Button size="sm" onClick={() => toast("Filtrando os 6 negócios parados")}>
                    {INSIGHTS[0].acao}
                    <ArrowUpRight />
                  </Button>
                </div>
              </div>
            </div>
          </BentoCartao>

          <BentoCartao
            span="cheia"
            titulo="Fila de hoje"
            apoio={`${TAREFAS.length} negócios pedem ação hoje`}
            acao={
              <Button variant="subtle" size="sm" onClick={() => toast("Abrindo a agenda do dia")}>
                <CalendarDays />
                Ver agenda
              </Button>
            }
          >
            <ul className="lay-lista-simples">
              {TAREFAS.map((negocio) => (
                <li key={negocio.id}>
                  <span className="lay-lista-texto">
                    <strong>{negocio.titulo}</strong>
                    <span>
                      {negocio.empresa} · {negocio.responsavel.nome}
                    </span>
                  </span>
                  <CelulaSituacao texto={negocio.proximaAcao} situacao={negocio.situacao} />
                  <b>{brl(negocio.valor)}</b>
                </li>
              ))}
            </ul>
          </BentoCartao>
        </Bento>
      </Bloco>

      <Bloco
        titulo="Bento sobre a casca escura"
        descricao="A mesma grade e os mesmos cartões, sobre a casca grafite: painel de operação, TV da sala, faixa de topo. A assimetria vale aqui igual: numa TV de operação vista de longe, quatro números do mesmo tamanho obrigam a ler os quatro para achar o que importa. Gráfico não entra de propósito — a casca escura recebe número e rótulo, e o gráfico continua vivendo no canvas claro, onde a grade e os eixos foram calibrados."
        fundo="sunken"
        acoes={
          <Playground>
            <Chave id="lay-bento-escuro" rotulo="Sobre a casca escura" valor={escuro} aoMudar={setEscuro} />
          </Playground>
        }
      >
        <Bento tom={tomEscuro} rotulo="Operação ao vivo">
          {/* Chamadas em andamento é o número que a sala olha o dia inteiro:
              ele manda na grade. Os outros três explicam esse número. */}
          <BentoCartao span="larga" destaque superficie={false}>
            <Metrica tom={tomEscuro} rotulo="Chamadas agora" valor="37" apoio="8 em espera" />
          </BentoCartao>
          {/* Na casca escura a segunda camada continua sendo texto: número e
              rótulo. Gráfico não entra aqui, e a prévia só desdobra o que o
              cartão herói já afirma (37 = 29 em atendimento + 8 em espera). */}
          <BentoCartao superficie={false}>
            <ApoioBento
              metrica={<Metrica tom={tomEscuro} rotulo="Tempo de espera" valor="42 s" apoio="média da hora" />}
              previa={[
                { chave: "atendendo", rotulo: "Em atendimento", valor: "29" },
                { chave: "espera", rotulo: "Na fila", valor: "8" },
              ]}
            />
          </BentoCartao>
          <BentoCartao superficie={false}>
            <ApoioBento
              metrica={<Metrica tom={tomEscuro} rotulo="Reuniões hoje" valor="12" apoio="3 ainda sem confirmação" />}
              previa={[
                { chave: "confirmadas", rotulo: "Confirmadas", valor: "9" },
                { chave: "pendentes", rotulo: "Sem confirmação", valor: "3" },
              ]}
            />
          </BentoCartao>

          <BentoCartao span="larga" superficie={false}>
            <Metrica tom={tomEscuro} rotulo="Ganho hoje" valor={compacto(51200)} apoio="1 contrato assinado" />
          </BentoCartao>

          <BentoCartao span="larga" tom={tomEscuro} titulo="Ritmo do time" apoio="realizado sobre a meta do mês">
            <ul className="lay-lista-simples">
              {RESPONSAVEIS.map((pessoa) => (
                <li key={pessoa.nome}>
                  <span className="lay-lista-texto">
                    <strong>{pessoa.nome}</strong>
                    <span>{Math.round((pessoa.realizado / pessoa.meta) * 100)}% da meta</span>
                  </span>
                  <b>
                    {compacto(pessoa.realizado)} / {compacto(pessoa.meta)}
                  </b>
                </li>
              ))}
            </ul>
          </BentoCartao>
        </Bento>
      </Bloco>

      <Regras
        faca={{
          titulo: "Bento porque a hierarquia pede",
          texto:
            "Antes de desenhar a grade, responda em uma frase qual é a pergunta da tela. O que responde essa pergunta ocupa o espaço grande; o resto apoia em um módulo. Se sobra um cartão que ninguém consegue justificar, ele não vira “normal”, ele sai.",
        }}
        naoFaca={{
          titulo: "Bento porque está na moda",
          texto:
            "Grade irregular sem hierarquia é só desalinho: seis tamanhos diferentes sem motivo cansam mais que quatro cartões iguais. Se todos os blocos têm o mesmo peso de informação, o layout certo é a grade regular, não o bento.",
        }}
      />

      <Bloco
        titulo="Mestre-detalhe"
        descricao="Lista à esquerda, registro à direita. É o layout de quem trabalha em fila: atender, responder, marcar e passar para o próximo sem voltar para uma lista intermediária. As duas metades não são a mesma superfície — a coluna é afundada (índice) e o painel é branco (documento), e o item selecionado é a única placa branca dentro da coluna cinza, com o fio coral na borda de ataque. Clique numa conversa para trocar o painel, use as setas para andar na lista. No telefone a mesma seleção abre uma gaveta, porque duas colunas não cabem."
        fundo="sunken"
      >
        <MestreDetalhe<Conversa>
          itens={CONVERSAS}
          chave={(conversa) => conversa.id}
          titulo={(conversa) => `${conversa.contato} · ${conversa.empresa}`}
          rotuloLista="Conversas"
          cabecalhoLista={
            <>
              <span>Caixa de entrada</span>
              <Badge variant="secondary">{CONVERSAS.reduce((total, c) => total + c.naoLidas, 0)} não lidas</Badge>
            </>
          }
          resumo={(conversa) => {
            const IconeCanal = ICONE_CANAL[conversa.canal];
            return (
              <>
                <Avatar size="sm" aria-hidden>
                  <AvatarFallback>{conversa.iniciais}</AvatarFallback>
                </Avatar>
                <span className="lay-conversa">
                  <span className="lay-conversa-topo">
                    <strong>{conversa.contato}</strong>
                    <small>{conversa.quando}</small>
                  </span>
                  <span className="lay-conversa-canal">
                    <IconeCanal aria-hidden />
                    {conversa.empresa}
                  </span>
                  <span className="lay-conversa-previa">{conversa.previa}</span>
                </span>
              </>
            );
          }}
          detalhe={(conversa) => (
            <div>
              <div className="lay-detalhe-cabecalho">
                <strong>{conversa.contato}</strong>
                <span>
                  {conversa.empresa} · responsável {conversa.responsavel} · canal {conversa.canal}
                </span>
              </div>

              <div className="lay-mensagem">
                {conversa.previa}
                <small>{conversa.contato} · {conversa.quando}</small>
              </div>
              <div className="lay-mensagem" data-lado="nosso">
                Consigo sim. Te mando o PDF ainda hoje com o cronograma de implantação em duas etapas.
                <small>Mayara Ribeiro · agora</small>
              </div>

              <div className="ds-linha" style={{ marginTop: "var(--space-16)" }}>
                <Button size="sm" onClick={() => toast(`Respondendo ${conversa.contato}`)}>
                  Responder
                </Button>
                <Button variant="outline" size="sm" onClick={() => toast(`Abrindo o negócio de ${conversa.empresa}`)}>
                  Abrir negócio
                  <ArrowUpRight />
                </Button>
              </div>
            </div>
          )}
          vazio={
            <Vazio
              icone={<Inbox />}
              titulo="Nenhuma conversa aberta"
              texto="Escolha uma conversa na lista para ver o histórico completo, o negócio ligado a ela e responder sem trocar de tela."
            />
          }
        />
      </Bloco>

      <Bloco
        titulo="Painel dividido"
        descricao="Dois painéis e um divisor que o usuário arrasta. Ninguém concorda com uma proporção fixa: quem escreve quer o editor largo, quem confere quer a prévia larga. Arraste a linha do meio, ou use as setas com o divisor focado (Shift dá o passo grosso, Home e End vão aos limites, duplo clique volta ao início)."
        fundo="sunken"
      >
        <PainelDividido
          rotuloInicio="Editor da proposta"
          rotuloFim="Prévia do cliente"
          rotuloDivisor="Ajustar largura entre editor e prévia"
          proporcao={48}
          minimo={28}
          maximo={72}
          inicio={
            <>
              <Textarea
                className="lay-editor"
                aria-label="Texto da proposta"
                value={texto}
                onChange={(evento) => setTexto(evento.target.value)}
              />
              <div className="lay-variaveis">
                {Object.keys(VARIAVEIS).map((chave) => (
                  <Badge key={chave} variant="outline">{`{{${chave}}}`}</Badge>
                ))}
              </div>
            </>
          }
          fim={
            <div className="lay-previa">
              {previa.split("\n\n").map((paragrafo, i) => (
                <p key={i}>{i === 0 ? <strong>{paragrafo}</strong> : paragrafo}</p>
              ))}
            </div>
          }
        />
      </Bloco>

      <Bloco
        titulo="Galeria de layouts"
        descricao="Os padrões que o sistema prevê, com o estado real de cada um. Pronto tem componente aqui dentro; parcial tem a estrutura mas não o miolo; previsto é próxima onda. Orçar tela em cima de padrão previsto é como orçar em cima de componente que não existe."
        fundo="sunken"
        acoes={
          <div className="ds-controle-grupo" role="group" aria-label="Filtrar padrões por estado">
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
        <div className="lay-galeria">
          {padroes.map((padrao) => (
            <article key={padrao.nome} className="lay-padrao">
              <div className="lay-padrao-topo">
                <strong>{padrao.nome}</strong>
                <SeloEstado estado={padrao.estado} />
              </div>
              <Diagrama linhas={padrao.diagrama} />
              <p>{padrao.linha}</p>
              <code>{padrao.onde}</code>
            </article>
          ))}
        </div>

        <p className="lay-legenda" style={{ marginTop: "var(--space-16)" }}>
          <span>
            <Check aria-hidden />
            {PADROES.filter((p) => p.estado === "pronto").length} com componente nesta biblioteca
          </span>
          <span>
            <CircleDashed aria-hidden />
            {PADROES.filter((p) => p.estado === "parcial").length} com estrutura, sem o miolo
          </span>
          <span>
            <Clock aria-hidden />
            {PADROES.filter((p) => p.estado === "previsto").length} na próxima onda
          </span>
        </p>
      </Bloco>
    </Secao>
  );
}
