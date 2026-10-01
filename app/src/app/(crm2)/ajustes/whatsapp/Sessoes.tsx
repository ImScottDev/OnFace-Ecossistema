"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { QrCode, RefreshCw, Star, Trash2 } from "lucide-react";
import { Cf2Button } from "@/components/crm2/ui/Button";
import { Cf2Input } from "@/components/crm2/ui/Input";
import { SecaoAjuste, PilulaEstado } from "@/components/onface/ajustes/Secao";

/**
 * Sessões de WhatsApp de quem está logado — substitui o `WhatsAppSessionManager`
 * legado (cartão translúcido, botões esmeralda/âmbar, foco roxo).
 *
 * Mudança de comportamento: toda ação agora confere a resposta. O legado
 * disparava o POST e seguia em frente, então "Adicionar" com o servidor de
 * WhatsApp fora do ar não fazia nada e não dizia nada — botão que parece agir.
 */

interface Sessao {
  id: string;
  sessionName: string;
  label: string | null;
  isDefault: boolean;
  status: string;
  phoneNumber: string | null;
  qrCode: string | null;
}

async function acao(nome: string, extra: Record<string, string> = {}) {
  const res = await fetch("/api/whatsapp/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: nome, ...extra }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // O servidor de WhatsApp (wuzapi) fora do ar chega aqui como 500 com a mensagem crua.
    throw new Error(res.status >= 500
      ? "O servidor de WhatsApp não respondeu. Tente de novo em instantes; se persistir, avise o time técnico."
      : body.error || "A ação não foi concluída.");
  }
  return body;
}

