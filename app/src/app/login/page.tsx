"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";

// Saneamento CRM2 (16/08): `useSearchParams` exige um Suspense boundary no
// build de produção (Next 16 falha o prerender de /login sem isso — só
// aparece no `next build`, não no dev). Componente real fica em
// `LoginForm`; o export default só encapsula o boundary.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

/**
 * Login — reconstruído no design system do CRM 2.0 (09/09).
 *
 * A versão anterior era a única tela que ainda usava o vocabulário do CRM 1:
 * `modal-content`, `dark-input` e `btn-primary` (o gradiente roxo→vermelho),
 * mais um "CRM" em gradiente que não existe em lugar nenhum da marca nova.
 * Sendo a primeira tela do produto, era também a primeira impressão errada.
 *
 * Além do visual, quatro defeitos reais de formulário foram corrigidos:
 * os `<label>` não tinham `htmlFor` (a auditoria lia os campos como rotulados
 * só pelo placeholder), o erro não era anunciado a leitor de tela, não havia
 * `<main>` na página, e os textos de apoio vinham em `white/25`–`white/50`,
 * de 2.3:1 a 3:1 de contraste — abaixo do mínimo legível.
 */
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [verSenha, setVerSenha] = useState(false);

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
      setError("E-mail ou senha inválidos.");
      setLoading(false);
    } else {
      // Saneamento CRM2 (16/08): sempre mandava pro dashboard legado,
      // inclusive ignorando o callbackUrl que o middleware anexa quando o
      // usuário tentou acessar uma rota protegida sem sessão — o destino
      // padrão correto é a Home do App Shell novo, não o MVP.
      const callbackUrl = searchParams.get("callbackUrl");
      router.push(callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : "/inicio");
    }
  };

  const campo = "w-full h-11 px-3.5 rounded-xl text-[14px] transition-colors outline-none";
  const estiloCampo: React.CSSProperties = {
    background: "var(--cf2-home-kpi-bg)",
    border: "1px solid rgba(255,255,255,0.10)",
    color: "var(--cf2-home-text-strong)",
  };

  return (
    <main
      data-cf2-theme="light"
      className="min-h-screen flex items-center justify-center p-5"
      style={{ background: "var(--cf2-home-hero-bg)" }}
    >
      <div className="w-full max-w-[400px] flex flex-col">
        <div className="flex flex-col items-center text-center gap-3 mb-8">
          {/* O logo é o h1 da página: dá o cabeçalho de nível 1 que faltava
              sem inventar um título redundante com o botão "Entrar". */}
          <h1 className="flex">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/callface-logo-white.svg" alt="Callface" className="h-7" />
          </h1>
          <p className="text-[14px]" style={{ color: "var(--cf2-home-text-muted)" }}>
            Entre para acessar o CRM
          </p>
        </div>

        <div
          className="flex flex-col gap-4 p-6 sm:p-7 rounded-[24px]"
          style={{
            background: "var(--cf2-home-ws-bg)",
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow: "0px 1px 1px rgba(0,0,0,0.4), 0px 16px 40px -12px rgba(0,0,0,0.7)",
          }}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* role="alert" — sem isso a falha de login era puramente visual:
                quem usa leitor de tela submetia e não recebia retorno nenhum. */}
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 p-3 rounded-xl text-[13px]"
                style={{
                  background: "rgba(229,72,77,0.12)",
                  border: "1px solid rgba(229,72,77,0.28)",
                  color: "#ff9ca0",
                }}
              >
                <AlertCircle className="w-4 h-4 mt-px shrink-0" aria-hidden />
                {error}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-[13px] font-medium" style={{ color: "var(--cf2-home-text-strong)" }}>
                E-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                autoFocus
                className={`${campo} cf2-login-campo`}
                style={estiloCampo}
                placeholder="voce@empresa.com"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-[13px] font-medium" style={{ color: "var(--cf2-home-text-strong)" }}>
                Senha
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={verSenha ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  className={`${campo} cf2-login-campo pr-11`}
                  style={estiloCampo}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setVerSenha((v) => !v)}
                  aria-label={verSenha ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-1 top-1 flex items-center justify-center w-9 h-9 rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-1"
                  style={{ color: "var(--cf2-home-text-muted)", outlineColor: "var(--cf2-home-lime)" }}
                >
                  {verSenha ? <EyeOff className="w-4 h-4" aria-hidden /> : <Eye className="w-4 h-4" aria-hidden />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 w-full h-11 mt-1 rounded-xl text-[14px] font-semibold transition-opacity disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ background: "var(--cf2-home-lime)", color: "var(--cf2-home-lime-ink)", outlineColor: "var(--cf2-home-lime)" }}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
              {loading ? "Entrando…" : "Entrar"}
            </button>
          </form>

          <div className="text-center">
            <a
              href="/esqueci-senha"
              className="text-[13px] rounded transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ color: "var(--cf2-home-text-muted)", outlineColor: "var(--cf2-home-lime)" }}
            >
              Esqueci a senha
            </a>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px]" style={{ color: "var(--cf2-home-text-muted)" }}>
          © Scott Studio · Direitos reservados
        </p>
      </div>
    </main>
  );
}
