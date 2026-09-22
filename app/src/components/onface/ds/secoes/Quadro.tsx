"use client";

/** Seção Quadro do laboratório.
 *
 * Documentação de kanban só prova alguma coisa se o cartão se mover: aqui o
 * quadro é o componente real, com estado real. Arraste, solte, reordene — o
 * que ficar na tela continua lá quando você mexer no playground.
 *
 * O cartão, o menu e a gaveta moram AQUI, não dentro do `Quadro`. O quadro é a
 * mecânica (colunas, arraste, teclado, anúncio, desfazer) e o cartão é do
 * domínio de cada tela — é o que permite Pré-vendas e Pipeline usarem o mesmo
 * quadro sem herdar o negócio fictício desta página.
 */

import * as React from "react";
import {
  ArrowRightLeft,
  CalendarPlus,
  EllipsisVertical,
  Inbox,
  Phone,
  SquareArrowOutUpRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Bloco, Chave, Playground, Regras, Secao } from "../lab";
import { Quadro, type ColunaQuadro } from "../Quadro";
import type { TomEstado } from "../crm";
import { ETAPAS_QUADRO, NEGOCIOS, brl, compacto, type Etapa, type Negocio } from "../dados";

/** Só o funil de trabalho entra no quadro. Ganho e Perdido são saída, não
 *  coluna: cartão que chega lá não volta a ser arrastado. */
const DO_FUNIL = NEGOCIOS.filter((n) => ETAPAS_QUADRO.includes(n.etapa));

const COLUNAS: ColunaQuadro[] = ETAPAS_QUADRO.map((etapa) => ({ chave: etapa, rotulo: etapa }));

/* A etiqueta do cartão é a mesma da lista e a mesma do cabeçalho de entidade:
   mesma palavra, mesmo par superfície/texto. O `Badge variant="outline"` que
   estava aqui não pintava o rótulo (texto herdado, ~1.1:1 no efetivo) e era
   justamente o sinal de SLA, a informação pela qual se olha o quadro.

   Regra de sinal: cinza é informativo (o prazo está de pé), coral é "exige
   ação agora" (vence hoje, ou o negócio está sem próxima tarefa) e vermelho é
   prazo estourado. Verde não aparece no funil: negócio ganho sai do quadro. */
const ETIQUETA: Record<Negocio["situacao"], { rotulo: string; tom: TomEstado }> = {
  "no-prazo": { rotulo: "No prazo", tom: "neutro" },
  hoje: { rotulo: "Hoje", tom: "acento" },
  atrasado: { rotulo: "Atrasada", tom: "risco" },
  "sem-tarefa": { rotulo: "Sem tarefa", tom: "acento" },
};

const eUrgente = (n: Negocio) => n.situacao === "atrasado" || n.situacao === "hoje";

function MenuCartao({ negocio, aoAbrir }: { negocio: Negocio; aoAbrir: () => void }) {
  return (
    /* O menu vive dentro de um cartão arrastável: sem parar a propagação, o
       pointerdown viraria arraste e o Espaço pegaria o cartão em vez de abrir
       o menu. */
    <span
      className="qd-acao"
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="qd-acao-botao"
            aria-label={`Ações de ${negocio.titulo}`}
          >
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="qd-menu">
          <DropdownMenuLabel>{negocio.empresa}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={aoAbrir}>
            <SquareArrowOutUpRight /> Abrir negócio
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => toast(`Ligando para ${negocio.empresa}`)}>
            <Phone /> Ligar agora
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => toast("Tarefa criada para amanhã, 09:00")}>
            <CalendarPlus /> Agendar tarefa
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}

