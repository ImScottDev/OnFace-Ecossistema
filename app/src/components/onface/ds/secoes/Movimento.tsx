"use client";

/** Seção Movimento do laboratório ONFACE.
 *
 * Nada aqui é descrito: é tocado. A diferença entre 120ms e 280ms, ou entre a
 * mola seca e a gaveta, não existe em texto nem em print — só existe em
 * movimento, lado a lado, no mesmo instante. Por isso cada linha tem gatilho
 * próprio e o grupo inteiro dispara junto.
 *
 * As pistas de token animam pela var CSS (`--duration-*`, `--ease-*`) em vez
 * das constantes de `motion.ts`. Assim a demo é o token, não uma cópia dele, e
 * a média `prefers-reduced-motion` de ds.css zera a demo junto com o produto.
 * O número impresso ao lado vem de `motion.ts`: token e constante aparecem
 * juntos, e uma divergência entre os dois ficaria visível na hora. */

import * as React from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  type Transition,
} from "motion/react";
import {
  Accessibility,
  Check,
  CircleDot,
  Play,
  RotateCcw,
  Send,
  SlidersHorizontal,
  Zap,
} from "lucide-react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { Bloco, Coluna, Regras, Secao } from "../lab";
import { FundoGrafico } from "../marca";
import { CURVA, DURACAO, MOLA, VARIANTES } from "../motion";
import { ATIVIDADES, CONVERSAS, NEGOCIOS, RESPONSAVEIS, brl } from "../dados";
import "./movimento.css";

/* ── Ferramentas de leitura dos tokens ──────────────────────────────────── */

const ms = (segundos: number) => `${Math.round(segundos * 1000)}ms`;

/** As curvas saem congeladas de `motion.ts` (`as const`); o motion pede a
 * tupla mutável. Copiar aqui evita espalhar `as` pelo arquivo. */
const bezier = (c: readonly [number, number, number, number]): [number, number, number, number] => [
  c[0],
  c[1],
  c[2],
  c[3],
];

/** Custom property é a ponte entre a constante escolhida no React e a
 * transição declarada no CSS. Sem isso, a demo teria duração chumbada. */
const tokensDaLinha = (duracao: string, curva: string) =>
  ({ "--ds-mov-duracao": duracao, "--ds-mov-curva": curva }) as React.CSSProperties;

/* `padrao: true` marca o token que se usa quando ninguém tem motivo para usar
   outro. Sem essa marca a pista vira oito trilhos iguais, e quem chega aqui
   para escolher uma duração sai escolhendo pelo nome. O `uso` de cada linha
   responde a outra pergunta, que é quando o default NÃO serve. */
const DURACOES = [
  { chave: "instantaneo", rotulo: "instantâneo", segundos: DURACAO.instantaneo, css: "var(--duration-instant)", padrao: false, uso: "Só quando nada se desloca: cor, opacidade, fundo de linha de tabela. Mais que isso e a mudança acontece antes de o olho acompanhar." },
  { chave: "rapido", rotulo: "rápido", segundos: DURACAO.rapido, css: "var(--duration-fast)", padrao: false, uso: "Resposta ao ponteiro e ao teclado: hover, foco, chip, checkbox, indicador de aba. É o tempo de um retorno, não de uma transição." },
  { chave: "base", rotulo: "base", segundos: DURACAO.base, css: "var(--duration-base)", padrao: true, uso: "O default. Qualquer superfície que abre e fecha no tamanho de um menu: dropdown, popover, tooltip, troca de conteúdo no lugar. Na dúvida, é esta." },
  { chave: "lento", rotulo: "lento", segundos: DURACAO.lento, css: "var(--duration-slow)", padrao: false, uso: "Só para superfície grande, que percorre muita distância: gaveta, folha, diálogo. Em elemento pequeno vira atraso." },
] as const;

const CURVAS = [
  { chave: "padrao", rotulo: "padrão", valor: CURVA.padrao, css: "var(--ease-standard)", padrao: true, uso: "O default. Estado que muda sem sair do lugar: cor, opacidade, seleção, indicador que desliza." },
  { chave: "entrada", rotulo: "entrada", valor: CURVA.entrada, css: "var(--ease-enter)", padrao: false, uso: "Só para algo que chega de fora da tela. Desacelera no fim, então a coisa pousa em vez de bater." },
  { chave: "saida", rotulo: "saída", valor: CURVA.saida, css: "var(--ease-exit)", padrao: false, uso: "Só para algo que vai embora. Acelera e some: o que sai não merece o tempo do que chega." },
  { chave: "enfase", rotulo: "ênfase", valor: CURVA.enfase, css: "var(--ease-emphasized)", padrao: false, uso: "Reservada a overlay grande, painel e transição de página. Em botão vira exagero." },
] as const;

