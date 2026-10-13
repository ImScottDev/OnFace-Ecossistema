/**
 * Auditoria estruturada das alterações comerciais da proposta (parte PURA).
 *
 * Decisão do Scott (13/10/2026): não há permissão nem limite de desconto, mas
 * TUDO fica registrado, de forma visível: quem fez, o que mudou (de → para),
 * quando e em qual proposta. Este módulo só compara e descreve; não conhece o
 * banco, para poder ser testado e importado por Client Component. A gravação
 * (pela porta de eventos `registrarEvento`) e a leitura moram em
 * `auditoria-comercial-registro.ts`.
 */

export type FormatoDoValor = "moeda" | "numero" | "inteiro" | "texto" | "data";

export type CampoAuditado =
  | "item_adicionado" | "item_removido"
  | "quantidade" | "preco_negociado" | "desconto"
  | "validade_dias" | "data_validade" | "modo_fechamento"
  | "observacoes" | "prazo_contrato" | "parcelas"
  | "contato";

export interface AlteracaoComercial {
  campo: CampoAuditado;
  /** Nome do campo em português, pronto para a tela. */
  rotulo: string;
  /** Nome do item, quando a alteração é de uma linha. */
  item: string | null;
  formato: FormatoDoValor;
  de: string | number | null;
  para: string | number | null;
  /** Complemento legível (ex.: "2 × R$ 100,00 · desconto R$ 20,00" num item adicionado). */
  detalhe?: string | null;
}

/** Uma linha da proposta como ela estava num instante. */
export interface FotoDoItem {
  /** Identidade estável entre duas fotos: ver `chavesDosItens`. */
  chave: string;
  nome: string;
  quantidade: number;
  /** Preço NEGOCIADO unitário. */
  valorUnitario: number;
  /** Desconto da linha, em reais. */
  desconto: number;
  subtotal: number;
}

/** O retrato comercial da proposta num instante: o que a auditoria compara. */
export interface FotoComercial {
  itens: FotoDoItem[];
  observacoes: string | null;
  prazoContratoMeses: number | null;
  parcelas: number | null;
  validadeDias: number | null;
  dataValidade: string | null;
  modoFechamento: string | null;
  contato: string | null;
}

/** Um registro de auditoria como a tela o lê. */
export interface RegistroDeAlteracao {
  id: string;
  /** Nome de quem fez; null quando foi o sistema. */
  quem: string | null;
  atorTipo: string;
  em: string;
  motivo: string | null;
  totalAntes: number | null;
  totalDepois: number | null;
  alteracoes: AlteracaoComercial[];
}

export const FOTO_VAZIA: FotoComercial = {
  itens: [], observacoes: null, prazoContratoMeses: null, parcelas: null,
  validadeDias: null, dataValidade: null, modoFechamento: null, contato: null,
};

const centavos = (n: number) => Math.round((Number(n) || 0) * 100);
const txt = (s: string | null | undefined) => (s ?? "").trim();

/**
 * Chave de cada linha, independente do id.
 *
 * Salvar um rascunho apaga e regrava as linhas do catálogo (o id muda a cada
 * salvamento), então o id não serve para casar "antes" com "depois". A linha
 * do catálogo é identificada pelo Price e pela ordem em que ele aparece
 * (Ramal, Ramal → `preco#0`, `preco#1`); a linha legada, sem Price, pelo id.
 */
export function chavesDosItens(linhas: Array<{ id: string; catalogoPrecoId: string | null }>): string[] {
  const vistas = new Map<string, number>();
  return linhas.map((l) => {
    if (!l.catalogoPrecoId) return `item:${l.id}`;
    const n = vistas.get(l.catalogoPrecoId) ?? 0;
    vistas.set(l.catalogoPrecoId, n + 1);
    return `${l.catalogoPrecoId}#${n}`;
  });
}

export function totalDaFoto(f: FotoComercial): number {
  return f.itens.reduce((s, i) => s + centavos(i.subtotal), 0) / 100;
}

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function detalheDoItem(i: FotoDoItem): string {
  const partes = [`${i.quantidade.toLocaleString("pt-BR")} × ${brl(i.valorUnitario)}`];
  if (centavos(i.desconto) > 0) partes.push(`desconto ${brl(i.desconto)}`);
  return partes.join(" · ");
}

