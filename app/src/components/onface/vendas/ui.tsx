"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, Search, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import "./vendas.css";

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

export function Busca({ valor, aoMudar, placeholder }: {
  valor: string; aoMudar: (v: string) => void; placeholder: string;
}) {
  return (
    <label className="ov-busca">
      <Search aria-hidden />
      <input
        type="search"
        value={valor}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => aoMudar(e.target.value)}
      />
    </label>
  );
}

export function Abas<T extends string>({ abas, ativa, aoTrocar }: {
  abas: Array<{ chave: T; rotulo: string; contagem?: number }>;
  ativa: T;
  aoTrocar: (chave: T) => void;
}) {
  return (
    <div className="ov-abas" role="tablist">
      {abas.map((aba) => (
        <button
          key={aba.chave}
          type="button"
          role="tab"
          aria-selected={aba.chave === ativa}
          data-ativa={aba.chave === ativa}
          onClick={() => aoTrocar(aba.chave)}
        >
          {aba.rotulo}
          {typeof aba.contagem === "number" ? ` · ${aba.contagem}` : ""}
        </button>
      ))}
    </div>
  );
}

export function Tag({ children, tom }: {
  children: ReactNode;
  tom?: "coral" | "alerta" | "sucesso" | "info" | "neutro-escuro";
}) {
  return <span className="ov-tag" data-tom={tom}>{children}</span>;
}

/* ── Board ─────────────────────────────────────────────────────────────── */

export function Board({ children }: { children: ReactNode }) {
  return <div className="ov-board">{children}</div>;
}

export function Coluna({ titulo, total, carregados, extra, children }: {
  titulo: string;
  total: number;
  carregados: number;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="ov-coluna" aria-label={titulo}>
      <header className="ov-coluna-cabecalho">
        <h2>{titulo}</h2>
        <span className="ov-coluna-contagem">
          {/* Quando a coluna tem mais do que a página carregou, a contagem diz
              as duas coisas: senão o número vira uma mentira discreta. */}
          {carregados < total ? `${carregados} de ${total}` : total}
          {extra}
        </span>
      </header>
      <div className="ov-coluna-lista">{children}</div>
    </section>
  );
}

export function ColunaVazia({ children }: { children: ReactNode }) {
  return <p className="ov-coluna-vazia">{children}</p>;
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

export function Painel({ titulo, subtitulo, aoFechar, children }: {
  titulo: string; subtitulo?: string | null; aoFechar: () => void; children: ReactNode;
}) {
  return (
    <aside className="ov-painel" aria-label={titulo}>
      <div className="ov-painel-topo">
        <div style={{ minWidth: 0 }}>
          <h2>{titulo}</h2>
          {subtitulo ? <p>{subtitulo}</p> : null}
        </div>
        <button type="button" className="ov-painel-fechar" onClick={aoFechar} aria-label="Fechar painel">
          <X aria-hidden />
        </button>
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
  return (
    <div className="ov-bloqueio" role="alert">
      <AlertTriangle aria-hidden />
      <div>
        {bloqueio.mensagem}
        {bloqueio.acao && aoAgir ? (
          <div>
            <button type="button" onClick={() => aoAgir(bloqueio.acao!.tipo)}>
              {bloqueio.acao.rotulo}
            </button>
          </div>
        ) : null}
      </div>
    </div>
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
export function useAcao() {
  const [pendente, setPendente] = useState(false);
  const [bloqueio, setBloqueio] = useState<Bloqueio | null>(null);

  async function executar<T>(fn: () => Promise<{ ok: true; dados?: T } | { ok: false; erro: string; acao?: { rotulo: string; tipo: string } }>) {
    setPendente(true);
    setBloqueio(null);
    try {
      const resultado = await fn();
      if (!resultado.ok) {
        setBloqueio({ mensagem: resultado.erro, acao: resultado.acao });
        return null;
      }
      return (resultado.dados ?? null) as T | null;
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
