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
        <h1 className="text-xl font-bold text-white">Integrações</h1>
        <p className="text-sm text-white/40 mt-1">Configure as chaves de API das integrações da sua organização.</p>
      </div>

      {/* Apollo.io */}
      <div className="bg-[rgba(255,255,255,0.03)] rounded-xl p-6 border border-white/[0.06]">
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-semibold text-white">Apollo.io</h2>
          {data?.apolloConfigured && !dirty && (
            <span className="flex items-center gap-1 text-xs text-emerald-400 ml-auto">
              <CheckCircle className="w-3.5 h-3.5" /> Configurado
            </span>
          )}
          {!data?.apolloConfigured && !isLoading && (
            <span className="flex items-center gap-1 text-xs text-amber-400 ml-auto">
              <AlertCircle className="w-3.5 h-3.5" /> Não configurado
            </span>
          )}
        </div>

        <p className="text-xs text-white/40 mb-3">
          A API key do Apollo.io é usada para enriquecer leads e empresas com dados públicos.
          Obtenha sua key em{" "}
          <a href="https://app.apollo.io/#/settings/integrations/api" target="_blank" rel="noopener" className="text-purple-400 hover:underline">
            apollo.io/settings
          </a>.
        </p>
        <p className="text-[10px] text-white/25 mt-1">Enriquece leads e empresas com dados públicos: cargo, setor, tamanho, LinkedIn e mais.</p>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2.5 text-sm text-white font-mono pr-10 focus:border-purple-500/40 focus:outline-none transition-colors"
              type={showKey ? "text" : "password"}
              placeholder={data?.apolloConfigured ? data.apolloApiKey : "Cole a API key do Apollo.io aqui"}
              value={apolloKey}
              onChange={(e) => { setApolloKey(e.target.value); setDirty(true); }}
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <button
            onClick={() => saveMut.mutate(apolloKey)}
            disabled={!dirty || saveMut.isPending}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {saveMut.isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>

        {saveMut.isSuccess && (
          <p className="text-xs text-emerald-400 mt-2">API key salva com sucesso!</p>
        )}
        {saveMut.isError && (
          <p className="text-xs text-red-400 mt-2">{(saveMut.error as Error).message}</p>
        )}

        {/* Credit balance */}
        {credits?.configured && (
          <div className="mt-4 pt-4 border-t border-white/[0.06]">
            <h3 className="text-sm font-medium text-white mb-3">Uso de Créditos</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white/[0.03] rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-white">{credits.credits_used?.toLocaleString() ?? "—"}</p>
                <p className="text-[11px] text-white/40">Consumidos</p>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-emerald-400">{credits.credits_remaining?.toLocaleString() ?? "—"}</p>
                <p className="text-[11px] text-white/40">Disponíveis</p>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-white/60">{credits.credits_limit?.toLocaleString() ?? "—"}</p>
                <p className="text-[11px] text-white/40">Limite total</p>
              </div>
            </div>
            {credits.plan && (
              <p className="text-[11px] text-white/30 mt-2">Plano: {credits.plan}</p>
            )}
            <div className="mt-3 text-[11px] text-white/30">
              <p className="font-medium text-white/50 mb-1">Custo por ação:</p>
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

      {/* Meta CAPI (placeholder) */}
      <div className="bg-[rgba(255,255,255,0.03)] rounded-xl p-6 border border-white/[0.06]">
        <h2 className="text-lg font-semibold text-white mb-2">Meta Conversions API</h2>
        <p className="text-sm text-white/30">Em breve — configuração do Pixel ID e Access Token.</p>
      </div>

      {/* Google Ads (placeholder) */}
      <div className="bg-[rgba(255,255,255,0.03)] rounded-xl p-6 border border-white/[0.06]">
        <h2 className="text-lg font-semibold text-white mb-2">Google Ads Offline Conversions</h2>
        <p className="text-sm text-white/30">Em breve — configuração do Customer ID e Conversion Action.</p>
      </div>
    </div>
  );
}
