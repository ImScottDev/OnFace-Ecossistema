"use client";

import { useEffect } from "react";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Erro de rota do CRM — §44 e P8.
 *
 * Sem este arquivo, uma exceção no servidor de qualquer uma das ~80 telas caía
 * na tela de erro padrão do Next: fundo branco, "Application error: a
 * server-side exception has occurred" e um digest hexadecimal. O operador não
 * tinha nem como tentar de novo sem recarregar a página inteira.
 *
 * A spec separa erro de negócio de erro técnico (P8). Este limite pega o
 * TÉCNICO — o de negócio é tratado onde a regra mora, com a frase que nomeia a
 * regra. Por isso a mensagem aqui é curta e honesta sobre o que se sabe: algo
 * quebrou, não é culpa do que você fez, e dá para tentar de novo.
 *
 * `digest` aparece porque é o que liga esta tela ao log do servidor. Sem ele,
 * um chamado de suporte vira arqueologia. Não é stack trace: é um
 * identificador, e a spec proíbe stack trace, não referência.
 */
export default function ErroDeRota({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // O console é o que a pessoa que investiga abre primeiro; o erro completo
    // precisa estar lá mesmo com a tela mostrando a versão curta.
    console.error("[rota]", error);
  }, [error]);

  return (
    <div className="onface-pagina">
      <div className="flex flex-1 items-center justify-center">
        <div className="max-w-md text-center">
          <h1 className="text-base font-bold text-[var(--text-strong)]">
            Não foi possível carregar esta tela.
          </h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-muted)]">
            O erro é nosso, não do que você fez. Tentar de novo costuma
            resolver; se insistir, o código abaixo identifica a falha no log.
          </p>

          <div className="mt-4 flex items-center justify-center gap-2">
            <Button size="sm" onClick={reset}>
              <RotateCw aria-hidden />
              Tentar de novo
            </Button>
          </div>

          {error.digest ? (
            <p className="mt-4 font-mono text-[11px] text-[var(--text-muted)]">
              {error.digest}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
