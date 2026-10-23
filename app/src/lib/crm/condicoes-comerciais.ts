/**
 * Condições comerciais do editor de proposta -> colunas de `propostas`.
 *
 * O editor coleta forma de pagamento, vencimento, teste, reajuste, início de vigência, fidelidade e desconto
 * com prazo; antes só quatro valores chegavam ao banco e o resto ficava no jsonb `propostas.editor`, fora do
 * alcance do contrato e da cobrança. Função PURA (sem banco): o teste roda em node:test.
 *
 * Contrato do retorno: chave AUSENTE = o editor não diz nada sobre isso (mantém o que está gravado);
 * `null` = o editor diz que não há (limpa).
 *
 * Divergência deliberada do pedido original (ver relatório): `vencimento_dias` NÃO recebe o dia do mês.
 * Ele significa "dias após a emissão" (boleto e parcelamento no Stripe leem isso, e a pendência financeira
 * soma esse número à data da assinatura). O dia do mês vai na coluna nova `dia_vencimento_mes`.
 * E `condicao_pagamento_tipo` guarda o MEIO (cartao | boleto | boleto_parcelado | outro), que é o que o
 * contrato e a página pública já leem; "à vista ou parcelado" já está em `parcelas`.
 */

export interface CondicoesGravaveis {
  condicaoPagamentoTipo?: string | null;
  diaVencimentoMes?: number | null;
  condicoesPagamento?: string;
  trialDias?: number | null;
  validadeDias?: number;
  reajusteIndice?: string | null;
  inicioVigenciaTipo?: string | null;
  dataInicioVigencia?: string | null;
  fidelidadeMeses?: number | null;
  descontoTemporarioAlvo?: string | null;
  descontoTemporarioMeses?: number | null;
}

type Editor = Record<string, any>;
const num = (v: unknown): number => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const tem = (ed: Editor, k: string) => Object.prototype.hasOwnProperty.call(ed, k) && ed[k] !== undefined;

export function condicoesDoEditor(editor: unknown, ctx: { temSetup: boolean }): CondicoesGravaveis {
  if (!editor || typeof editor !== "object") return {};
  const ed = editor as Editor;
  const out: CondicoesGravaveis = {};

  const parcelas = num(ed.parcelas);
  const parcelado = ed.setupForma === "parcelado" && parcelas > 1;

  if (tem(ed, "forma")) {
    out.condicaoPagamentoTipo = ed.forma === "cartao" ? "cartao"
      : ed.forma === "boleto" ? (parcelado ? "boleto_parcelado" : "boleto")
      : ed.forma === "pix" ? "outro" : null; // "cliente escolhe" não é uma condição
  }

  if (tem(ed, "dia")) {
    const d = Math.trunc(num(ed.dia));
    out.diaVencimentoMes = d >= 1 && d <= 31 ? d : null;
  }

  if (tem(ed, "teste")) {
    out.trialDias = ed.teste ? Math.max(1, Math.trunc(num(ed.testeDias)) || 7) : null;
  }

  if (num(ed.validade) > 0) out.validadeDias = Math.trunc(num(ed.validade));

  if (tem(ed, "reajuste")) out.reajusteIndice = ["IPCA", "IGP-M", "nenhum"].includes(ed.reajuste) ? ed.reajuste : null;

  if (tem(ed, "inicio")) {
    out.inicioVigenciaTipo = ["assinatura", "implantacao", "data", "teste"].includes(ed.inicio) ? ed.inicio : null;
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(String(ed.dataInicio ?? "")) ? String(ed.dataInicio) : null;
    out.dataInicioVigencia = ed.inicio === "data" ? iso : null;
  }

  if (tem(ed, "fidelidade") && String(ed.fidelidade).trim() !== "") out.fidelidadeMeses = Math.max(0, Math.trunc(num(ed.fidelidade)));

  if (ed.desc && typeof ed.desc === "object") {
    const comDesconto = num(ed.desc.valor) > 0;
    const meses = Math.trunc(num(ed.desc.meses)); // "sempre" -> 0 -> permanente
    const temporario = comDesconto && meses > 0;
    out.descontoTemporarioAlvo = temporario ? (ed.desc.alvo === "setup" ? "setup" : "mrr") : null;
    out.descontoTemporarioMeses = temporario ? meses : null;
  }

  // Texto legível das condições: é o que o contrato e a página pública mostram quando não há tipo estruturado.
  const partes: string[] = [];
  if (ctx.temSetup && tem(ed, "setupForma")) partes.push(parcelado ? `Setup em ${parcelas}x` : "Setup à vista");
  if (out.diaVencimentoMes) partes.push(`Mensalidade com vencimento todo dia ${out.diaVencimentoMes}`);
  if (out.trialDias) partes.push(`${out.trialDias} dias de teste grátis antes da primeira cobrança`);
  if (out.reajusteIndice && out.reajusteIndice !== "nenhum") partes.push(`Reajuste anual pelo ${out.reajusteIndice}`);
  if (partes.length) out.condicoesPagamento = partes.join("; ");

  return out;
}

