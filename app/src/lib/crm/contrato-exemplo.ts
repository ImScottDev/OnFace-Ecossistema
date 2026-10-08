/**
 * Dados de exemplo para pré-visualizar e gerar o "PDF de teste" de um modelo.
 * Tudo marcado [QA] e fictício: nunca copiar dado real de cliente para cá.
 * Os itens passam pelo mesmo montador de linhas do contrato real.
 */
import { VARIAVEIS_EXEMPLO } from "@/lib/crm/contrato-variaveis";
import { linhasDeItens, moeda, type ItemContrato } from "@/lib/crm/contrato-itens";

const ITENS: Record<string, ItemContrato[]> = {
  WHITE_LABEL: [
    { nome: "Licença White Label Callface", descricao: "Licença reservada para ativação e revenda pela CONTRATANTE a seus Clientes Finais.", tipo: "recorrente", quantidade: 20, valorUnitario: 149.9, subtotal: 2998 },
    { nome: "Setup White Label", descricao: "Implantação, configuração e reserva inicial de licenças para operação White Label.", tipo: "setup", quantidade: 1, valorUnitario: 4000, subtotal: 4000 },
  ],
  PABX: [
    { nome: "PABX Virtual Callface - Plano Pro", descricao: "Ramais, URA, filas e gravação de chamadas", tipo: "recorrente", quantidade: 12, valorUnitario: 89.9, subtotal: 1078.8 },
    { nome: "Número 0800", descricao: "Número de entrada gratuito para o cliente", tipo: "recorrente", quantidade: 1, valorUnitario: 59, subtotal: 59 },
    { nome: "Implantação PABX", descricao: "Provisionamento de ramais e treinamento", tipo: "setup", quantidade: 1, valorUnitario: 1500, subtotal: 1500 },
  ],
  CALLFACE_AI: [
    { nome: "Callface AI - Plano Business", descricao: "Transcrição, scorecards e insights por IA", tipo: "recorrente", quantidade: 10, valorUnitario: 179.9, subtotal: 1799 },
    { nome: "Setup de implantação", descricao: "Configuração inicial e integrações", tipo: "setup", quantidade: 1, valorUnitario: 2500, subtotal: 2500 },
  ],
};

export function variaveisDeExemplo(familia: string | null | undefined, nItens?: number): Record<string, string> {
  const base = ITENS[familia ?? ""] ?? ITENS.PABX;
  const itens = nItens ? Array.from({ length: nItens }, (_, i) => ({ ...base[i % base.length], nome: `${base[i % base.length].nome} ${i + 1}` })) : base;
  const total = (tipos: string[]) => itens.filter((i) => tipos.includes(i.tipo)).reduce((s, i) => s + Number(i.subtotal), 0);
  return {
    ...VARIAVEIS_EXEMPLO,
    itens_recorrentes_html: linhasDeItens(itens, ["recorrente", "avulso"], { comRecorrencia: false, familia }),
    itens_licencas_html: linhasDeItens(itens, ["recorrente", "avulso"], { comRecorrencia: true, familia }),
    itens_setup_html: linhasDeItens(itens, ["setup"], { comRecorrencia: false, familia }),
    mrr_total: moeda(total(["recorrente", "avulso"])),
    setup_total: moeda(total(["setup"])),
    valor_total: moeda(total(["recorrente", "avulso", "setup"])),
    forma_pagamento_setup: "À vista, no cartão de crédito",
    dia_vencimento: "10 dias após a emissão da cobrança",
    percentual_multa: "30%",
    percentual_multa_numero: "30",
    meses_restantes_contrato_base: "8",
    valor_multa_downgrade: moeda(0.3 * total(["recorrente"]) * 8),
    limite_armazenamento_gravacoes: "90 dias",
    prazo_meses: "12",
    contrato_numero: "P-1563-v1",
    proposta_numero: "P-1563-v1",
    contrato_base_numero: "P-1402-v2",
  };
}
