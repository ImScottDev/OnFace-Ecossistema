"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

const CARMIM = "#e23752";

interface CheckoutData {
  id: string;
  status: string;
  stripeCheckoutUrl: string | null;
  propostaId: string;
  propostaNumero: string | null;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#f7f7fa", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 16px", textAlign: "center" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/callface-logo.svg" alt="Callface" style={{ height: 32, marginBottom: 28 }} />
      {children}
    </div>
  );
}

/**
 * Redireciona pro Stripe Hosted Checkout depois de registrar CheckoutOpened
 * de verdade (não dá pra saber que o cliente abriu o link se ele só é
 * jogado direto no domínio do Stripe). Auto-redirect + link manual de
 * fallback (evita ficar preso se o JS de redirect falhar).
 */
export function CheckoutPublico({ id }: { id: string }) {
  const { data, isLoading, error } = useQuery<CheckoutData>({
    queryKey: ["checkout-publico", id],
    queryFn: async () => {
      const r = await fetch(`/api/checkouts/${id}/publica`);
      if (!r.ok) throw new Error("not-found");
      return r.json();
    },
    retry: false,
  });

  useEffect(() => {
    if (data?.stripeCheckoutUrl && !data.stripeCheckoutUrl.startsWith("mock://") && data.status !== "pago" && data.status !== "expirado") {
      const t = setTimeout(() => { window.location.href = data.stripeCheckoutUrl!; }, 1200);
      return () => clearTimeout(t);
    }
  }, [data]);

  if (isLoading) return <Shell><p style={{ color: "#9497ab", fontSize: 14 }}>Preparando pagamento...</p></Shell>;
  if (error || !data) return <Shell><p style={{ color: CARMIM, fontSize: 14 }}>Link de pagamento não encontrado. Fale com quem te enviou a proposta.</p></Shell>;

  if (data.status === "pago") return <Shell><p style={{ color: "#0f9d58", fontSize: 15, fontWeight: 700 }}>Pagamento já confirmado — obrigado!</p></Shell>;
  if (data.status === "expirado") return <Shell><p style={{ color: CARMIM, fontSize: 14 }}>Este link de pagamento expirou. Fale com quem te enviou a proposta pra gerar um novo.</p></Shell>;
  if (data.stripeCheckoutUrl?.startsWith("mock://")) {
    return <Shell><p style={{ fontSize: 14, color: "#4b4d63", maxWidth: 420 }}>Checkout local em modo mock. Nenhuma chamada ou cobrança foi feita no Stripe. Valide a confirmação usando um evento de teste assinado no webhook.</p></Shell>;
  }

  return (
    <Shell>
      <p style={{ fontSize: 14, color: "#4b4d63", marginBottom: 16 }}>
        {data.propostaNumero ? `Proposta ${data.propostaNumero} — ` : ""}redirecionando pra pagamento seguro...
      </p>
      {data.stripeCheckoutUrl && (
        <a href={data.stripeCheckoutUrl} style={{ padding: "12px 24px", borderRadius: 10, background: CARMIM, color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
          Continuar pro pagamento
        </a>
      )}
    </Shell>
  );
}
