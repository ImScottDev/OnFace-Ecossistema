/**
 * Ações que a superfície ONFACE pode oferecer sem criar um segundo motor.
 * Cada item abaixo já tem comando/endpoint no CRM; a tela apenas os expõe.
 *
 * O contrato é a `chave`, nunca o `rotulo`. Enquanto a tela decidia a operação
 * casando o texto do botão, trocar uma palavra do rótulo silenciosamente
 * mandava a ação para o caminho errado.
 */
export type OperacaoMassa = "responsavel" | "lista" | "cadencia" | "tag" | "enriquecer" | "pausar" | "discador";

/** Mantém os filtros na URL para que a próxima renderização consulte o servidor. */
export function montarUrlProspeccao(href: string, mudancas: Record<string, string | null>): string {
  const url = new URL(href);
  for (const [chave, valor] of Object.entries(mudancas)) {
    if (valor === null || valor === "") url.searchParams.delete(chave);
    else url.searchParams.set(chave, valor);
  }
  return `${url.pathname}${url.search}`;
}

export function acoesEmMassaDisponiveis(): Array<{ chave: OperacaoMassa; rotulo: string }> {
  return [
    { chave: "responsavel", rotulo: "Atribuir responsável" },
    { chave: "lista", rotulo: "Adicionar à lista" },
    { chave: "cadencia", rotulo: "Adicionar à cadência" },
    { chave: "tag", rotulo: "Adicionar tag" },
    { chave: "enriquecer", rotulo: "Enriquecer" },
    { chave: "pausar", rotulo: "Pausar cadência" },
    /* O comando existe no servidor desde sempre (`enviar_para_discador` em
       lib/vendas/acoes-em-massa.ts) e nunca apareceu aqui: porta fechada por
       fora, zero usos. Enviar o contato cria a ligação de verdade — o agente de
       prospecção da Callface disca assim que o contato entra na campanha funil
       da organização. Por isso o rótulo fala em LIGAR, não em "enviar": quem
       clica precisa saber que o telefone de alguém vai tocar. */
    { chave: "discador", rotulo: "Ligar com agente de voz" },
  ];
}

/**
 * O que o diálogo em massa confirmou, já no formato que cada comando espera.
 *
 * O `tipo` nomeia o destino do valor: uma cadência vira `cadenceDefinitionId`,
 * uma lista ou tag vira nome de etiqueta, um responsável vira `responsavelId`.
 * Antes tudo desembocava no mesmo campo e um id de usuário chegava a ser
 * gravado como id de cadência.
 */
export type PayloadMassa =
  | { tipo: "responsavel"; responsavelId: string | null }
  | { tipo: "cadencia"; cadenceDefinitionId: string }
  | { tipo: "lista"; nome: string }
  | { tipo: "tag"; nome: string }
  | { tipo: "enriquecer" }
  | { tipo: "pausar" }
  | { tipo: "discador" }
  | { tipo: "invalido"; erro: string };

export function montarPayloadMassa(operacao: OperacaoMassa, valor: string | null): PayloadMassa {
  const limpo = valor?.trim() ?? "";
  switch (operacao) {
    case "responsavel":
      // Sem responsável é escolha válida: significa desatribuir.
      return { tipo: "responsavel", responsavelId: limpo || null };
    case "cadencia":
      return limpo ? { tipo: "cadencia", cadenceDefinitionId: limpo } : { tipo: "invalido", erro: "Escolha a cadência." };
    case "lista":
      return limpo ? { tipo: "lista", nome: limpo } : { tipo: "invalido", erro: "Informe a lista." };
    case "tag":
      return limpo ? { tipo: "tag", nome: limpo } : { tipo: "invalido", erro: "Informe a tag." };
    case "enriquecer":
      return { tipo: "enriquecer" };
    case "pausar":
      return { tipo: "pausar" };
    case "discador":
      return { tipo: "discador" };
  }
}

/** Resultado de uma ação aplicada item a item, somado com honestidade.
 *
 * Ação em massa é N chamadas independentes: parte pode gravar e parte pode
 * falhar. Reportar só a PRIMEIRA falha — que é o que a tela fazia — esconde o
 * tamanho do estrago; reportar "pronto" porque alguma deu certo é pior ainda.
 * A pessoa precisa saber em quantos de quantos a coisa não pegou, para decidir
 * se refaz tudo ou só o que ficou para trás.
 *
 * `parcial` existe porque é o caso mais perigoso: alguns gravaram. Repetir a
 * ação inteira nesse estado pode duplicar efeito no que já deu certo, então a
 * mensagem precisa dizer que o resultado está pela metade em vez de sugerir
 * um "tente de novo" cego.
 */
