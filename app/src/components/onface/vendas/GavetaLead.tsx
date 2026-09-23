"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";

import type { DetalheLead } from "@/lib/vendas/consultas";
import type { LinhaDoTempo } from "@/lib/vendas/eventos";
import { rotuloAtor, rotuloEvento, type AcoesPreVendas } from "./PreVendas";
import type { Saida } from "./SaidasLead";
import "./gaveta-lead.css";

/* ─────────────────────────────────────────────────────────────────────────
 * Gaveta de detalhe do lead — réplica de `OnFace Pecas.dc.html`
 * (bloco `temDetalhe`), lida do fonte.
 *
 * Ordem das seções, que é a ordem das perguntas de quem abre: quem é (topo),
 * por onde falo (os três toques), onde está e de quem é (etapa e responsável),
 * o que sei (tags e origem), o que acontece a seguir (próxima ação), o que já
 * apurei (qualificação), o que virou negócio (oportunidades) e o que aconteceu
 * (histórico).
 *
 * **Tudo aqui grava de verdade.** Ligar, WhatsApp e E-mail chamam
 * `registrarContato`; etapa chama `moverEtapa`; responsável chama `atribuir`; e
 * as três saídas abrem os modais que pedem o porquê. Nada é aviso decorativo.
 * ───────────────────────────────────────────────────────────────────────── */

const D = {
  x: "M6 6l12 12M18 6L6 18",
  telefone: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z",
  whatsapp: "M21 11.5a8.4 8.4 0 0 1-12.3 7.5L3 21l2.1-5.6A8.4 8.4 0 1 1 21 11.5z",
  email: "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm0 1 8 6.5L20 6",
  mais: "M12 5v14M5 12h14",
  chevronBaixo: "m6 9 6 6 6-6",
  chevronDir: "m9 18 6-6-6-6",
  cadeado: "M4 11h16v10H4zM8 11V7a4 4 0 0 1 8 0v4",
  empresa: "M3 21V7l9-4 9 4v14M9 21v-6h6v6M8 11h.01M16 11h.01",
  contato: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  check: "M20 6 9 17l-5-5",
  relogio: "M12 8v4l3 2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z",
  menos: "M5 12h14",
  oportunidade: "M16 20V6a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v14M2 9a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z",
};

const CORES_ETAPA: Record<string, string> = {
  novo: "var(--of-etapa-novo)",
  em_contato: "var(--of-etapa-em-contato)",
  qualificacao: "var(--of-etapa-qualificacao)",
  qualificado: "var(--of-etapa-qualificado)",
  oportunidade: "var(--of-etapa-oportunidade)",
  nutricao: "var(--of-etapa-nutricao)",
  desqualificado: "var(--of-etapa-desqualificado)",
};

const LIVRES = ["novo", "em_contato", "qualificacao"] as const;

const ROTULO_ETAPA: Record<(typeof LIVRES)[number], string> = {
  novo: "Novo",
  em_contato: "Em contato",
  qualificacao: "Qualificação",
};

const INTERESSES = ["Callface AI", "PABX", "White Label", "Integrações", "SMS"];
const FITS = ["Alto", "Médio", "Baixo"] as const;

/** Faixa derivada do número, nunca digitada. */
const faixaDe = (n: number) =>
  n <= 10 ? "Micro" : n <= 50 ? "Pequena" : n <= 200 ? "Média" : "Enterprise";

/** Hoje mostra hora; antes disso, a data. O histórico de um lead é lido no dia
 *  em que ele acontece, e hora é o que separa dois toques da mesma tarde. */
function horaOuData(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const hoje = new Date();
  const mesmoDia = d.toDateString() === hoje.toDateString();
  if (mesmoDia) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  if (d.toDateString() === ontem.toDateString()) return "ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

/** O tipo que o modal de atividade grava como prefixo do título. */
function partirAcao(titulo: string): { tipo: string | null; texto: string } {
  const m = titulo.match(/^\[([^\]]+)\]\s*(.*)$/);
  return m ? { tipo: m[1], texto: m[2] } : { tipo: null, texto: titulo };
}