function CartaoNegocio({
  negocio,
  mostrarValor,
  aoAbrir,
}: {
  negocio: Negocio;
  mostrarValor: boolean;
  aoAbrir?: () => void;
}) {
  const etiqueta = ETIQUETA[negocio.situacao];
  return (
    <>
      <div className="qd-cartao-topo">
        <span className="qd-cartao-titulo">
          <strong>{negocio.titulo}</strong>
          <small>{negocio.empresa}</small>
        </span>
        {aoAbrir ? <MenuCartao negocio={negocio} aoAbrir={aoAbrir} /> : null}
      </div>
      <div className="ds-quadro-cartao-rodape">
        <span className="of-status" data-tom={etiqueta.tom}>
          {etiqueta.rotulo}
        </span>
        <span className="qd-cartao-meta">
          {mostrarValor ? <span className="qd-valor">{brl(negocio.valor)}</span> : null}
          <span className="qd-pessoa" title={negocio.responsavel.nome} aria-hidden="true">
            {negocio.responsavel.iniciais}
          </span>
        </span>
      </div>
    </>
  );
}

/** Dinheiro e quantidade são duas leituras diferentes: separados, o olho
 *  escolhe qual quer primeiro em vez de ler "3 · R$ 58k" como um texto só. */
function medida(itens: Negocio[]) {
  const soma = itens.reduce((total, n) => total + n.valor, 0);
  return (
    <>
      <span className="qd-coluna-soma">{compacto(soma)}</span>
      <span className="qd-coluna-conta" aria-hidden="true">
        {itens.length}
      </span>
    </>
  );
}

/** O quadro do laboratório: a mecânica genérica somada ao cartão, ao menu e à
 *  gaveta do negócio de demonstração. Exportado porque a seção Fluxos monta o
 *  mesmo quadro com outra lista de etapas. */
