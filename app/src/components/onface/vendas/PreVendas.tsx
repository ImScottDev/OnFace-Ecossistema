"use client";

/**
 * Pré-vendas (Bloco 01).
 *
 * Board empresa-first: a Empresa é a protagonista do card e a Pessoa é o
 * contato através do qual se trabalha aquela empresa. O contexto aprofundado
 * fica no painel, não no card — a spec pede explicitamente para não entupir.
 *
 * Três etapas do board NÃO se alcançam arrastando, e isso é regra, não
 * limitação da interface:
 *   - Qualificado grava um fato histórico, então tem comando próprio;
 *   - Oportunidade cria uma entidade no Pipeline;
 *   - Nutrição e Desqualificação exigem motivo estruturado.
 */

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight, Building2, CalendarClock, CheckCircle2, Inbox, Mail, MessageCircle,
  Plus, SearchX, Sparkles, UserPlus, Users, X,
} from "lucide-react";
import type { BoardPreVendas, CardPreVendas, DetalheLead } from "@/lib/vendas/consultas";
import type { LinhaDoTempo } from "@/lib/vendas/eventos";
import {
  FAMILIAS, MOTIVOS_DESQUALIFICACAO, MOTIVOS_NUTRICAO, ROTULO_FAMILIA,
  type Familia, type MotivoDesqualificacao, type MotivoNutricao,
  type Qualificacao, type ViewPreVendas,
} from "@/lib/vendas/dominio";
import type { Resultado } from "@/lib/vendas/resultado";
import {
  Abas, AvisoBloqueio, Board, Busca, Campo, Coluna, ColunaVazia, ComPainel, LimparFiltros,
  Dialogo, Painel, Secao, Tag, dataCurta, dataHora, decorrido, useAcao,
} from "./ui";
import { AcoesContato } from "./pagina";
import { CardAquisicao, quandoVence } from "./pre-vendas-card";
import {
  BuscaPreVendas, ChipsDeFiltro, ExportarPreVendas, FiltrosPreVendas,
  ViewsRapidas, type ChipFiltro, type ValoresDeFiltro,
} from "./pre-vendas-barra";
import { PaginaCabecalho } from "@/components/onface/shell/Pagina";
import { useIsMobile } from "@/hooks/use-mobile";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Quadro } from "@/components/onface/ds/Quadro";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { DialogFooter } from "@/components/ui/dialog";
import {
  Field, FieldDescription, FieldLabel, FieldLegend, FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Item, ItemContent, ItemDescription, ItemFooter, ItemTitle } from "@/components/ui/item";
import {
  Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,
} from "@/components/ui/empty";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Aba = "ativos" | "nutricao" | "desqualificados";

/** O que o formulário de novo lead devolve. Empresa e contato são obrigatórios
 *  porque em Pré-vendas o objeto é a empresa e ela precisa de alguém por quem
 *  ser trabalhada. */
export interface EntradaNovoLead {
  empresa: string;
  pessoaNome: string;
  cnpj?: string | null;
  website?: string | null;
  cargo?: string | null;
  email?: string | null;
  telefone?: string | null;
  origem?: string | null;
  responsavelId?: string | null;
}

export interface AcoesPreVendas {
  moverEtapa: (leadId: string, para: "novo" | "em_contato" | "qualificacao") => Promise<Resultado>;
  qualificar: (leadId: string, q: Qualificacao) => Promise<Resultado>;
  salvarQualificacao: (leadId: string, q: Qualificacao) => Promise<Resultado>;
  nutrir: (leadId: string, motivo: MotivoNutricao, retomarEm: string | null, obs: string | null) => Promise<Resultado>;
  desqualificar: (leadId: string, motivo: MotivoDesqualificacao, detalhe: string | null) => Promise<Resultado>;
  reativar: (leadId: string) => Promise<Resultado>;
  registrarContato: (leadId: string, canal: "whatsapp" | "email" | "ligacao") => Promise<Resultado>;
  atribuir: (leadId: string, responsavelId: string | null) => Promise<Resultado>;
  criarOportunidade: (e: { leadId: string; familias: Familia[]; responsavelId: string; reuniao?: { data: string } | null }) => Promise<Resultado<{ ids: string[] }>>;
  criarLead: (e: EntradaNovoLead) => Promise<Resultado<{ leadId: string }>>;
  associarEmpresa: (leadId: string, nome: string, cnpj: string | null) => Promise<Resultado>;
  detalhe: (leadId: string) => Promise<Resultado<{ lead: DetalheLead | null; timeline: LinhaDoTempo[] }>>;
  criarTarefa: (e: EntradaTarefa) => Promise<Resultado<{ tarefaId: string }>>;
  atribuirEmMassa: (leadIds: string[], responsavelId: string | null) => Promise<Resultado<{ total: number }>>;
  /** Põe ou tira UMA tag de UM lead — o "+" e o "x" dos chips da gaveta. */
  tag: (leadId: string, label: string, operacao: "adicionar" | "remover") => Promise<Resultado<{ mudou: boolean }>>;
  /** As tags que a organização tem, para o menu do "+". */
  tagsDaOrg: () => Promise<Resultado<{ tags: Array<{ id: string; nome: string }>; cadencias: Array<{ id: string; nome: string }> }>>;
}

/** O que o formulário de próxima ação devolve. */
export interface EntradaTarefa {
  leadId: string;
  titulo: string;
  responsavelId: string | null;
  venceEm: string | null;
  prioridade: "baixa" | "media" | "alta";
  descricao: string | null;
}

