import { ModuloPendente } from "@/components/crm2/ModuloPendente";

/** Destino estrutural da árvore de navegação congelada em 16/09.
 *  O módulo ainda não foi construído: a página não simula funcionalidade. */
export default function PosVendasPage() {
  return (
    <ModuloPendente
      titulo="Pós-vendas"
      area="Operação"
      resumo="Ponto de entrada do que acontece depois da venda assinada: onboarding e implantação por família de serviço."
      dependencias={[
            "Decidir se Pós-vendas é uma tela própria ou só o agrupamento de Onboarding e Implantação no menu",
      ]}
    />
  );
}
