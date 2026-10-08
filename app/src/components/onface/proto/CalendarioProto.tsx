"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Calendário — o adaptador.
 *
 * `CalendarioDesenho` é o markup convertido do handoff e `CalendarioLiga` a
 * lógica dele, portada. Os dois são GERADOS; este arquivo é o único escrito à
 * mão, e é aqui que a tabela `reunioes` vira o `window.OnFaceAgenda` que o
 * protótipo lia.
 *
 * O que a Liga consome NÃO é `props.dados`: é `props.catalogo.Agenda`, um
 * objeto com `itens()`, `situacao()`, `salvar()`, `iso()` e `hm()` — o mesmo
 * contrato do `dados.js` do protótipo. Recriar esse contrato é todo o trabalho.
 * ───────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { ReuniaoDaAgenda, TarefaDaAgenda } from "@/lib/calendario/agenda-do-calendario";
import { CalendarioLiga } from "./CalendarioLiga";
import { levarParametros } from "./rota-do-desenho";
import { usePecas } from "./pecas-host";
import { alterarTarefa, prazoDoBanco, prioridadeDoBanco, situacaoDoBanco, tipoDoBanco } from "./atividade-tarefa";

const pad = (n: number) => String(n).padStart(2, "0");

/* Cópia literal das duas funções do `dados.js`. `hm` só devolve hora quando a
   data carrega o marcador `_h` — é ele que separa "tem horário" de "dia todo". */
const iso = (d: Date | null) => (d ? d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) : "");
const hm = (d: any) => (d && d._h ? pad(d.getHours()) + ":" + pad(d.getMinutes()) : "");

/**
 * Status do banco → situação do desenho.
 *
 * O desenho só conhece "A fazer / Feita / Declinada" para isso. Cancelada e
 * no-show caem os dois em "Declinada" (riscado, como no protótipo); o rótulo
 * do popover é reescrito em `renderVals` para não ficarem indistinguíveis.
 */
const SITUACAO: Record<string, string> = {
  agendada: "A fazer",
  realizada: "Feita",
  cancelada: "Declinada",
  no_show: "Declinada",
};
const ROTULO_STATUS: Record<string, string> = {
  agendada: "A fazer",
  realizada: "Feito",
  cancelada: "Cancelada",
  no_show: "Não compareceu",
};

/** Uma reunião no formato de item que `itens()` do protótipo devolvia. */
function paraItem(r: ReuniaoDaAgenda) {
  const ini: any = new Date(r.data);
  ini._h = true; // toda reunião tem hora; sem o marcador ela vira "Dia todo"
  // Duração nula → 30 min, o mesmo default do protótipo (`RE.duracao || 30`).
  const fim: any = new Date(ini.getTime() + (r.duracao || 30) * 6e4);
  fim._h = true;
  return {
    key: "p:" + r.id,
    /* `src: "p"` + `id` é obrigatório: é o que faz `refReu` (Liga) devolver
       referência e todo clique virar `abrir("reuniao", {src, id})` — navegação
       real — em vez de abrir a gaveta de ATIVIDADE, que editaria título,
       prioridade, subtarefas e comentários que `reunioes` não tem. */
    src: "p",
    id: r.id,
    tipo: "Reunião",
    titulo: r.titulo,
    ini, fim, quando: ini, temHora: true,
    situacao: SITUACAO[r.status ?? "agendada"] ?? "A fazer",
    statusReal: r.status ?? "agendada",
    resp: r.responsavel,
    assignees: r.responsavel ? [r.responsavel] : [],
    empresa: r.empresa ?? "",
    pessoa: r.pessoa ?? "",
    oppId: r.negocioId,
    oppRot: r.negocioTitulo ?? "",
    desc: r.notas ?? "",
    /* Sem fonte em `reunioes`: não há subtarefa, comentário, prioridade nem
       área de reunião. Só a gaveta de atividade lê esses campos, e ela fica
       inalcançável (ver `src` acima e `det.abrir` abaixo). Vazio, não mock. */
    sub: [], comentarios: [], prioridade: null, area: null,
  };
}

/**
 * Uma atividade (`tarefas`) no formato de item. É a MESMA tabela da tela de
 * Atividades: `src: "t"` impede que a Liga a trate como reunião, e o clique abre
 * a peça canônica de atividade (ver `setState` em `CalendarioLigada`).
 */
