"use server";

import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/auth/tenant";
import {
  atorHumano, MOTIONS, RegraDeNegocio, type Motion,
  type EtapaPipelineAberta, type Familia, type MotivoEstagnacao, type MotivoPerda,
} from "@/lib/vendas/dominio";
import { executar, type Resultado } from "@/lib/vendas/resultado";
import * as pipeline from "@/lib/vendas/pipeline";
import { detalheOportunidade, type DetalheOportunidade } from "@/lib/vendas/consultas";
import { lerLinhaDoTempo, type LinhaDoTempo } from "@/lib/vendas/eventos";

const ROTA = "/pipeline";

async function contexto() {
  const ctx = await getTenantContext();
  if (!ctx) return null;
  return { organizacaoId: ctx.organizacaoId, ator: atorHumano(ctx.userId) };
}

/**
 * Move de etapa.
 *
 * Os gates de Proposta e Negociação moram no motor e chegam aqui como
 * `RegraDeNegocio`, virando mensagem + CTA na tela. Ganho não é alcançável por
 * esta ação em hipótese alguma: o tipo do parâmetro só aceita etapa aberta.
 */
export async function acaoMoverEtapa(negocioId: string, para: EtapaPipelineAberta): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("mover etapa da oportunidade", async () => {
    await pipeline.moverEtapa({ organizacaoId: ctx.organizacaoId, negocioId, para, ator: ctx.ator });
    revalidatePath(ROTA);
  });
}

export async function acaoDefinirProximaAcao(
  negocioId: string, descricao: string | null, quando: string | null,
): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("definir próxima ação", async () => {
    await pipeline.definirProximaAcao({ organizacaoId: ctx.organizacaoId, negocioId, descricao, quando, ator: ctx.ator });
    revalidatePath(ROTA);
  });
}

/** Troca o responsável pelo NOME (é o que o seletor da tela conhece). */
export async function acaoAtribuirResponsavel(negocioId: string, nome: string): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("trocar responsável", async () => {
    const [u] = await db.execute<{ id: string }>(sql`
      SELECT id::text FROM usuarios
       WHERE organizacao_id = ${ctx.organizacaoId}::uuid AND ativo = true AND nome = ${nome} LIMIT 1`);
    if (!u) throw new RegraDeNegocio("responsavel_invalido", `Não achei "${nome}" na equipe.`);
    await pipeline.atribuirResponsavelDaOportunidade({ organizacaoId: ctx.organizacaoId, negocioId, responsavelId: u.id, ator: ctx.ator });
    revalidatePath(ROTA);
  });
}

/** Resumo da oportunidade: objetivo, escopo, contexto, dor e solução. Mora em `campos_custom`. */
export async function acaoSalvarResumo(negocioId: string, campos: Record<string, string>): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("salvar resumo da oportunidade", async () => {
    const limpo = Object.fromEntries(
      ["objetivo", "escopo", "contexto", "dor", "solucao"].map((k) => [k, String(campos[k] ?? "").trim()]).filter(([, v]) => v),
    );
    const r = await db.execute<{ id: string }>(sql`
      UPDATE negocios SET campos_custom = jsonb_set(COALESCE(campos_custom, '{}'::jsonb), '{resumoOportunidade}', ${JSON.stringify(limpo)}::jsonb)
       WHERE id = ${negocioId}::uuid AND organizacao_id = ${ctx.organizacaoId}::uuid RETURNING id::text`);
    if (!r.length) throw new RegraDeNegocio("oportunidade_nao_encontrada", "Oportunidade não encontrada.");
    revalidatePath(ROTA);
  });
}

export async function acaoMarcarEstagnacao(negocioId: string, motivo: MotivoEstagnacao | null): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("marcar estagnação", async () => {
    await pipeline.marcarEstagnacao({ organizacaoId: ctx.organizacaoId, negocioId, motivo, ator: ctx.ator });
    revalidatePath(ROTA);
  });
}

export async function acaoAlterarFamilia(
  negocioId: string, familia: Familia, motivo: string | null,
): Promise<Resultado<{ propostasIncompativeis: number }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("alterar família", async () => {
    const r = await pipeline.alterarFamilia({ organizacaoId: ctx.organizacaoId, negocioId, familia, motivo, ator: ctx.ator });
    revalidatePath(ROTA);
    return r;
  });
}

export async function acaoPerder(
  negocioId: string, motivo: MotivoPerda, detalhe: string | null,
): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("perder oportunidade", async () => {
    await pipeline.perder({ organizacaoId: ctx.organizacaoId, negocioId, motivo, detalhe, ator: ctx.ator });
    revalidatePath(ROTA);
  });
}

/**
 * Tenta fechar como Ganho.
 *
 * Não existe "marcar como ganho": o comando pergunta ao gate de evidência se
 * há base para fechar. Quando não há, a resposta diz o que falta — e é isso
 * que a tela mostra.
 */
export async function acaoTentarGanhar(negocioId: string): Promise<Resultado<{ ganhou: boolean; motivo: string }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("tentar ganhar", async () => {
    const r = await pipeline.tentarGanhar({ organizacaoId: ctx.organizacaoId, negocioId, ator: ctx.ator });
    revalidatePath(ROTA);
    return r;
  });
}

