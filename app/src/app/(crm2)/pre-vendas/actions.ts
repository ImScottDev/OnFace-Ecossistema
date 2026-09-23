"use server";

import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/auth/tenant";
import { atorHumano, type Familia, type MotivoDesqualificacao, type MotivoNutricao, type Qualificacao } from "@/lib/vendas/dominio";
import { executar, type Resultado } from "@/lib/vendas/resultado";
import { executarEmMassa, type AcaoEmMassa, type ResultadoEmMassa } from "@/lib/vendas/acoes-em-massa";
import * as preVendas from "@/lib/vendas/pre-vendas";
import { criarOportunidadeDoLead } from "@/lib/vendas/pipeline";
import { detalheLead, type DetalheLead } from "@/lib/vendas/consultas";
import { lerLinhaDoTempo, type LinhaDoTempo } from "@/lib/vendas/eventos";
import { resolverEmpresa } from "@/lib/vendas/identidade";
import { adicionarTag, removerTag } from "@/lib/crm/tags";

/* A rota oficial do produto.
 *
 * Era "/onface-preview/pre-vendas" — o caminho de onde esta tela veio em 18/09,
 * quando a implementação morava no preview. Depois da inversão, TODA escrita
 * desta página revalidava o espelho e deixava a rota real com o cache velho:
 * qualificar, nutrir e desqualificar só apareciam no `router.refresh()` do
 * cliente, e um F5 logo depois trazia o estado anterior de volta. */
const ROTA = "/pre-vendas";

/** Tenant e ator vêm SEMPRE do servidor: o cliente nunca escolhe em nome de
 *  qual organização ou de qual usuário a ação acontece. */
async function contexto() {
  const ctx = await getTenantContext();
  if (!ctx) return null;
  return { organizacaoId: ctx.organizacaoId, ator: atorHumano(ctx.userId) };
}

export async function acaoMoverEtapa(leadId: string, para: "novo" | "em_contato" | "qualificacao"): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("mover etapa", async () => {
    await preVendas.moverEtapa({ organizacaoId: ctx.organizacaoId, leadId, para, ator: ctx.ator });
    revalidatePath(ROTA);
  });
}

export async function acaoQualificar(leadId: string, qualificacao: Qualificacao): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("qualificar", async () => {
    await preVendas.qualificar({ organizacaoId: ctx.organizacaoId, leadId, qualificacao, ator: ctx.ator });
    revalidatePath(ROTA);
  });
}

export async function acaoSalvarQualificacao(leadId: string, qualificacao: Qualificacao): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("salvar qualificação", async () => {
    await preVendas.salvarQualificacao({ organizacaoId: ctx.organizacaoId, leadId, qualificacao, ator: ctx.ator });
    revalidatePath(ROTA);
  });
}

export async function acaoNutrir(
  leadId: string, motivo: MotivoNutricao, retomarEm: string | null, observacao: string | null,
): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("nutrir", async () => {
    await preVendas.nutrir({ organizacaoId: ctx.organizacaoId, leadId, motivo, retomarEm, observacao, ator: ctx.ator });
    revalidatePath(ROTA);
  });
}

export async function acaoDesqualificar(
  leadId: string, motivo: MotivoDesqualificacao, detalhe: string | null,
): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("desqualificar", async () => {
    await preVendas.desqualificar({ organizacaoId: ctx.organizacaoId, leadId, motivo, detalhe, ator: ctx.ator });
    revalidatePath(ROTA);
  });
}

export async function acaoReativar(leadId: string): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("reativar", async () => {
    await preVendas.moverEtapa({
      organizacaoId: ctx.organizacaoId, leadId, para: "em_contato",
      ator: ctx.ator, motivo: "Lead retomado",
    });
    revalidatePath(ROTA);
  });
}

export async function acaoRegistrarContato(
  leadId: string, canal: "whatsapp" | "email" | "ligacao",
): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("registrar contato", async () => {
    await preVendas.registrarPrimeiroContato({ organizacaoId: ctx.organizacaoId, leadId, canal, ator: ctx.ator });
    revalidatePath(ROTA);
  });
}

export async function acaoAtribuir(leadId: string, responsavelId: string | null): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("atribuir responsável", async () => {
    await preVendas.atribuirResponsavel({
      organizacaoId: ctx.organizacaoId, leadId, responsavelId,
      origemAtribuicao: "manual", ator: ctx.ator,
    });
    revalidatePath(ROTA);
  });
}

/**
 * Handoff para o Pipeline.
 *
 * Duas famílias marcadas criam duas oportunidades irmãs — é o que a spec
 * manda, e o modal avisa isso antes de o usuário confirmar.
 */