function paraItemDeTarefa(t: TarefaDaAgenda) {
  const { fimD, fimH } = prazoDoBanco(t.venceEm, t.dataVencimento);
  const [a, m, d] = fimD.split("-").map(Number);
  const quando: any = new Date(a, m - 1, d);
  if (fimH) { const [h, mi] = fimH.split(":").map(Number); quando.setHours(h, mi); quando._h = true; } else quando.setHours(23, 59);
  const tipo = tipoDoBanco(t.tipo);
  return {
    key: "t:" + t.id, src: "t", id: t.id,
    // "Reunião" aqui é tarefa de agendar/confirmar reunião, não a reunião em si.
    tipo: tipo === "Reunião" ? "Tarefa" : tipo,
    titulo: t.titulo, quando, temHora: !!fimH,
    situacao: situacaoDoBanco(t.status), statusReal: t.status,
    resp: t.responsavel, assignees: t.responsavel ? [t.responsavel] : [],
    empresa: t.empresa ?? "", pessoa: t.pessoa ?? "", oppId: null, oppRot: "",
    desc: t.descricao ?? "", sub: [], comentarios: [], prioridade: prioridadeDoBanco(t.prioridade), area: null,
  };
}

/**
 * A Liga com três ajustes, todos por subclasse — o arquivo gerado não se edita.
 */
class CalendarioLigada extends CalendarioLiga {
  constructor(props: any) {
    super(props);
    // Sem isto o `irPara` da Liga perde o id do registro e cai em rota do protótipo (404).
    levarParametros(this as any);
    /* SSR: o protótipo lê `?visao=` no componentDidMount, que o servidor não
       roda — a tela nasceria em Mês e pularia para Semana. A página lê o
       searchParam e entrega aqui. `larg` fixo em 1400 pelo mesmo motivo: o
       class-field lê `window.innerWidth` e divergiria entre servidor e cliente
       (aviso de hidratação no `railStyle`); o valor real entra no didMount. */
    (this as any).state = { ...(this as any).state, visao: props.visaoInicial ?? "mes", larg: 1400 };
  }

  /* `E.avisar` chama `this.diz`, que a Liga gerada não define: o "Concluir"
     do popover disparava o PATCH e morria em TypeError antes de fechar. */
  diz(texto: string, tom?: string) {
    if (tom === "erro") toast.error(texto); else toast.success(texto);
  }

  componentDidMount() {
    super.componentDidMount();
    (this as any).setState({ larg: window.innerWidth });
  }

  /* A gaveta própria de atividade desta Liga é um segundo formulário: toda
     atividade (`t:`) abre a peça canônica, a mesma de Atividades e das fichas. */
  setState(p: any, cb?: any) {
    const chave = p && typeof p === "object" ? p.atv : null;
    if (typeof chave === "string" && chave.startsWith("t:")) {
      (this as any).props.abrir?.("verAtividade", chave.slice(2));
      const { atv: _, ...resto } = p;
      return (super.setState as any)({ ...resto, atv: null }, cb);
    }
    return (super.setState as any)(p, cb);
  }

  renderVals() {
    /* `tf.pos` (popover de Tipos) lê `window.innerWidth` incondicionalmente —
       no servidor isso é ReferenceError e a rota cai. O shim vive só durante
       esta chamada síncrona e some no finally; nada mais roda no meio. */
    let shim = false;
    if (typeof window === "undefined") {
      (globalThis as any).window = { innerWidth: 1400, innerHeight: 900 };
      shim = true;
    }
    let vals: any;
    try {
      vals = super.renderVals();
    } finally {
      if (shim) delete (globalThis as any).window;
    }

    const det = vals.det;
    const S = (this as any).state;
    if (det?.ehItem && S.det?.key) {
      const X = (this as any).props.catalogo.Agenda.itens().find((x: any) => x.key === S.det.key);
      if (X) {
        // Cancelada ≠ não compareceu: o desenho juntaria as duas em "Declinada".
        det.sit = ROTULO_STATUS[X.statusReal] ?? det.sit;
        /* Cancelada não reabre (ver `situacao` no adaptador): esconder o botão
           evita o toast "Reaberta" da Liga seguido do erro do adaptador. */
        if (X.statusReal === "cancelada") det.podeConcluir = false;
        /* "Abrir detalhes" abria a gaveta de atividade (setState({atv})). Para
           reunião, o detalhe é o negócio — o mesmo destino do clique no chip. */
        det.abrir = () => {
          (this as any).setState({ det: null });
          (this as any).props.abrir?.("reuniao", { src: "p", id: X.id });
        };
      }
    }
    /* "Nova atividade" do dia: o modal canônico, com a data do dia aberto. Antes
       navegava para /tarefas e o parâmetro `data` se perdia pelo caminho. */
    vals.novaAtv = () => {
      const d: string = S.dia || iso(new Date());
      (this as any).props.abrir?.("novaAtividade", { data: d });
    };
    return vals;
  }
}

/* ── A tela ────────────────────────────────────────────────────────────── */

