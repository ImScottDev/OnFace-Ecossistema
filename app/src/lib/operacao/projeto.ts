/**
 * Projeto (Onboarding & Implantação) — o dado real da tela /projetos/[id].
 *
 * Não existe tabela "projetos". A entidade é `fulfillments` + `fulfillment_itens`,
 * a mesma que /pos-vendas e o detalhe de onboarding usam. Este arquivo é só
 * leitura e é desta tela: o cabeçalho e o prazo vêm de `getOperacaoDetalhe`
 * (compartilhado com a Início, reusado sem editar), o resto sai daqui.
 *
 * O mapeamento para o desenho:
 *   projeto            = fulfillment
 *   tarefa (kid)       = grupo de itens — por MARCO no Callface AI (os 10 marcos
 *                        do guia real), por WORKSTREAM no PABX/White Label
 *   subtarefa          = cada fulfillment_item do grupo
 */
import { sql } from "drizzle-orm";
import { nomeEmpresaSql } from "@/lib/vendas/texto";

import { db } from "@/lib/db";
import { getOperacaoDetalhe } from "@/lib/analytics/onface-inicio";
import { MARCOS_AI, MARCO_AI_POR_WORKSTREAM } from "@/lib/crm/pos-venda-checklists";

/* Rótulos dos workstreams PABX/White Label. O mapa canônico mora dentro de um
   componente de cliente (FulfillmentDetail.tsx) e não é exportado; importar
   componente em query de servidor seria pior que repetir nove nomes. */
const ROTULO_WORKSTREAM: Record<string, string> = {
  levantamento: "Levantamento", portabilidade: "Portabilidade", softswitch: "Softswitch",
  infraestrutura: "Infraestrutura", licenciamento: "Licenciamento", configuracao_pbx: "Configuração PBX",
  qa_interno: "QA interno", validacao_cliente: "Validação cliente",
  abertura: "Abertura", comunicacao: "Comunicação com o cliente", materiais: "Materiais e configuração",
  ambiente: "Ambiente White Label", dominio: "Domínio e DNS", go_live: "Go-live",
  onboarding: "Onboarding do ambiente", conclusao: "Conclusão",
};
const ROTULO_MARCO: Record<string, string> = Object.fromEntries(MARCOS_AI.map((m) => [m.key, m.label]));

export interface ItemProjeto { id: string; titulo: string; status: string }
export interface GrupoProjeto { chave: string; titulo: string; itens: ItemProjeto[] }
export interface EventoProjeto { t: string; meta: string; autor: string; quando: string }
export interface FormularioProjeto {
  status: string;
  linhas: number;
  /** Operadoras atuais distintas, já juntadas por vírgula. */
  operadoras: string | null;
  ramais: number;
  opcoesUra: number;
  dominio: string | null;
}

export interface ProjetoReal {
  id: string;
  familia: string;
  status: string;
  /** Nome da empresa vinculada; null quando o serviço não tem empresa. */
  empresa: string | null;
  empresaId: string | null;
  servico: string;
  responsavel: string | null;
  /** YYYY-MM-DD. */
  inicio: string | null;
  prazo: string | null;
  prazoEstimado: boolean;
  concluidoEm: string | null;
  publicToken: string | null;
  oportunidadeId: string | null;
  leadId: string | null;
  contato: { nome: string; cargo: string | null; telefone: string | null; email: string | null; whatsapp: string | null } | null;
  grupos: GrupoProjeto[];
  eventos: EventoProjeto[];
  formulario: FormularioProjeto | null;
  /** Arquivos enviados no projeto (acervo canônico, vínculo `fulfillment`). */
  arquivos: Array<{ id: string; nome: string; tamanhoBytes: number; quando: string; autor: string | null; url: string }>;
  /** Bloqueio derivado dos itens BLOCKED do checklist; null = nada bloqueado. */
  bloqueio: { kind: "cliente" | "externo"; texto: string; desde: string | null; itemIds: string[] } | null;
}

