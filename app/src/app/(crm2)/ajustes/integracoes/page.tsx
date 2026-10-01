"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bot, Eye, EyeOff, Mail, MessageCircle, Phone, CreditCard, Megaphone, Calendar, Database, ShieldCheck,
  ArrowRight, Key,
} from "lucide-react";
import { Cf2Button } from "@/components/crm2/ui/Button";
import { Cf2Input } from "@/components/crm2/ui/Input";
import { SecaoAjuste, PilulaEstado, type EstadoAjuste } from "@/components/onface/ajustes/Secao";

/**
 * Integrações — redesenhada em 01/10/2026 no padrão ONFACE.
 *
 * Antes: um cartão "Microsoft 365" que só levava a E-mail, o formulário de IA,
 * o Apollo e o inventário como lista de texto, cada um com um desenho próprio
 * (botão roxo translúcido, cartão com borda). WhatsApp e e-mail, os dois
 * canais que mais caem, nem apareciam.
 *
 * Agora a tela responde de cara "o que está ligado, o que caiu e onde se
 * resolve": cartões de conexão com o estado DERIVADO do banco (escopo da
 * organização, ver `lib/integrations/inventario`). Integração cuja credencial
 * vive no servidor diz isso — não ganha botão "Conectar" que não conecta.
 */

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

type EstadoIntegracao = "em_uso" | "configurada" | "nao_configurada";

interface LinhaIntegracao {
  chave: string; nome: string; paraQue: string;
  estado: EstadoIntegracao;
  volume: number | null; rotuloVolume: string | null;
  ultimoSinal: string | null; pendencia: string | null;
  href: string | null; comErro?: number;
}

const CANAIS = new Set(["whatsapp", "email", "ia"]);

const ICONE: Record<string, typeof Mail> = {
  whatsapp: MessageCircle, email: Mail, ia: Bot, callface: Phone, stripe: CreditCard,
  meta_lead_ads: Megaphone, meta_capi: Megaphone, microsoft_graph: Calendar, google_calendar: Calendar,
  callface_ai_db: Database,
};

const ROTULO_CTA: Record<string, string> = {
  whatsapp: "Gerenciar sessões",
  email: "Gerenciar caixas",
  microsoft_graph: "Conectar Outlook",
};

function estadoVisual(i: LinhaIntegracao): { estado: EstadoAjuste; rotulo: string } {
  if ((i.comErro ?? 0) > 0 && i.estado === "em_uso") return { estado: "pendente", rotulo: "Parcial" };
  if ((i.comErro ?? 0) > 0) return { estado: "erro", rotulo: i.chave === "ia" ? "Chave com erro" : "Desconectado" };
  if (i.estado === "em_uso") return { estado: "ok", rotulo: i.chave === "whatsapp" || i.chave === "email" ? "Conectado" : "Em uso" };
  if (i.estado === "configurada") return { estado: "neutro", rotulo: "Configurada" };
  return { estado: "pendente", rotulo: "Não configurada" };
}

const dataBr = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR");

function CartaoConexao({ i }: { i: LinhaIntegracao }) {
  const Icone = ICONE[i.chave] ?? Key;
  const { estado, rotulo } = estadoVisual(i);
  return (
    <article className="aj-conexao">
      <div className="aj-conexao-topo">
        <span className="aj-conexao-icone"><Icone aria-hidden /></span>
        <h3 className="aj-conexao-nome">{i.nome}</h3>
        <span className="ml-auto"><PilulaEstado estado={estado}>{rotulo}</PilulaEstado></span>
      </div>
      <p className="aj-conexao-texto">{i.paraQue[0].toUpperCase() + i.paraQue.slice(1)}.</p>
      {i.volume !== null && i.volume > 0 && (
        // Volume e data juntos: "828 faturas" sem data não diz se parou ontem ou há seis meses.
        <span className="aj-conexao-fato">
          {i.volume.toLocaleString("pt-BR")} {i.rotuloVolume}
          {i.ultimoSinal ? <span className="font-normal text-[var(--text-muted)]"> · último em {dataBr(i.ultimoSinal)}</span> : null}
        </span>
      )}
      {i.pendencia && <p className="aj-conexao-pendencia">{i.pendencia[0].toUpperCase() + i.pendencia.slice(1)}.</p>}
      <div className="aj-conexao-rodape">
        {i.href ? (
          <Cf2Button asChild size="sm" variant={estado === "ok" ? "secondary" : "primary"}>
            <Link href={i.href}>{ROTULO_CTA[i.chave] ?? "Configurar"} <ArrowRight aria-hidden /></Link>
          </Cf2Button>
        ) : i.chave === "ia" ? (
          <a href="#aj-ia" className="aj-link">Chaves de IA da organização</a>
        ) : (
          <span>Credencial no servidor, configurada pelo time técnico.</span>
        )}
      </div>
    </article>
  );
}

