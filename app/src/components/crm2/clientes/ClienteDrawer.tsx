"use client";

import { useState } from "react";
import { Cf2Avatar } from "@/components/crm2/ds/Avatar";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Phone, Mail, MessageCircle, Calendar, StickyNote, CheckSquare, FileText, Download } from "lucide-react";
import { DetailDrawer } from "@/components/crm/DetailDrawer";
import { useOrgUsuarios } from "@/components/crm/BoardFilters";
import { AssignOwnerControl } from "@/components/crm2/shared/AssignOwnerControl";
import { Cf2MrrMensalChart } from "./MrrMensalChart";

interface Servico {
  id: string;
  serviceFamily: string;
  canonicalProduct: string | null;
  currentRecurringValue: string;
  portfolioIncluded: boolean;
  commercialLifecycle: string;
}
interface Atividade { id: string; tipo: string; titulo: string | null; createdAt: string; autorNome: string | null; pessoaNome: string | null }
interface ProximaAcao { id: string; titulo: string; venceEm: string | null; usuarioNome: string | null }
interface ContratoCliente {
  id: string;
  tipo: string;
  descricao: string | null;
  status: string;
  mrr: string | null;
  currentRecurringValue: string | null;
  inicio: string | null;
  vencimento: string | null;
  temCorpoGerado: boolean;
}
interface AnexoLegado {
  id: string;
  entidadeId: string;
  nomeArquivo: string;
  arquivoDisponivel: boolean;
}
interface ClienteDetalhe {
  empresa: { id: string; nome: string; setor: string | null; cnpj: string | null; porte: string | null };
  servicos: Servico[];
  currentMrr: number;
  clienteDesde: string | null;
  statusFinanceiro: string | null;
  responsavel: { id: string; nome: string } | null;
  faturasAtrasadas: number;
  proximaFatura: { valor: string; vencimento: string } | null;
  proximasAcoes: ProximaAcao[];
  atividadesRecentes: Atividade[];
  mrrMensal: { mes: string; valor: number }[];
  contratoIds: string[];
  contratos: ContratoCliente[];
}

const FAMILIA_LABEL: Record<string, string> = { CALLFACE_AI: "Callface AI", PABX: "PABX", WHITE_LABEL: "White Label", UNKNOWN: "Não classificado" };
const STATUS_LABEL: Record<string, string> = { ativo: "Ativo", inadimplente: "Inadimplente", churned: "Churned" };
const STATUS_COLOR: Record<string, string> = { ativo: "var(--cf2-success-text)", inadimplente: "var(--cf2-danger-text)", churned: "var(--cf2-text-tertiary)" };
const CANAL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp", email: "E-mail", email_legado: "E-mail", ligacao: "Ligação", ligacao_legado: "Ligação",
  reuniao: "Reunião", reuniao_legado: "Reunião", nota: "Nota", tarefa: "Tarefa", tarefa_legado: "Tarefa",
  cadencia: "Cadência", proposta_enviada: "Proposta enviada", diagnostico: "Diagnóstico", follow_up: "Follow-up",
};
const CANAL_ICON: Record<string, React.ElementType> = {
  whatsapp: MessageCircle, email: Mail, email_legado: Mail, ligacao: Phone, ligacao_legado: Phone,
  reuniao: Calendar, reuniao_legado: Calendar, nota: StickyNote, tarefa: CheckSquare, tarefa_legado: CheckSquare,
  proposta_enviada: FileText,
};

