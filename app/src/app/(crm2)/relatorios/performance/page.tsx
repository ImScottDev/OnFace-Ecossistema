import { ModuloPendente } from "@/components/crm2/ModuloPendente";

export const metadata = { title: "Performance" };

/** Destino estrutural da árvore de navegação congelada em 16/09.
 *  O módulo ainda não foi construído: a página não simula funcionalidade. */
export default function RelatoriosPerformancePage() {
  return (
    <ModuloPendente
      titulo="Performance"
      resumo="Performance do time: atividade, conversão e tempo de resposta por pessoa."
      dependencias={[
            "Definir as métricas de performance antes de montar a tela; número de performance errado vira decisão errada sobre gente",
      ]}
    />
  );
}
