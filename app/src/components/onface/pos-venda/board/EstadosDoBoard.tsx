"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Inbox, SearchX, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Nenhum projeto existe ainda (sem filtro nenhum). Diz por quê e para onde ir. */
export function BoardSemProjetos() {
  return (
    <div className="pv-estado" role="status">
      <span className="pv-estado-icone"><Inbox aria-hidden /></span>
      <h2>Ainda não há projetos de pós-venda</h2>
      <p>Eles nascem sozinhos quando uma venda é ganha. Assim que a primeira for fechada, o onboarding aparece aqui com as tarefas e o prazo já prontos.</p>
      <div className="pv-estado-acoes">
        <Button asChild variant="outline"><Link href="/pipeline">Ver oportunidades</Link></Button>
      </div>
    </div>
  );
}

/** Há projetos, mas o recorte não pega nenhum. A saída é desfazer o recorte. */
export function BoardSemResultado({ limpar, busca }: { limpar: string; busca: string | null }) {
  return (
    <div className="pv-estado" role="status">
      <span className="pv-estado-icone"><SearchX aria-hidden /></span>
      <h2>Nenhum projeto com esse recorte</h2>
      <p>{busca ? `Nada encontrado para "${busca}" com os filtros ligados.` : "Os filtros ligados não pegam nenhum projeto."} Limpe os filtros para voltar a ver tudo o que está em aberto.</p>
      <div className="pv-estado-acoes">
        <Button asChild variant="outline"><Link href={limpar}>Limpar filtros</Link></Button>
      </div>
    </div>
  );
}

/** A leitura falhou. Não mostra zero nem lista vazia: diz que falhou e oferece tentar de novo. */
export function ErroDeLeitura({ titulo = "Não consegui carregar o pós-venda", detalhe, aoTentar }: { titulo?: string; detalhe?: string; aoTentar?: () => void }) {
  const router = useRouter();
  const [carregando, comecar] = useTransition();
  return (
    <div className="pv-estado" role="alert" data-pv-tom="risco">
      <span className="pv-estado-icone"><TriangleAlert aria-hidden /></span>
      <h2>{titulo}</h2>
      <p>{detalhe ?? "Os números e a lista não foram lidos, então nenhum dado aparece aqui em vez de um zero que pareceria verdade."}</p>
      <div className="pv-estado-acoes">
        <Button
          variant="outline"
          loading={carregando}
          onClick={() => (aoTentar ? aoTentar() : comecar(() => router.refresh()))}
        >
          Tentar de novo
        </Button>
      </div>
    </div>
  );
}
