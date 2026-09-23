"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  MOTIVOS_DESQUALIFICACAO, MOTIVOS_NUTRICAO,
  type MotivoDesqualificacao, type MotivoNutricao, type Qualificacao,
} from "@/lib/vendas/dominio";
import type { AcoesPreVendas } from "./PreVendas";
import "./saidas-lead.css";

/* ─────────────────────────────────────────────────────────────────────────
 * As três saídas do lead: qualificar, nutrir e desqualificar.
 *
 * Réplica de `OnFace Pecas.dc.html` (blocos `qual`, `desq` e `temNutrir`).
 *
 * As três existem porque **etapa não é campo, é consequência**: arrastar um
 * cartão para Qualificado, Nutrição ou Desqualificado grava um fato que
 * sobrevive à etapa seguinte, e fato não se grava sem o porquê. Até aqui o
 * quadro só anunciava o que ia pedir; agora ele pede.
 * ───────────────────────────────────────────────────────────────────────── */

export type Saida = "qualificar" | "nutrir" | "desqualificar" | "atividade";

export type LeadDaSaida = {
  id: string;
  empresa: string;
  pessoa: string | null;
  cargo: string | null;
  iniciais: string;
  origem: string | null;
  servicos: string[] | null;
};

const INTERESSES = ["Callface AI", "PABX", "White Label", "Integrações", "SMS"];

/** Faixas do README do handoff. O selo é derivado do número, nunca digitado. */
const FAIXAS = [
  { ate: 10, rotulo: "Micro" },
  { ate: 50, rotulo: "Pequena" },
  { ate: 200, rotulo: "Média" },
  { ate: Infinity, rotulo: "Enterprise" },
];
const faixaDe = (n: number) => FAIXAS.find((f) => n <= f.ate)!.rotulo;

const PORTES_RAPIDOS = [5, 20, 80, 300];
const DORES_RAPIDAS = [
  "Alto custo com telefonia",
  "Perde ligação fora do horário",
  "Não mede o time",
  "Atendimento lento",
];
const ATIVIDADES_RAPIDAS = [
  "Ligar para qualificar",
  "Enviar proposta",
  "Follow-up por WhatsApp",
  "Agendar reunião",
];

const FITS = ["Alto", "Médio", "Baixo"] as const;

function Icone({ d, className }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={d} />
    </svg>
  );
}

const D = {
  check: "M20 6 9 17l-5-5",
  x: "M6 6l12 12M18 6L6 18",
  menos: "M5 12h14",
  mais: "M12 5v14M5 12h14",
  alerta: "M12 8v5M12 17h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z",
  relogio: "M12 8v4l3 2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z",
};

