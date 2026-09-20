"use client";

/** Seção "Dados e tabela" do laboratório.
 *
 * O DataGrid é o componente de maior superfície do ONFACE: quase toda tela de
 * listagem é ele. Por isso a documentação não é um print — é o componente
 * ligado, com as chaves do playground trocando recurso ao vivo. Se um recurso
 * não sobrevive ao clique aqui, ele também não sobrevive em produção. */

import * as React from "react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowRightLeft, Trash2, TriangleAlert, UserRoundPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import {
  BarraFiltros,
  CelulaEtapa,
  CelulaMoeda,
  CelulaPrincipal,
  CelulaResponsavel,
  CelulaSituacao,
  DataGrid,
  type Densidade,
  type Faceta,
  type FacetaViva,
  type TomEtapa,
} from "../DataGrid";
import { NEGOCIOS, brl, type Etapa, type Negocio } from "../dados";
import { Bloco, Chave, Coluna, Playground, Regras, Secao } from "../lab";

/** A etapa só ganha cor quando ela muda o que a pessoa faz hoje: Fechamento
 * pede ação, Ganho e Perdido encerram. O meio do funil fica neutro, senão a
 * coluna inteira vira semáforo e nada mais salta. */
const TOM_POR_ETAPA: Record<Etapa, TomEtapa> = {
  Qualificação: "neutro",
  Negociação: "neutro",
  Proposta: "neutro",
  Fechamento: "acento",
  Ganho: "ok",
  Perdido: "risco",
};

function iniciaisDe(nome: string) {
  const partes = nome.trim().split(/\s+/);
  return (partes[0]!.charAt(0) + (partes[1]?.charAt(0) ?? "")).toUpperCase();
}

/* As colunas são constantes de módulo para a identidade não mudar a cada
   render: o DataGrid memoiza a montagem das colunas utilitárias em cima delas. */
const COLUNAS: ColumnDef<Negocio, unknown>[] = [
  {
    id: "principal",
    // Busca global lê o texto do acessor, então empresa e título entram juntos.
    accessorFn: (negocio) => `${negocio.titulo} ${negocio.empresa}`,
    header: "Negócio",
    enableHiding: false,
    cell: ({ row }) => (
      <CelulaPrincipal
        iniciais={iniciaisDe(row.original.empresa)}
        titulo={row.original.titulo}
        subtitulo={row.original.empresa}
      />
    ),
  },
  {
    accessorKey: "etapa",
    header: "Etapa",
    cell: ({ row }) => (
      <CelulaEtapa etapa={row.original.etapa} tom={TOM_POR_ETAPA[row.original.etapa]} />
    ),
  },
  {
    accessorKey: "valor",
    header: "Valor",
    meta: { alinhamento: "direita" },
    cell: ({ row }) => <CelulaMoeda valor={row.original.valor} />,
  },
  {
    id: "responsavel",
    accessorFn: (negocio) => negocio.responsavel.nome,
    header: "Responsável",
    cell: ({ row }) => (
      <CelulaResponsavel
        nome={row.original.responsavel.nome}
        iniciais={row.original.responsavel.iniciais}
      />
    ),
  },
  {
    accessorKey: "proximaAcao",
    header: "Próxima ação",
    cell: ({ row }) => (
      <CelulaSituacao texto={row.original.proximaAcao} situacao={row.original.situacao} />
    ),
  },
  {
    accessorKey: "origem",
    header: "Origem",
    cell: ({ row }) => <span className="ds-grid-rodape-info">{row.original.origem}</span>,
  },
];

const FACETAS: Faceta[] = [
  { id: "etapa", rotulo: "Etapa" },
  { id: "responsavel", rotulo: "Responsável" },
];

function acoesDaLinha(negocio: Negocio) {
  return (
    <>
      <DropdownMenuItem onSelect={() => toast.info(`Abrindo ${negocio.empresa}`)}>
        Abrir negócio
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => toast.success("Tarefa criada para amanhã, 09:00")}>
        Criar tarefa
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => toast.success(`Proposta duplicada de ${negocio.empresa}`)}>
        Duplicar
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        variant="destructive"
        onSelect={() => toast.error(`${negocio.titulo} marcado como perdido`)}
      >
        Marcar como perdido
      </DropdownMenuItem>
    </>
  );
}

