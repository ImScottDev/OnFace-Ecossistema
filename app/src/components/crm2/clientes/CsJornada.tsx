"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronDown, Copy, Flag, Sparkles, TriangleAlert } from "lucide-react";
import { produtoParaExibir } from "@/lib/catalogo/rotulos";
import { Cf2Badge } from "@/components/crm2/ui/Badge";

/**
 * Régua de relacionamento + execução de checkpoint.
 *
 * A régua é permanente: 3/6/9/12 se repetem a cada ciclo. O 15º mês do
 * cliente é o "3M do ciclo 2" — por isso a régua mostra o rótulo do ciclo
 * (3M, 6M...) e não o mês absoluto, e o seletor deixa voltar aos anteriores.
 *
 * O checkpoint aberto NÃO é um formulário de conclusão: é o playbook em si —
 * script, perguntas, sinais a observar — para o analista executar a conversa
 * ali dentro e registrar o que ela produziu.
 */

export interface SinalPlaybook { rotulo: string; acao: "RISCO" | "EXPANSAO" | "TAREFA" }

export interface MarcoJornada {
  id: string;
  codigo: string;
  ciclo: number;
  titulo: string;
  objetivo: string | null;
  dueDate: string;
  status: "PENDENTE" | "CONCLUIDO" | "PULADO";
  resultado: Record<string, unknown> | null;
  concluidoEm: string | null;
  tarefaId: string | null;
  rotuloRegua: string;
  checklist: string[];
  perguntas: string[];
  script: string | null;
  sinais: SinalPlaybook[];
}

export interface CicloJornada {
  numero: number;
  inicio: string | null;
  fim: string | null;
  encerrado: boolean;
  marcos: MarcoJornada[];
}

export interface ServicoResumo { id: string; serviceFamily: string; canonicalProduct: string | null }

type EstadoMarco = "concluido" | "pulado" | "atual" | "atrasado" | "futuro";

function estadoDoMarco(m: MarcoJornada): EstadoMarco {
  if (m.status === "CONCLUIDO") return "concluido";
  if (m.status === "PULADO") return "pulado";
  const hoje = new Date().toISOString().slice(0, 10);
  if (m.dueDate < hoje) return "atrasado";
  // "Atual" é o próximo pendente — o que o CS deveria estar preparando.
  return "futuro";
}

const CORES: Record<EstadoMarco, { ponto: string; texto: string; rotulo: string }> = {
  concluido: { ponto: "var(--cf2-success-text)", texto: "var(--cf2-text-secondary)", rotulo: "concluído" },
  pulado:    { ponto: "var(--cf2-border-default)", texto: "var(--cf2-text-tertiary)", rotulo: "não se aplicou" },
  atrasado:  { ponto: "var(--cf2-danger-text)", texto: "var(--cf2-danger-text)", rotulo: "atrasado" },
  atual:     { ponto: "var(--cf2-accent)", texto: "var(--cf2-text-primary)", rotulo: "agora" },
  futuro:    { ponto: "var(--cf2-bg-surface-muted)", texto: "var(--cf2-text-tertiary)", rotulo: "previsto" },
};

function dataBr(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("pt-BR");
}

