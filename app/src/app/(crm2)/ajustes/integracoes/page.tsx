"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Key, Eye, EyeOff, Save, CheckCircle, AlertCircle } from "lucide-react";

export default function IntegracoesPage() {
  const queryClient = useQueryClient();
  const [apolloKey, setApolloKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [dirty, setDirty] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["integracoes-config"],
    queryFn: async () => {
      const res = await fetch("/api/configuracoes/integracoes");
      if (!res.ok) throw new Error("Erro ao carregar");
      return res.json();
    },
  });

  const { data: credits } = useQuery({
    queryKey: ["apollo-credits"],
    queryFn: async () => {
      const res = await fetch("/api/apollo/credits");
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!data?.apolloConfigured,
  });

  const saveMut = useMutation({
    mutationFn: async (key: string) => {
      const res = await fetch("/api/configuracoes/integracoes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apolloApiKey: key }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao salvar");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integracoes-config"] });
      setDirty(false);
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--cf2-text-primary)]">Integrações</h1>
        <p className="text-sm text-[var(--cf2-text-tertiary)] mt-1">Configure as chaves de API das integrações da sua organização.</p>
      </div>

      {/* Apollo.io */}
      <div className="bg-[var(--cf2-bg-surface)] rounded-xl p-6 border border-[var(--cf2-border-default)]">
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-5 h-5 text-[var(--cf2-text-secondary)]" />
          <h2 className="text-lg font-semibold text-[var(--cf2-text-primary)]">Apollo.io</h2>
          {data?.apolloConfigured && !dirty && (
            <span className="flex items-center gap-1 text-xs text-[var(--cf2-success-text)] ml-auto">
              <CheckCircle className="w-3.5 h-3.5" /> Configurado
            </span>
          )}
          {!data?.apolloConfigured && !isLoading && (
            <span className="flex items-center gap-1 text-xs text-[var(--cf2-warning-text)] ml-auto">
              <AlertCircle className="w-3.5 h-3.5" /> Não configurado
            </span>
          )}
        </div>

        <p className="text-xs text-[var(--cf2-text-tertiary)] mb-3">
          A API key do Apollo.io é usada para enriquecer leads e empresas com dados públicos.
          Obtenha sua key em{" "}
          <a href="https://app.apollo.io/#/settings/integrations/api" target="_blank" rel="noopener" className="text-[var(--cf2-text-secondary)] hover:underline">
            apollo.io/settings
          </a>.
        </p>
        <p className="text-[10px] text-[var(--cf2-text-tertiary)] mt-1">Enriquece leads e empresas com dados públicos: cargo, setor, tamanho, LinkedIn e mais.</p>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              className="w-full bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] rounded-lg px-3 py-2.5 text-sm text-[var(--cf2-text-primary)] font-mono pr-10 focus:border-purple-500/40 focus:outline-none transition-colors"
              type={showKey ? "text" : "password"}
              placeholder={data?.apolloConfigured ? data.apolloApiKey : "Cole a API key do Apollo.io aqui"}
              value={apolloKey}
              onChange={(e) => { setApolloKey(e.target.value); setDirty(true); }}
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--cf2-text-tertiary)] hover:text-[var(--cf2-text-secondary)] transition-colors"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <button
            onClick={() => saveMut.mutate(apolloKey)}
            disabled={!dirty || saveMut.isPending}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium bg-purple-500/20 text-[var(--cf2-text-secondary)] hover:bg-purple-500/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {saveMut.isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>

        {saveMut.isSuccess && (
          <p className="text-xs text-[var(--cf2-success-text)] mt-2">API key salva com sucesso!</p>
        )}
        {saveMut.isError && (
          <p className="text-xs text-[var(--cf2-danger-text)] mt-2">{(saveMut.error as Error).message}</p>
        )}

        {/* Credit balance */}
        {credits?.configured && (
          <div className="mt-4 pt-4 border-t border-[var(--cf2-border-default)]">
            <h3 className="text-sm font-medium text-[var(--cf2-text-primary)] mb-3">Uso de Créditos</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-[var(--cf2-bg-surface)] rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-[var(--cf2-text-primary)]">{credits.credits_used?.toLocaleString() ?? "—"}</p>
                <p className="text-[11px] text-[var(--cf2-text-tertiary)]">Consumidos</p>
              </div>
              <div className="bg-[var(--cf2-bg-surface)] rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-[var(--cf2-success-text)]">{credits.credits_remaining?.toLocaleString() ?? "—"}</p>
                <p className="text-[11px] text-[var(--cf2-text-tertiary)]">Disponíveis</p>
              </div>
              <div className="bg-[var(--cf2-bg-surface)] rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-[var(--cf2-text-secondary)]">{credits.credits_limit?.toLocaleString() ?? "—"}</p>
                <p className="text-[11px] text-[var(--cf2-text-tertiary)]">Limite total</p>
              </div>
            </div>
            {credits.plan && (
              <p className="text-[11px] text-[var(--cf2-text-tertiary)] mt-2">Plano: {credits.plan}</p>
            )}
            <div className="mt-3 text-[11px] text-[var(--cf2-text-tertiary)]">
              <p className="font-medium text-[var(--cf2-text-secondary)] mb-1">Custo por ação:</p>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                <span>Enriquecer lead: 1 crédito</span>
                <span>Enriquecer empresa: 1 crédito</span>
                <span>Revelar email: +1 crédito</span>
                <span>Busca Apollo: 1 crédito</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* O QUE EXISTE DE VERDADE.
          Aqui havia dois cartões com "(placeholder)" no próprio código — Meta
          Conversions API e Google Ads Offline Conversions — enquanto cinco
          integrações rodavam em produção sem aparecer em lugar nenhum:
          discador Callface (4.918 ligações), Stripe (828 faturas), Meta Lead
          Ads (797 leads), Callface AI (208 snapshots) e Microsoft 365 (58
          reuniões). Quem abria esta tela concluía que o produto tinha uma
          integração configurada.

          O estado de cada linha é DERIVADO de sinal no banco, não declarado. */}
      <Inventario />
    </div>
  );
}


