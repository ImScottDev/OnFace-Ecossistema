"use server";

import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/auth/tenant";
import { atorHumano, RegraDeNegocio, type Familia, type PapelPessoa } from "@/lib/vendas/dominio";
import { executar, type Resultado } from "@/lib/vendas/resultado";
import type { ExecutorDb } from "@/lib/vendas/executor";
import { resolverEmpresa, resolverPessoa, vincularPessoaEmpresa } from "@/lib/vendas/identidade";
import { criarLead } from "@/lib/vendas/pre-vendas";
import { criarOportunidade } from "@/lib/vendas/pipeline";
import { salvarDadosJuridicos, conferirDadosJuridicos, type DadosJuridicos } from "@/lib/vendas/propostas";
import { empresa360, type Empresa360 } from "@/lib/vendas/consultas";
import { lerLinhaDoTempo, registrarEvento, type LinhaDoTempo } from "@/lib/vendas/eventos";

const ROTA = "/contatos";

async function contexto() {
  const ctx = await getTenantContext();
  if (!ctx) return null;
  return { organizacaoId: ctx.organizacaoId, ator: atorHumano(ctx.userId) };
}

/** Bloco 05 §15: criar Empresa NÃO cria Lead. São ações explícitas e separadas. */
export async function acaoCriarEmpresa(entrada: {
  nome: string; cnpj?: string | null; website?: string | null;
  setor?: string | null; cidade?: string | null; estado?: string | null;
}): Promise<Resultado<{ empresaId: string; jaExistia: boolean; resolvidaPor: string | null }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  if (!entrada.nome?.trim()) return { ok: false, erro: "A empresa precisa de um nome." };

  return executar("criar empresa", async () => {
    const r = await resolverEmpresa(ctx.organizacaoId, {
      nome: entrada.nome.trim(), cnpj: entrada.cnpj ?? null, website: entrada.website ?? null,
      setor: entrada.setor ?? null, cidade: entrada.cidade ?? null, estado: entrada.estado ?? null,
    }, ctx.ator);
    revalidatePath(ROTA);
    return { empresaId: r.empresaId, jaExistia: !r.criada, resolvidaPor: r.resolvidaPor };
  });
}

/** Bloco 05 §3 e §14: Pessoa pode existir sem Empresa, e criar Pessoa não cria Lead. */
export async function acaoCriarPessoa(entrada: {
  nome: string; sobrenome?: string | null; cargo?: string | null;
  email?: string | null; telefone?: string | null; whatsapp?: string | null;
  empresaId?: string | null; papel?: PapelPessoa;
}): Promise<Resultado<{ pessoaId: string; jaExistia: boolean }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  if (!entrada.nome?.trim()) return { ok: false, erro: "A pessoa precisa de um nome." };

  return executar("criar pessoa", async () => {
    const r = await resolverPessoa(ctx.organizacaoId, {
      nome: entrada.nome.trim(), sobrenome: entrada.sobrenome ?? null, cargo: entrada.cargo ?? null,
      email: entrada.email ?? null, telefone: entrada.telefone ?? null, whatsapp: entrada.whatsapp ?? null,
      empresaId: entrada.empresaId ?? null,
    }, ctx.ator);
    if (entrada.empresaId) {
      await vincularPessoaEmpresa({
        organizacaoId: ctx.organizacaoId, pessoaId: r.pessoaId, empresaId: entrada.empresaId,
        papel: entrada.papel ?? "contato_principal", principal: (entrada.papel ?? "contato_principal") === "contato_principal",
        ator: ctx.ator,
      });
    }
    revalidatePath(ROTA);
    return { pessoaId: r.pessoaId, jaExistia: !r.criada };
  });
}

/**
 * Associa a pessoa a uma empresa.
 *
 * `encerrarAnteriores` é a troca de emprego (Bloco 05 §12): o vínculo antigo é
 * encerrado com data, não apagado.
 */
export async function acaoVincularPessoa(entrada: {
  pessoaId: string; empresaId: string; papel: PapelPessoa; principal: boolean; trocaDeEmpresa: boolean;
}): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("vincular pessoa", async () => {
    await vincularPessoaEmpresa({
      organizacaoId: ctx.organizacaoId, pessoaId: entrada.pessoaId, empresaId: entrada.empresaId,
      papel: entrada.papel, principal: entrada.principal,
      encerrarAnteriores: entrada.trocaDeEmpresa, ator: ctx.ator,
    });
    revalidatePath(ROTA);
  });
}