function detalheDoNegocio(negocio: Negocio) {
  return (
    <dl className="ds-grid-detalhe-grade">
      <div className="ds-grid-detalhe-item">
        <dt>Produto</dt>
        <dd>{negocio.produto}</dd>
      </div>
      <div className="ds-grid-detalhe-item">
        <dt>Origem</dt>
        <dd>{negocio.origem}</dd>
      </div>
      <div className="ds-grid-detalhe-item">
        <dt>Criado em</dt>
        <dd>{new Date(`${negocio.criadoEm}T12:00:00`).toLocaleDateString("pt-BR")}</dd>
      </div>
      <div className="ds-grid-detalhe-item">
        <dt>Ticket</dt>
        <dd>{brl(negocio.valor)}</dd>
      </div>
    </dl>
  );
}

/* ═══ Demo da barra de filtros isolada ════════════════════════════════════ */

function contar(chave: (negocio: Negocio) => string) {
  const mapa = new Map<string, number>();
  for (const negocio of NEGOCIOS) {
    const valor = chave(negocio);
    mapa.set(valor, (mapa.get(valor) ?? 0) + 1);
  }
  return Array.from(mapa, ([valor, contagem]) => ({ valor, contagem })).sort((a, b) =>
    a.valor.localeCompare(b.valor, "pt-BR"),
  );
}

const OPCOES_ETAPA = contar((n) => n.etapa);
const OPCOES_RESPONSAVEL = contar((n) => n.responsavel.nome);

function DemoFiltros() {
  const [busca, setBusca] = React.useState("");
  const [etapas, setEtapas] = React.useState<string[]>([]);
  const [responsaveis, setResponsaveis] = React.useState<string[]>([]);

  function alternar(lista: string[], define: (v: string[]) => void, valor: string) {
    define(lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor]);
  }

  const facetas: FacetaViva[] = [
    {
      id: "etapa",
      rotulo: "Etapa",
      opcoes: OPCOES_ETAPA,
      selecionados: etapas,
      aoAlternar: (v) => alternar(etapas, setEtapas, v),
      aoLimpar: () => setEtapas([]),
    },
    {
      id: "responsavel",
      rotulo: "Responsável",
      opcoes: OPCOES_RESPONSAVEL,
      selecionados: responsaveis,
      aoAlternar: (v) => alternar(responsaveis, setResponsaveis, v),
      aoLimpar: () => setResponsaveis([]),
    },
  ];

  const termo = busca.trim().toLowerCase();
  const resultado = NEGOCIOS.filter(
    (negocio) =>
      (termo === "" ||
        negocio.titulo.toLowerCase().includes(termo) ||
        negocio.empresa.toLowerCase().includes(termo)) &&
      (etapas.length === 0 || etapas.includes(negocio.etapa)) &&
      (responsaveis.length === 0 || responsaveis.includes(negocio.responsavel.nome)),
  );

  return (
    <div className="ds-grid-wrap">
      <BarraFiltros
        busca={busca}
        aoBuscar={setBusca}
        placeholder="Buscar negócio ou empresa"
        facetas={facetas}
        aoLimparTudo={() => {
          setBusca("");
          setEtapas([]);
          setResponsaveis([]);
        }}
      />
      <div className="ds-grid-detalhe">
        <p className="ds-grid-rodape-info" role="status">
          {resultado.length} de {NEGOCIOS.length} negócios atendem ao filtro
          {resultado.length > 0
            ? `: ${resultado.map((n) => n.empresa).join(", ")}`
            : ". Solte um filtro para voltar a enxergar a base."}
        </p>
      </div>
    </div>
  );
}

