"use client";

/**
 * "Ver como" — o super admin usa o ONFACE pelos olhos de outra pessoa.
 *
 * Existia no CRM antigo e é o que permite reproduzir o bug que alguém do time
 * relatou, no perfil de quem relatou, em vez de pedir print e adivinhar.
 *
 * O back já estava pronto (`GET/POST /api/admin/view-as`, cookie `mcrm-view-as`,
 * validação de organização e de usuário ativo, e registro em `audit_log` de quem
 * olhou por quem). Faltava só a porta de entrada.
 *
 * Quem pode é decidido pelo SERVIDOR, nunca por esta tela: a lista só chega a
 * quem passa por `podeVerComo` e a rota devolve 403 para o resto. Por isso o
 * componente some em silêncio no 403 — não há botão escondido por CSS.
 *
 * A faixa fica fixa e é impossível de ignorar de propósito: ninguém pode
 * esquecer que está vendo (e gravando) como outra pessoa. Ela usa os tokens de
 * AVISO porque é exatamente isso — cor por token, nunca hex (trava de
 * arquitetura `hex literal na camada ONFACE não cresce`).
 */

import * as React from "react";
import { toast } from "sonner";

interface UsuarioDaOrg { id: string; nome: string; email: string; role: string }
interface Estado {
  realRole: string;
  realUserId: string;
  isViewingAs: boolean;
  viewAs: { userId: string; nome: string; role: string } | null;
  users: UsuarioDaOrg[];
}

const ROTULO_PAPEL: Record<string, string> = {
  super_admin: "Super admin", admin: "Admin", gerente: "Gerente",
  closer: "Closer", sdr: "SDR", vendedor: "Vendedor", agente: "Agente",
};

const iniciais = (nome: string) =>
  nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

async function pedir(url: string, init?: RequestInit) {
  const r = await fetch(url, { credentials: "same-origin", ...init });
  const corpo = await r.json().catch(() => null);
  if (!r.ok) throw new Error(corpo?.error || `HTTP ${r.status}`);
  return corpo;
}

