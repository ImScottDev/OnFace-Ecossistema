"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";

import type { DetalheLead } from "@/lib/vendas/consultas";
import type { LinhaDoTempo } from "@/lib/vendas/eventos";
import type { AcoesPreVendas } from "./PreVendas";

/* ─────────────────────────────────────────────────────────────────────────
 * Gaveta de detalhe do lead.
 *
 * **A marcação dela NÃO está no bundle do handoff.** Os dois `.dc.html` só
 * chamam `OnFaceEstado.abrir("detalhe", id)`, e a store em `dados.js` não traz
 * o desenho. A fonte aqui é `screenshots/gaveta-detalhe-lead.png`, então
 * geometria e ordem vêm de medição da imagem, não de valor declarado: onde a
 * imagem não decide, a gaveta segue a linguagem do resto do protótipo
 * (controles de 34px, raios de 9, fio `#e3e7e8`, coral de ação `#d93c1a`).
 *
 * Ordem das seções, como na imagem: identidade, os três canais de contato,
 * etapa e responsável lado a lado, tags, origem com o bloco de atribuição, e o
 * rodapé com Abrir empresa · Abrir contato · Qualificar.
 * ───────────────────────────────────────────────────────────────────────── */

const D = {
  x: "M6 6l12 12M18 6L6 18",
  telefone: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z",
  whatsapp: "M21 11.5a8.4 8.4 0 0 1-12.3 7.5L3 21l2.1-5.6A8.4 8.4 0 1 1 21 11.5z",
  email: "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm0 1 8 6.5L20 6",
  mais: "M12 5v14M5 12h14",
  chevron: "m6 9 6 6 6-6",
  empresa: "M3 21h18M5 21V7l7-4 7 4v14M9 9h1M9 13h1M14 9h1M14 13h1",
  contato: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  check: "M20 6 9 17l-5-5",
  traco: "M5 12h14",
};

function Icone({ d, className }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={d} />
    </svg>
  );
}

function iniciais(nome: string) {
  return nome.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

function dataCurta(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).replace(",", " ·");
}