/** Ação explícita: abrir Pré-vendas para uma empresa do diretório. */
export async function acaoCriarLeadDaEmpresa(entrada: {
  empresaId: string; pessoaNome: string; cargo?: string | null;
  email?: string | null; telefone?: string | null; responsavelId?: string | null;
}): Promise<Resultado<{ leadId: string }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  if (!entrada.pessoaNome?.trim()) return { ok: false, erro: "Informe o contato do lead." };

  return executar("criar lead da empresa", async () => {
    const [empresa] = await db.execute<{ nome: string; cnpj: string | null; website: string | null }>(sql`
      SELECT nome, cnpj, website FROM empresas
       WHERE id = ${entrada.empresaId}::uuid AND organizacao_id = ${ctx.organizacaoId}::uuid
    `);
    if (!empresa) throw new Error("empresa não encontrada");

    const [primeiro, ...resto] = entrada.pessoaNome.trim().split(/\s+/);
    const criado = await criarLead({
      organizacaoId: ctx.organizacaoId,
      empresa: { nome: empresa.nome, cnpj: empresa.cnpj, website: empresa.website },
      pessoa: {
        nome: primeiro, sobrenome: resto.length ? resto.join(" ") : null,
        cargo: entrada.cargo ?? null, email: entrada.email ?? null, telefone: entrada.telefone ?? null,
      },
      touchpoint: { tipoOrigem: "manual", source: "diretorio" },
      origem: "Diretório",
      responsavelId: entrada.responsavelId ?? null,
    }, ctx.ator);
    revalidatePath(ROTA);
    revalidatePath("/pre-vendas");
    return { leadId: criado.leadId };
  });
}

/** Nova oportunidade a partir da empresa. Vira EXPANSION quando ela já é cliente. */
export async function acaoNovaOportunidade(entrada: {
  empresaId: string; familias: Familia[]; responsavelId: string; expansao: boolean;
}): Promise<Resultado<{ ids: string[] }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("criar oportunidade", async () => {
    const r = await criarOportunidade({
      organizacaoId: ctx.organizacaoId,
      empresaId: entrada.empresaId,
      familias: entrada.familias,
      responsavelId: entrada.responsavelId,
      sourceProcess: entrada.expansao ? "EXPANSION" : "MANUAL",
      motion: entrada.expansao ? "EXPANSION" : "NEW_BUSINESS",
    }, ctx.ator);
    revalidatePath(ROTA);
    revalidatePath("/pipeline");
    return { ids: r.oportunidades.map((o) => o.id) };
  });
}

/** Bloco 03 §17 e Bloco 05 §9: os dados jurídicos vivem na Empresa. */
export async function acaoSalvarDadosJuridicos(empresaId: string, dados: DadosJuridicos): Promise<Resultado<{ completo: boolean; faltando: string[] }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("salvar dados jurídicos", async () => {
    await salvarDadosJuridicos({ organizacaoId: ctx.organizacaoId, empresaId, dados, ator: ctx.ator });
    revalidatePath(ROTA);
    return conferirDadosJuridicos(ctx.organizacaoId, empresaId);
  });
}

export async function acaoEmpresa360(empresaId: string): Promise<Resultado<{ empresa: Empresa360 | null; timeline: LinhaDoTempo[] }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("carregar empresa", async () => {
    const [empresa, timeline] = await Promise.all([
      empresa360(ctx.organizacaoId, empresaId),
      lerLinhaDoTempo({ organizacaoId: ctx.organizacaoId, empresaId, limite: 40 }),
    ]);
    return { empresa, timeline };
  });
}

export async function acaoBuscarEmpresas(termo: string): Promise<Array<{ id: string; nome: string; apoio: string | null }>> {
  const ctx = await getTenantContext();
  if (!ctx || termo.trim().length < 2) return [];
  const linhas = await db.execute<{ id: string; nome: string; apoio: string | null }>(sql`
    SELECT id::text, nome, NULLIF(concat_ws(' · ', cnpj, cidade), '') AS apoio
      FROM empresas
     WHERE organizacao_id = ${ctx.organizacaoId}::uuid
       AND lower(nome) LIKE ${`%${termo.trim().toLowerCase()}%`}
     ORDER BY nome LIMIT 12
  `);
  return linhas.map((l) => ({ id: l.id, nome: l.nome, apoio: l.apoio }));
}

export type VinculoBuscado = {
  tipo: "pessoa" | "empresa" | "opp"; id: string; rotulo: string; apoio: string | null;
  leadId: string | null; empresaId: string | null; negocioId: string | null;
  pessoaNome: string | null; empresaNome: string | null;
};

