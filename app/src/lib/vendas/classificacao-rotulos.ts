/** Rótulos da classificação, sem banco: pode ser importado por Client Component. */
export type Classe = "cliente" | "lead" | "prospect" | "contato";
export const ROTULO_CLASSE: Record<Classe, string> = { cliente: "Cliente", lead: "Lead", prospect: "Prospect", contato: "Contato" };
