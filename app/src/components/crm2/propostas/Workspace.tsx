"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { toastDark } from "../shared/toast-dark";
import {
  Search, Eye, MoreHorizontal, Pencil, Copy, Trash2, AlertTriangle,
} from "lucide-react";
import { Cf2Badge } from "../ui/Badge";
import {
  Cf2DropdownMenu, Cf2DropdownMenuContent, Cf2DropdownMenuItem, Cf2DropdownMenuTrigger,
} from "../ui/DropdownMenu";
import { useOrgUsuarios } from "@/components/crm/BoardFilters";
import { Cf2Pulso, Cf2PulsoStat } from "../shared/Pulso";
import { statusDisplay, resolveEtapaNegocio, FAMILY_LABEL, FAMILY_COLOR, brl, type PropostaRow } from "./shared";
import { Cf2PropostaStatusChart, Cf2PropostaSerieChart } from "./PropostaCharts";
import { Cf2PropostaDrawer } from "./PropostaDrawer";

function timeAgoShort(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins}min`;
  if (mins < 1440) return `há ${Math.floor(mins / 60)}h`;
  return `há ${Math.floor(mins / 1440)}d`;
}

/** Dias corridos desde `enviadaEm`, só relevante pra proposta parada (nunca negativo). */
function diasParada(enviadaEm: string | null): number {
  if (!enviadaEm) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(enviadaEm).getTime()) / 86_400_000));
}

interface Kpis {
  totalPropostas: number; emElaboracao: number; enviadas: number; ajusteSolicitado: number; visualizadas: number; aceitas: number;
  recusadasExpiradas: number; aguardandoAcao: number; valorAguardandoAcao: string; diasEsperaMax: number | null;
  valorTotalAtivo: string;
  taxaAceite: number | null; tempoMedioAceiteDias: number | null;
  serieMensal: { mes: string; enviadas: number; aceitas: number; valorAceito: number }[];
  tendencia: { enviadas: number | null; aceitas: number | null };
}

/**
 * Propostas (CRM2). Redesenho de 10/09/2026 — a versão anterior (25/08)
 * transformava a página inteira em superfície "chrome" escura (mesmo tema do
 * Pipeline), com KPIs dark equivalentes e um doughnut ao lado de um gráfico de
 * barras do mesmo peso: nada dizia qual proposta estava travada. Esta versão
 * segue o mesmo contrato que Clientes e Financeiro já usam — `Cf2Topbar`
 * claro no `page.tsx`, faixa de pulso escura só pra UM sinal dominante, e o
 * resto (distribuição, tendência, worklist) em superfície clara de trabalho.
 *
 * O dominante deixou de ser "total de propostas" (1486, estoque histórico
 * cheio de rascunho e expirada — não aciona nada) pra ser "aguardando ação da
 * Callface": enviada sem resposta do cliente OU ajuste solicitado. Essa
 * segunda categoria (`ajuste_solicitado`) não aparecia em NENHUM KPI antes —
 * o backend só filtrava `enviada`, então uma proposta que o cliente pediu pra
 * revisar ficava invisível na régua de topo (só via API de listagem).
 *
 * Clique na linha abre o DRAWER (preview rápido). Gestão completa (Aceitar
 * com conversão em cliente, Recusar com motivo, Excluir, PDF) mora em
 * `/propostas/[id]` (`PropostaDetalhe.tsx`) — acessível pelo menu "..." de
 * cada linha e pelo próprio drawer.
 */
export function Cf2PropostasWorkspace() {
  const router = useRouter();
  const { usuarios } = useOrgUsuarios();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("todos");
  const [responsavel, setResponsavel] = useState("todas");
  const [familia, setFamilia] = useState("todas");
  const [periodo, setPeriodo] = useState<"mes" | "todos">("todos");
  const [drawerId, setDrawerId] = useState<string | null>(null);

  // KPIs/gráficos respeitam os MESMOS filtros da tabela (achado real 25/08,
  // Kauã: "usando os filtros tinha que atualizar os dados ali presente") —
  // mesmos params que a query da tabela já manda, backend usa a mesma
  // função de condições pras duas rotas.
  const { data: kpis } = useQuery<Kpis>({
    queryKey: ["propostas-kpis", status, responsavel, familia, periodo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status !== "todos") params.set("status", status);
      if (responsavel !== "todas") params.set("responsavel", responsavel);
      if (familia !== "todas") params.set("familia", familia);
      if (periodo === "mes") params.set("periodo", "mes");
      const r = await fetch(`/api/propostas/kpis?${params.toString()}`);
      return r.json();
    },
  });

  const { data: propostas = [], isLoading, refetch } = useQuery<PropostaRow[]>({
    queryKey: ["propostas", search, status, responsavel, familia, periodo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (status !== "todos") params.set("status", status);
      if (responsavel !== "todas") params.set("responsavel", responsavel);
      if (familia !== "todas") params.set("familia", familia);
      if (periodo === "mes") params.set("periodo", "mes");
      const r = await fetch(`/api/propostas?${params.toString()}`);
      if (!r.ok) return [];
      return r.json();
    },
  });

  const aguardando = kpis?.aguardandoAcao ?? 0;
  const trendArrow = (v: number | null | undefined) => (v == null ? null : `${v >= 0 ? "+" : ""}${v}%`);

  return (
    <div className="flex flex-col gap-5">
      {/* Pulso: aguardando ação é o único sinal dominante — é o que responde
          "qual proposta está travada", a pergunta central desta tela. Os
          satélites são leitura de saúde do funil, não estoque histórico. */}
      <Cf2Pulso
        label="Aguardando ação da Callface"
        valor={kpis ? brl(kpis.valorAguardandoAcao) : "—"}
        titulo={kpis ? `${aguardando} proposta${aguardando === 1 ? "" : "s"} parada${aguardando === 1 ? "" : "s"}` : undefined}
        tom={aguardando > 0 ? "atencao" : "ok"}
        sub={
          kpis ? (
            <span>
              {aguardando} proposta{aguardando === 1 ? "" : "s"} enviada{aguardando === 1 ? "" : "s"} sem resposta ou com ajuste
              pedido pelo cliente
              {kpis.diasEsperaMax != null && kpis.diasEsperaMax > 0 ? ` · a mais antiga espera há ${kpis.diasEsperaMax}d` : ""}.
            </span>
          ) : (
            "Carregando..."
          )
        }
      >
        <Cf2PulsoStat
          label="Taxa de aceite"
          valor={kpis?.taxaAceite != null ? `${kpis.taxaAceite}%` : "—"}
          tom="ok"
          sub={trendArrow(kpis?.tendencia?.aceitas) ? `${trendArrow(kpis?.tendencia?.aceitas)} de aceites vs mês anterior` : "Sem histórico mensal ainda"}
        />
        <Cf2PulsoStat
          label="Ciclo até aceite"
          valor={kpis?.tempoMedioAceiteDias != null ? `${kpis.tempoMedioAceiteDias}d` : "—"}
          tom="neutro"
          sub="Média entre envio e resposta"
        />
        <Cf2PulsoStat
          label="Valor em propostas abertas"
          valor={kpis ? brl(kpis.valorTotalAtivo) : "—"}
          tom="dinheiro"
          sub="Rascunho, enviada e ajuste"
        />
        <Cf2PulsoStat
          label="Enviadas este mês"
          valor={kpis?.serieMensal?.[kpis.serieMensal.length - 1]?.enviadas ?? "—"}
          tom="neutro"
          sub={trendArrow(kpis?.tendencia?.enviadas) ? `${trendArrow(kpis?.tendencia?.enviadas)} vs mês anterior` : "Sem histórico mensal ainda"}
        />
      </Cf2Pulso>

      <div className="grid gap-4 lg:grid-cols-2">
        <Cf2PropostaStatusChart
          emElaboracao={kpis?.emElaboracao ?? 0}
          enviadas={kpis?.enviadas ?? 0}
          ajusteSolicitado={kpis?.ajusteSolicitado ?? 0}
          aceitas={kpis?.aceitas ?? 0}
          recusadasExpiradas={kpis?.recusadasExpiradas ?? 0}
        />
        <Cf2PropostaSerieChart dados={kpis?.serieMensal ?? []} />
      </div>

      <div
        className="flex flex-col overflow-hidden rounded-[var(--cf2-radius-lg)]"
        style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}
      >
        <div className="flex flex-col gap-3 p-4 shrink-0" style={{ borderBottom: "1px solid var(--cf2-border-default)" }}>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--cf2-text-tertiary)" }}>Worklist</p>
              <h2 className="mt-1 text-[18px] font-bold" style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>Todas as propostas</h2>
            </div>
            <p className="hidden text-[12px] sm:block" style={{ color: "var(--cf2-text-secondary)" }}>{propostas.length.toLocaleString("pt-BR")} neste recorte</p>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>
            <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar proposta, cliente ou negócio..."
              aria-label="Buscar proposta, cliente ou negócio" type="search"
              className="flex-1 bg-transparent outline-none text-[13px]"
              style={{ color: "var(--cf2-text-primary)" }}
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <LightSelect value={status} onChange={setStatus} aria-label="Status">
              <option value="todos">Todos os status</option>
              <option value="rascunho">Rascunho</option>
              <option value="enviada">Enviada</option>
              <option value="ajuste_solicitado">Ajuste solicitado</option>
              <option value="aceita">Aceita</option>
              <option value="recusada">Recusada</option>
              <option value="expirada">Expirada</option>
            </LightSelect>
            <LightSelect value={responsavel} onChange={setResponsavel} aria-label="Responsável">
              <option value="todas">Todos os responsáveis</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </LightSelect>
            <LightSelect value={familia} onChange={setFamilia} aria-label="Família">
              <option value="todas">Todas as famílias</option>
              {Object.entries(FAMILY_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </LightSelect>
            <LightSelect value={periodo} onChange={(v) => setPeriodo(v as "mes" | "todos")} aria-label="Período">
              <option value="todos">Todo o período</option>
              <option value="mes">Este mês</option>
            </LightSelect>
          </div>
        </div>

        {/* Lista estilo Circle (linha única flat, sem <table>/colunas de
            grid) — mantida do redesenho anterior, só recolorida pra
            superfície clara. Cluster fixo à esquerda (família + número +
            status), título flexível no meio, cluster auxiliar à direita. */}
        {isLoading ? (
          <p className="text-sm p-6" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando...</p>
        ) : propostas.length === 0 ? (
          <p className="text-sm p-6" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma proposta encontrada neste recorte.</p>
        ) : (
          <div className="flex flex-col">
            {propostas.map((p) => {
              const badge = statusDisplay(p.status);
              const etapa = resolveEtapaNegocio(p.negocioStatus);
              const visualizada = p.status === "enviada" && p.visualizacoes > 0;
              const presa = (p.status === "enviada" || p.status === "ajuste_solicitado") ? diasParada(p.enviadaEm) : 0;
              const familiaChave = p.familias?.[0];
              return (
                <div
                  key={p.id}
                  className="w-full flex items-center h-12 px-4 gap-3 cursor-pointer transition-colors border-b last:border-b-0 hover:bg-[var(--cf2-bg-surface-muted)]"
                  style={{ borderColor: "var(--cf2-border-default)" }}
                  onClick={() => setDrawerId(p.id)}
                >
                  {familiaChave && (
                    <span
                      aria-hidden
                      className="hidden sm:inline-block size-2 rounded-full shrink-0"
                      style={{ background: FAMILY_COLOR[familiaChave] ?? FAMILY_COLOR.UNKNOWN }}
                      title={FAMILY_LABEL[familiaChave]}
                    />
                  )}
                  {/* Número da proposta escondido abaixo de `sm`: em 390px
                      ele brigava 92px fixos com o nome do cliente, que é a
                      informação que realmente identifica a linha — achado
                      real ao validar mobile (o nome sobrava com ~8px). */}
                  <span className="hidden sm:inline-block text-[12px] font-mono shrink-0 w-[92px] truncate" style={{ color: "var(--cf2-text-tertiary)" }}>#PROP-{String(p.numero).padStart(4, "0")}{p.versao > 1 ? `v${p.versao}` : ""}</span>
                  <Cf2Badge variant={visualizada ? "accent" : badge.tom}>{visualizada ? "Visualizada" : badge.label}</Cf2Badge>

                  {/* `flex-1` é o que faltava aqui (herdado da versão escura
                      anterior, mesmo bug): sem crescer, o nome do cliente só
                      recebia o espaço mínimo do seu próprio conteúdo e
                      truncava pra 1-2 caracteres em 390px, mesmo sobrando
                      espaço livre — achado real ao validar mobile. */}
                  <div className="min-w-0 flex-1 flex items-baseline gap-1.5 mr-2">
                    <span className="text-[13px] font-medium truncate" style={{ color: "var(--cf2-text-primary)" }}>{p.leadEmpresa || p.leadNome || "—"}</span>
                    <span className="text-[12px] truncate hidden md:inline" style={{ color: "var(--cf2-text-tertiary)" }}>{p.itensResumo?.[0]?.nome}</span>
                  </div>

                  <div className="flex items-center justify-end gap-3 ml-auto shrink-0">
                    {p.negocioId && (
                      <Link href={`/negocios/${p.negocioId}`} onClick={(e) => e.stopPropagation()} className="text-[11px] hover:underline hidden lg:inline-block max-w-[140px] truncate" style={{ color: "var(--cf2-text-tertiary)" }}>{p.negocioTitulo || "negócio"}</Link>
                    )}
                    {etapa && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 hidden lg:inline-block" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}>{etapa.label}</span>
                    )}
                    {p.primeiraVisualizacaoEm && (
                      <Eye className="w-3.5 h-3.5 shrink-0 hidden sm:inline-block" style={{ color: "var(--cf2-text-tertiary)" }} />
                    )}
                    {presa >= 3 ? (
                      <span className="flex items-center gap-1 text-[11px] font-semibold shrink-0 hidden sm:inline-flex" style={{ color: "var(--cf2-warning-text)" }}>
                        <AlertTriangle className="w-3 h-3" /> Parada há {presa}d
                      </span>
                    ) : (
                      <span className="text-[12px] shrink-0 hidden sm:inline-block" style={{ color: "var(--cf2-text-tertiary)" }}>{timeAgoShort(p.ultimaAtividadeEm ?? p.createdAt)}</span>
                    )}
                    <span className="text-[13px] font-semibold shrink-0 w-[92px] text-right" style={{ color: "var(--cf2-text-primary)" }}>{brl(p.totalGeral)}</span>
                    <div onClick={(e) => e.stopPropagation()}>
                      <RowMenu proposta={p} router={router} refetch={refetch} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Cf2PropostaDrawer propostaId={drawerId} open={!!drawerId} onClose={() => setDrawerId(null)} onChanged={() => refetch()} />
    </div>
  );
}

function LightSelect({ value, onChange, children, "aria-label": ariaLabel }: { value: string; onChange: (v: string) => void; children: React.ReactNode; "aria-label": string }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      className="text-[12px] rounded-lg px-3 py-2 outline-none"
      style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-secondary)" }}
    >
      {children}
    </select>
  );
}

function RowMenu({ proposta, router, refetch }: { proposta: PropostaRow; router: ReturnType<typeof useRouter>; refetch: () => void }) {
  const [open, setOpen] = useState(false);
  const editavel = ["rascunho", "enviada", "ajuste_solicitado"].includes(proposta.status);

  const excluir = async () => {
    const r = await fetch(`/api/propostas/${proposta.id}`, { method: "DELETE" });
    if (r.ok) { toastDark.success("Proposta excluída."); refetch(); }
    else toastDark.error("Erro ao excluir proposta");
    setOpen(false);
  };

  return (
    <Cf2DropdownMenu open={open} onOpenChange={setOpen}>
      <Cf2DropdownMenuTrigger asChild>
        <button className="p-1.5 rounded-md hover:bg-[var(--cf2-bg-surface-muted)]" style={{ color: "var(--cf2-text-tertiary)" }} aria-label="Mais ações"><MoreHorizontal className="w-4 h-4" /></button>
      </Cf2DropdownMenuTrigger>
      <Cf2DropdownMenuContent align="end" className="min-w-[180px]">
        <Cf2DropdownMenuItem onClick={() => router.push(`/propostas/${proposta.id}`)} className="gap-2">Ver página completa</Cf2DropdownMenuItem>
        {editavel && (
          <Cf2DropdownMenuItem onClick={() => router.push(`/propostas/novo?propostaId=${proposta.id}`)} className="gap-2"><Pencil className="w-3.5 h-3.5" /> Editar</Cf2DropdownMenuItem>
        )}
        {(proposta.status === "recusada" || proposta.status === "expirada") && (
          <Cf2DropdownMenuItem onClick={async () => { const r = await fetch(`/api/propostas/${proposta.id}/nova-versao`, { method: "POST" }); const j = await r.json(); if (r.ok) router.push(`/propostas/${j.id}`); else toastDark.error("Erro ao criar nova versão"); }} className="gap-2"><Copy className="w-3.5 h-3.5" /> Nova versão</Cf2DropdownMenuItem>
        )}
        {proposta.status !== "aceita" && (
          <Cf2DropdownMenuItem onClick={excluir} destructive className="gap-2"><Trash2 className="w-3.5 h-3.5" /> Excluir</Cf2DropdownMenuItem>
        )}
      </Cf2DropdownMenuContent>
    </Cf2DropdownMenu>
  );
}