/** Busca única de vínculo (pessoa, empresa, oportunidade) para o modal de atividade. */
export async function acaoBuscarVinculos(termo: string): Promise<VinculoBuscado[]> {
  const ctx = await getTenantContext();
  const t = termo.trim().toLowerCase();
  if (!ctx || t.length < 2) return [];
  const like = `%${t}%`;
  const org = ctx.organizacaoId;
  const [pessoas, empresas, opps] = await Promise.all([
    db.execute<any>(sql`
      SELECT l.id::text, (CASE WHEN COALESCE(trim(l.sobrenome),'')='' THEN trim(l.nome) WHEN lower(trim(l.sobrenome))=lower(trim(l.nome)) OR lower(trim(l.sobrenome)) LIKE lower(trim(l.nome))||' %' THEN trim(l.sobrenome) WHEN lower(trim(l.nome)) LIKE '% '||lower(trim(l.sobrenome)) THEN trim(l.nome) ELSE trim(l.nome)||' '||trim(l.sobrenome) END) AS nome, l.empresa_id::text, COALESCE(e.nome, l.empresa) AS empresa
        FROM leads l LEFT JOIN empresas e ON e.id = l.empresa_id
       WHERE l.organizacao_id = ${org}::uuid
         AND (lower(concat_ws(' ', l.nome, l.sobrenome)) LIKE ${like} OR lower(coalesce(l.email,'')) LIKE ${like})
       ORDER BY l.created_at DESC LIMIT 6`),
    db.execute<any>(sql`
      SELECT id::text, nome, NULLIF(concat_ws(' · ', cnpj, cidade), '') AS apoio
        FROM empresas WHERE organizacao_id = ${org}::uuid AND lower(nome) LIKE ${like} ORDER BY nome LIMIT 6`),
    db.execute<any>(sql`
      SELECT n.id::text, n.titulo, n.lead_id::text, n.empresa_id::text, e.nome AS empresa,
             (CASE WHEN COALESCE(trim(l.sobrenome),'')='' THEN trim(l.nome) WHEN lower(trim(l.sobrenome))=lower(trim(l.nome)) OR lower(trim(l.sobrenome)) LIKE lower(trim(l.nome))||' %' THEN trim(l.sobrenome) WHEN lower(trim(l.nome)) LIKE '% '||lower(trim(l.sobrenome)) THEN trim(l.nome) ELSE trim(l.nome)||' '||trim(l.sobrenome) END) AS pessoa
        FROM negocios n LEFT JOIN empresas e ON e.id = n.empresa_id LEFT JOIN leads l ON l.id = n.lead_id
       WHERE n.organizacao_id = ${org}::uuid AND lower(n.titulo) LIKE ${like}
       ORDER BY n.created_at DESC LIMIT 6`),
  ]);
  return [
    ...pessoas.map((l: any): VinculoBuscado => ({ tipo: "pessoa", id: l.id, rotulo: l.nome, apoio: l.empresa ?? null, leadId: l.id, empresaId: l.empresa_id, negocioId: null, pessoaNome: l.nome, empresaNome: l.empresa ?? null })),
    ...empresas.map((e: any): VinculoBuscado => ({ tipo: "empresa", id: e.id, rotulo: e.nome, apoio: e.apoio, leadId: null, empresaId: e.id, negocioId: null, pessoaNome: null, empresaNome: e.nome })),
    ...opps.map((o: any): VinculoBuscado => ({ tipo: "opp", id: o.id, rotulo: o.titulo, apoio: o.empresa ?? null, leadId: o.lead_id, empresaId: o.empresa_id, negocioId: o.id, pessoaNome: o.pessoa || null, empresaNome: o.empresa ?? null })),
  ];
}

export async function acaoResponsaveis(): Promise<Array<{ id: string; nome: string }>> {
  const ctx = await getTenantContext();
  if (!ctx) return [];
  const linhas = await db.execute<{ id: string; nome: string }>(sql`
    SELECT id::text, nome FROM usuarios
     WHERE organizacao_id = ${ctx.organizacaoId}::uuid AND ativo = true ORDER BY nome
  `);
  return linhas.map((l) => ({ id: l.id, nome: l.nome }));
}


