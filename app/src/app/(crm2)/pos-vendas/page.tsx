import { ModuloPendente } from "@/components/crm2/ModuloPendente";

/** Destino estrutural da árvore de navegação congelada em 16/09.
 *  O módulo ainda não foi construído: a página não simula funcionalidade. */
export default function PosVendasPage() {
  return (
    <ModuloPendente
      titulo="Pós-vendas"
      resumo="Ponto de entrada do que acontece depois da venda assinada: onboarding e implantação por família de serviço."
      dependencias={[
            "Decidir se este destino mostra um resumo próprio das duas jornadas. Que Pós-vendas agrupa Onboarding e Implantação a árvore congelada em 16/09 já respondeu: é o pai dos dois no menu",
      ]}
    />
  );
}
