import { useCallback, useTransition } from "react";
import { toast } from "sonner";
import type { Levantamento, MotivoDaEspera } from "@/lib/pos-venda/contrato";

export type ResultadoDaAcao = { ok: true; msg?: string } | { ok: false; erro: string };

/**
 * As server actions que a tela chama, já recebidas por prop (a tela cliente
 * nunca importa `actions.ts`). O `projetoId` é fechado pela página, então o
 * componente só fala de tarefa, item, espera.
 */
export type AcoesDaTela = {
  concluirTarefa(tarefaId: string): Promise<ResultadoDaAcao>;
  reabrirTarefa(tarefaId: string): Promise<ResultadoDaAcao>;
  marcarItem(itemId: string, feito: boolean): Promise<ResultadoDaAcao>;
  atribuirTarefa(tarefaId: string, usuarioId: string | null): Promise<ResultadoDaAcao>;
  trocarResponsavel(usuarioId: string | null): Promise<ResultadoDaAcao>;
  /** `dia` é AAAA-MM-DD no calendário de São Paulo. */
  remarcarTarefa(tarefaId: string, dia: string): Promise<ResultadoDaAcao>;
  marcarEspera(motivo: MotivoDaEspera, detalhe: string): Promise<ResultadoDaAcao>;
  encerrarEspera(): Promise<ResultadoDaAcao>;
  adicionarNota(texto: string): Promise<ResultadoDaAcao>;
  salvarLevantamento(campos: Levantamento): Promise<ResultadoDaAcao>;
  enviarFormulario(): Promise<ResultadoDaAcao>;
  escalarParaImplantacao(): Promise<ResultadoDaAcao>;
  fazerHandoff(): Promise<ResultadoDaAcao>;
};

/**
 * Roda uma ação com toast de sucesso ou de erro. Devolve `true` quando deu
 * certo, para o chamador fechar diálogo ou limpar campo só nesse caso.
 *
 * O erro vem do servidor com o motivo escrito: a tela repassa, não inventa.
 */
export function useAcao() {
  const [pendente, comecar] = useTransition();
  const rodar = useCallback(
    (fazer: () => Promise<ResultadoDaAcao>, sucesso: string, depois?: (ok: boolean) => void) => {
      comecar(async () => {
        let ok = false;
        try {
          const r = await fazer();
          if (r.ok) {
            ok = true;
            toast.success(r.msg ?? sucesso);
          } else {
            toast.error(r.erro);
          }
        } catch {
          toast.error("Não consegui falar com o servidor. Tente de novo.");
        }
        depois?.(ok);
      });
    },
    [],
  );
  return { pendente, rodar, comecar };
}