export default function IntegracoesPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["integracoes-inventario"],
    queryFn: async () => {
      const res = await fetch("/api/configuracoes/integracoes/inventario");
      if (res.status === 403) throw new Error("Só administradores veem o estado das integrações.");
      if (!res.ok) throw new Error("Não foi possível carregar as integrações.");
      return res.json() as Promise<{ integracoes: LinhaIntegracao[] }>;
    },
  });

  const lista = data?.integracoes ?? [];
  const canais = ["whatsapp", "email", "ia"].map((k) => lista.find((i) => i.chave === k)).filter(Boolean) as LinhaIntegracao[];

  return (
    <div className="aj-secoes">
      <SecaoAjuste
        titulo="Canais da organização"
        ajuda="O que a própria organização conecta. O estado vem das sessões e caixas cadastradas, não de uma lista fixa."
      >
        {isLoading ? (
          <p className="aj-grupo-ajuda">Carregando conexões…</p>
        ) : isError ? (
          <div className="aj-vazio"><strong>{(error as Error).message}</strong></div>
        ) : (
          <div className="aj-conexoes">{canais.map((i) => <CartaoConexao key={i.chave} i={i} />)}</div>
        )}
      </SecaoAjuste>

      <AiProviders />

      <ClaudeSubscription />

      <Apollo />

      {/* O QUE EXISTE DE VERDADE.
          Aqui havia dois cartões com "(placeholder)" no próprio código — Meta
          Conversions API e Google Ads Offline Conversions — enquanto cinco
          integrações rodavam em produção sem aparecer em lugar nenhum:
          discador Callface (4.918 ligações), Stripe (828 faturas), Meta Lead
          Ads (797 leads), Callface AI (208 snapshots) e Microsoft 365 (58
          reuniões). Quem abria esta tela concluía que o produto tinha uma
          integração configurada.

          O estado de cada linha é DERIVADO de sinal no banco, não declarado. */}
      <Inventario lista={lista.filter((i) => !CANAIS.has(i.chave))} carregando={isLoading} />
    </div>
  );
}

function Inventario({ lista, carregando }: { lista: LinhaIntegracao[]; carregando: boolean }) {
  return (
    <SecaoAjuste
      titulo="Integrações do sistema"
      ajuda="Stripe, discador, Meta, agenda e o banco do Callface AI. Estado medido pelo que cada uma já produziu nesta organização."
    >
      {carregando ? (
        <p className="aj-grupo-ajuda">Carregando…</p>
      ) : (
        <div className="aj-conexoes">{lista.map((i) => <CartaoConexao key={i.chave} i={i} />)}</div>
      )}
    </SecaoAjuste>
  );
}

