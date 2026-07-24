"use client";

import { useEffect, useState } from "react";

/**
 * Fallback de carregamento do CRM com watchdog. Se uma tela ficar presa
 * carregando (render server pendurado / dado que não volta), depois de ~12s
 * mandamos a pessoa pro /login em vez de deixar "carregando pra sempre".
 * Quando a página resolve, este componente desmonta e o timer é limpo.
 */
export default function CrmLoading() {
  const [lento, setLento] = useState(false);

  useEffect(() => {
    const avisa = setTimeout(() => setLento(true), 6000);
    const redireciona = setTimeout(() => {
      const atual = window.location.pathname + window.location.search;
      window.location.href = `/login?callbackUrl=${encodeURIComponent(atual)}`;
    }, 12000);
    return () => {
      clearTimeout(avisa);
      clearTimeout(redireciona);
    };
  }, []);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4" style={{ background: "var(--bg-primary)" }}>
      <div className="h-8 w-8 rounded-full border-2 border-white/10 border-t-[#e23752] animate-spin" />
      <p className="text-[12px] text-white/40">
        {lento ? "Ainda carregando… se não abrir, vamos te levar pro login." : "Carregando…"}
      </p>
    </div>
  );
}