export function VerComo({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const [estado, setEstado] = React.useState<Estado | null>(null);
  const [busca, setBusca] = React.useState("");
  const [trocando, setTrocando] = React.useState(false);

  const carregar = React.useCallback(async () => {
    try {
      setEstado(await pedir("/api/admin/view-as"));
    } catch {
      setEstado(null); // 403 para quem não é super admin: a tela inteira some.
    }
  }, []);

  React.useEffect(() => { void carregar(); }, [carregar]);

  const trocar = async (userId: string | null) => {
    if (trocando) return;
    setTrocando(true);
    try {
      await pedir("/api/admin/view-as", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userId ?? "" }),
      });
      /* Recarrega a página inteira de propósito: o cookie muda quem o servidor
         considera o usuário, e cada tela já renderizada foi montada com os
         dados do anterior. Trocar sem recarregar deixaria meia tela mentindo. */
      window.location.reload();
    } catch (e) {
      setTrocando(false);
      toast.error(e instanceof Error ? e.message : "Não consegui trocar a visualização.");
    }
  };

  if (!estado) return null;

  const termo = busca.trim().toLowerCase();
  const filtrados = estado.users.filter(
    (u) => !termo || u.nome.toLowerCase().includes(termo) || u.email.toLowerCase().includes(termo),
  );

  return (
    <>
      {estado.isViewingAs && estado.viewAs ? (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
          background: "var(--of-aviso-fundo)", color: "var(--of-aviso-tinta)",
          padding: "7px 14px", fontSize: "var(--of-t-meta)", fontWeight: "var(--of-peso-forte)",
          borderBottom: "1px solid var(--of-fio)", boxShadow: "var(--of-sombra-menu)",
        }}>
          <span>
            Você está vendo o ONFACE como <strong>{estado.viewAs.nome}</strong>
            {ROTULO_PAPEL[estado.viewAs.role] ? ` · ${ROTULO_PAPEL[estado.viewAs.role]}` : ""}
          </span>
          <button
            type="button"
            onClick={() => void trocar(null)}
            disabled={trocando}
            style={{
              border: "1px solid var(--of-fio)", background: "var(--of-papel)",
              color: "var(--of-coral-texto)", borderRadius: "var(--of-r-controle)",
              padding: "3px 10px", fontSize: "var(--of-t-micro)",
              fontWeight: "var(--of-peso-forte)", cursor: "pointer",
            }}
          >
            Voltar a ser você
          </button>
        </div>
      ) : null}

      {aberto ? (
        <div
          onClick={aoFechar}
          style={{ position: "fixed", inset: 0, zIndex: 210, background: "var(--of-moldura)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(460px, 100%)", maxHeight: "76vh", display: "flex", flexDirection: "column",
              background: "var(--of-papel)", borderRadius: "var(--of-r-painel)",
              border: "1px solid var(--of-fio)", boxShadow: "var(--of-sombra-menu)", overflow: "hidden",
            }}
          >
            <div style={{ padding: "14px 16px 10px" }}>
              <div style={{ fontSize: "var(--of-t-secao)", fontWeight: "var(--of-peso-extra)", color: "var(--of-tinta-forte)" }}>
                Ver o sistema como outra pessoa
              </div>
              <div style={{ fontSize: "var(--of-t-meta)", color: "var(--of-tinta-tenue)", marginTop: 3, lineHeight: 1.45 }}>
                Você passa a ver as telas com os dados e as permissões dela. Fica registrado quem olhou por quem.
              </div>
            </div>

            <div style={{ padding: "0 16px 10px" }}>
              <input
                autoFocus
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome ou e-mail"
                style={{
                  width: "100%", height: "var(--of-h-controle)", padding: "0 10px",
                  borderRadius: "var(--of-r-controle)", border: "1px solid var(--of-fio)",
                  fontSize: "var(--of-t-corpo)", color: "var(--of-tinta)",
                  background: "var(--of-papel)", outline: "none",
                }}
              />
            </div>

            <div style={{ overflowY: "auto", borderTop: "1px solid var(--of-fio-tenue)" }}>
              {filtrados.length === 0 ? (
                <div style={{ padding: 18, fontSize: "var(--of-t-corpo)", color: "var(--of-tinta-tenue)", textAlign: "center" }}>
                  Ninguém encontrado com esse nome.
                </div>
              ) : filtrados.map((u) => {
                const atual = estado.viewAs?.userId === u.id;
                return (
                  <button
                    key={u.id}
                    type="button"
                    disabled={trocando}
                    onClick={() => void trocar(u.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, width: "100%",
                      padding: "9px 16px", border: 0, borderBottom: "1px solid var(--of-fio-tenue)",
                      background: atual ? "var(--of-selecionado)" : "transparent",
                      cursor: "pointer", textAlign: "left",
                    }}
                  >
                    <span style={{
                      flex: "0 0 auto", width: 30, height: 30, borderRadius: "var(--of-r-pilula)",
                      background: "var(--of-tinta-avatar)", color: "var(--of-papel)",
                      fontSize: "var(--of-t-micro)", fontWeight: "var(--of-peso-extra)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {iniciais(u.nome)}
                    </span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: "block", fontSize: "var(--of-t-corpo)", fontWeight: "var(--of-peso-forte)", color: "var(--of-tinta-forte)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.nome}</span>
                      <span style={{ display: "block", fontSize: "var(--of-t-micro)", color: "var(--of-tinta-tenue)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.email}</span>
                    </span>
                    <span style={{ flex: "0 0 auto", fontSize: "var(--of-t-micro)", color: "var(--of-tinta)", background: "var(--of-papel-alterno)", borderRadius: "var(--of-r-micro)", padding: "2px 7px" }}>
                      {ROTULO_PAPEL[u.role] ?? u.role}
                    </span>
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "10px 16px", borderTop: "1px solid var(--of-fio-tenue)" }}>
              {estado.isViewingAs ? (
                <button type="button" onClick={() => void trocar(null)} disabled={trocando}
                  style={{ border: "1px solid var(--of-fio)", background: "var(--of-papel)", borderRadius: "var(--of-r-controle)", padding: "6px 12px", fontSize: "var(--of-t-corpo)", cursor: "pointer", color: "var(--of-coral-texto)" }}>
                  Voltar a ser você
                </button>
              ) : <span />}
              <button type="button" onClick={aoFechar}
                style={{ border: "1px solid var(--of-fio)", background: "var(--of-papel)", borderRadius: "var(--of-r-controle)", padding: "6px 12px", fontSize: "var(--of-t-corpo)", color: "var(--of-tinta)", cursor: "pointer" }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