const dia = (d: Date | string | null) => {
  if (!d) return null;
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

export async function getProjeto(orgId: string, fulfillmentId: string): Promise<ProjetoReal | null> {
  // getOperacaoDetalhe interpola o id direto no SQL de um uuid: id malformado
  // derrubaria a página com 500 em vez de 404.
  if (!/^[0-9a-f-]{36}$/i.test(fulfillmentId)) return null;

  const det = await getOperacaoDetalhe(orgId, fulfillmentId);
  if (!det) return null;

  const [[cab], itens, eventosTl, conclusoes, [form], [contagem], arquivos] = await Promise.all([
    db.execute<{
      status: string; public_token: string | null; started_at: string | null; completed_at: string | null;
      empresa_id: string | null; empresa: string | null; oportunidade_id: string | null; lead_id: string | null;
      nome: string | null; cargo: string | null; telefone: string | null; email: string | null; whatsapp: string | null;
    }>(sql`
      SELECT f.status, f.public_token, f.started_at, f.completed_at,
             sc.empresa_id, ${nomeEmpresaSql("e.nome")} AS empresa, sc.oportunidade_origem_id AS oportunidade_id, o.lead_id,
             pe.nome, pe.cargo, pe.telefone, pe.email, pe.whatsapp
        FROM fulfillments f
        JOIN servicos_canonicos sc ON sc.id = f.servico_canonico_id
        LEFT JOIN empresas e ON e.id = sc.empresa_id
        LEFT JOIN oportunidades o ON o.id = sc.oportunidade_origem_id
        LEFT JOIN pessoas pe ON pe.id = o.pessoa_id
       WHERE f.organizacao_id = ${orgId} AND f.id = ${fulfillmentId}
       LIMIT 1
    `),
    db.execute<{ id: string; workstream: string; titulo: string; status: string; completed_at: string | null; quem: string | null; blocker_type: string | null; blocker_reason: string | null; blocked_at: string | null }>(sql`
      SELECT fi.id, fi.workstream, fi.titulo, fi.status, fi.completed_at, u.nome AS quem,
             fi.blocker_type, fi.blocker_reason, fi.blocked_at::text AS blocked_at
        FROM fulfillment_itens fi
        LEFT JOIN usuarios u ON u.id = fi.completed_by
       WHERE fi.organizacao_id = ${orgId} AND fi.fulfillment_id = ${fulfillmentId}
       ORDER BY fi.ordem
    `),
    // timeline_events.servico_canonico_id é NULL em 100% das linhas: o único
    // elo real com o projeto é a oportunidade que o originou.
    db.execute<{ titulo: string; descricao: string | null; occurred_at: string; autor: string | null }>(sql`
      SELECT te.titulo, te.descricao, te.occurred_at, u.nome AS autor
        FROM timeline_events te
        JOIN fulfillments f ON f.id = ${fulfillmentId}
        JOIN servicos_canonicos sc ON sc.id = f.servico_canonico_id
        LEFT JOIN usuarios u ON u.id = te.actor_id AND te.actor_type = 'USER'
       WHERE te.organizacao_id = ${orgId} AND te.oportunidade_id = sc.oportunidade_origem_id
       ORDER BY te.occurred_at DESC LIMIT 60
    `),
    // A conclusão do fulfillment é gravada em `atividades` (rota /concluir).
    db.execute<{ titulo: string; descricao: string | null; created_at: string; autor: string | null }>(sql`
      SELECT a.titulo, a.descricao, a.created_at, u.nome AS autor
        FROM atividades a LEFT JOIN usuarios u ON u.id = a.usuario_id
       WHERE a.organizacao_id = ${orgId} AND a.dados->>'fulfillmentId' = ${fulfillmentId}
    `),
    db.execute<{ status: string; opcoes_ura: number; dominio: string | null }>(sql`
      SELECT status,
             COALESCE(jsonb_array_length(CASE WHEN jsonb_typeof(respostas->'ura'->'opcoes') = 'array' THEN respostas->'ura'->'opcoes' END), 0)::int AS opcoes_ura,
             respostas->'whiteLabel'->>'dominio' AS dominio
        FROM fulfillment_formularios
       WHERE organizacao_id = ${orgId} AND fulfillment_id = ${fulfillmentId}
       ORDER BY updated_at DESC LIMIT 1
    `),
    db.execute<{ linhas: number; ramais: number; operadoras: string | null }>(sql`
      SELECT (SELECT COUNT(*)::int FROM fulfillment_linhas_portabilidade WHERE fulfillment_id = ${fulfillmentId}) AS linhas,
             (SELECT COUNT(*)::int FROM fulfillment_ramais WHERE fulfillment_id = ${fulfillmentId}) AS ramais,
             (SELECT string_agg(DISTINCT operadora_atual, ', ') FILTER (WHERE operadora_atual IS NOT NULL AND operadora_atual <> '')
                FROM fulfillment_linhas_portabilidade WHERE fulfillment_id = ${fulfillmentId}) AS operadoras
    `),
    db.execute<{ id: string; nome: string; tamanho: string; criado_em: string; autor: string | null }>(sql`
      SELECT fo.id::text AS id, fo.nome_original AS nome, fo.tamanho_bytes::text AS tamanho,
             fo.created_at::text AS criado_em, u.nome AS autor
        FROM file_links fl JOIN file_objects fo ON fo.id = fl.file_object_id
        LEFT JOIN usuarios u ON u.id = fo.enviado_por_id
       WHERE fl.organizacao_id = ${orgId}::uuid AND fl.entity_type = 'fulfillment'
         AND fl.entity_id = ${fulfillmentId}::uuid AND fo.deleted_at IS NULL
       ORDER BY fo.created_at DESC
    `),
  ]);
  if (!cab) return null;

  // Agrupa preservando a ordem do checklist (a 1ª aparição define a posição).
  const porChave = new Map<string, GrupoProjeto>();
  for (const it of itens) {
    const marco = det.serviceFamily === "CALLFACE_AI" ? MARCO_AI_POR_WORKSTREAM[it.workstream] : undefined;
    const chave = marco ?? it.workstream;
    const titulo = marco ? ROTULO_MARCO[marco] : ROTULO_WORKSTREAM[it.workstream] ?? it.workstream;
    if (!porChave.has(chave)) porChave.set(chave, { chave, titulo, itens: [] });
    porChave.get(chave)!.itens.push({ id: it.id, titulo: it.titulo, status: it.status });
  }

  const eventos: EventoProjeto[] = [
    ...eventosTl.map((e) => ({ t: e.titulo, meta: e.descricao ?? "", autor: e.autor ?? "Sistema", quando: new Date(e.occurred_at).toISOString() })),
    ...conclusoes.map((e) => ({ t: e.titulo, meta: e.descricao ?? "", autor: e.autor ?? "Sistema", quando: new Date(e.created_at).toISOString() })),
    ...itens.filter((i) => i.status === "DONE" && i.completed_at)
      .map((i) => ({ t: "Tarefa concluída · " + i.titulo, meta: "", autor: i.quem ?? "Sistema", quando: new Date(i.completed_at!).toISOString() })),
  ].sort((a, b) => b.quando.localeCompare(a.quando));

  return {
    id: det.id,
    familia: det.serviceFamily,
    status: cab.status,
    empresa: cab.empresa_id ? cab.empresa : null,
    empresaId: cab.empresa_id,
    servico: det.servico,
    responsavel: det.responsavel?.nome ?? null,
    inicio: dia(cab.started_at),
    prazo: dia(det.prazo),
    prazoEstimado: det.prazoEstimado,
    concluidoEm: dia(cab.completed_at),
    publicToken: cab.public_token,
    oportunidadeId: cab.oportunidade_id,
    leadId: cab.lead_id,
    contato: cab.nome
      ? { nome: cab.nome, cargo: cab.cargo, telefone: cab.telefone, email: cab.email, whatsapp: cab.whatsapp }
      : null,
    grupos: [...porChave.values()],
    eventos,
    arquivos: arquivos.map((a) => ({ id: a.id, nome: a.nome, tamanhoBytes: Number(a.tamanho), quando: new Date(a.criado_em).toISOString(), autor: a.autor, url: "/api/arquivos/" + a.id })),
    bloqueio: (() => {
      const b = itens.filter((i) => i.status === "BLOCKED");
      if (!b.length) return null;
      const t = b[0];
      return {
        kind: /client/i.test(t.blocker_type ?? "") ? "cliente" as const : "externo" as const,
        texto: t.blocker_reason?.trim() || t.titulo,
        desde: t.blocked_at ? new Date(t.blocked_at).toISOString() : null,
        itemIds: b.map((i) => i.id),
      };
    })(),
    formulario: form
      ? {
          status: form.status,
          linhas: Number(contagem?.linhas ?? 0),
          operadoras: contagem?.operadoras ?? null,
          ramais: Number(contagem?.ramais ?? 0),
          opcoesUra: Number(form.opcoes_ura),
          dominio: form.dominio,
        }
      : null,
  };
}
