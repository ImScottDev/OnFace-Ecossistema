/** Rótulos e formato da classificação, sem banco: pode ser importado por Client Component. */
export type Classe = "cliente" | "lead" | "prospect" | "contato";
export const ROTULO_CLASSE: Record<Classe, string> = { cliente: "Cliente", lead: "Lead", prospect: "Prospect", contato: "Contato" };

/** O que `classificar` devolve. Mora aqui (sem banco) para a tela e o NEXO usarem o tipo sem puxar o `db`. */
export interface Classificacao { classe: Classe; motivo: string | null; estagio: string | null }

/** Quando a leitura não achou o registro: avulso, a mesma saída de `classificar({})`. */
export const CONTATO_AVULSO: Classificacao = { classe: "contato", motivo: null, estagio: null };

/**
 * A classe como as superfícies a exibem e como o NEXO a responde: sempre este
 * formato, para a busca, o Cliente 360 e o NEXO dizerem a MESMA coisa. Nenhuma
 * superfície monta esse objeto à mão.
 */
export interface ClasseApresentada { classe: Classe; classeRotulo: string; estagio: string | null; motivo: string | null }

export function apresentarClasse(c: Classificacao | null | undefined): ClasseApresentada {
  const x = c ?? CONTATO_AVULSO;
  return { classe: x.classe, classeRotulo: ROTULO_CLASSE[x.classe], estagio: x.estagio, motivo: x.motivo };
}

/** Acrescenta a classe a cada linha, olhando o mapa que `classificar*` devolveu (chave = id do registro). */
export function comClasse<T extends object>(
  linhas: T[], idDe: (linha: T) => string | null | undefined, mapa: ReadonlyMap<string, Classificacao>,
): Array<T & ClasseApresentada> {
  return linhas.map((l) => {
    const id = idDe(l);
    return { ...l, ...apresentarClasse(id ? mapa.get(id) : null) };
  });
}

/** "Lead · Pré-vendas · Novo" / "Contato · Nutrição" / "Cliente": o texto curto de uma etiqueta. */
export function textoDaClasse(c: Classificacao | null | undefined): string {
  const a = apresentarClasse(c);
  return a.estagio && a.classe !== "cliente" ? `${a.classeRotulo} · ${a.estagio}` : a.classeRotulo;
}