/* ═══ Ações das fichas de Pessoa e de Empresa ═══════════════════════════════
 *
 * Cada uma existe porque o botão da ficha só gravava num store local da tela e
 * avisava. Tenant e ator vêm do servidor; nenhuma aceita `organizacaoId`.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function leadDaOrg(organizacaoId: string, leadId: string) {
  if (!UUID.test(leadId)) throw new RegraDeNegocio("lead_invalido", "Contato não encontrado.");
  const [l] = await db.execute<{ id: string; nome: string; empresa_id: string | null; pessoa_id: string | null }>(sql`
    SELECT l.id::text, (CASE WHEN COALESCE(trim(l.sobrenome),'')='' THEN trim(l.nome) WHEN lower(trim(l.sobrenome))=lower(trim(l.nome)) OR lower(trim(l.sobrenome)) LIKE lower(trim(l.nome))||' %' THEN trim(l.sobrenome) WHEN lower(trim(l.nome)) LIKE '% '||lower(trim(l.sobrenome)) THEN trim(l.nome) ELSE trim(l.nome)||' '||trim(l.sobrenome) END) AS nome, l.empresa_id::text,
           (SELECT p.id::text FROM pessoas p WHERE p.lead_id_legado = l.id LIMIT 1) AS pessoa_id
      FROM leads l WHERE l.id = ${leadId}::uuid AND l.organizacao_id = ${organizacaoId}::uuid`);
  if (!l) throw new RegraDeNegocio("lead_inexistente", "Contato não encontrado.");
  return l;
}

/** Pausa ou retoma a cadência viva do contato. Mesma mecânica da rota de cadências. */
export async function acaoPausarCadenciaDoLead(leadId: string, pausar: boolean): Promise<Resultado<null>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("pausar cadência", async () => {
    await leadDaOrg(ctx.organizacaoId, leadId);
    const vivas = await db.execute<{ id: string; passo: string | null }>(sql`
      SELECT id::text, current_step_id AS passo FROM cadence_enrollments
       WHERE organizacao_id = ${ctx.organizacaoId}::uuid AND entity_type = 'lead' AND entity_id = ${leadId}::uuid
         AND status = ANY(${pausar ? sql`ARRAY['active','waiting','waiting_reply']` : sql`ARRAY['paused']`}::text[])`);
    if (!vivas.length) {
      throw new RegraDeNegocio("sem_cadencia", pausar ? "Este contato não está numa cadência ativa." : "Não há cadência pausada para retomar.");
    }
    for (const v of vivas) {
      if (pausar) {
        await db.execute(sql`UPDATE cadence_enrollments SET status = 'paused', scheduled_at = NULL, next_eval_at = NULL,
            claimed_until = NULL, updated_at = now() WHERE id = ${v.id}::uuid`);
      } else {
        await db.execute(sql`UPDATE cadence_enrollments SET status = 'active', scheduled_at = now(), next_eval_at = now(),
            claimed_until = NULL, cancel_reason = NULL, updated_at = now() WHERE id = ${v.id}::uuid`);
      }
      await db.execute(sql`INSERT INTO cadence_enrollment_events (enrollment_id, step_id, status, resultado)
        VALUES (${v.id}::uuid, ${v.passo ?? "-"}, ${pausar ? "pause" : "resume"},
                ${JSON.stringify({ actorId: ctx.ator.usuarioId, origem: "ficha_pessoa" })}::jsonb)`);
    }
    revalidatePath("/pessoas/" + leadId);
    return null;
  });
}

const PAPEL_POR_TEXTO: Array<[RegExp, PapelPessoa]> = [
  [/decisor|diretor|ceo|s[oó]cio|propriet/i, "decisor"], [/influenc/i, "influenciador"],
  [/financ/i, "financeiro"], [/t[eé]cnic|ti\b/i, "tecnico"], [/usu[aá]rio/i, "usuario"],
];

/**
 * Vincula o contato a OUTRA empresa (a principal continua a do lead). A empresa
 * passa por `resolverEmpresa`: nome, CNPJ ou domínio que já existem reaproveitam
 * a mesma empresa em vez de criar duplicata.
 */
export async function acaoVincularEmpresaExtra(leadId: string, d: {
  nome: string; cnpj?: string | null; segmento?: string | null; site?: string | null; papel?: string | null;
}): Promise<Resultado<{ empresaId: string; jaExistia: boolean }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  if (!d.nome?.trim()) return { ok: false, erro: "Informe o nome da empresa." };
  return executar("vincular empresa", async () => {
    const lead = await leadDaOrg(ctx.organizacaoId, leadId);
    if (!lead.pessoa_id) throw new RegraDeNegocio("sem_pessoa", "Este contato ainda não tem cadastro de pessoa para vincular.");
    const e = await resolverEmpresa(ctx.organizacaoId, {
      nome: d.nome.trim(), cnpj: d.cnpj?.trim() || null, website: d.site?.trim() || null, setor: d.segmento?.trim() || null,
    }, ctx.ator);
    if (e.empresaId === lead.empresa_id) throw new RegraDeNegocio("empresa_principal", "Esta já é a empresa principal do contato.");
    const texto = d.papel?.trim() ?? "";
    await vincularPessoaEmpresa({
      organizacaoId: ctx.organizacaoId, pessoaId: lead.pessoa_id, empresaId: e.empresaId,
      papel: PAPEL_POR_TEXTO.find(([re]) => re.test(texto))?.[1] ?? "outro", principal: false, ator: ctx.ator,
    });
    if (texto) {
      await db.execute(sql`UPDATE pessoa_empresa_vinculos SET cargo = ${texto}, updated_at = now()
        WHERE pessoa_id = ${lead.pessoa_id}::uuid AND empresa_id = ${e.empresaId}::uuid AND encerrado_em IS NULL`);
    }
    revalidatePath("/pessoas/" + leadId);
    revalidatePath("/empresas/" + e.empresaId);
    return { empresaId: e.empresaId, jaExistia: !e.criada };
  });
}

