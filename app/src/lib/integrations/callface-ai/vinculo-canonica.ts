/**
 * Eleição de empresa CANÔNICA entre duplicatas do ONFACE — função PURA.
 *
 * Quando duas ou mais empresas ainda sem vínculo têm o MESMO CNPJ (14 dígitos
 * normalizados), o casamento com a organização do Callface AI deixa de ser 1:1
 * e antes o sync simplesmente desistia. Aqui se decide, sem adivinhar:
 *
 *   - há canônica só se UMA empresa do grupo domina todas as outras em
 *     serviços Callface AI, assinaturas, oportunidades e pessoas (nunca menos
 *     em nenhum) e é estritamente maior em ao menos um dos três primeiros;
 *   - pessoas sozinhas nunca decidem; idade do cadastro nunca decide;
 *   - empate ou empresas "incomparáveis" (uma tem mais assinaturas, a outra
 *     mais oportunidades) => INDECISA, com a razão legível, e ninguém liga.
 *
 * Só agrupa por CNPJ de 14 dígitos. Nome parecido ou domínio igual nunca
 * formam grupo: podem ser filiais ou homônimas.
 */

export interface PesoEmpresa {
  /** Serviços canônicos da família CALLFACE_AI. */
  servicosAi: number;
  assinaturas: number;
  oportunidades: number;
  pessoas: number;
}

export interface MembroDoGrupo {
  empresaId: string;
  nome: string;
  peso?: PesoEmpresa;
}

export type Eleicao =
  | { tipo: "canonica"; canonicaId: string; duplicadas: string[]; criterio: string }
  | { tipo: "indecisa"; motivo: string };

const SEM_PESO: PesoEmpresa = { servicosAi: 0, assinaturas: 0, oportunidades: 0, pessoas: 0 };
const CAMPOS: Array<keyof PesoEmpresa> = ["servicosAi", "assinaturas", "oportunidades", "pessoas"];
const CAMPOS_DE_NEGOCIO: Array<keyof PesoEmpresa> = ["servicosAi", "assinaturas", "oportunidades"];
const ROTULO: Record<keyof PesoEmpresa, string> = {
  servicosAi: "serviços Callface AI", assinaturas: "assinaturas", oportunidades: "oportunidades", pessoas: "pessoas",
};

const descrever = (m: MembroDoGrupo) => {
  const p = m.peso ?? SEM_PESO;
  return `${m.nome} (${p.servicosAi} serv. AI, ${p.assinaturas} assin., ${p.oportunidades} oport., ${p.pessoas} pessoas)`;
};

/** `a` domina `b`: nunca menor em campo algum e maior em ao menos um campo de negócio. */
function domina(a: PesoEmpresa, b: PesoEmpresa): boolean {
  return CAMPOS.every((c) => a[c] >= b[c]) && CAMPOS_DE_NEGOCIO.some((c) => a[c] > b[c]);
}

export function elegerCanonica(membros: MembroDoGrupo[]): Eleicao {
  if (membros.length < 2) return { tipo: "indecisa", motivo: "Grupo com menos de duas empresas: não há eleição a fazer." };
  const candidatas = membros.filter((c) =>
    membros.every((o) => o.empresaId === c.empresaId || domina(c.peso ?? SEM_PESO, o.peso ?? SEM_PESO)));
  if (candidatas.length === 1) {
    const c = candidatas[0];
    const outras = membros.filter((m) => m.empresaId !== c.empresaId);
    const ganhou = CAMPOS_DE_NEGOCIO.filter((k) => outras.every((o) => (c.peso ?? SEM_PESO)[k] > (o.peso ?? SEM_PESO)[k]));
    return {
      tipo: "canonica", canonicaId: c.empresaId, duplicadas: outras.map((o) => o.empresaId),
      criterio: `mais ${(ganhou.length ? ganhou : CAMPOS_DE_NEGOCIO.filter((k) => outras.some((o) => (c.peso ?? SEM_PESO)[k] > (o.peso ?? SEM_PESO)[k]))).map((k) => ROTULO[k]).join(" e ")} e nenhuma a menos que as outras`,
    };
  }
  return {
    tipo: "indecisa",
    motivo: `Empresas duplicadas com o mesmo CNPJ e nenhuma é claramente a principal: ${membros.map(descrever).join("; ")}. Unifique o cadastro ou aponte a canônica.`,
  };
}

/** Grupos de 2+ empresas com o mesmo CNPJ de 14 dígitos. Chave = CNPJ só dígitos. */
export function agruparPorCnpj<T extends { cnpj: string | null }>(itens: T[], cnpjNormalizado: (v: string | null) => string | null): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const i of itens) {
    const c = cnpjNormalizado(i.cnpj);
    if (c) m.set(c, [...(m.get(c) ?? []), i]);
  }
  for (const [k, v] of m) if (v.length < 2) m.delete(k);
  return m;
}