export function SessoesWhatsapp() {
  const [nome, setNome] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery<{ sessions: Sessao[] }>({
    queryKey: ["whatsapp-sessions-config"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/status");
      if (!res.ok) throw new Error("Falha ao carregar as sessões");
      return res.json();
    },
    refetchInterval: 5000,
  });

  const sessoes = data?.sessions ?? [];
  const conectadas = sessoes.filter((s) => s.status === "connected").length;

  async function executar(chave: string, nomeAcao: string, extra: Record<string, string>, sucesso: string) {
    setOcupado(chave);
    try {
      await acao(nomeAcao, extra);
      if (nomeAcao === "connect") {
        // Polling curto para o QR aparecer na hora, sem esperar o ciclo de 5s.
        for (let i = 0; i < 15; i++) {
          await new Promise((r) => setTimeout(r, 1000));
          const r = await refetch();
          const s = r.data?.sessions?.find((x) => x.id === extra.sessionId);
          if (s && (s.qrCode || s.status === "connected")) break;
        }
      } else {
        await refetch();
      }
      toast.success(sucesso);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  function criar() {
    const rotulo = nome.trim();
    if (!rotulo) return;
    executar("nova", "create", { sessionName: rotulo.toLowerCase().replace(/\s+/g, "-"), label: rotulo },
      "Sessão criada. Clique em Conectar e leia o QR Code com o WhatsApp do celular.")
      .then(() => setNome(""));
  }

  return (
    <SecaoAjuste
      titulo="Seus números"
      ajuda="Cada sessão é um número de WhatsApp conectado ao CRM por QR Code. É por ela que saem suas conversas e cadências."
      acao={
        <>
          {sessoes.length > 0 && (
            <PilulaEstado estado={conectadas === sessoes.length ? "ok" : conectadas === 0 ? "erro" : "pendente"}>
              {conectadas} de {sessoes.length} conectadas
            </PilulaEstado>
          )}
          <Cf2Button variant="ghost" size="icon" aria-label="Atualizar estado" onClick={() => refetch()}>
            <RefreshCw className={isFetching ? "animate-spin" : undefined} aria-hidden />
          </Cf2Button>
        </>
      }
    >
      {isLoading ? (
        <p className="aj-grupo-ajuda">Carregando sessões…</p>
      ) : isError ? (
        <div className="aj-vazio"><strong>Não foi possível carregar suas sessões.</strong> Atualize a página em instantes.</div>
      ) : sessoes.length === 0 ? (
        <div className="aj-vazio">
          <strong>Você ainda não conectou nenhum número.</strong>
          Dê um nome à sessão abaixo (ex.: Comercial), clique em Conectar e leia o QR Code em WhatsApp → Aparelhos conectados.
        </div>
      ) : (
        <ul className="aj-lista">
          {sessoes.map((s) => {
            const rotulo = s.label || s.sessionName;
            const estado = s.status === "connected" ? "ok" : s.status === "waiting_qr" ? "pendente" : "erro";
            return (
              <li key={s.id} className="flex flex-col border-t border-[var(--line-hairline)] first:border-t-0">
                <div className="aj-linha border-t-0">
                  <div className="aj-linha-corpo">
                    <span className="aj-linha-titulo">
                      {rotulo}{s.isDefault ? <span className="aj-mono"> · padrão</span> : null}
                    </span>
                    <span className="aj-linha-meta">{s.phoneNumber || "Sem número vinculado"}</span>
                  </div>
                  <div className="aj-linha-acoes">
                    <PilulaEstado estado={estado}>
                      {s.status === "connected" ? "Conectado" : s.status === "waiting_qr" ? "Aguardando QR" : "Desconectado"}
                    </PilulaEstado>
                    {s.status === "connected" ? (
                      <Cf2Button size="sm" variant="secondary" loading={ocupado === s.id}
                        onClick={() => executar(s.id, "disconnect", { sessionId: s.id }, "Sessão desconectada.")}>
                        Desconectar
                      </Cf2Button>
                    ) : (
                      <Cf2Button size="sm" loading={ocupado === s.id}
                        onClick={() => executar(s.id, "connect", { sessionId: s.id }, "Pronto. Se o QR apareceu, leia com o celular.")}>
                        Conectar
                      </Cf2Button>
                    )}
                    {!s.isDefault && (
                      <Cf2Button size="icon" variant="ghost" aria-label={`Tornar ${rotulo} a sessão padrão`}
                        title="Sessão usada para envios automáticos e notificações"
                        disabled={ocupado !== null}
                        onClick={() => executar(s.id, "set-default", { sessionId: s.id }, `${rotulo} agora é a sessão padrão.`)}>
                        <Star aria-hidden />
                      </Cf2Button>
                    )}
                    <Cf2Button size="icon" variant="ghost" aria-label={`Excluir ${rotulo}`} disabled={ocupado !== null}
                      onClick={() => {
                        if (confirm(`Excluir a sessão "${rotulo}" e todo o histórico de mensagens dela? Não dá para desfazer.`)) {
                          executar(s.id, "delete", { sessionId: s.id }, "Sessão excluída.");
                        }
                      }}>
                      <Trash2 aria-hidden />
                    </Cf2Button>
                  </div>
                </div>
                {s.status !== "connected" && s.qrCode && (
                  <div className="mb-3 flex flex-col items-center gap-2 rounded-[var(--radius-card)] bg-[var(--surface-sunken)] p-4">
                    <span className="inline-flex items-center gap-1.5 text-[var(--text-sm)] text-[var(--text-muted)]">
                      <QrCode className="h-3.5 w-3.5" aria-hidden /> No celular: WhatsApp → Aparelhos conectados → Conectar aparelho
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.qrCode.startsWith("data:") ? s.qrCode : `data:image/png;base64,${s.qrCode}`}
                      alt={`QR Code para conectar ${rotulo}`}
                      className="h-48 w-48 rounded-lg bg-white p-2"
                      style={{ imageRendering: "pixelated" }}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <form
        className="flex flex-col gap-2 border-t border-[var(--line-hairline)] pt-4 sm:flex-row sm:items-end"
        onSubmit={(e) => { e.preventDefault(); criar(); }}
      >
        <label className="aj-campo flex-1">
          <span>Nova sessão</span>
          <Cf2Input placeholder="Nome da sessão (ex.: Comercial, Suporte)" value={nome} onChange={(e) => setNome(e.target.value)} />
        </label>
        <Cf2Button type="submit" disabled={!nome.trim()} loading={ocupado === "nova"}>Criar sessão</Cf2Button>
      </form>
    </SecaoAjuste>
  );
}
