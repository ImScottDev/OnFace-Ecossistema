"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";

import type { DetalheLead } from "@/lib/vendas/consultas";
import type { LinhaDoTempo } from "@/lib/vendas/eventos";
import type { AcoesPreVendas } from "./PreVendas";
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

function dataCurta(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function Secao({
  nome,
  resumo,
  alerta,
  aberta,
  aoAlternar,
  children,
}: {
  nome: string;
  resumo?: string | null;
  alerta?: boolean;
  aberta: boolean;
  aoAlternar: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="gv-secao">
      <button type="button" className="gv-secao-cab" data-aberta={aberta} onClick={aoAlternar}>
        <Icone d={D.chevronDir} className="gv-secao-chevron" />
        <span className="gv-secao-nome">{nome}</span>
        {!aberta && resumo && (
          <span className="gv-secao-resumo" data-alerta={alerta}>{resumo}</span>
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
  aoPedirAtividade: () => void;
}) {
  const [ocupado, setOcupado] = React.useState(false);
  const [saidaAberta, setSaidaAberta] = React.useState(false);
  const [abertas, setAbertas] = React.useState<Record<string, boolean>>({ acao: true });

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

  const atribuicao: Array<[string, string | null]> = [
    ["Entrada", dataCurta(lead.criadoEm)],
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
                {lead.pessoa.telefone && <span>{lead.pessoa.telefone}</span>}
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

          <div className="gv-par">
            <label>
              <span className="gv-rotulo">Etapa</span>
              {/* Só as três livres. As outras quatro gravam um fato e pedem o
                  porquê — elas ficam no menu de saídas, no rodapé. */}
              <span className="gv-campo">
                <span className="gv-ponto-etapa" style={{ background: CORES_ETAPA[lead.etapa] ?? "var(--of-tinta-4)" }} />
                <select
                  value={(LIVRES as readonly string[]).includes(lead.etapa) ? lead.etapa : ""}
                  disabled={ocupado}
                  onChange={(e) =>
                    rodar(acoes.moverEtapa(lead.id, e.target.value as (typeof LIVRES)[number]), "Etapa alterada")
                  }
                >
                  {!(LIVRES as readonly string[]).includes(lead.etapa) && (
                    <option value="">{lead.etapaRotulo}</option>
                  )}
                  <option value="novo">Novo</option>
                  <option value="em_contato">Em contato</option>
                  <option value="qualificacao">Qualificação</option>
                </select>
                <Icone d={D.chevronBaixo} className="gv-campo-seta" />
              </span>
            </label>

            <label>
              <span className="gv-rotulo">Responsável</span>
              <span className="gv-campo" data-vazio={!lead.responsavel.id}>
                <span className="gv-resp-avatar">{lead.responsavel.nome ? iniciais(lead.responsavel.nome) : "—"}</span>
                <select
                  value={lead.responsavel.id ?? ""}
                  disabled={ocupado}
                  onChange={(e) => rodar(acoes.atribuir(lead.id, e.target.value || null), "Responsável alterado")}
                >
                  <option value="">Sem responsável</option>
                  {responsaveis.map((r) => (
                    <option key={r.id} value={r.id}>{r.nome}</option>
                  ))}
                </select>
                <Icone d={D.chevronBaixo} className="gv-campo-seta" />
              </span>
            </label>
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
              <div className="gv-tags">
                {interesses.map((t) => (
                  <span key={t} className="gv-tag">{t}</span>
                ))}
                {!interesses.length && <span className="gv-tag gv-tag-vazia">Sem tag</span>}
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

          <Secao
            nome="PRÓXIMA AÇÃO"
            aberta={!!abertas.acao}
            aoAlternar={() => alternar("acao")}
            resumo={lead.proximaAcao?.titulo ?? "Sem próxima ação"}
            alerta={!lead.proximaAcao}
          >
            <div className="gv-acao-linha">
              {!lead.proximaAcao && <span className="gv-acao-ponto" />}
              <span className="gv-acao-texto" data-sem={!lead.proximaAcao}>
                {lead.proximaAcao
                  ? lead.proximaAcao.venceEm
                    ? `${lead.proximaAcao.titulo} · ${lead.proximaAcao.venceEm}`
                    : lead.proximaAcao.titulo
                  : "Sem próxima ação"}
              </span>
              <button type="button" className="gv-mini" onClick={aoPedirAtividade}>
                <Icone d={D.mais} />
                <span>{lead.proximaAcao ? "Outra" : "Definir"}</span>
              </button>
            </div>
          </Secao>

          <div className="gv-fio" />

          <Secao
            nome="QUALIFICAÇÃO"
            aberta={!!abertas.qual}
            aoAlternar={() => alternar("qual")}
            resumo={resumoQual}
            alerta={!lead.qualificado && !qual?.dor}
          >
            {qual?.dor || qual?.quantidade || qual?.icp ? (
              <dl className="gv-atribuicao" style={{ margin: "2px 8px 6px" }}>
                {qual.dor && (
                  <div><dt>Dor</dt><dd>{qual.dor}</dd></div>
                )}
                {qual.quantidade != null && (
                  <div><dt>Operação</dt><dd>{qual.quantidade} atendentes</dd></div>
                )}
                {qual.icp && <div><dt>Fit</dt><dd>{qual.icp}</dd></div>}
                {lead.qualificadoPor && (
                  <div><dt>Por</dt><dd>{lead.qualificadoPor}</dd></div>
                )}
              </dl>
            ) : (
              <p className="gv-vazio">
                Nenhum critério apurado. Qualificar pede interesse, tamanho da operação, dor e
                fit — e grava um fato que sobrevive à etapa seguinte.
              </p>
            )}
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
            nome="HISTÓRICO"
            aberta={!!abertas.hist}
            aoAlternar={() => alternar("hist")}
            resumo={timeline.length ? `${timeline.length} evento${timeline.length > 1 ? "s" : ""}` : "Sem histórico"}
          >
            {timeline.length ? (
              <ul className="gv-linha-tempo">
                {timeline.slice(0, 20).map((e) => (
                  <li key={e.id}>
                    <time>{dataCurta(e.ocorridoEm) ?? "—"}</time>
                    <span>{e.titulo || e.tipo}</span>
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
