import { ModuloPendente } from "@/components/crm2/ModuloPendente";

/** Destino estrutural da árvore de navegação congelada em 16/09.
 *  O módulo ainda não foi construído: a página não simula funcionalidade. */
export default function ClientesRiscoPage() {
  return (
    <ModuloPendente
      titulo="Risco / Churn"
      area="Clientes"
      resumo="Contas com sinal de saída antes do cancelamento acontecer."
      dependencias={[
            "Definir o que conta como sinal de risco (uso, inadimplência, chamado, silêncio)",
            "66% do churn hoje é pagamento recusado, não churn voluntário: a tela precisa separar os dois",
      ]}
    />
  );
}