/** Compara dois retratos e devolve o que mudou, na ordem em que a tela deve mostrar. */
export function compararFotos(antes: FotoComercial, depois: FotoComercial): AlteracaoComercial[] {
  const saida: AlteracaoComercial[] = [];
  const porChaveAntes = new Map(antes.itens.map((i) => [i.chave, i]));
  const porChaveDepois = new Map(depois.itens.map((i) => [i.chave, i]));

  for (const i of antes.itens) {
    if (!porChaveDepois.has(i.chave)) {
      saida.push({ campo: "item_removido", rotulo: "Item removido", item: i.nome, formato: "moeda", de: i.subtotal, para: null, detalhe: detalheDoItem(i) });
    }
  }
  for (const i of depois.itens) {
    const a = porChaveAntes.get(i.chave);
    if (!a) {
      saida.push({ campo: "item_adicionado", rotulo: "Item adicionado", item: i.nome, formato: "moeda", de: null, para: i.subtotal, detalhe: detalheDoItem(i) });
      continue;
    }
    if (a.quantidade !== i.quantidade) {
      saida.push({ campo: "quantidade", rotulo: "Quantidade", item: i.nome, formato: "numero", de: a.quantidade, para: i.quantidade });
    }
    if (centavos(a.valorUnitario) !== centavos(i.valorUnitario)) {
      saida.push({ campo: "preco_negociado", rotulo: "Preço negociado", item: i.nome, formato: "moeda", de: a.valorUnitario, para: i.valorUnitario });
    }
    if (centavos(a.desconto) !== centavos(i.desconto)) {
      saida.push({ campo: "desconto", rotulo: "Desconto", item: i.nome, formato: "moeda", de: a.desconto, para: i.desconto });
    }
  }

  const escalar = (campo: CampoAuditado, rotulo: string, formato: FormatoDoValor, de: string | number | null, para: string | number | null) => {
    const igual = formato === "texto" || formato === "data"
      ? txt(de as string | null) === txt(para as string | null)
      : (de ?? null) === (para ?? null);
    if (!igual) saida.push({ campo, rotulo, item: null, formato, de: de === "" ? null : de, para: para === "" ? null : para });
  };
  escalar("validade_dias", "Validade (dias)", "inteiro", antes.validadeDias, depois.validadeDias);
  escalar("data_validade", "Válida até", "data", antes.dataValidade, depois.dataValidade);
  escalar("modo_fechamento", "Modo de fechamento", "texto", antes.modoFechamento, depois.modoFechamento);
  escalar("prazo_contrato", "Prazo do contrato (meses)", "inteiro", antes.prazoContratoMeses, depois.prazoContratoMeses);
  escalar("parcelas", "Parcelas do setup", "inteiro", antes.parcelas, depois.parcelas);
  escalar("observacoes", "Condições e observações", "texto", txt(antes.observacoes) || null, txt(depois.observacoes) || null);
  escalar("contato", "Contato que recebe", "texto", antes.contato, depois.contato);
  return saida;
}

function formatar(v: string | number | null, formato: FormatoDoValor): string {
  if (v === null || v === undefined || v === "") return "—";
  switch (formato) {
    case "moeda": return brl(Number(v));
    case "numero": return Number(v).toLocaleString("pt-BR");
    case "inteiro": return String(v);
    case "data": {
      const s = String(v);
      return /^\d{4}-\d{2}-\d{2}/.test(s) ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : s;
    }
    default: {
      const s = String(v).replace(/\s+/g, " ").trim();
      return s.length > 90 ? `${s.slice(0, 87)}…` : s;
    }
  }
}

/** A alteração em uma linha: "Desconto · Ramal: R$ 0,00 → R$ 50,00". */
export function descreverAlteracao(a: AlteracaoComercial): string {
  const onde = a.item ? ` · ${a.item}` : "";
  if (a.campo === "item_adicionado") return `${a.rotulo}${onde}: ${a.detalhe ?? formatar(a.para, a.formato)}`;
  if (a.campo === "item_removido") return `${a.rotulo}${onde}${a.detalhe ? ` (${a.detalhe})` : ""}`;
  return `${a.rotulo}${onde}: ${formatar(a.de, a.formato)} → ${formatar(a.para, a.formato)}`;
}

/** Resumo curto para título de timeline: "3 alterações: desconto, quantidade e item adicionado". */
export function resumoDasAlteracoes(alteracoes: AlteracaoComercial[]): string {
  const n = alteracoes.length;
  if (n === 0) return "Sem alterações";
  const nomes: string[] = [];
  for (const a of alteracoes) {
    const r = a.rotulo.toLowerCase();
    if (!nomes.includes(r)) nomes.push(r);
  }
  const lista = nomes.length <= 1 ? nomes[0] : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
  return `${n} ${n === 1 ? "alteração" : "alterações"}: ${lista}`;
}

/** O texto longo que vai para a descrição da atividade na timeline (até 6 linhas). */
export function descricaoDaTimeline(alteracoes: AlteracaoComercial[], motivo?: string | null): string {
  const linhas = alteracoes.slice(0, 6).map(descreverAlteracao);
  if (alteracoes.length > 6) linhas.push(`e mais ${alteracoes.length - 6}`);
  if (txt(motivo)) linhas.push(`Motivo: ${txt(motivo)}`);
  return linhas.join("\n");
}
