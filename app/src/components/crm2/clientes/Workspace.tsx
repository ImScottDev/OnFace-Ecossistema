"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Building2, Wallet, Users, Package, AlertTriangle } from "lucide-react";
import { useOrgUsuarios } from "@/components/crm/BoardFilters";
import { AssignOwnerControl } from "@/components/crm2/shared/AssignOwnerControl";
import { Cf2ClienteDrawer } from "./ClienteDrawer";

interface ClienteLinha {
  id: string;
  nome: string;
  setor: string | null;
  total_servicos: number;
  current_mrr: string;
  familias: string[];
  entregas_em_andamento: number;
  faturas_atrasadas: number;
  fatura_venceu_em: string | null;
  status_financeiro: "ativo" | "inadimplente" | "churned" | "indefinido";
  lifecycle: "cliente";
  ultima_atividade_tipo: string | null;
  ultima_atividade_em: string | null;
  cs_owner_id: string | null;
  cs_owner_nome: string | null;
  risco: "alto" | "baixo";
}

// Bucket sintético criado na reconciliação (Zoho/Stripe) pra agregar serviços
// sem empresa resolvida — dado real de gap, não erro de UI. Sinalizado
// visualmente em vez de escondido: esconder mascararia o mesmo problema de
// vínculo Stripe já identificado no fechamento comercial de julho.
const EMPRESA_NAO_RESOLVIDA = "Unresolved billing identity";

function diasAtraso(venceuEm: string | null): number {
  if (!venceuEm) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(venceuEm).getTime()) / 86400000));
}

const FAMILIA_LABEL: Record<string, string> = {
  CALLFACE_AI: "Callface AI",
  PABX: "PABX",
  WHITE_LABEL: "White Label",
  UNKNOWN: "Não classificado",
};

const STATUS_LABEL: Record<string, string> = {
  ativo: "Ativo",
  inadimplente: "Inadimplente",
  churned: "Churned",
  indefinido: "Indefinido",
};

const STATUS_COLOR: Record<string, string> = {
  ativo: "var(--cf2-success-text)",
  inadimplente: "var(--cf2-danger-text)",
  churned: "var(--cf2-text-tertiary)",
  indefinido: "var(--cf2-text-tertiary)",
};

// Rótulo curto pro canal da última atividade real (`atividades.tipo`,
// valores crus do banco, inclusive variantes `_legado` da recuperação
// Zoho) — nunca mostrar o enum cru na UI.
const CANAL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  email: "E-mail",
  email_legado: "E-mail",
  ligacao: "Ligação",
  ligacao_legado: "Ligação",
  reuniao: "Reunião",
  reuniao_legado: "Reunião",
  nota: "Nota",
  tarefa: "Tarefa",
  tarefa_legado: "Tarefa",
  cadencia: "Cadência",
  proposta_enviada: "Proposta enviada",
  diagnostico: "Diagnóstico",
  follow_up: "Follow-up",
};

