"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Loader2, Mail, MailCheck } from "lucide-react";

/**
 * Esqueci a senha — linguagem ONFACE (01/10), a mesma do `/login`: papel ao
 * fundo, lockup positivo e o cartão branco com o formulário. O painel grafite
 * da marca fica só no login; aqui a tela é um passo de serviço, curto.
 *
 * Cor vem por token (`onface-proto.css` / `onface.css`), não por hex: os
 * valores são os mesmos do login, só que com nome — a catraca
 * `cor-tem-nome` não deixa esta folha crescer em hex.
 *
 * A lógica é a mesma da versão anterior: POST /api/conta/esqueci e a mesma
 * confirmação neutra, que não revela se o e-mail tem conta.
 */
export default function EsqueciSenhaPage() {
  const [enviado, setEnviado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setFalha(null);
    const email = new FormData(e.currentTarget).get("email");
    /* A resposta é lida. Antes o `catch(() => {})` engolia tudo e a tela dizia
       "enviamos o link" mesmo quando o provedor de e-mail estava fora — a
       pessoa, trancada fora do CRM, ficava esperando um e-mail que nunca saiu.
       E-mail sem conta continua devolvendo sucesso (é o que impede descobrir
       quem tem conta); o que passa a aparecer é falha de INFRAESTRUTURA, que
       não diz nada sobre a conta. */
    try {
      const r = await fetch("/api/conta/esqueci", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!r.ok) {
        setFalha(r.status === 503
          ? "O envio de e-mail está indisponível agora. Avise o time para liberar seu acesso."
          : "Não conseguimos enviar o e-mail. Tente de novo em instantes.");
        setLoading(false);
        return;
      }
    } catch {
      setFalha("Não conseguimos falar com o servidor. Verifique a conexão e tente de novo.");
      setLoading(false);
      return;
    }
    setEnviado(true);
    setLoading(false);
  };

  const campo =
    "w-full h-12 pl-11 pr-4 rounded-xl text-[14px] outline-none bg-white text-[var(--of-tinta-forte)] placeholder:text-[var(--onface-slate)] " +
    "shadow-[inset_0_0_0_1px_var(--of-linha)] transition-shadow focus:shadow-[inset_0_0_0_1.5px_var(--of-coral-acao),0_0_0_4px_rgba(254,79,43,0.12)]";
  const rotulo = "text-[11px] font-semibold tracking-[0.12em] uppercase text-[var(--onface-cinza-3)]";
  const botao =
    "flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--of-coral-acao)] text-[15px] font-semibold text-white transition-colors " +
    "hover:bg-[var(--of-coral-acao-hover)] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--of-coral-acao)]";
  const voltar =
    "inline-flex items-center gap-1.5 rounded text-[13px] text-[var(--of-coral-acao)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--of-coral-acao)]";

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-[var(--of-papel-tela)]"
      style={{ fontFamily: "var(--font-onface-corpo)" }}
    >
      <div className="w-full max-w-[460px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/onface/onface-lockup-positiva.svg" alt="ONFACE" className="h-8 mb-8 mx-auto" />

        <div className="rounded-[24px] bg-white p-7 sm:p-10 shadow-[inset_0_0_0_1px_var(--of-linha),0_24px_48px_-28px_rgba(18,23,29,0.25)]">
          <h1
            className="text-[34px] leading-none font-extrabold tracking-[-0.03em] text-[var(--of-tinta-forte)]"
            style={{ fontFamily: "var(--font-onface-titulo)" }}
          >
            Redefinir senha
          </h1>

          {enviado ? (
            <div className="mt-8 flex flex-col gap-6">
              {/* role="status": a troca do formulário pela confirmação é anunciada ao leitor de tela. */}
              <div
                role="status"
                className="flex items-start gap-3 rounded-xl p-4 text-[14px] leading-relaxed text-[var(--of-tinta-forte)] bg-[var(--of-calha)]"
              >
                <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--of-coral-acao)]" aria-hidden />
                Se esse e-mail tiver conta, enviamos um link para redefinir a senha. Verifique a caixa de entrada (e o spam).
              </div>
              <a href="/login" className={botao}>
                Voltar para o login
                <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
            </div>
          ) : (
            <>
              {falha && (
                <div role="alert" className="mt-4 rounded-xl p-4 text-[14px] leading-relaxed text-[var(--of-tinta-forte)] bg-[var(--of-calha)]">
                  {falha}
                </div>
              )}
              <p className="mt-3 text-[15px] text-[var(--onface-cinza-2)]">
                Informe o e-mail da sua conta. Enviaremos um link para você criar uma nova senha.
              </p>

              <form method="post" onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <label htmlFor="email" className={rotulo}>E-mail</label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--onface-cinza)]" aria-hidden />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      autoFocus
                      className={campo}
                      placeholder="seu@empresa.com"
                    />
                  </div>
                </div>

                <button type="submit" disabled={loading} className={`mt-1 ${botao}`}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  {loading ? "Enviando…" : "Enviar link de redefinição"}
                </button>
              </form>

              <div className="mt-8 h-px bg-[var(--of-linha)]" />
              <p className="mt-6 text-center">
                <a href="/login" className={voltar}>
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                  Voltar para o login
                </a>
              </p>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-[11px] text-[var(--onface-cinza)]">© Scott Studio · Direitos reservados</p>
      </div>
    </main>
  );
}
