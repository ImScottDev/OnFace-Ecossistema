import { Quadro } from "./Quadro";
import { PIPELINE_AMOSTRA } from "./dados";

/**
 * Pipeline do estúdio.
 *
 * A página é Server Component e só entrega os dados; a interação (abrir o
 * detalhe, alternar filtro) vive no `Quadro`, que é client. Integrar = trocar
 * a constante por consulta, sem tocar no componente.
 *
 * Sem indicadores nem gráfico no topo: esta tela é para TRABALHAR oportunidade,
 * não para medir funil. Medir é a tela de Insights, e o total por etapa já vive
 * no cabeçalho de cada coluna. A altura que a faixa ocupava é do kanban.
 *
 * O título da tela mora na barra do topo (`Cabecalho.tsx` + `paginas.ts`), não
 * aqui: repetir dentro do conteúdo gastava uma faixa de altura para dizer o que
 * o menu já disse.
 */
export default function PipelineEstudio() {
  return <Quadro colunas={PIPELINE_AMOSTRA} />;
}