export function SaidasLead({
  saida,
  lead,
  acoes,
  aoFechar,
  aoConcluir,
}: {
  saida: Saida;
  lead: LeadDaSaida;
  acoes: AcoesPreVendas;
  aoFechar: () => void;
  aoConcluir: () => void;
}) {
  const [gravando, setGravando] = React.useState(false);

  // Qualificação
  const [interesses, setInteresses] = React.useState<string[]>(lead.servicos ?? []);
  const [porte, setPorte] = React.useState(20);
  const [dor, setDor] = React.useState("");
  const [fit, setFit] = React.useState<(typeof FITS)[number] | null>(null);
  const [cobrado, setCobrado] = React.useState(false);

  // Nutrição / desqualificação
  const [motivoNutrir, setMotivoNutrir] = React.useState<MotivoNutricao | null>(null);
  const [retomarEm, setRetomarEm] = React.useState("");
  const [observacao, setObservacao] = React.useState("");
  const [motivoDesq, setMotivoDesq] = React.useState<MotivoDesqualificacao | null>(null);
  const [detalhe, setDetalhe] = React.useState("");

  // Próxima ação. É uma Task real do produto, não uma string no cartão.
  const [titulo, setTitulo] = React.useState("");
  const [venceEm, setVenceEm] = React.useState("");
  const [prioridade, setPrioridade] = React.useState<"baixa" | "media" | "alta">("media");

  React.useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aoFechar]);

  const exigeRetomada =
    MOTIVOS_NUTRICAO.find((m) => m.chave === motivoNutrir)?.exigeRetomada ?? false;

  const faltando: string[] =
    saida === "qualificar"
      ? [
          !interesses.length && "interesse",
          !dor.trim() && "dor principal",
          !fit && "fit",
        ].filter(Boolean) as string[]
      : saida === "nutrir"
        ? ([!motivoNutrir && "motivo", exigeRetomada && !retomarEm && "data de retomada"].filter(Boolean) as string[])
        : saida === "desqualificar"
          ? ([!motivoDesq && "motivo"].filter(Boolean) as string[])
          : ([!titulo.trim() && "título"].filter(Boolean) as string[]);

  const gravar = async () => {
    if (faltando.length) {
      setCobrado(true);
      return;
    }
    setGravando(true);
    try {
      if (saida === "qualificar") {
        /* `icp` guarda o fit.
         *
         * `Qualificacao` não tem campo de fit, e `icp` está declarado no
         * domínio e não é lido nem escrito em lugar nenhum — o fit É o encaixe
         * com o ICP, então o campo já tinha o significado certo e só faltava
         * quem o usasse. Inventar um campo novo para o mesmo conceito seria a
         * segunda fonte de verdade que este módulo existe para evitar. */
        const q: Qualificacao = {
          servicosInteresse: interesses,
          quantidade: porte,
          dor: dor.trim(),
          icp: fit ?? undefined,
        };
        const r = await acoes.qualificar(lead.id, q);
        toast(r.ok ? `${lead.empresa} qualificada` : r.erro ?? "Não deu para qualificar");
        if (!r.ok) return;
      } else if (saida === "nutrir") {
        const r = await acoes.nutrir(lead.id, motivoNutrir!, retomarEm || null, observacao.trim() || null);
        toast(r.ok ? `${lead.empresa} foi para nutrição` : r.erro ?? "Não deu para nutrir");
        if (!r.ok) return;
      } else if (saida === "desqualificar") {
        const r = await acoes.desqualificar(lead.id, motivoDesq!, detalhe.trim() || null);
        toast(r.ok ? `${lead.empresa} desqualificada` : r.erro ?? "Não deu para desqualificar");
        if (!r.ok) return;
      } else {
        const r = await acoes.criarTarefa({
          leadId: lead.id,
          titulo: titulo.trim(),
          responsavelId: null,
          venceEm: venceEm || null,
          prioridade,
          descricao: detalhe.trim() || null,
        });
        toast(r.ok ? "Próxima ação definida" : r.erro ?? "Não deu para criar a atividade");
        if (!r.ok) return;
      }
      aoConcluir();
      aoFechar();
    } finally {
      setGravando(false);
    }
  };

  const cabecalho = {
    qualificar: {
      tom: "ok" as const,
      titulo: "Qualificar lead",
      subtitulo: "Qualificar grava um fato que sobrevive à etapa seguinte. Preencher campos não qualifica.",
      icone: D.check,
      botao: "Qualificar",
    },
    nutrir: {
      tom: "espera" as const,
      titulo: "Mandar para nutrição",
      subtitulo: "Nutrição não é lixeira elegante: ela pede motivo e a data em que este lead volta.",
      icone: D.relogio,
      botao: "Nutrir",
    },
    desqualificar: {
      tom: "erro" as const,
      titulo: "Desqualificar lead",
      subtitulo: "O motivo é o que sustenta relatório de perda depois. Sem ele, a saída não diz nada.",
      icone: D.x,
      botao: "Desqualificar",
    },
    atividade: {
      tom: "neutro" as const,
      titulo: "Próxima ação",
      subtitulo: "A próxima ação é uma tarefa de verdade, com dono e prazo — não um lembrete escrito no cartão.",
      icone: D.mais,
      botao: "Definir",
    },
  }[saida];

  return (
    <div className="sl-veu" onClick={aoFechar} role="presentation">
      <div
        className="sl"
        role="dialog"
        aria-modal="true"
        aria-label={cabecalho.titulo}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sl-topo">
          <div className="sl-topo-linha">
            <span className="sl-marca" data-tom={cabecalho.tom}>
              <Icone d={cabecalho.icone} />
            </span>
            <div className="sl-topo-texto">
              <h2>{cabecalho.titulo}</h2>
              <p>{cabecalho.subtitulo}</p>
            </div>
            <button className="sl-fechar" onClick={aoFechar} aria-label="Fechar">
              <Icone d={D.x} />
            </button>
          </div>

          <div className="sl-lead">
            <span className="sl-lead-avatar">{lead.iniciais}</span>
            <span className="sl-lead-texto">
              <span className="sl-lead-empresa">{lead.empresa}</span>
              <span className="sl-lead-pessoa">
                {[lead.pessoa, lead.cargo].filter(Boolean).join(" · ") || "Sem contato"}
              </span>
            </span>
            {lead.origem && <span className="sl-lead-canal">{lead.origem}</span>}
          </div>
        </header>

        <div className="sl-corpo">
          {saida === "qualificar" && (
            <>
              <section>
                <div className="sl-rotulo">
                  <span>INTERESSE</span>
                  <em>*</em>
                  <span className="sl-espaco" />
                  <small>{interesses.length ? `${interesses.length} escolhido${interesses.length > 1 ? "s" : ""}` : "nenhum"}</small>
                </div>
                <div className="sl-chips">
                  {INTERESSES.map((i) => {
                    const on = interesses.includes(i);
                    return (
                      <button
                        key={i}
                        type="button"
                        className="sl-chip"
                        data-on={on}
                        onClick={() =>
                          setInteresses((s) => (on ? s.filter((x) => x !== i) : [...s, i]))
                        }
                      >
                        {on && <Icone d={D.check} className="sl-chip-check" />}
                        <span>{i}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <div className="sl-rotulo">
                  <span>TAMANHO DA OPERAÇÃO</span>
                  <em>*</em>
                  <span className="sl-espaco" />
                  <span className="sl-faixa">{faixaDe(porte)}</span>
                </div>
                <div className="sl-stepper">
                  <button type="button" onClick={() => setPorte((n) => Math.max(1, n - 5))} title="Diminuir">
                    <Icone d={D.menos} />
                  </button>
                  <input
                    value={porte}
                    inputMode="numeric"
                    onChange={(e) => {
                      const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
                      setPorte(Number.isFinite(n) ? Math.max(1, n) : 1);
                    }}
                    aria-label="Atendentes"
                  />
                  <span className="sl-stepper-unidade">atendentes</span>
                  <button type="button" onClick={() => setPorte((n) => n + 5)} title="Aumentar">
                    <Icone d={D.mais} />
                  </button>
                </div>
                <div className="sl-rapidos">
                  {PORTES_RAPIDOS.map((n) => (
                    <button key={n} type="button" data-on={porte === n} onClick={() => setPorte(n)}>
                      {n}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <div className="sl-rotulo">
                  <span>DOR PRINCIPAL</span>
                  <em>*</em>
                </div>
                <input
                  className="sl-campo"
                  data-falta={cobrado && !dor.trim()}
                  value={dor}
                  onChange={(e) => setDor(e.target.value)}
                  placeholder="Ex.: alto custo com telefonia"
                />
                {cobrado && !dor.trim() && (
                  <p className="sl-cobranca">
                    <Icone d={D.alerta} />
                    Escolha uma sugestão abaixo ou escreva a dor
                  </p>
                )}
                <div className="sl-rapidos">
                  {DORES_RAPIDAS.map((d) => (
                    <button key={d} type="button" data-on={dor === d} onClick={() => setDor(d)}>
                      {d}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <div className="sl-rotulo">
                  <span>FIT</span>
                  <em>*</em>
                </div>
                <div className="sl-fits">
                  {FITS.map((f) => (
                    <button key={f} type="button" data-on={fit === f} onClick={() => setFit(f)}>
                      {f}
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}

          {saida === "nutrir" && (
            <>
              <section>
                <div className="sl-rotulo">
                  <span>MOTIVO</span>
                  <em>*</em>
                </div>
                <div className="sl-motivos">
                  {MOTIVOS_NUTRICAO.map((m) => (
                    <button
                      key={m.chave}
                      type="button"
                      data-on={motivoNutrir === m.chave}
                      onClick={() => setMotivoNutrir(m.chave)}
                    >
                      {m.rotulo}
                    </button>
                  ))}
                </div>
              </section>

              {/* A data só aparece quando o motivo a exige. Campo obrigatório que
                  aparece sempre vira campo ignorado. */}
              {exigeRetomada && (
                <section>
                  <div className="sl-rotulo">
                    <span>RETOMAR EM</span>
                    <em>*</em>
                  </div>
                  <input
                    type="date"
                    className="sl-campo"
                    data-falta={cobrado && !retomarEm}
                    value={retomarEm}
                    onChange={(e) => setRetomarEm(e.target.value)}
                  />
                </section>
              )}

              <section>
                <div className="sl-rotulo">
                  <span>OBSERVAÇÃO</span>
                </div>
                <input
                  className="sl-campo"
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="O que faz este lead voltar"
                />
              </section>
            </>
          )}

          {saida === "atividade" && (
            <>
              <section>
                <div className="sl-rotulo">
                  <span>O QUE FAZER</span>
                  <em>*</em>
                </div>
                <input
                  className="sl-campo"
                  data-falta={cobrado && !titulo.trim()}
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ex.: ligar para confirmar o volume de ramais"
                />
                <div className="sl-rapidos">
                  {ATIVIDADES_RAPIDAS.map((t) => (
                    <button key={t} type="button" data-on={titulo === t} onClick={() => setTitulo(t)}>
                      {t}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <div className="sl-rotulo">
                  <span>QUANDO</span>
                </div>
                <input
                  type="date"
                  className="sl-campo"
                  value={venceEm}
                  onChange={(e) => setVenceEm(e.target.value)}
                />
              </section>

              <section>
                <div className="sl-rotulo">
                  <span>PRIORIDADE</span>
                </div>
                <div className="sl-fits">
                  {(["baixa", "media", "alta"] as const).map((pr) => (
                    <button key={pr} type="button" data-on={prioridade === pr} onClick={() => setPrioridade(pr)}>
                      {pr === "media" ? "Média" : pr === "baixa" ? "Baixa" : "Alta"}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <div className="sl-rotulo">
                  <span>DETALHE</span>
                </div>
                <input
                  className="sl-campo"
                  value={detalhe}
                  onChange={(e) => setDetalhe(e.target.value)}
                  placeholder="O que precisa estar em mãos"
                />
              </section>
            </>
          )}

          {saida === "desqualificar" && (
            <>
              <section>
                <div className="sl-rotulo">
                  <span>MOTIVO</span>
                  <em>*</em>
                </div>
                <div className="sl-motivos">
                  {MOTIVOS_DESQUALIFICACAO.map((m) => (
                    <button
                      key={m.chave}
                      type="button"
                      data-on={motivoDesq === m.chave}
                      onClick={() => setMotivoDesq(m.chave)}
                    >
                      {m.rotulo}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <div className="sl-rotulo">
                  <span>DETALHE</span>
                </div>
                <input
                  className="sl-campo"
                  value={detalhe}
                  onChange={(e) => setDetalhe(e.target.value)}
                  placeholder="O que exatamente não encaixou"
                />
              </section>
            </>
          )}
        </div>

        <footer className="sl-rodape">
          {/* O que falta fica escrito, e não escondido atrás de um botão cinza:
              botão desabilitado sem motivo é a pessoa clicando e não entendendo. */}
          <span className="sl-status" data-falta={faltando.length > 0}>
            {faltando.length ? `Falta ${faltando.join(", ")}` : "Pronto para gravar"}
          </span>
          <button type="button" className="sl-cancelar" onClick={aoFechar}>
            Cancelar
          </button>
          <button
            type="button"
            className="sl-confirmar"
            data-tom={cabecalho.tom}
            onClick={gravar}
            disabled={gravando}
          >
            {gravando ? "Gravando…" : cabecalho.botao}
          </button>
        </footer>
      </div>
    </div>
  );
}
