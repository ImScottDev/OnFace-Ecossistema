"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, Inbox, Search, SearchX, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
// Padrões do Design System usados por estas telas: coluna fechada do quadro,
// faixa de resumo e o botão-sinal de filtro. Eles moram no DS de propósito —
// as versões ad-hoc que viviam no `vendas.css` estavam quebradas na tela.
import "@/components/onface/ds/quadro.css";
import "@/components/onface/ds/datagrid.css";
import "./vendas.css";

/** Prefixo das rotas do módulo Vendas.
 *
 * A mesma tela atende três lugares: a rota OFICIAL do produto (`""`, ex.
 * `/pipeline`), o espelho congelado de desenho e o preview. O prefixo vem de
 * fora porque só a rota sabe onde está — um link fixo aqui faria a tela
 * oficial cuspir o usuário de volta no preview.
 *
 * `""` é o valor do produto e o padrão em toda prop nova: a rota oficial é o
 * caso normal desde 18/09, o resto é espelho. */
export type RotaBaseVendas = "" | "/onface-desenho" | "/onface-preview";

/* ── Blocos de layout ──────────────────────────────────────────────────── */

export function Hero({ titulo, descricao, resumo, acoes }: {
  titulo: string;
  descricao: string;
  resumo: Array<{ rotulo: string; valor: string | number; alerta?: boolean }>;
  acoes?: ReactNode;
}) {
  return (
    <div className="ov-hero">
      <div>
        <h1>{titulo}</h1>
        <p>{descricao}</p>
        {acoes ? <div className="ov-acoes" style={{ marginTop: "calc(14 * var(--onface-u))" }}>{acoes}</div> : null}
      </div>
      <div className="ov-resumo">
        {resumo.map((r) => (
          <div className="ov-resumo-item" key={r.rotulo} data-alerta={r.alerta ? "true" : undefined}>
            <strong>{r.valor}</strong>
            <span>{r.rotulo}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Busca do módulo, sobre o `InputGroup` do shadcn.
 *
 * Era um `<label class="ov-busca">` com `<input type="search">` dentro e o
 * ícone posicionado na unha. O `InputGroup` existe exatamente para isto:
 * campo com addon. A doc pede que o `InputGroupAddon` venha DEPOIS do input no
 * DOM e se posicione por `align`, para o foco funcionar — é por isso que a
 * ordem abaixo parece invertida em relação ao que se vê na tela.
 */
export function Busca({ valor, aoMudar, placeholder }: {
  valor: string; aoMudar: (v: string) => void; placeholder: string;
}) {
  return (
    <InputGroup className="min-w-[220px] flex-1">
      <InputGroupInput
        type="search"
        value={valor}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => aoMudar(e.target.value)}
      />
      <InputGroupAddon align="inline-start">
        <Search />
      </InputGroupAddon>
    </InputGroup>
  );
}

export function Abas<T extends string>({ abas, ativa, aoTrocar }: {
  abas: Array<{ chave: T; rotulo: string; contagem?: number }>;
  ativa: T;
  aoTrocar: (chave: T) => void;
}) {
  // `Tabs` do shadcn sem `TabsContent`: aqui a aba é um SELETOR, o conteúdo é
  // trocado pela tela. O componente continua entregando o que a versão à mão
  // não tinha completo — navegação por seta do teclado, `aria-controls` e o
  // indicador de ativo por `data-state` em vez de atributo próprio.
  return (
    <Tabs value={ativa} onValueChange={(v) => aoTrocar(v as T)}>
      <TabsList>
        {abas.map((aba) => (
          <TabsTrigger key={aba.chave} value={aba.chave}>
            {aba.rotulo}
            {typeof aba.contagem === "number" ? (
              <span className="tabular-nums opacity-60">{aba.contagem}</span>
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

/**
 * Etiqueta do módulo Vendas, agora sobre o `Badge` do shadcn.
 *
 * Era um `<span class="ov-tag">` com cinco tons em hex no `vendas.css`, e é
 * usada em 9 arquivos do módulo. O `Badge` da biblioteca já tinha a forma
 * (pílula, 12px, tipografia) e recebeu a semântica de status como VARIANTE
 * (`success`/`warning`/`danger`/`info`), que é onde ela pertence.
 *
 * Os hex somem junto: `#166534`, `#92400e`, `#1d4ed8` e companhia eram
 * calibrados só para fundo claro e não acompanhavam ilha escura. As variantes
 * lêem o par semântico por token, que o escopo `[data-cf2-superficie]`
 * reescreve dos dois lados.
 *
 * `tom` continua na assinatura porque são 9 arquivos chamando; o mapa traduz
 * para o vocabulário da biblioteca.
 */
const TOM_PARA_BADGE = {
  coral: "default",
  alerta: "warning",
  sucesso: "success",
  info: "info",
  "neutro-escuro": "secondary",
} as const;

export function Tag({ children, tom }: {
  children: ReactNode;
  tom?: "coral" | "alerta" | "sucesso" | "info" | "neutro-escuro";
}) {
  // Sem tom é etiqueta NEUTRA, que aqui quer dizer contorno e não
  // preenchimento: o `default` do shadcn é o coral da marca, e etiqueta de
  // origem ("Mídia Paga") não é sinal de marca.
  return (
    // `max-w-full` + `truncate`: o `Badge` do shadcn é `whitespace-nowrap` e
    // `overflow-hidden`, então etiqueta longa não quebra, ela ESTICA. O nome
    // de campanha real do Callface ("TRT | Lead | Aquisição White Label — II-
    // callface") passa da largura do cartão e vazava 86px em 3 cartões,
    // medido no navegador. Cortar é melhor que vazar: o nome inteiro fica no
    // `title` para quem precisar dele.
    <Badge
      variant={tom ? TOM_PARA_BADGE[tom] : "outline"}
      className="max-w-full truncate text-[10px] font-semibold"
      title={typeof children === "string" ? children : undefined}
    >
      {children}
    </Badge>
  );
}

/* ── Board ─────────────────────────────────────────────────────────────── */

export function Board({ children }: { children: ReactNode }) {
  return <div className="ov-board">{children}</div>;
}

export function Coluna({ titulo, total, carregados, extra, colapsada, children }: {
  titulo: string;
  total: number;
  carregados: number;
  extra?: ReactNode;
  /** Coluna fechada (Ganho, Perdido): fica na MESMA linha, em faixa estreita,
      e abre sob clique. Some da linha só quando o filtro a exclui. */
  colapsada?: boolean;
  children: ReactNode;
}) {
  const contagem = (
    // `ds-coluna-fechada-numeros` é do Design System: na faixa estreita ele
    // empilha os números. Sem essa classe a contagem fica horizontal dentro de
    // 52 unidades e vaza por cima da coluna vizinha.
    <span className="ov-coluna-contagem ds-coluna-fechada-numeros">
      {/* Quando a coluna tem mais do que a página carregou, a contagem diz
          as duas coisas: senão o número vira uma mentira discreta. */}
      <span>{carregados < total ? `${carregados} de ${total}` : total}</span>
      {extra}
    </span>
  );

  // `details` em vez de estado: o navegador já sabe abrir e fechar, e o teclado
  // e o leitor de tela vêm de graça.
  if (colapsada) {
    return (
      <details className="ov-coluna ds-coluna-fechada" data-colapsada aria-label={titulo}>
        <summary className="ov-coluna-cabecalho">
          <h2>{titulo}</h2>
          {contagem}
        </summary>
        <div className="ov-coluna-lista">{children}</div>
      </details>
    );
  }

  return (
    <section className="ov-coluna" aria-label={titulo}>
      <header className="ov-coluna-cabecalho">
        <h2>{titulo}</h2>
        {contagem}
      </header>
      <div className="ov-coluna-lista">{children}</div>
    </section>
  );
}

/**
 * Coluna sem cartões.
 *
 * P7 exige que o vazio ensine o próximo movimento, e a frase certa depende do
 * MOTIVO do vazio. São dois motivos diferentes com respostas opostas:
 *
 * - filtrado: existe trabalho, o recorte é que escondeu.
 * - natural: a etapa está livre, e não há nada a fazer nela.
 *
 * "Nenhuma empresa nesta etapa.", que era o texto único, não responde nenhum
 * dos dois. A saída do caso filtrado é o `LimparFiltros` da barra, não um
 * botão por coluna: ver ali embaixo o porquê.
 */
export function ColunaVazia({
  children,
  filtrado = false,
}: {
  children: ReactNode;
  filtrado?: boolean;
}) {
  // `Empty` do shadcn no lugar do `<div>` próprio. A composição é a que a doc
  // define (`Empty > EmptyHeader > EmptyMedia/EmptyTitle`), só que sem
  // `EmptyDescription`: a coluna tem uma frase, não duas, e descrição que
  // repete o título é o padrão que a direção proíbe.
  //
  // `border-none` e `p-4`: dentro de uma coluna de kanban o vazio é um
  // estado discreto, não um bloco de convite. O `Empty` padrão traz moldura
  // tracejada e `p-12`, que aqui empurraria a coluna inteira.
  return (
    <Empty className="border-none p-4" data-filtrado={filtrado || undefined}>
      <EmptyHeader className="gap-1">
        <EmptyMedia variant="icon" className="mb-0 size-8">
          {filtrado ? <SearchX /> : <Inbox />}
        </EmptyMedia>
        <EmptyTitle className="text-[12px] font-normal text-muted-foreground">
          {filtrado ? "Nada aqui com os filtros atuais." : children}
        </EmptyTitle>
      </EmptyHeader>
    </Empty>
  );
}

/**
 * Limpar filtros — um só, na barra de controle.
 *
 * Nasceu dentro da coluna vazia e apareceu quatro vezes na mesma tela, um por
 * etapa. Repetir a mesma saída em cada coluna não dá quatro saídas, dá ruído.
 * Na barra ele fica ao lado do que criou o estado e serve também quando a
 * busca DEVOLVE resultado — que é quando a pessoa mais precisa voltar.
 */
export function LimparFiltros({ ativo, aoLimpar }: { ativo: boolean; aoLimpar: () => void }) {
  if (!ativo) return null;
  return (
    <Button type="button" variant="ghost" size="sm" onClick={aoLimpar}>
      <X data-icon="inline-start" />
      Limpar filtros
    </Button>
  );
}


/* ── Checklist de fechamento ───────────────────────────────────────────── */

/** O que falta para esta venda fechar (v0.13, §02.4).
 *
 * Vive aqui, e não na tela, porque o drawer do board e a página de detalhe
 * mostram a MESMA coisa — duas cópias divergiriam, e uma delas acabaria
 * decidindo ganho por conta própria.
 *
 * NADA AQUI DECIDE GANHO. Estado e pendências vêm de `avaliarGanho`, no
 * domínio; esta função só desenha. */
export function ChecklistFechamento({ fechamento }: {
  fechamento: {
    regra: string; ofertaCodigo: string | null; ganha: boolean;
    falta: string[];
    itens: Array<{ codigo: string; rotulo: string; estado: string; detalhe: string }>;
  };
}) {
  return (
    <>
      <ul className="ov-checklist">
        {fechamento.itens.map((item) => (
          <li key={item.codigo} data-estado={item.estado}>
            <span className="ov-checklist-marca" aria-hidden>
              {item.estado === "ok" ? "✓" : item.estado === "nao_se_aplica" ? "—" : "○"}
            </span>
            <span className="ov-checklist-rotulo">{item.rotulo}</span>
            <span className="ov-checklist-detalhe">{item.detalhe}</span>
          </li>
        ))}
      </ul>
      <p className="ov-nota">
        {fechamento.regra}
        {fechamento.ofertaCodigo ? ` (${fechamento.ofertaCodigo}).` : "."}
        {!fechamento.ganha && fechamento.falta.length > 0
          ? ` Falta: ${fechamento.falta.join(", ")}.`
          : null}
      </p>
    </>
  );
}

/* ── Painel lateral ────────────────────────────────────────────────────── */

export function ComPainel({ aberto, painel, children }: {
  aberto: boolean; painel: ReactNode; children: ReactNode;
}) {
  return (
    <div className="ov-com-painel" data-aberto={aberto}>
      <div style={{ minWidth: 0 }}>{children}</div>
      {aberto ? painel : null}
    </div>
  );
}

export function Painel({ titulo, subtitulo, aoFechar, acoesTopo, children }: {
  titulo: string;
  subtitulo?: ReactNode;
  aoFechar: () => void;
  /** Espaço para o link "abrir em tela cheia", ao lado do fechar. */
  acoesTopo?: ReactNode;
  children: ReactNode;
}) {
  return (
    <aside className="ov-painel" aria-label={titulo}>
      <div className="ov-painel-topo">
        <div style={{ minWidth: 0 }}>
          <h2>{titulo}</h2>
          {subtitulo ? <p>{subtitulo}</p> : null}
        </div>
        <div className="ov-painel-topo-acoes">
          {acoesTopo}
          <Button type="button" variant="ghost" size="icon-sm" onClick={aoFechar} aria-label="Fechar painel">
            <X />
          </Button>
        </div>
      </div>
      {children}
    </aside>
  );
}

export function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="ov-secao">
      <h3>{titulo}</h3>
      {children}
    </section>
  );
}

export function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="ov-campo">
      <dt>{rotulo}</dt>
      <dd>{children ?? "—"}</dd>
    </div>
  );
}

/* ── Regra de negócio ──────────────────────────────────────────────────── */

export interface Bloqueio {
  mensagem: string;
  acao?: { rotulo: string; tipo: string };
}

/**
 * Bloqueio de regra de negócio.
 *
 * A spec pede sempre a mesma coisa quando um gate impede a ação: bloquear,
 * explicar o requisito e oferecer o CTA que destrava. Um `alert()` ou um toast
 * que some não cumpre a terceira parte.
 */
export function AvisoBloqueio({ bloqueio, aoAgir }: {
  bloqueio: Bloqueio; aoAgir?: (tipo: string) => void;
}) {
  // `Alert` do shadcn: o `role="alert"` vem do componente, e `variant="warning"`
  // e não `destructive` porque gate de regra não é consequência destrutiva, é
  // um requisito que falta. O CTA que destrava continua dentro do alerta, que
  // é a terceira parte que a spec exige e que um toast não cumpre.
  return (
    <Alert variant="warning">
      <AlertTriangle />
      <AlertDescription className="flex flex-col items-start gap-2">
        <span>{bloqueio.mensagem}</span>
        {bloqueio.acao && aoAgir ? (
          <Button type="button" size="sm" variant="outline" onClick={() => aoAgir(bloqueio.acao!.tipo)}>
            {bloqueio.acao.rotulo}
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

/* ── Diálogo ───────────────────────────────────────────────────────────── */

export function Dialogo({ aberto, aoFechar, titulo, descricao, largura, children }: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao?: string;
  largura?: "media" | "larga";
  children: ReactNode;
}) {
  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v) aoFechar(); }}>
      <DialogContent
        className="ov-dialogo"
        style={{
          maxWidth: largura === "larga" ? "calc(680 * var(--onface-u))" : "calc(480 * var(--onface-u))",
          // `flex-direction` explícito: o DialogHeader do shadcn é `flex-col`,
          // e sem isto o botão de fechar cai para baixo do título.
        }}
      >
        <DialogHeader style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: "calc(12 * var(--onface-u))", textAlign: "left" }}>
          <div style={{ minWidth: 0 }}>
            <DialogTitle style={{ fontFamily: "var(--font-onface-display), sans-serif", fontSize: "calc(16 * var(--onface-u))" }}>
              {titulo}
            </DialogTitle>
            {descricao ? (
              <DialogDescription style={{ fontSize: "calc(12 * var(--onface-u))", marginTop: "calc(4 * var(--onface-u))" }}>
                {descricao}
              </DialogDescription>
            ) : null}
          </div>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

/* ── Utilitários de formatação ─────────────────────────────────────────── */

// Reexportados de `formato.ts`: as telas importam tudo de `./ui`, mas as
// funções puras precisam continuar disponíveis para Server Components.
export { moeda, moedaExata, dataCurta, dataHora, decorrido } from "./formato";

/**
 * Estado de formulário com pendência e erro, que toda ação da tela precisa.
 *
 * Existe para que nenhum botão do módulo seja decorativo: enquanto a ação
 * corre, ele fica desabilitado; quando a regra de negócio recusa, a mensagem
 * aparece na própria superfície em vez de sumir num toast.
 */
/** Desfecho de uma execução. O sucesso é uma BANDEIRA, não a presença de dado.
 *
 * A versão anterior devolvia `dados ?? null` e nada mais, o que fazia sucesso
 * sem retorno e falha caírem no MESMO valor: `null`. Metade das ações do
 * módulo não devolve dado (mover etapa, perder, vincular, enviar proposta), e
 * os chamadores testavam `ok !== null` — então uma ação que deu certo era
 * tratada como recusada: o modal não fechava, a tela não recarregava e a
 * função reportava falso. O contrário também: quem lia o `null` como falha
 * podia engolir um erro real sem mostrar nada.
 *
 * Separar o "deu certo" do "veio dado junto" é o que impede as duas leituras
 * erradas. Achado em 19/09, investigando o bug da tag silenciosa. */
export type Desfecho<T> = { ok: true; dados: T | null } | { ok: false };

/** Mensagem para quando a falha não é regra de negócio, e sim o mundo caindo. */
export const FALHA_DE_COMUNICACAO = "Não foi possível falar com o CRM. A ação não foi aplicada.";

export function useAcao() {
  const [pendente, setPendente] = useState(false);
  const [bloqueio, setBloqueio] = useState<Bloqueio | null>(null);

  async function executar<T>(
    fn: () => Promise<{ ok: true; dados?: T } | { ok: false; erro: string; acao?: { rotulo: string; tipo: string } }>,
  ): Promise<Desfecho<T>> {
    setPendente(true);
    setBloqueio(null);
    try {
      const resultado = await fn();
      if (!resultado.ok) {
        setBloqueio({ mensagem: resultado.erro, acao: resultado.acao });
        return { ok: false };
      }
      return { ok: true, dados: (resultado.dados ?? null) as T | null };
    } catch {
      // Sem este catch, rede caída ou `fetch` que estoura escapava de todo o
      // fluxo: nenhum bloqueio era escrito, nenhuma mensagem aparecia, e a
      // tela só ficava parada. Silêncio é o pior desfecho possível — a pessoa
      // conclui que funcionou. Foi assim que a tag em massa "sumiu".
      setBloqueio({ mensagem: FALHA_DE_COMUNICACAO });
      return { ok: false };
    } finally {
      setPendente(false);
    }
  }

  return { pendente, bloqueio, limparBloqueio: () => setBloqueio(null), executar };
}

/** Fecha o painel com Escape sem precisar de foco aprisionado. */
export function useEscape(ativo: boolean, aoFechar: () => void) {
  useEffect(() => {
    if (!ativo) return;
    const ouvir = (e: KeyboardEvent) => { if (e.key === "Escape") aoFechar(); };
    window.addEventListener("keydown", ouvir);
    return () => window.removeEventListener("keydown", ouvir);
  }, [ativo, aoFechar]);
}
