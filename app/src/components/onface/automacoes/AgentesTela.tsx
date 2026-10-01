"use client";

/* Automação → Agentes (NEXO / Agentes IA) na linguagem ONFACE.
 *
 * Substitui o `Cf2AgentesWorkspace` mantendo o que ele fazia (lista dos agentes
 * reais, criar agente em rascunho e abrir o detalhe) e acrescentando o que a
 * tela antiga escondia: se o agente CONSEGUE rodar (prontidão), se há provedor
 * conectado e o que os agentes fizeram de fato (execuções).
 *
 * Nada aqui chama modelo. A única escrita é criar o agente, pela mesma rota
 * Hono de antes (POST /api/automacoes/agentes, exige ai.configure). Testar e
 * publicar continuam no detalhe, onde o gate de prontidão já mora. */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, ChevronRight, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { AGENT_PRESETS, AGENT_PURPOSES, DEFAULT_HANDOFF_CONFIG, type AgentToolCategory } from "@/lib/ai/agent-studio";
import type { DadosTelaAgentes, AgenteDaTela } from "@/lib/automacoes/agentes-tela";
import "./agentes.css";

const num = (n: number) => n.toLocaleString("pt-BR");
const STATUS: Record<string, string> = { draft: "Rascunho", published: "Publicado", paused: "Pausado", archived: "Arquivado" };
const RUN_STATUS: Record<string, string> = { completed: "Concluída", failed: "Falhou", running: "Rodando", queued: "Na fila", pending: "Pendente", handed_off: "Passou para humano", aborted: "Abortada (orçamento)" };
const MODO: Record<string, string> = { live: "Produção", test: "Teste", dry_run: "Simulação" };
const PROVIDER: Record<string, string> = { claude_subscription: "Claude Subscription", anthropic: "Anthropic", openai: "OpenAI", groq: "Groq", google: "Google" };

// Fuso fixo: o SSR roda em UTC em produção e o navegador em BRT; sem isto
// o horário diverge e a hidratação acusa mismatch.
const TZ = "America/Sao_Paulo";

function quando(iso: string | null) {
  if (!iso) return "—";
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
  if (dias === 1) return "ontem";
  if (dias < 30) return `há ${dias} dias`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: TZ });
}

function slugify(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);
}

/** Prontidão em uma palavra + a lista completa no title. "Pronto" só quando a
 * mesma verificação do publish não acusa nada. */
function SeloProntidao({ a }: { a: AgenteDaTela }) {
  if (a.versao == null) return <span className="agn-selo"><i />Sem versão</span>;
  if (a.faltas.length === 0) return <span className="agn-selo" data-tom="ok"><i />Pronto</span>;
  const credencial = a.faltas.find((f) => f.campo === "credencial");
  const texto = credencial ? "Sem credencial" : a.faltas.length === 1 ? `Falta ${a.faltas[0].campo}` : `Faltam ${a.faltas.length} itens`;
  return (
    <span className="agn-selo" data-tom="alerta" title={a.faltas.map((f) => `${f.mensagem}: ${f.comoResolver}`).join("\n")}>
      <i />{texto}
    </span>
  );
}

