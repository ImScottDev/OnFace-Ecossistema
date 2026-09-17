import { ModuloPendente } from "@/components/crm2/ModuloPendente";

/** Destino estrutural da árvore de navegação congelada em 16/09.
 *  O módulo ainda não foi construído: a página não simula funcionalidade. */
export default function ClientesImplantacaoWhiteLabelPage() {
  return (
    <ModuloPendente
      titulo="Implantação White Label"
      area="Operação · Pós-vendas"
      resumo="Recorte da implantação da família White Label: só as entregas dessa família, com as etapas que ela realmente tem."
      dependencias={[
            "`service_family = 'WHITE_LABEL'` já existe nas entregas; falta definir as etapas próprias dessa família",
      ]}
    />
  );
}
