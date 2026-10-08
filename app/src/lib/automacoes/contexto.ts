/**
 * Contexto de execução dos Fluxos (docs/produto/automacoes-fluxos.md §3.5 e §4.1).
 *
 * Duas coisas moram aqui:
 *
 * 1. `origemAutomacao`: o carimbo de "isto está rodando dentro de um nó de
 *    automação". O executor roda cada nó dentro de `origemAutomacao.run`, e
 *    quem publica evento (outbox e ponte canônica) lê a store e grava
 *    `payload._automacao`. Sem isso, uma automação que põe tag dispararia a
 *    automação que escuta "tag adicionada", que poderia pôr outra tag, e assim
 *    por diante — o laço que o gatilho de evento precisa conseguir enxergar.
 *
 * 2. `hidratarContexto`: o retrato do registro que alimenta {{ expressões }} e
 *    regras. Relido do banco a CADA retomada (mesmo princípio do hidratarVars
 *    do cadence-engine): decisão tomada depois de uma espera de três dias usa o
 *    estado de agora, não o de quando a execução começou.
 *
 * Este arquivo é importado por `events/outbox.ts`; por isso não importa o
 * executor nem os adapters (evita ciclo de import).
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { TipoEntidade } from "./grafo";

export interface OrigemAutomacao { automacaoId: string; execucaoId: string; profundidade: number }

export const origemAutomacao = new AsyncLocalStorage<OrigemAutomacao>();

/** Payload com o carimbo da automação que está rodando agora (ou o mesmo payload, fora de automação). */
export function carimbarPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const origem = origemAutomacao.getStore();
  return origem ? { ...payload, _automacao: origem } : payload;
}

export interface EstadoExecucao {
  gatilho: Record<string, unknown>;
  vars: Record<string, unknown>;
  nos: Record<string, Record<string, unknown>>;
  tentativas: Record<string, number>;
}

export const estadoVazio = (gatilho: Record<string, unknown> = {}): EstadoExecucao => ({ gatilho, vars: {}, nos: {}, tentativas: {} });

export interface EntidadeRef { tipo: TipoEntidade; id: string }

type Linha = Record<string, unknown>;

async function uma(query: ReturnType<typeof sql>): Promise<Linha | null> {
  const rows = (await db.execute(query)) as unknown as Linha[];
  return rows[0] ?? null;
}

const texto = (v: unknown) => (v === null || v === undefined ? null : String(v));

/**
 * Registro + vínculos (lead, negócio, contato, empresa). Toda leitura filtra
 * `organizacao_id`: o id da entidade vem de evento, webhook ou pedido da tela,
 * e nenhum deles é prova de que o registro é desta organização.
 *
 * Devolve `null` em `registro` quando a entidade não existe nesta organização
 * — quem chama decide se isso é erro (rodar/webhook) ou silêncio (evento).
 */