const MOLAS = [
  { chave: "suave", rotulo: "suave", valor: MOLA.suave, padrao: false, uso: "Cartão, hover, micro-movimento." },
  { chave: "seca", rotulo: "seca", valor: MOLA.seca, padrao: true, uso: "O default de microinteração: toggle, chip, aba. Resposta imediata, sem sobra." },
  { chave: "gaveta", rotulo: "gaveta", valor: MOLA.gaveta, padrao: false, uso: "Peso de painel, sem quicar." },
  { chave: "arraste", rotulo: "arraste", valor: MOLA.arraste, padrao: false, uso: "Item arrastado voltando ao lugar." },
] as const;

/** Detecção de cliente sem efeito: a resposta do servidor é `false` e a do
 * cliente é `true` já na hidratação, então o rótulo nunca troca no meio. */
const semAssinatura = () => () => {};
const noCliente = () => true;
const noServidor = () => false;

/** "Tocar" leva a bolha até o fim e traz de volta: a curva se lê nos dois
 * sentidos, e o estado volta sozinho para o botão poder ser tocado de novo. */
function useToque() {
  const [ativos, setAtivos] = React.useState<Record<string, boolean>>({});
  const timers = React.useRef(new Map<string, number>());

  React.useEffect(() => {
    const atuais = timers.current;
    return () => atuais.forEach((id) => window.clearTimeout(id));
  }, []);

  const tocar = React.useCallback((chave: string, duracaoIda: number) => {
    window.clearTimeout(timers.current.get(chave));
    setAtivos((a) => ({ ...a, [chave]: true }));
    // Pausa no fim antes da volta, senão a ida e a volta viram um borrão só.
    const espera = duracaoIda * 1000 + 420;
    timers.current.set(
      chave,
      window.setTimeout(() => setAtivos((a) => ({ ...a, [chave]: false })), espera),
    );
  }, []);

  return { ativos, tocar };
}

/* ── Microinterações ────────────────────────────────────────────────────── */

const ABAS = [
  { id: "negocios", rotulo: "Negócios", total: NEGOCIOS.length, apoio: "no funil" },
  { id: "atividades", rotulo: "Atividades", total: ATIVIDADES.length, apoio: "nos últimos 7 dias" },
  { id: "conversas", rotulo: "Conversas", total: CONVERSAS.length, apoio: "abertas" },
] as const;

function AbasDeslizantes({ transicao }: { transicao: Transition }) {
  const [ativa, setAtiva] = React.useState(0);
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

  // Padrão de aba do WAI-ARIA: Tab entra no grupo, seta anda dentro dele.
  function navegar(evento: React.KeyboardEvent<HTMLDivElement>) {
    const passo = evento.key === "ArrowRight" ? 1 : evento.key === "ArrowLeft" ? -1 : 0;
    if (passo === 0) return;
    evento.preventDefault();
    const proxima = (ativa + passo + ABAS.length) % ABAS.length;
    setAtiva(proxima);
    refs.current[proxima]?.focus();
  }

  const aba = ABAS[ativa];

  return (
    <>
      <div className="ds-mov-abas" role="tablist" aria-label="Recorte do painel" onKeyDown={navegar}>
        {ABAS.map((item, indice) => (
          <button
            key={item.id}
            ref={(no) => {
              refs.current[indice] = no;
            }}
            className="ds-mov-aba"
            role="tab"
            type="button"
            id={`ds-mov-aba-${item.id}`}
            aria-selected={indice === ativa}
            aria-controls={`ds-mov-painel-${item.id}`}
            tabIndex={indice === ativa ? 0 : -1}
            onClick={() => setAtiva(indice)}
          >
            {item.rotulo}
            {indice === ativa ? (
              <motion.span className="ds-mov-aba-marca" layoutId="ds-mov-aba-marca" transition={transicao} />
            ) : null}
          </button>
        ))}
      </div>
      <div
        className="ds-mov-painel"
        role="tabpanel"
        id={`ds-mov-painel-${aba.id}`}
        aria-labelledby={`ds-mov-aba-${aba.id}`}
        tabIndex={0}
      >
        <strong>{aba.total}</strong>
        {aba.apoio}
      </div>
    </>
  );
}

