/**
 * A ÚNICA costura entre as telas do pós-venda e o dado.
 *
 * As telas e as server actions só conversam com este arquivo. Hoje ele serve
 * a fixture de desenvolvimento; ligar no real é trocar o corpo das funções
 * abaixo por `boardDoPosVenda()` / `projetoCompleto()` / ações do motor e
 * apagar `lib/pos-venda/fixture-dev.ts`.
 *
 * TODO: REMOVER AO LIGAR — tudo que importa de `fixture-dev`.
 *
 * Trava: em produção a fixture NÃO é servida. Sem o motor ligado a leitura
 * devolve erro escrito, e a tela mostra "não consegui carregar" — nunca uma
 * empresa inventada com cara de real.
 */
import type { Board, FiltrosDoBoard, MotivoDaEspera, Projeto, Resultado, Usuario } from "@/lib/pos-venda/contrato";
import { boardDev, EQUIPE_DEV, motorDev, projetoDev } from "@/lib/pos-venda/fixture-dev";

export type Leitura<T> = { ok: true; dados: T } | { ok: false; erro: string };

const MOTOR_LIGADO = false;
const USA_FIXTURE = !MOTOR_LIGADO && process.env.NODE_ENV !== "production";
const SEM_MOTOR = "A leitura do pós-venda ainda não está ligada nesta versão.";

export async function lerBoard(_organizacaoId: string, filtros: FiltrosDoBoard): Promise<Leitura<Board>> {
  if (USA_FIXTURE) return { ok: true, dados: boardDev(filtros) };
  return { ok: false, erro: SEM_MOTOR };
}

/** `dados: null` quando o projeto não existe (ou não é desta organização). */
export async function lerProjeto(_organizacaoId: string, id: string): Promise<Leitura<Projeto | null>> {
  if (USA_FIXTURE) return { ok: true, dados: projetoDev(id) };
  return { ok: false, erro: SEM_MOTOR };
}

/** Quem pode receber uma tarefa. O contrato ainda não tem esta leitura. */
export async function lerEquipe(_organizacaoId: string): Promise<Leitura<Usuario[]>> {
  if (USA_FIXTURE) return { ok: true, dados: EQUIPE_DEV };
  return { ok: false, erro: SEM_MOTOR };
}

const recusa = (): Resultado => ({ ok: false, erro: "Esta ação ainda não está ligada ao motor do pós-venda." });
const naFixture = (f: () => Resultado): Resultado => (USA_FIXTURE ? f() : recusa());
const naoSimulado = (): Resultado => ({ ok: false, erro: "Esta ação não é simulada no modo de desenvolvimento." });

/** Cada ação recebe a organização para o motor real poder isolar por tenant. */
export const acoes = {
  concluirTarefa: async (_org: string, projetoId: string, tarefaId: string) => naFixture(() => motorDev.concluirTarefa(projetoId, tarefaId)),
  reabrirTarefa: async (_org: string, projetoId: string, tarefaId: string) => naFixture(() => motorDev.reabrirTarefa(projetoId, tarefaId)),
  marcarItem: async (_org: string, projetoId: string, itemId: string, feito: boolean) => naFixture(() => motorDev.marcarItem(projetoId, itemId, feito)),
  atribuirTarefa: async (_org: string, projetoId: string, tarefaId: string, usuarioId: string | null) => naFixture(() => motorDev.atribuirTarefa(projetoId, tarefaId, usuarioId)),
  remarcarTarefa: async (_org: string, projetoId: string, tarefaId: string, venceEm: Date) => naFixture(() => motorDev.remarcarTarefa(projetoId, tarefaId, venceEm)),
  marcarEspera: async (_org: string, projetoId: string, motivo: MotivoDaEspera, detalhe: string | null) => naFixture(() => motorDev.marcarEspera(projetoId, motivo, detalhe)),
  encerrarEspera: async (_org: string, projetoId: string) => naFixture(() => motorDev.encerrarEspera(projetoId)),
  adicionarNota: async (_org: string, projetoId: string, texto: string) => naFixture(() => motorDev.adicionarNota(projetoId, texto)),
  salvarLevantamento: async (_org: string, projetoId: string, campos: Partial<Projeto["levantamento"]>) => naFixture(() => motorDev.salvarLevantamento(projetoId, campos)),
  enviarFormulario: async (_org: string, _projetoId: string) => (USA_FIXTURE ? naoSimulado() : recusa()),
  escalarParaImplantacao: async (_org: string, _projetoId: string) => (USA_FIXTURE ? naoSimulado() : recusa()),
  fazerHandoff: async (_org: string, _projetoId: string) => (USA_FIXTURE ? naoSimulado() : recusa()),
};
