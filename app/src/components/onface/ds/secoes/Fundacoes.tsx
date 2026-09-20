"use client";

/** ONFACE Design System — Fundações.
 *
 * Todo número desta página sai do navegador, não de uma tabela paralela
 * mantida à mão: a amostra é desenhada com `var(--token)` e a medida exibida
 * é lida de volta com `getComputedStyle`. Documentação redigitada envelhece
 * em silêncio; esta quebra junto com o token no dia em que ele mudar.
 *
 * A escala do ONFACE é em `vw` (`--onface-u`), então a medida em px muda com a
 * largura da janela. Por isso cada amostra reobserva o próprio elemento: o
 * valor na tela é o valor desta janela, agora.
 *
 * E por isso a rampa tipográfica mostra dois números, não um: o NOMINAL (o que
 * a definição do token promete na prancheta de 1440) e o ENTREGUE (o que saiu
 * do navegador depois de `--onface-escala` e do vw). Enquanto só o nominal
 * aparecia, a página dizia "13" e pintava 11,7px — e a divergência não tinha
 * onde aparecer.
 */

import * as React from "react";
import { Circle, Phone } from "lucide-react";
import { Bloco, Regras, Secao } from "../lab";
import { NEGOCIOS, brl } from "../dados";
import "./fundacoes.css";

/* ── Leitura de token ─────────────────────────────────────────────────── */

/** Lê o valor bruto de uma custom property no elemento raiz.
 * Só depois da montagem: no servidor não existe `getComputedStyle`, e o valor
 * depende do atributo de tema que o cliente aplica. */
function useTokens(nomes: readonly string[]) {
  const [valores, setValores] = React.useState<Record<string, string>>({});
  React.useEffect(() => {
    const ler = () => {
      const estilo = getComputedStyle(document.documentElement);
      const lidos: Record<string, string> = {};
      for (const nome of nomes) lidos[nome] = estilo.getPropertyValue(nome).trim();
      setValores(lidos);
    };
    ler();
    // O tema ONFACE é aplicado na raiz por efeito (OnfaceThemeRoot). Observar o
    // atributo garante a releitura se a ordem dos efeitos mudar ou se o tema
    // trocar: sem isso a página mostraria amostra colorida e valor vazio.
    const observador = new MutationObserver(ler);
    observador.observe(document.documentElement, { attributeFilter: ["data-onface-theme"] });
    return () => observador.disconnect();
  }, [nomes]);
  return valores;
}

/** Mede no elemento a propriedade que o token produziu.
 * O ResizeObserver é sobre o próprio elemento: quando `--onface-u` muda, a
 * amostra muda de tamanho e a leitura se atualiza sozinha, sem listener de
 * resize global disparando dezenas de renders por arrasto de janela. */
function useMedida(propriedade: string) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [medida, setMedida] = React.useState("");
  React.useEffect(() => {
    const alvo = ref.current;
    if (!alvo) return;
    const ler = () => setMedida(getComputedStyle(alvo).getPropertyValue(propriedade));
    ler();
    const observador = new ResizeObserver(ler);
    observador.observe(alvo);
    return () => observador.disconnect();
  }, [propriedade]);
  return { ref, medida };
}

/** Arredonda a leitura do navegador: `13.104px` não ajuda ninguém. */
function arredondar(valor: string) {
  const numero = Number.parseFloat(valor);
  if (!Number.isFinite(numero)) return valor;
  return `${(Math.round(numero * 10) / 10).toString().replace(".", ",")}px`;
}

/** Piso de legibilidade, em px ENTREGUES.
 *
 * Existe porque o nominal do token e o que o navegador pinta são dois números
 * diferentes: `--onface-u` é em vw e ainda passa por `--onface-escala`. Com a
 * escala em 0.9 e a janela na prancheta de 1440, 1u ≈ 0,9px — então `--text-md`
 * ("13") entrega 11,7px e `--text-2xs` ("10") entrega 9px.
 *
 * A regra: rótulo que o operador precisa ler não desce abaixo de 11px
 * entregues. Quem não alcança é marcado na própria linha, contra a medida que
 * o navegador acabou de produzir — piso declarado em prosa ninguém confere. */
const PISO_LEGIVEL_PX = 11;

