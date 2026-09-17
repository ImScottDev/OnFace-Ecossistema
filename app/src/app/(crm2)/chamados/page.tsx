import { ModuloPendente } from "@/components/crm2/ModuloPendente";

/** Destino estrutural da árvore de navegação congelada em 16/09.
 *  O módulo ainda não foi construído: a página não simula funcionalidade. */
export default function ChamadosPage() {
  return (
    <ModuloPendente
      titulo="Chamados"
      area="Operação"
      resumo="Fila de chamados do suporte: abertura, responsável, prazo e desfecho, no mesmo lugar onde a operação já acompanha atividades e calendário."
      dependencias={[
            "Definir a origem dos chamados (mesa de suporte atual ou registro dentro do CRM)",
            "Definir o que é um chamado fechado e quem pode fechar",
      ]}
    />
  );
}
