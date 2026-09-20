"use client";

/** NEXO — a linguagem visual da IA do ONFACE.
 *
 * IA no ONFACE continua sendo ONFACE. Nenhum roxo, nenhum gradiente, nenhum
 * glow: seria uma segunda marca dentro da marca, e o produto passaria a ter
 * "a parte normal" e "a parte de IA". O que distingue o NEXO é outra coisa:
 *
 *   1. MOVIMENTO — texto que chega token a token, passo que avança, ponto que
 *      pulsa. O tempo da máquina fica visível em vez de virar spinner mudo.
 *   2. ESTRUTURA — toda resposta carrega a origem do dado, e toda escrita no
 *      CRM passa por aceite humano. IA sugere, pessoa decide.
 *
 * Tudo aqui tem estado React de verdade: o streaming reexecuta, os passos
 * rodam de novo, o feedback registra, a ação confirma e desfaz. */

import * as React from "react";
import { useReducedMotion } from "motion/react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  CornerDownLeft,
  Database,
  Lightbulb,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TriangleAlert,
  Undo2,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CampoNexo, Momento } from "./marca";
import type { Insight } from "./dados";
import "./nexo.css";

/** Estágios do campo do NEXO. Repetido aqui porque `marca.tsx` não exporta o
 * tipo; o valor é o mesmo e o compilador cobra se os dois divergirem. */
export type EstagioNexo =
  | "ocioso"
  | "escutando"
  | "pensando"
  | "buscando"
  | "analisando"
  | "executando"
  | "concluido";

/* ═══════════════════════════════════════════════════════════════════════
   Pensando
   ═══════════════════════════════════════════════════════════════════════ */

export const ESTAGIOS_PADRAO = [
  "Lendo o funil comercial",
  "Cruzando com o histórico de 90 dias",
  "Montando a resposta",
];

/** Indicador de "pensando". Os três pontos dizem que está vivo; o rótulo diz
 * o que está acontecendo. Pulso sem rótulo é spinner com outra roupa. */