function Icone({ d, className }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={d} />
    </svg>
  );
}

function iniciais(nome: string | null) {
  if (!nome) return "—";
  return nome.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

/** `+5522997517318` → `+55 22 99751-7318`.
 *
 * O protótipo mostra `+55 11 98813-3597`; o banco guarda a string crua, e a
 * gaveta exibia um bloco de treze dígitos que ninguém lê nem confere. */
function telefoneLegivel(bruto: string | null): string | null {
  if (!bruto) return null;
  const d = bruto.replace(/\D/g, "");
  const nac = d.startsWith("55") ? d.slice(2) : d;
  if (nac.length < 10 || nac.length > 11) return bruto;
  const ddd = nac.slice(0, 2);
  const resto = nac.slice(2);
  const corte = resto.length - 4;
  return `+55 ${ddd} ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

function dataCurta(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

/** `19 set 2026 · 09:14` — o formato da linha "Entrada" no protótipo.
 *
 * `toLocaleDateString` em pt-BR devolve "13 de mai. de 2026": dois "de" e um
 * ponto de abreviação numa coluna de 74px, e sem a hora, que é o que separa
 * dois leads do mesmo dia. */
function dataHora(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${dia} ${mes} ${d.getFullYear()} · ${hora}`;
}

function Secao({
  nome,
  resumo,
  alerta,
  aberta,
  aoAlternar,
  acao,
  selo,
  children,
}: {
  nome: string;
  resumo?: string | null;
  alerta?: boolean;
  aberta: boolean;
  aoAlternar: () => void;
  /** Atalho que só faz sentido com a seção aberta. */
  acao?: { rotulo: string; aoClicar: () => void };
  /** Estado da seção, visível aberta ou fechada. */
  /** Três tons, como o `qualProgSelo` do protótipo: cheio, parcial, vazio. */
  selo?: { texto: string; tom: "ok" | "neutro" | "aviso"; naDireita?: boolean };
  children: React.ReactNode;
}) {
  return (
    <div className="gv-secao">
      <button type="button" className="gv-secao-cab" data-aberta={aberta} onClick={aoAlternar}>
        <Icone d={D.chevronDir} className="gv-secao-chevron" />
        <span className="gv-secao-nome">{nome}</span>
        {/* O `cadSelo` vem ANTES do espaçador (colado ao nome) e o
            `qualProgSelo` vem DEPOIS (na direita). Eu punha os dois colados ao
            nome, e a contagem de campos ficava no lugar do estado da cadência. */}
        {selo && !selo.naDireita && <span className="gv-secao-selo" data-tom={selo.tom}>{selo.texto}</span>}
        <span className="gv-secao-espaco" />
        {!aberta && resumo && (
          <span className="gv-secao-resumo" data-alerta={alerta}>{resumo}</span>
        )}
        {selo && selo.naDireita && <span className="gv-secao-selo" data-tom={selo.tom}>{selo.texto}</span>}
        {aberta && acao && (
          <span
            role="button"
            tabIndex={0}
            className="gv-secao-acao"
            onClick={(e) => { e.stopPropagation(); acao.aoClicar() }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); acao.aoClicar() } }}
          >
            {acao.rotulo}
          </span>
        )}
      </button>
      {aberta && children}
    </div>
  );
}

