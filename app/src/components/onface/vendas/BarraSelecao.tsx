"use client";

import * as React from "react";
import { toast } from "sonner";

import { acaoEmMassa, acaoOpcoesEmMassa } from "@/app/(crm2)/pre-vendas/actions";
import "./barra-selecao.css";

/* ─────────────────────────────────────────────────────────────────────────
 * Barra de seleção em massa — réplica de `OnFace Pre-vendas.dc.html`
 * (bloco `temSelecao`).
 *
 * Pílula coral com a contagem, as quatro ações com ícone, e um painel que abre
 * ACIMA com as opções da ação escolhida. Uma ação por vez: o painel é o mesmo
 * espaço, e clicar na ação já aberta fecha.
 *
 * As quatro são reais. `executarEmMassa` aplica lead a lead e devolve o
 * desfecho de cada um, então a barra diz "48 aplicados, 2 já estavam" em vez
 * de um "pronto" que esconde metade.
 * ───────────────────────────────────────────────────────────────────────── */

type Acao = "responsavel" | "cadencia" | "tag" | "etapa";

const ACOES: Array<{ k: Acao; label: string; d: string; titulo: string }> = [
  { k: "responsavel", label: "Responsável", titulo: "ATRIBUIR RESPONSÁVEL",
    d: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0" },
  { k: "cadencia", label: "Cadência", titulo: "INCLUIR EM CADÊNCIA",
    d: "M4 14h7l-1 7 10-11h-7l1-7z" },
  { k: "tag", label: "Tag", titulo: "ADICIONAR TAG",
    d: "M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01" },
  { k: "etapa", label: "Mover etapa", titulo: "MOVER PARA ETAPA",
    d: "M5 12h14M13 6l6 6-6 6" },
];

/** Só as três livres: as saídas gravam um fato e pedem o porquê, uma a uma. */
const ETAPAS_LIVRES = [
  { v: "novo", label: "Novo" },
  { v: "em_contato", label: "Em contato" },
  { v: "qualificacao", label: "Qualificação" },
] as const;

function Icone({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export function BarraSelecao({
  selecao,
  responsaveis,
  aoLimpar,
  aoMoverEtapa,
  aoConcluir,
}: {
  selecao: string[];
  responsaveis: Array<{ id: string; nome: string }>;
  aoLimpar: () => void;
  /** Mover etapa não tem ação em massa no motor: a tela aplica lead a lead. */
  aoMoverEtapa: (para: "novo" | "em_contato" | "qualificacao") => Promise<void>;
  aoConcluir: () => void;
}) {
  const [aberta, setAberta] = React.useState<Acao | null>(null);
  const [ocupado, setOcupado] = React.useState(false);
  const [opcoes, setOpcoes] = React.useState<{ tags: Array<{ id: string; nome: string }>; cadencias: Array<{ id: string; nome: string }> } | null>(null);

  React.useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (aberta) setAberta(null);
      else aoLimpar();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberta, aoLimpar]);

  // Tags e cadências só são buscadas quando o painel que as usa abre.
  React.useEffect(() => {
    if (!aberta || opcoes || (aberta !== "tag" && aberta !== "cadencia")) return;
    void acaoOpcoesEmMassa().then((r) => {
      if (r.ok && r.dados) setOpcoes(r.dados);
      else toast(r.ok ? "Sem opções" : r.erro);
    });
  }, [aberta, opcoes]);

  const aplicar = async (acao: "atribuir_responsavel" | "adicionar_tag" | "incluir_em_cadencia", valor: string | null) => {
    setOcupado(true);
    try {
      const r = await acaoEmMassa(acao, selecao, valor);
      if (!r.ok) {
        toast(r.erro);
        return;
      }
      const d = r.dados!;
      const aplicados = d.itens.filter((i) => i.desfecho === "aplicado").length;
      const ignorados = d.itens.filter((i) => i.desfecho === "ignorado").length;
      const falhas = d.itens.filter((i) => i.desfecho === "falhou").length;
      /* O relato conta os três desfechos.
         "50 aplicados" quando 2 falharam é o tipo de mentira que só aparece
         semanas depois, quando alguém procura o lead que nunca entrou. */
      toast(
        [
          `${aplicados} de ${d.total}`,
          ignorados ? `${ignorados} sem mudança` : null,
          falhas ? `${falhas} com erro` : null,
        ].filter(Boolean).join(" · "),
      );
      setAberta(null);
      aoConcluir();
    } finally {
      setOcupado(false);
    }
  };

  const painel = () => {
    if (!aberta) return null;
    const titulo = ACOES.find((a) => a.k === aberta)!.titulo;

    let linhas: React.ReactNode;
    if (aberta === "responsavel") {
      linhas = (
        <>
          <button onClick={() => aplicar("atribuir_responsavel", null)} disabled={ocupado}>
            <span>Sem responsável</span>
          </button>
          {responsaveis.map((r) => (
            <button key={r.id} onClick={() => aplicar("atribuir_responsavel", r.id)} disabled={ocupado}>
              <span>{r.nome}</span>
            </button>
          ))}
        </>
      );
    } else if (aberta === "etapa") {
      linhas = ETAPAS_LIVRES.map((e) => (
        <button
          key={e.v}
          disabled={ocupado}
          onClick={async () => {
            setOcupado(true);
            try {
              await aoMoverEtapa(e.v);
              setAberta(null);
            } finally {
              setOcupado(false);
            }
          }}
        >
          <span>{e.label}</span>
        </button>
      ));
    } else {
      const lista = aberta === "tag" ? opcoes?.tags : opcoes?.cadencias;
      if (!lista) {
        linhas = <p className="bs-carregando">Carregando…</p>;
      } else if (!lista.length) {
        linhas = (
          <p className="bs-carregando">
            {aberta === "tag"
              ? "Nenhuma tag cadastrada nesta organização."
              : "Nenhuma cadência ativa nesta organização."}
          </p>
        );
      } else {
        linhas = lista.map((o) => (
          <button
            key={o.id}
            disabled={ocupado}
            onClick={() => aplicar(aberta === "tag" ? "adicionar_tag" : "incluir_em_cadencia", o.id)}
          >
            <span>{o.nome}</span>
          </button>
        ));
      }
    }

    return (
      <div className="bs-painel">
        <div className="bs-painel-titulo">{titulo}</div>
        <div className="bs-painel-lista">{linhas}</div>
      </div>
    );
  };

  return (
    <div className="bs">
      {painel()}
      <div className="bs-barra">
        <span className="bs-conta-bloco">
          <span className="bs-conta">{selecao.length}</span>
          <span className="bs-rotulo">{selecao.length === 1 ? "lead selecionado" : "leads selecionados"}</span>
        </span>
        <span className="bs-fio" />
        {ACOES.map((a) => (
          <button
            key={a.k}
            className="bs-acao"
            data-on={aberta === a.k}
            onClick={() => setAberta((s) => (s === a.k ? null : a.k))}
          >
            <Icone d={a.d} />
            <span>{a.label}</span>
          </button>
        ))}
        <span className="bs-fio" />
        <button className="bs-limpar" onClick={aoLimpar} title="Limpar seleção · Esc" aria-label="Limpar seleção">
          <Icone d="M6 6l12 12M18 6L6 18" />
        </button>
      </div>
    </div>
  );
}
