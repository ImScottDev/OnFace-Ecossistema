"use client";

import { useState } from "react";

export default function EsqueciSenhaPage() {
  const [enviado, setEnviado] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const email = new FormData(e.currentTarget).get("email");
    await fetch("/api/conta/esqueci", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => {});
    setEnviado(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="modal-content w-full max-w-md p-8">
        <div className="text-center mb-8">
          <img src="/brand/callface-logo-white.svg" alt="Callface" className="h-8 mx-auto mb-3" />
          <h1 className="text-xl font-bold" style={{ background: "linear-gradient(135deg, #e23752, #8e27ef)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>CRM</h1>
          <p className="text-white/50 mt-1">Redefinir senha</p>
        </div>

        {enviado ? (
          <div className="space-y-4 text-center">
            <div className="p-4 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              Se esse email tiver conta, enviamos um link para redefinir a senha. Verifique a caixa de entrada (e o spam).
            </div>
            <a href="/login" className="btn-primary w-full py-2 px-4 font-medium inline-block">Voltar pro login</a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-[13px] text-white/50">Informe o email da sua conta. Enviaremos um link para você criar uma nova senha.</p>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Email</label>
              <input name="email" type="email" required className="dark-input w-full" placeholder="seu@email.com" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-2 px-4 font-medium">
              {loading ? "Enviando..." : "Enviar link de redefinição"}
            </button>
            <div className="text-center">
              <a href="/login" className="text-[12px] text-white/45 hover:text-white/70 transition-colors">Voltar pro login</a>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
