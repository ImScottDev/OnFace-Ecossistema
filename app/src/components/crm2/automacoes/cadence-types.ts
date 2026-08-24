/**
 * Tipos e helpers compartilhados entre o builder visual de cadências
 * (CadenceCanvas.tsx) e a tela que lista/salva/publica cadências
 * (CadenciasWorkspace.tsx). Único lugar que descreve a forma de
 * `cadence_definitions.steps`/`draft_steps` no lado do cliente — espelha
 * `CadenceStep` de `src/lib/cadencia/cadence-engine.ts` (fonte de verdade
 * no servidor). Nenhuma estrutura paralela: o que o canvas lê/escreve é
 * exatamente este `Step[]`, serializado como está pro backend.
 */

export type StepTipo = "wait" | "action" | "condition";

export interface Condicao {
  campo?: string;
  operador?: "igual" | "diferente" | "contem" | "maior_que" | "menor_que";
  valor?: string;
}

export interface Branch {
  /** null = branch padrão, sempre casa se nenhuma condição anterior bateu. */
  condicao: Condicao | null;
  /** null = encerra a cadência (nó "Fim"). */
  proximoStepId: string | null;
}

export interface Step {
  id: string;
  tipo: StepTipo;
  /** Só tipo="wait": minutos de espera antes do próximo step. */
  esperaMinutos?: number;
  /** Só tipo="action": nome do adapter registrado no engine (hoje só "noop" existe de verdade). */
  adapter?: string;
  /**
   * Config livre passada pro adapter. `config.label` é um rótulo amigável
   * opcional só de UI (não é lido pelo engine) — existe pra não obrigar o
   * usuário a editar o `id` técnico do step pra dar um nome ao passo.
   */
  config?: Record<string, unknown>;
  branches: Branch[];
}

export interface Cadencia {
  id: string;
  nome: string;
  entityType: string;
  ativo: boolean;
  totalPassos: number;
  enrollmentsPorStatus: Record<string, number>;
  steps: Step[];
  draftSteps: Step[];
  versao: number;
  publishedAt: string | null;
}

export const OPERADOR_LABEL: Record<NonNullable<Condicao["operador"]>, string> = {
  igual: "é igual a",
  diferente: "é diferente de",
  contem: "contém",
  maior_que: "é maior que",
  menor_que: "é menor que",
};

export function novoStepId(tipo: StepTipo): string {
  return `${tipo}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export function novoStep(tipo: StepTipo): Step {
  return {
    id: novoStepId(tipo),
    tipo,
    esperaMinutos: tipo === "wait" ? 60 : undefined,
    adapter: tipo === "action" ? "noop" : undefined,
    config: {},
    // Condição sem pelo menos 1 branch não faz nada no motor (validado
    // também no backend) — já nasce com 1 branch em branco pra evitar essa
    // etapa "morta".
    branches: tipo === "condition" ? [{ condicao: { campo: "", operador: "igual", valor: "" }, proximoStepId: null }] : [],
  };
}

export function stepLabel(step: Step): string {
  const label = (step.config?.label as string | undefined)?.trim();
  if (label) return label;
  if (step.tipo === "wait") return `Aguardar ${step.esperaMinutos ?? 0}min`;
  if (step.tipo === "condition") return "Condição";
  return step.adapter ? `Ação: ${step.adapter}` : "Ação";
}

export function condicaoResumo(c: Condicao | null | undefined): string {
  if (!c || !c.campo || !c.operador) return "senão (padrão)";
  return `${c.campo} ${OPERADOR_LABEL[c.operador] ?? c.operador} "${c.valor ?? ""}"`;
}
