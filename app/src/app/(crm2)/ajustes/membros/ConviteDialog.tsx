"use client";

import { useState } from "react";
import { Check, Copy, UserPlus } from "lucide-react";
import {
  Cf2Dialog, Cf2DialogContent, Cf2DialogHeader, Cf2DialogTitle,
  Cf2DialogDescription, Cf2DialogFooter,
} from "@/components/crm2/ui/Dialog";
import { Cf2Button } from "@/components/crm2/ui/Button";
import { Cf2Input, Cf2Label } from "@/components/crm2/ui/Input";
import { ROLES, type Role } from "@/lib/auth/roles";
import { ROLE_AJUDA, ROLE_LABEL } from "./roles";

type Resultado = { emailEnviado: boolean; link?: string };

/** Convite de novo membro. Migrado de `(crm)/admin/usuarios` (09/09/2026). */
export function ConviteDialog({
  aberto, onOpenChange, onConvidado,
}: { aberto: boolean; onOpenChange: (v: boolean) => void; onConvidado: () => void }) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("closer");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [pronto, setPronto] = useState<Resultado | null>(null);
  const [copiado, setCopiado] = useState(false);

  const valido = nome.trim().length >= 2 && /.+@.+\..+/.test(email);

  function reiniciar(v: boolean) {
    if (!v) { setNome(""); setEmail(""); setRole("closer"); setErro(""); setPronto(null); setCopiado(false); }
    onOpenChange(v);
  }

  async function enviar() {
    setErro(""); setEnviando(true);
    const res = await fetch("/api/usuarios/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: nome.trim(), email: email.trim(), role }),
    }).catch(() => null);
    setEnviando(false);
    if (!res || !res.ok) {
      setErro((await res?.json().catch(() => ({})))?.error || "Não foi possível enviar o convite.");
      return;
    }
    const d = await res.json();
    setPronto({ emailEnviado: d.emailEnviado, link: d.link });
    onConvidado();
  }

  return (
    <Cf2Dialog open={aberto} onOpenChange={reiniciar}>
      <Cf2DialogContent aria-describedby="convite-desc">
        <Cf2DialogHeader>
          <Cf2DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-4" style={{ color: "var(--cf2-accent)" }} />
            Convidar pessoa
          </Cf2DialogTitle>
          <Cf2DialogDescription id="convite-desc">
            A pessoa recebe um e-mail para definir a senha e entrar na organização.
          </Cf2DialogDescription>
        </Cf2DialogHeader>

        {pronto ? (
          <div className="flex flex-col gap-3">
            <p
              role="status"
              className="rounded-[var(--cf2-radius-sm)] px-3 py-2.5 text-[13px] text-center font-medium"
              style={{ background: "var(--cf2-success-bg)", color: "var(--cf2-success-text)" }}
            >
              {pronto.emailEnviado
                ? "Convite enviado por e-mail."
                : "Pessoa criada — o envio de e-mail não está configurado."}
            </p>
            {!pronto.emailEnviado && pronto.link && (
              <div
                className="rounded-[var(--cf2-radius-md)] p-3 flex flex-col gap-2"
                style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}
              >
                <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>
                  Envie este link manualmente:
                </p>
                <div className="flex items-start gap-2">
                  <code className="text-[11px] break-all flex-1" style={{ color: "var(--cf2-text-secondary)" }}>
                    {pronto.link}
                  </code>
                  <Cf2Button
                    variant="secondary" size="sm" className="shrink-0"
                    onClick={() => {
                      navigator.clipboard?.writeText(pronto.link!);
                      setCopiado(true);
                      setTimeout(() => setCopiado(false), 2000);
                    }}
                  >
                    {copiado ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    {copiado ? "Copiado" : "Copiar"}
                  </Cf2Button>
                </div>
              </div>
            )}
            <Cf2DialogFooter>
              <Cf2Button onClick={() => reiniciar(false)}>Fechar</Cf2Button>
            </Cf2DialogFooter>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Cf2Label htmlFor="convite-nome">Nome</Cf2Label>
              <Cf2Input
                id="convite-nome" value={nome} onChange={(e) => setNome(e.target.value)}
                placeholder="Nome da pessoa" autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Cf2Label htmlFor="convite-email">E-mail</Cf2Label>
              <Cf2Input
                id="convite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="pessoa@empresa.com" autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Cf2Label htmlFor="convite-papel">Papel</Cf2Label>
              <select
                id="convite-papel" value={role} onChange={(e) => setRole(e.target.value as Role)}
                className="w-full rounded-[var(--cf2-radius-sm)] text-sm px-3 py-2 outline-none h-[38px]"
                style={{
                  background: "var(--cf2-bg-surface)",
                  color: "var(--cf2-text-primary)",
                  border: "1px solid var(--cf2-border-default)",
                }}
              >
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
              <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{ROLE_AJUDA[role]}</p>
            </div>
            {erro && (
              <p role="alert" className="text-[12px]" style={{ color: "var(--cf2-danger-text)" }}>{erro}</p>
            )}
            <Cf2DialogFooter>
              <Cf2Button variant="secondary" onClick={() => reiniciar(false)}>Cancelar</Cf2Button>
              <Cf2Button onClick={enviar} loading={enviando} disabled={!valido}>Enviar convite</Cf2Button>
            </Cf2DialogFooter>
          </div>
        )}
      </Cf2DialogContent>
    </Cf2Dialog>
  );
}