export function Cf2CsJornada({
  ciclos, cicloAtual, empresaNome, servicos, onMudou, marcoInicialId,
}: {
  ciclos: CicloJornada[];
  cicloAtual: number;
  empresaNome: string;
  servicos: ServicoResumo[];
  onMudou: () => void;
  /** Deep link real (10/09) — "Executar checkpoint" na fila de CS manda um
   * marco específico pra já abrir na régua, sem exigir procurar o card. */
  marcoInicialId?: string | null;
}) {
  const [cicloVisivel, setCicloVisivel] = useState<number>(cicloAtual || 1);
  const [marcoAberto, setMarcoAberto] = useState<string | null>(marcoInicialId ?? null);

  const ciclo = ciclos.find((c) => c.numero === cicloVisivel) ?? ciclos[ciclos.length - 1];
  const marcos = ciclo?.marcos ?? [];

  // O "atual" é o primeiro pendente não atrasado: o próximo compromisso real.
  const idAtual = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    return marcos.find((m) => m.status === "PENDENTE" && m.dueDate >= hoje)?.id ?? null;
  }, [marcos]);

  if (ciclos.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {ciclos.length > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {ciclos.map((c) => (
            <button
              key={c.numero}
              onClick={() => { setCicloVisivel(c.numero); setMarcoAberto(null); }}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
              style={{
                background: c.numero === cicloVisivel ? "var(--cf2-bg-inverse)" : "var(--cf2-bg-surface-muted)",
                color: c.numero === cicloVisivel ? "#fff" : "var(--cf2-text-secondary)",
              }}
            >
              Ciclo {c.numero}{c.encerrado ? " ✓" : ""}
            </button>
          ))}
        </div>
      )}

      {/* Régua. Horizontal com rolagem própria: em conta com 7 marcos ela não
          cabe em tela estreita, e quebrar a linha destrói a leitura de
          progressão. */}
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="flex items-start gap-0 min-w-max py-1">
          {marcos.map((m, i) => {
            const estado = m.id === idAtual ? "atual" : estadoDoMarco(m);
            const cor = CORES[estado];
            const aberto = marcoAberto === m.id;
            return (
              <div key={m.id} className="flex items-start">
                <button
                  onClick={() => setMarcoAberto(aberto ? null : m.id)}
                  className="flex flex-col items-center gap-1 px-3 min-w-[76px]"
                  title={m.titulo}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      background: estado === "concluido" ? "var(--cf2-success-bg)" : estado === "atrasado" ? "#fde8e8" : estado === "atual" ? "var(--cf2-accent)" : "var(--cf2-bg-surface-muted)",
                      border: aberto ? `2px solid ${cor.ponto}` : "2px solid transparent",
                    }}
                  >
                    {estado === "concluido"
                      ? <Check className="w-3.5 h-3.5" style={{ color: "var(--cf2-success-text)" }} />
                      : <Flag className="w-3.5 h-3.5" style={{ color: estado === "atual" ? "var(--cf2-text-on-accent)" : cor.ponto }} />}
                  </div>
                  <span className="text-[11px] font-bold" style={{ color: cor.texto }}>{m.rotuloRegua}</span>
                  <span className="text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>
                    {estado === "concluido" ? dataBr(m.concluidoEm) : dataBr(m.dueDate)}
                  </span>
                </button>
                {i < marcos.length - 1 && (
                  <div className="h-[2px] w-6 mt-3.5 rounded-full" style={{ background: "var(--cf2-border-default)" }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {marcoAberto && (() => {
        const m = marcos.find((x) => x.id === marcoAberto);
        if (!m) return null;
        return (
          <PainelCheckpoint
            marco={m}
            empresaNome={empresaNome}
            servicos={servicos}
            onFechar={() => setMarcoAberto(null)}
            onRegistrado={() => { setMarcoAberto(null); onMudou(); }}
          />
        );
      })()}
    </div>
  );
}

function Copiavel({ texto, rotulo }: { texto: string; rotulo: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 1800);
        } catch {
          toast.error("Não foi possível copiar — selecione o texto manualmente");
        }
      }}
      className="flex items-center gap-1 text-[10.5px] font-semibold shrink-0"
      style={{ color: copiado ? "var(--cf2-success-text)" : "var(--cf2-text-tertiary)" }}
    >
      <Copy className="w-3 h-3" /> {copiado ? "copiado" : rotulo}
    </button>
  );
}

/**
 * O checkpoint em si. Ordem deliberada: primeiro o que dizer (script),
 * depois o que perguntar, depois o que observar — e só no fim o que
 * registrar. É a sequência da conversa real, não a do formulário.
 */
