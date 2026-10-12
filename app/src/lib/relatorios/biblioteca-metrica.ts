/**
 * Rótulos humanos das colunas do detalhe de uma métrica (usados pela exportação).
 *
 * A leitura do valor e dos registros NÃO mora mais aqui: passa por
 * `lib/metricas/consulta` + `explorar`, que derivam card, lista e CSV do mesmo
 * recorte do catálogo. O leitor antigo (`lerMetrica`) tinha limite próprio e
 * rota de exportação própria, e foi removido para não existirem dois caminhos.
 */
export const ROTULO_COLUNA: Record<string, string> = {
  id: "ID", titulo: "Oportunidade", empresa: "Empresa", produto: "Produto", familia: "Família",
  valor: "Valor", mrr: "MRR", ganho_at: "Ganho em", status: "Status", emitida_em: "Emitida em",
  metodo: "Método", paid_at: "Pago em", servicos_ativos: "Serviços ativos", etapa: "Etapa",
  previsao_fechamento: "Previsão", origem: "Origem da linha", negocio_id: "Negócio (ID)", empresa_id: "Empresa (ID)",
};