/** Linha padrão: nome do token, amostra de verdade, medida lida, uso. */
function Amostra({
  token,
  emU,
  uso,
  propriedade,
  classe,
  estilo,
  aplicarPiso,
  children,
}: {
  token: string;
  /** Definição do token em unidades de desenho. `null` = não é medida (pílula). */
  emU: number | null;
  uso: string;
  propriedade: string;
  classe: string;
  estilo?: React.CSSProperties;
  /** Só a rampa tipográfica responde ao piso: raio e espaço não são leitura. */
  aplicarPiso?: boolean;
  children?: React.ReactNode;
}) {
  const { ref, medida } = useMedida(propriedade);
  const entregue = Number.parseFloat(medida);
  const abaixoDoPiso = aplicarPiso && Number.isFinite(entregue) && entregue < PISO_LEGIVEL_PX;
  return (
    <div className="fnd-linha">
      <code className="fnd-token">{token}</code>
      <div className="fnd-amostra">
        <div ref={ref} className={classe} style={estilo}>
          {children}
        </div>
      </div>
      {/* Três linhas, não uma: a definição em unidades, o px NOMINAL (1u = 1px
          na prancheta de 1440, então é o px que o token promete) e o px
          ENTREGUE (o que o navegador pintou nesta janela, já com
          `--onface-escala` e o vw aplicados). Enquanto só um número aparecia,
          a rampa dizia 13 e entregava 11,7. */}
      <span className="fnd-medida">
        <b>{emU === null ? "pílula" : `${emU}u`}</b>
        {emU === null ? null : <em>{emU}px nominal</em>}
        {medida ? (
          <em data-abaixo-do-piso={abaixoDoPiso ? "true" : undefined}>{arredondar(medida)} entregue</em>
        ) : null}
      </span>
      <span className="fnd-uso">{uso}</span>
    </div>
  );
}

/* ── Cor ──────────────────────────────────────────────────────────────── */

type Papel = "fundo" | "linha";
type Sobre = "cartao" | "casca" | "acento" | "acento-profundo";
type ItemCor = { token: string; papel: Papel; sobre?: Sobre; uso: string };

/** Planos de superfície. São desenhados encaixados um dentro do outro porque é
 * assim que existem no produto: o que a pessoa precisa enxergar não é o hex de
 * cada um, é o degrau entre dois vizinhos. Um cartão por token esconde
 * exatamente a única informação que essa amostra deveria provar. */
type Plano = { token: string; rotulo: string; uso: string };

const PLANOS_CLAROS: Plano[] = [
  { token: "--surface-page", rotulo: "Página", uso: "Fundo da aplicação" },
  { token: "--surface-card", rotulo: "Cartão", uso: "Cartão, tabela, popover" },
  { token: "--surface-sunken", rotulo: "Rebaixado", uso: "Coluna de quadro, fundo de demo" },
];

const PLANOS_ESCUROS: Plano[] = [
  { token: "--surface-shell", rotulo: "Casca", uso: "Topbar, moldura, menu escuro" },
  { token: "--surface-shell-raised", rotulo: "Elevado na casca", uso: "Bloco dentro da casca" },
];

/** Papéis de texto. Aqui a amostra não é uma pastilha colorida: é a frase de
 * verdade, no tamanho de verdade, sobre a superfície de verdade — e ao lado a
 * razão de contraste que o navegador acabou de produzir. */
type PapelTexto = { token: string; sobre: Sobre; uso: string };

const PAPEIS_TEXTO: PapelTexto[] = [
  { token: "--text-strong", sobre: "cartao", uso: "Título, valor, nome do registro" },
  { token: "--text-body", sobre: "cartao", uso: "Corpo de leitura" },
  { token: "--text-muted", sobre: "cartao", uso: "Apoio, descrição, rótulo" },
  { token: "--text-subtle", sobre: "cartao", uso: "Meta e carimbo de hora. No limite: não serve para corpo de texto." },
  { token: "--status-success-strong", sobre: "cartao", uso: "Texto de sucesso" },
  { token: "--status-danger", sobre: "cartao", uso: "Erro, perda, fora do SLA" },
  { token: "--text-on-shell", sobre: "casca", uso: "Texto sobre grafite" },
  { token: "--text-on-shell-muted", sobre: "casca", uso: "Apoio sobre grafite: é o slate, e passa" },
  { token: "--status-danger-dark", sobre: "casca", uso: "Erro dentro da casca escura" },
  { token: "--onface-cinza", sobre: "casca", uso: "O que o DS pedia para esse papel. Reprovado: é esta linha que justifica o slate acima." },
  { token: "--text-on-accent", sobre: "acento", uso: "Reprovado para rótulo: é esta linha que justifica o coral profundo abaixo." },
  { token: "--text-on-accent", sobre: "acento-profundo", uso: "O mesmo branco, um grau de coral mais fundo. É o preenchimento de todo coral que carrega texto." },
];

const ROTULO_SOBRE: Record<Sobre, string> = {
  cartao: "Sobre cartão branco",
  casca: "Sobre a casca grafite",
  acento: "Sobre coral da marca · --onface-coral",
  "acento-profundo": "Sobre coral profundo · --onface-coral-deep",
};