function Apollo() {
  const queryClient = useQueryClient();
  const [apolloKey, setApolloKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["integracoes-config"],
    queryFn: async () => {
      const res = await fetch("/api/configuracoes/integracoes");
      if (!res.ok) throw new Error("Erro ao carregar");
      return res.json() as Promise<{ apolloApiKey: string; apolloConfigured: boolean }>;
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
    onSuccess: (_d, key) => {
      queryClient.invalidateQueries({ queryKey: ["integracoes-config"] });
      setApolloKey("");
      toast.success(key ? "Chave do Apollo salva." : "Chave do Apollo removida.");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const configurado = Boolean(data?.apolloConfigured);

  return (
    <SecaoAjuste
      titulo="Apollo.io"
      ajuda={<>Enriquece leads e empresas com cargo, setor, tamanho e LinkedIn. A chave fica em{" "}
        <a href="https://app.apollo.io/#/settings/integrations/api" target="_blank" rel="noopener noreferrer" className="aj-link">apollo.io → Settings → API</a>.</>}
      acao={!isLoading && (
        <PilulaEstado estado={configurado ? "ok" : "pendente"}>{configurado ? "Configurado" : "Não configurado"}</PilulaEstado>
      )}
    >
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => { e.preventDefault(); if (apolloKey.trim()) saveMut.mutate(apolloKey.trim()); }}
      >
        <div className="relative flex-1">
          <Cf2Input
            type={showKey ? "text" : "password"}
            aria-label="Chave de API do Apollo"
            className="pr-10 font-mono"
            placeholder={configurado ? `Chave atual ${data?.apolloApiKey} — cole outra para trocar` : "Cole a chave de API do Apollo"}
            value={apolloKey}
            autoComplete="off"
            onChange={(e) => setApolloKey(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            aria-label={showKey ? "Ocultar chave" : "Exibir chave"}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-strong)]"
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <Cf2Button type="submit" disabled={!apolloKey.trim()} loading={saveMut.isPending}>Salvar chave</Cf2Button>
        {configurado && (
          <Cf2Button
            type="button"
            variant="ghost"
            disabled={saveMut.isPending}
            onClick={() => { if (confirm("Remover a chave do Apollo? O enriquecimento para de funcionar.")) saveMut.mutate(""); }}
          >
            Remover
          </Cf2Button>
        )}
      </form>

      {credits?.configured && (
        <dl className="aj-fatos">
          <div className="aj-fato"><dt>Créditos consumidos</dt><dd>{credits.credits_used?.toLocaleString("pt-BR") ?? "—"}</dd></div>
          <div className="aj-fato"><dt>Disponíveis</dt><dd>{credits.credits_remaining?.toLocaleString("pt-BR") ?? "—"}</dd></div>
          <div className="aj-fato"><dt>Limite do plano{credits.plan ? ` (${credits.plan})` : ""}</dt><dd>{credits.credits_limit?.toLocaleString("pt-BR") ?? "—"}</dd></div>
          <div className="aj-fato"><dt>Custo</dt><dd className="font-normal text-[var(--text-muted)]">1 crédito por enriquecimento ou busca; revelar e-mail +1</dd></div>
        </dl>
      )}
    </SecaoAjuste>
  );
}

function AiProviders() {
  const queryClient = useQueryClient();
  const [provider, setProvider] = useState<AiProvider>("anthropic");
  const [label, setLabel] = useState("Anthropic (Claude) principal");
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

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ["ai-provider-credentials"] });
    queryClient.invalidateQueries({ queryKey: ["integracoes-inventario"] });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/automacoes/ai/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, label: label.trim(), apiKey }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) throw new Error("Seu papel não pode configurar IA (permissão ai.configure).");
      if (!res.ok) throw new Error(body.error || "Não foi possível salvar a credencial");
      return body as AiCredential;
    },
    onSuccess: () => {
      setApiKey("");
      setShowApiKey(false);
      invalidar();
      toast.success("Credencial salva. Use \"Testar\" para confirmar que ela responde.");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const validateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/automacoes/ai/credentials/${id}/validate`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error || "A credencial não respondeu ao teste");
    },
    onSuccess: () => { invalidar(); toast.success("A credencial respondeu."); },
    onError: (e) => { invalidar(); toast.error((e as Error).message); },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const res = await fetch(`/api/automacoes/ai/credentials/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo }),
      });
      if (!res.ok) throw new Error("Não foi possível alterar a credencial");
    },
    onSuccess: (_d, v) => { invalidar(); toast.success(v.ativo ? "Credencial reativada." : "Credencial desativada."); },
    onError: (e) => toast.error((e as Error).message),
  });

  const canSave = label.trim().length > 0 && apiKey.trim().length >= 8;
  const credentials = data?.credentials ?? [];

  return (
    <SecaoAjuste
      id="aj-ia"
      titulo="Chaves de IA da organização"
      ajuda="Usadas pelos agentes, pelo NEXO e pelas automações. Com uma chave própria ativa, ela tem prioridade sobre a IA da plataforma. A chave é cifrada e nunca volta para a tela."
    >
      {isLoading ? (
        <p className="aj-grupo-ajuda">Carregando…</p>
      ) : credentials.length === 0 ? (
        <div className="aj-vazio">
          <strong>Nenhuma chave própria cadastrada.</strong>
          Os agentes usam a IA da plataforma, quando o servidor tem uma. Para usar a conta da organização, cadastre a chave abaixo.
        </div>
      ) : (
        <ul className="aj-lista">
          {credentials.map((c) => {
            const estado: EstadoAjuste = !c.ativo ? "neutro" : c.validationError ? "erro" : c.validatedAt ? "ok" : "pendente";
            const rotulo = !c.ativo ? "Desativada" : c.validationError ? "Falhou no teste" : c.validatedAt ? "Validada" : "Não testada";
            return (
              <li key={c.id} className="aj-linha">
                <span className="aj-conexao-icone"><Bot aria-hidden /></span>
                <div className="aj-linha-corpo">
                  <span className="aj-linha-titulo">{AI_PROVIDER_LABEL[c.provider] ?? c.provider} <span className="aj-mono">{c.masked}</span></span>
                  <span className="aj-linha-meta">{c.label}{c.validationError ? ` — ${c.validationError.slice(0, 120)}` : ""}</span>
                </div>
                <div className="aj-linha-acoes">
                  <PilulaEstado estado={estado}>{rotulo}</PilulaEstado>
                  {c.ativo && (
                    <Cf2Button
                      size="sm"
                      variant="secondary"
                      onClick={() => validateMutation.mutate(c.id)}
                      loading={validateMutation.isPending && validateMutation.variables === c.id}
                    >
                      <ShieldCheck aria-hidden /> Testar
                    </Cf2Button>
                  )}
                  <Cf2Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleMutation.mutate({ id: c.id, ativo: !c.ativo })}
                    disabled={toggleMutation.isPending}
                  >
                    {c.ativo ? "Desativar" : "Reativar"}
                  </Cf2Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form
        className="flex flex-col gap-3 border-t border-[var(--line-hairline)] pt-4"
        onSubmit={(e) => { e.preventDefault(); if (canSave) createMutation.mutate(); }}
      >
        <div className="aj-campos">
          <label className="aj-campo">
            <span>Provedor</span>
            <select
              value={provider}
              onChange={(event) => {
                const nextProvider = event.target.value as AiProvider;
                setProvider(nextProvider);
                setLabel(`${AI_PROVIDER_LABEL[nextProvider]} principal`);
              }}
              className="h-9 rounded-control border border-input bg-[var(--surface-card)] px-3 text-sm text-[var(--text-strong)]"
            >
              {(Object.keys(AI_PROVIDER_LABEL) as AiProvider[]).map((item) => (
                <option key={item} value={item}>{AI_PROVIDER_LABEL[item]}</option>
              ))}
            </select>
          </label>
          <label className="aj-campo">
            <span>Nome interno</span>
            <Cf2Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Ex.: Claude produção" />
          </label>
        </div>
        <label className="aj-campo">
          <span>Chave de API</span>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Cf2Input
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                className="pr-10 font-mono"
                placeholder={`Chave da ${AI_PROVIDER_LABEL[provider]}`}
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowApiKey((value) => !value)}
                aria-label={showApiKey ? "Ocultar chave" : "Exibir chave"}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-strong)]"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <Cf2Button type="submit" disabled={!canSave} loading={createMutation.isPending}>
              Adicionar chave
            </Cf2Button>
          </div>
        </label>
      </form>
    </SecaoAjuste>
  );
}

/** A assinatura Claude não é uma API key cadastrável pela organização. */
function ClaudeSubscription() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["claude-subscription"],
    queryFn: async () => {
      const res = await fetch("/api/automacoes/ai/claude-subscription");
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Não foi possível verificar a conexão Claude.");
      return body as { configured: boolean };
    },
  });
  const verify = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/automacoes/ai/claude-subscription/test", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error || "A assinatura Claude não respondeu ao teste.");
      return body as { response: string; durationMs: number };
    },
    onSuccess: (body) => {
      queryClient.invalidateQueries({ queryKey: ["claude-subscription"] });
      toast.success(`Claude conectado e validado (${body.response}).`);
    },
    onError: (error) => toast.error((error as Error).message),
  });
  const configured = Boolean(data?.configured);

  return (
    <SecaoAjuste
      titulo="Claude Subscription"
      ajuda="Conexão do Super Admin usada pelo NEXO e pelos agentes através do Claude Agent SDK. Não usa Anthropic Console API nem armazena uma chave no CRM."
    >
      <div className="aj-linha">
        <span className="aj-conexao-icone"><Bot aria-hidden /></span>
        <div className="aj-linha-corpo">
          <span className="aj-linha-titulo">Conta Claude do Super Admin</span>
          <span className="aj-linha-meta">
            {isLoading ? "Verificando a conexão…" : configured
              ? "Token OAuth protegido no ambiente. A tela nunca recebe nem revela esse segredo."
              : "A conta ainda não foi conectada no ambiente deste servidor."}
          </span>
        </div>
        <div className="aj-linha-acoes">
          <PilulaEstado estado={configured ? "ok" : "pendente"}>{configured ? "Conectada" : "Pendente"}</PilulaEstado>
          <Cf2Button size="sm" variant="secondary" disabled={!configured} loading={verify.isPending} onClick={() => verify.mutate()}>
            <ShieldCheck aria-hidden /> Testar conexão
          </Cf2Button>
        </div>
      </div>
      {!configured ? (
        <p className="aj-grupo-ajuda">
          Para conectar, o Super Admin gera o token oficial com <code>claude setup-token</code> e o instala como segredo <code>CLAUDE_CODE_OAUTH_TOKEN</code> no ambiente. O ONFACE não aceita esse token pelo navegador nem o salva no banco.
        </p>
      ) : null}
    </SecaoAjuste>
  );
}