const ESTADO = {
  em_uso: { rotulo: "Em uso", cor: "var(--cf2-success-text)" },
  configurada: { rotulo: "Configurada, sem uso ainda", cor: "var(--cf2-text-secondary)" },
  nao_configurada: { rotulo: "Não configurada", cor: "var(--cf2-warning-text)" },
} as const;

interface LinhaIntegracao {
  chave: string; nome: string; paraQue: string;
  estado: keyof typeof ESTADO;
  volume: number | null; rotuloVolume: string | null;
  ultimoSinal: string | null; pendencia: string | null;
}

function Inventario() {
  const { data, isLoading } = useQuery({
    queryKey: ["integracoes-inventario"],
    queryFn: async () => {
      const res = await fetch("/api/configuracoes/integracoes/inventario");
      if (!res.ok) throw new Error("Falha ao carregar as integrações");
      return res.json() as Promise<{ integracoes: LinhaIntegracao[] }>;
    },
  });

  return (
    <div className="bg-[var(--cf2-bg-surface)] rounded-xl p-6 border border-[var(--cf2-border-default)]">
      <h2 className="text-lg font-semibold text-[var(--cf2-text-primary)] mb-1">Integrações do sistema</h2>
      <p className="text-xs text-[var(--cf2-text-tertiary)] mb-4">
        O estado de cada uma vem do que ela produziu no banco, não de uma lista fixa.
      </p>
      {isLoading ? (
        <p className="text-sm text-[var(--cf2-text-tertiary)]">Carregando…</p>
      ) : (
        <div className="flex flex-col divide-y divide-[var(--cf2-border-default)]">
          {(data?.integracoes ?? []).map((i) => (
            <div key={i.chave} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-sm font-semibold text-[var(--cf2-text-primary)]">{i.nome}</span>
                <span className="text-[11px] font-medium" style={{ color: ESTADO[i.estado].cor }}>
                  {ESTADO[i.estado].rotulo}
                </span>
                {/* Volume e data juntos: "828 faturas" sem data não diz se
                    parou ontem ou há seis meses. */}
                {i.volume !== null && i.volume > 0 && (
                  <span className="text-[11px] text-[var(--cf2-text-tertiary)] ml-auto tabular-nums">
                    {i.volume.toLocaleString("pt-BR")} {i.rotuloVolume}
                    {i.ultimoSinal ? ` · último em ${new Date(i.ultimoSinal + "T00:00:00").toLocaleDateString("pt-BR")}` : ""}
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--cf2-text-tertiary)]">{i.paraQue}</p>
              {i.pendencia && (
                <p className="text-xs" style={{ color: "var(--cf2-warning-text)" }}>{i.pendencia}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