/** Texto do desconto com prazo, para o contrato. Vazio quando o desconto é permanente. */
export function textoDescontoTemporario(alvo: string | null | undefined, meses: number | null | undefined): string {
  if (!alvo || !meses || meses < 1) return "";
  return `Desconto sobre ${alvo === "setup" ? "o setup" : "a mensalidade"} válido por ${meses} ${meses === 1 ? "mês" : "meses"}`;
}

export function rotuloReajuste(indice: string | null | undefined): string {
  if (!indice) return "";
  return indice === "nenhum" ? "Sem reajuste" : indice;
}

const FORMA_PAGAMENTO: Record<string, string> = {
  cartao: "cartão de crédito", boleto: "boleto bancário", boleto_parcelado: "boleto bancário",
};

export interface CondicoesDaProposta {
  condicaoPagamentoTipo: string | null; parcelas: number | null; condicoesPagamento: string | null;
  diaVencimentoMes: number | null; vencimentoDias: number | null;
  inicioVigenciaTipo: string | null; dataInicioVigencia: string | null; trialDias: number | null;
  reajusteIndice: string | null; fidelidadeMeses: number | null;
  descontoTemporarioAlvo: string | null; descontoTemporarioMeses: number | null;
}

const dataCurta = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

/** "À vista, boleto bancário" / "Em 3x, cartão de crédito". Fonte única de contrato e PDF da proposta. */
export function formaPagamentoSetup(p: Pick<CondicoesDaProposta, "condicaoPagamentoTipo" | "parcelas" | "condicoesPagamento">, setup: number): string {
  if (setup <= 0) return "Sem setup";
  const tipoPag = p.condicaoPagamentoTipo ? FORMA_PAGAMENTO[p.condicaoPagamentoTipo] : undefined;
  const parcelas = p.parcelas && p.parcelas > 1 ? p.parcelas : 1;
  return tipoPag ? (parcelas > 1 ? `Em ${parcelas}x, ${tipoPag}` : `À vista, ${tipoPag}`) : (p.condicoesPagamento || "").trim();
}

/**
 * As variáveis de contrato que vêm das condições negociadas. Pura: o contrato lê as COLUNAS gravadas por
 * `condicoesDoEditor`, e o teste prova o caminho editor -> coluna -> variável sem banco.
 * `inicioVigencia` também alimenta `contratos.inicio` / `vencimento`.
 */
