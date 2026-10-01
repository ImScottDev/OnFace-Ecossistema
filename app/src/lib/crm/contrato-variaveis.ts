/**
 * Catálogo único das variáveis de contrato.
 *
 * Existiam duas listas: as ~35 chaves que `contrato-template.ts` resolve de
 * verdade e as 8 fictícias do preview em Ajustes → Contratos. Quem escrevia
 * um template via `{{empresa_endereco}}` sair cru na pré-visualização e
 * concluía que a variável não existia — ela existe, o preview é que não a
 * conhecia. Aqui é a única lista; preview, painel de ajuda e render real
 * leem deste arquivo.
 *
 * Sem dependência de banco: a UI (client component) importa este módulo.
 */

export interface VariavelContrato {
  chave: string;
  rotulo: string;
  /** Valor fictício usado só na pré-visualização de Ajustes → Contratos. */
  exemplo: string;
  grupo: "Contratante" | "Signatário" | "Itens e valores" | "Prazos e datas" | "Jurídico e política";
}

export const VARIAVEIS_CONTRATO: VariavelContrato[] = [
  // Contratante
  { chave: "empresa_razao_social", rotulo: "Razão social", exemplo: "Empresa Exemplo Comércio e Serviços LTDA", grupo: "Contratante" },
  { chave: "empresa_nome", rotulo: "Nome no contrato (razão social, ou o nome cadastrado)", exemplo: "Empresa Exemplo Comércio e Serviços LTDA", grupo: "Contratante" },
  { chave: "empresa_nome_fantasia", rotulo: "Nome fantasia", exemplo: "Empresa Exemplo", grupo: "Contratante" },
  { chave: "empresa_cnpj", rotulo: "CNPJ", exemplo: "12.345.678/0001-90", grupo: "Contratante" },
  { chave: "empresa_endereco", rotulo: "Endereço completo", exemplo: "Rua das Palmeiras, 120, sala 3, Centro, Campinas - SP, CEP 13015-200", grupo: "Contratante" },
  { chave: "empresa_logradouro", rotulo: "Rua", exemplo: "Rua das Palmeiras", grupo: "Contratante" },
  { chave: "empresa_numero", rotulo: "Número", exemplo: "120", grupo: "Contratante" },
  { chave: "empresa_complemento", rotulo: "Complemento", exemplo: "sala 3", grupo: "Contratante" },
  { chave: "empresa_bairro", rotulo: "Bairro", exemplo: "Centro", grupo: "Contratante" },
  { chave: "empresa_cidade", rotulo: "Cidade", exemplo: "Campinas", grupo: "Contratante" },
  { chave: "empresa_estado", rotulo: "Estado / UF", exemplo: "SP", grupo: "Contratante" },
  { chave: "empresa_cep", rotulo: "CEP", exemplo: "13015-200", grupo: "Contratante" },
  { chave: "cidade_uf", rotulo: "Cidade e UF", exemplo: "Campinas - SP", grupo: "Contratante" },
  { chave: "callface_razao_social", rotulo: "Razão social da Callface", exemplo: "CALLFACE SOFTWARE E SERVIÇOS LTDA.", grupo: "Contratante" },
  { chave: "callface_cnpj", rotulo: "CNPJ da Callface", exemplo: "39.764.520/0001-06", grupo: "Contratante" },
  { chave: "callface_endereco", rotulo: "Endereço da Callface", exemplo: "Avenida Pierre Simon de Laplace nº 740, sala 4, Bairro Techno Park, Campinas – SP, CEP: 13.069-320", grupo: "Contratante" },

  // Signatário
  { chave: "pessoa_nome", rotulo: "Nome do signatário", exemplo: "Fulano da Silva", grupo: "Signatário" },
  { chave: "pessoa_email", rotulo: "E-mail do signatário", exemplo: "fulano@empresaexemplo.com.br", grupo: "Signatário" },
  { chave: "pessoa_cargo", rotulo: "Cargo do signatário", exemplo: "Diretor Comercial", grupo: "Signatário" },
  { chave: "pessoa_cpf", rotulo: "CPF do signatário", exemplo: "123.456.789-00", grupo: "Signatário" },
  { chave: "signatarios", rotulo: "Lista de signatários", exemplo: "Fulano da Silva <fulano@empresaexemplo.com.br>", grupo: "Signatário" },
  { chave: "callface_representante_nome", rotulo: "Representante da Callface", exemplo: "não informado", grupo: "Signatário" },
  { chave: "callface_representante_cargo", rotulo: "Cargo do representante da Callface", exemplo: "não informado", grupo: "Signatário" },
  { chave: "callface_representante_cpf", rotulo: "CPF do representante da Callface", exemplo: "não informado", grupo: "Signatário" },
  { chave: "testemunha_1_nome", rotulo: "Testemunha 1 — nome", exemplo: "não aplicável quando não houver testemunha", grupo: "Signatário" },
  { chave: "testemunha_1_cpf", rotulo: "Testemunha 1 — CPF", exemplo: "não informado", grupo: "Signatário" },
  { chave: "testemunha_2_nome", rotulo: "Testemunha 2 — nome", exemplo: "não aplicável quando não houver testemunha", grupo: "Signatário" },
  { chave: "testemunha_2_cpf", rotulo: "Testemunha 2 — CPF", exemplo: "não informado", grupo: "Signatário" },

  // Itens e valores
  { chave: "itens_descricao", rotulo: "Itens em uma linha", exemplo: "Callface AI - Plano Business (recorrente), Setup de implantação (setup)", grupo: "Itens e valores" },
  { chave: "itens_recorrentes", rotulo: "Itens recorrentes e avulsos (texto)", exemplo: "Callface AI - Plano Business | Licença mensal | Qtd. 10 | R$ 179,90 | R$ 1.799,00", grupo: "Itens e valores" },
  { chave: "itens_recorrentes_html", rotulo: "Itens recorrentes e avulsos (linhas de tabela)", exemplo: "<tr><td>Callface AI - Plano Business</td><td>Licença mensal</td><td>10</td><td>R$ 179,90</td><td>R$ 1.799,00</td></tr>", grupo: "Itens e valores" },
  { chave: "itens_setup", rotulo: "Itens de setup (texto)", exemplo: "Setup de implantação | Configuração inicial | Qtd. 1 | R$ 2.500,00 | R$ 2.500,00", grupo: "Itens e valores" },
  { chave: "itens_setup_html", rotulo: "Itens de setup (linhas de tabela)", exemplo: "<tr><td>Setup de implantação</td><td>Configuração inicial</td><td>1</td><td>R$ 2.500,00</td><td>R$ 2.500,00</td></tr>", grupo: "Itens e valores" },
  { chave: "valor_total", rotulo: "Valor total", exemplo: "R$ 4.299,00", grupo: "Itens e valores" },
  { chave: "mrr_total", rotulo: "Total mensal recorrente", exemplo: "R$ 1.799,00", grupo: "Itens e valores" },
  { chave: "setup_total", rotulo: "Total de setup", exemplo: "R$ 2.500,00", grupo: "Itens e valores" },
  { chave: "condicoes_pagamento", rotulo: "Condições de pagamento", exemplo: "Boleto mensal, vencimento todo dia 10", grupo: "Itens e valores" },

  // Prazos e datas
  { chave: "prazo_meses", rotulo: "Prazo em meses (número)", exemplo: "12", grupo: "Prazos e datas" },
  { chave: "prazo_descricao", rotulo: "Prazo por extenso", exemplo: "12 meses", grupo: "Prazos e datas" },
  { chave: "data_inicio_vigencia", rotulo: "Início da vigência", exemplo: "2026-10-01", grupo: "Prazos e datas" },
  { chave: "data_inicio_cobranca", rotulo: "Início da cobrança", exemplo: "2026-10-01", grupo: "Prazos e datas" },
  { chave: "dia_vencimento", rotulo: "Dia de vencimento", exemplo: "10", grupo: "Prazos e datas" },
  { chave: "data_assinatura_extenso", rotulo: "Data da assinatura", exemplo: "data registrada pela plataforma de assinatura", grupo: "Prazos e datas" },
  { chave: "data_emissao", rotulo: "Data de emissão do contrato", exemplo: "2026-10-01", grupo: "Prazos e datas" },
  { chave: "contrato_numero", rotulo: "Número do contrato", exemplo: "P-007-v1", grupo: "Prazos e datas" },
  { chave: "proposta_numero", rotulo: "Número da proposta de origem", exemplo: "P-007-v1", grupo: "Prazos e datas" },
  { chave: "contrato_base_numero", rotulo: "Número do contrato aditado ou renovado", exemplo: "P-003-v2", grupo: "Prazos e datas" },

  // Jurídico e política — valores ainda não configuráveis no CRM
  { chave: "limite_armazenamento_gravacoes", rotulo: "Limite de armazenamento de gravações", exemplo: "conforme o plano contratado", grupo: "Jurídico e política" },
  { chave: "sla_critico_resposta", rotulo: "SLA crítico — resposta", exemplo: "conforme política de suporte vigente", grupo: "Jurídico e política" },
  { chave: "sla_critico_cobertura", rotulo: "SLA crítico — cobertura", exemplo: "conforme política de suporte vigente", grupo: "Jurídico e política" },
  { chave: "sla_alto_resposta", rotulo: "SLA alto — resposta", exemplo: "conforme política de suporte vigente", grupo: "Jurídico e política" },
  { chave: "sla_alto_cobertura", rotulo: "SLA alto — cobertura", exemplo: "conforme política de suporte vigente", grupo: "Jurídico e política" },
  { chave: "sla_medio_resposta", rotulo: "SLA médio — resposta", exemplo: "conforme política de suporte vigente", grupo: "Jurídico e política" },
  { chave: "sla_medio_cobertura", rotulo: "SLA médio — cobertura", exemplo: "conforme política de suporte vigente", grupo: "Jurídico e política" },
  { chave: "sla_baixo_resposta", rotulo: "SLA baixo — resposta", exemplo: "conforme política de suporte vigente", grupo: "Jurídico e política" },
  { chave: "sla_baixo_cobertura", rotulo: "SLA baixo — cobertura", exemplo: "conforme política de suporte vigente", grupo: "Jurídico e política" },
  { chave: "percentual_multa", rotulo: "Percentual de multa", exemplo: "conforme condição comercial e legislação aplicável", grupo: "Jurídico e política" },
  { chave: "juros_mora", rotulo: "Juros de mora", exemplo: "conforme condição comercial e legislação aplicável", grupo: "Jurídico e política" },
  { chave: "indice_reajuste", rotulo: "Índice de reajuste", exemplo: "conforme política comercial vigente", grupo: "Jurídico e política" },
  { chave: "prazo_devolucao_equipamentos", rotulo: "Prazo de devolução de equipamentos", exemplo: "conforme condição comercial do equipamento", grupo: "Jurídico e política" },
  { chave: "limite_responsabilidade_meses", rotulo: "Limite de responsabilidade (meses)", exemplo: "conforme versão jurídica final", grupo: "Jurídico e política" },
  { chave: "prazo_confidencialidade_anos", rotulo: "Prazo de confidencialidade (anos)", exemplo: "conforme versão jurídica final", grupo: "Jurídico e política" },
  { chave: "prazo_cura_inadimplemento", rotulo: "Prazo de cura do inadimplemento", exemplo: "conforme versão jurídica final", grupo: "Jurídico e política" },
  { chave: "regra_multa_rescisoria", rotulo: "Regra da multa rescisória", exemplo: "conforme condição comercial e versão jurídica final", grupo: "Jurídico e política" },
];