const ACENTOS: { grupo: string; nota: string; itens: ItemCor[] }[] = [
  {
    grupo: "Coral",
    nota: "O único acento da marca. Ação e sinal: botão principal, item ativo, seleção, alerta que exige decisão. Nunca fundo de seção nem enfeite. São dois tons e a divisão é por contraste, não por gosto: coral da marca onde não há texto por cima (fill, borda, ícone, ponto, série de gráfico) e coral profundo em todo preenchimento que carrega rótulo.",
    itens: [
      { token: "--onface-coral", papel: "fundo", uso: "Fill sem texto, borda, ícone, série principal" },
      { token: "--onface-coral-deep", papel: "fundo", uso: "Coral com rótulo por cima: botão, badge cheio, chip e aba ativa" },
      { token: "--onface-coral-hover", papel: "fundo", uso: "Hover da ação" },
      { token: "--onface-coral-mark", papel: "fundo", uso: "Marca e logotipo" },
      { token: "--onface-coral-subtle", papel: "fundo", uso: "Fundo de seleção e insight" },
      { token: "--onface-coral-border", papel: "fundo", uso: "Borda de área selecionada" },
    ],
  },
  {
    grupo: "Status e linha",
    nota: "Estado é significado, não gosto: no ONFACE não existe amarelo de aviso, atenção é o próprio coral. A linha é o que separa superfície de superfície, no lugar da sombra.",
    itens: [
      { token: "--status-success", papel: "fundo", uso: "Indicador de sucesso" },
      { token: "--status-danger", papel: "fundo", uso: "Erro, perda, fora do SLA" },
      { token: "--status-attention", papel: "fundo", uso: "Atenção: é o coral, de propósito" },
      { token: "--line-hairline", papel: "linha", uso: "Borda de cartão, divisória de tabela" },
      { token: "--line-on-shell", papel: "linha", sobre: "casca", uso: "Divisória dentro da casca" },
    ],
  },
];

const TOKENS_LIDOS: readonly string[] = [
  ...PLANOS_CLAROS.map((p) => p.token),
  ...PLANOS_ESCUROS.map((p) => p.token),
  ...PAPEIS_TEXTO.map((p) => p.token),
  ...ACENTOS.flatMap((grupo) => grupo.itens.map((item) => item.token)),
  "--surface-accent-subtle",
  "--ring-inset-hairline",
  "--shadow-card",
  "--shadow-popover",
  "--shadow-popover-shell",
  "--onface-escala",
];

function fundoDe(sobre: Sobre | undefined) {
  if (sobre === "casca") return "var(--surface-shell)";
  if (sobre === "acento") return "var(--surface-accent)";
  if (sobre === "acento-profundo") return "var(--onface-coral-deep)";
  return "var(--surface-card)";
}

/* ── Prova de contraste ───────────────────────────────────────────────────
   O número não é digitado: sai do par cor/fundo que o navegador pintou, pela
   fórmula da WCAG 2. Se alguém trocar um token para um tom "só um pouco mais
   claro", a linha correspondente muda de veredito sozinha. */

const PISO_CORPO = 4.5;
const PISO_GRANDE = 3;

/** Razão em pt-BR: o resto da página escreve número com vírgula. */
const razaoTexto = (valor: number) => `${valor.toFixed(1).replace(".", ",")}:1`;

/** Extrai os canais de uma cor resolvida ("rgb(18, 23, 29)"). */
function canais(cor: string) {
  const partes = cor.match(/[\d.]+/g);
  if (!partes || partes.length < 3) return null;
  // Alfa zero é superfície transparente, não cor: quem pinta é o ancestral.
  if (partes[3] === "0") return null;
  return [Number(partes[0]), Number(partes[1]), Number(partes[2])] as const;
}

