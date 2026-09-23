"use client";

/**
 * A barra de trabalho de Pré-vendas: busca, views, filtros e chips.
 *
 * Tudo aqui é RECORTE do mesmo board — nenhuma destas peças troca de página.
 * É a diferença entre um workspace e um site com sete telas: o SDR trabalha
 * dezenas de registros por hora e não pode perder a posição a cada decisão.
 *
 * Por isso todo estado mora na URL: recarregar a página, mandar o link para o
 * colega e voltar do painel do lead precisam devolver exatamente o mesmo
 * recorte. Estado de recorte em `useState` seria perdido no primeiro F5.
 */

import { useEffect, useState } from "react";
import { Filter, Search, Upload, X } from "lucide-react";
// Do DOMÍNIO, não de `consultas`: este é um Client Component, e `consultas`
// importa o driver do Postgres. A lista de views é vocabulário e não tem
// dependência de banco nenhuma.
import { VIEWS_PRE_VENDAS, type ViewPreVendas } from "@/lib/vendas/dominio";
import { Button } from "@/components/ui/button";
import {
  InputGroup, InputGroupAddon, InputGroupInput,
} from "@/components/ui/input-group";
import {
  Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter,
  SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

/* ── Busca ─────────────────────────────────────────────────────────────── */

/**
 * Busca com debounce.
 *
 * O botão "Buscar" ao lado do campo saiu: exigir um segundo clique para ver o
 * resultado é ritmo de formulário, não de workspace. 400ms é o intervalo em
 * que a digitação de quem procura um nome termina sem que a espera apareça.
 *
 * O valor local existe porque o campo é controlado e a navegação é assíncrona:
 * sem ele, cada tecla esperaria o servidor e o cursor pularia.
 */
export function BuscaPreVendas({ valor, aoBuscar }: {
  valor: string;
  aoBuscar: (busca: string) => void;
}) {
  const [texto, setTexto] = useState(valor);

  // Recorte trocado por fora (view, chip removido) precisa repor o campo.
  useEffect(() => setTexto(valor), [valor]);

  useEffect(() => {
    if (texto === valor) return;
    const id = setTimeout(() => aoBuscar(texto), 400);
    return () => clearTimeout(id);
    // `aoBuscar` muda a cada render do pai; incluí-la reiniciaria o relógio a
    // cada letra e o debounce nunca dispararia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto, valor]);

  return (
    <InputGroup className="pv-barra-busca">
      <InputGroupInput
        type="search"
        value={texto}
        placeholder="Buscar empresa, pessoa, e-mail ou telefone"
        aria-label="Buscar em pré-vendas"
        onChange={(e) => setTexto(e.target.value)}
      />
      <InputGroupAddon align="inline-start">
        <Search />
      </InputGroupAddon>
    </InputGroup>
  );
}

/* ── Views rápidas ─────────────────────────────────────────────────────── */

/** Views que acusam problema: o número delas vira sinal quando não é zero. */
const VIEWS_DE_ALERTA: ViewPreVendas[] = ["atrasados", "sem-dono", "sem-proxima-acao"];

export function ViewsRapidas({ ativa, contadores, aoTrocar }: {
  ativa: ViewPreVendas;
  contadores: Record<ViewPreVendas, number>;
  aoTrocar: (view: ViewPreVendas) => void;
}) {
  return (
    // `tablist` seria mentira: não há painéis alternativos, há um board só
    // sendo recortado. Um grupo de botões com `aria-pressed` descreve o que
    // de fato acontece.
    <div className="pv-views" role="group" aria-label="Views rápidas">
      {VIEWS_PRE_VENDAS.map((v) => {
        const total = contadores[v.chave] ?? 0;
        const acusa = VIEWS_DE_ALERTA.includes(v.chave) && total > 0;
        return (
          <button
            key={v.chave}
            type="button"
            className="pv-view"
            data-ativa={v.chave === ativa ? "true" : undefined}
            data-sinal={acusa ? "true" : undefined}
            aria-pressed={v.chave === ativa}
            onClick={() => aoTrocar(v.chave)}
          >
            {v.rotulo}
            <span className="pv-view-conta">{total}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Chips de filtro ativo ─────────────────────────────────────────────── */

export type ChipFiltro = { chave: string; rotulo: string; valor: string };

/**
 * O que está filtrando agora, e como desfazer cada coisa.
 *
 * Sem isto o operador vê um board com 12 cartões e não sabe se a operação
 * encolheu ou se ele mesmo filtrou três telas atrás — e "sumiu tudo" vira
 * chamado de bug.
 */
export function ChipsDeFiltro({ chips, aoRemover, aoLimparTudo }: {
  chips: ChipFiltro[];
  aoRemover: (chave: string) => void;
  aoLimparTudo: () => void;
}) {
  if (chips.length === 0) return null;
  return (
    <div className="pv-chips">
      {chips.map((c) => (
        <span key={c.chave} className="pv-chip">
          <span>
            {c.rotulo}: <strong>{c.valor}</strong>
          </span>
          <button type="button" onClick={() => aoRemover(c.chave)} aria-label={`Remover filtro ${c.rotulo}`}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      {chips.length > 1 ? (
        <Button type="button" variant="ghost" size="sm" onClick={aoLimparTudo}>
          Limpar tudo
        </Button>
      ) : null}
    </div>
  );
}

/* ── Filtros ───────────────────────────────────────────────────────────── */

export interface ValoresDeFiltro {
  responsavelId: string | null;
  origem: string | null;
  campanha: string | null;
  desde: string | null;
}

/**
 * Filtros num `Sheet`, não num popover.
 *
 * São cinco campos e eles convivem: quem filtra por campanha normalmente
 * filtra por responsável junto. Popover fecha ao clicar fora e obriga a
 * reabrir a cada campo; a gaveta fica aberta enquanto a pessoa monta o
 * recorte, e só aplica quando ela decide.
 *
 * Aplicar é explícito, e isso é decisão: filtro que aplica a cada tecla
 * recarrega o board cinco vezes até a pessoa terminar de escolher.
 */
export function FiltrosPreVendas({ valores, opcoes, quantidade, aoAplicar }: {
  valores: ValoresDeFiltro;
  opcoes: {
    responsaveis: Array<{ id: string; nome: string }>;
    origens: string[];
    campanhas: string[];
  };
  /** Quantos filtros estão ativos — vai no selo do botão. */
  quantidade: number;
  aoAplicar: (v: ValoresDeFiltro) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState(valores);

  // Abrir a gaveta precisa mostrar o que está valendo, não o rascunho de
  // ontem que ficou no estado.
  useEffect(() => { if (aberto) setForm(valores); }, [aberto, valores]);

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger asChild>
        <Button type="button" variant="outline">
          <Filter data-icon="inline-start" />
          Filtros
          {quantidade > 0 ? (
            <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px] tabular-nums">
              {quantidade}
            </Badge>
          ) : null}
        </Button>
      </SheetTrigger>

      <SheetContent className="flex flex-col gap-0">
        <SheetHeader>
          <SheetTitle>Filtrar pré-vendas</SheetTitle>
          <SheetDescription>
            O recorte vale para o board inteiro e sobrevive ao recarregar a página.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <Field>
            <FieldLabel htmlFor="f-responsavel">Responsável</FieldLabel>
            <NativeSelect
              id="f-responsavel"
              value={form.responsavelId ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, responsavelId: e.target.value || null }))}
            >
              <NativeSelectOption value="">Todos</NativeSelectOption>
              {opcoes.responsaveis.map((r) => (
                <NativeSelectOption key={r.id} value={r.id}>{r.nome}</NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>

          <Field>
            <FieldLabel htmlFor="f-origem">Origem</FieldLabel>
            <NativeSelect
              id="f-origem"
              value={form.origem ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, origem: e.target.value || null }))}
            >
              <NativeSelectOption value="">Todas</NativeSelectOption>
              {opcoes.origens.map((o) => (
                <NativeSelectOption key={o} value={o}>{o}</NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>

          <Field>
            <FieldLabel htmlFor="f-campanha">Campanha</FieldLabel>
            <NativeSelect
              id="f-campanha"
              value={form.campanha ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, campanha: e.target.value || null }))}
            >
              <NativeSelectOption value="">Todas</NativeSelectOption>
              {opcoes.campanhas.map((c) => (
                <NativeSelectOption key={c} value={c}>{c}</NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>

          <Field>
            <FieldLabel htmlFor="f-desde">Criado a partir de</FieldLabel>
            <Input
              id="f-desde"
              type="date"
              value={form.desde ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, desde: e.target.value || null }))}
            />
          </Field>
        </div>

        <SheetFooter className="flex-row justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              const vazio = { responsavelId: null, origem: null, campanha: null, desde: null };
              setForm(vazio);
              aoAplicar(vazio);
              setAberto(false);
            }}
          >
            Limpar
          </Button>
          <div className="flex gap-2">
            <SheetClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </SheetClose>
            <Button type="button" onClick={() => { aoAplicar(form); setAberto(false); }}>
              Aplicar
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/* ── Exportação ────────────────────────────────────────────────────────── */

/**
 * Exportar respeita o recorte da tela, e o rótulo diz isso.
 *
 * "Exportar" sozinho é ambíguo num board filtrado — a pessoa não sabe se leva
 * os 12 que vê ou os 3.989 que existem. O botão declara o número.
 */
export function ExportarPreVendas({ quantidade, aoExportar, ocupado }: {
  quantidade: number;
  aoExportar: () => void;
  ocupado: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className="pv-acao-opcional"
      loading={ocupado}
      onClick={aoExportar}
      title={`Exporta os ${quantidade} registros do recorte atual em CSV`}
    >
      <Upload data-icon="inline-start" />
      Exportar
    </Button>
  );
}
