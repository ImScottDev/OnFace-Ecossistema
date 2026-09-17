/**
 * Ações que a superfície ONFACE pode oferecer sem criar um segundo motor.
 * Cada item abaixo já tem comando/endpoint no CRM; a tela apenas os expõe.
 */
export function acoesEmMassaDisponiveis(): string[] {
  return [
    "Atribuir responsável",
    "Adicionar à lista",
    "Adicionar à cadência",
    "Adicionar tag",
    "Enriquecer",
    "Pausar cadência",
  ];
}
