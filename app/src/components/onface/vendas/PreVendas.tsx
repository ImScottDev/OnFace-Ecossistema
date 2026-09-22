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
  ArrowRight, Building2, CalendarClock, CheckCircle2, Mail, MessageCircle, Plus, Sparkles, UserPlus,
} from "lucide-react";
import type { BoardPreVendas, CardPreVendas, DetalheLead } from "@/lib/vendas/consultas";
import type { LinhaDoTempo } from "@/lib/vendas/eventos";
import {
  FAMILIAS, MOTIVOS_DESQUALIFICACAO, MOTIVOS_NUTRICAO, ROTULO_FAMILIA,
  type Familia, type MotivoDesqualificacao, type MotivoNutricao, type Qualificacao,
} from "@/lib/vendas/dominio";
import type { Resultado } from "@/lib/vendas/resultado";
import {
  Abas, AvisoBloqueio, Board, Busca, Campo, Coluna, ColunaVazia, ComPainel, LimparFiltros,
  Dialogo, Painel, Secao, Tag, dataCurta, dataHora, decorrido, useAcao,
  type RotaBaseVendas,
} from "./ui";
import { AcoesContato } from "./pagina";
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
}

export function PreVendas({ dados, aba, filtro, acoes, rotaBase = "" }: {
  dados: BoardPreVendas;
  /** Só para link antigo salvo; o board padrão é o único, sem aba. */
  aba?: Aba;
  filtro: { busca: string; responsavelId: string | null };
  acoes: AcoesPreVendas;
  /** Prefixo das rotas irmãs do módulo. Vazio = rota oficial do produto. */
  rotaBase?: RotaBaseVendas;
}) {
  const router = useRouter();
  const [, iniciarNavegacao] = useTransition();
  const [busca, setBusca] = useState(filtro.busca);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<{ lead: DetalheLead | null; timeline: LinhaDoTempo[] } | null>(null);
  const [modal, setModal] = useState<null | "qualificar" | "nutrir" | "desqualificar" | "oportunidade" | "novo" | "empresa">(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const { pendente, bloqueio, limparBloqueio, executar } = useAcao();

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

  function aoMudarQuadro(proximos: CardPreVendas[]) {
    const etapaAntes = new Map(cards.map((c) => [c.leadId, c.etapa]));
    setCards(proximos);
    const movido = proximos.find((c) => etapaAntes.get(c.leadId) !== c.etapa);
    // Sem mudança de etapa foi só reordenação dentro da coluna: ordem de
    // cartão não é fato de negócio e não vira escrita.
    if (!movido) return;
    void rodar(
      () => acoes.moverEtapa(movido.leadId, movido.etapa as "novo" | "em_contato" | "qualificacao"),
      false,
      `${movido.empresa} movido.`,
    );
  }

  async function rodar(fn: () => Promise<Resultado<unknown>>, fecharModal = true, mensagem = "Alteração salva.") {
    // O desfecho vem do próprio `executar` desde 19/09: antes a confirmação
    // era capturada numa variável por efeito colateral dentro do callback,
    // porque o retorno não distinguia sucesso sem dado de falha.
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

  return (
    <>
      <div className="ov-controles">
        {/* KANBAN ÚNICO (v0.13, Módulo 01 §2). As abas Ativos/Nutrição/
            Desqualificados saíram: as sete situações vivem no mesmo board, e
            Nutrição e Desqualificado são colunas como as outras.

            O que era navegação virou informação — o resumo continua dizendo
            quantos há em cada situação, sem esconder nenhuma. */}
        <div className="ds-resumo-faixa" aria-label="Resumo da operação">
          <span><strong>{dados.resumo.ativos}</strong> ativos</span>
          <span><strong>{dados.resumo.nutricao}</strong> em nutrição</span>
          <span><strong>{dados.resumo.desqualificados}</strong> desqualificados</span>
        </div>
        <LimparFiltros
          ativo={Boolean(filtro.busca || filtro.responsavelId)}
          aoLimpar={() => { setBusca(""); navegar({ busca: null, responsavel: null }); }}
        />
        <Busca
          valor={busca}
          aoMudar={setBusca}
          placeholder="Buscar empresa, pessoa ou e-mail"
        />
        <Button type="button" variant="outline" onClick={() => navegar({ busca })}>
          Buscar
        </Button>
        {/* `NativeSelect` e não o `Select` do Radix: a doc do shadcn traz os
            dois, e o nativo é o certo para FILTRO com lista aberta — mantém
            teclado, busca por digitação e o seletor do sistema no celular. O
            Radix entra quando o item precisa de render próprio (ícone, avatar,
            duas linhas), que não é o caso de uma lista de nomes. */}
        <NativeSelect
          className="w-[190px]"
          value={filtro.responsavelId ?? ""}
          onChange={(e) => navegar({ responsavel: e.target.value || null })}
          aria-label="Filtrar por responsável"
        >
          <NativeSelectOption value="">Todos os responsáveis</NativeSelectOption>
          {dados.filtros.responsaveis.map((r) => (
            <NativeSelectOption key={r.id} value={r.id}>{r.nome}</NativeSelectOption>
          ))}
        </NativeSelect>
        <Button type="button" onClick={() => { limparBloqueio(); setModal("novo"); }}>
          <Plus data-icon="inline-start" />Novo lead
        </Button>
      </div>

      {bloqueio && !modal ? (
        <div style={{ marginBottom: "calc(14 * var(--onface-u))" }}>
          <AvisoBloqueio bloqueio={bloqueio} />
        </div>
      ) : null}
      {sucesso ? <p className="ov-nota" role="status">{sucesso}</p> : null}

      <ComPainel
        aberto={Boolean(selecionado)}
        painel={
          <PainelLead
            rotaBase={rotaBase}
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
          itens={cards}
          colunas={dados.colunas.map((c) => ({ chave: c.chave, rotulo: c.rotulo, total: c.total }))}
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
            <ColunaVazia filtrado={Boolean(filtro.busca || filtro.responsavelId)}>
              Nenhuma empresa nesta etapa.
            </ColunaVazia>
          )}
          renderCartao={(card) => (
            <CardLead card={card} selecionado={card.leadId === selecionado} />
          )}
          aoAbrir={(card) => void abrir(card.leadId)}
          aoMudar={aoMudarQuadro}
        />
      </ComPainel>

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
        aoFechar={() => setModal(null)}
        aoConfirmar={(motivo, retomarEm, obs) => rodar(() => acoes.nutrir(lead!.id, motivo, retomarEm, obs))}
      />

      <DialogoDesqualificar
        aberto={modal === "desqualificar"}
        pendente={pendente}
        bloqueio={bloqueio}
        aoFechar={() => setModal(null)}
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
    </>
  );
}

/* ── Card ──────────────────────────────────────────────────────────────── */

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

/**
 * Cartão de lead, sobre o `Item` do shadcn.
 *
 * Era um `<button class="ov-card">` com quatro `<span>` e estilo inline no
 * rodapé, repetido 1.005 vezes na tela. O `Item` existe para exatamente esta
 * forma, e a doc é explícita sobre quando usá-lo: "se você só precisa exibir
 * conteúdo como título, descrição e ações, use `Item`" (`Field` é para
 * entrada de formulário, que não é o caso aqui).
 *
 * A composição segue a da doc: `Item > ItemContent > ItemTitle/ItemDescription`
 * mais `ItemFooter` para a linha de baixo. O cartão inteiro continua clicável,
 * agora por `asChild` sobre um `<button>`, que é como a doc monta item
 * acionável sem aninhar botão dentro de botão.
 *
 * Duas coisas que a versão à mão não tinha e vêm da biblioteca: anel de foco
 * visível pelo teclado e o alvo de clique tratado pelo componente.
 *
 * Os ícones de canal ganharam `Tooltip`. Antes eram `aria-label` puro: quem
 * enxerga via o ícone e não tinha como saber o que ele significa sem leitor de
 * tela.
 */
function CardLead({ card, selecionado }: {
  card: CardPreVendas; selecionado: boolean;
}) {
  const etiquetas = (
    <>
      {card.origem ? <Tag>{card.origem}</Tag> : null}
      {card.campanha ? <Tag>{card.campanha}</Tag> : null}
      {card.servicos?.slice(0, 1).map((s) => <Tag key={s} tom="info">{s}</Tag>)}
      {/* O fato Qualificado acompanha o card mesmo fora da coluna
          Qualificado — é o ponto da spec: ele sobrevive à etapa. */}
      {card.qualificado && card.etapa !== "qualificado" ? <Tag tom="sucesso">Qualificado</Tag> : null}
      {card.preQualificado ? <Tag tom="neutro-escuro">Pré-qualificado</Tag> : null}
      {card.nutricaoRetomarEm ? <Tag tom="alerta">Retomar {dataCurta(card.nutricaoRetomarEm)}</Tag> : null}
      {card.desqualificacaoMotivo ? <Tag tom="neutro-escuro">{card.desqualificacaoMotivo}</Tag> : null}
    </>
  );

  return (
    <Item
      variant="outline"
      size="sm"
      /* `ov-card` saiu do cartão.
       *
       * Ele trazia display, direção, padding, raio, borda e sombra próprios, e
       * brigava com o `variant="outline"` do `Item`: o rodapé ficava 30px para
       * fora do cartão porque o `basis-full` do `ItemFooter` não vira largura
       * cheia dentro de uma coluna que a CSS de fora já tinha montado. Duas
       * definições da mesma superfície é o que a biblioteca existe para
       * impedir.
       *
       * A seleção, que era `box-shadow` no `vendas.css`, vira anel por
       * `data-selecionado` aqui. Pipeline ainda usa `ov-card` e por isso a
       * regra continua no CSS: ela sai quando Pipeline for a vez.
       *
       * E NÃO se força `flex-col` aqui. O `Item` é uma LINHA que quebra
       * (`flex flex-wrap`), e o `basis-full` do `ItemFooter` é justamente o
       * que faz o rodapé pular para a própria linha. Forçando coluna, o
       * `flex-wrap` passa a criar uma segunda COLUNA à direita para o que não
       * cabe, e foi assim que 201 de 201 cartões vazaram 162px. A composição
       * certa é a da doc: conteúdo ocupa a linha, e quem precisa de linha
       * própria pede `basis-full`. */
      className="w-full gap-2 px-3 py-2.5 text-left data-[selecionado]:ring-2 data-[selecionado]:ring-[var(--onface-coral)]"
      data-selecionado={selecionado || undefined}
    >
      <ItemContent className="basis-full gap-0.5">
          <ItemTitle className="font-[family-name:var(--font-onface-display)] text-[13.5px] leading-tight font-bold [overflow-wrap:anywhere]">{card.empresa}</ItemTitle>
          <ItemDescription className="text-[11.5px] leading-snug [overflow-wrap:anywhere]">
            {card.pessoa
              ? `${card.pessoa}${card.cargo ? ` · ${card.cargo}` : ""}`
              : "Sem contato associado"}
          </ItemDescription>
        </ItemContent>

        {/* As etiquetas ficam numa linha própria e não em `ItemActions`:
            `ItemActions` é para AÇÃO, e etiqueta é estado. `basis-full` é o
            mesmo mecanismo que o `ItemFooter` usa para ganhar a linha. */}
        <div className="flex min-w-0 basis-full flex-wrap items-center gap-1 empty:hidden">{etiquetas}</div>

        <ItemFooter className="gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            {card.responsavelIniciais ? (
              <Avatar className="size-5">
                <AvatarFallback className="text-[9px] font-semibold">
                  {card.responsavelIniciais}
                </AvatarFallback>
              </Avatar>
            ) : (
              /* Coral de TEXTO: a marca pura dá 3,30:1 sobre papel. */
              <span className="text-[var(--onface-coral-texto)]">Sem responsável</span>
            )}
            {card.responsavel ? <span className="truncate">{card.responsavel.split(" ")[0]}</span> : null}
          </span>

          <span className="inline-flex shrink-0 items-center gap-2">
            {card.temWhatsapp ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <MessageCircle className="size-3" aria-label="Tem WhatsApp" />
                </TooltipTrigger>
                <TooltipContent>Tem WhatsApp</TooltipContent>
              </Tooltip>
            ) : null}
            {card.temEmail ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Mail className="size-3" aria-label="Tem e-mail" />
                </TooltipTrigger>
                <TooltipContent>Tem e-mail</TooltipContent>
              </Tooltip>
            ) : null}
            <span className="tabular-nums">{decorrido(card.horasSemInteracao)}</span>
          </span>
      </ItemFooter>
    </Item>
  );
}

