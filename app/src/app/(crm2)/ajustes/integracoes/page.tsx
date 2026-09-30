"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Key, Eye, EyeOff, Save, CheckCircle, AlertCircle, Mail, ArrowRight, Bot, Loader2, ShieldCheck } from "lucide-react";

type AiProvider = "openai" | "anthropic" | "groq" | "google";

type AiCredential = {
  id: string;
  provider: AiProvider;
  label: string;
  masked: string;
  ativo: boolean;
  validatedAt: string | null;
  validationError: string | null;
};

const AI_PROVIDER_LABEL: Record<AiProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic (Claude)",
  groq: "Groq",
  google: "Google AI",
};

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
        <p className="text-sm text-[var(--cf2-text-tertiary)] mt-1">Configure as chaves de API das integrações da sua organização.</p>
      </div>

      <div className="bg-[var(--cf2-bg-surface)] rounded-xl p-6 border border-[var(--cf2-border-default)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0067B8]/15 text-[#1683D8]">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--cf2-text-primary)]">Microsoft 365</h2>
              <p className="mt-1 text-xs text-[var(--cf2-text-tertiary)]">
                Conecte Outlook e Microsoft 365 para enviar, receber e sincronizar e-mails pelo ONFACE.
              </p>
            </div>
          </div>
          <Link
            href="/ajustes/email"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#0067B8] px-3 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
          >
            Configurar Microsoft
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      <AiProviders />

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

function AiProviders() {
  const queryClient = useQueryClient();
  const [provider, setProvider] = useState<AiProvider>("openai");
  const [label, setLabel] = useState("OpenAI principal");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["ai-provider-credentials"],
    queryFn: async () => {
      const res = await fetch("/api/automacoes/ai/credentials");
      if (!res.ok) throw new Error("Falha ao carregar credenciais de IA");
      return res.json() as Promise<{ credentials: AiCredential[] }>;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/automacoes/ai/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, label: label.trim(), apiKey }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Não foi possível salvar a credencial");
      return body as AiCredential;
    },
    onSuccess: () => {
      setApiKey("");
      setShowApiKey(false);
      queryClient.invalidateQueries({ queryKey: ["ai-provider-credentials"] });
    },
  });

  const validateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/automacoes/ai/credentials/${id}/validate`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error || "A credencial não respondeu ao teste");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai-provider-credentials"] }),
  });

  const canSave = label.trim().length > 0 && apiKey.trim().length >= 8 && !createMutation.isPending;
  const credentials = data?.credentials ?? [];

  return (
    <div className="bg-[var(--cf2-bg-surface)] rounded-xl p-6 border border-[var(--cf2-border-default)]">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--cf2-accent)]/15 text-[var(--cf2-accent)]">
          <Bot className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[var(--cf2-text-primary)]">IA e agentes</h2>
          <p className="mt-1 text-xs text-[var(--cf2-text-tertiary)]">
            Credenciais por organização para os agentes e automações do ONFACE.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)]">
        <label className="flex flex-col gap-1.5 text-xs font-medium text-[var(--cf2-text-secondary)]">
          Provedor
          <select
            value={provider}
            onChange={(event) => {
              const nextProvider = event.target.value as AiProvider;
              setProvider(nextProvider);
              setLabel(`${AI_PROVIDER_LABEL[nextProvider]} principal`);
            }}
            className="h-10 rounded-lg border border-[var(--cf2-border-default)] bg-[var(--cf2-bg-surface)] px-3 text-sm font-normal text-[var(--cf2-text-primary)] outline-none focus:border-[var(--cf2-accent)]"
          >
            {(Object.keys(AI_PROVIDER_LABEL) as AiProvider[]).map((item) => (
              <option key={item} value={item}>{AI_PROVIDER_LABEL[item]}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-[var(--cf2-text-secondary)]">
          Identificação interna
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            className="h-10 rounded-lg border border-[var(--cf2-border-default)] bg-[var(--cf2-bg-surface)] px-3 text-sm font-normal text-[var(--cf2-text-primary)] outline-none focus:border-[var(--cf2-accent)]"
            placeholder="Ex.: OpenAI produção"
          />
        </label>
      </div>

      <div className="mt-3 flex gap-2">
        <div className="relative flex-1">
          <input
            type={showApiKey ? "text" : "password"}
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            className="h-10 w-full rounded-lg border border-[var(--cf2-border-default)] bg-[var(--cf2-bg-surface)] px-3 pr-10 font-mono text-sm text-[var(--cf2-text-primary)] outline-none focus:border-[var(--cf2-accent)]"
            placeholder={`Chave de API da ${AI_PROVIDER_LABEL[provider]}`}
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => setShowApiKey((value) => !value)}
            aria-label={showApiKey ? "Ocultar chave" : "Exibir chave"}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--cf2-text-tertiary)] hover:text-[var(--cf2-text-secondary)]"
          >
            {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <button
          type="button"
          onClick={() => createMutation.mutate()}
          disabled={!canSave}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[var(--cf2-accent)] px-3 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar
        </button>
      </div>
      {createMutation.isError && <p className="mt-2 text-xs text-[var(--cf2-danger-text)]">{(createMutation.error as Error).message}</p>}

      <div className="mt-5 border-t border-[var(--cf2-border-default)] pt-4">
        <p className="text-xs font-medium text-[var(--cf2-text-secondary)]">Credenciais configuradas</p>
        {isLoading ? (
          <p className="mt-3 text-xs text-[var(--cf2-text-tertiary)]">Carregando...</p>
        ) : credentials.length === 0 ? (
          <p className="mt-3 text-xs text-[var(--cf2-text-tertiary)]">Nenhuma credencial de IA cadastrada nesta organização.</p>
        ) : (
          <div className="mt-3 divide-y divide-[var(--cf2-border-default)]">
            {credentials.map((credential) => {
              const status = credential.validatedAt
                ? "Validada"
                : credential.validationError
                  ? "Falhou no último teste"
                  : "Ainda não testada";
              const color = credential.validatedAt
                ? "var(--cf2-success-text)"
                : credential.validationError
                  ? "var(--cf2-danger-text)"
                  : "var(--cf2-warning-text)";
              return (
                <div key={credential.id} className="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--cf2-text-primary)]">
                      {AI_PROVIDER_LABEL[credential.provider]} <span className="font-normal text-[var(--cf2-text-tertiary)]">{credential.masked}</span>
                    </p>
                    <p className="text-xs text-[var(--cf2-text-tertiary)]">{credential.label}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium" style={{ color }}>{status}</span>
                    <button
                      type="button"
                      onClick={() => validateMutation.mutate(credential.id)}
                      disabled={validateMutation.isPending}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--cf2-border-default)] px-2.5 text-xs font-medium text-[var(--cf2-text-secondary)] hover:bg-[var(--cf2-bg-surface-muted)] disabled:opacity-50"
                    >
                      {validateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                      Testar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
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