/** Desfaz o vínculo com uma empresa extra. Encerra com data (o passado fica), como a troca de emprego. */
export async function acaoDesvincularEmpresaExtra(leadId: string, empresaId: string): Promise<Resultado<null>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("desvincular empresa", async () => {
    const lead = await leadDaOrg(ctx.organizacaoId, leadId);
    if (!lead.pessoa_id || !UUID.test(empresaId)) throw new RegraDeNegocio("vinculo_inexistente", "Vínculo não encontrado.");
    if (empresaId === lead.empresa_id) throw new RegraDeNegocio("empresa_principal", "A empresa principal não se desvincula aqui. Troque pelo cadastro do contato.");
    const r = await db.execute<{ id: string }>(sql`
      UPDATE pessoa_empresa_vinculos SET encerrado_em = now(), updated_at = now()
       WHERE pessoa_id = ${lead.pessoa_id}::uuid AND empresa_id = ${empresaId}::uuid AND encerrado_em IS NULL
         AND organizacao_id = ${ctx.organizacaoId}::uuid RETURNING id::text`);
    if (!r.length) throw new RegraDeNegocio("vinculo_inexistente", "Vínculo não encontrado.");
    await registrarEvento({
      organizacaoId: ctx.organizacaoId, tipo: "PersonUnlinkedFromCompany", ator: ctx.ator,
      pessoaId: lead.pessoa_id, empresaId, leadId, contexto: { origem: "ficha_pessoa" },
    });
    revalidatePath("/pessoas/" + leadId);
    revalidatePath("/empresas/" + empresaId);
    return null;
  });
}

/** Tabelas com histórico comercial ou financeiro: quem as tem não se apaga, se desqualifica. */
const COMERCIAL_DO_LEAD: Array<[string, string, string]> = [
  ["negocios", "lead_id", "oportunidade"], ["oportunidades", "lead_id", "oportunidade"], ["propostas", "lead_id", "proposta"],
  ["contratos", "lead_id", "contrato"], ["faturas", "lead_id", "fatura"], ["assinaturas", "lead_id", "assinatura"],
  ["clientes", "lead_id_legado", "cadastro de cliente"], ["mrr_movimentos", "lead_id", "movimento de receita"],
  ["nps_respostas", "lead_id", "resposta de NPS"], ["oportunidade_bundle", "lead_id", "pacote comercial"],
  ["negocio_leads", "lead_id", "oportunidade"], ["reunioes", "lead_id", "reunião"],
];
/** O que é conversa e rastro do contato: sai junto com ele. */
const RASTRO_DO_LEAD: Array<[string, string]> = [
  ["atividades", "lead_id"], ["tarefas", "lead_id"], ["notas", "lead_id"], ["ligacoes", "lead_id"], ["emails", "lead_id"],
  ["whatsapp_mensagens", "lead_id"], ["eventos", "lead_id"], ["status_changes", "lead_id"], ["cadencia_execucoes", "lead_id"],
  ["email_sequencia_execucoes", "lead_id"], ["contatos", "lead_id"], ["ai_agent_runs", "lead_id"], ["pontos_contato", "lead_id_legado"],
];

async function apagarLead(tx: ExecutorDb, organizacaoId: string, leadId: string) {
  const alvo = sql.raw(`'${leadId}'::uuid`); // leadId já validado como uuid
  const bloqueios: string[] = [];
  for (const [tabela, coluna, rotulo] of COMERCIAL_DO_LEAD) {
    const [{ n }] = await tx.execute<{ n: number }>(sql.raw(`SELECT count(*)::int AS n FROM ${tabela} WHERE ${coluna} = '${leadId}'::uuid`));
    if (n > 0) bloqueios.push(`${n} ${rotulo}${n > 1 && !/ão$/.test(rotulo) ? "s" : n > 1 ? "s" : ""}`);
  }
  if (bloqueios.length) {
    throw new RegraDeNegocio("tem_historico", `Este contato tem histórico comercial (${[...new Set(bloqueios)].join(", ")}) e não pode ser excluído. Desqualifique em Pré-vendas para tirá-lo da operação.`);
  }
  await tx.execute(sql`DELETE FROM cadence_enrollments WHERE entity_type = 'lead' AND entity_id = ${alvo} AND organizacao_id = ${organizacaoId}::uuid`);
  for (const [tabela, coluna] of RASTRO_DO_LEAD) {
    await tx.execute(sql.raw(`DELETE FROM ${tabela} WHERE ${coluna} = '${leadId}'::uuid`));
  }
  // A aquisição do lead (a entrada canônica que o board de Pré-vendas lê) sai com ele. Se ficasse, o card
  // continuava no board e, sem pessoa, travava a exclusão da empresa (check `ck_aquisicoes_tem_identidade`).
  await tx.execute(sql`DELETE FROM aquisicoes WHERE lead_legado_id = ${alvo} AND organizacao_id = ${organizacaoId}::uuid`);
  // A pessoa canônica espelhada: vínculos e timeline caem por cascade.
  await tx.execute(sql`DELETE FROM communications WHERE pessoa_id IN (SELECT id FROM pessoas WHERE lead_id_legado = ${alvo})`);
  await tx.execute(sql`DELETE FROM pontos_contato WHERE pessoa_id IN (SELECT id FROM pessoas WHERE lead_id_legado = ${alvo})`);
  await tx.execute(sql`DELETE FROM pessoas WHERE lead_id_legado = ${alvo} AND organizacao_id = ${organizacaoId}::uuid`);
  await tx.execute(sql`DELETE FROM leads WHERE id = ${alvo} AND organizacao_id = ${organizacaoId}::uuid`);
}

