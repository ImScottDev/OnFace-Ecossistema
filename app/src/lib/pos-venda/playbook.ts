/**
 * Leitura do playbook configurável (`pos_venda_playbooks` + `pos_venda_playbook_passos`).
 * Edição é de administrador em Ajustes; aqui só leitura, para o motor e para as telas.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { Familia, PassoDoPlaybook, Playbook, TipoDeProjeto } from "./contrato";
import { dataDe, prioridadeDe } from "./regras";

/** Extensões de DB do passo que o contrato não carrega (SLA, conteúdo condicional, variante de upgrade). */
export interface PassoDoMotor extends PassoDoPlaybook {
  slaHoras: number | null;
  itensCondicionais: Array<{ complemento: string; playbook: string; itens: string[] }>;
  varianteUpgrade: { titulo: string; playbook: string; itens: string[] } | null;
}
export interface PlaybookDoMotor extends Omit<Playbook, "passos"> { passos: PassoDoMotor[] }

type LinhaPlaybook = {
  id: string; familia: string; tipo: string; nome: string; prazo_total_dias: number;
  a: number; e: number; c: number; responsavel_padrao_id: string | null; ativo: boolean; atualizado_em: string;
};
type LinhaPasso = {
  id: string; playbook_id: string; passo: string; ordem: number; titulo: string; playbook: string; itens: unknown;
  prazo_dias: number; sla_horas: number | null; prioridade: string; condicao: unknown; bloco: string;
  itens_condicionais: unknown; variante_upgrade: unknown;
};

/** jsonb chega como objeto já parseado (tipo conhecido do driver) ou como string; aceita os dois. */
function json<T>(v: unknown, vazio: T): T {
  if (v == null) return vazio;
  if (typeof v === "string") { try { return JSON.parse(v) as T; } catch { return vazio; } }
  return v as T;
}

function montar(pb: LinhaPlaybook, passos: LinhaPasso[]): PlaybookDoMotor {
  return {
    id: pb.id, familia: pb.familia as Familia, tipo: pb.tipo as TipoDeProjeto, nome: pb.nome,
    prazoTotalDias: pb.prazo_total_dias, blocos: { abertura: pb.a, execucao: pb.e, encerramento: pb.c },
    responsavelPadraoId: pb.responsavel_padrao_id, ativo: pb.ativo, atualizadoEm: dataDe(pb.atualizado_em) ?? new Date(0),
    passos: passos.filter((p) => p.playbook_id === pb.id).sort((x, y) => x.ordem - y.ordem).map((p) => ({
      id: p.id, passo: p.passo, ordem: p.ordem, titulo: p.titulo, playbook: p.playbook,
      itens: json<string[]>(p.itens, []), prazoDias: p.prazo_dias, prioridade: prioridadeDe(p.prioridade),
      condicao: json<{ complemento: string } | null>(p.condicao, null), bloco: p.bloco as PassoDoPlaybook["bloco"],
      slaHoras: p.sla_horas, itensCondicionais: json(p.itens_condicionais, []), varianteUpgrade: json(p.variante_upgrade, null),
    })),
  };
}

const COLUNAS_PB = sql`id::text, familia, tipo, nome, prazo_total_dias, bloco_abertura_dias AS a, bloco_execucao_dias AS e,
  bloco_encerramento_dias AS c, responsavel_padrao_id::text, ativo, to_json(updated_at)#>>'{}' AS atualizado_em`;

/** O playbook ATIVO da família+tipo, ou null (nunca inventa um). Passos inativos não vêm. */
export async function playbookAtivo(organizacaoId: string, familia: string, tipo: TipoDeProjeto): Promise<PlaybookDoMotor | null> {
  const [pb] = await db.execute<LinhaPlaybook>(sql`
    SELECT ${COLUNAS_PB} FROM pos_venda_playbooks
     WHERE organizacao_id = ${organizacaoId}::uuid AND familia = ${familia} AND tipo = ${tipo} AND ativo`);
  if (!pb) return null;
  const passos = await db.execute<LinhaPasso>(sql`
    SELECT id::text, playbook_id::text, passo, ordem, titulo, playbook, itens, prazo_dias, sla_horas, prioridade, condicao, bloco,
           itens_condicionais, variante_upgrade
      FROM pos_venda_playbook_passos
     WHERE organizacao_id = ${organizacaoId}::uuid AND playbook_id = ${pb.id}::uuid AND ativo`);
  return montar(pb, passos);
}

/** Todos os playbooks da organização (tela de Ajustes). */
export async function listarPlaybooks(organizacaoId: string): Promise<Playbook[]> {
  const pbs = await db.execute<LinhaPlaybook>(sql`SELECT ${COLUNAS_PB} FROM pos_venda_playbooks WHERE organizacao_id = ${organizacaoId}::uuid ORDER BY familia, tipo`);
  if (pbs.length === 0) return [];
  const passos = await db.execute<LinhaPasso>(sql`
    SELECT id::text, playbook_id::text, passo, ordem, titulo, playbook, itens, prazo_dias, sla_horas, prioridade, condicao, bloco,
           itens_condicionais, variante_upgrade
      FROM pos_venda_playbook_passos WHERE organizacao_id = ${organizacaoId}::uuid`);
  return pbs.map((pb) => {
    const { passos: ps, ...resto } = montar(pb, passos);
    return { ...resto, passos: ps.map(({ slaHoras: _s, itensCondicionais: _i, varianteUpgrade: _v, ...p }) => p) };
  });
}