const PERIODOS = ["Semana", "Mês", "Trimestre"] as const;

function SegmentedCompartilhado({ transicao }: { transicao: Transition }) {
  const [periodo, setPeriodo] = React.useState<(typeof PERIODOS)[number]>("Mês");

  return (
    <div className="ds-mov-seg" role="group" aria-label="Período do painel">
      {PERIODOS.map((item) => (
        <button
          key={item}
          className="ds-mov-seg-botao"
          type="button"
          aria-pressed={item === periodo}
          onClick={() => setPeriodo(item)}
        >
          {/* A pílula é uma só e muda de dono: dois retângulos em fade dariam
              a impressão de duas superfícies, não de uma seleção que andou. */}
          {item === periodo ? (
            <motion.span className="ds-mov-seg-pilula" layoutId="ds-mov-seg-pilula" transition={transicao} />
          ) : null}
          <span className="ds-mov-seg-rotulo">{item}</span>
        </button>
      ))}
    </div>
  );
}

type EstadoEnvio = "parado" | "carregando" | "sucesso";

const ROTULO_ENVIO: Record<EstadoEnvio, string> = {
  parado: "Enviar proposta",
  carregando: "Enviando",
  sucesso: "Proposta enviada",
};

function BotaoCarregandoSucesso({ transicao }: { transicao: Transition }) {
  const [estado, setEstado] = React.useState<EstadoEnvio>("parado");
  const timers = React.useRef<number[]>([]);

  React.useEffect(() => {
    const atuais = timers.current;
    return () => atuais.forEach((id) => window.clearTimeout(id));
  }, []);

  function enviar() {
    if (estado !== "parado") return;
    setEstado("carregando");
    timers.current.push(window.setTimeout(() => setEstado("sucesso"), 900));
    // O sucesso é um recado, não um estado: some sozinho e o botão volta a
    // servir. Botão que fica verde para sempre vira decoração.
    timers.current.push(window.setTimeout(() => setEstado("parado"), 2300));
  }

  return (
    <Button
      variant={estado === "sucesso" ? "success" : "default"}
      loading={estado === "carregando"}
      onClick={enviar}
    >
      <span className="ds-mov-troca" data-centro="true">
        <AnimatePresence initial={false}>
          <motion.span
            key={estado}
            className="ds-mov-rotulo"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={transicao}
          >
            {estado === "sucesso" ? <Check aria-hidden /> : null}
            {estado === "parado" ? <Send aria-hidden /> : null}
            {ROTULO_ENVIO[estado]}
          </motion.span>
        </AnimatePresence>
      </span>
    </Button>
  );
}

function CartoesSelecionaveis({ transicao }: { transicao: Transition }) {
  const [selecionado, setSelecionado] = React.useState(NEGOCIOS[0].id);

  return (
    <>
      {NEGOCIOS.slice(0, 2).map((negocio) => (
        <button
          key={negocio.id}
          className="ds-mov-cartao"
          type="button"
          aria-pressed={negocio.id === selecionado}
          onClick={() => setSelecionado(negocio.id)}
        >
          <span>
            <strong>{negocio.empresa}</strong>
            <small>
              {negocio.titulo} · {brl(negocio.valor)}
            </small>
          </span>
          <AnimatePresence initial={false}>
            {negocio.id === selecionado ? (
              <motion.span
                className="ds-mov-cartao-marca"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={transicao}
                aria-hidden
              >
                <Check />
              </motion.span>
            ) : null}
          </AnimatePresence>
        </button>
      ))}
    </>
  );
}

function ContadorDeValor({ reduzido }: { reduzido: boolean }) {
  const negocio = NEGOCIOS[3]; // BR Conecta: o maior valor aberto do funil.
  const contagem = useMotionValue(0);
  const [texto, setTexto] = React.useState(() => brl(0));
  const [rodada, setRodada] = React.useState(0);

  useMotionValueEvent(contagem, "change", (valor) => setTexto(brl(Math.round(valor))));

  React.useEffect(() => {
    contagem.set(0);
    const controles = animate(contagem, negocio.valor, {
      // Com movimento reduzido o número aparece pronto: contar é enfeite, o
      // valor é que é informação.
      duration: reduzido ? 0 : DURACAO.lento * 4,
      ease: bezier(CURVA.entrada),
    });
    return () => controles.stop();
  }, [contagem, negocio.valor, reduzido, rodada]);

  return (
    <>
      <p className="ds-mov-contador" aria-live="off">
        {texto}
      </p>
      <p className="ds-mov-nota">
        {negocio.empresa} · {negocio.titulo}
      </p>
      <div>
        <Button size="sm" variant="outline" onClick={() => setRodada((r) => r + 1)}>
          <RotateCcw aria-hidden />
          Recontar
        </Button>
      </div>
    </>
  );
}

