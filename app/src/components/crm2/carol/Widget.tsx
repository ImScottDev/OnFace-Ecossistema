"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { PrioridadeItem, Briefing, Performance, CarolPose, CarolMensagem, CAROL_POSE_SRC, URGENCIA_COR, TIPO_ICONE, brl } from "./types";

type AcaoKey = "prioridades" | "em-risco" | "contatar-hoje" | "atrasados" | "negocios-atencao" | "performance" | "semana";

const ACOES: { key: AcaoKey; label: string; icone: string }[] = [
  { key: "prioridades", label: "Prioridades", icone: "🎯" },
  { key: "em-risco", label: "Em risco", icone: "⚠️" },
  { key: "contatar-hoje", label: "Contatar hoje", icone: "📞" },
  { key: "atrasados", label: "Atrasados", icone: "⏰" },
  { key: "negocios-atencao", label: "Negócios que precisam de atenção", icone: "💼" },
  { key: "performance", label: "Minha performance", icone: "📊" },
  { key: "semana", label: "Minha semana", icone: "🗓️" },
];

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function contextoPorRota(pathname: string): string {
  if (pathname.startsWith("/atendimento")) return " Vi que você está no Atendimento, quer que eu te mostre quem precisa de retorno hoje?";
  if (pathname.startsWith("/negocios") || pathname.startsWith("/pipeline")) return " Como você está no Pipeline, quer ver os negócios que merecem atenção?";
  if (pathname.startsWith("/tarefas")) return " Vi que você está em Atividades, quer ver o que está atrasado?";
  if (pathname.startsWith("/propostas")) return " Você está em Propostas, quer ver quais estão em risco?";
  return " No que posso te ajudar agora?";
}

async function buscarJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

function poseDeLista(itens: PrioridadeItem[], vazioAprova = true): CarolPose {
  if (itens.length === 0) return vazioAprova ? "aprovado" : "padrao";
  if (itens.some((i) => i.urgencia === "alta")) return "alerta";
  return "dica";
}

function construirResposta(acao: AcaoKey, data: unknown): { texto: string; pose: CarolPose; itens?: PrioridadeItem[]; stats?: CarolMensagem["stats"] } {
  if (acao === "performance") {
    const p = data as Performance;
    if (!p) return { texto: "Não consegui buscar sua performance agora. Tenta de novo?", pose: "padrao" };
    const crescendo = p.fechadoMes.receita > 0 && p.fechadoMes.receita >= p.fechadoMesAnterior.receita;
    const base = `Seu pipeline ativo hoje soma ${brl(p.pipeline.total)} em ${p.pipeline.negociosAbertos} negócio(s).`;
    const fechamento = p.fechadoMes.receita === 0
      ? " Esse mês ainda não teve negócio fechado. Bora virar esse jogo?"
      : crescendo
        ? ` Esse mês você já fechou ${brl(p.fechadoMes.receita)}, saindo na frente do mês passado 👏`
        : ` Esse mês você já fechou ${brl(p.fechadoMes.receita)} (mês passado foram ${brl(p.fechadoMesAnterior.receita)}).`;
    return {
      texto: base + fechamento,
      pose: crescendo ? "meta-batida" : "padrao",
      stats: [
        { label: "Pipeline ativo", valor: brl(p.pipeline.total), sub: `${p.pipeline.negociosAbertos} negócio(s)` },
        { label: "Fechado este mês", valor: brl(p.fechadoMes.receita), sub: `${p.fechadoMes.ganhos} negócio(s)` },
        { label: "Fechado mês anterior", valor: brl(p.fechadoMesAnterior.receita), sub: `${p.fechadoMesAnterior.ganhos} negócio(s)` },
      ],
    };
  }
  if (acao === "semana") {
    const s = data as { fechado: { receita: number; ganhos: number } };
    if (!s) return { texto: "Não consegui buscar sua semana agora. Tenta de novo?", pose: "padrao" };
    return {
      texto: s.fechado.ganhos > 0
        ? `Nos últimos 7 dias você fechou ${brl(s.fechado.receita)} em ${s.fechado.ganhos} negócio(s). Boa semana! 🚀`
        : "Nos últimos 7 dias ainda não teve negócio fechado. Bora virar esse jogo?",
      pose: s.fechado.ganhos > 0 ? "venda-fechada" : "dica",
    };
  }

  const itens = ((data as { itens?: PrioridadeItem[] })?.itens ?? []);
  const aberturas: Record<string, string> = {
    prioridades: itens.length ? "Aqui vai o que mais importa agora:" : "Tudo tranquilo por aqui, nenhuma prioridade batendo à porta agora 🎉",
    "em-risco": itens.length ? "Fica de olho nesses aqui, correm risco de esfriar:" : "Nenhum negócio ou proposta em risco agora. Respira! 😌",
    "contatar-hoje": itens.length ? "Bora colocar esses no radar de hoje:" : "Ninguém esperando retorno seu agora. Aproveita pra prospectar! 💪",
    atrasados: itens.length ? "Essas tarefas já passaram do prazo:" : "Nenhuma tarefa atrasada, você está em dia 👏",
    "negocios-atencao": itens.length ? "Esses negócios merecem um empurrãozinho:" : "Nenhum negócio parado agora. Segue o jogo!",
  };
  return { texto: aberturas[acao] || "Aqui está:", pose: poseDeLista(itens), itens };
}

