"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

export default function CrmError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-red-500/10">
        <AlertTriangle className="w-7 h-7 text-red-400" />
      </div>
      <div className="text-center space-y-1">
        <h2 className="text-lg font-semibold text-white">Algo deu errado</h2>
        <p className="text-sm text-white/40 max-w-md">
          {error.message || "Ocorreu um erro inesperado. Tente novamente."}
        </p>
      </div>
      <button
        onClick={reset}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors hover:brightness-110"
        style={{ background: "linear-gradient(135deg, #e23752, #e23752)" }}
      >
        <RefreshCw className="w-4 h-4" />
        Tentar novamente
      </button>
    </div>
  );
}
