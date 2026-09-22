import { ModuloPendente } from "@/components/crm2/ModuloPendente";

/** Destino estrutural da árvore de navegação congelada em 16/09.
 *  O módulo ainda não foi construído: a página não simula funcionalidade. */
export default function RelatoriosBibliotecaPage() {
  return (
    <ModuloPendente
      titulo="Relatórios"
      resumo="Biblioteca de relatórios salvos, separada da visão geral de indicadores."
      dependencias={[
            "Definir quais relatórios entram e quem pode salvar um relatório novo",
      ]}
    />
  );
}
