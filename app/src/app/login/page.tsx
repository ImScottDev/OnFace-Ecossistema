"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const result = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });

    if (result?.error) {
      setError("Email ou senha inválidos");
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="modal-content w-full max-w-md p-8">
        <div className="text-center mb-8">
          <img src="/brand/callface-logo-white.svg" alt="Callface" className="h-8 mx-auto mb-3" />
          <h1
            className="text-xl font-bold"
            style={{
              background: "linear-gradient(135deg, #e23752, #8e27ef)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            CRM
          </h1>
          <p className="text-white/50 mt-1">Acesse sua conta</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-400 bg-red-500/15 border border-red-500/20 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">
              Email
            </label>
            <input
              name="email"
              type="email"
              required
              className="dark-input w-full"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">
              Senha
            </label>
            <input
              name="password"
              type="password"
              required
              className="dark-input w-full"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-2 px-4 font-medium"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>

          <div className="text-center">
            <a href="/esqueci-senha" className="text-[12px] text-white/45 hover:text-white/70 transition-colors">
              Esqueci a senha
            </a>
          </div>
        </form>

        <p className="mt-6 text-center text-[10px] text-white/25">
          © Scott Studio · Direitos reservados
        </p>
      </div>
    </div>
  );
}