export function PreVendas({ dados, filtro, acoes, usuarioId }: {
  dados: BoardPreVendas;
  filtro: {
    busca: string;
    responsavelId: string | null;
    view: ViewPreVendas;
    origem: string | null;
    campanha: string | null;
    desde: string | null;
  };
  acoes: AcoesPreVendas;
  /** Prefixo das rotas irmãs do módulo. Vazio = rota oficial do produto. */
  /** Quem está olhando. A view "Meus" é sobre esta pessoa. */
  usuarioId: string | null;
}) {
  const router = useRouter();
  const [, iniciarNavegacao] = useTransition();
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<{ lead: DetalheLead | null; timeline: LinhaDoTempo[] } | null>(null);
  const [modal, setModal] = useState<null | "qualificar" | "nutrir" | "desqualificar" | "oportunidade" | "novo" | "empresa" | "tarefa" | "atribuir-massa">(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);
  /** Cartões marcados para ação em massa. */
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  /** Etapa visível no celular: sete colunas lado a lado não cabem em 390px. */
  const [etapaMobile, setEtapaMobile] = useState<string>("novo");
  const { pendente, bloqueio, limparBloqueio, executar } = useAcao();
  /* O mesmo breakpoint do `vendas.css` (768px), e o hook já existia no
     projeto. No servidor ele devolve `false`, então o board nasce completo e
     o celular recorta depois da hidratação — sem divergência de marcação. */
  const noCelular = useIsMobile();

  /* ── Navegação: todo recorte mora na URL ──────────────────────────────
     Recarregar, mandar o link e voltar do detalhe precisam devolver o mesmo
     board. Recorte em `useState` morre no primeiro F5. */
  function navegar(mudancas: Record<string, string | null>) {
    const url = new URL(window.location.href);
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor === null || valor === "") url.searchParams.delete(chave);
      else url.searchParams.set(chave, valor);
    }
    iniciarNavegacao(() => router.push(`${url.pathname}${url.search}`));
  }

  async function abrir(leadId: string) {
    setSelecionado(leadId);
    limparBloqueio();
    setDetalhe(null);
    const resultado = await acoes.detalhe(leadId);
    if (resultado.ok && resultado.dados) setDetalhe(resultado.dados);
  }

  async function recarregarDetalhe() {
    if (!selecionado) return;
    const resultado = await acoes.detalhe(selecionado);
    if (resultado.ok && resultado.dados) setDetalhe(resultado.dados);
  }

  /* O quadro é controlado, então o board vive em estado local e o servidor é a
     verdade que o repõe. Sem a cópia local o cartão voltaria para a coluna de
     origem entre o soltar e o `router.refresh()`. */
  const cardsDoServidor = useMemo(
    () => dados.colunas.flatMap((coluna) => coluna.cards),
    [dados.colunas],
  );
  const [cards, setCards] = useState(cardsDoServidor);
  useEffect(() => setCards(cardsDoServidor), [cardsDoServidor]);

  /** Cartão sobre o qual a ação rápida foi disparada, sem abrir o painel. */
  const [alvoRapido, setAlvoRapido] = useState<CardPreVendas | null>(null);

  function aoMudarQuadro(proximos: CardPreVendas[]) {
    const etapaAntes = new Map(cards.map((c) => [c.leadId, c.etapa]));
    const movido = proximos.find((c) => etapaAntes.get(c.leadId) !== c.etapa);
    if (!movido) {
      // Sem mudança de etapa foi só reordenação dentro da coluna: ordem de
      // cartão não é fato de negócio e não vira escrita.
      setCards(proximos);
      return;
    }

    /* Nutrição e Desqualificação EXIGEM motivo estruturado (§20 e §21), e
       `moverEtapa` não aceita esses destinos. Antes o arraste chamava o
       comando com um destino que o domínio recusa: o cartão ia para a coluna
       na tela e a escrita falhava calada. Agora o destino abre o diálogo e o
       board só muda quando o comando volta. */
    if (movido.etapa === "nutricao" || movido.etapa === "desqualificado") {
      void abrir(movido.leadId);
      setModal(movido.etapa === "nutricao" ? "nutrir" : "desqualificar");
      return;
    }

    setCards(proximos);
    void rodar(
      () => acoes.moverEtapa(movido.leadId, movido.etapa as "novo" | "em_contato" | "qualificacao"),
      false,
      `${movido.empresa} movido.`,
    );
  }

  async function rodar(fn: () => Promise<Resultado<unknown>>, fecharModal = true, mensagem = "Alteração salva.") {
    const desfecho = await executar(async () => (await fn()) as Resultado<unknown>);
    const confirmou = desfecho.ok;
    if (confirmou) {
      if (fecharModal) setModal(null);
      setSucesso(mensagem);
      await recarregarDetalhe();
      router.refresh();
    }
    return confirmou;
  }

  const lead = detalhe?.lead ?? null;

  /* ── Ações rápidas do cartão ──────────────────────────────────────────
     WhatsApp e ligação NÃO abrem uma caixa de entrada aqui: o Atendimento é a
     inbox canônica do produto, e uma segunda dentro de Pré-vendas seria a
     conversa duplicada que a spec proíbe (§14). */
  function aoAgirNoCartao(acao: "whatsapp" | "ligar" | "tarefa" | "mais", card: CardPreVendas) {
    setAlvoRapido(card);
    if (acao === "whatsapp") {
      router.push(`/atendimento?leadId=${card.leadId}&canal=whatsapp`);
      return;
    }
    if (acao === "ligar") {
      router.push(`/atendimento?leadId=${card.leadId}&canal=ligacao`);
      return;
    }
    if (acao === "tarefa") {
      limparBloqueio();
      setModal("tarefa");
      return;
    }
    void abrir(card.leadId);
  }

  /* ── Seleção múltipla ─────────────────────────────────────────────────── */

  function marcar(leadId: string, valor: boolean) {
    setMarcados((atual) => {
      const proximo = new Set(atual);
      if (valor) proximo.add(leadId);
      else proximo.delete(leadId);
      return proximo;
    });
  }

  const emSelecao = marcados.size > 0;

  /* ── Chips do recorte vigente ─────────────────────────────────────────── */

  const chips: ChipFiltro[] = [];
  if (filtro.busca) chips.push({ chave: "busca", rotulo: "Busca", valor: filtro.busca });
  if (filtro.responsavelId) {
    const r = dados.filtros.responsaveis.find((x) => x.id === filtro.responsavelId);
    chips.push({ chave: "responsavel", rotulo: "Responsável", valor: r?.nome ?? "—" });
  }
  if (filtro.origem) chips.push({ chave: "origem", rotulo: "Origem", valor: filtro.origem });
  if (filtro.campanha) chips.push({ chave: "campanha", rotulo: "Campanha", valor: filtro.campanha });
  if (filtro.desde) chips.push({ chave: "desde", rotulo: "Desde", valor: filtro.desde });

  const valoresDeFiltro: ValoresDeFiltro = {
    responsavelId: filtro.responsavelId,
    origem: filtro.origem,
    campanha: filtro.campanha,
    desde: filtro.desde,
  };

  /** Quantos o recorte alcança — é o que o Exportar leva. */
  const totalDoRecorte = dados.colunas.reduce((soma, c) => soma + c.total, 0);

  async function exportar() {
    setExportando(true);
    try {
      const url = new URL(window.location.href);
      url.pathname = `/pre-vendas/exportar`;
      window.location.href = url.toString();
    } finally {
      // O download navega; devolver o botão evita deixá-lo girando para sempre
      // se o navegador bloquear a ida.
      setTimeout(() => setExportando(false), 1500);
    }
  }

  /* ── Colunas ──────────────────────────────────────────────────────────
     Nutrição e Desqualificado são estados reais e ficam no board — o Kanban
     único veio desfazer as abas. Mas não são etapas por onde o trabalho
     PASSA: em faixa estreita, sobra board para onde o dinheiro está. */
  const colunas = dados.colunas
    // No celular o board é UMA etapa por vez. Sete colunas em 390px não é
    // board, é um mapa que ninguém lê — e a rolagem lateral dentro de uma
    // tela que já rola na vertical é o gesto mais fácil de errar.
    .filter((c) => !noCelular || c.chave === etapaMobile)
    .map((c) => ({
      chave: c.chave,
      rotulo: c.rotulo,
      total: c.total,
      // A faixa estreita só faz sentido quando há vizinhas para poupar.
      colapsavel: !noCelular && (c.chave === "nutricao" || c.chave === "desqualificado"),
    }));

  const filtrando = chips.length > 0 || filtro.view !== "todos";

  return (
    <>
      <PaginaCabecalho
        titulo="Pré-vendas"
        descricao="Trabalhe aquisição, contato e qualificação antes do Pipeline Comercial."
        acoes={
          <div className="pv-barra-acoes">
            <FiltrosPreVendas
              valores={valoresDeFiltro}
              opcoes={dados.filtros}
              quantidade={chips.filter((c) => c.chave !== "busca").length}
              aoAplicar={(v) => navegar({
                responsavel: v.responsavelId,
                origem: v.origem,
                campanha: v.campanha,
                desde: v.desde,
              })}
            />
            <ExportarPreVendas quantidade={totalDoRecorte} aoExportar={exportar} ocupado={exportando} />
            <Button type="button" onClick={() => { limparBloqueio(); setModal("novo"); }}>
              <Plus data-icon="inline-start" />Nova aquisição
            </Button>
          </div>
        }
      />

      <div className="pv-barra">
        <BuscaPreVendas valor={filtro.busca} aoBuscar={(busca) => navegar({ busca: busca || null })} />
      </div>

      <ViewsRapidas
        ativa={filtro.view}
        contadores={dados.contadores}
        aoTrocar={(v) => navegar({ view: v === "todos" ? null : v })}
      />

      {/* Seleção e chips disputam o mesmo assunto — o recorte atual —, então
          se revezam em vez de empilhar e empurrar o board para fora da dobra. */}
      {emSelecao ? (
        <div className="pv-selecao" role="status">
          <span className="pv-selecao-conta">
            {marcados.size === 1 ? "1 selecionada" : `${marcados.size} selecionadas`}
          </span>
          <div className="pv-selecao-acoes">
            <Button type="button" size="sm" variant="outline" onClick={() => { limparBloqueio(); setModal("atribuir-massa"); }}>
              <Users data-icon="inline-start" />Atribuir
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setMarcados(new Set())}>
              <X data-icon="inline-start" />Limpar seleção
            </Button>
          </div>
        </div>
      ) : (
        <ChipsDeFiltro
          chips={chips}
          aoRemover={(chave) => navegar({
            busca: chave === "busca" ? null : filtro.busca,
            responsavel: chave === "responsavel" ? null : filtro.responsavelId,
            origem: chave === "origem" ? null : filtro.origem,
            campanha: chave === "campanha" ? null : filtro.campanha,
            desde: chave === "desde" ? null : filtro.desde,
          })}
          aoLimparTudo={() => navegar({ busca: null, responsavel: null, origem: null, campanha: null, desde: null })}
        />
      )}

      {bloqueio && !modal ? (
        <div style={{ marginBottom: "calc(14 * var(--onface-u))" }}>
          <AvisoBloqueio bloqueio={bloqueio} />
        </div>
      ) : null}
      {sucesso ? <p className="ov-nota" role="status">{sucesso}</p> : null}

      {/* Seletor de etapa do celular. Só aparece abaixo de 768px. */}
      <div className="pv-etapa-mobile pv-barra">
        <NativeSelect
          value={etapaMobile}
          onChange={(e) => setEtapaMobile(e.target.value)}
          aria-label="Etapa visível"
          className="w-full"
        >
          {dados.colunas.map((c) => (
            <NativeSelectOption key={c.chave} value={c.chave}>
              {c.rotulo} ({c.total})
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      {cards.length === 0 && filtrando ? (
        <Empty className="my-8">
          <EmptyHeader>
            <EmptyMedia variant="icon"><SearchX /></EmptyMedia>
            <EmptyTitle>Nenhuma aquisição com estes filtros</EmptyTitle>
            <EmptyDescription>
              O recorte atual não alcança nenhum registro. A operação continua lá.
            </EmptyDescription>
          </EmptyHeader>
          <Button
            type="button"
            variant="outline"
            onClick={() => navegar({ busca: null, responsavel: null, origem: null, campanha: null, desde: null, view: null })}
          >
            Limpar filtros
          </Button>
        </Empty>
      ) : cards.length === 0 ? (
        <Empty className="my-8">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Inbox /></EmptyMedia>
            <EmptyTitle>Sua operação de pré-vendas começa aqui</EmptyTitle>
            <EmptyDescription>
              Adicione a primeira aquisição manualmente — ela entra em Novo e passa a ser trabalhada no board.
            </EmptyDescription>
          </EmptyHeader>
          <Button type="button" onClick={() => { limparBloqueio(); setModal("novo"); }}>
            <Plus data-icon="inline-start" />Nova aquisição
          </Button>
        </Empty>
      ) : (
        <ComPainel
          aberto={Boolean(selecionado)}
          painel={
            <PainelLead
              lead={lead}
              timeline={detalhe?.timeline ?? []}
              pendente={pendente}
              bloqueio={bloqueio}
              responsaveis={dados.filtros.responsaveis}
              aoFechar={() => { setSelecionado(null); setDetalhe(null); limparBloqueio(); }}
              aoAgir={(tipo) => {
                if (tipo === "qualificar") setModal("qualificar");
                else if (tipo === "criar_oportunidade") setModal("oportunidade");
                else if (tipo === "associar_empresa") setModal("empresa");
                else if (tipo === "tarefa") { setAlvoRapido(null); setModal("tarefa"); }
              }}
              acoes={{
                mover: (para) => rodar(() => acoes.moverEtapa(lead!.id, para), false),
                contato: (canal) => rodar(() => acoes.registrarContato(lead!.id, canal), false),
                atribuir: (id) => rodar(() => acoes.atribuir(lead!.id, id), false),
                reativar: () => rodar(() => acoes.reativar(lead!.id), false),
                abrirModal: setModal,
              }}
            />
          }
        >
          <Quadro<CardPreVendas>
            itens={noCelular ? cards.filter((c) => c.etapa === etapaMobile) : cards}
            colunas={colunas}
            idDe={(c) => c.leadId}
            colunaDe={(c) => c.etapa}
            comColuna={(c, chave) => ({ ...c, etapa: chave as CardPreVendas["etapa"] })}
            rotuloDe={(c) => c.empresa}
            podeSoltar={(_card, destino) => MOTIVO_NAO_ARRASTA[destino] ?? true}
            /* O cartão já traz a própria superfície (`Item variant="outline"`).
               Passar a do quadro por cima seria a segunda definição da mesma
               superfície, que foi o bug do `ov-card` em cima do `Item`. */
            classeCartao="cursor-grab active:cursor-grabbing data-[arrastando]:opacity-40"
            renderMedida={(itens, coluna) => (
              <span className="ov-coluna-contagem">
                {coluna.total != null && itens.length < coluna.total
                  ? `${itens.length} de ${coluna.total}`
                  : itens.length}
              </span>
            )}
            renderVazio={() => (
              <ColunaVazia filtrado={filtrando}>
                Sem registros aqui.
              </ColunaVazia>
            )}
            renderCartao={(card) => (
              <CardAquisicao
                card={card}
                selecionado={card.leadId === selecionado}
                marcado={marcados.has(card.leadId)}
                emSelecao={emSelecao}
                aoMarcar={marcar}
                aoAgir={aoAgirNoCartao}
              />
            )}
            aoAbrir={(card) => void abrir(card.leadId)}
            aoMudar={aoMudarQuadro}
          />
        </ComPainel>
      )}

      {/* ── Diálogos ────────────────────────────────────────────────────── */}

      <DialogoQualificar
        aberto={modal === "qualificar"}
        lead={lead}
        pendente={pendente}
        bloqueio={bloqueio}
        aoFechar={() => setModal(null)}
        aoSalvar={(q, qualificar) =>
          rodar(() => (qualificar ? acoes.qualificar(lead!.id, q) : acoes.salvarQualificacao(lead!.id, q)))}
      />

      <DialogoNutrir
        aberto={modal === "nutrir"}
        pendente={pendente}
        bloqueio={bloqueio}
        aoFechar={() => { setModal(null); router.refresh(); }}
        aoConfirmar={(motivo, retomarEm, obs) => rodar(() => acoes.nutrir(lead!.id, motivo, retomarEm, obs))}
      />

      <DialogoDesqualificar
        aberto={modal === "desqualificar"}
        pendente={pendente}
        bloqueio={bloqueio}
        aoFechar={() => { setModal(null); router.refresh(); }}
        aoConfirmar={(motivo, detalhe) => rodar(() => acoes.desqualificar(lead!.id, motivo, detalhe))}
      />

      <DialogoOportunidade
        aberto={modal === "oportunidade"}
        lead={lead}
        responsaveis={dados.filtros.responsaveis}
        pendente={pendente}
        bloqueio={bloqueio}
        aoFechar={() => setModal(null)}
        aoConfirmar={(familias, responsavelId, reuniao) =>
          rodar(() => acoes.criarOportunidade({ leadId: lead!.id, familias, responsavelId, reuniao }))}
      />

      <DialogoNovoLead
        aberto={modal === "novo"}
        responsaveis={dados.filtros.responsaveis}
        pendente={pendente}
        bloqueio={bloqueio}
        aoFechar={() => setModal(null)}
        aoConfirmar={(entrada) => rodar(() => acoes.criarLead(entrada))}
      />

      <DialogoAssociarEmpresa
        aberto={modal === "empresa"}
        nomeSugerido={lead?.empresa.nome ?? ""}
        pendente={pendente}
        bloqueio={bloqueio}
        aoFechar={() => setModal(null)}
        aoConfirmar={(nome, cnpj) => rodar(() => acoes.associarEmpresa(lead!.id, nome, cnpj))}
      />

      <DialogoTarefa
        aberto={modal === "tarefa"}
        contexto={alvoRapido
          ? { leadId: alvoRapido.leadId, nome: alvoRapido.empresa }
          : lead ? { leadId: lead.id, nome: lead.empresa.nome } : null}
        responsaveis={dados.filtros.responsaveis}
        usuarioId={usuarioId}
        pendente={pendente}
        bloqueio={bloqueio}
        aoFechar={() => { setModal(null); setAlvoRapido(null); }}
        aoConfirmar={(entrada) => rodar(() => acoes.criarTarefa(entrada), true, "Tarefa criada.")}
      />

      <DialogoAtribuirEmMassa
        aberto={modal === "atribuir-massa"}
        quantidade={marcados.size}
        responsaveis={dados.filtros.responsaveis}
        pendente={pendente}
        bloqueio={bloqueio}
        aoFechar={() => setModal(null)}
        aoConfirmar={async (responsavelId) => {
          const ok = await rodar(
            () => acoes.atribuirEmMassa([...marcados], responsavelId),
            true,
            `${marcados.size} ${marcados.size === 1 ? "aquisição atribuída" : "aquisições atribuídas"}.`,
          );
          if (ok) setMarcados(new Set());
          return ok;
        }}
      />
    </>
  );
}

/* ── Regra de arraste ──────────────────────────────────────────────────── */

/**
 * Etapas que NÃO se alcançam arrastando, e por quê.
 *
 * Não é limitação da interface, é o domínio: `acoes.moverEtapa` aceita
 * exatamente `novo`, `em_contato` e `qualificacao`. Qualificado grava um fato
 * histórico e Oportunidade cria uma entidade no Pipeline — as duas têm comando
 * próprio, com confirmação. O quadro recusa o destino E diz o motivo, em vez
 * de simplesmente não acontecer nada quando a pessoa solta o cartão.
 */
const MOTIVO_NAO_ARRASTA: Record<string, string> = {
  qualificado: "Qualificado grava um fato histórico. Use Qualificar no painel do lead.",
  oportunidade: "Oportunidade cria um negócio no Pipeline. Use Criar oportunidade no painel do lead.",
};

/* ── Painel ────────────────────────────────────────────────────────────── */

/**
 * Os CTAs do painel, por estágio.
 *
 * Fica numa tabela e não espalhado em `if`s dentro do JSX porque o contrato da
 * spec (§13) é exatamente este: cada estado tem UM próximo passo óbvio e um
 * alternativo. Escrito como dados, dá para ler a regra inteira de uma vez e
 * conferir contra a spec sem seguir ramo de condicional.
 *
 * A regra que este mapa existe para tornar impossível de quebrar: QUALIFICAR
 * NÃO CRIA OPORTUNIDADE (§16). `qualificado` é o único estágio cujo CTA
 * primário é "Criar oportunidade", e ele só chega ali depois que alguém
 * confirmou a qualificação — nunca como efeito colateral dela.
 */
const PROXIMO_PASSO: Record<string, {
  primario?: { rotulo: string; tipo: string; icone: typeof ArrowRight };
  secundario?: { rotulo: string; tipo: string };
}> = {
  novo: {
    primario: { rotulo: "Iniciar contato", tipo: "contato_whatsapp", icone: MessageCircle },
    secundario: { rotulo: "Qualificar", tipo: "qualificar" },
  },
  em_contato: {
    primario: { rotulo: "Continuar qualificação", tipo: "qualificar", icone: Sparkles },
    secundario: { rotulo: "Agendar reunião", tipo: "oportunidade" },
  },
  qualificacao: {
    primario: { rotulo: "Confirmar qualificação", tipo: "qualificar", icone: CheckCircle2 },
  },
  qualificado: {
    primario: { rotulo: "Criar oportunidade", tipo: "criar_oportunidade", icone: ArrowRight },
  },
  oportunidade: {
    primario: { rotulo: "Abrir oportunidade", tipo: "abrir_oportunidade", icone: ArrowRight },
  },
  nutricao: {
    primario: { rotulo: "Retomar agora", tipo: "reativar", icone: ArrowRight },
  },
  // Desqualificado não ganha CTA comercial. "Reavaliar" existe porque o
  // domínio permite retomar, mas entra como ação secundária e discreta: um
  // botão coral aqui seria o produto insistindo em quem já disse não.
  desqualificado: {
    secundario: { rotulo: "Reavaliar", tipo: "reativar" },
  },
};

/**
 * Quick View da aquisição.
 *
 * Painel e não rota: o SDR trabalha dezenas de registros por hora e navegar
 * para fora do board perderia a posição, o recorte e a rolagem a cada um.
 *
 * A ordem das seções é a ordem das perguntas de quem abre: o que faço agora
 * (CTA), com quem falo (contato), de onde veio e quando foi tocado (resumo),
 * o que já sei (qualificação), o que virou negócio (oportunidades) e o que
 * aconteceu (histórico).
 */
function PainelLead({ lead, timeline, pendente, bloqueio, responsaveis, aoFechar, aoAgir, acoes }: {
  lead: DetalheLead | null;
  timeline: LinhaDoTempo[];
  pendente: boolean;
  bloqueio: { mensagem: string; acao?: { rotulo: string; tipo: string } } | null;
  responsaveis: Array<{ id: string; nome: string }>;
  aoFechar: () => void;
  aoAgir: (tipo: string) => void;
  acoes: {
    mover: (para: "novo" | "em_contato" | "qualificacao") => Promise<boolean>;
    contato: (canal: "whatsapp" | "email" | "ligacao") => Promise<boolean>;
    atribuir: (responsavelId: string | null) => Promise<boolean>;
    reativar: () => Promise<boolean>;
    abrirModal: (m: "qualificar" | "nutrir" | "desqualificar" | "oportunidade" | "tarefa") => void;
  };
}) {
  /* Esqueleto com a FORMA do conteúdo, não um "carregando…".
     O painel abre instantâneo e o detalhe chega depois; uma frase centralizada
     faria a gaveta saltar quando o conteúdo entrasse. */
  if (!lead) {
    return (
      <Painel titulo="Carregando" aoFechar={aoFechar}>
        <div className="flex flex-col gap-3 p-1">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </Painel>
    );
  }

  const q = (lead.qualificacao ?? {}) as Record<string, string | undefined>;
  const encerrado = lead.etapa === "nutricao" || lead.etapa === "desqualificado";
  const passo = PROXIMO_PASSO[lead.etapa] ?? {};

  /** Despacha o CTA para a ação certa. */
  function agir(tipo: string) {
    if (tipo === "contato_whatsapp") void acoes.contato("whatsapp");
    else if (tipo === "qualificar") {
      // Sair de "em contato" para "qualificação" é um fato de processo, e ele
      // acontece ao ABRIR o formulário, não ao salvá-lo: quem começou a
      // levantar informação já está qualificando.
      if (lead!.etapa === "em_contato") void acoes.mover("qualificacao");
      acoes.abrirModal("qualificar");
    }
    else if (tipo === "reativar") void acoes.reativar();
    else aoAgir(tipo);
  }

  return (
    <Painel
      titulo={lead.empresa.nome}
      subtitulo={`${lead.pessoa.nome}${lead.pessoa.cargo ? ` · ${lead.pessoa.cargo}` : ""}`}
      aoFechar={aoFechar}
    >
      <div className="ov-card-meta">
        <Tag tom="coral">{lead.etapaRotulo}</Tag>
        {lead.qualificado ? <Tag tom="sucesso">Qualificado {dataCurta(lead.qualificadoEm)}</Tag> : null}
        {lead.preQualificado ? <Tag tom="neutro-escuro">Pré-qualificado</Tag> : null}
      </div>

      {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} aoAgir={aoAgir} /> : null}

      {/* ── Qualificado sem oportunidade: o estado que a spec §16 manda tornar
          explícito. O fato de ter passado no critério NÃO criou negócio
          nenhum, e o painel diz isso com todas as letras em vez de deixar a
          pessoa supor. */}
      {lead.etapa === "qualificado" && lead.oportunidades.length === 0 ? (
        <p className="ov-nota" role="status">
          <CheckCircle2 aria-hidden className="inline size-3.5 align-[-2px]" />{" "}
          Lead qualificado. Nenhuma oportunidade foi criada — o handoff para o
          Pipeline é uma ação explícita.
        </p>
      ) : null}

      {/* ── Próximo passo ───────────────────────────────────────────────── */}
      <Secao titulo="Próximo passo">
        <div className="flex flex-wrap gap-2">
          {passo.primario ? (
            <Button
              type="button"
              disabled={pendente}
              onClick={() => {
                if (passo.primario!.tipo === "abrir_oportunidade" && lead.oportunidades[0]) return;
                agir(passo.primario!.tipo);
              }}
              asChild={passo.primario.tipo === "abrir_oportunidade" && Boolean(lead.oportunidades[0])}
            >
              {passo.primario.tipo === "abrir_oportunidade" && lead.oportunidades[0] ? (
                <Link href={`/pipeline?oportunidade=${lead.oportunidades[0].id}`}>
                  <ArrowRight aria-hidden />Abrir oportunidade
                </Link>
              ) : (
                <>
                  <passo.primario.icone aria-hidden />
                  {passo.primario.rotulo}
                </>
              )}
            </Button>
          ) : null}

          {passo.secundario ? (
            <Button type="button" variant="outline" disabled={pendente} onClick={() => agir(passo.secundario!.tipo)}>
              {passo.secundario.rotulo}
            </Button>
          ) : null}

          {!encerrado ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" aria-label="Mais ações">
                  <Building2 aria-hidden className="rotate-90 opacity-0 absolute" />
                  <span aria-hidden>⋯</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => acoes.abrirModal("tarefa")}>
                  Criar tarefa
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => acoes.abrirModal("qualificar")}>
                  Editar qualificação
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => acoes.abrirModal("nutrir")}>
                  Enviar para nutrição
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={() => acoes.abrirModal("desqualificar")}>
                  Desqualificar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </Secao>

      {/* ── Próxima ação: a Task real ───────────────────────────────────── */}
      <Secao titulo="Próxima ação">
        {lead.proximaAcao ? (
          <p className="ov-nota">
            <CalendarClock aria-hidden className="inline size-3 align-[-2px]" />{" "}
            {lead.proximaAcao.titulo} · <strong>{quandoVence(lead.proximaAcao.venceEm)}</strong>
          </p>
        ) : (
          <div className="flex flex-col items-start gap-2">
            <p className="ov-nota">Nenhuma tarefa aberta para esta aquisição.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => acoes.abrirModal("tarefa")}>
              <CalendarClock aria-hidden />Definir próxima ação
            </Button>
          </div>
        )}
      </Secao>

      <Secao titulo="Falar agora">
        <AcoesContato alvo={{
          leadId: lead.id,
          whatsapp: lead.pessoa.whatsapp,
          telefone: lead.pessoa.telefone,
          email: lead.pessoa.email,
        }} />
      </Secao>

      {/* ── Resumo operacional ──────────────────────────────────────────── */}
      <Secao titulo="Resumo operacional">
        <dl style={{ margin: 0 }}>
          <Campo rotulo="Origem">{lead.atribuicao.origem}</Campo>
          <Campo rotulo="Campanha">{lead.atribuicao.campanha}</Campo>
          <Campo rotulo="Interesse">{lead.servicos?.join(", ")}</Campo>
          {/* `primeiroToque`/`ultimoToque` são o CANAL do toque (`source` do
              ponto de contato), não a data dele. Rotulados como "toque" eles
              liam como data e entregavam "ig" — o que parecia dado corrompido
              e era só o Instagram. */}
          <Campo rotulo="Canal de entrada">{lead.atribuicao.primeiroToque}</Campo>
          <Campo rotulo="Último canal">{lead.atribuicao.ultimoToque}</Campo>
          <Campo rotulo="1º contato">{dataHora(lead.primeiroContatoEm)}</Campo>
          <Campo rotulo="Criada em">{dataHora(lead.criadoEm)}</Campo>
          <Campo rotulo="Landing page">{lead.atribuicao.landingPage}</Campo>
        </dl>
      </Secao>

      <Secao titulo="Responsável">
        <NativeSelect
          value={lead.responsavel.id ?? ""}
          disabled={pendente}
          onChange={(e) => acoes.atribuir(e.target.value || null)}
          aria-label="Responsável pela aquisição"
        >
          <NativeSelectOption value="">Sem responsável</NativeSelectOption>
          {responsaveis.map((r) => (
            <NativeSelectOption key={r.id} value={r.id}>{r.nome}</NativeSelectOption>
          ))}
        </NativeSelect>
      </Secao>

      <Secao titulo="Empresa">
        <dl style={{ margin: 0 }}>
          <Campo rotulo="Segmento">{lead.empresa.setor}</Campo>
          <Campo rotulo="Porte">{lead.empresa.porte}</Campo>
          <Campo rotulo="Cidade">{lead.empresa.cidade}</Campo>
          <Campo rotulo="CNPJ">{lead.empresa.cnpj}</Campo>
        </dl>
        {lead.empresa.id ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/empresas/${lead.empresa.id}`}>
              <Building2 aria-hidden />Abrir empresa
            </Link>
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => aoAgir("associar_empresa")}>
            <Building2 aria-hidden />Associar empresa
          </Button>
        )}
      </Secao>

      <Secao titulo="Qualificação">
        {Object.keys(q).length === 0 ? (
          <p className="ov-nota">Nada registrado ainda.</p>
        ) : (
          <dl style={{ margin: 0 }}>
            <Campo rotulo="Dor">{q.dor}</Campo>
            <Campo rotulo="Necessidade">{q.necessidade}</Campo>
            <Campo rotulo="Urgência">{q.urgencia}</Campo>
            <Campo rotulo="Budget">{q.budget}</Campo>
            <Campo rotulo="Decisor">{q.decisor}</Campo>
            <Campo rotulo="Timing">{q.timing}</Campo>
            <Campo rotulo="Concorrente">{q.solucaoAtual}</Campo>
          </dl>
        )}
      </Secao>

      <Secao titulo="Oportunidades">
        {lead.oportunidades.length === 0 ? (
          <p className="ov-nota">Nenhuma oportunidade criada a partir desta aquisição.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {lead.oportunidades.map((o) => (
              <Button key={o.id} asChild variant="outline" size="sm" className="justify-start">
                <Link href={`/pipeline?oportunidade=${o.id}`}>
                  {o.titulo} · {o.etapaRotulo}
                </Link>
              </Button>
            ))}
          </div>
        )}
      </Secao>

      <Secao titulo="Histórico">
        {timeline.length === 0 ? (
          <p className="ov-nota">Nenhum evento registrado.</p>
        ) : (
          <div className="ov-timeline">
            {timeline.map((e) => (
              <div className="ov-timeline-item" key={e.id}>
                <span className="ov-timeline-marca" aria-hidden />
                <div>
                  <strong>{rotuloEvento(e.tipo)}</strong>
                  <span>
                    {dataHora(e.ocorridoEm)}
                    {e.usuarioNome ? ` · ${e.usuarioNome}` : e.atorTipo !== "HUMAN" ? ` · ${rotuloAtor(e.atorTipo)}` : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Secao>
    </Painel>
  );
}
/* ── Diálogos ──────────────────────────────────────────────────────────── */

function DialogoQualificar({ aberto, lead, pendente, bloqueio, aoFechar, aoSalvar }: {
  aberto: boolean;
  lead: DetalheLead | null;
  pendente: boolean;
  bloqueio: { mensagem: string } | null;
  aoFechar: () => void;
  aoSalvar: (q: Qualificacao, qualificar: boolean) => Promise<boolean>;
}) {
  const inicial = useMemo(() => (lead?.qualificacao ?? {}) as Qualificacao, [lead]);
  const [form, setForm] = useState<Qualificacao>(inicial);

  // Reabrir o diálogo com outro lead precisa recarregar o formulário; sem isto
  // a qualificação de um lead apareceria dentro de outro.
  const [ultimoLead, setUltimoLead] = useState<string | null>(null);
  if (aberto && lead && lead.id !== ultimoLead) {
    setUltimoLead(lead.id);
    setForm(inicial);
  }

  const campo = (chave: keyof Qualificacao) => ({
    value: (form[chave] as string) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [chave]: e.target.value })),
  });

  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Qualificação"
      descricao="Nenhum campo é obrigatório. Salvar guarda o que foi levantado; qualificar grava o fato de que a empresa passou pelos critérios."
      largura="larga"
    >
      <div className="ov-form">
        {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}
        <div className="ov-form-linha">
          <label><span>Dor / problema</span><input {...campo("dor")} /></label>
          <label><span>Necessidade</span><input {...campo("necessidade")} /></label>
          <label><span>Cenário atual</span><input {...campo("cenarioAtual")} /></label>
          <label><span>Solução / concorrente atual</span><input {...campo("solucaoAtual")} /></label>
          <label><span>Urgência</span><input {...campo("urgencia")} /></label>
          <label><span>Budget</span><input {...campo("budget")} /></label>
          <label><span>Decisor</span><input {...campo("decisor")} /></label>
          <label><span>Timing de decisão</span><input {...campo("timing")} /></label>
          <label><span>ICP / aderência</span><input {...campo("icp")} /></label>
          <label><span>Influenciadores</span><input {...campo("influenciadores")} /></label>
        </div>
        <label><span>Observações</span><textarea {...campo("observacoes")} /></label>
        <div className="ov-form-rodape">
          <button type="button" className="ov-botao" data-variante="neutro" disabled={pendente} onClick={() => aoSalvar(form, false)}>
            Salvar sem qualificar
          </button>
          <button type="button" className="ov-botao" disabled={pendente} onClick={() => aoSalvar(form, true)}>
            <CheckCircle2 aria-hidden />Qualificar
          </button>
        </div>
      </div>
    </Dialogo>
  );
}

function DialogoNutrir({ aberto, pendente, bloqueio, aoFechar, aoConfirmar }: {
  aberto: boolean;
  pendente: boolean;
  bloqueio: { mensagem: string } | null;
  aoFechar: () => void;
  aoConfirmar: (motivo: MotivoNutricao, retomarEm: string | null, obs: string | null) => Promise<boolean>;
}) {
  const [motivo, setMotivo] = useState<MotivoNutricao>("sem_resposta");
  const [retomarEm, setRetomarEm] = useState("");
  const [observacao, setObservacao] = useState("");

  const definicao = MOTIVOS_NUTRICAO.find((m) => m.chave === motivo);

  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Mover para nutrição"
      descricao="Nutrição não é arquivo morto: com data de retomada, o lead volta sozinho para a fila na data escolhida."
    >
      <div className="ov-form">
        {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}
        <label>
          <span>Motivo</span>
          <select value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoNutricao)}>
            {MOTIVOS_NUTRICAO.map((m) => <option key={m.chave} value={m.chave}>{m.rotulo}</option>)}
          </select>
        </label>
        <label>
          <span>Retomar em {definicao?.exigeRetomada ? "(obrigatório)" : "(opcional)"}</span>
          <input type="date" value={retomarEm} onChange={(e) => setRetomarEm(e.target.value)} />
        </label>
        <label><span>Observação</span><textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} /></label>
        <div className="ov-form-rodape">
          <button type="button" className="ov-botao" data-variante="neutro" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="ov-botao" disabled={pendente}
            onClick={() => aoConfirmar(motivo, retomarEm || null, observacao.trim() || null)}>
            Mover para nutrição
          </button>
        </div>
      </div>
    </Dialogo>
  );
}

function DialogoDesqualificar({ aberto, pendente, bloqueio, aoFechar, aoConfirmar }: {
  aberto: boolean;
  pendente: boolean;
  bloqueio: { mensagem: string } | null;
  aoFechar: () => void;
  aoConfirmar: (motivo: MotivoDesqualificacao, detalhe: string | null) => Promise<boolean>;
}) {
  const [motivo, setMotivo] = useState<MotivoDesqualificacao>("fora_icp");
  const [detalhe, setDetalhe] = useState("");

  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Desqualificar lead"
      descricao="O motivo alimenta relatório depois: é ele que responde por que o funil perde no topo."
    >
      <div className="ov-form">
        {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}
        <label>
          <span>Motivo</span>
          <select value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoDesqualificacao)}>
            {MOTIVOS_DESQUALIFICACAO.map((m) => <option key={m.chave} value={m.chave}>{m.rotulo}</option>)}
          </select>
        </label>
        <label><span>Detalhe</span><textarea value={detalhe} onChange={(e) => setDetalhe(e.target.value)} /></label>
        <div className="ov-form-rodape">
          <button type="button" className="ov-botao" data-variante="neutro" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="ov-botao" data-variante="perigo" disabled={pendente}
            onClick={() => aoConfirmar(motivo, detalhe.trim() || null)}>
            Desqualificar
          </button>
        </div>
      </div>
    </Dialogo>
  );
}

function DialogoOportunidade({ aberto, lead, responsaveis, pendente, bloqueio, aoFechar, aoConfirmar }: {
  aberto: boolean;
  lead: DetalheLead | null;
  responsaveis: Array<{ id: string; nome: string }>;
  pendente: boolean;
  bloqueio: { mensagem: string } | null;
  aoFechar: () => void;
  aoConfirmar: (familias: Familia[], responsavelId: string, reuniao: { data: string } | null) => Promise<boolean>;
}) {
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [responsavelId, setResponsavelId] = useState("");
  const [comReuniao, setComReuniao] = useState(false);
  const [dataReuniao, setDataReuniao] = useState("");

  const pronto = Boolean(responsavelId) && (!comReuniao || Boolean(dataReuniao));

  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Criar oportunidade"
      descricao={lead ? `${lead.empresa.nome} · ${lead.pessoa.nome}` : undefined}
    >
      <div className="ov-form">
        {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}

        {/* `FieldSet` + `FieldLegend` porque é um grupo de controles com um
            rótulo só, que é o caso que a doc do Field nomeia. O `ToggleGroup`
            entra no lugar de cinco `<button data-marcada>`: seleção múltipla
            já é o que ele faz, com `role="group"` e teclado de graça. */}
        <FieldSet>
          <FieldLegend variant="label">Família comercial</FieldLegend>
          <ToggleGroup
            type="multiple"
            variant="outline"
            value={familias}
            onValueChange={(v) => setFamilias(v as Familia[])}
          >
            {FAMILIAS.map((f) => (
              <ToggleGroupItem key={f} value={f}>{ROTULO_FAMILIA[f]}</ToggleGroupItem>
            ))}
          </ToggleGroup>
          <FieldDescription>
            {familias.length === 0
              ? "A oportunidade entra em Entrada com família a definir. Será obrigatório escolher uma antes de criar proposta, contrato, checkout ou concluir como ganha."
              : familias.length > 1
                ? `Serão criadas ${familias.length} oportunidades irmãs, uma por família, com fechamento independente e o mesmo bundle.`
                : "Cada oportunidade pertence a exatamente uma família. Marcar mais de uma cria oportunidades irmãs."}
          </FieldDescription>
        </FieldSet>

        <Field>
          <FieldLabel htmlFor="op-responsavel">Responsável comercial</FieldLabel>
          <NativeSelect
            id="op-responsavel"
            value={responsavelId}
            onChange={(e) => setResponsavelId(e.target.value)}
          >
            <NativeSelectOption value="">Escolha o closer</NativeSelectOption>
            {responsaveis.map((r) => (
              <NativeSelectOption key={r.id} value={r.id}>{r.nome}</NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>

        {/* Escolha única, então `type="single"`. O par era dois botões com
            `data-marcada` complementares, que é um rádio escrito à mão. */}
        <FieldSet>
          <FieldLegend variant="label">Próximo passo</FieldLegend>
          <ToggleGroup
            type="single"
            variant="outline"
            value={comReuniao ? "reuniao" : "so-criar"}
            onValueChange={(v) => { if (v) setComReuniao(v === "reuniao"); }}
          >
            <ToggleGroupItem value="so-criar">Apenas criar oportunidade</ToggleGroupItem>
            <ToggleGroupItem value="reuniao">Criar e agendar reunião</ToggleGroupItem>
          </ToggleGroup>
          <FieldDescription>
            Reunião não é requisito: a oportunidade entra no Pipeline com ou sem agenda.
          </FieldDescription>
        </FieldSet>

        {comReuniao ? (
          <Field>
            <FieldLabel htmlFor="op-reuniao">Data e hora da reunião</FieldLabel>
            <Input
              id="op-reuniao"
              type="datetime-local"
              value={dataReuniao}
              onChange={(e) => setDataReuniao(e.target.value)}
            />
          </Field>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={aoFechar}>Cancelar</Button>
          <Button
            type="button"
            loading={pendente}
            disabled={!pronto}
            onClick={() => aoConfirmar(familias, responsavelId, comReuniao ? { data: dataReuniao } : null)}
          >
            <ArrowRight aria-hidden />
            {familias.length > 1 ? `Criar ${familias.length} oportunidades` : "Criar oportunidade"}
          </Button>
        </DialogFooter>
      </div>
    </Dialogo>
  );
}

function DialogoNovoLead({ aberto, responsaveis, pendente, bloqueio, aoFechar, aoConfirmar }: {
  aberto: boolean;
  responsaveis: Array<{ id: string; nome: string }>;
  pendente: boolean;
  bloqueio: { mensagem: string } | null;
  aoFechar: () => void;
  aoConfirmar: (entrada: EntradaNovoLead) => Promise<boolean>;
}) {
  const [form, setForm] = useState({
    empresa: "", cnpj: "", website: "", pessoaNome: "", cargo: "",
    email: "", telefone: "", origem: "", responsavelId: "",
  });
  const campo = (chave: keyof typeof form) => ({
    value: form[chave],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [chave]: e.target.value })),
  });

  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Novo lead"
      descricao="Empresa é obrigatória: em Pré-vendas o objeto de trabalho é a empresa, e a pessoa é o contato dela."
      largura="larga"
    >
      <div className="ov-form">
        {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}
        <div className="ov-form-linha">
          <label><span>Empresa *</span><input {...campo("empresa")} /></label>
          <label><span>CNPJ</span><input {...campo("cnpj")} /></label>
          <label><span>Site</span><input {...campo("website")} placeholder="novatech.com.br" /></label>
          <label><span>Origem</span><input {...campo("origem")} placeholder="Indicação, Evento…" /></label>
          <label><span>Contato *</span><input {...campo("pessoaNome")} /></label>
          <label><span>Cargo</span><input {...campo("cargo")} /></label>
          <label><span>E-mail</span><input type="email" {...campo("email")} /></label>
          <label><span>Telefone</span><input {...campo("telefone")} /></label>
        </div>
        <label>
          <span>Responsável</span>
          <select {...campo("responsavelId")}>
            <option value="">Sem responsável</option>
            {responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        </label>
        <p className="ov-nota">
          Criar um lead não cria oportunidade. O handoff para o Pipeline é uma ação explícita, depois da qualificação.
        </p>
        <div className="ov-form-rodape">
          <button type="button" className="ov-botao" data-variante="neutro" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="ov-botao"
            disabled={pendente || !form.empresa.trim() || !form.pessoaNome.trim()}
            onClick={() => aoConfirmar({
              empresa: form.empresa, cnpj: form.cnpj || null, website: form.website || null,
              pessoaNome: form.pessoaNome, cargo: form.cargo || null, email: form.email || null,
              telefone: form.telefone || null, origem: form.origem || null,
              responsavelId: form.responsavelId || null,
            })}>
            <UserPlus aria-hidden />Criar lead
          </button>
        </div>
      </div>
    </Dialogo>
  );
}

function DialogoAssociarEmpresa({ aberto, nomeSugerido, pendente, bloqueio, aoFechar, aoConfirmar }: {
  aberto: boolean;
  nomeSugerido: string;
  pendente: boolean;
  bloqueio: { mensagem: string } | null;
  aoFechar: () => void;
  aoConfirmar: (nome: string, cnpj: string | null) => Promise<boolean>;
}) {
  const [nome, setNome] = useState(nomeSugerido);
  const [cnpj, setCnpj] = useState("");

  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Associar empresa"
      descricao="Se já existir uma empresa com este CNPJ, domínio ou nome, ela é reaproveitada em vez de duplicada."
    >
      <div className="ov-form">
        {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}
        <label><span>Nome da empresa</span><input value={nome} onChange={(e) => setNome(e.target.value)} /></label>
        <label><span>CNPJ</span><input value={cnpj} onChange={(e) => setCnpj(e.target.value)} /></label>
        <div className="ov-form-rodape">
          <button type="button" className="ov-botao" data-variante="neutro" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="ov-botao" disabled={pendente || !nome.trim()}
            onClick={() => aoConfirmar(nome.trim(), cnpj.trim() || null)}>
            Associar
          </button>
        </div>
      </div>
    </Dialogo>
  );
}

/* ── Rótulos ───────────────────────────────────────────────────────────── */

export function rotuloEvento(tipo: string): string {
  const mapa: Record<string, string> = {
    LeadCreated: "Lead criado",
    LeadAssigned: "Responsável definido",
    OwnerChanged: "Responsável alterado",
    FirstContactMade: "Primeiro contato",
    StageChanged: "Mudança de etapa",
    QualificationStarted: "Qualificação iniciada",
    LeadQualified: "Lead qualificado",
    LeadNurtured: "Movido para nutrição",
    LeadDisqualified: "Lead desqualificado",
    LeadReactivated: "Lead retomado",
    OpportunityCreated: "Oportunidade criada",
    OpportunityCreatedFromProspecting: "Oportunidade criada no outbound",
    OpportunityStageChanged: "Etapa da oportunidade",
    OpportunityFamilyChanged: "Família alterada",
    OpportunityStalled: "Oportunidade estagnada",
    OpportunityLost: "Oportunidade perdida",
    OpportunityWon: "Oportunidade ganha",
    NextActionSet: "Próxima ação definida",
    MeetingScheduled: "Reunião agendada",
    MeetingRescheduled: "Reunião remarcada",
    MeetingNoShow: "No-show",
    TrialStarted: "Trial iniciado",
    TrialEnded: "Trial encerrado",
    ProposalCreated: "Proposta criada",
    ProposalSent: "Proposta enviada",
    ProposalViewed: "Proposta visualizada",
    ProposalAccepted: "Proposta aceita",
    ProposalRejected: "Proposta recusada",
    ProposalExpired: "Proposta expirada",
    ProposalSuperseded: "Proposta substituída",
    ProposalAdjustmentRequested: "Ajuste solicitado",
    ContractSigned: "Contrato assinado",
    PaymentConfirmed: "Pagamento confirmado",
    ProspectAdded: "Prospect adicionado",
    ProspectImported: "Prospect importado",
    ProspectAssigned: "Prospect atribuído",
    CadenceEnrolled: "Entrou em cadência",
    CadencePaused: "Cadência pausada",
    ProspectReplied: "Prospect respondeu",
    ProspectPreQualified: "Pré-qualificado",
    ProspectNoResponse: "Sem resposta",
    ProspectDiscarded: "Prospect descartado",
    CompanyCreated: "Empresa criada",
    PersonCreated: "Pessoa criada",
    PersonLinkedToCompany: "Pessoa vinculada à empresa",
  };
  return mapa[tipo] ?? tipo;
}

export function rotuloAtor(tipo: string): string {
  switch (tipo) {
    case "AI_AGENT": return "Agente IA";
    case "AUTOMATION": return "Automação";
    case "SYSTEM": return "Sistema";
    default: return "Equipe";
  }
}

/* ── Próxima ação ──────────────────────────────────────────────────────── */

/**
 * Criar a próxima ação.
 *
 * É a Task real, e é por isso que este diálogo existe: "sem próxima ação" era
 * o estado mais acionável do board e não tinha saída nenhuma na tela. O CTA no
 * cartão abre daqui já amarrado à aquisição.
 *
 * O prazo nasce preenchido para amanhã de manhã. Campo de data vazio em
 * criação rápida é o caminho mais curto para uma tarefa sem prazo, e tarefa
 * sem prazo não vira próxima ação de ninguém — ela cai para o fim da fila por
 * `NULLS LAST` e some.
 */
function DialogoTarefa({ aberto, contexto, responsaveis, usuarioId, pendente, bloqueio, aoFechar, aoConfirmar }: {
  aberto: boolean;
  contexto: { leadId: string; nome: string } | null;
  responsaveis: Array<{ id: string; nome: string }>;
  usuarioId: string | null;
  pendente: boolean;
  bloqueio: { mensagem: string } | null;
  aoFechar: () => void;
  aoConfirmar: (e: EntradaTarefa) => Promise<boolean>;
}) {
  function amanhaDeManha() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    // `toISOString` devolve UTC e o input espera hora local: o deslocamento
    // faria a tarefa nascer três horas fora do combinado.
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  /* Só assume o usuário da sessão se ele for de fato um responsável possível.
     Sem esta checagem o `select` mostrava "Sem responsável" (porque o id não
     está entre as opções) enquanto o estado carregava o id mesmo assim, e o
     INSERT morria em violação de chave estrangeira — a tela dizia uma coisa e
     mandava outra. */
  const padraoResponsavel = responsaveis.some((r) => r.id === usuarioId) ? usuarioId! : "";

  const [titulo, setTitulo] = useState("");
  const [responsavelId, setResponsavelId] = useState(padraoResponsavel);
  const [venceEm, setVenceEm] = useState(amanhaDeManha);
  const [prioridade, setPrioridade] = useState<"baixa" | "media" | "alta">("media");
  const [descricao, setDescricao] = useState("");

  // Reabrir para outro registro precisa de um formulário limpo.
  const [ultimo, setUltimo] = useState<string | null>(null);
  if (aberto && contexto && contexto.leadId !== ultimo) {
    setUltimo(contexto.leadId);
    setTitulo("");
    setDescricao("");
    setVenceEm(amanhaDeManha());
    setResponsavelId(padraoResponsavel);
  }

  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Nova tarefa"
      descricao={contexto ? `Próxima ação de ${contexto.nome}` : undefined}
    >
      <div className="ov-form">
        {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}

        <Field>
          <FieldLabel htmlFor="t-titulo">O que precisa ser feito</FieldLabel>
          <Input
            id="t-titulo"
            value={titulo}
            autoFocus
            placeholder="Ligar para apresentar a Callface"
            onChange={(e) => setTitulo(e.target.value)}
          />
        </Field>

        <div className="ov-form-linha">
          <Field>
            <FieldLabel htmlFor="t-responsavel">Responsável</FieldLabel>
            <NativeSelect
              id="t-responsavel"
              value={responsavelId}
              onChange={(e) => setResponsavelId(e.target.value)}
            >
              <NativeSelectOption value="">Sem responsável</NativeSelectOption>
              {responsaveis.map((r) => (
                <NativeSelectOption key={r.id} value={r.id}>{r.nome}</NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>

          <Field>
            <FieldLabel htmlFor="t-prazo">Prazo</FieldLabel>
            <Input
              id="t-prazo"
              type="datetime-local"
              value={venceEm}
              onChange={(e) => setVenceEm(e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="t-prioridade">Prioridade</FieldLabel>
            <NativeSelect
              id="t-prioridade"
              value={prioridade}
              onChange={(e) => setPrioridade(e.target.value as "baixa" | "media" | "alta")}
            >
              <NativeSelectOption value="baixa">Baixa</NativeSelectOption>
              <NativeSelectOption value="media">Média</NativeSelectOption>
              <NativeSelectOption value="alta">Alta</NativeSelectOption>
            </NativeSelect>
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="t-descricao">Detalhe</FieldLabel>
          <Textarea
            id="t-descricao"
            rows={3}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
        </Field>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={aoFechar}>Cancelar</Button>
          <Button
            type="button"
            loading={pendente}
            disabled={!titulo.trim() || !contexto}
            onClick={() => aoConfirmar({
              leadId: contexto!.leadId,
              titulo: titulo.trim(),
              responsavelId: responsavelId || null,
              venceEm: venceEm || null,
              prioridade,
              descricao: descricao.trim() || null,
            })}
          >
            <CalendarClock aria-hidden />Criar tarefa
          </Button>
        </DialogFooter>
      </div>
    </Dialogo>
  );
}

/* ── Ação em massa ─────────────────────────────────────────────────────── */

/**
 * Atribuir várias aquisições de uma vez.
 *
 * 223 aquisições sem dono é o maior buraco da operação, e resolver uma a uma
 * pelo painel são 223 aberturas de gaveta. O comando é o mesmo de sempre
 * (`atribuirResponsavel`), aplicado por registro: o resultado continua
 * auditável um a um, não vira um UPDATE em bloco sem rastro.
 */
function DialogoAtribuirEmMassa({ aberto, quantidade, responsaveis, pendente, bloqueio, aoFechar, aoConfirmar }: {
  aberto: boolean;
  quantidade: number;
  responsaveis: Array<{ id: string; nome: string }>;
  pendente: boolean;
  bloqueio: { mensagem: string } | null;
  aoFechar: () => void;
  aoConfirmar: (responsavelId: string | null) => Promise<boolean>;
}) {
  const [responsavelId, setResponsavelId] = useState("");

  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={`Atribuir ${quantidade} ${quantidade === 1 ? "aquisição" : "aquisições"}`}
      descricao="Cada registro recebe o responsável individualmente e gera o próprio evento na linha do tempo."
    >
      <div className="ov-form">
        {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}
        <Field>
          <FieldLabel htmlFor="m-responsavel">Responsável</FieldLabel>
          <NativeSelect
            id="m-responsavel"
            value={responsavelId}
            onChange={(e) => setResponsavelId(e.target.value)}
          >
            <NativeSelectOption value="">Escolha quem assume</NativeSelectOption>
            {responsaveis.map((r) => (
              <NativeSelectOption key={r.id} value={r.id}>{r.nome}</NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={aoFechar}>Cancelar</Button>
          <Button
            type="button"
            loading={pendente}
            disabled={!responsavelId}
            onClick={() => aoConfirmar(responsavelId)}
          >
            <Users aria-hidden />Atribuir
          </Button>
        </DialogFooter>
      </div>
    </Dialogo>
  );
}
