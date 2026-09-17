import { ModuloPendente } from "@/components/crm2/ModuloPendente";

/** Destino estrutural da árvore de navegação congelada em 16/09.
 *  O módulo ainda não foi construído: a página não simula funcionalidade. */
export default function ClientesImplantacaoPabxPage() {
  return (
    <ModuloPendente
      titulo="Implantação PABX"
      area="Operação · Pós-vendas"
      resumo="Recorte da implantação da família PABX: só as entregas dessa família, com as etapas que ela realmente tem."
      dependencias={[
            "`service_family = 'PABX'` já existe nas entregas; falta definir as etapas próprias dessa família",
      ]}
    />
  );
}