function construirBriefing(b: Briefing): { texto: string; pose: CarolPose; stats: CarolMensagem["stats"] } {
  const partes: string[] = [];
  if (b.reunioesHoje > 0) partes.push(`${b.reunioesHoje} reunião(ões) hoje`);
  if (b.negociosAtencao > 0) partes.push(`${b.negociosAtencao} negócio(s) pedindo atenção`);
  if (b.tarefasAtrasadas > 0) partes.push(`${b.tarefasAtrasadas} tarefa(s) atrasada(s)`);
  const resumo = partes.length ? partes.join(", ") + "." : "nada urgente na agenda.";
  return {
    texto: `Aqui vai seu resumo: ${resumo} Ontem a equipe fechou ${brl(b.fechadoOntem)}.`,
    pose: b.tarefasAtrasadas > 0 || b.negociosAtencao > 0 ? "alerta" : "padrao",
    stats: [
      { label: "Reuniões hoje", valor: String(b.reunioesHoje) },
      { label: "Prioridades", valor: String(b.prioridades) },
      { label: "Pipeline ativo", valor: brl(b.pipelineAtivo) },
      { label: "Fechado ontem", valor: brl(b.fechadoOntem) },
    ],
  };
}

export function Cf2CarolWidget() {
  const pathname = usePathname() || "/";
  const { data: session } = useSession();
  const primeiroNome = (session?.user?.name || "").split(" ")[0] || "";
  const userId = (session?.user as { id?: string } | undefined)?.id || "anon";

  const [aberto, setAberto] = useState(false);
  const [feed, setFeed] = useState<CarolMensagem[]>([]);
  const [carregando, setCarregando] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [feed, carregando]);

  function abrirPainel() {
    setAberto((prev) => {
      const next = !prev;
      if (next && feed.length === 0) {
        setFeed([{ id: "boas-vindas", pose: "padrao", texto: `${saudacao()}${primeiroNome ? `, ${primeiroNome}` : ""}!${contextoPorRota(pathname)}` }]);
      }
      return next;
    });
  }

  // Contrato visual do Figma (16/08, node 184:4645 "bottom-bar"): a barra da
  // Carol convida a "Pergunte, analise ou execute algo com a Carol..." via
  // ⌘J. Não existe input de texto livre real (V1 é só ações pré-definidas,
  // ver ACOES) — o atalho abre o mesmo painel de ações que o clique na
  // barra já abre, não é um chat novo.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        abrirPainel();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed.length, pathname, primeiroNome]);

  const { data: prioridadesBadge } = useQuery<{ itens: PrioridadeItem[] }>({
    queryKey: ["cf2-carol-badge"],
    queryFn: () => buscarJson("/api/carol/prioridades?limit=20"),
    refetchInterval: 5 * 60 * 1000,
  });
  const itensUrgentes = (prioridadesBadge?.itens ?? []).filter((i) => i.urgencia === "alta").length;
  const totalItens = prioridadesBadge?.itens?.length ?? 0;

  useEffect(() => {
    if (userId === "anon") return;
    const hoje = new Date().toISOString().slice(0, 10);
    const chave = `cf2-carol-briefing-${userId}-${hoje}`;
    if (localStorage.getItem(chave)) return;
    const timer = setTimeout(async () => {
      if (localStorage.getItem(chave)) return;
      localStorage.setItem(chave, "1");
      const b = await buscarJson("/api/carol/briefing");
      if (!b) return;
      const { texto, pose, stats } = construirBriefing(b as Briefing);
      setFeed((f) => [...f, { id: `briefing-${Date.now()}`, pose, texto, stats }]);
      setAberto(true);
    }, 3 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [userId]);

  async function escolherAcao(acao: AcaoKey) {
    setCarregando(true);
    const url = acao === "performance" ? "/api/carol/performance" : acao === "semana" ? "/api/carol/semana" : `/api/carol/${acao}`;
    const data = await buscarJson(url);
    const { texto, pose, itens, stats } = construirResposta(acao, data);
    setFeed((f) => [...f, { id: `${acao}-${Date.now()}`, pose, texto, itens, stats }]);
    setCarregando(false);
  }

  return (
    <>
      {/* Barra global (16/08) — deixou de ser widget flutuante só de /inicio;
          agora é rodapé fixo do App Shell inteiro, sempre visível, igual a
          sidebar. Clicar em qualquer ponto da barra abre o mesmo painel que
          já existia (nenhuma lógica nova, só mudou o trigger visual). */}
      <button
        onClick={abrirPainel}
        className="flex items-center justify-between w-full shrink-0 px-8 py-3 text-left"
        style={{ background: "var(--cf2-chrome-bg-alt)" }}
        title="Abrir Carol"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative flex items-center justify-center rounded-full shrink-0 size-7 overflow-hidden" style={{ background: "var(--cf2-accent)" }}>
            <img src={CAROL_POSE_SRC.padrao} alt="Carol" className="w-full h-full object-cover" style={{ objectPosition: "50% 15%" }} />
            {itensUrgentes > 0 ? (
              <span
                className="absolute -top-1 -right-1 flex items-center justify-center rounded-full text-[9px] font-extrabold w-4 h-4"
                style={{ background: "var(--cf2-danger-text)", color: "#fff" }}
              >
                {itensUrgentes}
              </span>
            ) : totalItens > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 rounded-full w-2.5 h-2.5" style={{ background: "var(--cf2-warning-text)" }} />
            ) : null}
          </div>
          <p className="text-[13px] font-bold whitespace-nowrap" style={{ color: "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>
            Carol AI
          </p>
          <span className="rounded-full shrink-0 size-1" style={{ background: "var(--cf2-accent)" }} />
          <p className="text-[12px] whitespace-nowrap" style={{ color: "var(--cf2-accent)" }}>Online</p>
          <p className="text-[12px] truncate" style={{ color: "var(--cf2-chrome-text-secondary)" }}>
            Pergunte, analise ou execute algo com a Carol...
          </p>
        </div>
        <p className="text-[12px] whitespace-nowrap shrink-0 ml-4" style={{ color: "var(--cf2-chrome-text-secondary)" }}>
          Pressione ⌘J pra abrir a Carol em qualquer lugar
        </p>
      </button>

      {aberto && (
        <div
          className="fixed bottom-[62px] right-6 z-40 w-[380px] max-h-[640px] flex flex-col rounded-3xl overflow-hidden shadow-2xl"
          style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}
        >
          <div className="flex items-center justify-between p-3 pl-4" style={{ borderBottom: "1px solid var(--cf2-border-default)", background: "var(--cf2-accent)" }}>
            <div className="flex items-center gap-2.5">
              <div className="rounded-full overflow-hidden w-9 h-9 shrink-0" style={{ border: "2px solid rgba(255,255,255,0.5)" }}>
                <img src={CAROL_POSE_SRC.padrao} alt="Carol" className="w-full h-full object-cover" style={{ objectPosition: "50% 15%" }} />
              </div>
              <div>
                <p className="text-[14px] font-extrabold" style={{ color: "var(--cf2-text-on-accent)" }}>Carol</p>
                <p className="text-[11px]" style={{ color: "var(--cf2-text-on-accent)", opacity: 0.85 }}>Copiloto de vendas</p>
              </div>
            </div>
            <button onClick={() => setAberto(false)}><X className="w-4 h-4" style={{ color: "var(--cf2-text-on-accent)" }} /></button>
          </div>

          <div ref={feedRef} className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
            {feed.map((m) => (
              <div key={m.id} className="flex gap-2 items-start">
                <img src={CAROL_POSE_SRC[m.pose]} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" style={{ objectPosition: "50% 15%", border: "1px solid var(--cf2-border-default)" }} />
                <div className="flex-1 flex flex-col gap-2 min-w-0">
                  <div className="rounded-2xl rounded-tl-sm p-2.5" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                    <p className="text-[13px] leading-relaxed" style={{ color: "var(--cf2-text-primary)" }}>{m.texto}</p>
                  </div>
                  {m.itens && m.itens.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      {m.itens.map((item) => <ItemCard key={item.id} item={item} />)}
                    </div>
                  )}
                  {m.stats && (
                    <div className="grid grid-cols-2 gap-1.5">
                      {m.stats.map((s, i) => <CardStat key={i} {...s} span2={m.stats!.length % 2 === 1 && i === m.stats!.length - 1} />)}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {carregando && (
              <div className="flex gap-2 items-start">
                <img src={CAROL_POSE_SRC.pensando} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" style={{ objectPosition: "50% 15%", border: "1px solid var(--cf2-border-default)" }} />
                <div className="rounded-2xl rounded-tl-sm px-3 py-2.5" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                  <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Deixa eu ver aqui...</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5 p-3 shrink-0" style={{ borderTop: "1px solid var(--cf2-border-default)" }}>
            {ACOES.map((a) => (
              <button
                key={a.key}
                onClick={() => escolherAcao(a.key)}
                disabled={carregando}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold text-left disabled:opacity-50"
                style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-primary)" }}
              >
                <span>{a.icone}</span> {a.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function CardStat({ label, valor, sub, span2 }: { label: string; valor: string; sub?: string; span2?: boolean }) {
  return (
    <div className={`flex flex-col gap-0.5 p-2 rounded-xl ${span2 ? "col-span-2" : ""}`} style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
      <p className="text-[9px] font-semibold" style={{ color: "var(--cf2-text-tertiary)" }}>{label}</p>
      <p className="text-[13px] font-extrabold" style={{ color: "var(--cf2-text-primary)" }}>{valor}</p>
      {sub && <p className="text-[9px]" style={{ color: "var(--cf2-text-secondary)" }}>{sub}</p>}
    </div>
  );
}

function ItemCard({ item }: { item: PrioridadeItem }) {
  const conteudo = (
    <div className="flex flex-col gap-1 p-2.5 rounded-xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-bold flex items-center gap-1.5 truncate" style={{ color: "var(--cf2-text-primary)" }}>
          <span>{TIPO_ICONE[item.tipo]}</span> <span className="truncate">{item.titulo}</span>
        </p>
        <span className="text-[9px] font-extrabold uppercase shrink-0" style={{ color: URGENCIA_COR[item.urgencia] }}>{item.urgencia}</span>
      </div>
      {item.subtitulo && <p className="text-[11px] truncate" style={{ color: "var(--cf2-text-secondary)" }}>{item.subtitulo}</p>}
      <p className="text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>{item.motivos.join(" · ")}</p>
    </div>
  );
  return item.link ? <a href={item.link}>{conteudo}</a> : conteudo;
}