const brl = (v: string | number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const brlData = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");

const TABS = ["Visão geral", "Serviços", "Contratos", "Financeiro", "Atividades", "Riscos"] as const;
type Tab = (typeof TABS)[number];

const CONTRATO_STATUS_LABEL: Record<string, string> = {
  ativo: "Ativo", pausado: "Pausado", concluido: "Concluído", churned: "Churned",
  cancelado: "Cancelado", renovado: "Renovado", pendente_assinatura: "Pendente de assinatura",
};
const CONTRATO_STATUS_COLOR: Record<string, string> = {
  ativo: "var(--cf2-success-text)", renovado: "var(--cf2-success-text)",
  pausado: "var(--cf2-warning-text, #d97706)", pendente_assinatura: "var(--cf2-warning-text, #d97706)",
  churned: "var(--cf2-danger-text)", cancelado: "var(--cf2-danger-text)",
};

/**
 * Drawer lateral de Clientes/Carteira (referência de UX do Kauã, 18/08) —
 * preview rápido ao clicar na linha, sem navegar pra outra página. Reusa
 * o MESMO endpoint do Cliente 360 (`GET /clientes-crm2/:empresaId`) — não
 * existe uma segunda fonte de dado "resumida" pro drawer, é o mesmo dado
 * real, só que num painel compacto. CTA "Abrir Cliente 360" leva pra
 * página cheia (6 abas) pra aprofundar.
 */
export function Cf2ClienteDrawer({ empresaId, open, onClose }: { empresaId: string | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { usuarios } = useOrgUsuarios();
  const [tab, setTab] = useState<Tab>("Visão geral");

  const { data, isLoading } = useQuery<ClienteDetalhe>({
    queryKey: ["cliente-detalhe", empresaId],
    queryFn: async () => {
      const r = await fetch(`/api/clientes-crm2/${empresaId}`);
      if (!r.ok) throw new Error("Cliente não encontrado");
      return r.json();
    },
    enabled: !!empresaId && open,
  });

  const nome = data?.empresa?.nome || "";
  const statusKey = data?.statusFinanceiro || "";
  // Fallback ?? [] em todo campo-array da resposta (mesmo padrão já
  // endurecido no Cliente 360) — nunca quebra se o dev server servir uma
  // resposta parcial/cacheada (achado real: bundle "(stale)" do Next.js).
  const servicos = data?.servicos ?? [];
  const servicosAtivos = servicos.filter((s) => s.portfolioIncluded);
  const atividadesRecentes = data?.atividadesRecentes ?? [];
  const proximasAcoes = data?.proximasAcoes ?? [];
  const mrrMensal = data?.mrrMensal ?? [];
  const contratos = data?.contratos ?? [];
  const contratoIds = data?.contratoIds ?? [];

  const { data: anexosContrato = [], isLoading: anexosLoading } = useQuery<AnexoLegado[]>({
    queryKey: ["anexos-legado-cliente-drawer", empresaId, contratoIds.join(",")],
    queryFn: async () => {
      if (contratoIds.length === 0) return [];
      const r = await fetch(`/api/anexos-legado?entidadeTipo=contrato&entidadeIds=${contratoIds.join(",")}`);
      if (!r.ok) return [];
      const body = await r.json();
      return (body.anexos || []) as AnexoLegado[];
    },
    enabled: !!empresaId && open && contratoIds.length > 0,
  });

  return (
    <DetailDrawer
      open={open}
      onClose={() => { setTab("Visão geral"); onClose(); }}
      bare
      panelBg="var(--cf2-bg-surface)"
      width="w-full sm:w-[440px]"
    >
      {isLoading || !data ? (
        <p className="p-6 text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando...</p>
      ) : (
        <div className="flex flex-col h-full min-h-0">
          {/* Header */}
          <div className="flex items-center gap-3 p-5 shrink-0" style={{ borderBottom: "1px solid var(--cf2-border-default)" }}>
            <Cf2Avatar nome={nome} tipo="empresa" size="lg" className="size-11" />
            <div className="flex-1 min-w-0">
              <p className="text-[16px] font-bold truncate" style={{ color: "var(--cf2-text-primary)" }}>{nome}</p>
              {statusKey && (
                <span className="text-[11px] font-semibold" style={{ color: STATUS_COLOR[statusKey] || "var(--cf2-text-tertiary)" }}>
                  {STATUS_LABEL[statusKey] || statusKey}
                </span>
              )}
            </div>
            <a href={`/clientes/${empresaId}`} title="Abrir Cliente 360" className="p-1.5 rounded-lg shrink-0" style={{ color: "var(--cf2-text-tertiary)" }}>
              <ArrowUpRight className="w-4 h-4" />
            </a>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-3 pt-3 shrink-0 overflow-x-auto" style={{ borderBottom: "1px solid var(--cf2-border-default)" }}>
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="px-3 py-2 text-[12px] font-semibold whitespace-nowrap rounded-t-lg"
                style={{
                  color: tab === t ? "var(--cf2-text-primary)" : "var(--cf2-text-tertiary)",
                  borderBottom: tab === t ? "2px solid var(--cf2-accent-border)" : "2px solid transparent",
                }}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
            {tab === "Visão geral" && (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase" style={{ color: "var(--cf2-text-tertiary)" }}>CS Owner</p>
                  <AssignOwnerControl
                    entityType="cliente"
                    entityId={empresaId!}
                    currentOwnerId={data.responsavel?.id ?? null}
                    usuarios={usuarios}
                    onChanged={() => { qc.invalidateQueries({ queryKey: ["cliente-detalhe", empresaId] }); qc.invalidateQueries({ queryKey: ["cf2-clientes"] }); }}
                  />
                </div>

                <Secao titulo="Resumo financeiro" acao={{ label: "Ver financeiro", onClick: () => setTab("Financeiro") }}>
                  <div className="grid grid-cols-2 gap-3">
                    <Campo label="MRR Atual" valor={brl(data.currentMrr)} />
                    <Campo label="Próxima fatura" valor={data.proximaFatura ? `${brl(data.proximaFatura.valor)} · ${brlData(data.proximaFatura.vencimento)}` : "—"} />
                  </div>
                  {data.faturasAtrasadas > 0 && (
                    <p className="text-[11px] font-semibold mt-1" style={{ color: "var(--cf2-danger-text)" }}>{data.faturasAtrasadas} fatura(s) atrasada(s)</p>
                  )}
                </Secao>

                <Secao titulo={`Serviços ativos (${servicosAtivos.length})`} acao={{ label: "Ver todos", onClick: () => setTab("Serviços") }}>
                  <div className="flex flex-col gap-2">
                    {servicosAtivos.slice(0, 3).map((s) => <ServicoRow key={s.id} servico={s} />)}
                    {servicosAtivos.length === 0 && <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum serviço ativo.</p>}
                  </div>
                </Secao>

                <Secao titulo={`Contratos (${contratos.length})`} acao={{ label: "Ver contratos", onClick: () => setTab("Contratos") }}>
                  <div className="flex flex-col gap-2">
                    {contratos.slice(0, 3).map((contrato) => <ContratoRow key={contrato.id} contrato={contrato} anexos={anexosContrato} />)}
                    {contratos.length === 0 && <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum contrato vinculado a este cliente.</p>}
                    {contratos.length > 3 && <button onClick={() => setTab("Contratos")} className="text-left text-[11px] font-semibold" style={{ color: "var(--cf2-accent-border)" }}>+ {contratos.length - 3} contrato(s)</button>}
                  </div>
                </Secao>

                <Secao titulo="Últimas atividades" acao={{ label: "Ver todas", onClick: () => setTab("Atividades") }}>
                  <div className="flex flex-col gap-2">
                    {atividadesRecentes.slice(0, 4).map((a) => <AtividadeRow key={a.id} atividade={a} />)}
                    {atividadesRecentes.length === 0 && <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma atividade registrada.</p>}
                  </div>
                </Secao>

                <Secao titulo="Próxima ação">
                  {proximasAcoes[0] ? (
                    <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                      <div>
                        <p className="text-[12px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{proximasAcoes[0].titulo}</p>
                        <p className="text-[11px]" style={{ color: "var(--cf2-text-secondary)" }}>{brlData(proximasAcoes[0].venceEm)} · {proximasAcoes[0].usuarioNome || "—"}</p>
                      </div>
                      <a href={`/clientes/${empresaId}`} className="text-[11px] font-bold px-3 py-1.5 rounded-full shrink-0" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>
                        Abrir cliente 360
                      </a>
                    </div>
                  ) : (
                    <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma ação futura agendada pra esse cliente.</p>
                  )}
                </Secao>
              </>
            )}

            {tab === "Serviços" && (
              <div className="flex flex-col gap-2">
                {servicos.map((s) => <ServicoRow key={s.id} servico={s} />)}
                {servicos.length === 0 && <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum serviço encontrado.</p>}
              </div>
            )}

            {tab === "Contratos" && (
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase" style={{ color: "var(--cf2-text-tertiary)" }}>Contratos do cliente</p>
                  <p className="text-[12px] mt-1" style={{ color: "var(--cf2-text-secondary)" }}>Contratos e documentos vinculados a este cliente.</p>
                </div>
                {contratos.map((contrato) => <ContratoRow key={contrato.id} contrato={contrato} anexos={anexosContrato} />)}
                {anexosLoading && contratos.length > 0 && <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>Verificando arquivos históricos...</p>}
                {contratos.length === 0 && <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum contrato vinculado a este cliente.</p>}
              </div>
            )}

            {tab === "Financeiro" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="MRR Atual" valor={brl(data.currentMrr)} />
                  <Campo label="Cliente desde" valor={brlData(data.clienteDesde)} />
                  <Campo label="Próxima fatura" valor={data.proximaFatura ? `${brl(data.proximaFatura.valor)} · ${brlData(data.proximaFatura.vencimento)}` : "—"} />
                  <Campo label="Faturas atrasadas" valor={String(data.faturasAtrasadas)} tone={data.faturasAtrasadas > 0 ? "var(--cf2-danger-text)" : undefined} />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase mb-2" style={{ color: "var(--cf2-text-tertiary)" }}>MRR mensal (mrr_movimentos — só produtos AI/Stripe-sync)</p>
                  {mrrMensal.length > 0 ? (
                    <Cf2MrrMensalChart dados={mrrMensal} />
                  ) : (
                    <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Sem série de MRR (cliente sem produto no ledger AI/Stripe-sync — não fabricado).</p>
                  )}
                </div>
              </>
            )}

            {tab === "Atividades" && (
              <div className="flex flex-col gap-2">
                {atividadesRecentes.map((a) => <AtividadeRow key={a.id} atividade={a} />)}
                {atividadesRecentes.length === 0 && <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma atividade registrada.</p>}
              </div>
            )}

            {tab === "Riscos" && (
              <div className="flex flex-col gap-3">
                {data.faturasAtrasadas > 0 ? (
                  <div className="p-3 rounded-xl" style={{ background: "rgba(229,51,51,0.08)" }}>
                    <p className="text-[12px] font-bold" style={{ color: "var(--cf2-danger-text)" }}>Risco alto — fatura atrasada</p>
                    <p className="text-[11px] mt-1" style={{ color: "var(--cf2-text-secondary)" }}>{data.faturasAtrasadas} fatura(s) em aberto vencida(s). Único sinal real usado hoje pra classificar risco.</p>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl" style={{ background: "var(--cf2-success-bg)" }}>
                    <p className="text-[12px] font-bold" style={{ color: "var(--cf2-success-text)" }}>Risco baixo</p>
                    <p className="text-[11px] mt-1" style={{ color: "var(--cf2-text-secondary)" }}>Nenhuma fatura atrasada no momento.</p>
                  </div>
                )}
                <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>
                  "Sem próxima ação" e "sem atividade recente" foram descartados como sinal de risco — 0% e 71% da base caem neles hoje, respectivamente, o que os torna ruído, não indicador real.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </DetailDrawer>
  );
}

function Secao({ titulo, acao, children }: { titulo: string; acao?: { label: string; onClick: () => void }; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase" style={{ color: "var(--cf2-text-tertiary)" }}>{titulo}</p>
        {acao && (
          <button onClick={acao.onClick} className="text-[11px] font-semibold" style={{ color: "var(--cf2-accent-border)" }}>{acao.label} →</button>
        )}
      </div>
      {children}
    </div>
  );
}

function Campo({ label, valor, tone }: { label: string; valor: string; tone?: string }) {
  return (
    <div>
      <p className="text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>{label}</p>
      <p className="text-[13px] font-bold" style={{ color: tone || "var(--cf2-text-primary)" }}>{valor}</p>
    </div>
  );
}

function ServicoRow({ servico }: { servico: Servico }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)" }}>
      <div className="min-w-0">
        <p className="text-[12px] font-bold truncate" style={{ color: "var(--cf2-text-primary)" }}>{servico.canonicalProduct || FAMILIA_LABEL[servico.serviceFamily] || servico.serviceFamily}</p>
        <p className="text-[11px]" style={{ color: "var(--cf2-text-secondary)" }}>{servico.portfolioIncluded ? "Ativo" : servico.commercialLifecycle}</p>
      </div>
      <p className="text-[12px] font-bold shrink-0" style={{ color: "var(--cf2-success-text)" }}>{brl(servico.currentRecurringValue)}</p>
    </div>
  );
}

function ContratoRow({ contrato, anexos }: { contrato: ContratoCliente; anexos: AnexoLegado[] }) {
  const anexo = anexos.find((item) => item.entidadeId === contrato.id);
  const documento = contrato.temCorpoGerado ? (
    <a href={`/api/contratos/${contrato.id}/pdf`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] underline" style={{ color: "var(--cf2-text-secondary)" }}>
      <FileText className="w-3 h-3" /> Ver contrato
    </a>
  ) : anexo?.arquivoDisponivel ? (
    <a href={`/api/anexos-legado/${anexo.id}/download`} className="inline-flex items-center gap-1 text-[11px] underline" style={{ color: "var(--cf2-text-secondary)" }}>
      <Download className="w-3 h-3" /> {anexo.nomeArquivo || "Baixar documento"}
    </a>
  ) : anexo ? (
    <span className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{anexo.nomeArquivo} · indisponível</span>
  ) : (
    <span className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>Sem documento</span>
  );

  return (
    <div className="flex flex-col gap-2 p-3 rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-bold truncate" style={{ color: "var(--cf2-text-primary)" }}>{contrato.descricao || contrato.tipo || "Contrato"}</p>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--cf2-text-secondary)" }}>
            <span style={{ color: CONTRATO_STATUS_COLOR[contrato.status] || "var(--cf2-text-secondary)" }}>{CONTRATO_STATUS_LABEL[contrato.status] || contrato.status}</span>
            {contrato.mrr || contrato.currentRecurringValue ? ` · ${brl(contrato.mrr || contrato.currentRecurringValue || "0")}/mês` : ""}
          </p>
        </div>
        <FileText className="w-4 h-4 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Campo label="Início" valor={brlData(contrato.inicio)} />
        <Campo label="Vencimento" valor={brlData(contrato.vencimento)} />
      </div>
      {documento}
    </div>
  );
}

function AtividadeRow({ atividade }: { atividade: Atividade }) {
  const Icon = CANAL_ICON[atividade.tipo] || StickyNote;
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex items-center justify-center rounded-lg shrink-0 w-7 h-7" style={{ background: "var(--cf2-bg-surface-muted)" }}>
        <Icon className="w-3.5 h-3.5" style={{ color: "var(--cf2-text-secondary)" }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold truncate" style={{ color: "var(--cf2-text-primary)" }}>
          {CANAL_LABEL[atividade.tipo] || atividade.tipo}{atividade.pessoaNome ? ` · ${atividade.pessoaNome}` : ""}
        </p>
        <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{new Date(atividade.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
      </div>
    </div>
  );
}
