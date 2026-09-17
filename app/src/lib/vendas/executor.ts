import { db } from "@/lib/db";

/**
 * Quem executa a query: o `db` global ou a transação em curso.
 *
 * Todo comando do motor recebe isso como último parâmetro, porque a spec exige
 * que a mudança e o evento que a descreve existam na mesma transação. Um
 * evento gravado fora dela pode sobreviver a um rollback e passar a descrever
 * algo que não aconteceu.
 */
export type ExecutorDb = Pick<typeof db, "execute">;
