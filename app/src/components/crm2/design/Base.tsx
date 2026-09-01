/**
 * Peças de layout do catálogo (rota /design).
 *
 * Reescrito em 31/08 depois de uma crítica certeira do Kauã: "cada coisa está
 * dentro de um card, nosso sistema não é pra ser um monte de card". O catálogo
 * cometia exatamente o defeito que ele mesmo documenta como "cara de IA" —
 * tudo com o mesmo peso, card com borda e sombra em volta de cada amostra,
 * nenhuma hierarquia, o olho sem onde pousar.
 *
 * Agora a estrutura é achatada: a seção é o bloco, as amostras são divididas
 * por LINHA e não por caixa. Card fica reservado para o que é de fato uma
 * superfície elevada no produto — e é assim que as telas devem ser feitas.
 */
import * as React from "react";

export function Secao({
  id, titulo, descricao, children,
}: {
  id: string;
  titulo: string;
  descricao: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      {/* Cabeçalho de seção ancorado por uma linha, não por uma caixa. */}
      <header className="border-b border-linha pb-2.5 mb-4">
        <h2 className="text-titulo font-semibold font-display text-tinta">{titulo}</h2>
        <p className="text-corpo text-tinta-suave mt-1 max-w-3xl">{descricao}</p>
      </header>
      {children}
    </section>
  );
}

/**
 * Amostra sem caixa: rótulo pequeno + conteúdo. A separação vem do espaço e
 * de uma divisória fina, que é o suficiente — e é o que mantém a tela densa.
 */
export function Amostra({
  rotulo, codigo, children, className = "",
}: {
  rotulo: string;
  codigo?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-2.5 py-3 min-w-0 ${className}`}>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-apoio font-medium text-tinta">{rotulo}</span>
        {codigo && (
          <code className="text-micro font-mono text-tinta-fraca">{codigo}</code>
        )}
      </div>
      {children}
    </div>
  );
}

/**
 * Grade com divisórias entre colunas e linhas — separa sem encaixotar.
 * `min` controla quantas colunas cabem antes de quebrar.
 */
export function Grade({ children, min = 260 }: { children: React.ReactNode; min?: number }) {
  return (
    <div
      className="grid gap-x-6 divide-y sm:divide-y-0 divide-linha"
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(${min}px, 100%), 1fr))` }}
    >
      {children}
    </div>
  );
}

/** Superfície elevada de verdade — usada só quando o exemplo É um card. */
export function Painel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`cf2-card overflow-hidden ${className}`}>{children}</div>;
}
