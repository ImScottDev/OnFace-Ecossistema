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
  grupo: "Contratante" | "Signatário" | "Itens e valores" | "Prazos e datas" | "Contrato e proposta";
  /** Nome que o time conhece do Zoho (`${Empresas.CNPJ}`): é o que aparece no chip do editor. */
  zoho?: string;
  /** Pode ficar em branco sem travar o envio (ex.: complemento do endereço, testemunhas). */
  opcional?: boolean;
}

export const VARIAVEIS_CONTRATO: VariavelContrato[] = [
  // Contratante
  { chave: "empresa_razao_social", rotulo: "Razão social", exemplo: "[QA] Empresa Exemplo Comércio e Serviços LTDA", grupo: "Contratante", zoho: "Empresas.Razão Social" },
  { chave: "empresa_nome", rotulo: "Nome no contrato (razão social)", exemplo: "[QA] Empresa Exemplo Comércio e Serviços LTDA", grupo: "Contratante" },
  { chave: "empresa_nome_fantasia", rotulo: "Nome fantasia", exemplo: "[QA] Empresa Exemplo", grupo: "Contratante", zoho: "Empresas.Nome da Empresa" },
  { chave: "empresa_cnpj", rotulo: "CNPJ", exemplo: "12.345.678/0001-90", grupo: "Contratante", zoho: "Empresas.CNPJ" },
  { chave: "empresa_endereco", rotulo: "Endereço completo", exemplo: "Rua das Palmeiras, 120, sala 3, Centro, Campinas - SP, CEP 13015-200", grupo: "Contratante" },
  { chave: "empresa_logradouro", rotulo: "Rua", exemplo: "Rua das Palmeiras", grupo: "Contratante", zoho: "Empresas.Rua de cobrança" },
  { chave: "empresa_numero", rotulo: "Número", exemplo: "120", grupo: "Contratante" },
  { chave: "empresa_complemento", rotulo: "Complemento", exemplo: "sala 3", grupo: "Contratante", opcional: true },
  { chave: "empresa_bairro", rotulo: "Bairro", exemplo: "Centro", grupo: "Contratante", zoho: "Empresas.Bairro de cobrança" },
  { chave: "empresa_cidade", rotulo: "Cidade", exemplo: "Campinas", grupo: "Contratante", zoho: "Empresas.Cidade de cobrança" },
  { chave: "empresa_estado", rotulo: "Estado / UF", exemplo: "SP", grupo: "Contratante", zoho: "Empresas.Estado / UF de Cobrança" },
  { chave: "empresa_cep", rotulo: "CEP", exemplo: "13015-200", grupo: "Contratante", zoho: "Empresas.CEP de cobrança" },
  { chave: "cidade_uf", rotulo: "Cidade e UF", exemplo: "Campinas - SP", grupo: "Contratante" },
  { chave: "callface_razao_social", rotulo: "Razão social da Callface", exemplo: "CALLFACE SOFTWARE E SERVIÇOS LTDA.", grupo: "Contratante", zoho: "Organização.Nome da organização" },
  { chave: "callface_cnpj", rotulo: "CNPJ da Callface", exemplo: "39.764.520/0001-06", grupo: "Contratante" },
  { chave: "callface_endereco", rotulo: "Endereço da Callface", exemplo: "Avenida Pierre Simon de Laplace nº 740, sala 4, Bairro Techno Park, Campinas – SP, CEP: 13.069-320", grupo: "Contratante" },

  // Signatário
  { chave: "pessoa_nome", rotulo: "Nome do signatário", exemplo: "[QA] Fulano da Silva", grupo: "Signatário", zoho: "Contatos.Nome Completo" },
  { chave: "pessoa_email", rotulo: "E-mail do signatário", exemplo: "fulano@empresaexemplo.com.br", grupo: "Signatário", zoho: "Contatos.E-mail" },
  { chave: "pessoa_cargo", rotulo: "Cargo do signatário", exemplo: "Diretor Comercial", grupo: "Signatário", zoho: "Contatos.Cargo" },
  { chave: "pessoa_cpf", rotulo: "CPF do signatário", exemplo: "123.456.789-00", grupo: "Signatário", zoho: "Contatos.CPF" },
  { chave: "signatarios", rotulo: "Lista de signatários", exemplo: "Fulano da Silva <fulano@empresaexemplo.com.br>", grupo: "Signatário" },

  // Itens e valores
  { chave: "itens_descricao", rotulo: "Itens em uma linha", exemplo: "Callface AI - Plano Business (recorrente), Setup de implantação (setup)", grupo: "Itens e valores" },
  { chave: "itens_recorrentes", rotulo: "Itens recorrentes e avulsos (texto)", exemplo: "Callface AI - Plano Business | Licença mensal | Qtd. 10 | R$ 179,90 | R$ 1.799,00", grupo: "Itens e valores" },
  { chave: "itens_recorrentes_html", rotulo: "Itens recorrentes: uma linha de tabela por item", exemplo: "<tr><td>Callface AI - Plano Business</td><td>Licença mensal</td><td>10</td><td>R$ 179,90</td><td>R$ 1.799,00</td></tr>", grupo: "Itens e valores", zoho: "Itens Solicitados.Itens" },
  { chave: "itens_licencas_html", rotulo: "Itens com recorrência: uma linha de tabela por item (6 colunas)", exemplo: "<tr><td>Licença White Label Callface</td><td>Licença reservada para ativação e revenda</td><td>Mensal, por licença ativa</td><td>10</td><td>R$ 179,90</td><td>R$ 1.799,00</td></tr>", grupo: "Itens e valores" },
  { chave: "itens_setup", rotulo: "Itens de setup (texto)", exemplo: "Setup de implantação | Configuração inicial | Qtd. 1 | R$ 2.500,00 | R$ 2.500,00", grupo: "Itens e valores" },
  { chave: "itens_setup_html", rotulo: "Itens de setup: uma linha de tabela por item", exemplo: "<tr><td>Setup de implantação</td><td>Configuração inicial</td><td>1</td><td>R$ 2.500,00</td><td>R$ 2.500,00</td></tr>", grupo: "Itens e valores", opcional: true },
  { chave: "linhas_setup_resumo_html", rotulo: "Setup no quadro de valores: linhas de total e forma de pagamento (vazio sem setup)", exemplo: "<tr><td class=\"cf-rotulo\">SETUP</td><td class=\"cf-valor\">R$ 2.500,00</td></tr><tr><td class=\"cf-rotulo\">FORMA DE PAGAMENTO DO SETUP</td><td class=\"cf-valor\">À vista, cartão de crédito</td></tr>", grupo: "Itens e valores", opcional: true },
  { chave: "quadro_setup_html", rotulo: "Quadro de setup completo: itens, total e forma de pagamento (vazio sem setup)", exemplo: "<table class=\"cf-valores\" border=\"1\"><tbody><tr><td>Setup de implantação</td><td>Configuração inicial</td><td>1</td><td>R$ 2.500,00</td><td>R$ 2.500,00</td></tr></tbody></table>", grupo: "Itens e valores", opcional: true },
  { chave: "valor_total", rotulo: "Valor total", exemplo: "R$ 4.299,00", grupo: "Itens e valores", zoho: "Contratos.Total Geral" },
  { chave: "mrr_total", rotulo: "Total mensal recorrente", exemplo: "R$ 1.799,00", grupo: "Itens e valores", zoho: "Contratos.Total Recorrente" },
  { chave: "setup_total", rotulo: "Total de setup", exemplo: "R$ 2.500,00", grupo: "Itens e valores", zoho: "Contratos.Total Setup" },
  { chave: "forma_pagamento_setup", rotulo: "Forma de pagamento do setup", exemplo: "À vista, no cartão de crédito", grupo: "Itens e valores", zoho: "Setup..Forma de pagamento" },
  { chave: "condicoes_pagamento", rotulo: "Condições de pagamento da proposta", exemplo: "Boleto mensal, vencimento todo dia 10", grupo: "Itens e valores" },

  // Prazos e datas
  { chave: "prazo_meses", rotulo: "Prazo em meses (número)", exemplo: "12", grupo: "Prazos e datas", zoho: "Contratos.Prazo Contrato (em meses)" },
  { chave: "prazo_descricao", rotulo: "Prazo por extenso", exemplo: "12 meses", grupo: "Prazos e datas" },
  { chave: "data_inicio_vigencia", rotulo: "Início da vigência", exemplo: "01/10/2026", grupo: "Prazos e datas", zoho: "Contratos.Data de Início" },
  { chave: "data_inicio_cobranca", rotulo: "Início da cobrança", exemplo: "01/10/2026", grupo: "Prazos e datas" },
  { chave: "dia_vencimento", rotulo: "Vencimento da cobrança", exemplo: "todo dia 10", grupo: "Prazos e datas", zoho: "Contratos.Vencimento" },
  { chave: "reajuste_indice", rotulo: "Índice de reajuste", exemplo: "IPCA", grupo: "Prazos e datas", opcional: true },
  { chave: "fidelidade_meses", rotulo: "Fidelidade em meses (separada do prazo)", exemplo: "12", grupo: "Prazos e datas", opcional: true },
  { chave: "desconto_temporario", rotulo: "Desconto com prazo", exemplo: "Desconto sobre a mensalidade válido por 6 meses", grupo: "Itens e valores", opcional: true },
  { chave: "data_emissao", rotulo: "Data do contrato (por extenso)", exemplo: "1 de outubro de 2026", grupo: "Prazos e datas", zoho: "Contratos.Data de Envio do Contrato" },

  // Contrato e proposta
  { chave: "contrato_numero", rotulo: "Número do contrato", exemplo: "P-007-v1", grupo: "Contrato e proposta", zoho: "Contratos.Código do Contrato" },
  { chave: "proposta_numero", rotulo: "Número da proposta de origem", exemplo: "P-007-v1", grupo: "Contrato e proposta", zoho: "Propostas.Assunto" },
  { chave: "contrato_base_numero", rotulo: "Número do contrato aditado ou renovado", exemplo: "P-003-v2", grupo: "Contrato e proposta" },
  { chave: "percentual_multa", rotulo: "Multa rescisória (percentual)", exemplo: "30%", grupo: "Contrato e proposta", zoho: "Contratos.Percentual de Multa" },
  { chave: "percentual_multa_numero", rotulo: "Multa rescisória (só o número, para \"X porcento\")", exemplo: "30", grupo: "Contrato e proposta", zoho: "Contratos.Percentual Multa" },
  { chave: "meses_restantes_contrato_base", rotulo: "Meses restantes do contrato aditado (downgrade)", exemplo: "8", grupo: "Contrato e proposta" },
  { chave: "valor_multa_downgrade", rotulo: "Multa por redução de escopo (downgrade)", exemplo: "R$ 2.400,00", grupo: "Contrato e proposta" },
  { chave: "limite_armazenamento_gravacoes", rotulo: "Limite de armazenamento de gravações", exemplo: "90 dias", grupo: "Contrato e proposta" },
  { chave: "testemunha_1_nome", rotulo: "Testemunha 1: nome", exemplo: "", grupo: "Signatário", opcional: true },
  { chave: "testemunha_1_cpf", rotulo: "Testemunha 1: CPF", exemplo: "", grupo: "Signatário", opcional: true },
  { chave: "testemunha_2_nome", rotulo: "Testemunha 2: nome", exemplo: "", grupo: "Signatário", opcional: true },
  { chave: "testemunha_2_cpf", rotulo: "Testemunha 2: CPF", exemplo: "", grupo: "Signatário", opcional: true },
];