export function variaveisDeCondicoes(p: CondicoesDaProposta, setup: number, hoje: Date): { variaveis: Record<string, string>; inicioVigencia: Date } {
  const escolhido = p.inicioVigenciaTipo === "data" && p.dataInicioVigencia ? new Date(`${p.dataInicioVigencia}T12:00:00Z`) : null;
  const dataEscolhida = escolhido && !isNaN(escolhido.getTime()) ? escolhido : null;
  // Sem data escolhida o início depende de um fato futuro (assinatura, implantação, fim do teste): hoje é a melhor aproximação.
  const inicioVigencia = dataEscolhida ?? hoje;
  const inicioCobranca = dataEscolhida ?? (p.trialDias && p.trialDias > 0 ? new Date(hoje.getTime() + p.trialDias * 864e5) : hoje);

  const formaSetup = formaPagamentoSetup(p, setup);

  return {
    inicioVigencia,
    variaveis: {
      forma_pagamento_setup: formaSetup,
      condicoes_pagamento: (p.condicoesPagamento || "").trim(),
      // O dia do mês do editor ganha; sem ele vale o antigo "N dias após a emissão" (vencimento_dias).
      dia_vencimento: p.diaVencimentoMes ? `todo dia ${p.diaVencimentoMes} de cada mês`
        : p.vencimentoDias ? `${p.vencimentoDias} dias após a emissão da cobrança` : "",
      data_inicio_vigencia: dataCurta(inicioVigencia),
      data_inicio_cobranca: dataCurta(inicioCobranca),
      reajuste_indice: rotuloReajuste(p.reajusteIndice),
      fidelidade_meses: p.fidelidadeMeses != null ? String(p.fidelidadeMeses) : "",
      desconto_temporario: textoDescontoTemporario(p.descontoTemporarioAlvo, p.descontoTemporarioMeses),
    },
  };
}

/**
 * Esta venda é faturada (pós-paga) em vez de cobrada antes?
 *
 * Venda por CONTRATO é pós-paga: o contrato assinado é a evidência de
 * fechamento, o serviço é ativado e a mensalidade é faturada no dia
 * combinado. Pedir pagamento antes contradiz o contrato que o cliente acabou
 * de assinar — e era o que acontecia, porque o único caminho de cobrança era
 * o Checkout Session, que é sempre pré-pago.
 *
 * Pré-pago (`PREPAID`, Callface AI direto pelo site/vendedor) continua indo
 * para o checkout: ali o pagamento É a evidência de fechamento.
 */
export function vendaEhFaturada(p: {
  modoFechamento?: string | null;
  diaVencimentoMes?: number | null;
  temItemRecorrente: boolean;
}): boolean {
  return p.modoFechamento === "CONTRACT" && p.temItemRecorrente;
}

/**
 * Em que dia do mês a mensalidade vence.
 *
 * Sem dia combinado na proposta, cai no dia da ativação — o ciclo passa a
 * virar nesse dia todo mês. Nunca inventa um dia fixo: o cliente que não
 * combinou dia nenhum espera a data em que assinou.
 */
export function diaDoVencimento(diaCombinado: number | null | undefined, ativacao: Date): number {
  const d = Math.trunc(diaCombinado ?? 0);
  if (d >= 1 && d <= 31) return d;
  return ativacao.getDate();
}

/**
 * O logradouro que vai para o Stripe (`address.line1`).
 *
 * `empresas` tem DUAS colunas de rua: `endereco`, que o webhook do Stripe e o
 * portal preenchem, e `logradouro`/`numero`/`bairro`, que vêm do cadastro e da
 * consulta de CNPJ. O código de cobrança lia só `endereco` — e ela está vazia
 * em quase toda a base (8 empresas com `logradouro`, 35 com `endereco`, de
 * 3.198). Resultado: Customer criado no Stripe sem rua nenhuma, e boleto exige
 * endereço completo (LIVA, 23/10/2026: `logradouro` = "Alameda Rio Negro",
 * `numero` = 1030, e o Stripe recebendo vazio).
 *
 * Prefere `endereco` quando preenchido (é o mais recente, veio do próprio
 * Stripe ou do portal) e cai para logradouro + número.
 */
export function logradouroFiscal(e: {
  endereco?: string | null;
  logradouro?: string | null;
  numero?: string | null;
}): string | null {
  const pronto = e.endereco?.trim();
  if (pronto) return pronto;
  const rua = e.logradouro?.trim();
  if (!rua) return null;
  const n = e.numero?.trim().replace(/[^0-9A-Za-z/ -]/g, "").replace(/[-\s]+$/, "");
  return n ? `${rua}, ${n}` : rua;
}
