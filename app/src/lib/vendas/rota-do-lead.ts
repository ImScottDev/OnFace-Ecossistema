/**
 * Onde mora a tela do lead de Pré-vendas. Fonte ÚNICA: o drawer ("Abrir lead"),
 * `rotaDoDesenho` e o card "Relações em andamento" das fichas apontam para cá.
 *
 * O destino de um futuro equivalente em Prospecção entra como função irmã
 * (`rotaDoProspect`), sem mudar quem já chama esta.
 */
export const rotaDoLead = (leadId: string) => `/pre-vendas/${encodeURIComponent(leadId)}`;
