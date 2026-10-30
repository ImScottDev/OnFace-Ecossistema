"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, CheckCircle2, CreditCard, Loader2, Lock } from "lucide-react";
import "./publico.css";

interface CheckoutData {
  id: string;
  status: string;
  stripeCheckoutUrl: string | null;
  propostaId: string;
  propostaNumero: string | null;
}

type Tom = "ok" | "risco" | "neutro";

/** Cartão único no mesmo documento da proposta pública (fio coral, marca, papel). */
function Cartao({ tom, Icone, titulo, children, propostaId }: {
  tom: Tom; Icone: typeof Lock; titulo: string; children?: React.ReactNode; propostaId?: string | null;
}) {
  return (
    <main className="pp-tela" style={{ display: "grid", placeItems: "center" }}>
      <div className="pp-coluna" style={{ maxWidth: 480 }}>
        <article className="pp-doc">
          <div className="pp-doc-corpo" style={{ gap: 22 }}>
            <div className="pp-marca">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/proto/callface-logo.png" alt="Callface" />
            </div>
            <div className="pp-estado" style={{ padding: 0 }}>
              <span className={`pp-estado-icone pp-status-${tom}`}><Icone size={18} aria-hidden className={Icone === Loader2 ? "animate-spin" : undefined} /></span>
              <h1>{titulo}</h1>
              {children}
            </div>
            {propostaId && (
              <a className="pp-link" href={`/p/${propostaId}`}><ArrowLeft size={13} aria-hidden /> Voltar à proposta</a>
            )}
          </div>
        </article>
        <p className="pp-selo"><Lock size={12} aria-hidden /> Pagamento processado pela Stripe · a Callface não vê os dados do seu cartão</p>
      </div>
    </main>
  );
}

/**
 * Bridge pública de checkout — nossa casca antes do Stripe Hosted Checkout.
 *
 * Registra CheckoutOpened de verdade (não dá pra saber que o cliente abriu o
 * link se ele só é jogado direto no domínio do Stripe) e redireciona sozinha,
 * com botão manual de reserva caso o redirect por JS falhe.
 *
 * Linguagem ONFACE (01/10), a mesma do documento da proposta. Quando o Stripe
 * não está ligado (URL `mock://`, só em ambiente de teste), a tela diz isso
 * com todas as letras — nenhum botão finge cobrar.
 */
export function CheckoutPublico({ id }: { id: string }) {
  const { data, isLoading, error } = useQuery<CheckoutData>({
    queryKey: ["checkout-publico", id],
    queryFn: async () => {
      const r = await fetch(`/api/checkouts/${id}/publica`);
      if (!r.ok) throw new Error(r.status === 410 ? "desativado" : "not-found");
      return r.json();
    },
    retry: false,
  });

  const podeRedirecionar = !!data?.stripeCheckoutUrl && !data.stripeCheckoutUrl.startsWith("mock://") && data.status !== "pago" && data.status !== "expirado";

  useEffect(() => {
    if (!podeRedirecionar) return;
    const t = setTimeout(() => { window.location.href = data!.stripeCheckoutUrl!; }, 1200);
    return () => clearTimeout(t);
  }, [podeRedirecionar, data]);

  if (isLoading) {
    return <Cartao tom="neutro" Icone={Loader2} titulo="Preparando o pagamento…"><p>Só um instante.</p></Cartao>;
  }
  if (error || !data) {
    return (
      <Cartao tom="risco" Icone={AlertTriangle} titulo={error?.message === "desativado" ? "Link desativado" : "Link de pagamento não encontrado"}>
        <p>Confira se o link chegou completo ou fale com quem te enviou a proposta na Callface.</p>
      </Cartao>
    );
  }
  const ref = data.propostaNumero ? `Proposta ${data.propostaNumero}` : null;

  if (data.status === "pago") {
    return (
      <Cartao tom="ok" Icone={CheckCircle2} titulo="Pagamento confirmado" propostaId={data.propostaId}>
        <p>{ref ? `${ref} — ` : ""}recebemos a confirmação. Obrigado! Nosso time segue com os próximos passos.</p>
      </Cartao>
    );
  }
  if (data.status === "expirado") {
    return (
      <Cartao tom="risco" Icone={AlertTriangle} titulo="Este link de pagamento expirou" propostaId={data.propostaId}>
        <p>Abra a proposta de novo para gerar um link atualizado, ou fale com quem te enviou.</p>
      </Cartao>
    );
  }
  if (!podeRedirecionar) {
    // `mock://` (Stripe desligado no ambiente) ou URL ausente: sem cobrança possível.
    return (
      <Cartao tom="risco" Icone={AlertTriangle} titulo="Pagamento online indisponível" propostaId={data.propostaId}>
        <p>
          Não conseguimos abrir o pagamento para este link agora. Nenhuma cobrança foi feita.
          Fale com quem te enviou a proposta para concluir por outro caminho.
        </p>
      </Cartao>
    );
  }

  return (
    <Cartao tom="neutro" Icone={CreditCard} titulo="Levando você ao pagamento seguro" propostaId={data.propostaId}>
      <p>{ref ? `${ref}. ` : ""}Você será redirecionado em instantes. Se nada acontecer, use o botão abaixo.</p>
      <a href={data.stripeCheckoutUrl!} className="pp-btn pp-btn-primario pp-btn-largo">
        <Lock size={14} aria-hidden /> Continuar para o pagamento
      </a>
    </Cartao>
  );
}
