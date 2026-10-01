"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AlertCircle, ArrowRight, BarChart3, Eye, EyeOff, Loader2, Lock, Mail, Users, Zap } from "lucide-react";

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
 * Login — linguagem ONFACE (01/10), seguindo a referência
 * `public/proto/brand/onface-login-reference.png`: painel grafite da marca à
 * esquerda, cartão de papel com o formulário à direita.
 *
 * O que ficou de fora da referência, de propósito (sem botão mentiroso):
 * - "Entrar com Google/Microsoft": `lib/auth/config.ts` só tem o provider
 *   Credentials. Botão de SSO sem provider seria um botão que não faz nada.
 * - "Lembrar de mim": a sessão é JWT com maxAge fixo de 30 dias para todo
 *   mundo; um checkbox não mudaria nada.
 * - O mascote: o PNG disponível (`oni-full-body.png`) tem fundo branco e um
 *   texto manuscrito cortado — não assenta no painel grafite.
 *
 * A lógica é a mesma da versão anterior, sem mudança: signIn("credentials")
 * com redirect:false, mesma mensagem de erro, callbackUrl só se for caminho
 * relativo (evita open redirect), destino padrão /inicio. Os nomes dos campos
 * (email/password) seguem iguais porque o NextAuth e scripts/dev-sessao.sh
 * dependem deles.
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
      // Saneamento CRM2 (16/08): respeita o callbackUrl que o middleware
      // anexa; o destino padrão é a Home do App Shell novo.
      const callbackUrl = searchParams.get("callbackUrl");
      router.push(callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/inicio");
    }
  };

  // Elevação ONFACE: anel inset em vez de border, para o campo não "pular"
  // 1px quando o foco troca a cor do anel.
  const campo =
    "w-full h-12 pl-11 rounded-xl text-[14px] outline-none bg-white text-[var(--of-tinta-forte)] placeholder:text-[var(--of-tinta-4)] " +
    "shadow-[inset_0_0_0_1px_var(--of-linha)] transition-shadow focus:shadow-[inset_0_0_0_1.5px_var(--of-coral-acao),0_0_0_4px_rgba(254,79,43,0.12)]";
  const rotulo = "text-[11px] font-semibold tracking-[0.12em] uppercase text-[var(--of-tinta-2)]";

  return (
    <main className="min-h-screen grid lg:grid-cols-[1.15fr_1fr] bg-[var(--of-papel-tela)]" style={{ fontFamily: "var(--font-onface-corpo)" }}>
      {/* Painel da marca — só aparece em tela larga; no celular o lockup sobe
          para cima do cartão e o formulário fica na primeira dobra. */}
      <section
        aria-hidden
        className="relative hidden lg:flex flex-col justify-between overflow-hidden px-16 py-14 text-white"
        style={{ background: "radial-gradient(120% 90% at 85% 15%, var(--of-tinta) 0%, var(--of-tinta-forte) 55%, var(--of-moldura) 100%)" }}
      >
        {/* Arco coral: o único acento do painel, como na referência. */}
        <div
          className="pointer-events-none absolute -right-[420px] -top-[380px] h-[760px] w-[760px] rounded-full"
          style={{ boxShadow: "inset 0 0 0 44px var(--of-coral-marca)", opacity: 0.9 }}
        />

        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/onface/onface-lockup-negativa.svg" alt="" className="h-11" />
          <p className="mt-3 text-[13px] tracking-[0.18em] text-white/80">Business Operating System</p>
        </div>

        <div className="relative max-w-[440px]">
          <div className="mb-8 h-px w-12 bg-white/60" />
          <p
            className="text-[64px] leading-[1.02] font-extrabold tracking-[-0.03em]"
            style={{ fontFamily: "var(--font-onface-titulo)" }}
          >
            Sua operação começa <span className="text-[var(--of-coral-marca)]">ON.</span>
          </p>
          <p className="mt-6 text-[18px] leading-relaxed text-white/75">
            Acesse o ecossistema ONFACE e continue sua jornada com mais controle, clareza e resultado.
          </p>

          <ul className="mt-10 flex flex-col gap-4">
            {[
              { Icone: BarChart3, t: "Conecta", s: "pessoas e dados" },
              { Icone: Users, t: "Organiza", s: "sua operação" },
              { Icone: Zap, t: "Impulsiona", s: "resultados" },
            ].map(({ Icone, t, s }) => (
              <li key={t} className="flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.06] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]">
                  <Icone className="h-5 w-5" />
                </span>
                <span className="leading-tight">
                  <span className="block text-[15px] font-semibold">{t}</span>
                  <span className="block text-[14px] text-white/65">{s}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative">
          <div className="mb-5 h-px w-10 bg-white/60" />
          <p className="text-[17px]">
            Sempre <span className="text-[var(--of-coral-marca)] font-semibold">ON</span> com você.
          </p>
          <p className="mt-6 text-[11px] tracking-[0.24em] text-white/55" style={{ fontFamily: "var(--font-onface-mono)" }}>
            OPERATE · GROW · TOGETHER
          </p>
        </div>
      </section>

      {/* Lado do formulário */}
      <section className="flex flex-col px-4 py-8 sm:px-10 lg:px-14">
        <p
          className="hidden lg:block self-end text-[11px] tracking-[0.2em] text-[var(--of-tinta-3)]"
          style={{ fontFamily: "var(--font-onface-mono)" }}
        >
          BUSINESS OPERATING SYSTEM
        </p>

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-[460px]">
            {/* No celular o painel da marca some; o lockup positivo vem pra cá. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/onface/onface-lockup-positiva.svg" alt="ONFACE" className="lg:hidden h-8 mb-8 mx-auto" />

            <div className="rounded-[24px] bg-white p-7 sm:p-10 shadow-[inset_0_0_0_1px_var(--of-linha),0_24px_48px_-28px_rgba(18,23,29,0.25)]">
              <h1
                className="text-[40px] leading-none font-extrabold tracking-[-0.03em] text-[var(--of-tinta-forte)]"
                style={{ fontFamily: "var(--font-onface-titulo)" }}
              >
                Entrar
              </h1>
              <p className="mt-3 text-[15px] text-[var(--of-tinta-avatar)]">Acesse sua conta ONFACE.</p>

              {/* method="post": se o usuário enviar antes da hidratação (dev lento, rede
                  ruim), o envio nativo vira GET e a senha ia parar na URL,
                  no histórico e nos logs. Com POST isso não acontece. */}
              <form method="post" onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
                {/* role="alert": sem isso a falha era só visual para leitor de tela. */}
                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-xl p-3 text-[13px] text-[var(--of-coral-texto-forte)] bg-[var(--of-coral-fundo)] shadow-[inset_0_0_0_1px_var(--of-coral-contorno)]"
                  >
                    <AlertCircle className="mt-px h-4 w-4 shrink-0" aria-hidden />
                    {error}
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <label htmlFor="email" className={rotulo}>E-mail</label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--of-tinta-3)]" aria-hidden />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      autoFocus
                      className={`${campo} pr-4`}
                      placeholder="seu@empresa.com"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between">
                    <label htmlFor="password" className={rotulo}>Senha</label>
                    <a
                      href="/esqueci-senha"
                      className="rounded text-[13px] text-[var(--of-coral-acao)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--of-coral-acao)]"
                    >
                      Esqueci minha senha
                    </a>
                  </div>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--of-tinta-3)]" aria-hidden />
                    <input
                      id="password"
                      name="password"
                      type={verSenha ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      className={`${campo} pr-12`}
                      placeholder="Sua senha"
                    />
                    <button
                      type="button"
                      onClick={() => setVerSenha((v) => !v)}
                      aria-label={verSenha ? "Ocultar senha" : "Mostrar senha"}
                      className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-lg text-[var(--of-tinta-3)] hover:bg-[var(--of-calha)] focus-visible:outline-2 focus-visible:outline-[var(--of-coral-acao)]"
                    >
                      {verSenha ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--of-coral-acao)] text-[15px] font-semibold text-white transition-colors hover:bg-[var(--of-coral-acao-hover)] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--of-coral-acao)]"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  {loading ? "Entrando…" : "Entrar"}
                  {!loading && <ArrowRight className="h-4 w-4" aria-hidden />}
                </button>
              </form>

              <div className="mt-8 h-px bg-[var(--of-linha)]" />
              {/* Não existe autocadastro: conta nova é criada por um admin em Configurações. */}
              <p className="mt-6 text-center text-[13px] text-[var(--of-tinta-avatar)]">
                Ainda não tem acesso? Fale com o administrador da sua conta.
              </p>
            </div>

            <p className="mt-6 text-center text-[11px] text-[var(--of-tinta-3)]">© Scott Studio · Direitos reservados</p>
          </div>
        </div>
      </section>
    </main>
  );
}
