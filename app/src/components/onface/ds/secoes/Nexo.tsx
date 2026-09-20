"use client";

/** Seção NEXO do laboratório.
 *
 * Cada bloco aqui roda de verdade: o streaming reexecuta, os passos rodam de
 * novo, o insight é dispensado, a pergunta vira resposta e a ação sensível
 * confirma e desfaz. Print não prova que o estado existe. */

import * as React from "react";
import {
  ArrowRight,
  Kanban,
  ListFilter,
  Megaphone,
  MessageSquareText,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Secao, Bloco, Regras, Playground, Chave, Vazio } from "../lab";
import { CampoNexo, FundoGrafico } from "../marca";
import {
  NexoAcao,
  NexoComposer,
  NexoInsight,
  NexoMensagem,
  NexoPassos,
  NexoPensando,
  type AcaoSugerida,
  type EstagioNexo,
  type ItemAfetado,
  type PassoNexo,
} from "../nexo";
import { INSIGHTS, NEGOCIOS, FUNIL, RECEITA_SEMANAL, RESPONSAVEIS, brl, compacto } from "../dados";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Insight } from "../dados";

/* ── Dados derivados do domínio, calculados uma vez ─────────────────────── */

const FUNIL_ABERTO = FUNIL.filter((f) => f.etapa !== "Ganho");
const VALOR_ABERTO = FUNIL_ABERTO.reduce((soma, f) => soma + f.valor, 0);
const QTD_ABERTA = FUNIL_ABERTO.reduce((soma, f) => soma + f.quantidade, 0);
const TOTAL_ANALISADO = FUNIL.reduce((soma, f) => soma + f.quantidade, 0);
const PROPOSTA = FUNIL.find((f) => f.etapa === "Proposta");
const ULTIMA_SEMANA = RECEITA_SEMANAL[RECEITA_SEMANAL.length - 1];

/** Os 6 parados do insight i-1, materializados como negócios reais. */
const PARADOS: ItemAfetado[] = NEGOCIOS.filter((n) => n.etapa !== "Ganho" && n.etapa !== "Perdido")
  .slice(0, 6)
  .map((n) => ({ id: n.id, titulo: n.titulo, apoio: n.empresa, valor: brl(n.valor) }));

const VALOR_PARADOS = NEGOCIOS.filter((n) => PARADOS.some((p) => p.id === n.id)).reduce(
  (soma, n) => soma + n.valor,
  0
);

const PASSOS_CRM: PassoNexo[] = [
  { id: "p-1", rotulo: "Buscando no CRM", detalhe: "funil comercial · 12 meses" },
  { id: "p-2", rotulo: `Analisando ${TOTAL_ANALISADO} negócios`, detalhe: "etapa, valor e dias parado" },
  { id: "p-3", rotulo: "Comparando com o histórico", detalhe: "mesma faixa de ticket, 90 dias" },
];

const ACOES_RESPOSTA: AcaoSugerida[] = [
  { id: "abrir", rotulo: "Abrir os 6 no quadro", icone: Kanban },
  { id: "tarefa", rotulo: "Criar tarefa para cada um", icone: ListFilter },
  { id: "campanha", rotulo: "Ver campanhas Meta Ads", icone: Megaphone },
];

const ORIGEM_FUNIL = `Fonte: ${QTD_ABERTA} negócios abertos no funil comercial · atualizado hoje, 14:12`;

const SUGESTOES = [
  "Onde meu funil está travando?",
  "Meta Ads ainda compensa?",
  "Quem do time está fora da meta?",
];

/** Os estágios do campo, documentados na ordem em que acontecem numa execução
 * real. O que muda entre eles é quantos nós acendem, nunca a cor. */
const ESTAGIOS_CAMPO: { estagio: EstagioNexo; rotulo: string; quando: string }[] = [
  { estagio: "ocioso", rotulo: "Ocioso", quando: "O NEXO está disponível e não foi acionado." },
  { estagio: "escutando", rotulo: "Escutando", quando: "Recebendo a pergunta ou o gatilho da automação." },
  { estagio: "pensando", rotulo: "Pensando", quando: "Decidindo quais consultas precisa fazer." },
  { estagio: "buscando", rotulo: "Buscando", quando: "Lendo o CRM, a telefonia e o histórico." },
  { estagio: "analisando", rotulo: "Analisando", quando: "Cruzando os registros e procurando o padrão." },
  { estagio: "executando", rotulo: "Executando", quando: "Preparando a escrita que vai esperar seu aceite." },
  { estagio: "concluido", rotulo: "Concluído", quando: "Terminou. O campo para de se mover e a decisão é sua." },
];

/** Resposta canned, mas construída com número real do `dados.ts`. Texto de
 * exemplo com valor inventado ensina o time a confiar em número que não
 * existe. */