function formatarQuando(iso: string | null): string {
  if (!iso) return "—";
  const data = new Date(iso);
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  const hora = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (data.toDateString() === hoje.toDateString()) return `Hoje às ${hora}`;
  if (data.toDateString() === ontem.toDateString()) return `Ontem às ${hora}`;
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function brl(v: string | number) {
  return `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Clientes / Carteira (CRM2, 19/08) — primeira versão real do módulo que
 * antes não existia (Sidebar apontava "Clientes" pra /contatos como
 * interino). Unidade é Empresa + Serviços — nunca Oportunidade. MRR vem de
 * `servicos_canonicos.current_recurring_value` (fonte fechada), nunca de
 * contrato/oportunidade.
 */
export function Cf2ClientesWorkspace() {
  const qc = useQueryClient();
  const { usuarios } = useOrgUsuarios();
  const [busca, setBusca] = useState("");
  const [familia, setFamilia] = useState("");
  const [status, setStatus] = useState("");
  const [owner, setOwner] = useState("");
  const [pagina, setPagina] = useState(1);
  const [drawerEmpresaId, setDrawerEmpresaId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ clientes: ClienteLinha[]; total: number; totalPages: number }>({
    queryKey: ["cf2-clientes", busca, familia, status, owner, pagina],
    queryFn: async () => {
      const r = await fetch(`/api/clientes-crm2?search=${encodeURIComponent(busca)}&familia=${familia}&status=${status}&owner=${owner}&page=${pagina}&limit=20`);
      if (!r.ok) return { clientes: [], total: 0, totalPages: 0 };
      return r.json();
    },
  });

  // Cards de topo: total REAL da base, não só da página atual. "Em risco"
  // testou 2 critérios mais amplos (fatura atrasada OU sem próxima ação OU
  // sem atividade — os 2 últimos são ruído verificado no banco: 0% e 71%
  // de cobertura respectivamente) e ficou só com fatura atrasada, o único
  // sinal real e diferenciante hoje (13 clientes).
  const { data: resumo } = useQuery<{
    clientesAtivos: number; servicosAtivos: number; mrrTotal: string; emRisco: number;
    mrrDelta30d: string; clientesNovos30d: number; familias: Record<string, number>;
  }>({
    queryKey: ["cf2-clientes-resumo"],
    queryFn: async () => {
      const r = await fetch("/api/clientes-crm2/resumo");
      if (!r.ok) return { clientesAtivos: 0, servicosAtivos: 0, mrrTotal: "0", emRisco: 0, mrrDelta30d: "0", clientesNovos30d: 0, familias: {} };
      return r.json();
    },
  });

  const clientes = data?.clientes ?? [];

  const mrrDelta = resumo ? parseFloat(resumo.mrrDelta30d) : 0;
  const mrrBase = resumo ? Number(resumo.mrrTotal) - mrrDelta : 0;
  const mrrDeltaPct = mrrBase > 0 ? (mrrDelta / mrrBase) * 100 : null;
  const familiasResumo = Object.entries(resumo?.familias ?? {}).map(([f, n]) => `${FAMILIA_LABEL[f] || f} ${n}`).join(" · ");

  const CARDS = [
    {
      label: "MRR ATUAL (TOTAL)", valor: resumo ? brl(resumo.mrrTotal) : "—", icon: Wallet, tone: "var(--cf2-success-text)",
      sub: mrrDeltaPct !== null ? `${mrrDeltaPct >= 0 ? "+" : ""}${mrrDeltaPct.toFixed(1)}% vs 30 dias atrás` : null,
    },
    {
      label: "CLIENTES ATIVOS", valor: resumo ? resumo.clientesAtivos.toLocaleString("pt-BR") : "—", icon: Users, tone: "var(--cf2-text-primary)",
      sub: resumo ? `+${resumo.clientesNovos30d} novos (30d)` : null,
    },
    {
      label: "SERVIÇOS ATIVOS", valor: resumo ? resumo.servicosAtivos.toLocaleString("pt-BR") : "—", icon: Package, tone: "var(--cf2-text-primary)",
      sub: familiasResumo || null,
    },
    { label: "EM RISCO", valor: resumo ? resumo.emRisco.toLocaleString("pt-BR") : "—", icon: AlertTriangle, tone: "var(--cf2-danger-text)", sub: "fatura em atraso" },
  ];

  return (
    <div className="flex flex-col gap-5 h-full min-h-0">
      <div className="grid grid-cols-4 gap-3 shrink-0">
        {CARDS.map((k) => (
          <div key={k.label} className="flex items-center justify-between gap-3 p-3.5 rounded-2xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
            <div className="flex flex-col gap-1.5 min-w-0">
              <p className="text-[10px] font-bold truncate" style={{ color: "var(--cf2-text-tertiary)" }}>{k.label}</p>
              <p className="text-[22px] font-bold" style={{ color: k.tone }}>{k.valor}</p>
              {k.sub && <p className="text-[11px] truncate" style={{ color: "var(--cf2-text-tertiary)" }}>{k.sub}</p>}
            </div>
            <div className="flex items-center justify-center rounded-xl shrink-0 w-10 h-10" style={{ background: "var(--cf2-bg-surface-muted)" }}>
              <k.icon className="w-4.5 h-4.5" style={{ color: k.tone }} />
            </div>
          </div>
        ))}
      </div>

      <div className="flex-1 min-h-0 flex flex-col rounded-3xl overflow-hidden" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
        <div className="p-4 shrink-0" style={{ borderBottom: "1px solid var(--cf2-border-default)" }}>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>
            <Search className="w-3.5 h-3.5" style={{ color: "var(--cf2-text-tertiary)" }} />
            <input
              value={busca}
              onChange={(e) => { setBusca(e.target.value); setPagina(1); }}
              placeholder="Buscar cliente..."
              className="flex-1 bg-transparent outline-none text-[13px]"
              style={{ color: "var(--cf2-text-primary)" }}
            />
          </div>
          <div className="flex gap-2 mt-2">
            <select
              value={familia}
              onChange={(e) => { setFamilia(e.target.value); setPagina(1); }}
              className="text-[12px] rounded-lg px-3 py-2 outline-none"
              style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-secondary)" }}
            >
              <option value="">Todas as famílias</option>
              {Object.entries(FAMILIA_LABEL).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPagina(1); }}
              className="text-[12px] rounded-lg px-3 py-2 outline-none"
              style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-secondary)" }}
            >
              <option value="">Todos os status</option>
              {Object.entries(STATUS_LABEL).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
            <select
              value={owner}
              onChange={(e) => { setOwner(e.target.value); setPagina(1); }}
              className="text-[12px] rounded-lg px-3 py-2 outline-none"
              style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-secondary)" }}
            >
              <option value="">Todos os donos (CS)</option>
              <option value="sem_dono">Sem dono</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <p className="p-6 text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando...</p>
          ) : clientes.length === 0 ? (
            <p className="p-6 text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum cliente com serviço ativo encontrado.</p>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr style={{ background: "var(--cf2-bg-surface-muted)" }}>
                  {["Empresa", "Serviços", "Famílias", "MRR atual", "Lifecycle", "Financeiro", "Billing", "CS Owner", "Última atividade", "Entrega", "Risco"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-[11px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clientes.map((cl) => {
                  const naoResolvida = cl.nome === EMPRESA_NAO_RESOLVIDA;
                  return (
                  <tr
                    key={cl.id}
                    className="cursor-pointer"
                    style={{ borderTop: "1px solid var(--cf2-border-default)", background: naoResolvida ? "var(--cf2-warning-bg, rgba(234,179,8,0.08))" : undefined }}
                    onClick={() => setDrawerEmpresaId(cl.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex items-center justify-center rounded-lg shrink-0 w-8 h-8" style={{ background: naoResolvida ? "var(--cf2-warning-text)" : "var(--cf2-bg-inverse)" }}>
                          {naoResolvida ? <AlertTriangle className="w-4 h-4 text-white" /> : <Building2 className="w-4 h-4 text-white" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold truncate" style={{ color: naoResolvida ? "var(--cf2-warning-text)" : "var(--cf2-text-primary)" }}>
                            {naoResolvida ? "Sem empresa vinculada (billing não resolvido)" : cl.nome}
                          </p>
                          <p className="text-[11px] truncate" style={{ color: "var(--cf2-text-secondary)" }}>{cl.setor || "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[13px]" style={{ color: "var(--cf2-text-primary)" }}>{cl.total_servicos}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {cl.familias.map((f) => (
                          <span key={f} className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}>{FAMILIA_LABEL[f] || f}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[13px] font-bold" style={{ color: "var(--cf2-success-text)" }}>{brl(cl.current_mrr)}</td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-semibold" style={{ color: "var(--cf2-success-text)" }}>Cliente</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-semibold" style={{ color: STATUS_COLOR[cl.status_financeiro] }}>
                        {STATUS_LABEL[cl.status_financeiro] || cl.status_financeiro}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {cl.faturas_atrasadas > 0 ? (
                        <span className="text-[11px] font-semibold" style={{ color: "var(--cf2-danger-text)" }}>Atrasado · {diasAtraso(cl.fatura_venceu_em)}d</span>
                      ) : (
                        <span className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>Em dia</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <AssignOwnerControl
                        entityType="cliente"
                        entityId={cl.id}
                        currentOwnerId={cl.cs_owner_id}
                        usuarios={usuarios}
                        onChanged={() => qc.invalidateQueries({ queryKey: ["cf2-clientes"] })}
                      />
                    </td>
                    <td className="px-4 py-3 text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>
                      {cl.ultima_atividade_em ? (
                        <>
                          <span className="font-semibold" style={{ color: "var(--cf2-text-primary)" }}>
                            {CANAL_LABEL[cl.ultima_atividade_tipo || ""] || cl.ultima_atividade_tipo}
                          </span>
                          {" · "}{formatarQuando(cl.ultima_atividade_em)}
                        </>
                      ) : (
                        <span style={{ color: "var(--cf2-text-tertiary)" }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[13px]" style={{ color: cl.entregas_em_andamento > 0 ? "var(--cf2-warning-text)" : "var(--cf2-text-tertiary)" }}>
                      {cl.entregas_em_andamento > 0 ? `${cl.entregas_em_andamento} em andamento` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: cl.risco === "alto" ? "var(--cf2-danger-text)" : "var(--cf2-success-text)" }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: "currentColor" }} />
                        {cl.risco === "alto" ? "Alto" : "Baixo"}
                      </span>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between p-4 shrink-0" style={{ borderTop: "1px solid var(--cf2-border-default)" }}>
          <p className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>
            {data ? `Mostrando ${(pagina - 1) * 20 + 1}-${Math.min(pagina * 20, data.total)} de ${data.total}` : "—"}
          </p>
          <div className="flex gap-2">
            <button onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagina <= 1} className="px-3 py-1.5 rounded-lg text-[12px] font-semibold disabled:opacity-40" style={{ border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-secondary)" }}>Anterior</button>
            <button onClick={() => setPagina((p) => (data && p < data.totalPages ? p + 1 : p))} disabled={!data || pagina >= data.totalPages} className="px-3 py-1.5 rounded-lg text-[12px] font-semibold disabled:opacity-40" style={{ border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-secondary)" }}>Próximo</button>
          </div>
        </div>
      </div>

      <Cf2ClienteDrawer
        empresaId={drawerEmpresaId}
        open={!!drawerEmpresaId}
        onClose={() => setDrawerEmpresaId(null)}
      />
    </div>
  );
}
