/**
 * Leituras compartilhadas pelo projeto e pelo board. Cada decisão de FONTE está aqui, uma vez
 * (medida em produção em 09/11/2026; ver o relatório da entrega):
 *
 *   família   -> servicos_canonicos.service_family  (negocios.service_family: 10 de 1.803)
 *   empresa   -> servico.empresa_id, com reserva no lead e na oportunidade (4 dos 74 projetos têm
 *                serviço sem empresa), e sempre a CANÔNICA (canonical_empresa_id IS NULL)
 *   pessoas   -> união pessoas.empresa_id + vínculo ativo, sem lead mesclado (pessoaDaEmpresa / pessoaNaoMesclada)
 *   tarefas   -> chave_idempotencia `ONBOARDING:{projeto}:{passo}`; projeto legado cai nas tarefas de
 *                origem ONBOARDING/IMPLANTACAO do serviço principal
 */
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { pessoaDaEmpresa } from "@/lib/vendas/pessoa-da-empresa";
import { pessoaNaoMesclada } from "@/lib/vendas/lead-mesclado";
import { nomeCompleto, nomeEmpresaExibivel } from "@/lib/vendas/texto";
import type { Familia, Pessoa, TipoDeProjeto, Usuario } from "./contrato";
import { familiaValida, iniciaisDe } from "./regras";

export interface LinhaBase {
  id: string;
  tipo: TipoDeProjeto;
  status: string;
  ciclo: number;
  familia: Familia;
  servicoId: string;
  oportunidadeId: string | null;
  anteriorId: string | null;
  etapasHerdadas: unknown;
  snapshot: unknown;
  publicToken: string;
  entrouEm: string;
  concluidoEm: string | null;
  dueAt: string | null;
  targetAt: string | null;
  responsavel: Usuario | null;
  vendedor: Usuario | null;
  empresa: { id: string; nome: string; documento: string | null; resolvida: boolean };
}

type Crua = {
  id: string; tipo: string | null; status: string; cycle_number: number; familia: string | null; servico_id: string;
  oportunidade_id: string | null; anterior_id: string | null; etapas_herdadas: unknown; snapshot: unknown; public_token: string;
  entrou_em: string; concluido_em: string | null; due_at: string | null; target_at: string | null;
  resp_id: string | null; resp_nome: string | null; resp_email: string | null;
  vend_id: string | null; vend_nome: string | null; vend_email: string | null;
  empresa_id: string | null; empresa_nome: string | null; empresa_cnpj: string | null; lead_empresa: string | null;
};

const usuario = (id: string | null, nome: string | null, email: string | null): Usuario | null =>
  id ? { id, nome: nome ?? "Sem nome", email, iniciais: iniciaisDe(nome) } : null;

/**
 * Os projetos da organização (todos, ou só `ids`). Linha cuja família não é uma das três do contrato
 * (ASSISTANT, UNKNOWN) é descartada: o contrato não tem como representá-la.
 */