function responder(pergunta: string): { resposta: string; origem: string } {
  const p = pergunta.toLowerCase();

  if (p.includes("meta ads") || p.includes("origem") || p.includes("campanha") || p.includes("anúncio")) {
    return {
      resposta:
        "Meta Ads continua sendo a maior origem em volume, com 42% dos negócios criados, mas é a pior em conversão para Proposta: o custo por lead caiu 18% no mês e a passagem para Proposta caiu 9 pontos no mesmo período. Em dinheiro, ainda compensa para PABX pequeno e não compensa para Callface AI, onde o ciclo é mais longo e o lead chega sem contexto. A recomendação é separar a campanha por produto antes de mexer no orçamento.",
      origem: "Fonte: origem dos negócios do funil + custo por lead do Meta Ads · últimos 30 dias",
    };
  }

  if (p.includes("time") || p.includes("meta") || p.includes("mayara") || p.includes("responsável")) {
    const fora = RESPONSAVEIS.filter((r) => r.realizado < r.meta * 0.8);
    return {
      resposta: `${fora.length} pessoas estão abaixo de 80% da meta: ${fora
        .map((r) => `${r.nome} (${Math.round((r.realizado / r.meta) * 100)}%)`)
        .join(" e ")}. Mayara Ribeiro está em 93% e concentra os dois maiores negócios abertos, o que deixa a meta do time dependente de um único fechamento. Redistribuir dois negócios de Proposta reduz esse risco sem mudar a meta de ninguém.`,
      origem: "Fonte: meta e realizado por responsável · trimestre corrente",
    };
  }

  return {
    resposta: `Seu funil tem ${QTD_ABERTA} negócios abertos somando ${compacto(
      VALOR_ABERTO
    )}, e ${compacto(
      ULTIMA_SEMANA.atual
    )} de receita ganha na última semana, contra ${compacto(
      ULTIMA_SEMANA.anterior
    )} no mesmo período anterior. O gargalo não é geração: é Proposta, onde ${
      PROPOSTA?.quantidade ?? 0
    } negócios seguram ${compacto(
      PROPOSTA?.valor ?? 0
    )} e a média de dias parados é a maior do funil. Seis deles passaram de 9 dias sem nenhuma atividade registrada.`,
    origem: ORIGEM_FUNIL,
  };
}

type Turno = { id: number; pergunta: string; resposta: string; origem: string };

