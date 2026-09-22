"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Cf2Badge } from "@/components/crm2/ui/Badge";
import { Cf2EmptyState, Cf2Skeleton } from "@/components/crm2/ui/States";
import { useOrgUsuarios } from "@/components/crm/BoardFilters";
import { AssignOwnerControl } from "@/components/crm2/shared/AssignOwnerControl";
import { iniciaisEmpresa, corAvatarEmpresa, TEXTO_SOBRE_AVATAR } from "@/components/crm2/shared/avatar";
import { Cf2CsAgenda, Cf2CsMetricas } from "./CsAgenda";
import { Cf2CsCabecalho, type PulsoCs, type Escopo } from "./CsCabecalho";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Cf2CsFila, SEGMENTOS, itemNoSegmento, type ItemFila } from "./CsFila";
import { Cf2CsBlocos, type PainelCs } from "./CsBlocos";

/**
 * Home de CS — central operacional.
 *
 * Quatro zonas: contexto+pulso (hero escuro), segmentos, fila agrupada por
 * cliente (área dominante) e blocos operacionais na lateral. As demais
 * visões (Minha semana, Carteira, Renovações, Expansão, Métricas) ficam em
 * abas, porque são recortes de trabalho e não competem pela primeira dobra.
 *
 * Toda a leitura vem dos endpoints que já existiam; o único acréscimo foi
 * `/cs/painel`, agregador de leitura para os blocos laterais.
 */

type Visao = "geral" | "agenda" | "carteira" | "renovacoes" | "expansoes" | "metricas";

const FAMILIA_LABEL: Record<string, string> = {
  CALLFACE_AI: "Callface AI",
  PABX: "PABX",
  WHITE_LABEL: "White Label",
  UNKNOWN: "Produto em revisão",
};

function familias(bruto: string | null): string {
  if (!bruto) return "";
  return bruto.split(",").map((f) => FAMILIA_LABEL[f.trim()] ?? f.trim()).join(" · ");
}

