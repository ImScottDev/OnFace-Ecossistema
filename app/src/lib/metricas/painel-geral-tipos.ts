/**
 * Tipos do painel da Visão Geral. SÓ tipos: nenhum import de `db` nem de módulo que o importe, para um
 * Client Component poder importar daqui (regra do projeto). `import type` some na compilação.
 */
import type { Familia } from "./recorte";

export type EstadoCartao = "disponivel" | "parcial" | "indisponivel" | "nao_aplicavel";

export type CodigoMotivo =
  | "sem_acesso"
  | "erro"
  | "filtro_nao_suportado"
  | "sem_dado_na_fonte"
  | "preenchimento_parcial"
  | "janela_encurtada_pelo_piso"
  | "janela_antes_do_piso"
  | "amostra_pequena"
  | "sem_denominador"
  | "sem_comparacao";

export interface Motivo { codigo: CodigoMotivo; mensagem: string }

export interface Cobertura {
  /** Primeira data com dado confiável da fonte (declarada no catálogo). */
  pisoDeclarado: string | null;
  /** O piso encurtou a janela pedida; é a data de início efetiva. */
  pisoAplicado: string | null;
  /** Menor e maior data de evento observadas no recorte. */
  observadoDe: string | null;
  observadoAte: string | null;
  /** Horas desde o dado mais recente do recorte; null sem data de evento. */
  frescorHoras: number | null;
  /** O campo de que o número depende: quantas linhas do universo o têm preenchido. */
  preenchimento: { rotulo: string; universo: number; preenchido: number; modo: "cobertura" | "ausencia" } | null;
}

export interface Comparacao { rotulo: string; valor: number; variacao: number | null }

export type DrillDe = "numerador" | "denominador";

export interface Cartao {
  /** Chave do cartão no painel (igual ao código da métrica ou da razão). */
  id: string;
  tipo: "metrica" | "razao";
  codigo: string;
  nome: string;
  unidade: "BRL" | "contagem" | "percentual" | "dias";
  estado: EstadoCartao;
  /** Por que o estado não é `disponivel`. Null quando é. */
  motivo: Motivo | null;
  /** Null sempre que o estado é `indisponivel` ou `nao_aplicavel`: dado ausente nunca vira zero. */
  valor: number | null;
  /** Linhas do recorte (o que o drill abre). Null quando o cartão não tem valor. */
  registros: number | null;
  comparacao: Comparacao | null;
  cobertura: Cobertura | null;
  fonte: string;
  naoInclui: string | null;
  /** "codigo?querystring" pronto para abrir `/api/relatorios/metricas/<drill>` ou a tela. Null sem acesso. */
  drill: string | null;
  /** Só nas razões. */
  razao: { numerador: number | null; denominador: number | null; amostraMinima: number; drillDe: DrillDe } | null;
}

export type EstadoBloco = "disponivel" | "parcial" | "indisponivel";

export interface BlocoBase { titulo: string; estado: EstadoBloco; motivo: Motivo | null }
export interface BlocoCartoes extends BlocoBase { cartoes: Cartao[] }

/** White Label: valor no MRR sem recorrência confirmada (decisão do dono do produto, 21/10). */
export interface AvisoRecorrencia {
  codigo: "white_label_sem_recorrencia";
  familia: "WHITE_LABEL";
  /** MRR atual da família, o número que continua dentro do MRR. */
  valor: number;
  /** Competências com MRR na família / competências com MRR no PABX (a que recorre de verdade). */
  competenciasComMrr: number;
  competenciasReferencia: number;
  /** Quantas competências seguidas, até a última, a família teve MRR. */
  sequenciaAteUltima: number;
  /** Exigido para chamar de recorrente (limiar versionado em painel-geral.ts). */
  sequenciaMinima: number;
  mensagem: string;
  drill: string;
}

export interface BlocoReceita extends BlocoCartoes { avisos: AvisoRecorrencia[] }

export interface PontoPainel { inicio: string; valor: number; registros: number; drill: string }
export interface BlocoEvolucao extends BlocoBase {
  metrica: string;
  periodo: string;
  granularidade: "dia" | "mes" | null;
  pontos: PontoPainel[];
  pisoAplicado: string | null;
}

export interface FatiaPainel { chave: string; valor: number; registros: number; drill: string | null }
export interface BlocoComposicao extends BlocoBase {
  metrica: string;
  total: number | null;
  dimensoes: Array<{ chave: string; rotulo: string; itens: FatiaPainel[]; outros: { valor: number; registros: number } | null }>;
}

export type SeveridadeAlerta = "critica" | "atencao";
export interface Alerta {
  id: string;
  /** `disparado` aparece como alerta; `ok` foi verificado e passou; `indisponivel` não deu para verificar. */
  situacao: "disparado" | "ok" | "indisponivel";
  severidade: SeveridadeAlerta;
  titulo: string;
  /** Cita o próprio número, sem adjetivo que o dado não sustenta. Null quando indisponível. */
  frase: string | null;
  /** Métrica que prova o alerta; o clique abre o drill dela. */
  metrica: string;
  valor: number | null;
  limiar: { descricao: string; versao: string };
  drill: string | null;
  motivo: Motivo | null;
}
export interface BlocoAlertas extends BlocoBase { versaoLimiares: string; alertas: Alerta[] }

export interface Lacuna { titulo: string; motivo: string }

export interface ParamsPainel {
  /** Janela dos cartões (PERIODO_RE). */
  periodo: string;
  familia?: Familia;
  testes: boolean;
  /** Janela da série de evolução. */
  serie: string;
}

export interface PainelGeral {
  organizacaoId: string;
  geradoEm: string;
  params: ParamsPainel;
  blocos: {
    receita: BlocoReceita;
    carteira: BlocoCartoes;
    aquisicao: BlocoCartoes;
    conversao: BlocoCartoes;
    pipeline: BlocoCartoes;
    evolucao: BlocoEvolucao;
    metas: BlocoCartoes;
    composicao: BlocoComposicao;
    alertas: BlocoAlertas;
  };
  lacunas: Lacuna[];
}
