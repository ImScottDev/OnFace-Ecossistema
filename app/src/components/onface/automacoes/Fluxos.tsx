"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowRight, ChevronDown, Copy, Folder, History, MoreHorizontal, Plus, RefreshCw, Search, Trash2, Workflow, X,
} from "lucide-react";

import type { FluxoResumo, RegraAntiga } from "@/lib/automacoes/grafo";
import { GRUPOS_ROTINA, type RotinaAgendada, type GrupoRotina } from "@/lib/automacoes/rotinas";
import { PaginaCabecalho } from "@/components/onface/shell/Pagina";
import { AbasAutomacoes } from "./Abas";
import { STATUS_EXECUCAO, plural, quandoRelativo } from "./formato";
import { apiFluxos } from "./fluxos/api";
import { iconeDe } from "./fluxos/icones";
import { MODELOS } from "./fluxos/modelos";
import { NovoFluxo } from "./fluxos/NovoFluxo";
import "./automacoes.css";
import "./fluxos/fluxos.css";

/**
 * Automações → Fluxos: a lista do construtor (contrato
 * docs/produto/automacoes-fluxos.md §7.1).
 *
 * Cada linha é uma automação de `automacoes` com tipo 'fluxo': rascunho,
 * versão publicada e execuções vêm de GET /api/automacoes/fluxos. As regras
 * do motor antigo (gatilho → uma ação) aparecem só se existirem, com o botão
 * de migrar para fluxo. As rotinas do worker continuam no rodapé, recolhidas:
 * são código, não configuração.
 */

const SEM_PERMISSAO = "Sua função não tem a permissão automation.manage";
type FiltroPasta = { tipo: "todas" } | { tipo: "sem" } | { tipo: "pasta"; nome: string };