function PainelCheckpoint({
  marco, empresaNome, servicos, onFechar, onRegistrado,
}: {
  marco: MarcoJornada; empresaNome: string; servicos: ServicoResumo[];
  onFechar: () => void; onRegistrado: () => void;
}) {
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [sinaisMarcados, setSinaisMarcados] = useState<string[]>([]);
  const [nota, setNota] = useState("");

  const [healthAberto, setHealthAberto] = useState(false);
  const [health, setHealth] = useState<Record<string, number | boolean | string>>({});

  const [riscoMotivo, setRiscoMotivo] = useState("");
  const [riscoSeveridade, setRiscoSeveridade] = useState<"ATENCAO" | "EM_RISCO" | "CRITICO">("EM_RISCO");
  const [expansaoTitulo, setExpansaoTitulo] = useState("");
  const [expansaoServico, setExpansaoServico] = useState("");
  const [proximaTitulo, setProximaTitulo] = useState("");
  const [proximaEm, setProximaEm] = useState(new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10));

  const concluido = marco.status !== "PENDENTE";
  const script = (marco.script ?? "").replace(/\{\{cliente\}\}/g, empresaNome).replace(/\{\{cs\}\}/g, "");

  // Marcar um sinal do playbook pré-preenche o campo correspondente — é o
  // caminho entre "observei isso" e "registrei isso" que normalmente se perde.
  const alternarSinal = (s: SinalPlaybook) => {
    const marcado = sinaisMarcados.includes(s.rotulo);
    setSinaisMarcados(marcado ? sinaisMarcados.filter((x) => x !== s.rotulo) : [...sinaisMarcados, s.rotulo]);
    if (marcado) return;
    if (s.acao === "RISCO" && !riscoMotivo) setRiscoMotivo(s.rotulo);
    if (s.acao === "EXPANSAO" && !expansaoTitulo) setExpansaoTitulo(s.rotulo);
    if (s.acao === "TAREFA" && !proximaTitulo) setProximaTitulo(s.rotulo);
  };

  const registrar = useMutation({
    mutationFn: async (pular: boolean) => {
      const healthLimpo = Object.fromEntries(Object.entries(health).filter(([, v]) => v !== "" && v !== undefined));
      const r = await fetch(`/api/cs/marcos/${marco.id}/concluir`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resultado: { checklist, respostas, sinaisObservados: sinaisMarcados, nota: nota.trim() || undefined },
          pular,
          healthCheck: Object.keys(healthLimpo).length > 0 ? healthLimpo : null,
          risco: riscoMotivo.trim() ? { severidade: riscoSeveridade, motivo: riscoMotivo.trim() } : null,
          expansao: expansaoTitulo.trim() ? { titulo: expansaoTitulo.trim(), tipo: "nova_familia", servicoOrigemId: expansaoServico || null } : null,
          proximaAcao: proximaTitulo.trim() ? { titulo: proximaTitulo.trim(), venceEm: new Date(`${proximaEm}T12:00:00`).toISOString() } : null,
        }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "Não foi possível registrar o checkpoint");
      return body as { cicloAberto: number | null; riscoId: string | null; negocioExpansaoId: string | null };
    },
    onSuccess: (d) => {
      const extras = [
        d.cicloAberto ? `ciclo ${d.cicloAberto} aberto` : null,
        d.riscoId ? "risco registrado" : null,
        d.negocioExpansaoId ? "expansão criada" : null,
      ].filter(Boolean);
      toast.success(`Checkpoint registrado${extras.length ? ` · ${extras.join(" · ")}` : ""}`);
      onRegistrado();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const campo = "w-full px-2.5 py-1.5 rounded-lg text-[12px] outline-none";
  const campoStyle = { background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" };

  return (
    <div className="rounded-xl p-4 flex flex-col gap-3.5" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{marco.titulo}</p>
            <Cf2Badge variant={marco.status === "CONCLUIDO" ? "success" : marco.status === "PULADO" ? "neutral" : "warning"}>
              {marco.status === "CONCLUIDO" ? `concluído ${dataBr(marco.concluidoEm)}` : marco.status === "PULADO" ? "não se aplicou" : `previsto ${dataBr(marco.dueDate)}`}
            </Cf2Badge>
            {marco.ciclo > 1 && <Cf2Badge variant="neutral">ciclo {marco.ciclo}</Cf2Badge>}
          </div>
          {marco.objetivo && <p className="text-[12px] mt-1" style={{ color: "var(--cf2-text-secondary)" }}>{marco.objetivo}</p>}
        </div>
        <button onClick={onFechar} className="text-[11px] font-semibold shrink-0" style={{ color: "var(--cf2-text-tertiary)" }}>fechar</button>
      </div>

      {concluido ? <ResultadoRegistrado marco={marco} /> : (
        <>
          {script && (
            <Bloco titulo="Como abrir a conversa" acao={<Copiavel texto={script} rotulo="copiar" />}>
              <p className="text-[12px] whitespace-pre-line" style={{ color: "var(--cf2-text-secondary)" }}>{script}</p>
            </Bloco>
          )}

          {marco.perguntas.length > 0 && (
            <Bloco titulo="Perguntas" acao={<Copiavel texto={marco.perguntas.map((p, i) => `${i + 1}. ${p}`).join("\n")} rotulo="copiar todas" />}>
              <div className="flex flex-col gap-2">
                {marco.perguntas.map((p) => (
                  <div key={p}>
                    <p className="text-[12px] font-medium mb-1" style={{ color: "var(--cf2-text-primary)" }}>{p}</p>
                    <input
                      value={respostas[p] ?? ""} onChange={(e) => setRespostas({ ...respostas, [p]: e.target.value })}
                      placeholder="resposta do cliente" aria-label="resposta do cliente" className={campo} style={campoStyle}
                    />
                  </div>
                ))}
              </div>
            </Bloco>
          )}

          {marco.sinais.length > 0 && (
            <Bloco titulo="Sinais a observar" subtitulo="Marcar já preenche o registro correspondente abaixo.">
              <div className="flex flex-wrap gap-1.5">
                {marco.sinais.map((s) => {
                  const ativo = sinaisMarcados.includes(s.rotulo);
                  return (
                    <button
                      key={s.rotulo} onClick={() => alternarSinal(s)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-left"
                      style={{
                        background: ativo ? (s.acao === "EXPANSAO" ? "var(--cf2-success-bg)" : "#fde8e8") : "var(--cf2-bg-surface)",
                        color: ativo ? (s.acao === "EXPANSAO" ? "var(--cf2-success-text)" : "var(--cf2-danger-text)") : "var(--cf2-text-secondary)",
                        border: "1px solid var(--cf2-border-default)",
                      }}
                    >
                      {s.acao === "EXPANSAO" ? <Sparkles className="w-3 h-3 shrink-0" /> : <TriangleAlert className="w-3 h-3 shrink-0" />}
                      {s.rotulo}
                    </button>
                  );
                })}
              </div>
            </Bloco>
          )}

          {marco.checklist.length > 0 && (
            <Bloco titulo="Checklist">
              <div className="flex flex-col gap-1">
                {marco.checklist.map((item) => (
                  <label key={item} className="flex items-center gap-2 text-[12px] cursor-pointer" style={{ color: "var(--cf2-text-secondary)" }}>
                    <input type="checkbox" checked={!!checklist[item]} onChange={(e) => setChecklist({ ...checklist, [item]: e.target.checked })} />
                    {item}
                  </label>
                ))}
              </div>
            </Bloco>
          )}

          <Bloco
            titulo="Health check"
            subtitulo="Opcional — a percepção declarada pelo cliente. Não substitui os sinais de cobrança e entrega."
            acao={<button onClick={() => setHealthAberto(!healthAberto)} className="text-[10.5px] font-semibold" style={{ color: "var(--cf2-text-tertiary)" }}>
              <ChevronDown className="w-3 h-3 inline" style={{ transform: healthAberto ? "rotate(180deg)" : undefined }} /> {healthAberto ? "recolher" : "colher agora"}
            </button>}
          >
            {healthAberto && <FormularioHealthCheck valores={health} onChange={setHealth} />}
          </Bloco>

          <Bloco titulo="O que fica registrado">
            <textarea
              value={nota} onChange={(e) => setNota(e.target.value)} rows={3}
              placeholder="O resumo da conversa, com as palavras do cliente quando possível."
              className={campo + " resize-y"} style={campoStyle}
            />

            <div className="grid md:grid-cols-2 gap-2 mt-2">
              <div>
                <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--cf2-danger-text)" }}>Risco identificado</label>
                <input value={riscoMotivo} onChange={(e) => setRiscoMotivo(e.target.value)} placeholder="deixe vazio se não houver" aria-label="deixe vazio se não houver" className={campo} style={campoStyle} />
                {riscoMotivo.trim() && (
                  <select value={riscoSeveridade} onChange={(e) => setRiscoSeveridade(e.target.value as typeof riscoSeveridade)} className={campo + " mt-1"} style={campoStyle}>
                    <option value="ATENCAO">Atenção</option><option value="EM_RISCO">Em risco</option><option value="CRITICO">Crítico</option>
                  </select>
                )}
              </div>
              <div>
                <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--cf2-success-text)" }}>Expansão identificada</label>
                <input value={expansaoTitulo} onChange={(e) => setExpansaoTitulo(e.target.value)} placeholder="deixe vazio se não houver" aria-label="deixe vazio se não houver" className={campo} style={campoStyle} />
                {expansaoTitulo.trim() && servicos.length > 0 && (
                  <select value={expansaoServico} onChange={(e) => setExpansaoServico(e.target.value)} className={campo + " mt-1"} style={campoStyle}>
                    <option value="">Serviço de origem</option>
                    {servicos.map((s) => <option key={s.id} value={s.id}>{produtoParaExibir({ produto: s.canonicalProduct }).nome ?? "Produto não identificado"}</option>)}
                  </select>
                )}
              </div>
            </div>

            <div className="grid grid-cols-[1fr_auto] gap-2 mt-2">
              <div>
                <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--cf2-text-secondary)" }}>Próxima ação</label>
                <input value={proximaTitulo} onChange={(e) => setProximaTitulo(e.target.value)} placeholder="o que você faz depois desta conversa" aria-label="o que você faz depois desta conversa" className={campo} style={campoStyle} />
              </div>
              <div>
                <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--cf2-text-secondary)" }}>Quando</label>
                <input type="date" value={proximaEm} onChange={(e) => setProximaEm(e.target.value)} className={campo} style={campoStyle} />
              </div>
            </div>
          </Bloco>

          <div className="flex gap-2">
            <button
              onClick={() => registrar.mutate(false)} disabled={registrar.isPending}
              className="px-4 py-2 rounded-lg text-[12px] font-semibold disabled:opacity-40"
              style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}
            >
              {registrar.isPending ? "Registrando..." : "Registrar checkpoint"}
            </button>
            <button
              onClick={() => registrar.mutate(true)} disabled={registrar.isPending}
              className="px-4 py-2 rounded-lg text-[12px] font-semibold"
              style={{ background: "var(--cf2-bg-surface)", color: "var(--cf2-text-tertiary)" }}
            >
              Não se aplica
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Bloco({ titulo, subtitulo, acao, children }: { titulo: string; subtitulo?: string; acao?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg p-3" style={{ background: "var(--cf2-bg-surface)" }}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--cf2-text-tertiary)" }}>{titulo}</p>
          {subtitulo && <p className="text-[10.5px] mt-0.5" style={{ color: "var(--cf2-text-tertiary)" }}>{subtitulo}</p>}
        </div>
        {acao}
      </div>
      {children}
    </div>
  );
}