/**
 * Exclui o contato (a ficha da Pessoa). Só sem histórico comercial: com
 * oportunidade, proposta, contrato ou fatura a resposta explica e manda
 * desqualificar. O motivo e quem excluiu ficam em `audit_log`, junto de um
 * retrato do que existia.
 */
export async function acaoExcluirContato(leadId: string, motivo: string, observacao?: string): Promise<Resultado<null>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  if (!motivo?.trim() || motivo.length > 120) return { ok: false, erro: "Escolha o motivo da exclusão." };
  if (motivo === "Outro" && !observacao?.trim()) return { ok: false, erro: "Explique o motivo na observação." };
  return executar("excluir contato", async () => {
    const lead = await leadDaOrg(ctx.organizacaoId, leadId);
    const [foto] = await db.execute<Record<string, unknown>>(sql`
      SELECT nome, sobrenome, email, telefone, empresa, empresa_id::text, origem, created_at::text FROM leads WHERE id = ${leadId}::uuid`);
    await db.transaction(async (tx) => {
      await apagarLead(tx, ctx.organizacaoId, leadId);
      await tx.execute(sql`INSERT INTO audit_log (organizacao_id, actor_id, action, entity_type, entity_id, before, after, source)
        VALUES (${ctx.organizacaoId}::uuid, ${ctx.ator.usuarioId}::uuid, 'contato.excluir', 'lead', ${leadId}::uuid,
                ${JSON.stringify(foto ?? {})}::jsonb, ${JSON.stringify({ motivo, observacao: observacao?.trim() || null })}::jsonb, 'ficha_pessoa')`);
    });
    revalidatePath("/contatos");
    if (lead.empresa_id) revalidatePath("/empresas/" + lead.empresa_id);
    return null;
  });
}

/**
 * Exclui a empresa (a ficha da Empresa). `comLead` leva junto os contatos da
 * empresa (cada um com a mesma trava de histórico); sem ele, contatos e pessoas
 * continuam, só sem empresa. Empresa com cliente, oportunidade ou fatura não se apaga.
 */
export async function acaoExcluirEmpresa(empresaId: string, comLead: boolean, motivo: string, observacao?: string): Promise<Resultado<null>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  if (!UUID.test(empresaId)) return { ok: false, erro: "Empresa não encontrada." };
  if (!motivo?.trim() || motivo.length > 120) return { ok: false, erro: "Escolha o motivo da exclusão." };
  if (motivo === "Outro" && !observacao?.trim()) return { ok: false, erro: "Explique o motivo na observação." };
  return executar("excluir empresa", async () => {
    const [e] = await db.execute<Record<string, unknown>>(sql`
      SELECT nome, cnpj, dominio, setor, created_at::text FROM empresas WHERE id = ${empresaId}::uuid AND organizacao_id = ${ctx.organizacaoId}::uuid`);
    if (!e) throw new RegraDeNegocio("empresa_inexistente", "Empresa não encontrada.");
    const bloqueios: string[] = [];
    for (const [tabela, rotulo] of [["clientes", "cadastro de cliente"], ["assinaturas", "assinatura"], ["faturas", "fatura"], ["pagamentos", "pagamento"],
      ["negocios", "oportunidade"], ["oportunidades", "oportunidade"], ["oportunidade_bundle", "pacote comercial"]] as const) {
      const [{ n }] = await db.execute<{ n: number }>(sql.raw(`SELECT count(*)::int AS n FROM ${tabela} WHERE empresa_id = '${empresaId}'::uuid`));
      if (n > 0) bloqueios.push(`${n} ${rotulo}`);
    }
    if (bloqueios.length) {
      throw new RegraDeNegocio("tem_historico", `Esta empresa tem histórico comercial (${[...new Set(bloqueios)].join(", ")}) e não pode ser excluída.`);
    }
    const leadsDela = await db.execute<{ id: string }>(sql`SELECT id::text FROM leads WHERE empresa_id = ${empresaId}::uuid AND organizacao_id = ${ctx.organizacaoId}::uuid`);
    await db.transaction(async (tx) => {
      if (comLead) for (const l of leadsDela) await apagarLead(tx, ctx.organizacaoId, l.id);
      await tx.execute(sql`UPDATE leads SET empresa_id = NULL, updated_at = now() WHERE empresa_id = ${empresaId}::uuid`);
      await tx.execute(sql`UPDATE pessoas SET empresa_id = NULL, updated_at = now() WHERE empresa_id = ${empresaId}::uuid`);
      await tx.execute(sql`DELETE FROM pontos_contato WHERE empresa_id = ${empresaId}::uuid`);
      await tx.execute(sql`DELETE FROM empresas WHERE id = ${empresaId}::uuid AND organizacao_id = ${ctx.organizacaoId}::uuid`);
      await tx.execute(sql`INSERT INTO audit_log (organizacao_id, actor_id, action, entity_type, entity_id, before, after, source)
        VALUES (${ctx.organizacaoId}::uuid, ${ctx.ator.usuarioId}::uuid, 'empresa.excluir', 'empresa', ${empresaId}::uuid,
                ${JSON.stringify(e)}::jsonb, ${JSON.stringify({ motivo, observacao: observacao?.trim() || null, comLead, contatos: leadsDela.length })}::jsonb, 'ficha_empresa')`);
    });
    revalidatePath("/contatos");
    return null;
  });
}