export function GavetaLead({
  lead,
  responsaveis,
  acoes,
  aoFechar,
  aoRecarregar,
}: {
  /** `null` enquanto o detalhe chega: a gaveta abre na hora e o conteúdo entra
   *  depois, com a FORMA do conteúdo no lugar — uma frase centralizada faria a
   *  gaveta saltar quando o dado chegasse. */
  lead: DetalheLead | null;
  timeline?: LinhaDoTempo[];
  responsaveis: Array<{ id: string; nome: string }>;
  acoes: AcoesPreVendas;
  aoFechar: () => void;
  aoRecarregar: () => void;
}) {
  React.useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aoFechar]);

  const rodar = async (p: Promise<{ ok: boolean; erro?: string }>, feito: string) => {
    const r = await p;
    toast(r.ok ? feito : r.erro ?? "Não deu certo");
    if (r.ok) aoRecarregar();
  };

  return (
    <div className="gv-veu" onClick={aoFechar} role="presentation">
      <aside
        className="gv"
        role="dialog"
        aria-modal="true"
        aria-label="Detalhe do lead"
        onClick={(e) => e.stopPropagation()}
      >
        {!lead ? (
          <div className="gv-esqueleto">
            <span style={{ height: 44, width: 44, borderRadius: 999 }} />
            <span style={{ height: 20, width: "60%" }} />
            <span style={{ height: 14, width: "80%" }} />
            <span style={{ height: 34, width: "100%" }} />
            <span style={{ height: 96, width: "100%" }} />
          </div>
        ) : (
          <>
            <header className="gv-topo">
              <span className="gv-avatar">{iniciais(lead.pessoa.nome || lead.empresa.nome)}</span>
              <div className="gv-identidade">
                <h2>{lead.pessoa.nome || "Sem contato"}</h2>
                <p className="gv-papel">
                  {[lead.pessoa.cargo, lead.empresa.nome].filter(Boolean).join(" · ") || "Sem empresa"}
                </p>
                {lead.pessoa.telefone && <p className="gv-linha-contato">{lead.pessoa.telefone}</p>}
                {lead.pessoa.email && <p className="gv-linha-contato">{lead.pessoa.email}</p>}
              </div>
              <button className="gv-fechar" onClick={aoFechar} aria-label="Fechar">
                <Icone d={D.x} />
              </button>
            </header>

            <div className="gv-canais">
              <button onClick={() => rodar(acoes.registrarContato(lead.id, "ligacao"), "Ligação registrada")}>
                <Icone d={D.telefone} />
                <span>Ligar</span>
              </button>
              <button onClick={() => rodar(acoes.registrarContato(lead.id, "whatsapp"), "WhatsApp registrado")}>
                <Icone d={D.whatsapp} />
                <span>WhatsApp</span>
              </button>
              <button onClick={() => rodar(acoes.registrarContato(lead.id, "email"), "E-mail registrado")}>
                <Icone d={D.email} />
                <span>E-mail</span>
              </button>
            </div>

            <div className="gv-corpo">
              <div className="gv-par">
                <label>
                  <span className="gv-rotulo">Etapa</span>
                  {/* Só as três livres: as outras quatro gravam um fato e pedem
                      confirmação, que é o que os overlays de qualificação,
                      nutrição e desqualificação fazem. */}
                  <span className="gv-campo">
                    <span className="gv-ponto-etapa" />
                    <select
                      value={["novo", "em_contato", "qualificacao"].includes(lead.etapa) ? lead.etapa : ""}
                      onChange={(e) =>
                        rodar(
                          acoes.moverEtapa(lead.id, e.target.value as "novo" | "em_contato" | "qualificacao"),
                          "Etapa alterada",
                        )
                      }
                    >
                      {!["novo", "em_contato", "qualificacao"].includes(lead.etapa) && (
                        <option value="">{lead.etapaRotulo}</option>
                      )}
                      <option value="novo">Novo</option>
                      <option value="em_contato">Em contato</option>
                      <option value="qualificacao">Qualificação</option>
                    </select>
                    <Icone d={D.chevron} className="gv-campo-seta" />
                  </span>
                </label>

                <label>
                  <span className="gv-rotulo">Responsável</span>
                  <span className="gv-campo" data-vazio={!lead.responsavel.id}>
                    <Icone d={D.traco} className="gv-campo-icone" />
                    <select
                      value={lead.responsavel.id ?? ""}
                      onChange={(e) => rodar(acoes.atribuir(lead.id, e.target.value || null), "Responsável alterado")}
                    >
                      <option value="">Sem responsável</option>
                      {responsaveis.map((r) => (
                        <option key={r.id} value={r.id}>{r.nome}</option>
                      ))}
                    </select>
                    <Icone d={D.chevron} className="gv-campo-seta" />
                  </span>
                </label>
              </div>

              <div className="gv-secao">
                <span className="gv-rotulo">Tags</span>
                <div className="gv-tags">
                  {(lead.servicos ?? []).map((s) => (
                    <span key={s} className="gv-tag">{s}</span>
                  ))}
                  {!(lead.servicos ?? []).length && <span className="gv-tag gv-tag-vazia">Sem interesse marcado</span>}
                  <button className="gv-tag-mais" title="Adicionar tag" onClick={() => toast("Menu de tags — próximo overlay")}>
                    <Icone d={D.mais} />
                  </button>
                </div>
              </div>

              <div className="gv-secao">
                <div className="gv-origem-linha">
                  <span className="gv-rotulo">Origem</span>
                  <span className="gv-tag">{lead.atribuicao.origem ?? "Sem origem"}</span>
                </div>

                {/* Bloco de atribuição: quatro linhas de rótulo e valor. Só
                    aparece o que existe — campanha, conjunto e criativo vêm de
                    UTM, e lead que não veio de anúncio não tem nenhum deles. */}
                <dl className="gv-atribuicao">
                  <div><dt>Entrada</dt><dd>{dataCurta(lead.criadoEm)}</dd></div>
                  <div><dt>Campanha</dt><dd>{lead.atribuicao.campanha ?? "—"}</dd></div>
                  <div><dt>Conjunto</dt><dd>{lead.atribuicao.medium ?? "—"}</dd></div>
                  <div><dt>Criativo</dt><dd>{lead.atribuicao.conteudo ?? "—"}</dd></div>
                </dl>
              </div>

              {lead.proximaAcao && (
                <div className="gv-secao">
                  <span className="gv-rotulo">Próxima ação</span>
                  <p className="gv-proxima">
                    {lead.proximaAcao.titulo}
                    {lead.proximaAcao.venceEm ? ` · ${lead.proximaAcao.venceEm}` : ""}
                  </p>
                </div>
              )}

              {lead.oportunidades.length > 0 && (
                <div className="gv-secao">
                  <span className="gv-rotulo">Oportunidades</span>
                  <ul className="gv-oportunidades">
                    {lead.oportunidades.map((o) => (
                      <li key={o.id}>
                        <Link href={`/pipeline?oportunidade=${o.id}`}>{o.titulo}</Link>
                        <span>{o.etapaRotulo}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <footer className="gv-rodape">
              {lead.empresa.id ? (
                <Link className="gv-btn" href={`/contatos?empresa=${lead.empresa.id}`}>
                  <Icone d={D.empresa} />
                  <span>Abrir empresa</span>
                </Link>
              ) : (
                <button className="gv-btn" onClick={() => toast("Lead sem empresa associada")}>
                  <Icone d={D.empresa} />
                  <span>Abrir empresa</span>
                </button>
              )}
              <Link className="gv-btn" href={`/contatos?lead=${lead.id}`}>
                <Icone d={D.contato} />
                <span>Abrir contato</span>
              </Link>
              <span className="gv-rodape-espaco" />
              <div className="gv-qualificar">
                <button
                  className="gv-qualificar-principal"
                  onClick={() => toast("Qualificar pede interesse, tamanho da operação, dor e fit — popup a construir")}
                >
                  <Icone d={D.check} />
                  <span>Qualificar</span>
                </button>
                <span className="gv-qualificar-fio" />
                <button
                  className="gv-qualificar-seta"
                  title="Outras saídas"
                  onClick={() => toast("Nutrir e desqualificar pedem motivo — overlays a construir")}
                >
                  <Icone d={D.chevron} />
                </button>
              </div>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