export function AutomacoesFluxos({ podeGerir, abrirNova, rotinas }: {
  podeGerir: boolean;
  abrirNova: boolean;
  rotinas: RotinaAgendada[];
}) {
  const qc = useQueryClient();
  const [novo, setNovo] = useState<{ modelo: string | null } | null>(null);
  const [busca, setBusca] = useState("");
  const [pasta, setPasta] = useState<FiltroPasta>({ tipo: "todas" });
  const [moverId, setMoverId] = useState<string | null>(null);

  // ?nova=1 vem do atalho da visão geral. Limpa a URL para o reload não reabrir.
  useEffect(() => {
    if (abrirNova && podeGerir) {
      setNovo({ modelo: null });
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [abrirNova, podeGerir]);

  const q = useQuery({ queryKey: ["fluxos"], queryFn: apiFluxos.listar });
  const fluxos = useMemo(() => q.data?.fluxos ?? [], [q.data]);
  const pastas = q.data?.pastas ?? [];
  const regras = q.data?.regrasAntigas ?? [];

  const invalidar = () => qc.invalidateQueries({ queryKey: ["fluxos"] });

  const alternar = useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) => apiFluxos.atualizar(id, { ativo }),
    onSuccess: (f) => { toast.success(f.ativo ? "Automação ativada" : "Automação desligada"); void invalidar(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const duplicar = useMutation({
    mutationFn: (id: string) => apiFluxos.duplicar(id),
    onSuccess: (f) => { toast.success(`“${f.nome}” criada desligada. Revise e publique quando quiser.`); void invalidar(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const excluir = useMutation({
    mutationFn: (id: string) => apiFluxos.excluir(id),
    onSuccess: () => { toast.success("Automação excluída"); void invalidar(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mover = useMutation({
    mutationFn: ({ id, pasta: p }: { id: string; pasta: string | null }) => apiFluxos.atualizar(id, { pasta: p }),
    onSuccess: (f) => { toast.success(f.pasta ? `Movida para “${f.pasta}”` : "Movida para Sem pasta"); setMoverId(null); void invalidar(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const migrar = useMutation({
    mutationFn: (id: string) => apiFluxos.migrarRegra(id),
    onSuccess: (f) => { toast.success(`Regra virou o fluxo “${f.nome}”, com o mesmo histórico.`); void invalidar(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const termo = busca.trim().toLowerCase();
  const visiveis = fluxos.filter((f) =>
    (!termo || f.nome.toLowerCase().includes(termo))
    && (pasta.tipo === "todas" || (pasta.tipo === "sem" ? !f.pasta : f.pasta === pasta.nome)));
  const ativas = fluxos.filter((f) => f.ativo).length;
  const erros = fluxos.reduce((s, f) => s + f.erros7d, 0);

  return (
    <div className="onface-pagina">
      <div className="oa-barra" style={{ marginBottom: 12 }}><AbasAutomacoes atual="/automacoes/fluxos" /></div>
      <PaginaCabecalho
        titulo="Fluxos"
        descricao="Trabalho que acontece sozinho, no horário ou quando algo muda."
        acoes={
          <>
            <Link href="/automacoes/execucoes?fonte=automacao" className="oa-btn oa-btn-secundario"><History size={14} /> Execuções</Link>
            <button type="button" className="oa-btn oa-btn-primario" onClick={() => setNovo({ modelo: null })} disabled={!podeGerir} title={podeGerir ? undefined : SEM_PERMISSAO}>
              <Plus size={14} strokeWidth={2.4} /> Criar automação
            </button>
          </>
        }
      />

      {!podeGerir && <p className="ofx-lista-aviso">Somente leitura: {SEM_PERMISSAO.toLowerCase()}.</p>}

      {q.isError ? (
        <div className="ofx-lista-erro">
          <AlertTriangle size={16} aria-hidden />
          <span><strong>Não foi possível carregar as automações.</strong> {(q.error as Error).message}</span>
          <button type="button" className="oa-btn oa-btn-secundario" onClick={() => q.refetch()}><RefreshCw size={13} /> Tentar de novo</button>
        </div>
      ) : q.isLoading ? (
        <ul className="ofx-tabela" aria-busy="true" aria-label="Carregando automações">
          {[0, 1, 2].map((i) => <li key={i} className="ofx-linha ofx-linha-esq"><span className="ofx-esq ofx-esq-linha" /><span className="ofx-esq ofx-esq-curto" /></li>)}
        </ul>
      ) : fluxos.length === 0 ? (
        <VazioFluxos podeGerir={podeGerir} aoCriar={(modelo) => setNovo({ modelo })} />
      ) : (
        <>
          <div className="ofx-lista-barra">
            <label className="ofx-paleta-busca ofx-lista-busca">
              <Search size={14} aria-hidden />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar automação pelo nome" aria-label="Buscar automação" />
              {busca && <button type="button" className="oa-icone" onClick={() => setBusca("")} aria-label="Limpar busca"><X size={13} /></button>}
            </label>
            {pastas.length > 0 && (
              <div className="ofx-chips" role="tablist" aria-label="Pastas">
                <button type="button" role="tab" aria-selected={pasta.tipo === "todas"} onClick={() => setPasta({ tipo: "todas" })}>Todas</button>
                <button type="button" role="tab" aria-selected={pasta.tipo === "sem"} onClick={() => setPasta({ tipo: "sem" })}>Sem pasta</button>
                {pastas.map((p) => (
                  <button key={p} type="button" role="tab" aria-selected={pasta.tipo === "pasta" && pasta.nome === p} onClick={() => setPasta({ tipo: "pasta", nome: p })}>
                    <Folder size={12} aria-hidden /> {p}
                  </button>
                ))}
              </div>
            )}
            <span className="oa-legenda ofx-lista-total">
              {plural(fluxos.length, "automação", "automações")} · {ativas} ativa{ativas === 1 ? "" : "s"}
              {erros > 0 && <> · <b className="ofx-texto-erro">{plural(erros, "erro", "erros")} em 7 dias</b></>}
            </span>
          </div>

          {visiveis.length === 0 ? (
            <div className="oa-vazio"><strong>Nada com esse filtro</strong><span>Limpe a busca ou escolha outra pasta.</span></div>
          ) : (
            <ul className="ofx-tabela">
              {visiveis.map((f) => (
                <LinhaFluxo key={f.id} f={f} podeGerir={podeGerir}
                  aoAlternar={(ativo) => alternar.mutate({ id: f.id, ativo })} alternando={alternar.isPending && alternar.variables?.id === f.id}
                  aoDuplicar={() => duplicar.mutate(f.id)}
                  aoMover={() => setMoverId(f.id)}
                  aoExcluir={() => { if (window.confirm(`Excluir “${f.nome}”? As versões e o histórico de execuções vão junto. Não dá para desfazer.`)) excluir.mutate(f.id); }}
                />
              ))}
            </ul>
          )}
        </>
      )}

      {regras.length > 0 && <RegrasAntigas regras={regras} podeGerir={podeGerir} migrando={migrar.isPending ? migrar.variables : null} aoMigrar={(id) => migrar.mutate(id)} />}

      <details className="ofx-rotinas">
        <summary><ChevronDown size={14} aria-hidden /> Rotinas do sistema <span className="oa-legenda">{rotinas.length}</span></summary>
        <p className="oa-dica">Definidas no código do worker, não configuráveis aqui. A tela mostra a frequência programada; a última execução não fica registrada no banco.</p>
        <div className="oa-rotinas">
          {(Object.keys(GRUPOS_ROTINA) as GrupoRotina[]).map((gr) => (
            <div key={gr}>
              <h3 className="oa-grupo-titulo">{GRUPOS_ROTINA[gr]}</h3>
              <ul className="oa-lista">
                {rotinas.filter((r) => r.grupo === gr).map((r) => (
                  <li key={r.chave} className="oa-item">
                    <span className="oa-item-corpo">
                      <span className="oa-item-titulo">{r.nome}</span>
                      <span className="oa-item-meta" title={r.oQueFaz}>{r.oQueFaz}</span>
                    </span>
                    <span className="oa-item-lado">{r.frequencia}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>

      {novo && <NovoFluxo modeloInicial={novo.modelo} aoFechar={() => setNovo(null)} />}
      {moverId && (
        <MoverPasta
          atual={fluxos.find((f) => f.id === moverId)?.pasta ?? null}
          pastas={pastas}
          salvando={mover.isPending}
          aoSalvar={(p) => mover.mutate({ id: moverId, pasta: p })}
          aoFechar={() => setMoverId(null)}
        />
      )}
    </div>
  );
}

function LinhaFluxo({ f, podeGerir, aoAlternar, alternando, aoDuplicar, aoMover, aoExcluir }: {
  f: FluxoResumo; podeGerir: boolean; aoAlternar: (ativo: boolean) => void; alternando: boolean;
  aoDuplicar: () => void; aoMover: () => void; aoExcluir: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const fora = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [menu]);
  const ult = f.ultimaExecucao;
  const st = ult ? STATUS_EXECUCAO[ult.status] ?? { l: ult.status, tom: "neutro" as const } : null;
  const href = `/automacoes/fluxos/${f.id}`;
  return (
    <li className="ofx-linha">
      <Link href={href} className="ofx-linha-nome">
        <strong>{f.nome}</strong>
        <span>{f.gatilhoResumo}{f.pasta ? <> · <Folder size={11} aria-hidden /> {f.pasta}</> : null}</span>
      </Link>
      <span className="ofx-linha-estado">
        <span className={`oa-selo ${f.estado === "ativa" ? "oa-ok" : f.estado === "rascunho" ? "oa-aviso" : ""}`}>
          {f.estado === "ativa" ? "Ativa" : f.estado === "publicada" ? "Publicada, desligada" : "Rascunho"}
        </span>
        {f.alteracoesNaoPublicadas && f.estado !== "rascunho" && <span className="oa-selo ofx-selo-alteracao">Alterações não publicadas</span>}
      </span>
      <span className="ofx-linha-exec">
        {ult && st ? <><span className={`oa-ponto oa-${st.tom}`} aria-hidden /><span title={new Date(ult.em).toLocaleString("pt-BR")}>{st.l} {quandoRelativo(ult.em)}</span></> : <span className="ofx-mudo">Nunca rodou</span>}
      </span>
      <span className="ofx-linha-num">
        {f.execucoes7d} em 7 dias{f.erros7d > 0 && <> · <b className="ofx-texto-erro">{f.erros7d} com erro</b></>}
      </span>
      <label className="ofx-interruptor" title={!podeGerir ? SEM_PERMISSAO : f.versaoPublicada === null ? "Publique primeiro" : f.ativo ? "Desligar" : "Ligar"}>
        <input type="checkbox" checked={f.ativo} disabled={!podeGerir || f.versaoPublicada === null || alternando} onChange={(e) => aoAlternar(e.target.checked)} aria-label={f.ativo ? `Desligar ${f.nome}` : `Ligar ${f.nome}`} />
        <span aria-hidden />
      </label>
      <div className="ofx-menu" ref={menuRef}>
        <button type="button" className="oa-icone" aria-label={`Mais ações de ${f.nome}`} aria-expanded={menu} onClick={() => setMenu((m) => !m)} disabled={!podeGerir} title={podeGerir ? "Mais ações" : SEM_PERMISSAO}>
          <MoreHorizontal size={16} />
        </button>
        {menu && (
          <div className="ofx-menu-pop" role="menu">
            <button type="button" role="menuitem" onClick={() => { setMenu(false); aoDuplicar(); }}><Copy size={13} /> Duplicar</button>
            <button type="button" role="menuitem" onClick={() => { setMenu(false); aoMover(); }}><Folder size={13} /> Mover para pasta</button>
            <button type="button" role="menuitem" className="ofx-menu-perigo" onClick={() => { setMenu(false); aoExcluir(); }}><Trash2 size={13} /> Excluir</button>
          </div>
        )}
      </div>
      <Link href={href} className="oa-icone" aria-label={`Abrir ${f.nome}`}><ArrowRight size={15} /></Link>
    </li>
  );
}

function VazioFluxos({ podeGerir, aoCriar }: { podeGerir: boolean; aoCriar: (modelo: string | null) => void }) {
  const destaque = MODELOS.filter((m) => ["boas-vindas", "negocio-parado", "proposta-visualizada"].includes(m.id));
  return (
    <section className="ofx-vazio" aria-labelledby="ofx-vazio-titulo">
      <span className="ofx-vazio-icone"><Workflow size={20} aria-hidden /></span>
      <h2 id="ofx-vazio-titulo">Nenhuma automação ainda</h2>
      <p>Uma automação começa com um gatilho (um lead novo, um horário marcado, uma proposta vista) e segue por blocos: espera, condição, WhatsApp, tarefa. Você monta no desenho, ensaia sem enviar nada e publica quando estiver certa.</p>
      <div className="ofx-vazio-modelos">
        {destaque.map((m) => {
          const Icone = iconeDe(m.icone);
          return (
            <button key={m.id} type="button" className="ofx-modelo" onClick={() => aoCriar(m.id)} disabled={!podeGerir} title={podeGerir ? undefined : SEM_PERMISSAO}>
              <span className="ofx-modelo-icone"><Icone size={16} strokeWidth={2.2} /></span>
              <span><strong>{m.nome}</strong><span>{m.descricao}</span></span>
            </button>
          );
        })}
      </div>
      <button type="button" className="oa-btn oa-btn-primario" onClick={() => aoCriar(null)} disabled={!podeGerir} title={podeGerir ? undefined : SEM_PERMISSAO}>
        <Plus size={14} strokeWidth={2.4} /> Criar a primeira
      </button>
    </section>
  );
}

function RegrasAntigas({ regras, podeGerir, migrando, aoMigrar }: { regras: RegraAntiga[]; podeGerir: boolean; migrando: string | null | undefined; aoMigrar: (id: string) => void }) {
  return (
    <section className="oa-secao ofx-regras" aria-labelledby="ofx-regras-titulo">
      <div className="oa-secao-topo">
        <h2 id="ofx-regras-titulo" className="oa-secao-titulo">Regras antigas ({regras.length})</h2>
      </div>
      <p className="oa-secao-sub">Regras do motor anterior (um gatilho, uma ação). Continuam rodando como estão. Migrar converte a regra num fluxo publicado, com o mesmo histórico.</p>
      <ul className="oa-lista">
        {regras.map((r) => (
          <li key={r.id} className="oa-item">
            <span className={`oa-ponto ${r.ativo ? "oa-ok" : "oa-neutro"}`} aria-hidden />
            <span className="oa-item-corpo">
              <span className="oa-item-titulo">{r.nome}</span>
              <span className="oa-item-meta">quando <span className="oa-mono">{r.gatilho}</span> · então <span className="oa-mono">{r.acao}</span>{!r.migravel && r.motivoNaoMigravel ? ` · ${r.motivoNaoMigravel}` : ""}</span>
            </span>
            {r.migravel ? (
              <button type="button" className="oa-btn oa-btn-secundario" disabled={!podeGerir || migrando === r.id} onClick={() => aoMigrar(r.id)} title={podeGerir ? undefined : SEM_PERMISSAO}>
                {migrando === r.id ? "Migrando…" : "Migrar para fluxo"}
              </button>
            ) : <span className="oa-selo">Não migra</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function MoverPasta({ atual, pastas, salvando, aoSalvar, aoFechar }: { atual: string | null; pastas: string[]; salvando: boolean; aoSalvar: (p: string | null) => void; aoFechar: () => void }) {
  const [valor, setValor] = useState(atual ?? "");
  const salvar = () => aoSalvar(valor.trim() || null);
  return (
    <div className="oa-veu" onMouseDown={aoFechar}>
      <div role="dialog" aria-modal="true" aria-labelledby="mover-titulo" className="oa-modal" style={{ maxWidth: 400 }} onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === "Escape") aoFechar(); }}>
        <div className="oa-modal-topo">
          <h2 id="mover-titulo" className="oa-modal-titulo">Mover para pasta</h2>
          <button type="button" className="oa-icone" aria-label="Fechar" onClick={aoFechar}><X size={16} /></button>
        </div>
        <label className="oa-campo">
          <span>Pasta</span>
          <input className="oa-input" autoFocus list="mover-pastas" value={valor} maxLength={60} placeholder="Nome da pasta (vazio = Sem pasta)"
            onChange={(e) => setValor(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") salvar(); }} />
          <datalist id="mover-pastas">{pastas.map((p) => <option key={p} value={p} />)}</datalist>
        </label>
        <div className="oa-modal-rodape">
          <button type="button" className="oa-btn oa-btn-secundario" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="oa-btn oa-btn-primario" disabled={salvando} onClick={salvar}>{salvando ? "Movendo…" : "Mover"}</button>
        </div>
      </div>
    </div>
  );
}
