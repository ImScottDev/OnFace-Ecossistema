"use client";

/** Seção Agenda do laboratório.
 *
 * Abre pelo assunto: a sexta-feira da Mayara, com os compromissos que saem dos
 * mesmos negócios do funil. Os controles (filtro, mês, agendador, faixa) vêm
 * depois, porque a pergunta que traz alguém aqui é "como está o meu dia", não
 * "quais props esse componente aceita". */

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Bloco, Chave, Coluna, Playground, Regras, Secao } from "../lab";
import {
  AgendaDoDia,
  Agendador,
  CalendarioMes,
  FaixaDeHorarios,
  HOJE,
  LegendaCategorias,
  ORDEM_CATEGORIAS,
  type CategoriaAgenda,
} from "../agenda";

const ARQUIVO = "ds/agenda.tsx";
const IMPORTAR =
  'import { CalendarioMes, AgendaDoDia, Agendador, FaixaDeHorarios } from "@/components/onface/ds/agenda";';

/** Dia sem nenhum compromisso na base de exemplo. Estado vazio de verdade, não
 *  uma lista filtrada até sobrar nada. */
const DIA_LIVRE = "2026-09-24";

export function SecaoAgenda() {
  const [selecionado, setSelecionado] = React.useState(HOJE);
  const [categorias, setCategorias] = React.useState<CategoriaAgenda[]>(ORDEM_CATEGORIAS);
  const [mostrarPontos, setMostrarPontos] = React.useState(true);
  const [comErro, setComErro] = React.useState(true);

  function alternar(categoria: CategoriaAgenda) {
    setCategorias((atuais) =>
      atuais.includes(categoria)
        ? atuais.filter((c) => c !== categoria)
        : [...atuais, categoria],
    );
  }

  return (
    <Secao
      titulo="Agenda"
      chamada="O tempo do vendedor visto de três distâncias: o mês para achar onde tem compromisso, o dia para saber o que acontece agora e a semana para escolher onde cabe o próximo retorno. Mesmo dado do funil, recortado por hora."
    >
      <Bloco
        titulo="Hoje na agenda da Mayara"
        descricao="Sete compromissos, 4h30 ocupadas e um conflito real às 14h. O horário de 16:30 e o de 18:00 são os mesmos que aparecem como próxima ação nos negócios da TechCorp e da Clínica Vitrali: a agenda não inventa compromisso que o funil não tem."
        arquivo={ARQUIVO}
        importar={IMPORTAR}
      >
        <Coluna>
          <LegendaCategorias />
          <AgendaDoDia
            dia={HOJE}
            aoAgendar={() => toast.message("Agendador aberto", { description: "Bloco 03 desta seção." })}
          />
        </Coluna>
      </Bloco>

      <Bloco
        titulo="Calendário do mês"
        descricao="Grade compacta com ponto de categoria por dia. Hoje é contorno coral, o dia selecionado é preenchimento grafite, e os dois convivem quando caem na mesma data. Pelo teclado: setas andam dia a dia, Ctrl não é necessário, Home e End vão às bordas da semana, PageUp e PageDown trocam o mês, Enter seleciona. A seta que passa da borda leva o mês visível junto."
        fundo="sunken"
      >
        <Playground>
          <Chave
            id="ag-pontos"
            rotulo="Mostrar pontos de categoria"
            valor={mostrarPontos}
            aoMudar={setMostrarPontos}
          />
        </Playground>

        <div style={{ marginTop: "var(--space-16)" }}>
          <LegendaCategorias ativas={categorias} aoAlternar={alternar} />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, auto) minmax(0, 1fr)",
            gap: "var(--space-16)",
            alignItems: "start",
            marginTop: "var(--space-16)",
          }}
        >
          <CalendarioMes
            selecionado={selecionado}
            aoSelecionar={setSelecionado}
            categorias={categorias}
            mostrarPontos={mostrarPontos}
          />
          <AgendaDoDia dia={selecionado} categorias={categorias} />
        </div>
      </Bloco>

      <Bloco
        titulo="Agendador de retorno"
        descricao="O fluxo de marcar o retorno com o lead sem sair do CRM. Os horários livres saem da agenda do dia: janela que colide com compromisso existente não é oferecida, e trocar a duração recalcula a lista (60 min oferece bem menos espaço que 15). Confirmar dispara o aviso com o resumo e some com o horário da lista."
        fundo="sunken"
      >
        <Agendador />
      </Bloco>

      <Bloco
        titulo="Faixa de horários da semana"
        descricao="Leitura de cinco dias contra as faixas de hora do expediente, para escolher a janela antes do horário exato. Cinza é ocupado e não recebe clique; coral é a janela escolhida. Responde 'quando essa semana aguenta mais uma reunião' — pergunta que o mês não alcança e a agenda do dia responde tarde."
      >
        <FaixaDeHorarios />
      </Bloco>

      <Bloco
        titulo="Dia livre, carregando e erro"
        descricao="Os três estados que aparecem em produto. Vazio tem saída, não só um desenho. O esqueleto tem a forma da grade e da linha que vêm depois, para a página não pular de altura. Erro diz o que falhou e traz o botão que refaz a busca, porque sem agenda ninguém trabalha."
      >
        <Coluna>
          <AgendaDoDia
            dia={DIA_LIVRE}
            aoAgendar={() => toast.message("Agendador aberto", { description: "Bloco 03 desta seção." })}
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, auto) minmax(0, 1fr)",
              gap: "var(--space-16)",
              alignItems: "start",
            }}
          >
            <CalendarioMes selecionado={HOJE} aoSelecionar={() => {}} carregando />
            <AgendaDoDia dia={HOJE} carregando />
          </div>
          <AgendaDoDia
            dia={HOJE}
            erro={comErro ? "O calendário do Microsoft 365 não respondeu em 10s." : null}
            aoTentarDeNovo={() => {
              setComErro(false);
              toast.success("Agenda sincronizada");
            }}
          />
          {!comErro ? (
            <div className="ds-linha">
              <Button variant="outline" size="sm" onClick={() => setComErro(true)}>
                Repor o erro
              </Button>
            </div>
          ) : null}
        </Coluna>
      </Bloco>

      <Regras
        faca={{
          titulo: "Conflito visível",
          texto:
            "Dois compromissos na mesma janela aparecem lado a lado, dentro de uma moldura coral que diz quantos são. O dia em que a pessoa mais precisa enxergar o choque é justamente o dia em que empilhar esconderia o segundo cartão.",
        }}
        naoFaca={{
          titulo: "Ponto sem legenda",
          texto:
            "Nada de calendário pintado sem dizer o que cada cor significa, nem categoria nova inventada só para a agenda: as quatro saem da atividade registrada no negócio. Ponto colorido que ninguém decifra é enfeite, e enfeite em grade compacta vira ruído.",
        }}
      />
    </Secao>
  );
}