/** Adiciona uma pessoa à empresa (aba Pessoas). Reaproveita quem já existe (e-mail/telefone) e vincula. */
export async function acaoAdicionarPessoaNaEmpresa(empresaId: string, d: {
  nome: string; cargo?: string; email?: string; telefone?: string;
}): Promise<Resultado<{ pessoaId: string; jaExistia: boolean }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  const nome = d.nome?.trim();
  if (!nome) return { ok: false, erro: "Informe o nome." };
  const email = d.email?.trim().toLowerCase() || null;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, erro: "E-mail inválido." };
  return executar("adicionar pessoa", async () => {
    const [emp] = await db.execute<{ id: string }>(sql`SELECT id::text FROM empresas WHERE id = ${empresaId}::uuid AND organizacao_id = ${ctx.organizacaoId}::uuid`);
    if (!emp) throw new RegraDeNegocio("empresa_inexistente", "Empresa não encontrada.");
    const [dup] = await db.execute<{ id: string }>(sql`
      SELECT id::text FROM pessoas WHERE organizacao_id = ${ctx.organizacaoId}::uuid AND empresa_id = ${empresaId}::uuid
         AND (lower(trim(concat_ws(' ', nome, sobrenome))) = ${nome.toLowerCase()} ${email ? sql`OR lower(email) = ${email}` : sql``})`);
    if (dup) throw new RegraDeNegocio("pessoa_duplicada", `${nome} já está na empresa.`);
    const r = await resolverPessoa(ctx.organizacaoId, {
      nome, cargo: d.cargo?.trim() || null, email, telefone: d.telefone?.trim() || null, whatsapp: null, empresaId,
    }, ctx.ator);
    await vincularPessoaEmpresa({
      organizacaoId: ctx.organizacaoId, pessoaId: r.pessoaId, empresaId,
      papel: PAPEL_POR_TEXTO.find(([re]) => re.test(d.cargo ?? ""))?.[1] ?? "outro", principal: false, ator: ctx.ator,
    });
    revalidatePath("/empresas/" + empresaId);
    revalidatePath("/contatos");
    return { pessoaId: r.pessoaId, jaExistia: !r.criada };
  });
}

/**
 * Dados cadastrais da empresa, todos os campos da ficha: os de sempre mais
 * funcionários, faturamento, LinkedIn e tecnologias. CNPJ que já é de OUTRA
 * empresa é recusado (duplicata); o texto livre de funcionários guarda a faixa
 * ("320 · 201–500") e o número puro também vai para `employee_count`.
 */
