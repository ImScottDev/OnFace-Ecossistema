"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, Eye, EyeOff, Loader2, Lock, TriangleAlert } from "lucide-react";

/**
 * Definir senha (convite) / redefinir senha (link do "esqueci") — linguagem
 * ONFACE (01/10), a mesma do `/login` e do `/esqueci-senha`: papel ao fundo,
 * lockup positivo e o cartão branco. Era a última tela de acesso ainda no
 * escuro do CRM 1, e é justamente a PRIMEIRA que um convidado vê.
 *
 * Cor por token (`onface-proto.css` / `onface.css`), como a vizinha.
 * A lógica é a mesma de antes: valida o token em GET /api/conta/token/:token
 * e grava em POST /api/conta/definir-senha.
 */
const campo =
  "w-full h-12 pl-11 pr-11 rounded-xl text-[14px] outline-none bg-white text-[var(--of-tinta-forte)] placeholder:text-[var(--onface-slate)] " +
  "shadow-[inset_0_0_0_1px_var(--of-linha)] transition-shadow focus:shadow-[inset_0_0_0_1.5px_var(--of-coral-acao),0_0_0_4px_rgba(254,79,43,0.12)]";
const rotulo = "text-[11px] font-semibold tracking-[0.12em] uppercase text-[var(--onface-cinza-3)]";
const botao =
  "flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--of-coral-acao)] text-[15px] font-semibold text-white transition-colors " +
  "hover:bg-[var(--of-coral-acao-hover)] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--of-coral-acao)]";

function Aviso({ tom, children }: { tom: "ok" | "erro"; children: React.ReactNode }) {
  const Icone = tom === "ok" ? CheckCircle2 : TriangleAlert;
  return (
    <div
      role={tom === "erro" ? "alert" : "status"}
      className="flex items-start gap-3 rounded-xl p-4 text-[14px] leading-relaxed text-[var(--of-tinta-forte)] bg-[var(--of-calha)]"
    >
      <Icone className={`mt-0.5 h-5 w-5 shrink-0 ${tom === "ok" ? "text-[var(--of-canal-whatsapp-tinta)]" : "text-[var(--of-coral-acao)]"}`} aria-hidden />
      <span>{children}</span>
    </div>
  );
}

function CampoSenha({ id, rotuloTexto, valor, onChange, placeholder, autoFocus }: {
  id: string; rotuloTexto: string; valor: string; onChange: (v: string) => void; placeholder: string; autoFocus?: boolean;
}) {
  const [ver, setVer] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className={rotulo}>{rotuloTexto}</label>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--onface-cinza)]" aria-hidden />
        <input
          id={id} type={ver ? "text" : "password"} required minLength={8} autoComplete="new-password" autoFocus={autoFocus}
          value={valor} onChange={(e) => onChange(e.target.value)} className={campo} placeholder={placeholder}
        />
        <button
          type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? "Ocultar senha" : "Mostrar senha"}
          className="absolute right-2 top-1/2 -translate-y-1/2 grid h-9 w-9 place-items-center rounded-lg text-[var(--onface-cinza)] hover:text-[var(--of-tinta-forte)] focus-visible:outline-2 focus-visible:outline-[var(--of-coral-acao)]"
        >
          {ver ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
        </button>
      </div>
    </div>
  );
}

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
    if (senha !== confirma) { setErro("As duas senhas não são iguais. Digite de novo na confirmação."); return; }
    setLoading(true);
    const res = await fetch("/api/conta/definir-senha", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, senha }),
    }).catch(() => null);
    setLoading(false);
    if (res?.ok) setEstado("ok");
    else setErro((await res?.json().catch(() => ({})))?.error || "Não foi possível salvar. Peça um novo link.");
  };

  const titulo = tipo === "reset" ? "Nova senha" : "Crie sua senha";

  return (
    <div className="rounded-[24px] bg-white p-7 sm:p-10 shadow-[inset_0_0_0_1px_var(--of-linha),0_24px_48px_-28px_rgba(18,23,29,0.25)]">
      <h1
        className="text-[34px] leading-none font-extrabold tracking-[-0.03em] text-[var(--of-tinta-forte)]"
        style={{ fontFamily: "var(--font-onface-titulo)" }}
      >
        {estado === "invalido" ? "Link expirado" : estado === "ok" ? "Senha salva" : titulo}
      </h1>

      {estado === "validando" && (
        <p className="mt-8 flex items-center gap-2 text-[14px] text-[var(--onface-cinza-2)]" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Validando o link…
        </p>
      )}

      {estado === "invalido" && (
        <div className="mt-8 flex flex-col gap-6">
          <Aviso tom="erro">
            Este link não vale mais — ele expira depois de usado ou depois de alguns dias. Peça um novo convite
            ao administrador da sua conta, ou gere um novo link em &ldquo;Esqueci minha senha&rdquo;.
          </Aviso>
          <a href="/esqueci-senha" className={botao}>Gerar novo link <ArrowRight className="h-4 w-4" aria-hidden /></a>
          <p className="text-center">
            <a href="/login" className="text-[13px] text-[var(--of-coral-acao)] hover:underline">Voltar para o login</a>
          </p>
        </div>
      )}

      {estado === "ok" && (
        <div className="mt-8 flex flex-col gap-6">
          <Aviso tom="ok">Pronto. Entre com o seu e-mail e a senha que você acabou de criar.</Aviso>
          <a href="/login" className={botao}>Entrar <ArrowRight className="h-4 w-4" aria-hidden /></a>
        </div>
      )}

      {estado === "valido" && (
        <>
          <p className="mt-3 text-[15px] text-[var(--onface-cinza-2)]">
            {nome ? <>Olá, <span className="font-semibold text-[var(--of-tinta-forte)]">{nome.split(" ")[0]}</span>. </> : null}
            {tipo === "reset" ? "Escolha uma senha nova para a sua conta ONFACE." : "Defina a senha de acesso à sua conta ONFACE."}
          </p>
          <form onSubmit={submit} className="mt-8 flex flex-col gap-5">
            {erro && <Aviso tom="erro">{erro}</Aviso>}
            <CampoSenha id="senha" rotuloTexto="Nova senha" valor={senha} onChange={setSenha} placeholder="Mínimo de 8 caracteres" autoFocus />
            <CampoSenha id="confirma" rotuloTexto="Confirmar senha" valor={confirma} onChange={setConfirma} placeholder="Repita a senha" />
            <button type="submit" disabled={loading} className={`mt-1 ${botao}`}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {loading ? "Salvando…" : "Salvar senha"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

export default function DefinirSenhaPage() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-[var(--of-papel-tela)]"
      style={{ fontFamily: "var(--font-onface-corpo)" }}
    >
      <div className="w-full max-w-[460px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/onface/onface-lockup-positiva.svg" alt="ONFACE" className="h-8 mb-8 mx-auto" />
        <Suspense fallback={<div className="rounded-[24px] bg-white p-10 text-[14px] text-[var(--onface-cinza-2)]">Carregando…</div>}>
          <DefinirSenhaInner />
        </Suspense>
        <p className="mt-6 text-center text-[11px] text-[var(--onface-cinza)]">© Scott Studio · Direitos reservados</p>
      </div>
    </main>
  );
}