export async function linhasBase(organizacaoId: string, ids?: string[]): Promise<LinhaBase[]> {
  const filtro: SQL = ids
    ? sql`AND f.id IN (${sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `)})`
    : sql``;
  const linhas = await db.execute<Crua>(sql`
    SELECT f.id::text, f.tipo, f.status, f.cycle_number, COALESCE(sc.service_family, f.service_family) AS familia,
           f.servico_canonico_id::text AS servico_id, f.oportunidade_id::text, f.fulfillment_anterior_id::text AS anterior_id,
           f.etapas_herdadas, f.escopo_vendido_snapshot AS snapshot, f.public_token::text,
           to_json(COALESCE(f.started_at, f.created_at))#>>'{}' AS entrou_em,
           to_json(f.completed_at)#>>'{}' AS concluido_em, to_json(f.due_at)#>>'{}' AS due_at, to_json(f.target_at)#>>'{}' AS target_at,
           ru.id::text AS resp_id, ru.nome AS resp_nome, ru.email AS resp_email,
           vu.id::text AS vend_id, vu.nome AS vend_nome, vu.email AS vend_email,
           ec.id::text AS empresa_id, ec.nome AS empresa_nome, ec.cnpj AS empresa_cnpj, l.empresa AS lead_empresa
      FROM fulfillments f
      JOIN servicos_canonicos sc ON sc.id = f.servico_canonico_id
      LEFT JOIN oportunidades op ON op.id = f.oportunidade_id
      LEFT JOIN leads l ON l.id = sc.lead_id
      LEFT JOIN empresas e ON e.id = COALESCE(sc.empresa_id, l.empresa_id, op.empresa_id)
      LEFT JOIN empresas ec ON ec.id = COALESCE(e.canonical_empresa_id, e.id)
      LEFT JOIN usuarios ru ON ru.id = f.responsavel_id AND ru.organizacao_id = f.organizacao_id
      LEFT JOIN usuarios vu ON vu.id = op.responsavel_id AND vu.organizacao_id = f.organizacao_id
     WHERE f.organizacao_id = ${organizacaoId}::uuid ${filtro}
     ORDER BY f.created_at DESC`);

  return linhas.flatMap((c) => {
    const familia = familiaValida(c.familia);
    if (!familia) return [];
    const tipo: TipoDeProjeto = c.tipo === "IMPLEMENTATION" ? "IMPLEMENTATION" : "ONBOARDING";
    return [{
      id: c.id, tipo, status: c.status, ciclo: c.cycle_number, familia, servicoId: c.servico_id,
      oportunidadeId: c.oportunidade_id, anteriorId: c.anterior_id, etapasHerdadas: c.etapas_herdadas, snapshot: c.snapshot,
      publicToken: c.public_token, entrouEm: c.entrou_em, concluidoEm: c.concluido_em, dueAt: c.due_at, targetAt: c.target_at,
      responsavel: usuario(c.resp_id, c.resp_nome, c.resp_email), vendedor: usuario(c.vend_id, c.vend_nome, c.vend_email),
      // Sem empresa em lugar nenhum (1 dos 74): id vazio e o nome que o lead tiver. A tela NÃO deve linkar quando id === "".
      empresa: c.empresa_id
        ? { id: c.empresa_id, nome: nomeEmpresaExibivel(c.empresa_nome), documento: c.empresa_cnpj, resolvida: true }
        : { id: "", nome: c.lead_empresa?.trim() || "Empresa não identificada", documento: null, resolvida: false },
    }];
  });
}

/**
 * Pessoas por empresa: UNIÃO dos dois caminhos, sem mesclado. Inclui as empresas duplicadas do grupo
 * canônico. Uma consulta para todas as empresas (o board).
 */
export async function pessoasDasEmpresas(organizacaoId: string, empresaIds: string[]): Promise<Map<string, Pessoa[]>> {
  const mapa = new Map<string, Pessoa[]>();
  const ids = [...new Set(empresaIds.filter(Boolean))];
  if (ids.length === 0) return mapa;
  const lista = sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `);
  const linhas = await db.execute<{ empresa_id: string; id: string; nome: string; sobrenome: string | null; email: string | null; telefone: string | null; cargo: string | null; tem_ficha: boolean }>(sql`
    SELECT DISTINCT x.id::text AS empresa_id, p.id::text, p.nome, p.sobrenome, p.email, p.telefone, p.cargo,
           -- A porta da ficha resolve a pessoa pelo lead e faz notFound() sem ele.
           -- Sem lead o nome não vira link, em vez de virar um link para 404.
           (p.lead_id_legado IS NOT NULL) AS tem_ficha
      FROM empresas x
      JOIN empresas d ON d.id = x.id OR d.canonical_empresa_id = x.id
      JOIN pessoas p ON ${pessoaDaEmpresa("p", sql`d.id`)}
     WHERE x.organizacao_id = ${organizacaoId}::uuid AND x.id IN (${lista})
       AND p.organizacao_id = ${organizacaoId}::uuid AND ${pessoaNaoMesclada("p")}
     ORDER BY 1, 3, 2`);
  for (const l of linhas) {
    const nome = nomeCompleto(l.nome, l.sobrenome) || "Sem nome";
    const arr = mapa.get(l.empresa_id) ?? [];
    arr.push({
      id: l.id, nome, email: l.email, telefone: l.telefone, cargo: l.cargo, iniciais: iniciaisDe(nome),
      // A PORTA `/contatos/pessoas/:id`, com o id da pessoa canônica: é ela que
      // sabe chegar na ficha. Montar `/pessoas/:leadId` aqui duplicaria a regra.
      fichaHref: l.tem_ficha ? `/contatos/pessoas/${l.id}` : null,
    });
    mapa.set(l.empresa_id, arr);
  }
  return mapa;
}