/** Valores fictícios da pré-visualização, derivados do mesmo catálogo. */
export const VARIAVEIS_EXEMPLO: Record<string, string> = Object.fromEntries(
  VARIAVEIS_CONTRATO.map((v) => [v.chave, v.exemplo]),
);

/**
 * O corpo pode ser texto puro (templates antigos, colados de .docx) ou HTML
 * (o que vem do Zoho, com quadro das partes e tabela de itens). Marcação de
 * bloco é o que distingue: um `<b>` solto no meio de um texto corrido não
 * transforma o documento em HTML.
 */
export function corpoEhHtml(corpo: string): boolean {
  return /<(p|div|table|tr|td|section|h[1-6]|ul|ol|br)\b[^>]*>/i.test(corpo);
}

export function escaparHtml(valor: string): string {
  return valor.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Substitui `{{variavel}}` pelo valor resolvido.
 *
 * Em corpo HTML os valores são escapados — razão social com `&` ou `<` não
 * pode quebrar a marcação do contrato —, exceto as chaves `*_html`, que
 * existem justamente para injetar linhas de tabela já montadas.
 */
export function renderizarCorpo(corpo: string, variaveis: Record<string, string>): string {
  const html = corpoEhHtml(corpo);
  return corpo.replace(/\{\{(\w+)\}\}/g, (original, chave: string) => {
    const valor = variaveis[chave];
    if (valor === undefined) return original;
    return html && !chave.endsWith("_html") ? escaparHtml(valor) : valor;
  });
}

/**
 * De-para das variáveis do Zoho para as do CRM.
 *
 * Os contratos vieram prontos de lá, escritos com `${Empresas.Razão Social}`.
 * Sem esta tradução o operador cola o HTML, salva, e o documento sai com o
 * marcador literal do Zoho no meio da cláusula — o template parece correto na
 * tela e só se descobre o erro no PDF que já foi para assinatura.
 *
 * O que não tem equivalente fica como está, visível no corpo, para o operador
 * trocar à mão: inventar uma chave aproximada erraria em silêncio.
 */
const DE_PARA_ZOHO: Record<string, string> = {
  "Empresas.Razão Social": "empresa_razao_social",
  "Empresas.Nome da Empresa": "empresa_nome_fantasia",
  "Empresas.CNPJ": "empresa_cnpj",
  "Empresas.Rua de cobrança": "empresa_logradouro",
  "Empresas.Bairro de cobrança": "empresa_bairro",
  "Empresas.Cidade de cobrança": "empresa_cidade",
  "Empresas.Estado / UF de Cobrança": "empresa_estado",
  "Empresas.CEP de cobrança": "empresa_cep",
  "Contatos.Nome Completo": "pessoa_nome",
  "Contatos.E-mail": "pessoa_email",
  "Contatos.Cargo": "pessoa_cargo",
  "Contatos.CPF": "pessoa_cpf",
  "Contratos.Código do Contrato": "contrato_numero",
  "Contratos.Total Geral": "valor_total",
  "Contratos.Total Setup": "setup_total",
  "Contratos.Total Recorrente": "mrr_total",
  "Contratos.Sub-total": "mrr_total",
  "Contratos.Percentual Multa": "percentual_multa",
  "Contratos.Empresa Nome": "empresa_razao_social",
  "Propostas.Assunto": "proposta_numero",
  "Propostas.Número do Proposta": "proposta_numero",
  "Propostas.Numero do Proposta": "proposta_numero",
  "Organização.Nome da organização": "callface_razao_social",
  "Organizacao.Nome da organizacao": "callface_razao_social",
  "Contratos.Vencimento": "dia_vencimento",
  "Contratos.Prazo Contrato (em meses)": "prazo_meses",
  "Contratos.Percentual de Multa": "percentual_multa",
  "Contratos.Data de Envio do Contrato": "data_emissao",
  "Contratos.Data de Início": "data_inicio_vigencia",
  "Setup..Forma de pagamento": "condicoes_pagamento",
  "Setup.Forma de pagamento": "condicoes_pagamento",
};

export function converterVariaveisZoho(corpo: string): { corpo: string; convertidas: string[]; desconhecidas: string[] } {
  const convertidas: string[] = [];
  const desconhecidas: string[] = [];
  const convertido = corpo.replace(/\$\{([^}]+)\}/g, (original, campo: string) => {
    const chave = DE_PARA_ZOHO[campo.trim()];
    if (!chave) {
      if (!desconhecidas.includes(campo.trim())) desconhecidas.push(campo.trim());
      return original;
    }
    if (!convertidas.includes(campo.trim())) convertidas.push(campo.trim());
    return `{{${chave}}}`;
  });
  return { corpo: convertido, convertidas, desconhecidas };
}