const PERGUNTAS_HEALTH: { chave: string; label: string; tipo: "escala10" | "escala5" | "simnao" | "texto" }[] = [
  { chave: "nps", label: "De 0 a 10, indicaria a Callface?", tipo: "escala10" },
  { chave: "valor_percebido", label: "Entrega o valor esperado? (1-5)", tipo: "escala5" },
  { chave: "adocao", label: "O time adotou? (1-5)", tipo: "escala5" },
  { chave: "satisfacao_suporte", label: "Suporte e atendimento (1-5)", tipo: "escala5" },
  { chave: "intencao_continuidade", label: "Pretende continuar no próximo ciclo?", tipo: "simnao" },
  { chave: "dificuldades", label: "Maior dificuldade hoje", tipo: "texto" },
  { chave: "subir_um_ponto", label: "O que faria a nota subir 1 ponto", tipo: "texto" },
];

export function FormularioHealthCheck({
  valores, onChange,
}: { valores: Record<string, number | boolean | string>; onChange: (v: Record<string, number | boolean | string>) => void }) {
  const set = (k: string, v: number | boolean | string) => onChange({ ...valores, [k]: v });

  return (
    <div className="flex flex-col gap-2.5">
      {PERGUNTAS_HEALTH.map((p) => (
        <div key={p.chave}>
          <p className="text-[11.5px] font-medium mb-1" style={{ color: "var(--cf2-text-secondary)" }}>{p.label}</p>
          {(p.tipo === "escala10" || p.tipo === "escala5") && (
            <div className="flex gap-1 flex-wrap">
              {Array.from({ length: p.tipo === "escala10" ? 11 : 5 }, (_, i) => (p.tipo === "escala10" ? i : i + 1)).map((n) => {
                const ativo = valores[p.chave] === n;
                // Vermelho/amarelo/verde na escala: a cor é a régua do playbook.
                const ruim = p.tipo === "escala10" ? n <= 4 : n <= 2;
                const medio = p.tipo === "escala10" ? n <= 6 : n === 3;
                return (
                  <button
                    key={n} onClick={() => set(p.chave, n)}
                    className="w-7 h-7 rounded-lg text-[11px] font-bold"
                    style={{
                      background: ativo ? (ruim ? "var(--cf2-danger-text)" : medio ? "var(--cf2-warning-text)" : "var(--cf2-success-text)") : "var(--cf2-bg-surface-muted)",
                      color: ativo ? "#fff" : "var(--cf2-text-secondary)",
                    }}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          )}
          {p.tipo === "simnao" && (
            <div className="flex gap-1.5">
              {[["sim", true], ["não", false]].map(([rotulo, v]) => (
                <button
                  key={String(rotulo)} onClick={() => set(p.chave, v as boolean)}
                  className="px-3 py-1 rounded-lg text-[11px] font-semibold"
                  style={{
                    background: valores[p.chave] === v ? (v ? "var(--cf2-success-text)" : "var(--cf2-danger-text)") : "var(--cf2-bg-surface-muted)",
                    color: valores[p.chave] === v ? "#fff" : "var(--cf2-text-secondary)",
                  }}
                >
                  {rotulo}
                </button>
              ))}
            </div>
          )}
          {p.tipo === "texto" && (
            <input
              value={String(valores[p.chave] ?? "")} onChange={(e) => set(p.chave, e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg text-[12px] outline-none"
              style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function ResultadoRegistrado({ marco }: { marco: MarcoJornada }) {
  const r = (marco.resultado ?? {}) as {
    checklist?: Record<string, boolean>; respostas?: Record<string, string>;
    sinaisObservados?: string[]; nota?: string; healthCheck?: Record<string, unknown> | null;
    pulado?: string;
  };

  if (r.pulado) {
    return <p className="text-[12px] p-3 rounded-lg" style={{ background: "var(--cf2-bg-surface)", color: "var(--cf2-text-tertiary)" }}>{r.pulado}</p>;
  }

  const marcados = Object.entries(r.checklist ?? {}).filter(([, v]) => v).map(([k]) => k);
  const respondidas = Object.entries(r.respostas ?? {}).filter(([, v]) => v?.trim());

  return (
    <div className="rounded-lg p-3 flex flex-col gap-2.5" style={{ background: "var(--cf2-bg-surface)" }}>
      {r.nota && <p className="text-[12.5px]" style={{ color: "var(--cf2-text-primary)" }}>{r.nota}</p>}

      {respondidas.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {respondidas.map(([p, resp]) => (
            <div key={p}>
              <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{p}</p>
              <p className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>{resp}</p>
            </div>
          ))}
        </div>
      )}

      {(r.sinaisObservados ?? []).length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {r.sinaisObservados!.map((s) => <Cf2Badge key={s} variant="warning">{s}</Cf2Badge>)}
        </div>
      )}

      {marcados.length > 0 && (
        <div className="text-[11.5px]" style={{ color: "var(--cf2-text-tertiary)" }}>
          {marcados.map((m) => <div key={m}>✓ {m}</div>)}
        </div>
      )}

      {r.healthCheck && Object.keys(r.healthCheck).length > 0 && (
        <div className="flex gap-1.5 flex-wrap pt-2" style={{ borderTop: "1px solid var(--cf2-border-default)" }}>
          {Object.entries(r.healthCheck).map(([k, v]) => (
            <Cf2Badge key={k} variant="neutral">{k}: {typeof v === "boolean" ? (v ? "sim" : "não") : String(v)}</Cf2Badge>
          ))}
        </div>
      )}
    </div>
  );
}
