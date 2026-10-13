/**
 * O PLANO de cada tarefa de CS da saúde de uso: título, corpo, prioridade e prazo
 * por motivo. Puro (sem banco): o gerador (`tarefas-saude.ts`) só aplica.
 */
import type { CodigoMotivo, MotivoSaude } from "./saude-regras";

/** Motivos que viram tarefa. `copiloto_baixo` é só leitura (amarelo na tela). */
export const MOTIVOS_COM_TAREFA: readonly CodigoMotivo[] = [
  "silencio", "queda", "licenca_ociosa", "no_teto", "vencimento", "cancelamento", "nunca_usou", "desativada",
];

/** Dias de respiro depois que UMA PESSOA fecha a tarefa do motivo. */
export const RESPIRO_DIAS: Record<CodigoMotivo, number> = {
  silencio: 7, queda: 7, licenca_ociosa: 14, no_teto: 14, vencimento: 7,
  cancelamento: 7, nunca_usou: 7, desativada: 30, copiloto_baixo: 30,
};

export const tipoDaTarefa = (codigo: CodigoMotivo) => `cs_uso_${codigo}`;


/** Fim do dia civil de São Paulo (UTC-3 fixo) daqui a `dias` dias. */
export function fimDoDiaSp(agora: Date, dias = 0): Date {
  const sp = new Date(agora.getTime() - 3 * 3600_000);
  const fim = Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth(), sp.getUTCDate() + dias, 23, 59, 59);
  return new Date(fim + 3 * 3600_000);
}

/** Prioridade do silêncio: quanto mais velho, mais alto. É a mesma tarefa subindo, não outra nascendo. */
export function prioridadeDoSilencio(dias: number): "alta" | "urgente" {
  return dias >= 10 ? "urgente" : "alta";
}

export interface PlanoDeTarefa {
  titulo: string;
  descricao: string;
  prioridade: "baixa" | "media" | "alta" | "urgente";
  /** Prazo SÓ na criação (o prazo original é o compromisso; envelhecer sobe prioridade, não muda o prazo). */
  venceEm: Date;
}

const num = (m: MotivoSaude, k: string): number => Number(m.numeros[k] ?? 0);

/** Pura: o que a tarefa deste motivo diz e quando vence. */
export function planejarTarefa(empresaNome: string, m: MotivoSaude, agora: Date): PlanoDeTarefa {
  switch (m.codigo) {
    case "silencio": {
      const d = num(m, "diasSilencio");
      return { titulo: `${empresaNome} está há ${d} dias sem usar o Callface AI — descobrir o que aconteceu`, descricao: m.detalhe,
        prioridade: prioridadeDoSilencio(d), venceEm: fimDoDiaSp(agora, 0) };
    }
    case "queda": {
      const q = num(m, "quedaPct");
      return { titulo: `Uso do Callface AI caindo ${Math.round(q)}% em 14 dias — ${empresaNome}`, descricao: m.detalhe,
        prioridade: q > 70 ? "alta" : "media", venceEm: fimDoDiaSp(agora, 2) };
    }
    case "licenca_ociosa":
      return { titulo: `${num(m, "licencasOciosas")} licenças pagas sem uso — reunião de adoção com ${empresaNome}`, descricao: m.detalhe,
        prioridade: "media", venceEm: fimDoDiaSp(agora, 5) };
    case "no_teto":
      return { titulo: `${empresaNome} no teto do plano (${Math.round(num(m, "consumoPct"))}%) — conversar sobre expansão`,
        descricao: `${m.detalhe}\n\nIsto é expansão, não risco: o closer da venda foi avisado.`, prioridade: "media", venceEm: fimDoDiaSp(agora, 3) };
    case "vencimento": {
      const d = num(m, "diasAteVencer");
      return { titulo: `Renovação do Callface AI em ${d} dias — ${empresaNome}`, descricao: m.detalhe,
        prioridade: d <= 7 || num(m, "usoBaixo") ? "alta" : "media",
        venceEm: new Date(Math.max(fimDoDiaSp(agora, 0).getTime(), fimDoDiaSp(agora, Math.max(0, d)).getTime())) };
    }
    case "cancelamento":
      return { titulo: `Assinatura cancelada no Callface AI — ${empresaNome} (risco para o grupo)`, descricao: m.detalhe,
        prioridade: "alta", venceEm: fimDoDiaSp(agora, 0) };
    case "nunca_usou":
      return { titulo: `Onboarding não pegou: ${empresaNome} nunca usou o Callface AI`, descricao: m.detalhe,
        prioridade: "alta", venceEm: fimDoDiaSp(agora, 0) };
    case "desativada":
      return { titulo: `Organização desativada no Callface AI — ${empresaNome}`, descricao: m.detalhe,
        prioridade: "alta", venceEm: fimDoDiaSp(agora, 0) };
    default:
      return { titulo: `${empresaNome}: ${m.rotulo}`, descricao: m.detalhe, prioridade: "media", venceEm: fimDoDiaSp(agora, 5) };
  }
}