const POR_CHAVE = new Map(VARIAVEIS_CONTRATO.map((v) => [v.chave, v]));

/** Texto do chip no editor: o nome do Zoho quando existe, o rótulo quando não. */
export function textoDoChip(chave: string): string {
  const v = POR_CHAVE.get(chave);
  return `\${${v?.zoho ?? v?.rotulo ?? chave}}`;
}

/**
 * Variáveis do template que não têm valor. É a base do bloqueio de envio:
 * contrato com "não informado" no meio de uma cláusula é pior que contrato que
 * não sai. Opcionais (complemento, testemunhas) ficam em branco sem travar.
 */
export function variaveisFaltando(corpoTemplate: string, valores: Record<string, string>): { chave: string; rotulo: string }[] {
  const vistas = new Set<string>();
  const faltando: { chave: string; rotulo: string }[] = [];
  for (const [, chave] of corpoTemplate.matchAll(/\{\{(\w+)\}\}/g)) {
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    const v = POR_CHAVE.get(chave);
    if (!v) { faltando.push({ chave, rotulo: `variável desconhecida "${chave}"` }); continue; }
    if (v.opcional) continue;
    const valor = (valores[chave] ?? "").trim();
    if (!valor || valor === "—" || valor.toLowerCase() === "não informado") {
      faltando.push({ chave, rotulo: v.rotulo });
    }
  }
  return faltando;
}

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
  "Propostas.Sub-total": "mrr_total",
  "Contratos.Percentual Multa": "percentual_multa_numero",
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