export function SecaoNexo() {
  const [denso, setDenso] = React.useState(false);
  const [estagioCampo, setEstagioCampo] = React.useState<EstagioNexo>("analisando");
  const [execucaoPassos, setExecucaoPassos] = React.useState(0);
  const [insights, setInsights] = React.useState<Insight[]>(INSIGHTS);
  const [turnos, setTurnos] = React.useState<Turno[]>([]);
  const [pendente, setPendente] = React.useState<string | null>(null);
  const timerRef = React.useRef<number | null>(null);

  // A demo da conversa agenda a resposta; sair da seção no meio não pode
  // deixar um setState solto apontando para um componente desmontado.
  React.useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  function perguntar(pergunta: string) {
    setPendente(pergunta);
    timerRef.current = window.setTimeout(() => {
      const { resposta, origem } = responder(pergunta);
      setTurnos((anteriores) => [...anteriores, { id: Date.now(), pergunta, resposta, origem }]);
      setPendente(null);
      timerRef.current = null;
    }, 1600);
  }

  return (
    <Secao
      titulo="NEXO e IA"
      chamada="A IA do ONFACE não tem cor própria. Nenhum roxo, nenhum gradiente, nenhum glow: o que separa um bloco do NEXO de um bloco comum é o movimento e a estrutura. Movimento porque o tempo da máquina precisa ser visível. Estrutura porque toda resposta mostra de onde veio o dado, e toda escrita no CRM espera aceite humano."
    >
      <Bloco
        titulo="Campo do NEXO"
        descricao="A assinatura visual da IA: a mesma malha de nós do resto do sistema convergindo para um núcleo. O estágio muda quantos nós acendem, nunca a cor, e no concluído o movimento para inteiro. É por isso que o NEXO não precisa de roxo nem de glow para parecer IA."
        fundo="sunken"
      >
        <Playground>
          {ESTAGIOS_CAMPO.map((item) => (
            <button
              key={item.estagio}
              type="button"
              className="nx-chip"
              aria-pressed={estagioCampo === item.estagio}
              onClick={() => setEstagioCampo(item.estagio)}
            >
              {item.rotulo}
            </button>
          ))}
        </Playground>

        <div className="nx-campo-palco" style={{ marginTop: "var(--space-16)" }}>
          {/* Malha apagada: o fundo dá plano ao campo sem disputar com ele. */}
          <FundoGrafico variante="malha" superficie="escura" intensidade="apagada" />
          <div className="nx-campo-palco-corpo">
            <CampoNexo estagio={estagioCampo} superficie="escura" altura={140} />
            <p className="nx-campo-palco-legenda">
              <b>{ESTAGIOS_CAMPO.find((e) => e.estagio === estagioCampo)?.rotulo}</b> ·{" "}
              {ESTAGIOS_CAMPO.find((e) => e.estagio === estagioCampo)?.quando}
            </p>
          </div>
        </div>
      </Bloco>

      <Bloco
        titulo="Pensando (inline)"
        descricao="O campo é grande demais para uma linha de conversa. Dentro de uma lista ou de um cartão, o NEXO usa três pontos e um rótulo que troca conforme o estágio. Pulso sem rótulo é spinner com outra roupa."
      >
        <Playground>
          <Chave id="nexo-denso" rotulo="Versão densa (dentro de lista)" valor={denso} aoMudar={setDenso} />
        </Playground>
        <div style={{ marginTop: "var(--space-16)" }}>
          <NexoPensando denso={denso} />
        </div>
      </Bloco>

      <Bloco
        titulo="Resposta com streaming"
        descricao="O texto chega token a token com o cursor piscando, do mesmo jeito que o modelo entrega. Quando termina, aparecem as ações sugeridas e o rodapé de feedback. Reexecutar refaz a animação inteira."
        fundo="sunken"
      >
        <NexoMensagem
          texto={responder("funil").resposta}
          origem={ORIGEM_FUNIL}
          acoes={ACOES_RESPOSTA}
          aoAgir={(acao) => toast.success(`Ação do NEXO: ${acao.rotulo}`)}
          aoFeedback={(voto) =>
            toast.success(
              voto === "util"
                ? "Feedback registrado. O NEXO reforça esse tipo de resposta."
                : "Feedback registrado. Essa resposta entra na fila de revisão."
            )
          }
        />
      </Bloco>

      <Bloco
        titulo="Momento de processamento"
        descricao="Quando o NEXO trabalha em algo que muda a decisão, ele sai da superfície operacional e vira momento: grafite, malha de conexões, o campo como assinatura do estado e a medida em escala de KPI. Nada de loading infinito sem informação, é ele que faz o usuário achar que travou e recarregar a página no meio da análise."
        plano
        acoes={
          <Button size="sm" variant="outline" onClick={() => setExecucaoPassos((e) => e + 1)}>
            <RotateCcw aria-hidden />
            Rodar de novo
          </Button>
        }
      >
        <NexoPassos
          passos={PASSOS_CRM}
          assunto={`${TOTAL_ANALISADO} negócios do funil`}
          medida={{ valor: String(TOTAL_ANALISADO), rotulo: "negócios lidos" }}
          medidaFinal={{ valor: String(PARADOS.length), rotulo: "fora do padrão" }}
          conclusao={`${PARADOS.length} negócios fora do padrão do funil`}
          acoes={
            <Button onClick={() => toast.success(`Abrindo os ${PARADOS.length} negócios no quadro`)}>
              <Kanban aria-hidden />
              Ver os {PARADOS.length} no quadro
            </Button>
          }
          execucao={execucaoPassos}
        />
      </Bloco>

      <Bloco
        titulo="Insight"
        descricao="O NEXO falando sem ninguém ter perguntado. O primeiro achado ganha peso de verdade: a medida em escala de KPI, a evidência abaixo e uma ação só. Do segundo em diante vira linha. Três cartões do mesmo tamanho não têm destaque nenhum, e o primeiro perde o peso que merecia."
        fundo="sunken"
        acoes={
          insights.length > 0 && insights.length < INSIGHTS.length ? (
            <Button size="sm" variant="subtle" onClick={() => setInsights(INSIGHTS)}>
              Restaurar insights
            </Button>
          ) : null
        }
      >
        {insights.length === 0 ? (
          <Vazio
            icone={<Sparkles />}
            titulo="Nenhum insight agora"
            texto="O NEXO só volta a falar quando encontrar um padrão novo no seu funil. Silêncio aqui é bom sinal."
            acoes={
              <Button size="sm" variant="outline" onClick={() => setInsights(INSIGHTS)}>
                Restaurar insights
              </Button>
            }
          />
        ) : (
          <div className="nx-insights">
            {insights.map((insight, i) => (
              <NexoInsight
                key={insight.id}
                insight={insight}
                // Só o primeiro é momento de destaque; o resto é nota.
                variante={i === 0 ? "destaque" : "nota"}
                destaque={
                  insight.id === "i-1"
                    ? { valor: compacto(VALOR_PARADOS), rotulo: "parados há mais de 9 dias" }
                    : undefined
                }
                origem={
                  insight.id === "i-1"
                    ? `Fonte: ${QTD_ABERTA} negócios abertos · dias sem atividade registrada`
                    : "Fonte: origem dos negócios + custo por lead do Meta Ads · 30 dias"
                }
                aoAgir={(x) => toast.success(`Abrindo: ${x.acao}`)}
                aoDispensar={(x) => setInsights((atuais) => atuais.filter((y) => y.id !== x.id))}
              />
            ))}
          </div>
        )}
      </Bloco>

      <Bloco
        titulo="Perguntar ao NEXO"
        descricao="Enter envia, Shift+Enter quebra linha. As sugestões existem porque a tela em branco é o maior motivo de abandono de um campo de IA. Enquanto o NEXO responde, o campo não aceita uma segunda pergunta."
        fundo="sunken"
      >
        <div className="nx-conversa">
          {turnos.map((turno) => (
            <React.Fragment key={turno.id}>
              <p className="nx-pergunta">{turno.pergunta}</p>
              <NexoMensagem
                texto={turno.resposta}
                origem={turno.origem}
                acoes={ACOES_RESPOSTA.slice(0, 2)}
                aoAgir={(acao) => toast.success(`Ação do NEXO: ${acao.rotulo}`)}
              />
            </React.Fragment>
          ))}

          {pendente ? (
            <>
              <p className="nx-pergunta">{pendente}</p>
              <div className="ds-nexo nx-cartao">
                <span className="ds-nexo-marca" aria-hidden>
                  <Sparkles />
                </span>
                <div className="ds-nexo-corpo">
                  <NexoPensando estagios={["Lendo sua pergunta", "Consultando o CRM", "Montando a resposta"]} intervalo={650} />
                </div>
              </div>
            </>
          ) : null}

          {turnos.length === 0 && !pendente ? (
            <Vazio
              icone={<MessageSquareText />}
              titulo="Pergunte alguma coisa"
              texto="O NEXO responde sobre o funil, um negócio ou um cliente, sempre citando de onde tirou o número."
            />
          ) : null}

          <NexoComposer sugestoes={SUGESTOES} ocupado={pendente !== null} aoEnviar={perguntar} />
        </div>
      </Bloco>

      <Bloco
        titulo="Ação sensível"
        descricao="A IA propõe a escrita, mostra o tamanho da mudança, lista exatamente o que será tocado e espera. As duas saídas não têm o mesmo peso de propósito: aplicar é coral, descartar é texto quieto. Confirmado, o histórico grava o nome da pessoa, não o do NEXO, e ainda dá para desfazer."
        fundo="sunken"
      >
        <NexoAcao
          titulo={`Mover ${PARADOS.length} negócios para Em risco`}
          resumo="Estão na etapa Proposta ou Negociação há mais de 9 dias sem nenhuma atividade registrada. Marcar como Em risco aciona a régua de recuperação e não altera etapa nem valor."
          itens={PARADOS}
          total={{ valor: compacto(VALOR_PARADOS), rotulo: `em ${PARADOS.length} negócios afetados` }}
          origem="Fonte: última atividade registrada por negócio · CRM, hoje 14:12"
          rotuloConfirmar="Confirmar e aplicar"
          aoConfirmar={() => toast.success(`${PARADOS.length} negócios marcados como Em risco`)}
          aoDescartar={() => toast("Sugestão descartada. Nada foi gravado.")}
        />
      </Bloco>

      <Bloco
        titulo="Erro e recuperação"
        descricao="O stream quebra no meio. A IA diz o que já conseguiu fazer, garante que não escreveu nada e oferece a saída. Mensagem de erro sem próximo passo transfere o problema para o usuário."
        fundo="sunken"
      >
        <NexoMensagem
          texto={responder("meta ads").resposta}
          origem="Fonte: origem dos negócios do funil · a consulta de custo por lead não retornou"
          simularFalha
          acoes={[{ id: "detalhar", rotulo: "Detalhar por campanha", icone: ArrowRight }]}
          aoAgir={() => toast("Chamado aberto para o time de dados.")}
        />
      </Bloco>

      <Regras
        faca={{
          titulo: "IA sugere, pessoa decide",
          texto:
            "Toda escrita no CRM proposta pelo NEXO passa por aceite explícito, mostra os registros afetados antes e continua desfazível depois. E toda resposta carrega a linha de origem: qual base, qual recorte, qual horário.",
        }}
        naoFaca={{
          titulo: "Inventar uma cor de IA",
          texto:
            "Nada de roxo, gradiente, glow ou tipografia especial para marcar o que é IA. Coral continua sendo ação e sinal. A diferença do NEXO é o movimento e a estrutura; cor nova cria uma segunda marca dentro da marca e um número sem origem vira boato com aparência de dado.",
        }}
      />
    </Secao>
  );
}