export function GavetaLead({
  lead,
  timeline = [],
  responsaveis,
  acoes,
  aoFechar,
  aoRecarregar,
  aoPedirSaida,
  aoPedirAtividade,
}: {
  lead: DetalheLead | null;
  timeline?: LinhaDoTempo[];
  responsaveis: Array<{ id: string; nome: string }>;
  acoes: AcoesPreVendas;
  aoFechar: () => void;
  aoRecarregar: () => void;
  aoPedirSaida: (saida: Saida) => void;
  aoPedirAtividade: (modo: "ver" | "nova") => void;
}) {
  const [ocupado, setOcupado] = React.useState(false);
  const [saidaAberta, setSaidaAberta] = React.useState(false);
  /* O padrão do protótipo: `{ cad: true, acao: true, qualif: false, timeline:
     false }`. Eu abria a QUALIFICAÇÃO e fechava a CADÊNCIA — o inverso: a
     gaveta abria numa parede de campos vazios e escondia se o lead está
     recebendo toque automático. */
  const [abertas, setAbertas] = React.useState<Record<string, boolean>>({ cad: true, acao: true });
  /** Qual dos dois campos do cabeçalho está com o menu aberto. */
  const [campoAberto, setCampoAberto] = React.useState<"etapa" | "resp" | null>(null);
  const [tagMenu, setTagMenu] = React.useState(false);
  /** `null` enquanto não buscou: o menu mostra "Carregando…" em vez de "nenhuma". */
  const [tagsDisponiveis, setTagsDisponiveis] = React.useState<Array<{ id: string; nome: string }> | null>(null);

  const carregarTags = React.useCallback(async () => {
    if (tagsDisponiveis) return;
    const r = await acoes.tagsDaOrg();
    setTagsDisponiveis(r.ok ? (r.dados?.tags ?? []) : []);
    if (!r.ok) toast(r.erro);
  }, [acoes, tagsDisponiveis]);

  /* A qualificação edita NO LUGAR e grava sozinha.
   *
   * O desenho não tem botão de salvar nessa seção, e ele está certo: a pessoa
   * ajusta a dor no meio de uma ligação, não abre um formulário. A gravação
   * espera 700ms depois da última tecla — sem isso, cada letra da dor viraria
   * uma escrita no banco. */
  const [rascunho, setRascunho] = React.useState(() => ({
    interesses: [] as string[],
    porte: 0,
    dor: "",
    fit: "" as string,
  }));
  const sujo = React.useRef(false);

  React.useEffect(() => {
    if (!lead) return;
    const q = (lead.qualificacao ?? {}) as { servicosInteresse?: string[]; dor?: string; quantidade?: number | null; icp?: string };
    sujo.current = false;
    setRascunho({
      interesses: lead.servicos ?? q.servicosInteresse ?? [],
      porte: q.quantidade ?? 0,
      dor: q.dor ?? "",
      fit: q.icp ?? "",
    });
  }, [lead]);

  const editar = (patch: Partial<typeof rascunho>) => {
    sujo.current = true;
    setRascunho((r) => ({ ...r, ...patch }));
  };

  React.useEffect(() => {
    if (!lead || !sujo.current) return;
    const id = setTimeout(() => {
      sujo.current = false;
      void acoes.salvarQualificacao(lead.id, {
        servicosInteresse: rascunho.interesses,
        quantidade: rascunho.porte || null,
        dor: rascunho.dor.trim() || undefined,
        icp: rascunho.fit || undefined,
      });
    }, 700);
    return () => clearTimeout(id);
  }, [rascunho, lead, acoes]);

  React.useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && (saidaAberta ? setSaidaAberta(false) : aoFechar());
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aoFechar, saidaAberta]);

  React.useEffect(() => {
    if (!saidaAberta) return;
    const aoClicar = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".gv-saida")) setSaidaAberta(false);
    };
    document.addEventListener("mousedown", aoClicar);
    return () => document.removeEventListener("mousedown", aoClicar);
  }, [saidaAberta]);

  const rodar = async (p: Promise<{ ok: boolean; erro?: string }>, feito: string) => {
    setOcupado(true);
    try {
      const r = await p;
      toast(r.ok ? feito : r.erro ?? "Não deu certo");
      if (r.ok) aoRecarregar();
    } finally {
      setOcupado(false);
    }
  };

  const alternar = (k: string) => setAbertas((s) => ({ ...s, [k]: !s[k] }));

  if (!lead) {
    return (
      <div className="gv-veu" onClick={aoFechar} role="presentation">
        <aside className="gv" role="dialog" aria-modal="true" aria-label="Detalhe do lead" onClick={(e) => e.stopPropagation()}>
          <div className="gv-esqueleto">
            <span style={{ height: 38, width: 38, borderRadius: 999 }} />
            <span style={{ height: 20, width: "60%" }} />
            <span style={{ height: 14, width: "80%" }} />
            <span style={{ height: 32, width: "100%" }} />
            <span style={{ height: 96, width: "100%" }} />
          </div>
        </aside>
      </div>
    );
  }

  const semEmpresa = !lead.empresa.id;
  const qual = lead.qualificacao as { servicosInteresse?: string[]; dor?: string; quantidade?: number; icp?: string } | null;
  const interesses = lead.servicos ?? qual?.servicosInteresse ?? [];

  const resumoQual = lead.qualificado
    ? `Qualificado${lead.qualificadoEm ? ` · ${dataCurta(lead.qualificadoEm)}` : ""}`
    : qual?.dor
      ? "Parcial"
      : "Sem critério apurado";

  const acao = lead.proximaAcao ? partirAcao(lead.proximaAcao.titulo) : null;
  const tipoDaAcao = acao?.tipo ?? null;
  const tituloDaAcao = acao?.texto ?? "";

  /* Quantos dos quatro critérios estão preenchidos. O desenho mostra
     "4 de 4 campos" no cabeçalho, e é o que diz se vale abrir a seção. */
  const preenchidos = [
    rascunho.interesses.length > 0,
    rascunho.porte > 0,
    rascunho.dor.trim().length > 0,
    rascunho.fit.length > 0,
  ].filter(Boolean).length;

  const atribuicao: Array<[string, string | null]> = [
    ["Entrada", dataHora(lead.criadoEm)],
    ["Campanha", lead.atribuicao.campanha],
    ["Conjunto", lead.atribuicao.medium],
    ["Criativo", lead.atribuicao.conteudo],
  ];

  return (
    <div className="gv-veu" onClick={aoFechar} role="presentation">
      <aside className="gv" role="dialog" aria-modal="true" aria-label="Detalhe do lead" onClick={(e) => e.stopPropagation()}>
        <header className="gv-topo">
          <div className="gv-topo-linha">
            <span className="gv-avatar">{iniciais(lead.pessoa.nome || lead.empresa.nome)}</span>
            <div className="gv-identidade">
              <h2>{lead.pessoa.nome || "Sem contato"}</h2>
              <p className="gv-papel">
                {[lead.pessoa.cargo, lead.empresa.nome].filter(Boolean).join(" · ") || "Sem empresa"}
              </p>
              <div className="gv-contatos">
                {lead.pessoa.telefone && <span>{telefoneLegivel(lead.pessoa.telefone)}</span>}
                {lead.pessoa.email && <span>{lead.pessoa.email}</span>}
              </div>
            </div>
            <button className="gv-fechar" onClick={aoFechar} aria-label="Fechar">
              <Icone d={D.x} />
            </button>
          </div>

          {/* Os três toques gravam contato de verdade e movem o lead para
              "Em contato" quando é o primeiro — é o motor, não um registro
              paralelo. */}
          <div className="gv-canais">
            <button disabled={ocupado} onClick={() => rodar(acoes.registrarContato(lead.id, "ligacao"), "Ligação registrada")}>
              <Icone d={D.telefone} />
              <span>Ligar</span>
            </button>
            <button disabled={ocupado} onClick={() => rodar(acoes.registrarContato(lead.id, "whatsapp"), "WhatsApp registrado")}>
              <Icone d={D.whatsapp} />
              <span>WhatsApp</span>
            </button>
            <button disabled={ocupado} onClick={() => rodar(acoes.registrarContato(lead.id, "email"), "E-mail registrado")}>
              <Icone d={D.email} />
              <span>E-mail</span>
            </button>
          </div>

          {/* Botão e menu, não `<select>`. O select nativo desenha o PRÓPRIO
              chevron ao lado do que a folha desenhava — dois chevrons — e o
              `:focus-within` acendia um anel coral que o protótipo não tem. */}
          <div className="gv-par">
            <div>
              <span className="gv-rotulo">Etapa</span>
              {/* Só as três livres. As outras quatro gravam um fato e pedem o
                  porquê — elas ficam no menu de saídas, no rodapé. */}
              <div className="gv-campo-caixa">
                <button
                  className="gv-campo"
                  disabled={ocupado}
                  onClick={() => setCampoAberto(campoAberto === "etapa" ? null : "etapa")}
                >
                  <span className="gv-ponto-etapa" style={{ background: CORES_ETAPA[lead.etapa] ?? "var(--of-tinta-4)" }} />
                  <span className="gv-campo-texto">{lead.etapaRotulo}</span>
                  <Icone d={D.chevronBaixo} className="gv-campo-seta" />
                </button>
                {campoAberto === "etapa" && (
                  <div className="gv-campo-menu">
                    {LIVRES.map((k) => (
                      <button
                        key={k}
                        data-on={lead.etapa === k}
                        onClick={() => {
                          setCampoAberto(null);
                          void rodar(acoes.moverEtapa(lead.id, k), "Etapa alterada");
                        }}
                      >
                        <span className="gv-ponto-etapa" style={{ background: CORES_ETAPA[k] }} />
                        <span>{ROTULO_ETAPA[k]}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <span className="gv-rotulo">Responsável</span>
              <div className="gv-campo-caixa">
                <button
                  className="gv-campo"
                  data-vazio={!lead.responsavel.id}
                  disabled={ocupado}
                  onClick={() => setCampoAberto(campoAberto === "resp" ? null : "resp")}
                >
                  <span className="gv-resp-avatar">{lead.responsavel.nome ? iniciais(lead.responsavel.nome) : "—"}</span>
                  <span className="gv-campo-texto">{lead.responsavel.nome ?? "Sem responsável"}</span>
                  <Icone d={D.chevronBaixo} className="gv-campo-seta" />
                </button>
                {campoAberto === "resp" && (
                  <div className="gv-campo-menu">
                    {responsaveis.map((r) => (
                      <button
                        key={r.id}
                        data-on={lead.responsavel.id === r.id}
                        onClick={() => {
                          setCampoAberto(null);
                          void rodar(acoes.atribuir(lead.id, r.id), "Responsável alterado");
                        }}
                      >
                        <span className="gv-resp-avatar">{iniciais(r.nome)}</span>
                        <span>{r.nome}</span>
                      </button>
                    ))}
                    <button
                      data-on={!lead.responsavel.id}
                      onClick={() => {
                        setCampoAberto(null);
                        void rodar(acoes.atribuir(lead.id, null), "Responsável removido");
                      }}
                    >
                      <span className="gv-resp-avatar" data-vazio="true">—</span>
                      <span>Sem responsável</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {semEmpresa && (
          <div className="gv-bloqueio">
            <Icone d={D.cadeado} />
            <span>
              Sem empresa associada: <strong>Criar oportunidade</strong> fica bloqueado.
            </span>
          </div>
        )}

        <div className="gv-corpo">
          <div className="gv-bloco">
            <div>
              <span className="gv-rotulo">Tags</span>
              {/* As Tags de verdade (tabela `labels`), não os serviços de
                  interesse. Sem tag o protótipo não mostra chip nenhum: só o
                  "+". Um chip escrito "Sem tag" parece uma tag chamada
                  "Sem tag". */}
              <div className="gv-tags">
                {lead.tags.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="gv-tag"
                    title={`Tirar a tag ${t.nome}`}
                    disabled={ocupado}
                    onClick={() => rodar(acoes.tag(lead.id, t.id, "remover"), `Tag ${t.nome} removida`)}
                  >
                    <span>{t.nome}</span>
                    <Icone d={D.x} />
                  </button>
                ))}
                <div className="gv-campo-caixa">
                  <button
                    type="button"
                    className="gv-tag-mais"
                    data-on={tagMenu}
                    title="Adicionar tag"
                    onClick={() => { setTagMenu(!tagMenu); if (!tagMenu) void carregarTags(); }}
                  >
                    <Icone d={D.mais} />
                  </button>
                  {tagMenu && (
                    <div className="gv-campo-menu gv-tag-menu">
                      {tagsDisponiveis === null && <p className="gv-tag-carregando">Carregando…</p>}
                      {tagsDisponiveis?.filter((t) => !lead.tags.some((x) => x.id === t.id)).map((t) => (
                        <button
                          key={t.id}
                          onClick={() => {
                            setTagMenu(false);
                            void rodar(acoes.tag(lead.id, t.id, "adicionar"), `Tag ${t.nome} aplicada`);
                          }}
                        >
                          <span>{t.nome}</span>
                        </button>
                      ))}
                      {tagsDisponiveis?.length === 0 && (
                        <p className="gv-tag-carregando">Nenhuma tag cadastrada nesta organização.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <div className="gv-origem-linha">
                <span className="gv-rotulo">Origem</span>
                <span className="gv-selo-origem">{lead.atribuicao.origem ?? "Sem origem"}</span>
              </div>
              <dl className="gv-atribuicao">
                {atribuicao.map(([rotulo, valor]) => (
                  <div key={rotulo}>
                    <dt>{rotulo}</dt>
                    <dd data-vazio={!valor}>{valor ?? "—"}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          <div className="gv-fio" />

          {/* Cadência.
            *
            * O desenho tem dois estados: em cadência (nome, barra de passos,
            * "Passo 2 de 5", Pausar/Trocar/Remover) e fora dela. O nosso banco
            * só sustenta o segundo: `cadencia_execucoes` é LOG de toque já
            * enviado — ordem, canal, status — e não guarda QUAL cadência o lead
            * segue nem de quantos passos ela é. Desenhar "Passo 2 de 5" em cima
            * disso seria afirmar dois números que a tabela não tem.
            *
            * O estado vazio abaixo é o do próprio protótipo, palavra por
            * palavra. Quando existir atribuição de cadência, o outro estado
            * entra aqui. */}
          <Secao
            nome="CADÊNCIA"
            aberta={!!abertas.cad}
            aoAlternar={() => alternar("cad")}
            /* `cadResumo` é informação, não alarme: no protótipo sai em
               `#67787c`. O coral pertence ao resumo de "sem próxima ação". */
            resumo="Fora de cadência"
          >
            <div className="gv-cad-vazia">
              <span>Fora de cadência — nenhum toque automático sai para este lead.</span>
              <button type="button" className="gv-mini" onClick={() => toast("Escolher cadência — a próxima peça do handoff.")}>
                <Icone d={D.mais} />
                <span>Inserir</span>
              </button>
            </div>
          </Secao>

          <div className="gv-fio" />

          <Secao
            nome="PRÓXIMA AÇÃO"
            aberta={!!abertas.acao}
            aoAlternar={() => alternar("acao")}
            resumo={lead.proximaAcao?.titulo ?? "Sem próxima ação"}
            alerta={!lead.proximaAcao}
          >
            <div className="gv-acao-linha">
              {!lead.proximaAcao && <span className="gv-acao-ponto" />}
              {tipoDaAcao && <span className="gv-acao-tipo">{tipoDaAcao}</span>}
              <span className="gv-acao-texto" data-sem={!lead.proximaAcao}>
                {lead.proximaAcao
                  ? lead.proximaAcao.venceEm
                    ? `${tituloDaAcao} · ${lead.proximaAcao.venceEm}`
                    : tituloDaAcao
                  : "Sem próxima ação"}
              </span>
              {lead.proximaAcao && (
                <button type="button" className="gv-mini" onClick={() => aoPedirAtividade("ver")}>
                  <span>Ver</span>
                </button>
              )}
              <button type="button" className="gv-mini" onClick={() => aoPedirAtividade("nova")}>
                <Icone d={D.mais} />
                <span>{lead.proximaAcao ? "Nova" : "Definir"}</span>
              </button>
            </div>
          </Secao>

          <div className="gv-fio" />

          <Secao
            nome="QUALIFICAÇÃO"
            aberta={!!abertas.qual}
            aoAlternar={() => alternar("qual")}
            /* Três tons, como no `qualProgSelo`: cheio é verde, vazio é âmbar
               (é o que pede ação) e o meio do caminho é cinza. Eu só tinha
               verde e cinza, então "0 de 4" saía igual a "3 de 4".
               Ele fica na direita e dispensa resumo: a contagem JÁ é o resumo,
               e eu mostrava os dois, um ao lado do outro. */
            selo={{
              texto: `${preenchidos} de 4 campos`,
              tom: preenchidos === 4 ? "ok" : preenchidos === 0 ? "aviso" : "neutro",
              naDireita: true,
            }}
          >
            <div className="gv-qualif">
              <div>
                <div className="gv-q-cab">
                  <span className="gv-rotulo">Interesse</span>
                  <small>{rascunho.interesses.length ? `${rascunho.interesses.length} selecionado${rascunho.interesses.length > 1 ? "s" : ""}` : "nenhum"}</small>
                </div>
                <div className="gv-q-opcoes">
                  {INTERESSES.map((i) => {
                    const on = rascunho.interesses.includes(i);
                    return (
                      <button
                        key={i}
                        type="button"
                        data-on={on}
                        onClick={() =>
                          editar({ interesses: on ? rascunho.interesses.filter((x) => x !== i) : [...rascunho.interesses, i] })
                        }
                      >
                        {i}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="gv-q-cab">
                  <span className="gv-rotulo">Tamanho da operação</span>
                  {rascunho.porte > 0 && <span className="gv-q-selo">{faixaDe(rascunho.porte)}</span>}
                </div>
                <div className="gv-q-stepper">
                  <button type="button" onClick={() => editar({ porte: Math.max(0, rascunho.porte - 5) })} title="Diminuir">
                    <Icone d={D.menos} />
                  </button>
                  <input
                    value={rascunho.porte}
                    inputMode="numeric"
                    onChange={(e) => {
                      const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
                      editar({ porte: Number.isFinite(n) ? n : 0 });
                    }}
                    aria-label="Atendentes"
                  />
                  <span>atendentes</span>
                  <button type="button" onClick={() => editar({ porte: rascunho.porte + 5 })} title="Aumentar">
                    <Icone d={D.mais} />
                  </button>
                </div>
              </div>

              <div>
                <span className="gv-rotulo">Dor principal</span>
                <input
                  className="gv-q-campo"
                  value={rascunho.dor}
                  onChange={(e) => editar({ dor: e.target.value })}
                  placeholder="Ex.: alto custo com telefonia"
                />
              </div>

              <div>
                <span className="gv-rotulo">Fit</span>
                <div className="gv-q-opcoes">
                  {FITS.map((f) => (
                    <button key={f} type="button" data-on={rascunho.fit === f} onClick={() => editar({ fit: f })}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Secao>

          {lead.oportunidades.length > 0 && (
            <>
              <div className="gv-fio" />
              <Secao
                nome="OPORTUNIDADES"
                aberta={!!abertas.op}
                aoAlternar={() => alternar("op")}
                resumo={`${lead.oportunidades.length} no Pipeline`}
              >
                <ul className="gv-oportunidades">
                  {lead.oportunidades.map((o) => (
                    <li key={o.id}>
                      <Link href={`/pipeline?oportunidade=${o.id}`}>{o.titulo}</Link>
                      <em>{o.etapaRotulo}</em>
                    </li>
                  ))}
                </ul>
              </Secao>
            </>
          )}

          <div className="gv-fio" />

          <Secao
            nome="TIMELINE"
            aberta={!!abertas.hist}
            aoAlternar={() => alternar("hist")}
            resumo={timeline.length ? `${timeline.length} evento${timeline.length > 1 ? "s" : ""}` : "Sem histórico"}
            acao={timeline.length > 12 ? { rotulo: "Ver tudo", aoClicar: () => toast(`${timeline.length} eventos — a tela de histórico é a próxima peça.`) } : undefined}
          >
            {timeline.length ? (
              <ul className="gv-linha-tempo">
                {timeline.slice(0, 12).map((e, i) => (
                  <li key={e.id}>
                    <time>{horaOuData(e.ocorridoEm)}</time>
                    {/* Ponto cheio no evento mais recente, vazio nos anteriores:
                        é o que diz onde a história está agora sem escrever
                        "último" em lugar nenhum. */}
                    <span className="gv-tl-marca">
                      <span className="gv-tl-ponto" data-atual={i === 0} />
                      {i < Math.min(timeline.length, 12) - 1 && <span className="gv-tl-trilho" />}
                    </span>
                    <span className="gv-tl-texto">
                      <span>{e.titulo || rotuloEvento(e.tipo)}</span>
                      {(e.usuarioNome || e.atorTipo) && (
                        <em>{e.usuarioNome ?? rotuloAtor(e.atorTipo)}</em>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="gv-vazio">Nada aconteceu com este lead ainda.</p>
            )}
          </Secao>
        </div>

        <footer className="gv-rodape">
          {lead.empresa.id ? (
            <Link className="gv-btn" href={`/contatos?empresa=${lead.empresa.id}`}>
              <Icone d={D.empresa} />
              <span>Abrir empresa</span>
            </Link>
          ) : (
            <button
              className="gv-btn"
              data-bloqueado="true"
              title="Lead sem empresa associada"
              onClick={() => toast("Este lead não tem empresa associada.")}
            >
              <Icone d={D.empresa} />
              <span>Abrir empresa</span>
            </button>
          )}
          <Link className="gv-btn" href={`/contatos?lead=${lead.id}`}>
            <Icone d={D.contato} />
            <span>Abrir contato</span>
          </Link>

          <span className="gv-rodape-espaco" />

          <div className="gv-saida" data-aberto={saidaAberta}>
            <div className="gv-saida-grupo">
              <button className="gv-saida-principal" onClick={() => aoPedirSaida("qualificar")}>
                <Icone d={D.check} />
                <span>Qualificar</span>
              </button>
              <span className="gv-saida-fio" />
              <button
                className="gv-saida-seta"
                title="Outras saídas do lead"
                onClick={() => setSaidaAberta((v) => !v)}
              >
                <Icone d={D.chevronBaixo} />
              </button>
            </div>

            {saidaAberta && (
              <div className="gv-saida-menu">
                <div className="gv-saida-rotulo">SAÍDAS DO LEAD</div>
                <button
                  className="gv-saida-item"
                  onClick={() => {
                    setSaidaAberta(false);
                    if (semEmpresa) {
                      toast("Criar oportunidade exige empresa associada.");
                      return;
                    }
                    toast("Criar oportunidade pede família e responsável — peça a desenhar.");
                  }}
                >
                  <Icone d={D.oportunidade} />
                  <span>
                    <strong>Criar oportunidade</strong>
                    <small>Leva o lead para o Pipeline como negócio aberto</small>
                  </span>
                </button>
                <button
                  className="gv-saida-item"
                  onClick={() => {
                    setSaidaAberta(false);
                    aoPedirSaida("nutrir");
                  }}
                >
                  <Icone d={D.relogio} />
                  <span>
                    <strong>Mandar para nutrição</strong>
                    <small>Pede motivo e a data em que este lead volta</small>
                  </span>
                </button>
                <button
                  className="gv-saida-item"
                  onClick={() => {
                    setSaidaAberta(false);
                    aoPedirSaida("desqualificar");
                  }}
                >
                  <Icone d={D.x} />
                  <span>
                    <strong>Desqualificar</strong>
                    <small>Pede motivo — é o que sustenta relatório de perda</small>
                  </span>
                </button>
              </div>
            )}
          </div>
        </footer>
      </aside>
    </div>
  );
}
