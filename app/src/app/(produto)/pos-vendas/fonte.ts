/**
 * A ÚNICA costura entre as telas do pós-venda e o dado.
 *
 * As telas e as server actions só conversam com este arquivo. Ele existe para
 * que trocar a origem do dado seja um arquivo, e não trinta.
 *
 * Ligado no motor real em 09/11/2026. A fixture de desenvolvimento morreu
 * junto — enquanto ela existia, o risco era ela sobreviver e virar mais uma
 * tela bonita com dado inventado, que é defeito conhecido deste repositório.
 *
 * Erro de leitura devolve `{ ok: false }` com texto, e a tela escreve o que
 * houve. Nunca lista vazia fingindo que não há projeto: ausência por falha e
 * ausência de verdade são coisas diferentes.
 */
import type { Board, FiltrosDoBoard, MotivoDaEspera, Projeto, Resultado, Usuario } from "@/lib/pos-venda/contrato";
import { boardDoPosVenda } from "@/lib/pos-venda/board";
import { projetoCompleto } from "@/lib/pos-venda/projeto";
import * as pv from "@/lib/pos-venda/acoes";

export type Leitura<T> = { ok: true; dados: T } | { ok: false; erro: string };

/** Falha de leitura não derruba a tela: vira texto. O detalhe técnico fica no log. */
function naoDeu(contexto: string, e: unknown): { ok: false; erro: string } {
  console.error(`[pos-venda] ${contexto}:`, e);
  return { ok: false, erro: "Não consegui carregar os dados do pós-venda agora." };
}

export async function lerBoard(organizacaoId: string, filtros: FiltrosDoBoard): Promise<Leitura<Board>> {
  try {
    return { ok: true, dados: await boardDoPosVenda(organizacaoId, filtros) };
  } catch (e) { return naoDeu("board", e); }
}

/** `dados: null` quando o projeto não existe (ou não é desta organização). */
export async function lerProjeto(organizacaoId: string, id: string): Promise<Leitura<Projeto | null>> {
  try {
    return { ok: true, dados: await projetoCompleto(organizacaoId, id) };
  } catch (e) { return naoDeu(`projeto ${id}`, e); }
}

/** Quem pode receber uma tarefa. */
export async function lerEquipe(organizacaoId: string): Promise<Leitura<Usuario[]>> {
  try {
    return { ok: true, dados: await pv.equipeDaOrganizacao(organizacaoId) };
  } catch (e) { return naoDeu("equipe", e); }
}

/**
 * O ator de cada ação. As server actions montam a partir da sessão e passam
 * aqui — este arquivo não lê sessão, para continuar testável sem ela.
 */
export type Ator = pv.AtorPV;

const porFazer = (o: string): Resultado => ({
  ok: false,
  erro: `${o} ainda não está disponível nesta versão.`,
  codigo: "nao_implementado",
});

export const acoes = {
  concluirTarefa: (a: Ator, projetoId: string, tarefaId: string) => pv.concluirTarefa(a, projetoId, tarefaId),
  reabrirTarefa: (a: Ator, projetoId: string, tarefaId: string) => pv.reabrirTarefa(a, projetoId, tarefaId),
  marcarItem: (a: Ator, projetoId: string, itemId: string, feito: boolean) => pv.marcarItem(a, projetoId, itemId, feito),
  atribuirTarefa: (a: Ator, projetoId: string, tarefaId: string, usuarioId: string | null) => pv.atribuirTarefa(a, projetoId, tarefaId, usuarioId),
  remarcarTarefa: (a: Ator, projetoId: string, tarefaId: string, venceEm: Date) => pv.remarcarTarefa(a, projetoId, tarefaId, venceEm),
  marcarEspera: (a: Ator, projetoId: string, motivo: MotivoDaEspera, detalhe: string | null) => pv.marcarEspera(a, projetoId, motivo, detalhe),
  encerrarEspera: (a: Ator, projetoId: string) => pv.pararEspera(a, projetoId),
  adicionarNota: (a: Ator, projetoId: string, texto: string) => pv.adicionarNota(a, projetoId, texto),
  salvarLevantamento: (a: Ator, projetoId: string, campos: Partial<Projeto["levantamento"]>) => pv.salvarLevantamento(a, projetoId, campos),

  // Responsável e prazo DO PROJETO. Ligadas de verdade: são as reclamações 1 e 5
  // do Kauã ("não consigo mudar o responsável", "prazo: não definido" sem como definir).
  atribuirProjeto: (a: Ator, projetoId: string, usuarioId: string | null) => pv.atribuirProjeto(a, projetoId, usuarioId),
  editarPrazoProjeto: (a: Ator, projetoId: string, venceEm: Date | null) => pv.editarPrazoProjeto(a, projetoId, venceEm),

  // Ainda não ligadas, e a tela diz isso em vez de fingir que funcionou:
  // o envio do formulário e o handoff dependem de peças que não existem
  // (página pública do NPS, endpoint de agendamento do onboarding).
  enviarFormulario: async (_a: Ator, _projetoId: string) => porFazer("O envio do formulário"),
  escalarParaImplantacao: async (_a: Ator, _projetoId: string) => porFazer("A escalada para implantação"),
  fazerHandoff: async (_a: Ator, _projetoId: string) => porFazer("O handoff"),
};