function EsqueletoSemFlash({ transicao }: { transicao: Transition }) {
  const [carregando, setCarregando] = React.useState(false);
  const conversa = CONVERSAS[0];

  React.useEffect(() => {
    if (!carregando) return;
    const id = window.setTimeout(() => setCarregando(false), 900);
    return () => window.clearTimeout(id);
  }, [carregando]);

  return (
    <>
      {/* Esqueleto e conteúdo ocupam a MESMA célula do grid e têm a mesma
          geometria: a troca é um cruzamento, não um salto de altura. */}
      <div className="ds-mov-troca">
        <AnimatePresence initial={false}>
          {carregando ? (
            <motion.div
              key="esqueleto"
              className="ds-mov-esqueleto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={transicao}
              aria-hidden
            >
              <Skeleton className="ds-mov-esqueleto-avatar" />
              <span className="ds-mov-esqueleto-linhas">
                <Skeleton className="ds-mov-esqueleto-linha" data-largura="curta" />
                <Skeleton className="ds-mov-esqueleto-linha" data-largura="longa" />
              </span>
            </motion.div>
          ) : (
            <motion.div
              key="conteudo"
              className="ds-mov-conversa"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={transicao}
            >
              <span className="ds-mov-conversa-avatar">{conversa.iniciais}</span>
              <span className="ds-mov-conversa-corpo">
                <strong>
                  {conversa.contato} · {conversa.empresa}
                </strong>
                <small>{conversa.previa}</small>
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div>
        <Button size="sm" variant="outline" onClick={() => setCarregando(true)} disabled={carregando}>
          <RotateCcw aria-hidden />
          Recarregar
        </Button>
      </div>
    </>
  );
}

function ListaEmCascata() {
  const [rodada, setRodada] = React.useState(0);

  return (
    <>
      <motion.ul
        key={rodada}
        className="ds-mov-cascata"
        variants={VARIANTES.lista}
        initial="inicial"
        animate="ativo"
      >
        {ATIVIDADES.slice(0, 4).map((evento) => (
          <motion.li key={evento.id} variants={VARIANTES.item}>
            <i aria-hidden />
            {evento.titulo}
          </motion.li>
        ))}
      </motion.ul>
      <div>
        <Button size="sm" variant="outline" onClick={() => setRodada((r) => r + 1)}>
          <RotateCcw aria-hidden />
          Repetir
        </Button>
      </div>
    </>
  );
}

function ItemDaGaleria({
  titulo,
  regra,
  tecnica,
  children,
}: {
  titulo: string;
  regra: string;
  tecnica: string;
  children: React.ReactNode;
}) {
  return (
    <article className="ds-mov-item">
      <header className="ds-mov-item-topo">
        <strong>{titulo}</strong>
        <small>{tecnica}</small>
      </header>
      {/* O palco é uma superfície rebaixada dentro do painel: a demo precisa
          de um "onde" para o movimento ter contra o quê acontecer. Alvo coral
          sobre superfície neutra, nunca caixa cinza no branco. */}
      <div className="ds-mov-palco">{children}</div>
      <p className="ds-mov-nota">{regra}</p>
    </article>
  );
}

/** Palco grafite das pistas de token.
 *
 * A comparação de tempo e de curva é o momento em que esta seção decide algo:
 * a bolha coral sobre grafite é a leitura mais limpa que existe aqui, e a
 * malha por trás é a régua contra a qual o percurso acontece. Fora daqui a
 * seção volta ao claro — é o contraste entre os dois que faz o palco existir. */
function Palco({ children }: { children: React.ReactNode }) {
  return (
    <div className="ds-mov-palco-escuro">
      <FundoGrafico variante="malha" superficie="escura" intensidade="apagada" />
      <div className="ds-mov-pistas">{children}</div>
    </div>
  );
}

/* ── Seção ──────────────────────────────────────────────────────────────── */

export function SecaoMovimento() {
  const reduzido = useReducedMotion() ?? false;
  const { ativos, tocar } = useToque();

  // `useReducedMotion` só sabe a resposta no cliente. Mostrar antes disso
  // produziria um texto no servidor e outro na hidratação.
  const montado = React.useSyncExternalStore(semAssinatura, noCliente, noServidor);

  /** Único ponto onde o movimento é desligado do lado do JS. As vars de
   * duração já zeram sozinhas no CSS; o motion não lê media query. */
  const semMovimento = React.useCallback(
    (transicao: Transition): Transition => (reduzido ? { duration: 0 } : transicao),
    [reduzido],
  );

  const transicaoSeca = semMovimento(MOLA.seca);
  const transicaoPadrao = semMovimento({ duration: DURACAO.base, ease: bezier(CURVA.padrao) });

  return (
    <Secao
      titulo="Movimento"
      chamada="Duração, curva e mola são token, não número escolhido na hora. O movimento existe para dizer de onde a coisa veio, para onde foi e que o sistema ouviu o clique. Fora disso, ele atrapalha."
    >
      <Bloco
        titulo="Tokens"
        descricao="Toque e compare. A demo anima pela var CSS do token; o valor ao lado vem das constantes de motion.ts. O trilho de borda cheia e selo “padrão” é o default: base (180ms) com a curva padrão. Quem não tem um motivo específico para outro tempo usa esse par; a coluna da direita diz qual é o motivo de cada exceção."
        acoes={
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              DURACOES.forEach((d) => tocar(`dur-${d.chave}`, d.segundos));
              CURVAS.forEach((c) => tocar(`curva-${c.chave}`, DURACAO.lento));
            }}
          >
            <Play aria-hidden />
            Tocar todas
          </Button>
        }
        plano
      >
        <Palco>
          <div className="ds-mov-pista">
            {DURACOES.map((item) => {
              const chave = `dur-${item.chave}`;
              return (
                <div className="ds-mov-linha" key={chave} data-padrao={item.padrao ? "true" : undefined}>
                  <span className="ds-mov-nome">
                    <span className="ds-mov-nome-topo">
                      {item.rotulo}
                      {item.padrao ? <b className="ds-mov-padrao">padrão</b> : null}
                    </span>
                    <small>{ms(item.segundos)}</small>
                  </span>
                  {/* Duração varia, curva fixa: o que se compara é o tempo. */}
                  <button
                    className="ds-mov-trilho"
                    type="button"
                    style={tokensDaLinha(item.css, "var(--ease-standard)")}
                    onClick={() => tocar(chave, item.segundos)}
                    aria-label={`Tocar duração ${item.rotulo}, ${ms(item.segundos)}`}
                  >
                    <span className="ds-mov-bolha" data-fim={ativos[chave] ? "true" : undefined} />
                  </button>
                  <span className="ds-mov-uso">{item.uso}</span>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => tocar(chave, item.segundos)}
                    aria-label={`Tocar ${item.rotulo}`}
                  >
                    <Play aria-hidden />
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="ds-mov-pista">
            {CURVAS.map((item) => {
              const chave = `curva-${item.chave}`;
              const literal = `cubic-bezier(${item.valor.join(", ")})`;
              return (
                <div className="ds-mov-linha" key={chave} data-padrao={item.padrao ? "true" : undefined}>
                  <span className="ds-mov-nome">
                    <span className="ds-mov-nome-topo">
                      {item.rotulo}
                      {item.padrao ? <b className="ds-mov-padrao">padrão</b> : null}
                    </span>
                    <small>{literal}</small>
                  </span>
                  {/* Curva varia sobre a duração lenta: em 80ms nenhuma curva é
                      legível, e a comparação viraria fé. */}
                  <button
                    className="ds-mov-trilho"
                    type="button"
                    style={tokensDaLinha("var(--duration-slow)", item.css)}
                    onClick={() => tocar(chave, DURACAO.lento)}
                    aria-label={`Tocar curva ${item.rotulo}, ${literal}`}
                  >
                    <span className="ds-mov-bolha" data-fim={ativos[chave] ? "true" : undefined} />
                  </button>
                  <span className="ds-mov-uso">{item.uso}</span>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => tocar(chave, DURACAO.lento)}
                    aria-label={`Tocar ${item.rotulo}`}
                  >
                    <Play aria-hidden />
                  </Button>
                </div>
              );
            })}
          </div>
        </Palco>
      </Bloco>

      <Bloco
        titulo="Molas"
        descricao="Clique no alvo para mandá-lo para a outra ponta. A distância vem do layout real, não de um deslocamento escrito à mão: é a mola que decide o caminho. A seca é o default de microinteração; as outras três existem para o peso que elas carregam."
        plano
      >
        <Palco>
          <div className="ds-mov-pista">
            {MOLAS.map((item) => (
              <LinhaDeMola key={item.chave} {...item} transicao={semMovimento(item.valor)} />
            ))}
          </div>
        </Palco>
      </Bloco>

      <Bloco
        titulo="Microinterações obrigatórias"
        descricao="Os oito movimentos que todo produto ONFACE precisa ter iguais. Cada um aqui é o componente de verdade, com estado de verdade."
        plano
      >
        {/* Uma superfície dividida por fio, não oito cartões: o que separa um
            movimento do outro é o alinhamento, não mais uma moldura. */}
        <div className="ds-mov-galeria">
          <ItemDaGaleria
            titulo="Indicador de aba"
            tecnica="layoutId"
            regra="O indicador é um só e troca de dono. Dois indicadores em fade contam a história errada: parece que um apagou e outro acendeu, não que a seleção andou."
          >
            <AbasDeslizantes transicao={transicaoSeca} />
          </ItemDaGaleria>

          <ItemDaGaleria
            titulo="Segmented control"
            tecnica="layoutId"
            regra="Mesma técnica da aba, outro desenho. Quem escolhe período troca de opção muitas vezes seguidas: mola seca, nunca duração longa."
          >
            <SegmentedCompartilhado transicao={transicaoSeca} />
          </ItemDaGaleria>

          <ItemDaGaleria
            titulo="Carregando → sucesso"
            tecnica="AnimatePresence"
            regra="Ação com efeito no servidor tem três estados visíveis. O sucesso é temporário e devolve o botão ao trabalho; o ícone troca junto com o rótulo, senão o usuário lê duas coisas diferentes."
          >
            <BotaoCarregandoSucesso transicao={transicaoPadrao} />
          </ItemDaGaleria>

          <ItemDaGaleria
            titulo="Cartão interativo"
            tecnica="CSS + AnimatePresence"
            regra="Hover é convite (2u de elevação, sem sombra), seleção é estado (borda e fundo coral). O visto entra em escala porque ele aparece, e coisa que aparece não pisca."
          >
            <CartoesSelecionaveis transicao={transicaoSeca} />
          </ItemDaGaleria>

          <ItemDaGaleria
            titulo="Sanfona"
            tecnica="altura animada"
            regra="Abrir empurra o que está abaixo. Sem a altura animada o conteúdo teleporta e a pessoa perde a linha que estava lendo."
          >
            <Accordion type="single" collapsible className="ds-mov-sanfona" defaultValue={RESPONSAVEIS[0].nome}>
              {RESPONSAVEIS.map((pessoa) => (
                <AccordionItem key={pessoa.nome} value={pessoa.nome}>
                  <AccordionTrigger>{pessoa.nome}</AccordionTrigger>
                  <AccordionContent>
                    <span className="ds-mov-sanfona-corpo">
                      <span>
                        Realizado <b>{brl(pessoa.realizado)}</b> de {brl(pessoa.meta)}
                      </span>
                      <span>{Math.round((pessoa.realizado / pessoa.meta) * 100)}% da meta do trimestre</span>
                    </span>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </ItemDaGaleria>

          <ItemDaGaleria
            titulo="Contador de valor"
            tecnica="useMotionValue + animate"
            regra="Só para número que a pessoa acabou de mudar ou que acabou de chegar. Contar tudo em toda montagem de tela transforma o painel em cassino."
          >
            <ContadorDeValor reduzido={reduzido} />
          </ItemDaGaleria>

          <ItemDaGaleria
            titulo="Esqueleto → conteúdo"
            tecnica="grid empilhado"
            regra="O esqueleto tem a geometria do conteúdo e ocupa a mesma célula. Sem isso a caixa colapsa entre os dois e a tela pisca — é o flash que o carregamento deveria evitar."
          >
            <EsqueletoSemFlash transicao={transicaoPadrao} />
          </ItemDaGaleria>

          <ItemDaGaleria
            titulo="Lista em cascata"
            tecnica="VARIANTES.lista"
            regra="Passo de 35ms e só nos primeiros itens. Cascata longa é espera disfarçada: a lista inteira precisa terminar antes de a pessoa poder agir."
          >
            <ListaEmCascata />
          </ItemDaGaleria>
        </div>
      </Bloco>

      <Bloco
        titulo="Quando NÃO animar"
        descricao="A lista de gatilhos legítimos é fechada. Se o que você quer animar não está nela, é decoração."
        plano
      >
        <Regras
          faca={{
            titulo: "Movimento com motivo",
            texto:
              "Anime quando algo entra, sai, muda, abre, fecha, carrega, conclui, é selecionado, é arrastado ou é atualizado. Nesses dez casos o movimento responde a uma pergunta: de onde veio, para onde foi, o sistema ouviu?",
          }}
          naoFaca={{
            titulo: "Movimento de enfeite",
            texto:
              "Nada de entrada em cascata a cada rolagem, ícone que pulsa sem novidade, número que conta sozinho em toda montagem de tela, hover que balança ou logo que gira. Movimento sem pergunta por trás só atrasa a leitura e cansa quem usa o dia inteiro.",
          }}
        />
      </Bloco>

      <Bloco
        titulo="Acessibilidade"
        descricao="prefers-reduced-motion não é preferência estética: para parte das pessoas, movimento causa enjoo e desorientação real."
      >
        <Coluna>
          <span className="ds-mov-farol" data-ligado={montado && reduzido ? "true" : undefined}>
            <Accessibility aria-hidden />
            {montado
              ? reduzido
                ? "Movimento reduzido: LIGADO neste navegador"
                : "Movimento reduzido: desligado neste navegador"
              : "Movimento reduzido: detectando…"}
          </span>

          <ul className="ds-mov-consequencias">
            <li>
              <Zap aria-hidden />
              <span>
                <b>CSS.</b> A média em ds.css zera <code>--duration-instant</code> até{" "}
                <code>--duration-slow</code>. Toda transição do produto herda isso de uma vez, sem
                componente precisar saber.
              </span>
            </li>
            <li>
              <SlidersHorizontal aria-hidden />
              <span>
                <b>JS.</b> O motion não lê media query: cada seção chama{" "}
                <code>useReducedMotion()</code> e troca a transição por <code>duration: 0</code>. As{" "}
                {MOLAS.length} molas, o contador e as trocas desta página estão passando por esse
                mesmo ponto agora.
              </span>
            </li>
            <li>
              <CircleDot aria-hidden />
              <span>
                <b>O que não muda.</b> Nada some e nada vira estático por fora: a aba continua
                trocando, o esqueleto continua virando conteúdo, o valor continua chegando. Só o
                caminho entre os dois estados deixa de existir.
              </span>
            </li>
          </ul>
        </Coluna>
      </Bloco>
    </Secao>
  );
}

/** Uma linha de mola. Fica fora do componente principal porque cada linha tem
 * estado próprio, e um `Record` de posições faria o grupo inteiro re-renderizar
 * a cada clique. */
function LinhaDeMola({
  rotulo,
  valor,
  uso,
  padrao,
  transicao,
}: {
  rotulo: string;
  valor: { stiffness: number; damping: number; mass: number };
  uso: string;
  padrao: boolean;
  transicao: Transition;
}) {
  const [noFim, setNoFim] = React.useState(false);

  return (
    <div className="ds-mov-linha" data-padrao={padrao ? "true" : undefined}>
      <span className="ds-mov-nome">
        <span className="ds-mov-nome-topo">
          {rotulo}
          {padrao ? <b className="ds-mov-padrao">padrão</b> : null}
        </span>
        <small>
          rigidez {valor.stiffness} · amortecimento {valor.damping} · massa {valor.mass}
        </small>
      </span>
      <button
        className="ds-mov-mola-trilho"
        type="button"
        data-fim={noFim ? "true" : undefined}
        onClick={() => setNoFim((v) => !v)}
        aria-label={`Mover o alvo da mola ${rotulo}`}
      >
        {/* `layout` mede as duas posições reais do alvo. É o que permite a mola
            sem nenhuma distância escrita no componente. */}
        <motion.span className="ds-mov-alvo" layout transition={transicao} />
      </button>
      <span className="ds-mov-uso">{uso}</span>
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={() => setNoFim((v) => !v)}
        aria-label={`Mover ${rotulo}`}
      >
        <Play aria-hidden />
      </Button>
    </div>
  );
}