export async function hidratarContexto(
  organizacaoId: string,
  entidade: EntidadeRef | null,
  estado: EstadoExecucao,
): Promise<Record<string, unknown>> {
  const agora = new Date();
  const base: Record<string, unknown> = {
    registro: null, lead: null, negocio: null, contato: null, empresa: null,
    gatilho: estado.gatilho, vars: estado.vars, nos: estado.nos,
    agora: agora.toISOString(),
    hoje: agora.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
  };
  if (!entidade) return base;

  // 1) O registro e os ids dos vínculos, numa consulta por tipo.
  let leadId: string | null = null;
  let negocioId: string | null = null;
  let contatoId: string | null = null;
  let empresaId: string | null = null;
  let nome: string | null = null;
  let responsavelId: string | null = null;
  const org = organizacaoId;
  const id = entidade.id;

  if (entidade.tipo === "lead") {
    const r = await uma(sql`SELECT id, nome, empresa_id, responsavel_id FROM leads WHERE id = ${id}::uuid AND organizacao_id = ${org}::uuid`);
    if (!r) return base;
    leadId = id; empresaId = texto(r.empresa_id); nome = texto(r.nome); responsavelId = texto(r.responsavel_id);
  } else if (entidade.tipo === "negocio") {
    const r = await uma(sql`SELECT titulo, lead_id, empresa_id, responsavel_id FROM negocios WHERE id = ${id}::uuid AND organizacao_id = ${org}::uuid`);
    if (!r) return base;
    negocioId = id; leadId = texto(r.lead_id); empresaId = texto(r.empresa_id); nome = texto(r.titulo); responsavelId = texto(r.responsavel_id);
  } else if (entidade.tipo === "oportunidade") {
    const r = await uma(sql`SELECT titulo, negocio_id_legado, lead_id, empresa_id, responsavel_id FROM oportunidades WHERE id = ${id}::uuid AND organizacao_id = ${org}::uuid`);
    if (!r) return base;
    negocioId = texto(r.negocio_id_legado); leadId = texto(r.lead_id); empresaId = texto(r.empresa_id); nome = texto(r.titulo); responsavelId = texto(r.responsavel_id);
  } else if (entidade.tipo === "contato") {
    const r = await uma(sql`SELECT nome, lead_id, responsavel_id FROM contatos WHERE id = ${id}::uuid AND organizacao_id = ${org}::uuid`);
    if (!r) return base;
    contatoId = id; leadId = texto(r.lead_id); nome = texto(r.nome); responsavelId = texto(r.responsavel_id);
  } else if (entidade.tipo === "empresa") {
    const r = await uma(sql`SELECT nome FROM empresas WHERE id = ${id}::uuid AND organizacao_id = ${org}::uuid`);
    if (!r) return base;
    empresaId = id; nome = texto(r.nome);
  } else if (entidade.tipo === "cliente") {
    const r = await uma(sql`SELECT c.lead_id_legado, c.empresa_id, c.responsavel_id, e.nome FROM clientes c LEFT JOIN empresas e ON e.id = c.empresa_id WHERE c.id = ${id}::uuid AND c.organizacao_id = ${org}::uuid`);
    if (!r) return base;
    leadId = texto(r.lead_id_legado); empresaId = texto(r.empresa_id); nome = texto(r.nome); responsavelId = texto(r.responsavel_id);
  } else if (entidade.tipo === "servico") {
    const r = await uma(sql`SELECT lead_id, empresa_id, canonical_product FROM servicos_canonicos WHERE id = ${id}::uuid AND organizacao_id = ${org}::uuid`);
    if (!r) return base;
    leadId = texto(r.lead_id); empresaId = texto(r.empresa_id); nome = texto(r.canonical_product);
  }

  // 2) Os vínculos, cada um com o filtro de organização.
  const [lead, negocio] = await Promise.all([
    leadId ? uma(sql`
      SELECT l.id, trim((CASE WHEN COALESCE(trim(l.sobrenome),'')='' THEN trim(l.nome) WHEN lower(trim(l.sobrenome))=lower(trim(l.nome)) OR lower(trim(l.sobrenome)) LIKE lower(trim(l.nome))||' %' THEN trim(l.sobrenome) WHEN lower(trim(l.nome)) LIKE '% '||lower(trim(l.sobrenome)) THEN trim(l.nome) ELSE trim(l.nome)||' '||trim(l.sobrenome) END)) AS nome, l.nome AS primeiro, l.email, l.telefone, l.origem,
             l.estagio_pre_vendas AS etapa, l.cargo, l.empresa_id, l.responsavel_id,
             COALESCE((SELECT array_agg(DISTINCT lb.nome) FROM labels lb
                        WHERE lb.organizacao_id = l.organizacao_id
                          AND (lb.id IN (SELECT label_id FROM lead_labels WHERE lead_id = l.id)
                               OR lb.id IN (SELECT label_id FROM entity_labels WHERE entity_type = 'lead' AND entity_id = l.id))), '{}') AS tags
        FROM leads l WHERE l.id = ${leadId}::uuid AND l.organizacao_id = ${org}::uuid`) : null,
    negocioId ? uma(sql`
      SELECT n.id, n.titulo, n.etapa, n.status, n.valor_total, n.mrr_estimado, n.temperatura, n.responsavel_id, n.campos_custom, u.nome AS responsavel_nome
        FROM negocios n LEFT JOIN usuarios u ON u.id = n.responsavel_id
       WHERE n.id = ${negocioId}::uuid AND n.organizacao_id = ${org}::uuid`) : null,
  ]);
  empresaId = empresaId ?? texto(lead?.empresa_id) ?? null;
  const empresaRow = empresaId ? await uma(sql`SELECT id, nome, cnpj, setor FROM empresas WHERE id = ${empresaId}::uuid AND organizacao_id = ${org}::uuid`) : null;

  const contatoRow = contatoId
    ? await uma(sql`SELECT id, nome, telefone, email FROM contatos WHERE id = ${contatoId}::uuid AND organizacao_id = ${org}::uuid`)
    : leadId ? await uma(sql`SELECT id, nome, telefone, email FROM contatos WHERE lead_id = ${leadId}::uuid AND organizacao_id = ${org}::uuid ORDER BY ultima_msg_at DESC NULLS LAST LIMIT 1`) : null;
  const ultima = contatoRow
    ? await uma(sql`SELECT conteudo FROM whatsapp_mensagens WHERE contato_id = ${String(contatoRow.id)}::uuid AND direcao = 'in' ORDER BY created_at DESC LIMIT 1`)
    : null;

  responsavelId = responsavelId ?? texto(lead?.responsavel_id) ?? texto(negocio?.responsavel_id);
  const responsavel = responsavelId
    ? await uma(sql`SELECT nome FROM usuarios WHERE id = ${responsavelId}::uuid AND organizacao_id = ${org}::uuid`)
    : null;

  return {
    ...base,
    registro: { tipo: entidade.tipo, id, nome, responsavel_id: responsavelId, responsavel_nome: texto(responsavel?.nome) },
    lead: lead ? {
      id: lead.id, nome: lead.nome, primeiro_nome: texto(lead.primeiro)?.split(/\s+/)[0] ?? null, email: lead.email, telefone: lead.telefone,
      origem: lead.origem, etapa: lead.etapa, cargo: lead.cargo, tags: (lead.tags as string[] | null) ?? [],
    } : null,
    negocio: negocio ? {
      id: negocio.id, titulo: negocio.titulo, etapa: negocio.etapa ?? negocio.status, status: negocio.status,
      valor: negocio.valor_total === null ? null : Number(negocio.valor_total),
      mrr: negocio.mrr_estimado === null ? null : Number(negocio.mrr_estimado),
      temperatura: negocio.temperatura, responsavel_nome: negocio.responsavel_nome, campos_custom: negocio.campos_custom ?? {},
    } : null,
    contato: contatoRow ? { id: contatoRow.id, nome: contatoRow.nome, telefone: contatoRow.telefone, email: contatoRow.email, ultima_mensagem: texto(ultima?.conteudo) } : null,
    empresa: empresaRow ? { id: empresaRow.id, nome: empresaRow.nome, cnpj: empresaRow.cnpj, setor: empresaRow.setor } : null,
  };
}