/* ── Painel ────────────────────────────────────────────────────────────── */

function PainelLead({ lead, timeline, pendente, bloqueio, responsaveis, aoFechar, aoAgir, acoes, rotaBase }: {
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
    abrirModal: (m: "qualificar" | "nutrir" | "desqualificar" | "oportunidade") => void;
  };
  rotaBase: RotaBaseVendas;
}) {
  if (!lead) {
    return <Painel titulo="Carregando" aoFechar={aoFechar}><p className="ov-nota">Buscando o lead…</p></Painel>;
  }

  const q = (lead.qualificacao ?? {}) as Record<string, string | undefined>;
  const encerrado = lead.etapa === "nutricao" || lead.etapa === "desqualificado";

  return (
    <Painel titulo={lead.empresa.nome} subtitulo={`${lead.pessoa.nome}${lead.pessoa.cargo ? ` · ${lead.pessoa.cargo}` : ""}`} aoFechar={aoFechar}>
      <div className="ov-card-meta">
        <Tag tom="coral">{lead.etapaRotulo}</Tag>
        {lead.qualificado ? <Tag tom="sucesso">Qualificado {dataCurta(lead.qualificadoEm)}</Tag> : null}
        {lead.preQualificado ? <Tag tom="neutro-escuro">Pré-qualificado</Tag> : null}
      </div>

      {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} aoAgir={aoAgir} /> : null}

      <Secao titulo="Ações">
        <div className="ov-acoes">
          {!encerrado ? (
            <>
              {lead.etapa === "novo" ? (
                <button type="button" className="ov-botao" disabled={pendente} onClick={() => acoes.contato("whatsapp")}>
                  <MessageCircle aria-hidden />Registrar 1º contato
                </button>
              ) : null}
              {lead.etapa === "em_contato" ? (
                <button type="button" className="ov-botao" disabled={pendente} onClick={() => acoes.mover("qualificacao")}>
                  <Sparkles aria-hidden />Iniciar qualificação
                </button>
              ) : null}
              {(lead.etapa === "qualificacao" || lead.etapa === "em_contato") ? (
                <button type="button" className="ov-botao" data-variante="contorno" disabled={pendente} onClick={() => acoes.abrirModal("qualificar")}>
                  <CheckCircle2 aria-hidden />Qualificar
                </button>
              ) : null}
              {lead.etapa === "qualificado" ? (
                <button type="button" className="ov-botao" disabled={pendente} onClick={() => acoes.abrirModal("oportunidade")}>
                  <ArrowRight aria-hidden />Criar oportunidade
                </button>
              ) : null}
              <button type="button" className="ov-botao" data-variante="neutro" disabled={pendente} onClick={() => acoes.abrirModal("nutrir")}>
                Nutrir
              </button>
              <button type="button" className="ov-botao" data-variante="perigo" disabled={pendente} onClick={() => acoes.abrirModal("desqualificar")}>
                Desqualificar
              </button>
            </>
          ) : (
            <button type="button" className="ov-botao" disabled={pendente} onClick={() => acoes.reativar()}>
              Retomar lead
            </button>
          )}
        </div>
      </Secao>

      <Secao titulo="Contato">
        <AcoesContato alvo={{
          leadId: lead.id,
          whatsapp: lead.pessoa.whatsapp,
          telefone: lead.pessoa.telefone,
          email: lead.pessoa.email,
        }} />
      </Secao>

      <Secao titulo="Empresa">
        <dl style={{ margin: 0 }}>
          <Campo rotulo="Segmento">{lead.empresa.setor}</Campo>
          <Campo rotulo="Porte">{lead.empresa.porte}</Campo>
          <Campo rotulo="Cidade">{lead.empresa.cidade}</Campo>
          <Campo rotulo="CNPJ">{lead.empresa.cnpj}</Campo>
        </dl>
        {lead.empresa.id ? (
          <Link className="ov-botao" data-variante="contorno" href={`${rotaBase}/contatos?empresa=${lead.empresa.id}`}>
            <Building2 aria-hidden />Abrir empresa
          </Link>
        ) : (
          <button type="button" className="ov-botao" data-variante="contorno" onClick={() => aoAgir("associar_empresa")}>
            <Building2 aria-hidden />Associar empresa
          </button>
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

      <Secao titulo="Atribuição">
        <dl style={{ margin: 0 }}>
          <Campo rotulo="Origem">{lead.atribuicao.origem}</Campo>
          <Campo rotulo="Campanha">{lead.atribuicao.campanha}</Campo>
          <Campo rotulo="Primeiro toque">{lead.atribuicao.primeiroToque}</Campo>
          <Campo rotulo="Último toque">{lead.atribuicao.ultimoToque}</Campo>
          <Campo rotulo="Landing page">{lead.atribuicao.landingPage}</Campo>
        </dl>
      </Secao>

      <Secao titulo="Responsável">
        <select
          className="ov-select"
          value={lead.responsavel.id ?? ""}
          disabled={pendente}
          onChange={(e) => acoes.atribuir(e.target.value || null)}
          aria-label="Responsável pelo lead"
        >
          <option value="">Sem responsável</option>
          {responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
        </select>
      </Secao>

      {lead.oportunidades.length > 0 ? (
        <Secao titulo="Oportunidades">
          {lead.oportunidades.map((o) => (
            <Link key={o.id} className="ov-botao" data-variante="contorno" href={`${rotaBase}/pipeline?oportunidade=${o.id}`}>
              {o.titulo} · {o.etapaRotulo}
            </Link>
          ))}
        </Secao>
      ) : null}

      {lead.proximaAcao ? (
        <Secao titulo="Próxima ação">
          <p className="ov-nota">
            <CalendarClock aria-hidden style={{ width: "calc(12 * var(--onface-u))", height: "calc(12 * var(--onface-u))", verticalAlign: "-2px" }} />
            {" "}{lead.proximaAcao.titulo} · {dataCurta(lead.proximaAcao.venceEm)}
          </p>
        </Secao>
      ) : null}

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
