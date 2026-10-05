import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading de rota do CRM — §43 ("Page shell: render immediately. Main data:
 * skeleton").
 *
 * O app inteiro não tinha nenhum `loading.tsx`. Como todas as rotas do grupo
 * são `force-dynamic` e leem o banco no servidor, clicar num item do menu
 * deixava a tela anterior parada sem nenhum sinal — medido em 22/09, de 0,2s
 * em `/clientes/expansao` a 9,8s em `/ajustes/qualidade-dados`. A pessoa não
 * sabia se o clique tinha pegado, e clicava de novo.
 *
 * Um arquivo no grupo de rotas atende as ~80 telas: o Next aplica o `loading`
 * mais próximo, então uma rota que precise de esqueleto próprio é só criar o
 * dela ao lado da página.
 *
 * O esqueleto imita a ESTRUTURA do padrão de página (cabeçalho, faixa de
 * resumo, conteúdo), não um retângulo genérico. Isso é o que impede o pulo de
 * layout quando o conteúdo real chega: o espaço já está reservado no tamanho
 * certo.
 */
export default function CarregandoRota() {
  return (
    <div className="onface-pagina" aria-busy="true" aria-live="polite">
      <span className="sr-only">Carregando</span>

      {/* Cabeçalho: título compacto e ação primária */}
      <div className="onface-pagina-cabecalho">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-8 w-36" />
      </div>

      {/* Faixa de resumo: mesma moldura, mesma divisão em quatro */}
      <div className="onface-resumo">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="onface-resumo-item">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="mt-1.5 h-5 w-28" />
          </div>
        ))}
      </div>

      {/* Conteúdo: quatro colunas, que é a forma mais comum do grupo (board).
          Uma lista também cabe nesta silhueta sem pular. */}
      <div className="flex min-h-0 flex-1 gap-3">
        {[0, 1, 2, 3].map((coluna) => (
          <div key={coluna} className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-8 w-full" />
            {[0, 1, 2].map((linha) => (
              <Skeleton
                key={linha}
                className="w-full"
                // Alturas diferentes por linha: um empilhamento de retângulos
                // idênticos lê como padrão gráfico, não como conteúdo chegando.
                style={{ height: `${[96, 72, 84][linha]}px` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