function brl(v: number | string) {
  return `R$ ${Number(v || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

function diasDesde(iso: string | null): string {
  if (!iso) return "nunca";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d <= 0) return "hoje";
  if (d === 1) return "ontem";
  return `${d}d`;
}

const ABAS: [Visao, string][] = [
  ["geral", "Visão geral"],
  ["agenda", "Minha semana"],
  ["carteira", "Carteira"],
  ["renovacoes", "Renovações"],
  ["expansoes", "Expansão"],
  ["metricas", "Métricas"],
];

export function Cf2CsWorkspace() {
  const { usuarios } = useOrgUsuarios();
  const [visao, setVisao] = useState<Visao>("geral");
  const [escopo, setEscopo] = useState<Escopo>("todos");
  const [segmento, setSegmento] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  const paramResponsavel = escopo === "todos" ? "" : `?responsavel=${escopo}`;

  const { data: pulso } = useQuery<PulsoCs>({
    queryKey: ["cs-pulso", escopo],
    queryFn: async () => (await fetch(`/api/cs/pulso${paramResponsavel}`)).json(),
  });

  const { data: filaData, isLoading: filaLoading } = useQuery<{ itens: ItemFila[] }>({
    queryKey: ["cs-fila", escopo],
    queryFn: async () => (await fetch(`/api/cs/fila${paramResponsavel}`)).json(),
  });

  const { data: painel, isLoading: painelLoading } = useQuery<PainelCs>({
    queryKey: ["cs-painel", escopo],
    queryFn: async () => (await fetch(`/api/cs/painel${paramResponsavel}`)).json(),
  });

  const itens = filaData?.itens ?? [];

  // "Exigem atenção" é a contagem de CLIENTES na fila, não de sinais — é o
  // número que o CS usa pra dimensionar o dia.
  const clientesNaFila = useMemo(
    () => new Set(itens.map((i) => i.empresaId)).size,
    [itens],
  );

  const contagemSegmentos = useMemo(() => {
    const mapa: Record<string, number> = {};
    for (const seg of SEGMENTOS) {
      mapa[seg.chave] = new Set(itens.filter((i) => itemNoSegmento(i, seg.chave)).map((i) => i.empresaId)).size;
    }
    return mapa;
  }, [itens]);

  const irParaSegmento = (s: string) => { setSegmento(s); setVisao("geral"); };

  return (
    // Cabeçalho e resumo ficam FORA do contêiner com `gap`: os dois já trazem
    // o próprio ritmo. Dentro de um `gap-4` a faixa de resumo somava 36px até
    // o conteúdo, contra os 20px do desenho.
    <>
      <Cf2CsCabecalho
        pulso={pulso}
        escopo={escopo}
        onEscopo={(e) => { setEscopo(e); setSegmento(null); }}
        busca={busca}
        onBusca={setBusca}
      />

      <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1 flex-wrap">
        {ABAS.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setVisao(k)}
            className="px-3.5 py-1.5 rounded-full text-[12.5px] font-semibold transition-colors"
            style={{
              background: visao === k ? "var(--cf2-bg-inverse)" : "transparent",
              color: visao === k ? "#fff" : "var(--cf2-text-secondary)",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {visao === "geral" && (
        <div className="grid xl:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
          <div className="min-w-0 flex flex-col gap-3">
            <div className="flex items-baseline gap-2 flex-wrap">
              {/* A contagem entra no título: é o tamanho do dia, e era o
                  número que a faixa de cima anunciava como "Exigem atenção"
                  sem conseguir recortar. Aqui ele nomeia exatamente o
                  conjunto que a lista abaixo mostra. */}
              <p className="text-[15px] font-bold" style={{ color: "var(--text-strong)" }}>
                Precisa da sua atenção
              </p>
              <span className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--text-muted)" }}>
                {clientesNaFila}
              </span>
              <p className="text-[11.5px] basis-full" style={{ color: "var(--text-muted)" }}>
                Uma linha por cliente. Conta com mais de um problema mostra o pior e agrega o resto.
              </p>
            </div>

            {/* Recorte da fila: esta linha é a ÚNICA que filtra a tela, e a
                contagem sai do mesmo conjunto que o clique corta — um chip
                nunca abre vazio. Segmento sem ninguém não aparece. */}
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={segmento ?? ""}
              onValueChange={(v) => setSegmento(v || null)}
              aria-label="Recorte da fila"
              className="flex-wrap"
            >
              {SEGMENTOS.filter((seg) => (contagemSegmentos[seg.chave] ?? 0) > 0).map((seg) => (
                <ToggleGroupItem key={seg.chave} value={seg.chave}>
                  {seg.label}
                  <span className="tabular-nums opacity-60">{contagemSegmentos[seg.chave]}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            <Cf2CsFila
              itens={itens}
              carregando={filaLoading}
              segmento={segmento}
              busca={busca}
              onLimpar={() => { setSegmento(null); setBusca(""); }}
            />
          </div>

          {/* Sticky: a fila tem 26 linhas e a coluna tem 4 blocos. Sem isso,
              rolar a fila deixava 400px de vazio à direita e o contexto
              operacional saía de vista justamente enquanto se trabalha. */}
          <div className="min-w-0 xl:sticky xl:top-0">
            <Cf2CsBlocos
              painel={painel}
              carregando={painelLoading}
              onSegmento={irParaSegmento}
              onEscopoSemDono={() => { setEscopo("sem_dono"); setVisao("carteira"); }}
              onVisao={(v) => setVisao(v)}
            />
          </div>
        </div>
      )}

      {visao === "agenda" && <Cf2CsAgenda escopo={escopo} />}
      {visao === "carteira" && <CarteiraCs escopo={escopo} usuarios={usuarios} busca={busca} />}
      {visao === "renovacoes" && <Renovacoes />}
      {visao === "expansoes" && <Expansoes />}
      {visao === "metricas" && <Cf2CsMetricas />}
      </div>
    </>
  );
}

interface LinhaCarteira {
  id: string; nome: string; current_mrr: string; familias: string[];
  status_geral: string; cs_owner_id: string | null; cs_owner_nome: string | null;
  faturas_atrasadas: number; ultima_atividade_em: string | null;
  proxima_acao_titulo: string | null; proxima_acao_vence_em: string | null;
}

const STATUS_VARIANTE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  ativo: "success", onboarding: "warning", implantacao: "warning",
  em_risco: "danger", inadimplente: "danger", cancelado: "neutral",
};

/**
 * Carteira dentro do CS. Consome a MESMA rota da aba Carteira
 * (`/api/clientes-crm2`) de propósito — duas listagens de cliente com
 * critérios diferentes seria o começo do fim. O contexto de CS (próximo
 * checkpoint, renovação, risco) vem de `/cs/painel`, sem engordar aquela
 * rota compartilhada.
 */
function CarteiraCs({
  escopo, usuarios, busca,
}: { escopo: string; usuarios: ReturnType<typeof useOrgUsuarios>["usuarios"]; busca: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const owner = escopo === "sem_dono" ? "&owner=sem_dono" : "";
  const { data, isLoading } = useQuery<{ clientes: LinhaCarteira[]; total: number }>({
    queryKey: ["cs-carteira", escopo],
    queryFn: async () => (await fetch(`/api/clientes-crm2?limit=100${owner}`)).json(),
  });
  const { data: painel } = useQuery<PainelCs>({
    queryKey: ["cs-painel", escopo],
    queryFn: async () => (await fetch(`/api/cs/painel${escopo === "todos" ? "" : `?responsavel=${escopo}`}`)).json(),
  });

  if (isLoading) return <Cf2Skeleton className="h-64" />;

  let linhas = data?.clientes ?? [];
  if (busca.trim()) {
    const t = busca.trim().toLowerCase();
    linhas = linhas.filter((l) => l.nome.toLowerCase().includes(t));
  }
  if (linhas.length === 0) {
    return <Cf2EmptyState title="Nenhum cliente nesta visão" description={escopo === "sem_dono" ? "Toda a carteira já tem responsável." : undefined} />;
  }

  const col = "px-3 py-2 text-left font-semibold text-[10px] uppercase tracking-wide whitespace-nowrap";

  return (
    <div className="rounded-2xl overflow-x-auto" style={{ border: "1px solid var(--cf2-border-default)" }}>
      <table className="w-full text-[12px]" style={{ minWidth: "1100px" }}>
        <thead>
          <tr style={{ background: "var(--cf2-bg-surface-muted)" }}>
            {["Cliente", "Serviços", "MRR", "Owner", "Risco", "Financeiro", "Último contato", "Próxima ação", "Checkpoint", "Renovação"].map((h) => (
              <th key={h} className={col} style={{ color: "var(--cf2-text-tertiary)" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, idx) => {
            const ctx = painel?.porEmpresa?.[l.id];
            const critico = ctx?.risco?.severidade === "CRITICO";
            return (
              <tr
                key={l.id}
                className="cursor-pointer transition-colors hover:bg-[var(--cf2-bg-surface-muted)]"
                style={{ borderTop: idx === 0 ? "none" : "1px solid var(--cf2-border-default)", background: "var(--cf2-bg-surface)" }}
                onClick={() => router.push(`/clientes/cs/${l.id}`)}
              >
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex items-center justify-center w-6 h-6 rounded-lg shrink-0 text-[9.5px] font-bold text-white"
                      style={{ background: corAvatarEmpresa(l.id), color: TEXTO_SOBRE_AVATAR }}
                    >
                      {iniciaisEmpresa(l.nome)}
                    </span>
                    <span className="font-semibold truncate max-w-[190px]" style={{ color: "var(--cf2-text-primary)" }}>{l.nome}</span>
                  </div>
                </td>
                <td className="px-3 py-2 whitespace-nowrap" style={{ color: "var(--cf2-text-secondary)" }}>{familias((l.familias ?? []).join(",")) || "—"}</td>
                <td className="px-3 py-2 font-semibold whitespace-nowrap" style={{ color: "var(--cf2-text-primary)" }}>{brl(l.current_mrr)}</td>
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <AssignOwnerControl
                    entityType="cliente" entityId={l.id} currentOwnerId={l.cs_owner_id} usuarios={usuarios}
                    onChanged={() => { qc.invalidateQueries({ queryKey: ["cs-carteira"] }); qc.invalidateQueries({ queryKey: ["cs-pulso"] }); qc.invalidateQueries({ queryKey: ["cs-painel"] }); }}
                  />
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {ctx?.risco
                    ? <Cf2Badge variant={critico || ctx.risco.severidade === "EM_RISCO" ? "danger" : "warning"}>
                        {ctx.risco.sinais} {ctx.risco.sinais === 1 ? "sinal" : "sinais"}
                      </Cf2Badge>
                    : <span style={{ color: "var(--cf2-success-text)" }}>ok</span>}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {l.faturas_atrasadas > 0
                    ? <Cf2Badge variant="danger">{l.faturas_atrasadas} vencida{l.faturas_atrasadas > 1 ? "s" : ""}</Cf2Badge>
                    : <span style={{ color: "var(--cf2-text-tertiary)" }}>em dia</span>}
                </td>
                <td className="px-3 py-2 whitespace-nowrap" style={{ color: "var(--cf2-text-tertiary)" }}>{diasDesde(l.ultima_atividade_em)}</td>
                <td className="px-3 py-2">
                  <span className="truncate block max-w-[160px]" style={{ color: l.proxima_acao_titulo ? "var(--cf2-text-secondary)" : "var(--cf2-danger-text)" }}>
                    {l.proxima_acao_titulo ?? "sem próxima ação"}
                  </span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {ctx?.checkpoint
                    ? <span style={{ color: ctx.checkpoint.atrasado ? "var(--cf2-danger-text)" : "var(--cf2-text-secondary)" }}>
                        {ctx.checkpoint.codigo} · {new Date(`${ctx.checkpoint.dueDate}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                      </span>
                    : <span style={{ color: "var(--cf2-text-tertiary)" }}>—</span>}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {ctx?.renovacao
                    ? <span style={{ color: ctx.renovacao.dias <= 30 ? "var(--cf2-warning-text)" : "var(--cf2-text-secondary)" }}>{ctx.renovacao.dias}d</span>
                    : <span style={{ color: "var(--cf2-text-tertiary)" }}>—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface LinhaRenovacao {
  renovacao: { id: string; empresaId: string; vencimento: string; status: string; valorAtual: string | null };
  empresaNome: string; familia: string | null; produto: string | null;
  responsavelNome: string | null; diasRestantes: number;
}

function Renovacoes() {
  const router = useRouter();
  const { data, isLoading } = useQuery<{ renovacoes: LinhaRenovacao[] }>({
    queryKey: ["cs-renovacoes"],
    queryFn: async () => (await fetch("/api/cs/renovacoes")).json(),
  });

  if (isLoading) return <Cf2Skeleton className="h-48" />;
  const linhas = data?.renovacoes ?? [];
  if (linhas.length === 0) {
    return (
      <Cf2EmptyState
        title="Nenhuma renovação mapeada"
        description="Renovação é calculada pela vigência real do contrato. Serviço sem contrato com data de vencimento não gera renovação — assinatura recorrente sem termo renova sozinha."
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {linhas.map((l) => (
        <div key={l.renovacao.id} className="p-3.5 rounded-xl flex items-center justify-between gap-3" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{l.empresaNome}</p>
              <Cf2Badge variant={l.diasRestantes <= 30 ? "danger" : l.diasRestantes <= 60 ? "warning" : "neutral"}>
                {l.diasRestantes < 0 ? `vencida há ${Math.abs(l.diasRestantes)}d` : `${l.diasRestantes} dias`}
              </Cf2Badge>
              <Cf2Badge variant="neutral">{l.renovacao.status.toLowerCase().replace("_", " ")}</Cf2Badge>
            </div>
            <p className="text-[12px] mt-1" style={{ color: "var(--cf2-text-secondary)" }}>
              {l.produto ?? familias(l.familia) ?? "Serviço"} · vence {l.renovacao.vencimento} · {l.renovacao.valorAtual ? brl(l.renovacao.valorAtual) : "sem valor"} · {l.responsavelNome ?? "sem CS"}
            </p>
          </div>
          <button onClick={() => router.push(`/clientes/cs/${l.renovacao.empresaId}`)} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold shrink-0" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}>
            Abrir CS
          </button>
        </div>
      ))}
    </div>
  );
}

interface LinhaExpansao {
  id: string; titulo: string; status: string; valorTotal: string | null;
  empresaId: string; empresaNome: string; familia: string | null; responsavelNome: string | null;
}

function Expansoes() {
  const router = useRouter();
  const { data, isLoading } = useQuery<{ expansoes: LinhaExpansao[] }>({
    queryKey: ["cs-expansoes"],
    queryFn: async () => (await fetch("/api/cs/expansoes")).json(),
  });

  if (isLoading) return <Cf2Skeleton className="h-48" />;
  const linhas = data?.expansoes ?? [];
  if (linhas.length === 0) {
    return <Cf2EmptyState title="Nenhuma expansão aberta" description="Abra uma pelo Cliente 360 — ela vira oportunidade comercial de verdade e segue o fluxo de proposta e contrato." />;
  }

  return (
    <div className="flex flex-col gap-2">
      {linhas.map((e) => (
        <div key={e.id} className="p-3.5 rounded-xl flex items-center justify-between gap-3" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{e.empresaNome}</p>
              <Cf2Badge variant={e.status === "ganho" ? "success" : e.status === "perdido" ? "danger" : "warning"}>{e.status.replace(/_/g, " ")}</Cf2Badge>
            </div>
            <p className="text-[12px] mt-1" style={{ color: "var(--cf2-text-secondary)" }}>
              {e.titulo} · {e.valorTotal ? brl(e.valorTotal) : "sem valor"} · {e.responsavelNome ?? "sem responsável"}
            </p>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button onClick={() => router.push(`/negocios/${e.id}`)} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}>Abrir negócio</button>
            <button onClick={() => router.push(`/clientes/cs/${e.empresaId}`)} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}>CS</button>
          </div>
        </div>
      ))}
    </div>
  );
}
