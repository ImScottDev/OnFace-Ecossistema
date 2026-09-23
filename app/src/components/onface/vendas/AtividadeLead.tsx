"use client";

import * as React from "react";
import { toast } from "sonner";

import type { AcoesPreVendas } from "./PreVendas";
import "./atividade-lead.css";

/* ─────────────────────────────────────────────────────────────────────────
 * Modal de atividade — réplica de `OnFace Pecas.dc.html` (bloco `atvAberta`).
 *
 * Dois modos, como no desenho: VER (o que está marcado, com Concluir,
 * Declinar e Editar) e EDITAR (situação, tipo, título, descrição, data, hora e
 * responsável). Abrir uma atividade existente entra em VER; criar entra
 * direto em EDITAR.
 *
 * A atividade é uma Task real do produto — `acaoCriarTarefa`. Situação e tipo
 * não têm coluna no banco: viram prefixo do título (`[Ligação] Falar com…`),
 * que é como a lista de tarefas já lê hoje. Está marcado abaixo onde isso
 * precisa virar campo.
 * ───────────────────────────────────────────────────────────────────────── */

const SITUACOES = [
  { v: "A fazer", d: "M12 8v4l3 2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" },
  { v: "Em andamento", d: "M12 2a10 10 0 0 1 10 10M12 6a6 6 0 0 1 6 6" },
  { v: "Feito", d: "M20 6 9 17l-5-5" },
  { v: "Declinada", d: "M6 6l12 12M18 6L6 18" },
] as const;

