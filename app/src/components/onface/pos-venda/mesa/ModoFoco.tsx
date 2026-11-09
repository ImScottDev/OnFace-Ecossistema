"use client";

/**
 * Modo foco: um projeto por vez, decisão por tecla.
 *
 * A mesa responde "o que precisa de mim?" em uma olhada. Este modo responde a
 * outra pergunta, que vem depois: "vou sentar e resolver". São trabalhos
 * diferentes e por isso são telas diferentes — a mesa não vira isto, ela
 * oferece isto.
 *
 * O vocabulário de teclado é o do Triage do Linear, de propósito: quem usa
 * ferramenta de trabalho já sabe que uma tecla decide e `j`/`k` andam. A
 * legenda fica visível porque descobrir atalho por tentativa não é descoberta,
 * é sorte.
 *
 * A pilha encolhe conforme se decide. Quando esvazia, o modo diz que acabou e
 * fecha sozinho — é o fim que a lista nunca teve.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, X } from "lucide-react";
import type { CartaoDoProjeto, MotivoDaEspera } from "@/lib/pos-venda/contrato";
import { MOTIVOS } from "../formatos";
import { oQueFazer, porQue } from "./bola";
import { ResumoDoProjeto } from "./pecas-da-mesa";

const TECLA_DO_MOTIVO: Record<string, MotivoDaEspera> = { c: "cliente", o: "operadora", i: "interno" };

export function ModoFoco({
  cartoes, agora, aoFechar, aoPassarBola,
}: {
  cartoes: CartaoDoProjeto[];
  agora: Date;
  aoFechar: () => void;
  aoPassarBola: (c: CartaoDoProjeto, m: MotivoDaEspera) => void;
}) {
  const router = useRouter();
  const [i, setI] = useState(0);
  const caixa = useRef<HTMLDivElement>(null);

  /* A pilha encolhe quando alguém passa a bola: o índice precisa acompanhar
     para não cair fora do fim e mostrar tela em branco. */
  const total = cartoes.length;
  const atual = cartoes[Math.min(i, Math.max(0, total - 1))];

  useEffect(() => {
    if (total === 0) return;
    if (i > total - 1) setI(total - 1);
  }, [total, i]);

  const andar = useCallback((d: 1 | -1) => setI((x) => Math.max(0, Math.min(total - 1, x + d))), [total]);

  useEffect(() => {
    caixa.current?.focus();
    const naTecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      /* Atalho de uma tecla não dispara dentro de campo de texto: a pessoa
         está escrevendo, não comandando. */
      if (alvo && (alvo.closest("input, textarea, [contenteditable]") || alvo.getAttribute("role") === "textbox")) return;

      if (e.key === "Escape") { e.preventDefault(); aoFechar(); return; }
      if (!atual) return;

      if (e.key === "Enter" || e.key === "1") { e.preventDefault(); router.push(`/pos-vendas/${atual.id}`); return; }
      if (e.key === "j" || e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); andar(1); return; }
      if (e.key === "k" || e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); andar(-1); return; }

      const motivo = TECLA_DO_MOTIVO[e.key.toLowerCase()];
      if (motivo) { e.preventDefault(); aoPassarBola(atual, motivo); }
    };
    window.addEventListener("keydown", naTecla);
    return () => window.removeEventListener("keydown", naTecla);
  }, [atual, andar, aoFechar, aoPassarBola, router]);

  return (
    <div className="mz-foco" role="dialog" aria-modal="true" aria-label="Foco nas entregas que precisam de você">
      {/* Clicar fora fecha: o modo é um lugar onde se entra, não uma armadilha. */}
      <button type="button" className="mz-foco-fundo" aria-label="Sair do foco" onClick={aoFechar} />

      <div className="mz-foco-caixa" ref={caixa} tabIndex={-1}>
        <header className="mz-foco-cab">
          <span className="mz-foco-passo mz-num">
            {total > 0 ? `${Math.min(i + 1, total)} de ${total}` : "pronto"}
          </span>
          <button type="button" className="mz-foco-sair" onClick={aoFechar} aria-label="Sair do foco">
            <X aria-hidden />
          </button>
        </header>

        {atual ? (
          <>
            <ResumoDoProjeto c={atual} verbo={oQueFazer(atual)} motivo={porQue(atual, agora)} />

            <div className="mz-foco-acoes">
              <button type="button" className="mz-foco-primaria" onClick={() => router.push(`/pos-vendas/${atual.id}`)}>
                Abrir o projeto
                <kbd>↵</kbd>
              </button>
              <div className="mz-foco-passar">
                <span className="mz-foco-passar-rotulo">Passar a bola</span>
                {(["cliente", "operadora", "interno"] as MotivoDaEspera[]).map((m) => (
                  <button key={m} type="button" className="mz-foco-secundaria" onClick={() => aoPassarBola(atual, m)}>
                    {MOTIVOS[m].rotulo}
                    <kbd>{m[0].toUpperCase()}</kbd>
                  </button>
                ))}
              </div>
            </div>

            <footer className="mz-foco-pe">
              <button type="button" className="mz-foco-andar" onClick={() => andar(1)} disabled={i >= total - 1}>
                Próxima <kbd>J</kbd>
              </button>
              <span className="mz-foco-dica">
                <kbd>K</kbd> volta · <kbd>Esc</kbd> sai
              </span>
            </footer>
          </>
        ) : (
          <div className="mz-foco-fim" role="status">
            <Check aria-hidden />
            <strong>Acabou a fila.</strong>
            <span>Nenhuma entrega está esperando você agora.</span>
            <button type="button" className="mz-foco-primaria" onClick={aoFechar}>
              Voltar para a mesa <ArrowRight aria-hidden />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