export async function acaoCriarOportunidade(entrada: {
  leadId: string;
  familias: Familia[];
  responsavelId: string;
  reuniao?: { data: string; duracao?: number; tipo?: "call" | "presencial" | "video" } | null;
}): Promise<Resultado<{ ids: string[] }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("criar oportunidade", async () => {
    const resultado = await criarOportunidadeDoLead({
      organizacaoId: ctx.organizacaoId,
      leadId: entrada.leadId,
      familias: entrada.familias,
      responsavelId: entrada.responsavelId,
      reuniao: entrada.reuniao ?? null,
      ator: ctx.ator,
    });
    revalidatePath(ROTA);
    revalidatePath("/pipeline");
    return { ids: resultado.oportunidades.map((o) => o.id) };
  });
}

/** Criação manual de Lead. Empresa é obrigatória e resolvida antes (Bloco 01 §3). */
export async function acaoCriarLead(entrada: {
  empresa: string;
  cnpj?: string | null;
  website?: string | null;
  pessoaNome: string;
  cargo?: string | null;
  email?: string | null;
  telefone?: string | null;
  origem?: string | null;
  responsavelId?: string | null;
}): Promise<Resultado<{ leadId: string }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  if (!entrada.empresa?.trim()) return { ok: false, erro: "O lead precisa de uma empresa." };
  if (!entrada.pessoaNome?.trim()) return { ok: false, erro: "Informe o nome do contato." };

  return executar("criar lead", async () => {
    const [primeiro, ...resto] = entrada.pessoaNome.trim().split(/\s+/);
    const criado = await preVendas.criarLead({
      organizacaoId: ctx.organizacaoId,
      empresa: {
        nome: entrada.empresa.trim(), cnpj: entrada.cnpj ?? null,
        website: entrada.website ?? null, email: entrada.email ?? null,
      },
      pessoa: {
        nome: primeiro, sobrenome: resto.length ? resto.join(" ") : null,
        cargo: entrada.cargo ?? null, email: entrada.email ?? null, telefone: entrada.telefone ?? null,
      },
      touchpoint: { tipoOrigem: "manual", source: entrada.origem ?? "manual" },
      origem: entrada.origem ?? "Manual",
      responsavelId: entrada.responsavelId ?? null,
    }, ctx.ator);
    revalidatePath(ROTA);
    return { leadId: criado.leadId };
  });
}

/** Associa a empresa quando o lead legado só tem o nome dela em texto. */
export async function acaoAssociarEmpresa(leadId: string, nome: string, cnpj: string | null): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("associar empresa", async () => {
    const empresa = await resolverEmpresa(ctx.organizacaoId, { nome, cnpj }, ctx.ator);
    await db.execute(sql`
      UPDATE leads SET empresa_id = ${empresa.empresaId}::uuid, empresa = ${nome}, updated_at = now()
       WHERE id = ${leadId}::uuid AND organizacao_id = ${ctx.organizacaoId}::uuid
    `);
    revalidatePath(ROTA);
  });
}

export async function acaoDetalhe(leadId: string): Promise<Resultado<{ lead: DetalheLead | null; timeline: LinhaDoTempo[] }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("carregar detalhe", async () => {
    const [lead, timeline] = await Promise.all([
      detalheLead(ctx.organizacaoId, leadId),
      lerLinhaDoTempo({ organizacaoId: ctx.organizacaoId, leadId, limite: 40 }),
    ]);
    return { lead, timeline };
  });
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

/**
 * Próxima ação: cria a Task real, amarrada à aquisição.
 *
 * `vence_em` é o que a leitura do board ordena. Tarefa sem prazo existe, mas
 * cai para o fim por `NULLS LAST` — ela não vira a próxima ação de ninguém.
 */
export async function acaoCriarTarefa(entrada: {
  leadId: string;
  titulo: string;
  responsavelId: string | null;
  venceEm: string | null;
  prioridade: "baixa" | "media" | "alta";
  descricao: string | null;
}): Promise<Resultado<{ tarefaId: string }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  if (!entrada.titulo?.trim()) return { ok: false, erro: "A tarefa precisa de um título." };

  return executar("criar tarefa", async () => {
    /* Responsável precisa existir NESTA organização. Sem a checagem o banco
       recusa por chave estrangeira e a pessoa recebe "tente de novo em
       instantes" para um erro que nenhuma tentativa conserta. */
    if (entrada.responsavelId) {
      const [dono] = await db.execute<{ id: string }>(sql`
        SELECT id::text FROM usuarios
         WHERE id = ${entrada.responsavelId}::uuid
           AND organizacao_id = ${ctx.organizacaoId}::uuid`);
      if (!dono) throw new Error("O responsável escolhido não está nesta organização.");
    }

    const venceEm = entrada.venceEm ? new Date(entrada.venceEm) : null;
    if (venceEm && Number.isNaN(venceEm.getTime())) {
      throw new Error("A data do prazo não é válida.");
    }
    const [linha] = await db.execute<{ id: string }>(sql`
      INSERT INTO tarefas (organizacao_id, lead_id, usuario_id, titulo, descricao,
                           tipo, prioridade, vence_em, data_vencimento, origem)
      VALUES (${ctx.organizacaoId}::uuid, ${entrada.leadId}::uuid,
              ${entrada.responsavelId}::uuid, ${entrada.titulo.trim()},
              ${entrada.descricao}, 'tarefa', ${entrada.prioridade},
              ${venceEm ? venceEm.toISOString() : null}::timestamptz,
              ${venceEm ? venceEm.toISOString() : null}::date, 'MANUAL')
      RETURNING id::text`);
    revalidatePath(ROTA);
    return { tarefaId: linha.id };
  });
}

