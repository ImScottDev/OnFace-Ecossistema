"use client";

/**
 * Tokens da API pública (SPEC §30.2).
 *
 * A API tinha nove recursos, autenticação por token, escopo e registro de uso,
 * e nenhuma forma de criar credencial: `api_tokens` só era escrita por script.
 * Na prática a API inteira era inacessível sem INSERT manual no banco.
 *
 * As três regras que a tela precisa respeitar, e por quê:
 *
 * **O token aparece uma vez.** O servidor guarda só o sha256. A tela mostra o
 * valor no momento da criação e não tem como recuperá-lo depois — e isso está
 * dito na interface, porque quem fecha o diálogo sem copiar precisa saber que
 * o caminho é revogar e criar outro, não procurar em algum lugar.
 *
 * **Ninguém cria token acima de si.** O servidor intersecciona o escopo pedido
 * com a permissão de quem cria e devolve 403 nomeando o que falta. A tela
 * mostra essa mensagem como está, em vez de traduzir para "erro ao criar".
 *
 * **Revogar não apaga.** O token revogado continua na lista, em cinza, com
 * quem criou e quando foi usado pela última vez. Sumir com a linha resolveria
 * o acesso e destruiria a resposta para "o que essa credencial andou puxando".
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Copy, Check, Trash2, AlertTriangle, Plus, X } from "lucide-react";

interface TokenLinha {
  id: string;
  nome: string;
  prefixo: string;
  escopos: string[] | null;
  expiraEm: string | null;
  ultimoUsoEm: string | null;
  revogadoEm: string | null;
  criadoEm: string;
  criadoPor: string | null;
}

const ROTULO_ESCOPO: Record<string, string> = {
  "companies.read": "Empresas · ler",
  "companies.write": "Empresas · escrever",
  "acquisition.read": "Aquisição · ler",
  "acquisition.manage": "Aquisição · gerenciar",
  "sales.read": "Vendas · ler",
  "sales.manage": "Vendas · gerenciar",
  "finance.read": "Financeiro · ler",
  "finance.manage": "Financeiro · gerenciar",
  "cs.read": "CS · ler",
  "cs.manage": "CS · gerenciar",
};

const data = (v: string | null) =>
  v ? new Date(v).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : null;

export default function ApiTokensPage() {
  const qc = useQueryClient();
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [escopos, setEscopos] = useState<string[]>([]);
  const [expira, setExpira] = useState("");
  const [novoToken, setNovoToken] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const { data: dados, isLoading } = useQuery<{ tokens: TokenLinha[]; escoposDisponiveis: string[] }>({
    queryKey: ["api-tokens"],
    queryFn: async () => {
      const r = await fetch("/api/configuracoes/api-tokens");
      if (!r.ok) throw new Error("Não consegui carregar os tokens.");
      return r.json();
    },
  });

  const criar = useMutation({
    mutationFn: async () => {
      setErro(null);
      const r = await fetch("/api/configuracoes/api-tokens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          escopos,
          expiraEm: expira ? new Date(`${expira}T23:59:59`).toISOString() : null,
        }),
      });
      const corpo = await r.json();
      // A mensagem do servidor nomeia a permissão que falta. Trocar por um
      // texto genérico manda a pessoa para o suporte em vez do administrador.
      if (!r.ok) throw new Error(corpo?.error ?? "Não consegui criar o token.");
      return corpo as { token: string };
    },
    onSuccess: (c) => {
      setNovoToken(c.token);
      setCriando(false);
      setNome(""); setEscopos([]); setExpira("");
      qc.invalidateQueries({ queryKey: ["api-tokens"] });
    },
    onError: (e: Error) => setErro(e.message),
  });

  const revogar = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/configuracoes/api-tokens/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Não consegui revogar.");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-tokens"] }),
  });

  const disponiveis = dados?.escoposDisponiveis ?? [];
  const tokens = dados?.tokens ?? [];
  const ativos = tokens.filter((t) => !t.revogadoEm);
  const revogados = tokens.filter((t) => t.revogadoEm);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="text-sm text-[var(--cf2-text-tertiary)] mt-1">
            Credenciais para sistemas externos lerem e gravarem pela API pública. Cada token
            vale só para os escopos que você marcar.
          </p>
        </div>
        {!criando && (
          <button
            onClick={() => { setCriando(true); setErro(null); }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium bg-purple-500/20 text-[var(--cf2-text-secondary)] hover:bg-purple-500/30 transition-colors"
          >
            <Plus className="w-4 h-4" /> Novo token
          </button>
        )}
      </div>

      {/* O valor aparece UMA vez. O aviso é parte da funcionalidade. */}
      {novoToken && (
        <div className="bg-[var(--cf2-bg-surface)] rounded-xl p-6 border border-[var(--cf2-warning-text)]/40">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-[var(--cf2-warning-text)]" />
            <h2 className="text-base font-semibold text-[var(--cf2-text-primary)]">
              Copie agora: este valor não aparece de novo
            </h2>
          </div>
          <p className="text-xs text-[var(--cf2-text-tertiary)] mb-3">
            O servidor guarda só um resumo criptográfico do token. Se você fechar sem copiar,
            o caminho é revogar este e criar outro.
          </p>
          <div className="flex gap-2">
            <code className="flex-1 bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] rounded-lg px-3 py-2.5 text-sm font-mono text-[var(--cf2-text-primary)] break-all">
              {novoToken}
            </code>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(novoToken).then(
                  () => { setCopiado(true); setTimeout(() => setCopiado(false), 2000); },
                  () => undefined,
                );
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium bg-purple-500/20 text-[var(--cf2-text-secondary)] hover:bg-purple-500/30 transition-colors shrink-0"
            >
              {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiado ? "Copiado" : "Copiar"}
            </button>
          </div>
          <button
            onClick={() => setNovoToken(null)}
            className="mt-3 text-xs text-[var(--cf2-text-tertiary)] hover:text-[var(--cf2-text-secondary)] transition-colors"
          >
            Já copiei, pode fechar
          </button>
        </div>
      )}

      {criando && (
        <div className="bg-[var(--cf2-bg-surface)] rounded-xl p-6 border border-[var(--cf2-border-default)]">
          <div className="flex items-center gap-2 mb-4">
            <KeyRound className="w-5 h-5 text-[var(--cf2-text-secondary)]" />
            <h2 className="text-lg font-semibold text-[var(--cf2-text-primary)]">Novo token</h2>
            <button onClick={() => { setCriando(false); setErro(null); }} className="ml-auto text-[var(--cf2-text-tertiary)] hover:text-[var(--cf2-text-secondary)]">
              <X className="w-4 h-4" />
            </button>
          </div>

          <label className="block text-xs text-[var(--cf2-text-tertiary)] mb-1.5">
            Para que serve este token
          </label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Integração com o ERP, relatório do time de dados…"
            maxLength={80}
            className="w-full bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] rounded-lg px-3 py-2.5 text-sm text-[var(--cf2-text-primary)] focus:border-purple-500/40 focus:outline-none transition-colors mb-4"
          />

          <label className="block text-xs text-[var(--cf2-text-tertiary)] mb-1.5">
            O que ele pode fazer
          </label>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {disponiveis.map((e) => (
              <label key={e} className="flex items-center gap-2 text-sm text-[var(--cf2-text-secondary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={escopos.includes(e)}
                  onChange={(ev) => setEscopos(ev.target.checked ? [...escopos, e] : escopos.filter((x) => x !== e))}
                  className="accent-purple-500"
                />
                {ROTULO_ESCOPO[e] ?? e}
              </label>
            ))}
          </div>

          <label className="block text-xs text-[var(--cf2-text-tertiary)] mb-1.5">
            Validade (opcional, mas recomendada)
          </label>
          <input
            type="date"
            value={expira}
            onChange={(e) => setExpira(e.target.value)}
            className="bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] rounded-lg px-3 py-2.5 text-sm text-[var(--cf2-text-primary)] focus:border-purple-500/40 focus:outline-none transition-colors mb-4"
          />

          {erro && <p className="text-xs text-[var(--cf2-danger-text)] mb-3">{erro}</p>}

          <button
            onClick={() => criar.mutate()}
            disabled={!nome.trim() || escopos.length === 0 || criar.isPending}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium bg-purple-500/20 text-[var(--cf2-text-secondary)] hover:bg-purple-500/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <KeyRound className="w-4 h-4" />
            {criar.isPending ? "Criando…" : "Criar token"}
          </button>
          {escopos.length === 0 && nome.trim() && (
            <p className="text-[10px] text-[var(--cf2-text-tertiary)] mt-2">
              Marque ao menos um escopo: token sem escopo autentica e não autoriza nada.
            </p>
          )}
        </div>
      )}

      <div className="bg-[var(--cf2-bg-surface)] rounded-xl border border-[var(--cf2-border-default)] overflow-hidden">
        {isLoading && <p className="p-6 text-sm text-[var(--cf2-text-tertiary)]">Carregando…</p>}
        {!isLoading && tokens.length === 0 && (
          <div className="p-6">
            <p className="text-sm text-[var(--cf2-text-secondary)]">Nenhum token criado ainda.</p>
            <p className="text-xs text-[var(--cf2-text-tertiary)] mt-1">
              Sem token, a API pública não responde a ninguém: toda chamada precisa de um.
            </p>
          </div>
        )}
        {[...ativos, ...revogados].map((t) => (
          <div
            key={t.id}
            className={`flex items-start gap-4 p-4 border-b border-[var(--cf2-border-default)] last:border-0 ${t.revogadoEm ? "opacity-50" : ""}`}
          >
            <KeyRound className="w-4 h-4 text-[var(--cf2-text-tertiary)] mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-[var(--cf2-text-primary)]">{t.nome}</span>
                <code className="text-[11px] font-mono text-[var(--cf2-text-tertiary)]">{t.prefixo}…</code>
                {t.revogadoEm && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--cf2-danger-text)]/15 text-[var(--cf2-danger-text)]">
                    revogado em {data(t.revogadoEm)}
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--cf2-text-tertiary)] mt-1">
                {(t.escopos ?? []).map((e) => ROTULO_ESCOPO[e] ?? e).join(" · ") || "sem escopo"}
              </p>
              <p className="text-[11px] text-[var(--cf2-text-tertiary)] mt-1">
                criado {data(t.criadoEm)}{t.criadoPor ? ` por ${t.criadoPor}` : ""}
                {t.expiraEm ? ` · expira ${data(t.expiraEm)}` : " · sem prazo"}
                {" · "}
                {/* Sem uso é informação: token que ninguém chama pode ser revogado sem dó. */}
                {t.ultimoUsoEm ? `último uso ${data(t.ultimoUsoEm)}` : "nunca usado"}
              </p>
            </div>
            {!t.revogadoEm && (
              <button
                onClick={() => {
                  if (confirm(`Revogar "${t.nome}"? Quem estiver usando este token para de funcionar na hora.`)) {
                    revogar.mutate(t.id);
                  }
                }}
                disabled={revogar.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--cf2-danger-text)] hover:bg-[var(--cf2-danger-text)]/10 transition-colors shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" /> Revogar
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
