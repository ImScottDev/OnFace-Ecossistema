/**
 * O que as fichas de Pessoa e de Empresa mostram e que não vem de `detalheLead`
 * nem de `empresa360`: cadência viva, empresas extras da pessoa, arquivos e os
 * campos de enriquecimento da empresa.
 *
 * Cada item aqui existe porque a ficha guardava o dado num store local da tela
 * (some ao recarregar) e o botão avisava que gravava. A leitura mora numa
 * consulta própria para não crescer `consultas.ts`; a escrita está em
 * `app/(produto)/contatos/actions.ts`. As duas pontas falam das mesmas tabelas,
 * então editar numa tela aparece em todas.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { textoSimples } from "./texto";

export interface CadenciaDoLead {
  /** Nome da cadência (definição) em que o lead está inscrito. */
  nome: string;
  pausada: boolean;
}

/** A inscrição viva (ativa ou pausada) do lead, ou null. */
export async function cadenciaDoLead(organizacaoId: string, leadId: string): Promise<CadenciaDoLead | null> {
  const [r] = await db.execute<{ nome: string; status: string }>(sql`
    SELECT cd.nome, ce.status
      FROM cadence_enrollments ce
      JOIN cadence_definitions cd ON cd.id = ce.cadence_definition_id
     WHERE ce.organizacao_id = ${organizacaoId}::uuid AND ce.entity_type = 'lead'
       AND ce.entity_id = ${leadId}::uuid AND ce.status IN ('active', 'waiting', 'waiting_reply', 'paused')
     ORDER BY ce.started_at DESC LIMIT 1`);
  return r ? { nome: r.nome, pausada: r.status === "paused" } : null;
}

export interface EmpresaExtraDaPessoa { empresaId: string; nome: string; papel: string }

/**
 * As OUTRAS empresas a que a pessoa está vinculada (vínculo aberto), fora a
 * principal do lead. A pessoa canônica é a espelhada pelo lead (`lead_id_legado`).
 */
export async function empresasExtrasDaPessoa(organizacaoId: string, leadId: string): Promise<EmpresaExtraDaPessoa[]> {
  const linhas = await db.execute<{ empresa_id: string; nome: string; papel: string; cargo: string | null }>(sql`
    SELECT v.empresa_id::text, e.nome, v.papel, v.cargo
      FROM pessoas p
      JOIN pessoa_empresa_vinculos v ON v.pessoa_id = p.id AND v.encerrado_em IS NULL
      JOIN empresas e ON e.id = v.empresa_id
      JOIN leads l ON l.id = p.lead_id_legado
     WHERE p.organizacao_id = ${organizacaoId}::uuid AND l.id = ${leadId}::uuid
       AND v.empresa_id IS DISTINCT FROM l.empresa_id
     ORDER BY v.created_at`);
  return linhas.map((l) => ({ empresaId: l.empresa_id, nome: l.nome, papel: l.cargo || ROTULO_PAPEL[l.papel] || "Vinculada" }));
}

const ROTULO_PAPEL: Record<string, string> = {
  contato_principal: "Contato principal", decisor: "Decisor", influenciador: "Influenciador",
  financeiro: "Financeiro", tecnico: "Técnico", usuario: "Usuário", outro: "Vinculada",
};

export interface ArquivoDaEmpresa { id: string; nome: string; mime: string; bytes: number; em: string }

/** Os arquivos enviados para a empresa (acervo canônico, vínculo `empresa`). */
export async function arquivosDaEmpresa(organizacaoId: string, empresaId: string): Promise<ArquivoDaEmpresa[]> {
  const linhas = await db.execute<{ id: string; nome: string; mime: string; bytes: string; em: string }>(sql`
    SELECT fo.id::text, fo.nome_original AS nome, fo.mime_type AS mime, fo.tamanho_bytes::text AS bytes, fl.created_at::text AS em
      FROM file_links fl
      JOIN file_objects fo ON fo.id = fl.file_object_id AND fo.deleted_at IS NULL
     WHERE fl.organizacao_id = ${organizacaoId}::uuid AND fl.entity_type = 'empresa'
       AND fl.entity_id = ${empresaId}::uuid AND fl.papel = 'arquivo'
     ORDER BY fl.created_at DESC LIMIT 100`);
  return linhas.map((l) => ({ id: l.id, nome: l.nome, mime: l.mime, bytes: Number(l.bytes), em: l.em }));
}

