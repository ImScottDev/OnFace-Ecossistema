import { ModuloPendente } from "@/components/crm2/ModuloPendente";

export const metadata = { title: "Chamados" };

/** Destino estrutural da árvore de navegação congelada em 16/09.
 *  O módulo ainda não foi construído: não há tabela de chamados no banco nem
 *  integração com mesa de suporte, e a página não simula funcionalidade.
 *  Revisado em 01/10: as duas dependências continuam abertas (decisão de
 *  produto, não de código). */
export default function ChamadosPage() {
  return (
    <ModuloPendente
      titulo="Chamados"
      resumo="Fila de chamados do suporte: abertura, responsável, prazo e desfecho, no mesmo lugar onde a operação já acompanha atividades e calendário."
      dependencias={[
            "Definir a origem dos chamados (mesa de suporte atual ou registro dentro do CRM)",
            "Definir o que é um chamado fechado e quem pode fechar",
      ]}
      enquanto={{
        texto: "Hoje o pedido de suporte chega como conversa no Atendimento.",
        href: "/atendimento",
        rotulo: "Abrir Atendimento",
      }}
    />
  );
}
