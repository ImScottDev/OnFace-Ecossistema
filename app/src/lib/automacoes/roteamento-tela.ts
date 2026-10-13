/**
 * Dados da tela Automações → Roteamento comercial (SSR). A escrita fica na rota Hono
 * `/api/automacoes/agentes-op/roteamento` (ai.configure); aqui só leitura, com a mesma fonte
 * que o resolvedor (`roteamento-closer`) e o rodízio da agenda usam.
 */
import { db } from "@/lib/db";
import { listarRegras } from "@/lib/crm/roteamento-closer";
import { getFilaClosers, type FilaCloserItem } from "@/lib/crm/agenda-closers";
import { and, eq } from "drizzle-orm";
import { usuarios } from "@/lib/db/schema";

export interface RegraDaTela {
  id: string; nome: string; familia: string | null; campanha: string | null; prioridade: number; ativa: boolean;
  vigenteDe: string | null; vigenteAte: string | null; destinoUsuarioId: string | null; destino: string | null; fallback: string;
}
export interface DadosRoteamento { regras: RegraDaTela[]; closers: { id: string; nome: string }[]; rodizio: FilaCloserItem[] }

export async function dadosRoteamento(organizacaoId: string): Promise<DadosRoteamento> {
  const [regras, closers, rodizio] = await Promise.all([
    listarRegras(organizacaoId),
    db.select({ id: usuarios.id, nome: usuarios.nome }).from(usuarios)
      .where(and(eq(usuarios.organizacaoId, organizacaoId), eq(usuarios.ativo, true), eq(usuarios.role, "closer"))).orderBy(usuarios.nome),
    getFilaClosers(db, organizacaoId),
  ]);
  return {
    closers, rodizio,
    regras: regras.map(({ r, destino }) => ({
      id: r.id, nome: r.nome, familia: r.familia, campanha: r.campanha, prioridade: r.prioridade, ativa: r.ativa,
      vigenteDe: r.vigenteDe?.toISOString() ?? null, vigenteAte: r.vigenteAte?.toISOString() ?? null,
      destinoUsuarioId: r.destinoUsuarioId, destino, fallback: r.fallback,
    })),
  };
}