export interface EnriquecimentoDaEmpresa {
  funcionarios: string | null; faturamento: string | null; linkedin: string | null; tecnologias: string | null;
  /** Veio do Apollo (a empresa tem `apollo_id`/`enriched_at`); sem isto os valores são digitados. */
  deApollo: boolean;
}

/** Campos do card "Dados da empresa" que a ficha de `empresa360` não traz. */
export async function enriquecimentoDaEmpresa(organizacaoId: string, empresaId: string): Promise<EnriquecimentoDaEmpresa> {
  const [e] = await db.execute<{ funcionarios: string | null; faturamento: string | null; linkedin: string | null; tecnologias: string | null; deApollo: boolean }>(sql`
    SELECT coalesce(nullif(campos_custom->>'funcionarios', ''), employee_count::text) AS funcionarios,
           annual_revenue AS faturamento, linkedin,
           nullif(campos_custom->>'tecnologias', '') AS tecnologias,
           (apollo_id IS NOT NULL OR enriched_at IS NOT NULL) AS "deApollo"
      FROM empresas WHERE id = ${empresaId}::uuid AND organizacao_id = ${organizacaoId}::uuid`);
  return e ?? { funcionarios: null, faturamento: null, linkedin: null, tecnologias: null, deApollo: false };
}

export interface TarefaDoLead {
  id: string; titulo: string; tipo: string | null; status: string;
  descricao: string | null; venceEm: string | null; responsavel: string | null;
}

/**
 * As atividades do lead: a tabela `tarefas` (a mesma de /tarefas e da peça de
 * Atividade). É a mesma consulta de `detalheOportunidade`, trocando o vínculo
 * de negócio por lead; a próxima ação do cartão (`proximaAcaoLateral`) sai
 * daqui também, então a lista e o cartão nunca discordam.
 */
export async function tarefasDoLead(organizacaoId: string, leadId: string): Promise<TarefaDoLead[]> {
  const linhas = await db.execute<{
    id: string; titulo: string; tipo: string | null; status: string; descricao: string | null; vence_em: string | null; responsavel: string | null;
  }>(sql`
    SELECT t.id::text, t.titulo, t.tipo, t.status, t.descricao,
           COALESCE(t.vence_em, t.data_vencimento)::text AS vence_em, u.nome AS responsavel
      FROM tarefas t LEFT JOIN usuarios u ON u.id = t.usuario_id
     WHERE t.lead_id = ${leadId}::uuid AND t.organizacao_id = ${organizacaoId}::uuid
     ORDER BY (t.status IN ('concluida','declinada')), COALESCE(t.vence_em, t.data_vencimento) NULLS LAST, t.created_at DESC
     LIMIT 100`);
  return linhas.map((t) => ({
    id: t.id, titulo: t.titulo, tipo: t.tipo, status: t.status, descricao: textoSimples(t.descricao),
    venceEm: t.vence_em, responsavel: t.responsavel,
  }));
}

export interface NotaDoLead { id: string; texto: string; autor: string | null; em: string }

/** Notas do lead (`notas.lead_id`): as mesmas que a ficha da Pessoa lê por /api/notas. */
export async function notasDoLead(organizacaoId: string, leadId: string): Promise<NotaDoLead[]> {
  const linhas = await db.execute<{ id: string; texto: string | null; autor: string | null; em: string }>(sql`
    SELECT n.id::text, COALESCE(n.conteudo, n.conteudo_raw) AS texto,
           COALESCE(u.nome, n.autor_display_name) AS autor, n.created_at::text AS em
      FROM notas n LEFT JOIN usuarios u ON u.id = n.autor_id
     WHERE n.lead_id = ${leadId}::uuid AND n.organizacao_id = ${organizacaoId}::uuid
     ORDER BY n.created_at DESC LIMIT 100`);
  return linhas.map((n) => ({ id: n.id, texto: textoSimples(n.texto) ?? "", autor: n.autor, em: n.em }));
}