/** Luminância relativa da WCAG 2. */
function luminancia([r, g, b]: readonly [number, number, number]) {
  const canal = (valor: number) => {
    const s = valor / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/** Primeiro ancestral realmente pintado. A linha de texto não sabe em que
 * superfície ela foi colocada; quem sabe é o DOM. */
function fundoPintado(no: HTMLElement | null) {
  for (let atual = no; atual; atual = atual.parentElement) {
    const cor = canais(getComputedStyle(atual).backgroundColor);
    if (cor) return cor;
  }
  return null;
}

function LinhaPapel({ item, exemplo, valor }: { item: PapelTexto; exemplo: string; valor?: string }) {
  const ref = React.useRef<HTMLParagraphElement | null>(null);
  const [razao, setRazao] = React.useState<number | null>(null);

  // `valor` só muda quando os tokens são lidos (ou relidos na troca de tema):
  // é o gatilho certo para remedir, sem depender da ordem dos efeitos.
  React.useEffect(() => {
    const no = ref.current;
    if (!no) return;
    const frente = canais(getComputedStyle(no).color);
    const fundo = fundoPintado(no);
    if (!frente || !fundo) return;
    const a = luminancia(frente);
    const b = luminancia(fundo);
    setRazao((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05));
  }, [valor]);

  const veredito =
    razao === null ? null : razao >= PISO_CORPO ? "aprovado" : razao >= PISO_GRANDE ? "limite" : "reprovado";

  return (
    <div className="fnd-papel">
      <p ref={ref} className="fnd-papel-texto" style={{ color: `var(${item.token})` }}>
        {exemplo}
      </p>
      <code>{item.token}</code>
      <span className="fnd-veredito" data-veredito={veredito ?? undefined}>
        <b>{razao === null ? "—" : razaoTexto(razao)}</b>
        {veredito ?? "medindo"}
      </span>
      <span className="fnd-papel-uso">{item.uso}</span>
    </div>
  );
}

/** Os planos se desenham encaixados: cada um é filho do anterior. */
function PlanosEncaixados({
  itens,
  tinta,
  valores,
}: {
  itens: Plano[];
  tinta: "clara" | "escura";
  valores: Record<string, string>;
}) {
  const [atual, ...resto] = itens;
  if (!atual) return null;
  return (
    <div className="fnd-plano" data-tinta={tinta} style={{ background: `var(${atual.token})` }}>
      <span className="fnd-plano-topo">
        <strong>{atual.rotulo}</strong>
        <code>{atual.token}</code>
        <small>{valores[atual.token] || "—"}</small>
      </span>
      <p>{atual.uso}</p>
      <PlanosEncaixados itens={resto} tinta={tinta} valores={valores} />
    </div>
  );
}

function AmostraCor({ item, valor }: { item: ItemCor; valor?: string }) {
  const { token, papel, sobre } = item;
  return (
    <div className="fnd-cor">
      {papel === "fundo" ? (
        <div className="fnd-cor-chip" style={{ background: `var(${token})` }} />
      ) : (
        <div className="fnd-cor-chip" style={{ background: fundoDe(sobre) }}>
          <i style={{ background: `var(${token})` }} />
        </div>
      )}
      <code>{token}</code>
      <small>{valor || "—"}</small>
      <small className="fnd-cor-uso">{item.uso}</small>
    </div>
  );
}

/* ── Escalas ──────────────────────────────────────────────────────────── */

const TIPOGRAFIA: { token: string; emU: number; fonte: "display" | "ui"; uso: string }[] = [
  { token: "--display-section", emU: 32, fonte: "display", uso: "Título de tela na faixa escura" },
  { token: "--display-kpi", emU: 25, fonte: "display", uso: "Número de indicador" },
  { token: "--display-title", emU: 18, fonte: "display", uso: "Nome do registro, título de cartão" },
  { token: "--text-lg", emU: 16, fonte: "ui", uso: "Texto de destaque, chamada" },
  { token: "--text-base", emU: 14, fonte: "ui", uso: "Título de bloco, item de menu" },
  { token: "--text-md", emU: 13, fonte: "ui", uso: "Corpo padrão da interface" },
  { token: "--text-sm", emU: 12, fonte: "ui", uso: "Apoio, meta, navegação" },
  { token: "--text-xs", emU: 11, fonte: "ui", uso: "Cabeçalho de tabela, hora" },
  { token: "--text-2xs", emU: 10, fonte: "ui", uso: "Rótulo em caixa alta" },
];

const ESPACOS = [4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48];

const USO_ESPACO: Record<number, string> = {
  4: "Colar rótulo no valor",
  6: "Ícone e texto no mesmo item",
  8: "Itens de uma mesma linha",
  10: "Padding interno de chip",
  12: "Gap de grade, padding de cartão pequeno",
  16: "Padding de cartão, gap de bloco",
  20: "Padding de demo e painel",
  24: "Gutter da página",
  32: "Distância entre blocos",
  40: "Respiro de estado vazio",
  48: "Corte entre seções da tela",
};

const RAIOS: { token: string; emU: number | null; uso: string }[] = [
  { token: "--radius-xs", emU: 4, uso: "Barra de gráfico, marca pequena" },
  { token: "--radius-sm", emU: 6, uso: "Ícone com fundo" },
  { token: "--radius-md", emU: 8, uso: "Item de menu, avatar quadrado" },
  { token: "--radius-control", emU: 10, uso: "Botão, campo, seleção" },
  { token: "--radius-lg", emU: 12, uso: "Bloco interno, cartão de quadro" },
  { token: "--radius-card", emU: 12, uso: "Cartão de conteúdo, tabela" },
  { token: "--radius-card-lg", emU: 16, uso: "Painel, popover grande" },
  { token: "--radius-pill-nav", emU: 20, uso: "Pílula da navegação" },
  { token: "--radius-canvas", emU: 40, uso: "Canvas claro da página" },
  { token: "--radius-full", emU: null, uso: "Avatar, badge, indicador" },
];

const CONTROLES: { token: string; emU: number; uso: string }[] = [
  { token: "--control-xs", emU: 24, uso: "Ação dentro de célula de tabela" },
  { token: "--control-sm", emU: 28, uso: "Chip de filtro, botão compacto" },
  { token: "--control-md", emU: 32, uso: "Botão de barra, item de navegação" },
  { token: "--control-lg", emU: 36, uso: "Botão padrão de tela" },
  { token: "--control-form", emU: 40, uso: "Campo de formulário" },
  { token: "--control-cta", emU: 44, uso: "Ação principal e alvo de toque" },
];

const ICONES: { token: string; emU: number; uso: string }[] = [
  { token: "--icon-xs", emU: 12, uso: "Chevron, seta de ordenação" },
  { token: "--icon-sm", emU: 16, uso: "Padrão: menu, botão, lista" },
  { token: "--icon-md", emU: 18, uso: "Utilitário do topbar" },
  { token: "--icon-lg", emU: 20, uso: "Estado vazio, figura de destaque" },
];

/* ── Densidade e breakpoints ──────────────────────────────────────────── */

type Densidade = "compacta" | "padrao" | "confortavel";

const DENSIDADES: { valor: Densidade; rotulo: string; texto: string }[] = [
  { valor: "compacta", rotulo: "Compacta", texto: "Operação o dia inteiro na mesma tela: tabela de negócios, fila de tarefas, coluna de quadro. Prioridade é quantidade de linhas visíveis sem rolar." },
  { valor: "padrao", rotulo: "Padrão", texto: "O default de tudo. Leitura de registro, formulário, painel. Se a tela não tem motivo para ser outra coisa, é esta." },
  { valor: "confortavel", rotulo: "Confortável", texto: "Tela de leitura e de apresentação: resumo, proposta, reunião com cliente. Menos linhas, mais respiro, nada de rolagem apressada." },
];

const BREAKPOINTS: { largura: number; rotulo: string; muda: string[] }[] = [
  {
    largura: 1440,
    rotulo: "Prancheta",
    muda: [
      "1u = 1px: a tela é exatamente o desenho aprovado.",
      "Navegação em pílula completa, com descritor da marca e perfil com nome e cargo.",
      "Laboratório com índice fixo à esquerda e conteúdo à direita.",
    ],
  },
  {
    largura: 1280,
    rotulo: "Laptop",
    muda: [
      "Nada troca de forma: não existe breakpoint aqui, de propósito.",
      "A unidade encolhe junto com a janela, então é a mesma tela em tamanho menor.",
      "Trocar a aparência no meio do caminho faria o mesmo produto parecer dois.",
    ],
  },
  {
    largura: 1024,
    rotulo: "Tablet",
    muda: [
      "Abaixo de 1024: descritor e régua da marca somem do topbar.",
      "O perfil fica só com o avatar; nome e cargo saem.",
      "Gutter do topbar cai para o passo tablet.",
      "Abaixo de 1100 o índice do laboratório vira barra rolável no topo.",
    ],
  },
  {
    largura: 768,
    rotulo: "Limite do desktop",
    muda: [
      "Último ponto com pílula de navegação e casca de desktop.",
      "Abaixo de 820 a moldura da página encolhe o gutter e a borda grafite.",
      "Abaixo de 768 a escala é recalibrada: a unidade passa a acompanhar a largura do telefone.",
    ],
  },
  {
    largura: 390,
    rotulo: "Telefone",
    muda: [
      "Topbar compacto; a navegação vira folha lateral, não menu sobre menu.",
      "Alvos de toque sobem para 44px e o ajuste sai do topbar para a folha.",
      "Quadro e bento caem para uma coluna; a tabela rola na horizontal dentro do próprio container.",
    ],
  },
];

export function SecaoFundacoes() {
  const tokens = useTokens(TOKENS_LIDOS);
  const [densidade, setDensidade] = React.useState<Densidade>("padrao");
  const [breakpoint, setBreakpoint] = React.useState(1440);
  const [larguraAtual, setLarguraAtual] = React.useState<number | null>(null);

  // Saber em que faixa a janela está agora é o que transforma a tabela de
  // breakpoints em algo verificável: dá para arrastar a janela e conferir.
  React.useEffect(() => {
    const ler = () => setLarguraAtual(window.innerWidth);
    ler();
    window.addEventListener("resize", ler, { passive: true });
    return () => window.removeEventListener("resize", ler);
  }, []);

  const faixaAtual = larguraAtual === null ? null : (BREAKPOINTS.find((b) => larguraAtual >= b.largura) ?? BREAKPOINTS[BREAKPOINTS.length - 1]);
  const faixa = BREAKPOINTS.find((b) => b.largura === breakpoint) ?? BREAKPOINTS[0];
  const exemploTipo = NEGOCIOS[0].empresa;
  // Frase de produto, não "Lorem": nome próprio, separador e valor é o pior
  // caso real de leitura de um papel de texto na interface.
  const exemploTexto = `${NEGOCIOS[0].responsavel.nome} · ${NEGOCIOS[0].etapa} · ${brl(NEGOCIOS[0].valor)}`;

  return (
    <Secao
      titulo="Fundações"
      chamada="Cor, tipografia, espaço, raio, controle, ícone, elevação, densidade e breakpoint. Cada amostra desta página é desenhada com o próprio token e a medida ao lado é lida de volta do navegador, então o que está escrito aqui não tem como divergir do CSS."
    >
      <Bloco
        titulo="Cor"
        descricao="Papéis, não nomes de cor. Um componente pede “superfície de cartão” ou “texto de apoio”; nunca pede branco ou cinza."
        fundo="sunken"
      >
        <div className="fnd-grupos">
          <div className="fnd-grupo">
            <h3>Superfícies</h3>
            <p>
              Papel é a página, branco é o cartão, grafite é a casca. Os planos aparecem encaixados porque é
              assim que existem na tela: o que importa é o degrau entre dois vizinhos, não o hex isolado de
              cada um.
            </p>
            <div className="fnd-corte">
              <PlanosEncaixados itens={PLANOS_CLAROS} tinta="clara" valores={tokens} />
              <PlanosEncaixados itens={PLANOS_ESCUROS} tinta="escura" valores={tokens} />
            </div>
          </div>

          <div className="fnd-grupo">
            <h3>Texto</h3>
            <p>
              Cada papel tem um trabalho: título, corpo, apoio e meta. A amostra é a frase de verdade sobre a
              superfície de verdade, e a razão ao lado é medida no navegador pela fórmula da WCAG. Piso de{" "}
              {razaoTexto(PISO_CORPO)} para corpo de texto; entre {razaoTexto(PISO_GRANDE)} e{" "}
              {razaoTexto(PISO_CORPO)} só serve para texto grande e elemento de interface.
            </p>
            {(Object.keys(ROTULO_SOBRE) as Sobre[]).map((sobre) => (
              <div className="fnd-papeis" data-sobre={sobre} key={sobre}>
                <span className="fnd-papeis-rotulo">{ROTULO_SOBRE[sobre]}</span>
                {PAPEIS_TEXTO.filter((papel) => papel.sobre === sobre).map((papel) => (
                  <LinhaPapel
                    key={papel.token}
                    item={papel}
                    exemplo={exemploTexto}
                    valor={tokens[papel.token]}
                  />
                ))}
              </div>
            ))}
            <p className="fnd-nota">
              É esta tabela que decide <code>--text-on-shell-muted</code>: o cinza do DS reprova sobre o
              grafite, o slate é o degrau seguinte da mesma rampa e passa. E é ela que decide{" "}
              <code>--onface-coral-deep</code>: branco sobre o coral da marca reprova, sobre o coral
              profundo passa, e os dois planos estão aí em cima um debaixo do outro para a diferença ser
              lida como medida. Contraste funcional não se resolve no olho — se resolve aqui, e depois se
              discute estética.
            </p>
          </div>

          {ACENTOS.map((grupo) => (
            <div className="fnd-grupo" key={grupo.grupo}>
              <h3>{grupo.grupo}</h3>
              <p>{grupo.nota}</p>
              <div className="fnd-cores">
                {grupo.itens.map((item) => (
                  <AmostraCor key={item.token} item={item} valor={tokens[item.token]} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Bloco>

      <Bloco
        titulo="Tipografia"
        descricao="Uma rampa, duas famílias. Os tokens display usam a face de display e carregam hierarquia; os tokens text usam a face de interface e carregam leitura. Os apelidos --display-nav e --display-label são os mesmos 12u e 10u da rampa text, nomeados pelo lugar onde aparecem."
        fundo="sunken"
      >
        {/* A rampa é densa de propósito: linha com o mesmo respiro do 32u para
            o 10u faz a escala parecer plana, que é o oposto do que ela é. */}
        <div className="fnd-tabela" data-densa="true">
          {TIPOGRAFIA.map((linha) => (
            <Amostra
              key={linha.token}
              token={linha.token}
              emU={linha.emU}
              uso={linha.uso}
              propriedade="font-size"
              /* Família e peso vêm da classe: o token display é de display e o
                 token text é de interface. Não é escolha por linha. */
              classe={`fnd-tipo fnd-tipo-${linha.fonte}`}
              estilo={{ fontSize: `var(${linha.token})` }}
              aplicarPiso
            >
              {exemploTipo}
            </Amostra>
          ))}
        </div>
        <p className="fnd-nota">
          Duas colunas de medida porque são dois números. O <b>nominal</b> é o que a definição do token
          diz, na prancheta de 1440, onde 1u = 1px. O <b>entregue</b> é o que o navegador acabou de
          pintar nesta janela: <code>--onface-u</code> é em <code>vw</code> e ainda passa por{" "}
          <code>--onface-escala: {tokens["--onface-escala"] || "—"}</code>, então o mesmo token vale
          outro px em cada largura. Com a escala em 0,9 na prancheta, 1u ≈ 0,9px e o “13” do{" "}
          <code>--text-md</code> chega como 11,7px.
        </p>
        <p className="fnd-nota">
          <b>Piso: {PISO_LEGIVEL_PX}px entregues</b> para qualquer rótulo que o operador precise ler de
          verdade. Abaixo disso a linha se marca sozinha acima, com a medida do navegador do lado. Na
          prática: <code>--text-2xs</code> é rótulo em caixa alta com tracking, nunca texto de trabalho —
          nome de token, valor, hora e legenda começam em <code>--text-xs</code>. Se o piso reprovar
          degraus demais nesta janela, o que se ajusta é <code>--onface-escala</code>, que é global, nunca
          o tamanho de um componente solto.
        </p>
      </Bloco>

      <Bloco
        titulo="Espaço"
        descricao="Passo de 4 unidades. Espaço não é sobra: é o que agrupa. Se dois elementos precisam de uma distância que não está aqui, o problema é a hierarquia, não a escala."
        fundo="sunken"
      >
        <div className="fnd-tabela">
          {ESPACOS.map((passo) => (
            <Amostra
              key={passo}
              token={`--space-${passo}`}
              emU={passo}
              uso={USO_ESPACO[passo] ?? ""}
              propriedade="width"
              classe="fnd-barra"
              estilo={{ width: `var(--space-${passo})` }}
            />
          ))}
        </div>
      </Bloco>

      <Bloco
        titulo="Raio"
        descricao="O raio diz o tamanho do objeto. Controle é 10u, cartão é 12u, painel é 16u, canvas é 40u. Um mesmo componente nunca muda de raio entre estados."
        fundo="sunken"
      >
        <div className="fnd-tabela">
          {RAIOS.map((raio) => (
            <Amostra
              key={raio.token}
              token={raio.token}
              emU={raio.emU}
              uso={raio.uso}
              propriedade="border-top-left-radius"
              classe="fnd-raio"
              estilo={{ borderRadius: `var(${raio.token})` }}
            />
          ))}
        </div>
      </Bloco>

      <Bloco
        titulo="Altura de controle"
        descricao="Toda primitiva interativa mede uma destas alturas. É o que faz botão, campo e seleção se alinharem na mesma barra sem ajuste manual."
        fundo="sunken"
      >
        <div className="fnd-tabela">
          {CONTROLES.map((controle) => (
            <Amostra
              key={controle.token}
              token={controle.token}
              emU={controle.emU}
              uso={controle.uso}
              propriedade="height"
              classe="fnd-controle"
              estilo={{ height: `var(${controle.token})` }}
            >
              Enviar proposta
            </Amostra>
          ))}
        </div>
      </Bloco>

      <Bloco
        titulo="Ícone"
        descricao="Quatro tamanhos, sempre lucide-react, sempre herdando currentColor. Ícone acompanha o estado do texto ao lado; não tem cor própria."
        fundo="sunken"
      >
        <div className="fnd-tabela">
          {ICONES.map((icone) => (
            <Amostra
              key={icone.token}
              token={icone.token}
              emU={icone.emU}
              uso={icone.uso}
              propriedade="width"
              classe="fnd-icone"
              estilo={{ width: `var(${icone.token})`, height: `var(${icone.token})` }}
            >
              <Phone aria-hidden="true" />
            </Amostra>
          ))}
        </div>
      </Bloco>

      <Bloco
        titulo="Elevação"
        descricao="A superfície do ONFACE é plana. O que define um bloco é a linha de 1px e o anel interno; sombra fica reservada ao que realmente flutua sobre o conteúdo."
        fundo="sunken"
      >
        <div className="fnd-elevacoes">
          <div className="fnd-elev" data-tom="cartao">
            <strong>Cartão, tabela, bloco</strong>
            <p>Sem sombra. Limite por hairline e anel interno, do jeito que a casca inteira é construída.</p>
            <code>--ring-inset-hairline · --shadow-card: {tokens["--shadow-card"] || "none"}</code>
          </div>
          <div className="fnd-elev" data-tom="popover">
            <strong>Popover no canvas claro</strong>
            <p>Flutua sobre o conteúdo e precisa se descolar dele. Sombra curta, difusa e sem cor de marca.</p>
            <code>--shadow-popover: {tokens["--shadow-popover"] || "—"}</code>
          </div>
          <div className="fnd-elev" data-tom="casca">
            <strong>Popover sobre a casca</strong>
            <p>Sobre grafite a mesma sombra some. Este token existe para menu, notificações e folha mobile.</p>
            <code>--shadow-popover-shell: {tokens["--shadow-popover-shell"] || "—"}</code>
          </div>
        </div>
      </Bloco>

      <Regras
        faca={{
          titulo: "Elevação por hairline",
          texto:
            "Superfície se define por linha de 1px e anel interno. Sombra só no que flutua de verdade: popover, menu, diálogo, folha e cartão sendo arrastado.",
        }}
        naoFaca={{
          titulo: "Hex ou px na tela",
          texto:
            "Nenhum valor cru dentro de componente: cor sai de token e medida sai de calc(N * var(--onface-u)). E sombra colorida está fora: sombra é neutra, coral é preenchimento, texto ou borda.",
        }}
      />

      <Bloco
        titulo="Densidade"
        descricao="Densidade muda o respiro vertical da linha, nunca o tamanho da fonte nem a altura do controle. O tamanho aparente do produto inteiro tem um dial só, --onface-escala, e ele é global."
        fundo="sunken"
        acoes={
          <div className="ds-controle-grupo" role="group" aria-label="Densidade da lista">
            {DENSIDADES.map((opcao) => (
              <button
                key={opcao.valor}
                type="button"
                className="ds-chip-filtro"
                data-ativo={densidade === opcao.valor}
                aria-pressed={densidade === opcao.valor}
                onClick={() => setDensidade(opcao.valor)}
              >
                {opcao.rotulo}
              </button>
            ))}
          </div>
        }
      >
        {/* `key` remonta a lista a cada troca: a densidade muda o padding, e
            padding não se anima (layout thrash, e o texto pula junto). A
            continuidade vem de um crossfade curto em opacity, no lugar. */}
        <div className="fnd-densidade" data-densidade={densidade} key={densidade}>
          {NEGOCIOS.slice(0, 4).map((negocio) => (
            <div className="fnd-dens-linha" key={negocio.id}>
              <span>
                <strong>{negocio.titulo}</strong>
                <small>
                  {negocio.empresa} · {negocio.etapa} · {negocio.responsavel.nome}
                </small>
              </span>
              <b>{brl(negocio.valor)}</b>
            </div>
          ))}
        </div>
        <p className="fnd-nota">
          {DENSIDADES.find((d) => d.valor === densidade)?.texto} Escala global agora:{" "}
          <code>--onface-escala: {tokens["--onface-escala"] || "—"}</code>. Mexer nela muda a tela inteira nas
          mesmas proporções; ajustar componente solto para “caber mais” é o que produz duas telas diferentes.
        </p>
      </Bloco>

      <Bloco
        titulo="Breakpoints"
        descricao="A escala fluida faz quase todo o trabalho: entre os extremos a tela encolhe inteira, em proporção. Breakpoint aqui é exceção, e só existe onde a forma precisa mesmo mudar."
        fundo="sunken"
        acoes={
          <div className="ds-controle-grupo" role="group" aria-label="Largura de referência">
            {BREAKPOINTS.map((opcao) => (
              <button
                key={opcao.largura}
                type="button"
                className="ds-chip-filtro"
                data-ativo={breakpoint === opcao.largura}
                aria-pressed={breakpoint === opcao.largura}
                /* O rótulo visível é só o número: o nome da faixa fica no nome
                   acessível para o botão não ser lido como "1440" solto. */
                aria-label={`${opcao.largura} pixels · ${opcao.rotulo}`}
                onClick={() => setBreakpoint(opcao.largura)}
              >
                {opcao.largura}
              </button>
            ))}
          </div>
        }
      >
        <strong className="fnd-bp-titulo">
          {faixa.largura} · {faixa.rotulo}
        </strong>
        <ul className="fnd-bp-lista">
          {faixa.muda.map((regra) => (
            <li key={regra}>
              <Circle aria-hidden="true" />
              <span>{regra}</span>
            </li>
          ))}
        </ul>
        <p className="fnd-bp-atual">
          {larguraAtual === null
            ? "Medindo a janela…"
            : `Esta janela está em ${larguraAtual}px — faixa ${faixaAtual?.rotulo ?? "—"}. Arraste a borda e confira.`}
        </p>
      </Bloco>
    </Secao>
  );
}