export async function acaoAgendarReuniao(
  negocioId: string, data: string, tipo: "call" | "presencial" | "video",
): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("agendar reunião", async () => {
    await pipeline.agendarReuniao({ organizacaoId: ctx.organizacaoId, negocioId, data, tipo, ator: ctx.ator });
    revalidatePath(ROTA);
  });
}

export async function acaoNoShow(negocioId: string, reuniaoId: string | null): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("registrar no-show", async () => {
    await pipeline.registrarNoShow({ organizacaoId: ctx.organizacaoId, negocioId, reuniaoId, ator: ctx.ator });
    revalidatePath(ROTA);
    revalidatePath("/pre-vendas");
  });
}

export async function acaoReagendar(negocioId: string, data: string): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("reagendar reunião", async () => {
    await pipeline.reagendarAposNoShow({ organizacaoId: ctx.organizacaoId, negocioId, data, ator: ctx.ator });
    revalidatePath(ROTA);
  });
}

export async function acaoTrial(negocioId: string, iniciar: boolean): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("trial", async () => {
    if (iniciar) await pipeline.iniciarTrial({ organizacaoId: ctx.organizacaoId, negocioId, ator: ctx.ator });
    else await pipeline.encerrarTrial({ organizacaoId: ctx.organizacaoId, negocioId, ator: ctx.ator });
    revalidatePath(ROTA);
  });
}

/** Criação manual: sem Lead, mas nunca sem Empresa (Bloco 02 §7). */
export async function acaoCriarOportunidade(entrada: {
  empresaId: string;
  familias: Familia[];
  responsavelId: string;
  titulo?: string | null;
  valorEstimado?: string | null;
  previsaoFechamento?: string | null;
  proximaAcao?: string | null;
  proximaAcaoEm?: string | null;
  /** Lead que já existe: só VINCULA (não conclui handoff de Pré-vendas). */
  leadId?: string | null;
  /** Expansão/renovação de quem já é cliente. Ausente = nova venda. */
  motion?: Motion;
}): Promise<Resultado<{ ids: string[] }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("criar oportunidade", async () => {
    // O lead vem do cliente: precisa ser DESTA organização antes de virar vínculo.
    if (entrada.leadId) {
      const [lead] = await db.execute<{ id: string }>(sql`
        SELECT id::text FROM leads
         WHERE id = ${entrada.leadId}::uuid AND organizacao_id = ${ctx.organizacaoId}::uuid`);
      if (!lead) throw new RegraDeNegocio("lead_nao_encontrado", "O lead informado não está nesta organização.");
    }
    const motion = entrada.motion && MOTIONS.includes(entrada.motion) ? entrada.motion : undefined;
    const r = await pipeline.criarOportunidade({
      organizacaoId: ctx.organizacaoId,
      empresaId: entrada.empresaId,
      familias: entrada.familias,
      responsavelId: entrada.responsavelId,
      sourceProcess: motion && motion !== "NEW_BUSINESS" ? "EXPANSION" : "MANUAL",
      motion,
      leadId: entrada.leadId ?? null,
      titulo: entrada.titulo,
      valorEstimado: entrada.valorEstimado,
      previsaoFechamento: entrada.previsaoFechamento,
      proximaAcao: entrada.proximaAcao,
      proximaAcaoEm: entrada.proximaAcaoEm,
    }, ctx.ator);
    revalidatePath(ROTA);
    return { ids: r.oportunidades.map((o) => o.id) };
  });
}

export async function acaoDetalhe(idDaRota: string): Promise<Resultado<{
  oportunidade: DetalheOportunidade | null; timeline: LinhaDoTempo[];
}>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("carregar detalhe", async () => {
    // A rota aceita o id do negócio legado OU o da oportunidade canônica.
    const [canonica] = await db.execute<{ negocio: string | null }>(sql`
      SELECT negocio_id_legado::text AS negocio FROM oportunidades
       WHERE id = ${idDaRota}::uuid AND organizacao_id = ${ctx.organizacaoId}::uuid`);
    const negocioId = canonica?.negocio ?? idDaRota;
    const oportunidade = await detalheOportunidade(ctx.organizacaoId, negocioId);
    // Também pelo lead: a conversa e a aquisição de origem moram nele, não no negócio.
    const timeline = await lerLinhaDoTempo({
      organizacaoId: ctx.organizacaoId, negocioId, leadId: oportunidade?.leadId ?? undefined, limite: 40,
    });
    return { oportunidade, timeline };
  });
}

/** Busca de empresas para a criação manual. Devolve o relacionamento derivado
 *  para que a pessoa veja se está abrindo oportunidade numa conta que já é
 *  cliente (o que muda o motion comercial). */
export async function acaoBuscarEmpresas(termo: string): Promise<Array<{ id: string; nome: string; apoio: string | null }>> {
  const ctx = await getTenantContext();
  if (!ctx || termo.trim().length < 2) return [];
  const linhas = await db.execute<{ id: string; nome: string; apoio: string | null }>(sql`
    SELECT e.id::text, e.nome,
           NULLIF(concat_ws(' · ', e.cnpj, e.cidade), '') AS apoio
      FROM empresas e
     WHERE e.organizacao_id = ${ctx.organizacaoId}::uuid
       AND lower(e.nome) LIKE ${`%${termo.trim().toLowerCase()}%`}
     ORDER BY e.nome LIMIT 12
  `);
  return linhas.map((l) => ({ id: l.id, nome: l.nome, apoio: l.apoio }));
}