/* ═══ Resumo do conjunto ══════════════════════════════════════════════════
 * Uma tabela sozinha não diz o que está em jogo: são doze linhas iguais e a
 * pessoa soma de cabeça. O resumo põe uma métrica em escala grande na frente
 * de tudo e deixa o resto pequeno ao lado — e o único sinal coral é também a
 * única ação, porque é ele que muda o que a tabela abaixo mostra. */
const ABERTOS = NEGOCIOS.filter((negocio) => negocio.etapa !== "Ganho" && negocio.etapa !== "Perdido");
const TOTAL_ABERTO = ABERTOS.reduce((soma, negocio) => soma + negocio.valor, 0);
const TICKET_MEDIO = Math.round(TOTAL_ABERTO / ABERTOS.length);
const FECHAM_HOJE = ABERTOS.filter((negocio) => negocio.situacao === "hoje").length;
const EM_PROPOSTA = ABERTOS.filter((negocio) => negocio.etapa === "Proposta").length;
/** Atrasado e sem tarefa são o mesmo problema para quem opera o funil: ninguém
 * combinou o próximo passo. */
const SEM_PROXIMA = ABERTOS.filter(
  (negocio) => negocio.situacao === "atrasado" || negocio.situacao === "sem-tarefa",
);

/* ═══ Seção ═══════════════════════════════════════════════════════════════ */

