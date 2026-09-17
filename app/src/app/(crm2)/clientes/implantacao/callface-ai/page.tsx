import { ModuloPendente } from "@/components/crm2/ModuloPendente";

/** Destino estrutural da árvore de navegação congelada em 16/09.
 *  O módulo ainda não foi construído: a página não simula funcionalidade. */
export default function ClientesImplantacaoCallfaceAiPage() {
  return (
    <ModuloPendente
      titulo="Implantação Callface AI"
      area="Operação · Pós-vendas"
      resumo="Recorte da implantação da família Callface AI: só as entregas dessa família, com as etapas que ela realmente tem."
      dependencias={[
            "`service_family = 'CALLFACE_AI'` já existe nas entregas; falta definir as etapas próprias dessa família",
      ]}
    />
  );
}