export function CalendarioProto({ reunioes, tarefas = [], equipe, visaoInicial, diaInicial }: {
  reunioes: ReuniaoDaAgenda[];
  /** Atividades do usuário com prazo: a mesma tabela da tela de Atividades. */
  tarefas?: TarefaDaAgenda[];
  /** Nomes reais dos responsáveis — substitui o fallback fictício da Liga. */
  equipe: string[];
  visaoInicial?: "mes" | "semana";
  diaInicial?: string | null;
}) {
  const router = useRouter();

  const porId = React.useMemo(() => new Map(reunioes.map((r) => [r.id, r])), [reunioes]);

  /**
   * Concluir / Reabrir no popover → PATCH /api/reunioes/:id (command real).
   *
   * Reabrir uma CANCELADA não vai ao banco: o cancelamento já foi propagado ao
   * Outlook, e voltar o status para "agendada" deixaria o CRM dizendo que há
   * reunião enquanto o convite do cliente continua cancelado. Reagendar é
   * criar outra.
   */
  const situacao = React.useCallback(async (x: any, sit: string) => {
    if (x.src === "t") {
      const r = await alterarTarefa(x.id, { status: sit === "Feita" ? "concluida" : "a_fazer" });
      if (!r.ok) toast.error(r.erro);
      router.refresh();
      return;
    }
    if (x.statusReal === "cancelada") {
      toast.error("Reunião cancelada não reabre aqui — o convite já foi cancelado. Crie uma nova.");
      router.refresh();
      return;
    }
    const status = sit === "Feita" ? "realizada" : "agendada";
    try {
      const res = await fetch(`/api/reunioes/${x.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      toast.error("Não foi possível atualizar a reunião. Nada mudou.");
    }
    router.refresh();
  }, [router]);

  const catalogo = React.useMemo(() => {
    const itens = [...reunioes.map(paraItem), ...tarefas.map(paraItemDeTarefa)];
    return {
      Agenda: {
        itens: () => itens,
        situacao,
        /* Só a gaveta de atividade chama `salvar`, e ela não abre para reunião.
           Se algum caminho chegar aqui, avisa em vez de fingir que gravou. */
        salvar: () => {
          toast("Editar reunião por aqui ainda não grava. Abra o negócio para alterar.");
          router.refresh();
        },
        iso,
        hm,
      },
      EQUIPE: equipe,
    };
  }, [reunioes, tarefas, equipe, situacao, router]);

  /* Peça do protótipo: abre por cima desta tela pelo hospedeiro global. */
  const { abrir: abrirPeca } = usePecas();
  const abrir = React.useCallback((peca: string, ref?: any) => {
    if (peca === "reuniao" && ref?.id) {
      const r = porId.get(ref.id);
      if (r?.negocioId) { router.push(`/pipeline/${r.negocioId}`); return; }
      // 13 de 305 reuniões não têm negócio: a peça de reunião mostra o que há.
      abrirPeca(peca, ref, { tela: "calendario" });
      return;
    }
    abrirPeca(peca, ref, { tela: "calendario" });
  }, [porId, router, abrirPeca]);

  /* Mesmo mapa do CascaProto, replicado aqui para não tocar arquivo
     compartilhado: "Nova atividade" do desenho aponta para o preview. */
  const ir = React.useCallback((href: string) => {
    router.push(href === "/onface-preview/atividades" ? "/tarefas" : href);
  }, [router]);

  /* O mês de hoje pode estar vazio (o banco local termina em 23/09/2026). A
     tela fica certa — 0 itens — mas parece quebrada; o aviso diz por quê sem
     mentir sobre que dia é hoje. Abrir direto no último mês com dado seria
     mais bonito e falso. */
  React.useEffect(() => {
    const h = new Date();
    const temNoMes = reunioes.some((r) => {
      const d = new Date(r.data);
      return d.getMonth() === h.getMonth() && d.getFullYear() === h.getFullYear();
    });
    if (temNoMes || !reunioes.length) return;
    const ultima = new Date(reunioes[reunioes.length - 1].data);
    toast(`Nenhuma reunião neste mês. A última foi em ${ultima.toLocaleDateString("pt-BR")}.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* `ref`/`dia` entram por `dados`: o construtor da Liga semeia toda chave de
     estado que nasce null a partir de `props.dados`. */
  const dados = React.useMemo(
    () => (diaInicial ? { ref: diaInicial, dia: diaInicial } : {}),
    [diaInicial],
  );

  return (
    <div data-workspace="desenho">
      <CalendarioLigada
        dados={dados}
        catalogo={catalogo}
        visaoInicial={visaoInicial}
        abrir={abrir}
        ir={ir}
      />
    </div>
  );
}
