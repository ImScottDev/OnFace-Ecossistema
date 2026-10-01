import type { StatusDestinatario } from "@/lib/automacoes/campanhas";

type Tom = "coral" | "alerta" | "sucesso" | "info" | "neutro-escuro" | undefined;

/** Estados que o worker e a tela produzem (lib/automacoes/campanhas-envio.ts). Valor fora daqui aparece cru. */
export const STATUS_CAMPANHA: Record<string, { rotulo: string; tom: Tom }> = {
  rascunho: { rotulo: "Rascunho", tom: undefined },
  agendada: { rotulo: "Agendada", tom: "info" },
  enviando: { rotulo: "Enviando", tom: "coral" },
  pausada: { rotulo: "Pausada", tom: "alerta" },
  concluida: { rotulo: "Concluída", tom: "sucesso" },
};

export const STATUS_DESTINATARIO: Record<StatusDestinatario, { rotulo: string; tom: Tom }> = {
  pendente: { rotulo: "Na fila", tom: undefined },
  enviando: { rotulo: "Enviando", tom: "info" },
  enviado: { rotulo: "Enviado", tom: "sucesso" },
  bloqueado: { rotulo: "Bloqueado", tom: "neutro-escuro" },
  falhou: { rotulo: "Falhou", tom: "alerta" },
};

export function statusCampanha(s: string) {
  return STATUS_CAMPANHA[s] ?? { rotulo: s, tom: "info" as Tom };
}
