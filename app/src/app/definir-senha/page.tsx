"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

function DefinirSenhaInner() {
  const token = useSearchParams().get("token") || "";
  const [estado, setEstado] = useState<"validando" | "valido" | "invalido" | "ok">("validando");
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<"convite" | "reset">("convite");
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) { setEstado("invalido"); return; }
    fetch(`/api/conta/token/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.valido) { setNome(d.nome || ""); setTipo(d.tipo || "convite"); setEstado("valido"); }
        else setEstado("invalido");
      })
      .catch(() => setEstado("invalido"));
  }, [token]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErro("");
    if (senha.length < 8) { setErro("A senha precisa de pelo menos 8 caracteres."); return; }
    if (senha !== confirma) { setErro("As senhas não conferem."); return; }
    setLoading(true);
    const res = await fetch("/api/conta/definir-senha", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, senha }),
    });
    setLoading(false);
    if (res.ok) setEstado("ok");
    else setErro((await res.json().catch(() => ({}))).error || "Não foi possível salvar. Peça um novo link.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="modal-content w-full max-w-md p-8">
        <div className="text-center mb-8">
          <img src="/brand/callface-logo-white.svg" alt="Callface" className="h-8 mx-auto mb-3" />
          <h1 className="text-xl font-bold" style={{ background: "linear-gradient(135deg, #e23752, #8e27ef)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>CRM</h1>
          <p className="text-white/50 mt-1">{tipo === "reset" ? "Redefinir senha" : "Definir sua senha"}</p>
        </div>

        {estado === "validando" && <p className="text-center text-sm text-white/40 py-6">Validando link…</p>}

        {estado === "invalido" && (
          <div className="space-y-4 text-center">
            <div className="p-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg">
              Link inválido ou expirado. Peça um novo convite ao admin, ou use &quot;Esqueci a senha&quot; no login.
            </div>
            <a href="/login" className="btn-primary w-full py-2 px-4 font-medium inline-block">Ir pro login</a>
          </div>
        )}

        {estado === "ok" && (
          <div className="space-y-4 text-center">
            <div className="p-4 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              Senha definida! Já pode entrar com seu email e a nova senha.
            </div>
            <a href="/login" className="btn-primary w-full py-2 px-4 font-medium inline-block">Entrar</a>
          </div>
        )}

        {estado === "valido" && (
          <form onSubmit={submit} className="space-y-4">
            {nome && <p className="text-[13px] text-white/50 text-center">Olá, <span className="text-white/80">{nome.split(" ")[0]}</span>. Crie sua senha de acesso.</p>}
            {erro && <div className="p-3 text-sm text-red-400 bg-red-500/15 border border-red-500/20 rounded-lg">{erro}</div>}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Nova senha</label>
              <input type="password" required value={senha} onChange={(e) => setSenha(e.target.value)} className="dark-input w-full" placeholder="mínimo 8 caracteres" />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Confirmar senha</label>
              <input type="password" required value={confirma} onChange={(e) => setConfirma(e.target.value)} className="dark-input w-full" placeholder="repita a senha" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-2 px-4 font-medium">
              {loading ? "Salvando..." : "Salvar senha e entrar"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function DefinirSenhaPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white/40 text-sm">Carregando…</div>}>
      <DefinirSenhaInner />
    </Suspense>
  );
}