export async function acaoSalvarDadosDaEmpresa(empresaId: string, c: {
  cnpj?: string; website?: string; setor?: string; telefone?: string; cidade?: string; estado?: string;
  funcionarios?: string; faturamento?: string; linkedin?: string; tecnologias?: string;
}): Promise<Resultado<null>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("salvar empresa", async () => {
    const [atual] = await db.execute<Record<string, string | number | null>>(sql`
      SELECT cnpj, website, setor, telefone, cidade, estado, linkedin, annual_revenue, employee_count,
             campos_custom->>'funcionarios' AS funcionarios, campos_custom->>'tecnologias' AS tecnologias
        FROM empresas WHERE id = ${empresaId}::uuid AND organizacao_id = ${ctx.organizacaoId}::uuid`);
    if (!atual) throw new RegraDeNegocio("empresa_inexistente", "Empresa não encontrada.");
    const t = (v: unknown) => (typeof v === "string" ? v.trim() : undefined);
    const pick = (novo: string | undefined, velho: unknown) => (novo === undefined ? (velho as string | null) : novo || null);

    const cnpj = pick(t(c.cnpj), atual.cnpj);
    const digitos = (cnpj ?? "").replace(/\D/g, "");
    if (digitos && digitos !== String(atual.cnpj ?? "").replace(/\D/g, "")) {
      const [outra] = await db.execute<{ id: string; nome: string }>(sql`
        SELECT id::text, nome FROM empresas WHERE organizacao_id = ${ctx.organizacaoId}::uuid AND id <> ${empresaId}::uuid
           AND regexp_replace(coalesce(cnpj, ''), '[^0-9]', '', 'g') = ${digitos} LIMIT 1`);
      if (outra) throw new RegraDeNegocio("cnpj_duplicado", `Este CNPJ já é de "${outra.nome}". Abra aquela empresa em vez de duplicar o cadastro.`);
    }
    const func = t(c.funcionarios), tec = t(c.tecnologias);
    const numero = func !== undefined && /^\d{1,7}$/.test(func.replace(/\./g, "")) ? Number(func.replace(/\./g, "")) : null;
    await db.execute(sql`
      UPDATE empresas SET cnpj = ${cnpj}, website = ${pick(t(c.website), atual.website)}, setor = ${pick(t(c.setor), atual.setor)},
             telefone = ${pick(t(c.telefone), atual.telefone)}, cidade = ${pick(t(c.cidade), atual.cidade)}, estado = ${pick(t(c.estado), atual.estado)},
             linkedin = ${pick(t(c.linkedin), atual.linkedin)}, annual_revenue = ${pick(t(c.faturamento), atual.annual_revenue)},
             employee_count = ${func === undefined ? atual.employee_count : numero},
             campos_custom = coalesce(campos_custom, '{}'::jsonb)
               || ${JSON.stringify({ ...(func !== undefined ? { funcionarios: func } : {}), ...(tec !== undefined ? { tecnologias: tec } : {}) })}::jsonb,
             updated_at = now()
       WHERE id = ${empresaId}::uuid AND organizacao_id = ${ctx.organizacaoId}::uuid`);
    revalidatePath("/empresas/" + empresaId);
    revalidatePath("/contatos");
    return null;
  });
}

/* ═══ Visões salvas da lista ═══════════════════════════════════════════════
 *
 * Por usuário e por tela (`visoes_salvas`, migration 0096). Sem esta tabela o
 * botão "Salvar visão" guardava só no estado da tela e a visão sumia no reload.
 */

export interface VisaoSalva { id: string; nome: string; q: string; f: unknown; aba: string; visao: string }

const doBanco = (l: { id: string; nome: string; config: any }): VisaoSalva => ({
  id: l.id, nome: l.nome, q: l.config?.q ?? "", f: l.config?.f ?? null, aba: l.config?.aba ?? "todos", visao: l.config?.visao ?? "todos",
});

export async function acaoVisoesSalvas(tela = "contatos"): Promise<VisaoSalva[]> {
  const ctx = await contexto();
  if (!ctx?.ator.usuarioId) return [];
  const linhas = await db.execute<{ id: string; nome: string; config: any }>(sql`
    SELECT id::text, nome, config FROM visoes_salvas
     WHERE organizacao_id = ${ctx.organizacaoId}::uuid AND usuario_id = ${ctx.ator.usuarioId}::uuid AND tela = ${tela}
     ORDER BY created_at`);
  return linhas.map(doBanco);
}

export async function acaoSalvarVisao(
  entrada: { nome: string; q: string; f: unknown; aba: string; visao: string }, tela = "contatos",
): Promise<Resultado<VisaoSalva>> {
  const ctx = await contexto();
  if (!ctx?.ator.usuarioId) return { ok: false, erro: "Sessão expirada." };
  const nome = entrada.nome?.trim();
  if (!nome || nome.length > 80) return { ok: false, erro: "Dê um nome de até 80 caracteres para a visão." };
  return executar("salvar visão", async () => {
    const config = { q: entrada.q ?? "", f: entrada.f ?? null, aba: entrada.aba ?? "todos", visao: entrada.visao ?? "todos" };
    const [l] = await db.execute<{ id: string; nome: string; config: any }>(sql`
      INSERT INTO visoes_salvas (organizacao_id, usuario_id, tela, nome, config)
      VALUES (${ctx.organizacaoId}::uuid, ${ctx.ator.usuarioId}::uuid, ${tela}, ${nome}, ${JSON.stringify(config)}::jsonb)
      RETURNING id::text, nome, config`);
    return doBanco(l);
  });
}

export async function acaoExcluirVisao(id: string): Promise<Resultado<null>> {
  const ctx = await contexto();
  if (!ctx?.ator.usuarioId) return { ok: false, erro: "Sessão expirada." };
  if (!UUID.test(id)) return { ok: false, erro: "Visão não encontrada." };
  return executar("excluir visão", async () => {
    await db.execute(sql`DELETE FROM visoes_salvas WHERE id = ${id}::uuid
      AND organizacao_id = ${ctx.organizacaoId}::uuid AND usuario_id = ${ctx.ator.usuarioId}::uuid`);
    return null;
  });
}