export function NexoPensando({
  estagios = ESTAGIOS_PADRAO,
  intervalo = 1500,
  denso = false,
}: {
  estagios?: string[];
  /** Tempo em cada estágio, em ms. */
  intervalo?: number;
  /** Versão de linha única, para usar dentro de uma lista ou de um cartão. */
  denso?: boolean;
}) {
  const [indice, setIndice] = React.useState(0);

  // O rótulo continua girando mesmo com reduced motion: ele é informação de
  // progresso, não decoração. Quem para é a animação dos pontos, pela regra
  // global do onface.css.
  React.useEffect(() => {
    if (estagios.length < 2) return;
    const id = window.setInterval(() => {
      setIndice((i) => (i + 1) % estagios.length);
    }, intervalo);
    return () => window.clearInterval(id);
  }, [estagios.length, intervalo]);

  return (
    <div className="nx-pensando" data-denso={denso ? "true" : undefined} role="status">
      <span className="ds-nexo-pontos" aria-hidden>
        <i />
        <i />
        <i />
      </span>
      <span className="nx-pensando-rotulo" key={indice}>
        {estagios[indice]}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Mensagem com streaming
   ═══════════════════════════════════════════════════════════════════════ */

export type AcaoSugerida = { id: string; rotulo: string; icone?: LucideIcon };

type FaseMensagem = "transmitindo" | "concluido" | "erro";

/** Resposta do NEXO. O texto chega token a token com cursor piscando; quando
 * termina, aparecem as ações sugeridas e o rodapé de feedback.
 *
 * `simularFalha` existe para o laboratório mostrar o estado de erro sem
 * precisar derrubar nada: a primeira execução quebra no meio, a nova
 * tentativa completa. É exatamente o que o produto faz quando o provedor
 * devolve erro no meio do stream. */
export function NexoMensagem({
  texto,
  origem,
  acoes = [],
  simularFalha = false,
  aoAgir,
  aoFeedback,
}: {
  texto: string;
  /** De onde veio o dado. Obrigatório: resposta sem origem não é auditável. */
  origem: string;
  acoes?: AcaoSugerida[];
  simularFalha?: boolean;
  aoAgir?: (acao: AcaoSugerida) => void;
  aoFeedback?: (voto: "util" | "nao-util") => void;
}) {
  const [execucao, setExecucao] = React.useState(0);
  const [tentativa, setTentativa] = React.useState(0);

  // Reexecutar remonta o corpo por `key` em vez de zerar cinco estados dentro
  // de um efeito: o estado inicial já nasce correto e não há render em cascata.
  return (
    <CorpoMensagem
      key={`${execucao}-${tentativa}`}
      texto={texto}
      origem={origem}
      acoes={acoes}
      vaiFalhar={simularFalha && tentativa === 0}
      aoAgir={aoAgir}
      aoFeedback={aoFeedback}
      aoTentarDeNovo={() => {
        setTentativa((t) => t + 1);
        setExecucao((e) => e + 1);
      }}
      aoReexecutar={() => {
        setTentativa(0);
        setExecucao((e) => e + 1);
      }}
    />
  );
}

function CorpoMensagem({
  texto,
  origem,
  acoes,
  vaiFalhar,
  aoAgir,
  aoFeedback,
  aoTentarDeNovo,
  aoReexecutar,
}: {
  texto: string;
  origem: string;
  acoes: AcaoSugerida[];
  vaiFalhar: boolean;
  aoAgir?: (acao: AcaoSugerida) => void;
  aoFeedback?: (voto: "util" | "nao-util") => void;
  aoTentarDeNovo: () => void;
  aoReexecutar: () => void;
}) {
  const reduzido = useReducedMotion() ?? false;
  const [indice, setIndice] = React.useState(0);
  const [fase, setFase] = React.useState<FaseMensagem>("transmitindo");
  const [voto, setVoto] = React.useState<"util" | "nao-util" | null>(null);

  // Quebrar por token (palavra + espaço que a segue) em vez de por caractere:
  // caractere a caractere parece máquina de escrever de tela de filme, token a
  // token é como o modelo realmente entrega.
  const tokens = React.useMemo(() => texto.match(/\S+\s*/g) ?? [], [texto]);
  const corte = vaiFalhar ? Math.max(1, Math.ceil(tokens.length * 0.4)) : tokens.length;

  React.useEffect(() => {
    const fim = vaiFalhar ? "erro" : "concluido";
    // Sem movimento a resposta aparece inteira no próximo tick. O salto fica
    // num callback (e não no corpo do efeito) para não disparar render em
    // cascata, e ainda cobre quem liga reduced motion com a página aberta.
    if (reduzido) {
      const id = window.setTimeout(() => {
        setIndice(corte);
        setFase(fim);
      }, 0);
      return () => window.clearTimeout(id);
    }
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setIndice(i);
      if (i >= corte) {
        window.clearInterval(id);
        setFase(fim);
      }
    }, 38);
    return () => window.clearInterval(id);
  }, [corte, vaiFalhar, reduzido]);

  const visivel = tokens.slice(0, indice).join("");
  const transmitindo = fase === "transmitindo";

  function registrarVoto(novo: "util" | "nao-util") {
    setVoto(novo);
    aoFeedback?.(novo);
  }

  return (
    <div className="ds-nexo nx-cartao">
      <span className="ds-nexo-marca" aria-hidden>
        <Sparkles />
      </span>

      <div className="ds-nexo-corpo">
        <div className="ds-nexo-nome">
          NEXO
          <span className="nx-selo">{transmitindo ? "respondendo" : "resposta gerada"}</span>
        </div>

        {/* O parágrafo visível fica escondido do leitor de tela enquanto muda;
            a região viva abaixo recebe o texto inteiro uma única vez, no fim. */}
        <p className="ds-nexo-texto" aria-hidden>
          {visivel}
          {transmitindo ? <span className="ds-nexo-cursor" /> : null}
        </p>
        <p className="nx-sr" role="status">
          {fase === "concluido" ? texto : ""}
        </p>

        {fase === "erro" ? (
          <div className="nx-erro" role="alert">
            <TriangleAlert aria-hidden />
            <div>
              <strong>A resposta foi interrompida</strong>
              <p>
                O NEXO perdeu a conexão com o modelo depois de ler o funil. Nada foi gravado
                no CRM. O que já apareceu acima veio da consulta que completou.
              </p>
              <div className="nx-erro-acoes">
                <Button size="sm" onClick={aoTentarDeNovo}>
                  <RotateCcw aria-hidden />
                  Tentar de novo
                </Button>
                <Button size="sm" variant="ghost" onClick={() => aoAgir?.({ id: "suporte", rotulo: "Abrir chamado" })}>
                  Abrir chamado
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        <p className="nx-origem">
          <Database aria-hidden />
          {origem}
        </p>

        {fase === "concluido" && acoes.length > 0 ? (
          <div className="nx-acoes">
            {acoes.map((acao) => {
              const Icone = acao.icone;
              return (
                <Button key={acao.id} size="sm" variant="outline" onClick={() => aoAgir?.(acao)}>
                  {Icone ? <Icone aria-hidden /> : null}
                  {acao.rotulo}
                </Button>
              );
            })}
          </div>
        ) : null}

        {fase !== "transmitindo" ? (
          <div className="nx-rodape">
            <div className="nx-rodape-lado">
              <span className="nx-rodape-nota">Essa resposta ajudou?</span>
              <button
                type="button"
                className="nx-icone-btn"
                aria-label="Marcar resposta como útil"
                aria-pressed={voto === "util"}
                onClick={() => registrarVoto("util")}
              >
                <ThumbsUp aria-hidden />
              </button>
              <button
                type="button"
                className="nx-icone-btn"
                aria-label="Marcar resposta como não útil"
                aria-pressed={voto === "nao-util"}
                onClick={() => registrarVoto("nao-util")}
              >
                <ThumbsDown aria-hidden />
              </button>
            </div>
            <Button size="sm" variant="subtle" onClick={aoReexecutar}>
              <RotateCcw aria-hidden />
              Reexecutar
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Passos de ferramenta
   ═══════════════════════════════════════════════════════════════════════ */

export type PassoNexo = { id: string; rotulo: string; detalhe?: string };

export type MedidaNexo = { valor: string; rotulo: string };

/** Ordem em que o campo do NEXO acende conforme a execução avança. O estágio
 * muda quantos nós ficam ativos, nunca a cor: é a mesma malha do resto do
 * sistema, não uma segunda identidade para a IA. */
const ORDEM_ESTAGIO = ["escutando", "buscando", "analisando", "executando"] as const;

function estagioDoProgresso(atual: number, total: number): EstagioNexo {
  if (total <= 0 || atual >= total) return "concluido";
  const faixa = Math.floor((atual / total) * ORDEM_ESTAGIO.length);
  return ORDEM_ESTAGIO[Math.min(faixa, ORDEM_ESTAGIO.length - 1)];
}

/** Momento expressivo: o NEXO processando algo que importa.
 *
 * Superfície grafite com a malha de conexões, o campo do NEXO como assinatura
 * do estado, a medida dominando a composição e os passos com progresso. É o
 * oposto de loading infinito: a qualquer segundo dá para dizer o que ele está
 * lendo, quanto falta e o que ainda não foi tocado. */
export function NexoPassos({
  passos,
  conclusao,
  assunto,
  medida,
  medidaFinal,
  acoes,
  execucao = 0,
  intervalo = 1100,
}: {
  passos: PassoNexo[];
  /** Linha final, exibida quando tudo termina. */
  conclusao: string;
  /** O que está sendo analisado. Vira o título do momento. */
  assunto: string;
  /** Número que domina a composição enquanto roda. */
  medida: MedidaNexo;
  /** Número que domina a composição quando termina: o achado, não o volume. */
  medidaFinal: MedidaNexo;
  /** Decisão oferecida no fim. Momento que não muda o próximo passo é card comum. */
  acoes?: React.ReactNode;
  /** Muda de valor para rodar de novo. */
  execucao?: number;
  intervalo?: number;
}) {
  // Mesma escolha da mensagem: rodar de novo é remontar, não zerar estado
  // dentro de um efeito.
  return (
    <CorpoPassos
      key={execucao}
      passos={passos}
      conclusao={conclusao}
      assunto={assunto}
      medida={medida}
      medidaFinal={medidaFinal}
      acoes={acoes}
      intervalo={intervalo}
    />
  );
}

function CorpoPassos({
  passos,
  conclusao,
  assunto,
  medida,
  medidaFinal,
  acoes,
  intervalo,
}: {
  passos: PassoNexo[];
  conclusao: string;
  assunto: string;
  medida: MedidaNexo;
  medidaFinal: MedidaNexo;
  acoes?: React.ReactNode;
  intervalo: number;
}) {
  const reduzido = useReducedMotion() ?? false;
  const [atual, setAtual] = React.useState(0);
  const total = passos.length;

  React.useEffect(() => {
    if (reduzido) {
      const id = window.setTimeout(() => setAtual(total), 0);
      return () => window.clearTimeout(id);
    }
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setAtual(i);
      if (i >= total) window.clearInterval(id);
    }, intervalo);
    return () => window.clearInterval(id);
  }, [total, intervalo, reduzido]);

  const concluido = atual >= total;
  const pct = Math.round((atual / total) * 100);
  const estagio = estagioDoProgresso(atual, total);
  const emFoco = concluido ? medidaFinal : medida;

  return (
    // O wrapper existe só para escopar o estilo escuro dos passos: `Momento`
    // vem de marca.tsx e não recebe className.
    <div className="nx-momento">
      <Momento
        rotulo={concluido ? "NEXO · análise concluída" : "NEXO · analisando"}
        titulo={concluido ? conclusao : `Analisando ${assunto}`}
        apoio={
          concluido
            ? "Leitura, não alteração: nada foi gravado no CRM. A partir daqui quem decide é você."
            : "O NEXO lê o CRM, cruza com o histórico da mesma faixa de ticket e só então conclui."
        }
        variante="conexoes"
        acoes={concluido ? acoes : undefined}
      >
        <div className="nx-momento-cabeca">
          {/* A medida domina a composição: é ela que decide o que fazer em
              seguida, não mais um rótulo do mesmo tamanho dos outros. */}
          <p className="nx-momento-medida">
            <b className="ds-momento-numero">{emFoco.valor}</b>
            <span>{emFoco.rotulo}</span>
          </p>
          <CampoNexo estagio={estagio} superficie="escura" altura={104} />
        </div>

        <div className="nx-momento-progresso">
          <div className="nx-passos-topo">
            <span className="nx-passos-titulo">
              {concluido
                ? `${total} consultas, nenhuma escrita`
                : passos[Math.min(atual, total - 1)]?.rotulo}
            </span>
            <span className="nx-passos-contagem">
              {Math.min(atual, total)} de {total}
            </span>
          </div>

          <div
            className="nx-progresso"
            role="progressbar"
            aria-label="Progresso da análise do NEXO"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            {/* scaleX em vez de width: largura anima no layout, transform não. */}
            <i style={{ "--nx-progresso": pct / 100 } as React.CSSProperties} />
          </div>
        </div>

        <ol className="ds-nexo-passos nx-lista-limpa">
          {passos.map((passo, i) => {
            const estado = i < atual ? "feito" : i === atual ? "agora" : "pendente";
            const Icone = estado === "feito" ? CheckCircle2 : estado === "agora" ? LoaderCircle : Circle;
            return (
              <li key={passo.id} className="ds-nexo-passo" data-estado={estado}>
                <Icone aria-hidden />
                <span>{passo.rotulo}</span>
                {passo.detalhe ? <span className="nx-passo-detalhe">{passo.detalhe}</span> : null}
              </li>
            );
          })}
        </ol>
      </Momento>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Insight
   ═══════════════════════════════════════════════════════════════════════ */

/** Cartão de insight: o NEXO falando sem ninguém ter perguntado.
 *
 * Hierarquia em três degraus, nessa ordem de peso: o que ele descobriu (a
 * medida, em escala de KPI), a evidência que sustenta, a ação. A origem do
 * dado fecha — número sem origem é boato com aparência de dado. E ele pode ser
 * dispensado: observação não pedida que não dá para calar vira ruído.
 *
 * `variante="nota"` é a mesma informação em densidade de linha. Serve para o
 * segundo e o terceiro achado: três cartões do mesmo tamanho não têm destaque
 * nenhum, e o primeiro perde o peso que ele merecia. */
export function NexoInsight({
  insight,
  origem,
  destaque,
  variante = "destaque",
  aoAgir,
  aoDispensar,
}: {
  insight: Insight;
  origem: string;
  /** A medida que decide. Sem ela o cartão vira parágrafo com botão. */
  destaque?: MedidaNexo;
  variante?: "destaque" | "nota";
  aoAgir?: (insight: Insight) => void;
  aoDispensar?: (insight: Insight) => void;
}) {
  const botaoDispensar = aoDispensar ? (
    <button
      type="button"
      className="nx-icone-btn"
      aria-label={`Dispensar insight: ${insight.titulo}`}
      onClick={() => aoDispensar(insight)}
    >
      <X aria-hidden />
    </button>
  ) : null;

  if (variante === "nota") {
    return (
      <article className="nx-insight-nota">
        <Lightbulb className="nx-insight-nota-icone" aria-hidden />
        <div className="nx-insight-nota-corpo">
          <strong>{insight.titulo}</strong>
          <p className="nx-origem">
            <Database aria-hidden />
            {origem}
          </p>
        </div>
        <Button size="sm" variant="subtle" onClick={() => aoAgir?.(insight)}>
          {insight.acao}
          <ArrowRight aria-hidden />
        </Button>
        {botaoDispensar}
      </article>
    );
  }

  return (
    <article className="nx-insight">
      <header className="nx-insight-topo">
        <span className="nx-insight-selo">
          <Lightbulb aria-hidden />
          Insight do NEXO
        </span>
        {botaoDispensar}
      </header>

      <h4 className="nx-insight-titulo">{insight.titulo}</h4>

      {destaque ? (
        <p className="nx-insight-destaque">
          <b>{destaque.valor}</b>
          <span>{destaque.rotulo}</span>
        </p>
      ) : null}

      <p className="nx-insight-evidencia">{insight.detalhe}</p>

      <footer className="nx-insight-rodape">
        <p className="nx-origem">
          <Database aria-hidden />
          {origem}
        </p>
        <Button onClick={() => aoAgir?.(insight)}>
          {insight.acao}
          <ArrowRight aria-hidden />
        </Button>
      </footer>
    </article>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Composer
   ═══════════════════════════════════════════════════════════════════════ */

/** Campo de pergunta. Enter envia, Shift+Enter quebra linha: o padrão que a
 * pessoa já traz de qualquer chat. As sugestões existem porque a tela em
 * branco é o maior motivo de abandono de um campo de IA. */
export function NexoComposer({
  sugestoes = [],
  aoEnviar,
  ocupado = false,
  placeholder = "Pergunte sobre o funil, um negócio ou um cliente",
}: {
  sugestoes?: string[];
  aoEnviar: (pergunta: string) => void;
  /** Enquanto o NEXO responde, o campo não aceita uma segunda pergunta. */
  ocupado?: boolean;
  placeholder?: string;
}) {
  const [valor, setValor] = React.useState("");
  const campoRef = React.useRef<HTMLTextAreaElement>(null);
  const vazio = valor.trim().length === 0;

  function enviar() {
    if (vazio || ocupado) return;
    aoEnviar(valor.trim());
    setValor("");
  }

  return (
    <div className="nx-composer">
      <div className="nx-composer-campo">
        <span className="ds-nexo-marca" aria-hidden>
          <Sparkles />
        </span>
        <Textarea
          ref={campoRef}
          value={valor}
          placeholder={placeholder}
          aria-label="Pergunta para o NEXO"
          disabled={ocupado}
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              enviar();
            }
          }}
        />
      </div>

      <div className="nx-composer-rodape">
        <div className="nx-chips">
          {sugestoes.map((sugestao) => (
            <button
              key={sugestao}
              type="button"
              className="nx-chip"
              disabled={ocupado}
              onClick={() => {
                setValor(sugestao);
                campoRef.current?.focus();
              }}
            >
              <Sparkles aria-hidden />
              {sugestao}
            </button>
          ))}
        </div>

        <div className="nx-rodape-lado">
          <span className="nx-kbd">
            <kbd>Enter</kbd> envia · <kbd>Shift</kbd>+<kbd>Enter</kbd> quebra linha
          </span>
          <Button size="sm" loading={ocupado} disabled={vazio} onClick={enviar}>
            {ocupado ? "Pensando" : "Perguntar"}
            {ocupado ? null : <CornerDownLeft aria-hidden />}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Ação sensível
   ═══════════════════════════════════════════════════════════════════════ */

export type ItemAfetado = { id: string; titulo: string; apoio: string; valor: string };

type FaseAcao = "pendente" | "aplicando" | "aplicado" | "descartado";

/** Aceite de escrita no CRM. O NEXO nunca altera dado sozinho: ele prepara a
 * mudança, mostra exatamente o que será tocado, de onde tirou a conclusão, e
 * espera. Confirmado, ainda dá para desfazer — aceite não é irreversível. */
export function NexoAcao({
  titulo,
  resumo,
  itens,
  origem,
  total,
  rotuloConfirmar,
  aoConfirmar,
  aoDescartar,
}: {
  titulo: string;
  resumo: string;
  itens: ItemAfetado[];
  origem: string;
  /** O tamanho da mudança, em escala de KPI: é o que pesa na decisão. */
  total?: MedidaNexo;
  rotuloConfirmar: string;
  aoConfirmar?: () => void;
  aoDescartar?: () => void;
}) {
  const [fase, setFase] = React.useState<FaseAcao>("pendente");
  const [aberto, setAberto] = React.useState(false);
  const idItens = React.useId();

  function confirmar() {
    setFase("aplicando");
    // A escrita real leva tempo; o botão fica em loading para não haver duplo
    // aceite da mesma sugestão.
    window.setTimeout(() => {
      setFase("aplicado");
      aoConfirmar?.();
    }, 700);
  }

  if (fase === "aplicado") {
    return (
      <div className="nx-acao">
        <div className="nx-acao-resultado" role="status">
          <ShieldCheck aria-hidden />
          <div className="nx-acao-resultado-corpo">
            <strong>{itens.length} negócios atualizados por você.</strong> A mudança ficou
            registrada no histórico com seu nome, não com o do NEXO.
          </div>
          <Button size="sm" variant="ghost" onClick={() => setFase("pendente")}>
            <Undo2 aria-hidden />
            Desfazer
          </Button>
        </div>
      </div>
    );
  }

  if (fase === "descartado") {
    return (
      <div className="nx-acao">
        <div className="nx-acao-resultado" data-tom="neutro" role="status">
          <X aria-hidden />
          <div className="nx-acao-resultado-corpo">
            Sugestão descartada. O NEXO não escreveu nada no CRM.
          </div>
          <Button size="sm" variant="ghost" onClick={() => setFase("pendente")}>
            Ver de novo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="nx-acao">
      <div className="nx-acao-topo">
        <span className="ds-nexo-marca" aria-hidden>
          <Sparkles />
        </span>
        <div className="nx-acao-corpo">
          {/* Estado dito por extenso: quem chega no meio da tela precisa saber
              que isto é proposta, não fato consumado. */}
          <span className="nx-selo nx-acao-estado">proposta · aguarda seu aceite</span>
          <span className="nx-acao-titulo">{titulo}</span>
          <p className="nx-acao-resumo">{resumo}</p>

          {total ? (
            <p className="nx-acao-total">
              <b>{total.valor}</b>
              <span>{total.rotulo}</span>
            </p>
          ) : null}

          <button
            type="button"
            className="nx-acao-toggle"
            aria-expanded={aberto}
            aria-controls={idItens}
            onClick={() => setAberto((a) => !a)}
          >
            {aberto ? "Esconder" : `Ver os ${itens.length} negócios`}
            <ChevronDown aria-hidden />
          </button>

          {aberto ? (
            <ul id={idItens} className="nx-acao-itens nx-lista-limpa">
              {itens.map((item) => (
                <li key={item.id} className="nx-acao-item">
                  <div>
                    <strong>{item.titulo}</strong>
                    <small>{item.apoio}</small>
                  </div>
                  <b>{item.valor}</b>
                </li>
              ))}
            </ul>
          ) : null}

          <p className="nx-origem">
            <Database aria-hidden />
            {origem}
          </p>

          {/* Duas saídas, pesos diferentes de propósito: aplicar é coral e
              maior, descartar é texto quieto. Botões gêmeos fazem a pessoa
              parar para ler qual é qual bem na hora de decidir. */}
          <div className="nx-acao-rodape">
            <span className="nx-rodape-nota">
              <ShieldCheck aria-hidden />O NEXO não aplica nada sem o seu aceite.
            </span>
            <div className="nx-acao-decisao">
              <Button
                size="sm"
                variant="subtle"
                disabled={fase === "aplicando"}
                onClick={() => {
                  setFase("descartado");
                  aoDescartar?.();
                }}
              >
                Descartar
              </Button>
              <Button loading={fase === "aplicando"} onClick={confirmar}>
                {fase === "aplicando" ? null : <Check aria-hidden />}
                {rotuloConfirmar}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