export function SecaoDados() {
  const [selecionavel, setSelecionavel] = React.useState(true);
  const [comFacetas, setComFacetas] = React.useState(true);
  const [expansivel, setExpansivel] = React.useState(true);
  const [densidade, setDensidade] = React.useState<Densidade>("padrao");
  const [carregando, setCarregando] = React.useState(false);
  const [vazio, setVazio] = React.useState(false);
  const [erro, setErro] = React.useState(false);
  const [soParados, setSoParados] = React.useState(false);

  return (
    <Secao
      titulo="Dados e tabela"
      chamada="Leads, Clientes, Propostas e Contratos são a mesma grade com colunas diferentes. O DataGrid é o núcleo: ordenação, busca, faceta, seleção, densidade, expansão e teclado vêm dele, não da tela."
    >
      <div className="ds-grid-resumo">
        <div>
          <p className="ds-grid-resumo-rotulo">Pipeline aberto</p>
          <p className="ds-grid-resumo-numero">{brl(TOTAL_ABERTO)}</p>
          <p className="ds-grid-resumo-apoio">
            {ABERTOS.length} negócios · ticket médio {brl(TICKET_MEDIO)}
          </p>
        </div>

        {/* Fato relacionado divide a mesma superfície: separador e alinhamento
            no lugar de um card por número. */}
        <dl className="ds-grid-resumo-fatos">
          <div className="ds-grid-resumo-fato">
            <dt>Fecham hoje</dt>
            <dd>{FECHAM_HOJE}</dd>
          </div>
          <div className="ds-grid-resumo-fato">
            <dt>Em proposta</dt>
            <dd>{EM_PROPOSTA}</dd>
          </div>
        </dl>

        <button
          type="button"
          className="ds-grid-resumo-sinal"
          aria-pressed={soParados}
          onClick={() => setSoParados((v) => !v)}
        >
          <span>
            <TriangleAlert aria-hidden />
            {SEM_PROXIMA.length} sem próxima ação
          </span>
          <small>{soParados ? "Mostrando só estes na tabela" : "Ver só estes na tabela"}</small>
        </button>
      </div>

      <Bloco
        titulo="DataGrid"
        descricao="Ligue e desligue os recursos: o grid abaixo reage na hora, com os negócios reais do funil Callface."
      >
        <Coluna>
          {/* O playground fica logo acima da barra de filtros do grid, e os
              dois eram a mesma caixa cinza com controles dentro. Tracejado e
              rotulado, ele volta a ser o que é: meta-controle da
              documentação, não chrome do produto. */}
          <div className="ds-play-meta">
            <span>Controles da documentação</span>
            <Playground>
              <Chave id="dg-selecao" rotulo="Seleção" valor={selecionavel} aoMudar={setSelecionavel} />
              <Chave id="dg-facetas" rotulo="Filtro facetado" valor={comFacetas} aoMudar={setComFacetas} />
              <Chave id="dg-expansivel" rotulo="Linha expansível" valor={expansivel} aoMudar={setExpansivel} />
              <Chave
                id="dg-compacta"
                rotulo="Densidade compacta"
                valor={densidade === "compacta"}
                aoMudar={(v) => setDensidade(v ? "compacta" : "padrao")}
              />
              <Chave
                id="dg-carregando"
                rotulo="Carregando"
                valor={carregando}
                aoMudar={(v) => {
                  setCarregando(v);
                  if (v) setErro(false);
                }}
              />
              <Chave id="dg-vazio" rotulo="Vazio" valor={vazio} aoMudar={setVazio} />
              <Chave
                id="dg-erro"
                rotulo="Erro"
                valor={erro}
                aoMudar={(v) => {
                  setErro(v);
                  if (v) setCarregando(false);
                }}
              />
            </Playground>
          </div>

          <DataGrid
            dados={vazio ? [] : soParados ? SEM_PROXIMA : NEGOCIOS}
            colunas={COLUNAS}
            idDaLinha={(negocio) => negocio.id}
            entidade="negócios"
            estado={erro ? "erro" : carregando ? "carregando" : "pronto"}
            selecionavel={selecionavel}
            expansivel={expansivel}
            facetas={comFacetas ? FACETAS : undefined}
            placeholderBusca="Buscar negócio ou empresa"
            densidade={densidade}
            aoMudarDensidade={setDensidade}
            detalhe={detalheDoNegocio}
            acoesLinha={acoesDaLinha}
            acoesMassa={(linhas, limpar) => (
              <>
                <Button
                  variant="subtle"
                  size="sm"
                  onClick={() => {
                    toast.success(`${linhas.length} negócios movidos para Negociação`);
                    limpar();
                  }}
                >
                  <ArrowRightLeft aria-hidden />
                  Mover etapa
                </Button>
                <Button
                  variant="subtle"
                  size="sm"
                  onClick={() => {
                    toast.success(`${linhas.length} negócios atribuídos a Mayara Ribeiro`);
                    limpar();
                  }}
                >
                  <UserRoundPlus aria-hidden />
                  Atribuir
                </Button>
                <Button
                  variant="subtle"
                  size="sm"
                  onClick={() => {
                    toast.error(`${linhas.length} negócios marcados como perdidos`);
                    limpar();
                  }}
                >
                  <Trash2 aria-hidden />
                  Marcar perdido
                </Button>
              </>
            )}
            aoNovo={() => {
              setVazio(false);
              toast.info("Novo negócio");
            }}
            aoTentarDeNovo={() => {
              setErro(false);
              toast.success("Consulta refeita");
            }}
          />

          <p className="ds-bloco-desc">
            Teclado: Tab entra na tabela, setas cima/baixo andam pelas linhas e Enter abre o
            detalhe da linha ativa.
          </p>
        </Coluna>
      </Bloco>

      <Bloco
        titulo="Sistema de filtros"
        descricao="Busca, faceta com contagem, chip por valor escolhido e um Limpar só. A barra não conhece a tabela: recebe valores e devolve intenção, então serve lista, quadro e relatório."
      >
        <DemoFiltros />
      </Bloco>

      <Regras
        faca={{
          titulo: "O core é um só",
          texto:
            "Precisa de uma listagem nova? Passe colunas e ligue os recursos que a tela usa. Coluna de moeda, badge de etapa e responsável já vêm tipados: a mesma informação se parece com ela mesma em Propostas, Contratos e Clientes.",
        }}
        naoFaca={{
          titulo: "Tela não inventa tabela",
          texto:
            "Nada de <table> local, grade em CSS próprio ou lista fingindo de tabela. Cada cópia perde ordenação, teclado, densidade ou estado vazio de um jeito diferente, e o usuário passa a aprender quatro tabelas em vez de uma.",
        }}
      />
    </Secao>
  );
}
