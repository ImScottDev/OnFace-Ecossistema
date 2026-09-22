import { ModuloPendente } from "@/components/crm2/ModuloPendente";

/** Destino estrutural da árvore de navegação congelada em 16/09.
 *  O módulo ainda não foi construído: a página não simula funcionalidade. */
export default function ClientesExpansaoPage() {
  return (
    <ModuloPendente
      titulo="Expansão & Renovação"
      resumo="Oportunidades dentro da base: upgrade, aumento de uso e renovação de contrato."
      dependencias={[
            "Definir o gatilho de renovação a partir do contrato",
            "Não há histórico de expansão para a tela mostrar: zero negócios com commercial_motion EXPANSION. O caminho existe e é exercido por smoke; o que falta é a operação usá-lo",
      ]}
    />
  );
}