export function resumirExecucaoEmMassa(
  resultados: Array<{ ok: boolean; erro?: string }>,
): { ok: boolean; total: number; falhas: number; parcial: boolean; mensagem: string } {
  const total = resultados.length;
  const comFalha = resultados.filter((r) => !r.ok);
  const falhas = comFalha.length;

  if (falhas === 0) return { ok: true, total, falhas: 0, parcial: false, mensagem: "" };

  // O motivo vem da primeira falha porque, quando o erro é o mesmo para todas
  // (API fora, sessão expirada), repetir N vezes a mesma frase não informa —
  // o que informa é o CONTADOR ao lado dela.
  const motivo = comFalha.find((r) => r.erro)?.erro ?? "A operação não pôde ser concluída.";
  const parcial = falhas < total;
  const escopo = parcial
    ? `Falhou em ${falhas} de ${total}; as outras ${total - falhas} foram aplicadas.`
    : total === 1
      ? "A ação não foi aplicada."
      : `Nenhuma das ${total} foi aplicada.`;

  return { ok: false, total, falhas, parcial, mensagem: `${motivo} ${escopo}` };
}

/** Linha de CSV já no formato do comando `adicionarProspect`. */
export interface LinhaCsvProspect {
  empresa: string;
  cnpj: string | null;
  website: string | null;
  pessoaNome: string | null;
  cargo: string | null;
  email: string | null;
  telefone: string | null;
}

/* Cabeçalhos aceitos por campo. Planilha de Apollo, LinkedIn Sales Nav e a
 * feita à mão chamam a mesma coluna de jeitos diferentes; casar por apelido
 * evita obrigar a pessoa a renomear coluna antes de importar. */
const APELIDOS_CSV: Record<keyof LinhaCsvProspect, string[]> = {
  empresa: ["empresa", "company", "company name", "organizacao", "organization", "razao social", "nome fantasia"],
  cnpj: ["cnpj"],
  website: ["site", "website", "url", "dominio", "domain"],
  pessoaNome: ["contato", "nome", "name", "pessoa", "full name", "nome completo"],
  cargo: ["cargo", "title", "job title", "funcao"],
  email: ["email", "e-mail", "e mail"],
  telefone: ["telefone", "phone", "celular", "whatsapp", "fone"],
};

function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

/** Quebra uma linha de CSV respeitando aspas ("a;b" é um campo só). */
function campos(linha: string, sep: string): string[] {
  const out: string[] = [];
  let atual = "";
  let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (aspas && linha[i + 1] === '"') { atual += '"'; i++; } else aspas = !aspas;
    } else if (c === sep && !aspas) { out.push(atual); atual = ""; }
    else atual += c;
  }
  out.push(atual);
  return out.map((x) => x.trim());
}

/**
 * Lê o CSV de prospects. Separador `;` ou `,` (Excel em pt-BR exporta `;`).
 * Linha sem empresa é recusada com o número dela: o comando exige empresa, e
 * "3 linhas ignoradas" sem dizer quais obriga a pessoa a caçar no arquivo.
 * ponytail: não trata quebra de linha DENTRO de campo com aspas; planilha de
 * prospect não costuma ter, trocar por papaparse se aparecer.
 */
export function lerCsvProspects(texto: string): { linhas: LinhaCsvProspect[]; recusadas: number[]; erro: string | null } {
  // Sem filter: o número de linha mostrado na prévia tem de ser o do arquivo,
  // então as linhas em branco são puladas guardando o índice original.
  const brutas = texto.replace(/^\uFEFF/, "").split(/\r?\n/);
  const iCab = brutas.findIndex((l) => l.trim());
  if (iCab < 0 || !brutas.slice(iCab + 1).some((l) => l.trim())) return { linhas: [], recusadas: [], erro: "O arquivo precisa de um cabeçalho e ao menos uma linha." };
  const sep = (brutas[iCab].match(/;/g)?.length ?? 0) > (brutas[iCab].match(/,/g)?.length ?? 0) ? ";" : ",";
  const cab = campos(brutas[iCab], sep).map(normalizar);
  const indice = Object.fromEntries(
    (Object.keys(APELIDOS_CSV) as Array<keyof LinhaCsvProspect>).map((k) => [k, cab.findIndex((h) => APELIDOS_CSV[k].includes(h))]),
  ) as Record<keyof LinhaCsvProspect, number>;
  if (indice.empresa < 0) return { linhas: [], recusadas: [], erro: "Não encontrei a coluna de empresa (empresa, company ou organização)." };

  const linhas: LinhaCsvProspect[] = [];
  const recusadas: number[] = [];
  brutas.forEach((bruta, i) => {
    if (i <= iCab || !bruta.trim()) return;
    const v = campos(bruta, sep);
    const pegar = (k: keyof LinhaCsvProspect) => (indice[k] >= 0 ? v[indice[k]]?.trim() || null : null);
    const empresa = pegar("empresa");
    if (!empresa) { recusadas.push(i + 1); return; }
    linhas.push({
      empresa, cnpj: pegar("cnpj"), website: pegar("website"), pessoaNome: pegar("pessoaNome"),
      cargo: pegar("cargo"), email: pegar("email"), telefone: pegar("telefone"),
    });
  });
  return { linhas, recusadas, erro: null };
}