/**
 * Atribuir várias aquisições de uma vez.
 *
 * Passa pelo MESMO comando de domínio de uma a uma, num laço: cada registro
 * emite o próprio evento e continua auditável. Um `UPDATE ... WHERE id = ANY`
 * seria mais rápido e apagaria a linha do tempo de todas elas.
 *
 * Falha individual não derruba o lote — o resultado diz quantas entraram.
 */
export async function acaoAtribuirEmMassa(
  leadIds: string[], responsavelId: string | null,
): Promise<Resultado<{ total: number }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  if (leadIds.length === 0) return { ok: false, erro: "Nenhuma aquisição selecionada." };

  return executar("atribuir em massa", async () => {
    let total = 0;
    /* A primeira falha é GUARDADA, não engolida.
     *
     * Engolir toda exceção fez o lote inteiro falhar com "tente de novo em
     * instantes" enquanto o motivo real ficava invisível — inclusive para
     * quem estava depurando. Uma recusa individual continua sem derrubar as
     * outras; o que muda é que o lote sabe dizer por que parou. */
    let primeiraFalha: unknown = null;
    for (const leadId of leadIds) {
      try {
        await preVendas.atribuirResponsavel({
          organizacaoId: ctx.organizacaoId, leadId, responsavelId,
          origemAtribuicao: "manual", ator: ctx.ator,
        });
        total += 1;
      } catch (erro) {
        primeiraFalha ??= erro;
      }
    }
    if (total === 0) {
      console.error("[vendas] atribuição em massa: nenhuma aplicada", primeiraFalha);
      throw primeiraFalha instanceof Error
        ? primeiraFalha
        : new Error("Nenhuma aquisição pôde ser atribuída.");
    }
    revalidatePath(ROTA);
    return { total };
  });
}

/**
 * Ações em lote da barra de seleção.
 *
 * Usa `executarEmMassa`, o motor que já existe: ele resolve o alvo por
 * organização, aplica uma a uma e devolve o desfecho de CADA lead — aplicado,
 * ignorado ou falhou, com o motivo em português. É isso que permite a barra
 * dizer "48 de 50, 2 já estavam na cadência" em vez de um "pronto" que esconde
 * metade.
 */
export async function acaoEmMassa(
  acao: AcaoEmMassa,
  leadIds: string[],
  valor: string | null,
): Promise<Resultado<ResultadoEmMassa>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  if (!leadIds.length) return { ok: false, erro: "Nenhum lead selecionado." };
  return executar("ação em massa", async () => {
    const r = await executarEmMassa({
      organizacaoId: ctx.organizacaoId,
      acao,
      leadIds,
      atorId: ctx.ator.usuarioId,
      valor,
    });
    revalidatePath(ROTA);
    return r;
  });
}

/** As opções que a barra de seleção oferece: tags e cadências da organização. */
export async function acaoOpcoesEmMassa(): Promise<
  Resultado<{ tags: Array<{ id: string; nome: string }>; cadencias: Array<{ id: string; nome: string }> }>
> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("opções em massa", async () => {
    const [tags, cadencias] = await Promise.all([
      // A tabela chama `labels`, não `tags`: eu tinha escrito o nome do
      // conceito em vez do nome da tabela, e a ação de Tag em massa falhava
      // toda vez, com o erro escondido atrás do "não consegui concluir".
      db.execute<{ id: string; nome: string }>(sql`
        SELECT id::text, nome FROM labels
         WHERE organizacao_id = ${ctx.organizacaoId}::uuid
         ORDER BY nome LIMIT 60
      `),
      db.execute<{ id: string; nome: string }>(sql`
        SELECT id::text, nome FROM cadence_definitions
         WHERE organizacao_id = ${ctx.organizacaoId}::uuid AND ativo IS NOT false
         ORDER BY nome LIMIT 40
      `),
    ]);
    return { tags: [...tags], cadencias: [...cadencias] };
  });
}

/** Põe ou tira uma tag de UM lead — o botão "+" da gaveta.
 *
 * O motor em massa já fazia isso para vários; a gaveta precisava de um a um e
 * não tinha porta, então o "+" só emitia um aviso dizendo que a peça viria. */
export async function acaoTagDoLead(
  leadId: string,
  label: string,
  operacao: "adicionar" | "remover",
): Promise<Resultado<{ mudou: boolean }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("tag do lead", async () => {
    const fn = operacao === "adicionar" ? adicionarTag : removerTag;
    const r = await fn({
      organizacaoId: ctx.organizacaoId,
      entityType: "lead",
      entityId: leadId,
      label,
    });
    revalidatePath(ROTA);
    return { mudou: r.mudou };
  });
}
