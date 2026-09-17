import { ModuloPendente } from "@/components/crm2/ModuloPendente";

/** Destino estrutural da árvore de navegação congelada em 16/09.
 *  O módulo ainda não foi construído: a página não simula funcionalidade. */
export default function ClientesExpansaoPage() {
  return (
    <ModuloPendente
      titulo="Expansão & Renovação"
      area="Clientes"
      resumo="Oportunidades dentro da base: upgrade, aumento de uso e renovação de contrato."
      dependencias={[
            "Não existe pipeline de expansão no domínio. Enquanto não existir, nenhuma tela mostra etapa de expansão",
            "Definir o gatilho de renovação a partir do contrato",
      ]}
    />
  );
}
