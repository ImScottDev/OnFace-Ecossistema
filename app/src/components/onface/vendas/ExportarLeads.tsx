"use client";

import * as React from "react";
import { toast } from "sonner";

import "./exportar-leads.css";

/* ─────────────────────────────────────────────────────────────────────────
 * Exportar leads — réplica de `OnFace Pre-vendas.dc.html` (bloco `exp.aberto`).
 *
 * Três escopos, como no desenho: a visão que está na tela, um recorte montado
 * aqui, ou os cartões marcados um a um. Cada um mostra QUANTOS leads traz antes
 * de gerar — exportar e só depois descobrir que vieram 3.989 é o que faz
 * ninguém confiar no botão.
 *
 * Quem gera é `/pre-vendas/exportar`, que já existia: ela repete a consulta do
 * board no servidor, respeita o tenant pela sessão e nunca pela URL, e agora
 * aceita a escolha de colunas e a lista de ids.
 * ───────────────────────────────────────────────────────────────────────── */

export type EscopoExport = "visao" | "criterios" | "selecao";

/** As colunas, na ordem em que saem na planilha. */
export const COLUNAS_EXPORT = [
  { k: "empresa", label: "Empresa" },
  { k: "pessoa", label: "Pessoa" },
  { k: "cargo", label: "Cargo" },
  { k: "etapa", label: "Etapa" },
  { k: "responsavel", label: "Responsável" },
  { k: "origem", label: "Origem" },
  { k: "campanha", label: "Campanha" },
  { k: "interesse", label: "Interesse" },
  { k: "qualificado", label: "Qualificado" },
  { k: "dias", label: "Dias parado" },
  { k: "acao", label: "Próxima ação" },
  { k: "vence", label: "Vence em" },
  { k: "criado", label: "Criado em" },
] as const;

const PADRAO = ["empresa", "pessoa", "etapa", "responsavel", "origem", "acao", "dias"];

const D = {
  x: "M6 6l12 12M18 6L6 18",
  baixar: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  check: "M20 6 9 17l-5-5",
};

function Icone({ d, className }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={d} />
    </svg>
  );
}

export function ExportarLeads({
  contagens,
  filtrosDaTela,
  idsSelecionados,
  aoFechar,
  aoPedirSelecao,
}: {
  /** Quantos leads cada escopo traz, calculado na tela. */
  contagens: { visao: number; criterios: number; selecao: number };
  /** O recorte que a URL da tela já carrega, repassado ao servidor. */
  filtrosDaTela: Record<string, string | null>;
  idsSelecionados: string[];
  aoFechar: () => void;
  /** Fecha o modal e entra no modo de marcar cartão. */
  aoPedirSelecao: () => void;
}) {
  const [escopo, setEscopo] = React.useState<EscopoExport>("visao");
  const [colunas, setColunas] = React.useState<string[]>(PADRAO);
  const [gerando, setGerando] = React.useState(false);

  React.useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aoFechar]);

  const total = contagens[escopo];

  const gerar = () => {
    if (escopo === "selecao" && !idsSelecionados.length) {
      aoPedirSelecao();
      return;
    }
    if (!colunas.length) {
      toast("Escolha ao menos uma coluna.");
      return;
    }
    setGerando(true);
    const url = new URL("/pre-vendas/exportar", window.location.origin);
    // O escopo "visão atual" leva o recorte da tela; "por critérios" vai sem
    // ele, que é o que a nota do desenho promete ("ignorando a tela").
    if (escopo === "visao") {
      for (const [k, v] of Object.entries(filtrosDaTela)) if (v) url.searchParams.set(k, v);
    }
    url.searchParams.set("colunas", colunas.join(","));
    if (escopo === "selecao") url.searchParams.set("ids", idsSelecionados.join(","));

    /* Navegação, não fetch: a resposta vem com `Content-Disposition:
       attachment`, então o navegador baixa e a página não sai do lugar. Com
       fetch eu teria de montar o Blob e o link à mão, para o mesmo resultado. */
    window.location.href = url.toString();
    toast(`Gerando planilha com ${total} ${total === 1 ? "lead" : "leads"}`);
    setTimeout(() => {
      setGerando(false);
      aoFechar();
    }, 800);
  };

  const ESCOPOS: Array<{ v: EscopoExport; label: string; nota: string }> = [
    { v: "visao", label: "Visão atual", nota: "Respeita a busca e os filtros da tela" },
    { v: "criterios", label: "Por critérios", nota: "Exporta a base inteira, ignorando a tela" },
    { v: "selecao", label: "Selecionar na tela", nota: "Fecha este modal e você marca os cartões um a um" },
  ];

  return (
    <div className="ex-veu" onClick={aoFechar} role="presentation">
      <div className="ex" role="dialog" aria-modal="true" aria-label="Exportar leads" onClick={(e) => e.stopPropagation()}>
        <header className="ex-topo">
          <div>
            <h2>Exportar leads</h2>
            <p>Gera uma planilha com os leads que atendem aos critérios abaixo.</p>
          </div>
          <button className="ex-fechar" onClick={aoFechar} aria-label="Fechar">
            <Icone d={D.x} />
          </button>
        </header>

        <div className="ex-corpo">
          <section>
            <span className="ex-rotulo">Escopo</span>
            <div className="ex-escopos">
              {ESCOPOS.map((e) => (
                <button
                  key={e.v}
                  type="button"
                  className="ex-escopo"
                  data-on={escopo === e.v}
                  onClick={() => setEscopo(e.v)}
                >
                  <span className="ex-radio" />
                  <span className="ex-escopo-texto">
                    <strong>{e.label}</strong>
                    <small>{e.nota}</small>
                  </span>
                  <span className="ex-escopo-conta">{contagens[e.v]}</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <span className="ex-rotulo">Colunas da planilha</span>
            <div className="ex-colunas">
              {COLUNAS_EXPORT.map((c) => {
                const on = colunas.includes(c.k);
                return (
                  <button
                    key={c.k}
                    type="button"
                    className="ex-coluna"
                    data-on={on}
                    onClick={() => setColunas((s) => (on ? s.filter((x) => x !== c.k) : [...s, c.k]))}
                  >
                    <span className="ex-caixa" data-on={on}>
                      {on && <Icone d={D.check} />}
                    </span>
                    <span>{c.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <span className="ex-rotulo">Formato</span>
            <div className="ex-formatos">
              {/* Um formato só não é escolha, é informação — por isso não é
                  botão. Botão que não age é UI cenográfica, e o repo tem trava
                  para isso. */}
              <span className="ex-formato-atual">CSV (.csv)</span>
              {/* XLSX está no desenho e a rota gera CSV. Botão que promete
                  planilha e entrega CSV é pior que não ter o botão: ele fica
                  aqui desabilitado, dizendo o que falta. */}
              <button type="button" disabled title="A rota de exportação gera CSV; XLSX ainda não">
                Planilha (.xlsx)
              </button>
            </div>
          </section>
        </div>

        <footer className="ex-rodape">
          <span className="ex-total">
            <strong>{total}</strong> {total === 1 ? "lead será exportado" : "leads serão exportados"}
          </span>
          <button className="ex-btn" onClick={aoFechar}>Cancelar</button>
          <button className="ex-btn ex-btn-gerar" onClick={gerar} disabled={gerando}>
            <Icone d={D.baixar} />
            <span>
              {escopo === "selecao" && !idsSelecionados.length ? "Marcar cartões" : gerando ? "Gerando…" : "Gerar planilha"}
            </span>
          </button>
        </footer>
      </div>
    </div>
  );
}