function NovoAgente({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [nome, setNome] = React.useState("");
  const [descricao, setDescricao] = React.useState("");
  const [finalidade, setFinalidade] = React.useState<string>(AGENT_PURPOSES[0].id);
  const [enviando, setEnviando] = React.useState(false);
  const preset = AGENT_PRESETS[finalidade] ?? AGENT_PRESETS.atendimento;

  React.useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  // Mesmo payload do workspace anterior: o agente nasce em rascunho, sem
  // provider/modelo, com as capacidades e o gatilho do preset do papel.
  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || enviando) return;
    setEnviando(true);
    try {
      const r = await fetch("/api/automacoes/agentes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(), slug: `${slugify(nome)}-${Date.now().toString(36)}`,
          descricao: descricao.trim() || null, finalidade, prioridade: 100,
          versao: {
            systemPrompt: preset.prompt, provider: null, modelo: null, tools: preset.tools,
            triggerConfig: { events: preset.events, filters: { ignoreGroups: true, ignoreSelf: true, keywordRegex: null, businessHours: null }, concurrency: "one_per_conversation" },
            handoffConfig: DEFAULT_HANDOFF_CONFIG, knowledgeConfig: { sources: [] },
            maxSteps: 8, tokenBudget: 4000, costBudget: null,
          },
        }),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(json?.error || json?.message || "Não foi possível criar o agente");
      toast.success("Agente criado como rascunho.");
      router.push(`/automacoes/agentes/${json.agent.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível criar o agente");
      setEnviando(false);
    }
  }

  return (
    <div className="agn-veu" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="agn-modal" role="dialog" aria-modal="true" aria-labelledby="agn-novo-titulo" onSubmit={criar}>
        <header>
          <div>
            <h2 id="agn-novo-titulo">Novo agente</h2>
            <p>Nasce em rascunho e não executa nada até ser publicado.</p>
          </div>
          <button type="button" className="agn-fechar" onClick={onClose} aria-label="Fechar"><X size={15} /></button>
        </header>
        <div className="agn-form">
          <label>Nome<input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Agente Outbound" maxLength={120} autoFocus required /></label>
          <div className="agn-modelos" role="radiogroup" aria-label="Começar a partir de um modelo">
            <span className="agn-modelos-titulo">Começar a partir de um modelo</span>
            {AGENT_PURPOSES.map((p) => {
              const base = AGENT_PRESETS[p.id] ?? AGENT_PRESETS.atendimento;
              return (
                <button key={p.id} type="button" role="radio" aria-checked={finalidade === p.id} className="agn-modelo" onClick={() => setFinalidade(p.id)}>
                  <strong>{p.nome}</strong>
                  <span>{p.descricao}</span>
                  <em>{base.tools.length} ações · {base.events.length} {base.events.length === 1 ? "gatilho" : "gatilhos"}</em>
                </button>
              );
            })}
          </div>
          <label>Descrição<textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="O que ele resolve e onde deve parar." maxLength={500} rows={2} /></label>
          <div className="agn-preset">
            <strong>Instruções iniciais de {AGENT_PURPOSES.find((p) => p.id === finalidade)?.nome}</strong>
            {preset.prompt}
            <span className="agn-fraco" style={{ marginTop: 6, whiteSpace: "normal" }}>Tudo editável depois: escopo, ações, gatilhos, modelo e modo de atendimento.</span>
          </div>
        </div>
        <footer>
          <button type="button" className="agn-secundario" onClick={onClose}>Cancelar</button>
          <button type="submit" className="agn-primario" disabled={!nome.trim() || enviando}>{enviando ? "Criando…" : "Criar agente"}</button>
        </footer>
      </form>
    </div>
  );
}

const MODO_ATENDIMENTO: Record<string, string> = { suggest: "Copiloto", approval: "Com aprovação", autonomous: "Autônomo" };
const CATEGORIA: { id: AgentToolCategory; nome: string }[] = [
  { id: "contexto", nome: "Contexto" }, { id: "comunicacao", nome: "Comunicação" }, { id: "crm", nome: "CRM" }, { id: "operacao", nome: "Operação" },
];

/** Card do agente (benchmark §3): estado, provedor · modelo, capacidades por
 * categoria, modo e uso real. Tudo vem da versão em trabalho e de ai_agent_runs. */
function CardAgente({ a }: { a: AgenteDaTela }) {
  const noAr = a.status === "published";
  return (
    <Link href={`/automacoes/agentes/${a.id}`} className="agn-card" data-ativo={noAr ? "true" : undefined}>
      <div className="agn-card-topo">
        <span className="agn-avatar" data-ativo={noAr ? "true" : undefined}><Bot size={16} /></span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span className="agn-card-nome">{a.nome}</span>
          <span className="agn-fraco">{a.papel} · {MODO_ATENDIMENTO[a.modo] ?? "Copiloto"}</span>
        </span>
        <span className="agn-selo" data-tom={noAr ? "ok" : undefined}><i />{noAr && a.versaoPublicada ? `v${a.versaoPublicada} no ar` : STATUS[a.status] ?? a.status}</span>
      </div>
      <p className="agn-card-desc">{a.descricao || "Sem descrição. Abra o agente e diga o que ele resolve e onde deve parar."}</p>
      <div className="agn-card-modelo">
        <span className="agn-mono">{a.provider ? PROVIDER[a.provider] ?? a.provider : "Sem provedor"}{a.modelo ? ` · ${a.modelo}` : ""}</span>
      </div>
      <div className="agn-card-chips">
        {a.capacidades === 0 ? (
          <span className="agn-chip" data-vazio="true">{a.legadas ? `${a.legadas} ações em formato antigo: abra e salve para valerem` : "Nenhuma ação ligada"}</span>
        ) : CATEGORIA.filter((c) => a.categorias[c.id]).map((c) => (
          <span key={c.id} className="agn-chip">{c.nome}<b>{a.categorias[c.id]}</b></span>
        ))}
      </div>
      <div className="agn-card-pe">
        <SeloProntidao a={a} />
        <span className="agn-card-uso">
          <span className="agn-num">{num(a.execucoes)}</span>
          <span>{a.execucoes === 1 ? "execução" : "execuções"}{a.ultimaExecucao ? ` · ${quando(a.ultimaExecucao)}` : ""}</span>
          <ChevronRight size={14} />
        </span>
      </div>
    </Link>
  );
}

export function AgentesTela({ dados, podeConfigurar }: { dados: DadosTelaAgentes; podeConfigurar: boolean }) {
  const [busca, setBusca] = React.useState("");
  const [recorte, setRecorte] = React.useState<"todos" | "published" | "draft">("todos");
  const [criando, setCriando] = React.useState(false);

  const { agentes, execucoes, serie, totais30d, provedores } = dados;
  const publicados = agentes.filter((a) => a.status === "published").length;
  const conectados = provedores.filter((p) => p.ambiente || p.organizacao.length > 0);
  const maxDia = Math.max(1, ...serie.map((s) => s.total));

  const q = busca.trim().toLowerCase();
  const lista = agentes.filter((a) =>
    (recorte === "todos" || a.status === recorte) &&
    (!q || `${a.nome} ${a.descricao ?? ""} ${a.papel} ${a.modelo ?? ""}`.toLowerCase().includes(q)));

  return (
    <div className="agn-tela">
      <section className="agn-hero" aria-label="Resumo dos agentes">
        <span className="agn-hero-brilho" />
        <div>
          <span className="agn-rotulo">Agentes publicados</span>
          <span className="agn-numero">{publicados}<small>de {agentes.length}</small></span>
          <span className="agn-sub">
            {publicados === 0
              ? "Nenhum agente atende contatos hoje. Rascunhos não respondem ninguém."
              : `${publicados} ${publicados === 1 ? "agente responde" : "agentes respondem"} pelos gatilhos configurados.`}
          </span>
          {/* Só o booleano: se existe chave no ambiente ou credencial da
              organização. Valor e final da chave nunca chegam ao navegador. */}
          <span className="agn-runtime" data-ok={conectados.length > 0 ? "true" : "false"}>
            <i />
            {conectados.length > 0
              ? `Provedor conectado: ${conectados.map((p) => p.nome).join(", ")}`
              : "Nenhum provedor de IA conectado"}
          </span>
        </div>

        <div className="agn-grafico">
          <div className="agn-grafico-topo">
            <span className="agn-rotulo">Execuções por dia</span>
            <span>últimos 30 dias</span>
          </div>
          <div className="agn-barras" role="img" aria-label={`${totais30d.execucoes} execuções nos últimos 30 dias`}>
            {serie.map((s) => (
              <span
                key={s.dia}
                className="agn-barra"
                data-vazio={s.total === 0 ? "true" : undefined}
                style={{ height: `${Math.max(4, (s.total / maxDia) * 100)}%` }}
                title={`${new Date(`${s.dia}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}: ${s.total} execuções${s.falhas ? `, ${s.falhas} com falha` : ""}`}
              />
            ))}
            {totais30d.execucoes === 0 ? (
              <span className="agn-barras-vazio">Nenhuma execução registrada nos últimos 30 dias.</span>
            ) : null}
          </div>
          <div className="agn-eixo">
            <span>{new Date(`${serie[0].dia}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>
            <span>hoje</span>
          </div>
        </div>

        <div className="agn-kpis">
          <div className="agn-kpi"><span>Execuções · 30d</span><strong>{num(totais30d.execucoes)}</strong></div>
          <div className="agn-kpi" data-alerta={totais30d.falhas > 0 ? "true" : undefined}><span>Falhas · 30d</span><strong>{num(totais30d.falhas)}</strong></div>
          <div className="agn-kpi"><span>Passou para humano</span><strong>{num(totais30d.handoffs)}</strong></div>
          <div className="agn-kpi"><span>Tokens · 30d</span><strong>{num(totais30d.tokens)}</strong></div>
        </div>
      </section>

      <div className="agn-provedores" aria-label="Provedores de IA">
        <span>Provedores</span>
        {provedores.map((p) => {
          const ok = p.ambiente || p.organizacao.length > 0;
          const origem = p.organizacao.length > 0 ? `credencial da organização: ${p.organizacao.join(", ")}` : p.ambiente ? "configurado no ambiente" : "sem credencial";
          return <span key={p.id} className="agn-prov" data-ok={ok ? "true" : undefined} title={origem}><i />{p.nome}</span>;
        })}
      </div>

      <div className="agn-toolbar">
        <div className="agn-busca">
          <Search size={14} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Agente, papel ou modelo" aria-label="Buscar agente" />
        </div>
        <div className="agn-segmento" role="group" aria-label="Filtrar por status">
          {([["todos", "Todos"], ["published", "Publicados"], ["draft", "Rascunhos"]] as const).map(([id, rotulo]) => (
            <button key={id} type="button" aria-pressed={recorte === id} onClick={() => setRecorte(id)}>{rotulo}</button>
          ))}
        </div>
        <span style={{ flex: 1, minWidth: 8 }} />
        {/* Sem ai.configure a API devolve 403: o botão fica visível, desligado
            e dizendo por quê, em vez de abrir um formulário que vai falhar. */}
        {!podeConfigurar ? <span className="agn-motivo">Criar agente exige a permissão de configurar IA</span> : null}
        <button type="button" className="agn-primario" disabled={!podeConfigurar} onClick={() => setCriando(true)}>
          <Plus size={14} strokeWidth={2.3} /> Novo agente
        </button>
      </div>

      <div className="agn-colunas">
        <section className="agn-cartao" aria-labelledby="agn-lista-titulo">
          <div className="agn-cartao-topo">
            <h2 id="agn-lista-titulo">Agentes</h2>
            <span>{lista.length === agentes.length ? `${agentes.length} configurados` : `${lista.length} de ${agentes.length}`}</span>
          </div>
          {lista.length === 0 ? (
            <div className="agn-vazio">
              <strong>{agentes.length === 0 ? "Nenhum agente configurado" : "Nenhum agente neste recorte"}</strong>
              <span>{agentes.length === 0 ? "Crie o primeiro agente a partir de um modelo. Ele nasce como rascunho e pode ser testado no Playground antes da publicação." : "Ajuste a busca ou o filtro de status."}</span>
              {agentes.length === 0 && podeConfigurar ? <button type="button" className="agn-primario" style={{ marginTop: 14 }} onClick={() => setCriando(true)}><Plus size={14} /> Novo agente</button> : null}
            </div>
          ) : (
            <div className="agn-cards">
              {lista.map((a) => <CardAgente key={a.id} a={a} />)}
            </div>
          )}
        </section>

        <section className="agn-cartao" aria-labelledby="agn-exec-titulo">
          <div className="agn-cartao-topo">
            <h2 id="agn-exec-titulo">Últimas execuções</h2>
            <Link href="/automacoes/execucoes" className="agn-fraco" style={{ color: "var(--of-coral-texto)", marginTop: 0 }}>Ver todas</Link>
          </div>
          {execucoes.length === 0 ? (
            <div className="agn-vazio">
              <strong>Nenhuma execução ainda</strong>
              <span>Testes no detalhe do agente e respostas a contatos aparecem aqui, com status, tokens e latência.</span>
            </div>
          ) : execucoes.map((e) => (
            <Link key={e.id} href={`/automacoes/agentes/${e.agenteId}`} className="agn-exec" style={{ textDecoration: "none", color: "inherit" }}>
              <span className="agn-forte">{e.agente}</span>
              <span className="agn-selo" data-tom={e.status === "completed" ? "ok" : e.status === "failed" || e.status === "aborted" ? "alerta" : undefined}><i />{RUN_STATUS[e.status] ?? e.status}</span>
              <span className="agn-exec-meta">
                <span>{MODO[e.modo] ?? e.modo}</span>
                <span>{num(e.tokens)} tokens</span>
                <span>{e.latenciaMs != null ? `${(e.latenciaMs / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s` : "—"}</span>
                <span>{quando(e.inicio)}</span>
              </span>
              {e.erro ? <span className="agn-exec-erro" title={e.erro}>{e.erro}</span> : e.handoff ? <span className="agn-exec-meta">Humano: {e.handoff}</span> : null}
            </Link>
          ))}
        </section>
      </div>

      {criando ? <NovoAgente onClose={() => setCriando(false)} /> : null}
    </div>
  );
}