export function QuadroDemo({
  negocios,
  aoMudar,
  colunas = COLUNAS,
  mostrarValor = true,
  marcarUrgentes = true,
}: {
  negocios: Negocio[];
  aoMudar: (p: Negocio[]) => void;
  colunas?: ColunaQuadro[];
  mostrarValor?: boolean;
  marcarUrgentes?: boolean;
}) {
  const [idAberto, setIdAberto] = React.useState<string | null>(null);
  const aberto = idAberto ? (negocios.find((n) => n.id === idAberto) ?? null) : null;

  return (
    <>
      <Quadro<Negocio>
        itens={negocios}
        colunas={colunas}
        idDe={(n) => n.id}
        colunaDe={(n) => n.etapa}
        comColuna={(n, chave) => ({ ...n, etapa: chave as Etapa })}
        rotuloDe={(n) => n.titulo}
        eUrgente={marcarUrgentes ? eUrgente : undefined}
        renderMedida={medida}
        renderVazio={() => (
          <p className="ds-quadro-vazia">
            <Inbox aria-hidden="true" />
            Arraste um negócio para cá
          </p>
        )}
        renderCartao={(n) => (
          <CartaoNegocio
            negocio={n}
            mostrarValor={mostrarValor}
            aoAbrir={() => setIdAberto(n.id)}
          />
        )}
        aoAbrir={(n) => setIdAberto(n.id)}
        aoMudar={aoMudar}
      />

      <Sheet open={aberto !== null} onOpenChange={(v) => !v && setIdAberto(null)}>
        <SheetContent className="qd-gaveta">
          {aberto ? <GavetaNegocio negocio={aberto} /> : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

export function SecaoQuadro() {
  const [negocios, setNegocios] = React.useState<Negocio[]>(DO_FUNIL);
  const [mostrarValor, setMostrarValor] = React.useState(true);
  const [marcarUrgentes, setMarcarUrgentes] = React.useState(true);

  /* Board reduzido só para mostrar a coluna sem cartão. Estado próprio: mexer
     aqui não pode bagunçar o quadro de cima. */
  const [enxuto, setEnxuto] = React.useState<Negocio[]>(() =>
    DO_FUNIL.filter((n) => n.etapa === "Qualificação").slice(0, 2),
  );

  const total = negocios.reduce((soma, n) => soma + n.valor, 0);

  return (
    <Secao
      titulo="Quadro"
      chamada="O funil visto de lado. Mesmo dado da lista, outra leitura: em vez de comparar linha por linha, o vendedor vê onde o dinheiro está parado e empurra o cartão para a frente."
    >
      <Bloco
        titulo="Quadro de negócios"
        descricao={`Arraste entre colunas e dentro da coluna. Clique no cartão para abrir a gaveta, Enter faz o mesmo pelo teclado. Contagem e soma de cada etapa saem do estado, não de um número escrito à mão: ${brl(total)} em ${negocios.length} negócios no funil.`}
      >
        <Playground>
          <Chave
            id="qd-valor"
            rotulo="Mostrar valor no cartão"
            valor={mostrarValor}
            aoMudar={setMostrarValor}
          />
          <Chave
            id="qd-urgentes"
            rotulo="Marcar urgentes"
            valor={marcarUrgentes}
            aoMudar={setMarcarUrgentes}
          />
        </Playground>

        <div className="mt-4">
          <QuadroDemo
            negocios={negocios}
            aoMudar={setNegocios}
            mostrarValor={mostrarValor}
            marcarUrgentes={marcarUrgentes}
          />
        </div>
      </Bloco>

      <Bloco
        titulo="Coluna vazia"
        descricao="Coluna sem cartão continua sendo alvo de soltura e diz o que fazer, em vez de virar um buraco no layout. Arraste um dos dois cartões para qualquer etapa e ela volta a se preencher."
      >
        <QuadroDemo negocios={enxuto} aoMudar={setEnxuto} marcarUrgentes={false} />
      </Bloco>

      <Regras
        faca={{
          titulo: "Mesmo dado da lista",
          texto:
            "O cartão carrega os mesmos badges, o mesmo responsável e o mesmo valor da linha correspondente na lista. Trocar de visão troca o formato de leitura, nunca o conteúdo: o filtro aplicado na lista continua valendo no quadro.",
        }}
        naoFaca={{
          titulo: "Quadro com verdade própria",
          texto:
            "Nada de etapa que só existe aqui, badge inventado para o cartão ou total somado de outro jeito. Arrastar é escrita de negócio, com aviso e desfazer, não um ajuste visual que a lista não enxerga.",
        }}
      />
    </Secao>
  );
}

/* ── Gaveta de detalhe ──────────────────────────────────────────────────── */
/* Lê do mesmo array do quadro: a etapa mostrada aqui é a etapa de agora, não a
   que o cartão tinha quando foi aberto. */
function GavetaNegocio({ negocio }: { negocio: Negocio }) {
  const etiqueta = ETIQUETA[negocio.situacao];
  const campos: { rotulo: string; valor: string }[] = [
    { rotulo: "Etapa", valor: negocio.etapa },
    { rotulo: "Valor", valor: brl(negocio.valor, true) },
    { rotulo: "Produto", valor: negocio.produto },
    { rotulo: "Origem", valor: negocio.origem },
    { rotulo: "Responsável", valor: negocio.responsavel.nome },
    { rotulo: "Próxima ação", valor: negocio.proximaAcao },
    {
      rotulo: "Criado em",
      valor: new Date(`${negocio.criadoEm}T12:00:00`).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    },
  ];

  return (
    <>
      <SheetHeader className="qd-gaveta-topo">
        <SheetTitle className="qd-gaveta-titulo">{negocio.titulo}</SheetTitle>
        <SheetDescription className="qd-gaveta-empresa">{negocio.empresa}</SheetDescription>
        <span className="qd-gaveta-etiquetas">
          <span className="of-status" data-tom={etiqueta.tom}>
            {etiqueta.rotulo}
          </span>
          {/* Etapa é informação, não alerta: pastilha neutra ao lado do sinal
              de SLA, para as duas não brigarem por atenção. */}
          <span className="of-status" data-tom="neutro">
            {negocio.etapa}
          </span>
        </span>
      </SheetHeader>

      <div className="qd-gaveta-corpo">
        <dl className="qd-campos">
          {campos.map((campo) => (
            <div className="qd-campo" key={campo.rotulo}>
              <dt>{campo.rotulo}</dt>
              <dd>{campo.valor}</dd>
            </div>
          ))}
        </dl>

        <div className="ds-linha">
          <Button size="sm">
            <Phone /> Ligar
          </Button>
          <Button variant="outline" size="sm">
            <CalendarPlus /> Agendar
          </Button>
          <Button variant="subtle" size="sm">
            <ArrowRightLeft /> Mudar etapa
          </Button>
        </div>
      </div>
    </>
  );
}
