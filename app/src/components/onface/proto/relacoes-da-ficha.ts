/**
 * Lê os fatos de uma ficha (Pessoa ou Empresa) e monta os vínculos do card
 * "Relações em andamento". Pura. O filtro por alvo, o tipo e o destino são de
 * `lib/vendas/relacoes-do-registro.ts`; aqui só vai o RÓTULO correto.
 *
 * Três coisas que o card misturava e aqui ficam separadas:
 *  - ACESSO ao histórico: a ficha de Cliente 360 existe (`conta.ficha`);
 *  - ESTADO: "Cliente ativo" só com serviço ativo na carteira (`conta.ativo`);
 *  - VENDA: oportunidade ganha é fato de venda, não de carteira.
 * Não decide política de carteira: só rotula o que as consultas já dizem.
 *
 * O vazio ("só existe na base") só vale com todas as fontes da ficha lidas e
 * vazias; antes da hidratação ele nunca é afirmado (ver `corrigirVazio`).
 */

import { ROTULO_FAMILIA, type Familia } from "@/lib/vendas/dominio";
import { relacoesDoRegistro, type RelacaoDoRegistro, type VinculoDoRegistro } from "@/lib/vendas/relacoes-do-registro";

export interface AquisicaoDaFicha { id: string; etapa: string; etapaRotulo: string; titulo: string; sub: string }
export interface OportunidadeDaFicha { id: string; titulo: string; etapa: string; etapaRotulo: string; familia: string | null }
export interface PropostaDaFicha { id: string; numero: number; versao: number; status: string }

export interface FatosDasRelacoes {
  empresaId: string;
  leadId?: string | null;
  /** Aquisições da pessoa (o próprio lead) ou da empresa. */
  aquisicoes: AquisicaoDaFicha[];
  oportunidades: OportunidadeDaFicha[];
  /** null = esta ficha não consulta propostas. */
  propostas: PropostaDaFicha[] | null;
  conta: {
    nome: string; ativo: boolean; jaTeveServico: boolean;
    /** A rota /clientes/<empresaId> abre (existe a linha em `clientes`). */
    ficha: boolean; detalheAtivo?: string;
  };
  /** Prefixo da frase do vazio, com só as fontes que a ficha lê. */
  vazioPrefixo: string;
}

export interface RelacoesDaFicha { itens: RelacaoDoRegistro[]; perdidas: number; vazio: boolean; vazioTxt: string }

/** Aquisição "em andamento". Oportunidade já aparece como opp; desqualificado é história. */
const ETAPAS_ATIVAS = new Set(["novo", "em_contato", "qualificacao", "qualificado", "nutricao"]);
const PROPOSTA_ABERTA: Record<string, string> = {
  rascunho: "Rascunho", enviada: "Enviada", visualizada: "Visualizada", ajuste_solicitado: "Ajuste solicitado",
};

export function montarRelacoes(f: FatosDasRelacoes): RelacoesDaFicha {
  const c = f.conta;
  const base = { empresaId: f.empresaId, pessoaId: null, leadId: null };
  const v: VinculoDoRegistro[] = [];

  /* Sem serviço (ativo ou encerrado) não há linha de Cliente: venda ganha
     sozinha não faz a conta cliente. Sem a ficha 360 não há para onde levar. */
  if ((c.ativo || c.jaTeveServico) && c.ficha) {
    v.push({
      ...base, id: f.empresaId, k: "cliente", titulo: c.nome,
      sub: c.ativo ? (c.detalheAtivo ?? "Serviço ativo na carteira") : "Teve serviço, hoje sem serviço ativo",
      status: c.ativo ? "Cliente ativo" : "Ex-cliente", tom: c.ativo ? "verde" : "cinza",
    });
  }
  for (const a of f.aquisicoes.filter((x) => ETAPAS_ATIVAS.has(x.etapa))) {
    v.push({
      ...base, id: a.id, leadId: a.id, k: "aquisicao", titulo: a.titulo, sub: a.sub, status: a.etapaRotulo,
      tom: a.etapa === "nutricao" ? "azul" : "coral",
    });
  }
  for (const o of f.oportunidades.filter((x) => x.etapa !== "perdido")) {
    const ganha = o.etapa === "ganho";
    v.push({
      ...base, id: o.id, k: "opp", titulo: o.titulo,
      sub: o.familia ? ROTULO_FAMILIA[o.familia as Familia] ?? o.familia : "Família a definir",
      /* Ganho não é "Cliente ativo": quem diz isso é o serviço ativo (linha acima). */
      status: ganha ? (c.ativo ? "Ganho" : "Ganho, sem serviço ativo") : o.etapaRotulo,
      tom: ganha ? "cinza" : "coral",
    });
  }
  for (const p of (f.propostas ?? []).filter((x) => x.status in PROPOSTA_ABERTA)) {
    v.push({ ...base, id: p.id, k: "proposta", titulo: `Proposta ${p.numero} (v${p.versao})`, sub: "", status: PROPOSTA_ABERTA[p.status], tom: "azul" });
  }

  const itens = relacoesDoRegistro(v, { empresaId: f.empresaId, leadId: f.leadId });
  const perdidas = f.oportunidades.filter((o) => o.etapa === "perdido").length;
  const desqualificados = f.aquisicoes.filter((a) => a.etapa === "desqualificado").length;
  const encerradas = (f.propostas?.length ?? 0) - (f.propostas ?? []).filter((x) => x.status in PROPOSTA_ABERTA).length;
  /* Com serviço mas sem a ficha 360 não há link a oferecer; ainda assim não é ausência. */
  const semFicha = (c.ativo || c.jaTeveServico) && !c.ficha;
  const temHistoria = perdidas + desqualificados + encerradas > 0 || semFicha;
  return {
    itens, perdidas,
    /* Perdida, desqualificado e proposta encerrada não estão em andamento, mas
       também não são ausência: o card não diz "só existe na base". */
    vazio: itens.length === 0 && !temHistoria,
    vazioTxt: itens.length === 0 && !temHistoria ? f.vazioPrefixo : `${f.vazioPrefixo.replace(/ Por enquanto.*$/, "")} Há histórico encerrado.`,
  };
}

/** O formato que `Relacoes()` do catálogo devolve para a Liga gerada. */
export function paraALiga(r: RelacoesDaFicha, ir: (rota: string) => void) {
  return {
    itens: r.itens.map(({ href, ...resto }) => ({
      ...resto, acao: resto.k === "cliente" ? "Ver histórico" : "Abrir", ir: () => ir(href),
    })),
    perdidas: r.perdidas,
  };
}

/** Overrides que a Liga gerada não sabe fazer: ela afirma vazio com `!itens.length`,
 *  inclusive antes de hidratar. Aplicado na saída do `renderVals`. */
export function corrigirVazio(relAtivas: any, r: RelacoesDaFicha, hidratado: boolean) {
  if (!relAtivas) return;
  relAtivas.vazio = hidratado && r.vazio;
  relAtivas.vazioTxt = r.vazioTxt;
}