const TIPOS = [
  { v: "Ligação", d: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" },
  { v: "Mensagem", d: "M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 21l1.9-4.1A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z" },
  { v: "E-mail", d: "M4 4h16v16H4zM4 7l8 6 8-6" },
  { v: "Follow up", d: "M3 12a9 9 0 1 0 9-9 9 9 0 0 0-6.4 2.6L3 8M3 3v5h5" },
  { v: "Reunião", d: "M8 2v4M16 2v4M3 8h18M5 6h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" },
  { v: "Proposta", d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 13h6M9 17h4" },
] as const;

const D = {
  x: "M6 6l12 12M18 6L6 18",
  check: "M20 6 9 17l-5-5",
  lapis: "M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z",
  calendario: "M8 2v4M16 2v4M3 8h18M5 6h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z",
  pessoa: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  linhas: "M4 6h16M4 12h16M4 18h10",
  chevron: "m6 9 6 6 6-6",
};

function Icone({ d, className }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={d} />
    </svg>
  );
}

const iniciais = (n: string | null) =>
  n ? n.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() : "—";

export type AtividadeVista = {
  titulo: string;
  venceEm: string | null;
} | null;

export function AtividadeLead({
  contexto,
  leadId,
  atual,
  responsaveis,
  responsavelPadrao,
  acoes,
  aoFechar,
  aoConcluir,
}: {
  /** "Empresa · Pessoa", a linha que diz sobre quem é esta atividade. */
  contexto: string;
  leadId: string;
  /** A atividade que já existe. `null` abre direto em edição. */
  atual: AtividadeVista;
  responsaveis: Array<{ id: string; nome: string }>;
  responsavelPadrao: { id: string | null; nome: string | null };
  acoes: AcoesPreVendas;
  aoFechar: () => void;
  aoConcluir: () => void;
}) {
  const [editando, setEditando] = React.useState(!atual);
  const [gravando, setGravando] = React.useState(false);
  const [situacao, setSituacao] = React.useState<(typeof SITUACOES)[number]["v"]>("A fazer");
  const [tipo, setTipo] = React.useState<(typeof TIPOS)[number]["v"]>("Follow up");
  const [titulo, setTitulo] = React.useState(atual?.titulo ?? "");
  const [desc, setDesc] = React.useState("");
  const [data, setData] = React.useState("");
  const [hora, setHora] = React.useState("");
  const [respId, setRespId] = React.useState(responsavelPadrao.id ?? "");

  React.useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aoFechar]);

  const respNome = responsaveis.find((r) => r.id === respId)?.nome ?? responsavelPadrao.nome ?? "Sem responsável";

  const salvar = async () => {
    if (!titulo.trim()) {
      toast("A atividade precisa de um título.");
      return;
    }
    setGravando(true);
    try {
      /* Situação e tipo viram prefixo do título.
       *
       * `tarefas` não tem coluna para nenhum dos dois, e a lista de tarefas já
       * lê o tipo assim. Enquanto não houver campo, prefixo é honesto: o dado
       * fica legível e recuperável. Virar coluna é migração, e migração é
       * decisão do Kauã. */
      const r = await acoes.criarTarefa({
        leadId,
        titulo: `[${tipo}] ${titulo.trim()}`,
        responsavelId: respId || null,
        venceEm: data ? (hora ? `${data}T${hora}` : data) : null,
        prioridade: situacao === "Em andamento" ? "alta" : "media",
        descricao: desc.trim() || null,
      });
      toast(r.ok ? "Atividade salva" : r.erro ?? "Não deu para salvar");
      if (!r.ok) return;
      aoConcluir();
      aoFechar();
    } finally {
      setGravando(false);
    }
  };

  const tituloVisto = titulo.trim() || "Atividade sem título";

  return (
    <div className="at-veu" onClick={aoFechar} role="presentation">
      <div className="at" role="dialog" aria-modal="true" aria-label="Atividade" onClick={(e) => e.stopPropagation()}>
        <header className="at-topo">
          <div className="at-topo-texto">
            <div className="at-selos">
              <span className="at-selo-situacao">{situacao}</span>
              <span className="at-selo-tipo">{tipo}</span>
            </div>
            <h2>{tituloVisto}</h2>
            <p>{contexto}</p>
          </div>
          <button className="at-fechar" onClick={aoFechar} aria-label="Fechar">
            <Icone d={D.x} />
          </button>
        </header>

        <div className="at-corpo">
          {!editando ? (
            <div className="at-ver">
              <div className="at-ver-linha">
                <Icone d={D.calendario} />
                <div>
                  <span className="at-rotulo">Quando</span>
                  <strong>{atual?.venceEm ?? "Sem prazo"}</strong>
                </div>
              </div>
              <div className="at-ver-linha">
                <Icone d={D.pessoa} />
                <div>
                  <span className="at-rotulo">Responsável</span>
                  <strong>{respNome}</strong>
                </div>
              </div>
              <div className="at-ver-linha">
                <Icone d={D.linhas} />
                <div>
                  <span className="at-rotulo">Descrição</span>
                  <strong data-vazio={!desc}>{desc || "Sem descrição"}</strong>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div>
                <span className="at-rotulo">Situação</span>
                <div className="at-opcoes">
                  {SITUACOES.map((s) => (
                    <button key={s.v} type="button" className="at-op" data-on={situacao === s.v} onClick={() => setSituacao(s.v)}>
                      <Icone d={s.d} />
                      <span>{s.v}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="at-rotulo">Tipo</span>
                <div className="at-opcoes">
                  {TIPOS.map((t) => (
                    <button key={t.v} type="button" className="at-op at-op-tipo" data-on={tipo === t.v} onClick={() => setTipo(t.v)}>
                      <Icone d={t.d} />
                      <span>{t.v}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="at-rotulo">Título</span>
                <input className="at-campo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="O que precisa ser feito" />
              </div>

              <div>
                <span className="at-rotulo">Descrição</span>
                <textarea className="at-area" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Contexto, roteiro da ligação, o que combinar" />
              </div>

              <div className="at-quando">
                <div>
                  <span className="at-rotulo">Data</span>
                  <input type="date" className="at-campo" value={data} onChange={(e) => setData(e.target.value)} />
                </div>
                <div>
                  <span className="at-rotulo">Hora</span>
                  <input type="time" className="at-campo" value={hora} onChange={(e) => setHora(e.target.value)} />
                </div>
              </div>

              <div>
                <span className="at-rotulo">Responsável</span>
                <span className="at-resp">
                  <span className="at-resp-avatar">{iniciais(respNome === "Sem responsável" ? null : respNome)}</span>
                  <select value={respId} onChange={(e) => setRespId(e.target.value)}>
                    <option value="">Sem responsável</option>
                    {responsaveis.map((r) => (
                      <option key={r.id} value={r.id}>{r.nome}</option>
                    ))}
                  </select>
                  <Icone d={D.chevron} className="at-resp-seta" />
                </span>
              </div>
            </>
          )}
        </div>

        <footer className="at-rodape" data-modo={editando ? "editar" : "ver"}>
          {!editando ? (
            <>
              <button className="at-btn at-btn-ok" onClick={() => { setSituacao("Feito"); setEditando(true); }}>
                <Icone d={D.check} />
                <span>Concluir</span>
              </button>
              <button className="at-btn at-btn-recusa" onClick={() => { setSituacao("Declinada"); setEditando(true); }}>
                Declinar
              </button>
              <span className="at-espaco" />
              <button className="at-btn" onClick={() => setEditando(true)}>
                <Icone d={D.lapis} />
                <span>Editar</span>
              </button>
            </>
          ) : (
            <>
              <button className="at-btn" onClick={atual ? () => setEditando(false) : aoFechar}>
                Cancelar
              </button>
              <button className="at-btn at-btn-salvar" onClick={salvar} disabled={gravando}>
                {gravando ? "Salvando…" : "Salvar"}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
