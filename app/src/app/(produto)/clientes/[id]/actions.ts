"use server";

/**
 * Ações do Cliente 360.
 *
 * A modal "Nova oportunidade" do desenho já existia e montava o objeto certo
 * na tela — mas o adaptador respondia "isto ainda não grava pelo Cliente 360"
 * e o vendedor saía achando que tinha criado. Botão que parece agir e não age
 * é o defeito mais caro, porque não dá erro.
 */
import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/auth/tenant";
import { registrarEvento } from "@/lib/vendas/eventos";
import { registrarMudancaResponsavel } from "@/lib/crm/owner";
import { criarOportunidade } from "@/lib/vendas/pipeline";
import { RegraDeNegocio } from "@/lib/vendas/dominio";
import type { Familia, Motion, ProcessoOrigem } from "@/lib/vendas/dominio";

export type TipoDeVenda = "expansao" | "upgrade" | "downgrade" | "crosssell" | "renovacao";

/**
 * O tipo que o vendedor escolhe na modal → o vocabulário do domínio.
 *
 * Os quatro são venda para quem JÁ é cliente, então nenhum é `NEW_BUSINESS`:
 * tratá-los como negócio novo infla a aquisição e esvazia a expansão no
 * relatório. Cross-sell é produto diferente na mesma conta — continua
 * expansão de receita, não cliente novo.
 */
const MOTION_POR_TIPO: Record<TipoDeVenda, Motion> = {
  expansao: "EXPANSION",
  upgrade: "EXPANSION",
  downgrade: "EXPANSION",
  crosssell: "EXPANSION",
  renovacao: "RENEWAL",
};

export interface NovaOportunidadeDoCliente {
  empresaId: string;
  tipo: TipoDeVenda;
  familia: string;
  /** Quem assume a venda. Vazio = quem está criando. */
  responsavelId?: string | null;
  valorEstimado?: string | null;
  observacao?: string | null;
  pessoaId?: string | null;
  /** Upgrade/downgrade: o serviço que a venda troca. Vazio = o Ganho resolve se houver um candidato inequívoco. */
  servicoOrigemId?: string | null;
}

export type ResultadoNovaOportunidade =
  | { ok: true; negocioId: string; titulo: string }
  | { ok: false; erro: string };

export async function acaoNovaOportunidadeDoCliente(
  entrada: NovaOportunidadeDoCliente,
): Promise<ResultadoNovaOportunidade> {
  const ctx = await getTenantContext();
  if (!ctx) return { ok: false, erro: "Sessão expirada. Entre de novo." };

  const motion = MOTION_POR_TIPO[entrada.tipo];
  if (!motion) return { ok: false, erro: `Tipo de venda desconhecido: ${entrada.tipo}` };

  try {
    const r = await criarOportunidade(
      {
        organizacaoId: ctx.organizacaoId,
        empresaId: entrada.empresaId,
        familias: [entrada.familia as Familia],
        responsavelId: entrada.responsavelId || ctx.userId,
        /* `EXPANSION` como processo de origem é o que faz a oportunidade
           nascer marcada como vinda da carteira, e não da aquisição. */
        sourceProcess: "EXPANSION" as ProcessoOrigem,
        motion,
        pessoaId: entrada.pessoaId ?? null,
        valorEstimado: entrada.valorEstimado ?? null,
        proximaAcao: entrada.observacao?.trim() || null,
        /* O tipo escolhido na modal não pode se perder no `EXPANSION` do mapa: é ele que diz, no Ganho,
           se o serviço soma (cross-sell), substitui (upgrade/downgrade) ou renova. */
        tipoVenda: entrada.tipo,
        servicoOrigemId: entrada.servicoOrigemId ?? null,
      },
      { tipo: "HUMAN", usuarioId: ctx.userId },
    );

    const criada = r.oportunidades[0];
    if (!criada) return { ok: false, erro: "A oportunidade não foi criada." };

    revalidatePath(`/clientes/${entrada.empresaId}`);
    revalidatePath("/pipeline");
    return { ok: true, negocioId: criada.id, titulo: criada.titulo };
  } catch (e) {
    // Regra de negócio tem mensagem escrita para humano; o resto não vaza.
    if (e instanceof RegraDeNegocio) return { ok: false, erro: e.message };
    console.error("[Cliente360] falha ao criar oportunidade:", e);
    return { ok: false, erro: "Não foi possível criar a oportunidade. Tente de novo." };
  }
}


/* ── Escritas do Cliente 360 que só avisavam "ainda não grava" ─────────────
 * Nota, CSM, contato principal, nova pessoa e documento. Toda ação confere que
 * a empresa é cliente DA ORGANIZAÇÃO DA SESSÃO (nunca do corpo) e deixa rastro:
 * `notas` já tem autor e data; a troca de CSM e a pessoa nova entram em
 * `vendas_eventos` (quem, quando, de→para) e a troca de CSM também em
 * `audit_log`. A tela relê o servidor, não um store local. */

export type Resultado = { ok: true } | { ok: false; erro: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SESSAO = "Sessão expirada. Entre de novo.";

async function clienteDaOrg(organizacaoId: string, empresaId: string) {
  if (!UUID.test(empresaId)) return null;
  const [c] = await db.execute<{ id: string; csm_id: string | null }>(sql`
    SELECT id::text, COALESCE(responsavel_cs_id, responsavel_id)::text AS csm_id FROM clientes
     WHERE organizacao_id = ${organizacaoId}::uuid AND empresa_id = ${empresaId}::uuid`);
  return c ?? null;
}

export async function acaoNotaDoCliente(empresaId: string, texto: string): Promise<Resultado> {
  const ctx = await getTenantContext();
  if (!ctx) return { ok: false, erro: SESSAO };
  const t = texto.trim();
  if (!t) return { ok: false, erro: "Escreva a nota antes de salvar." };
  if (t.length > 8000) return { ok: false, erro: "A nota passa de 8.000 caracteres." };
  const cli = await clienteDaOrg(ctx.organizacaoId, empresaId);
  if (!cli) return { ok: false, erro: "Cliente não encontrado." };
  await db.execute(sql`
    INSERT INTO notas (organizacao_id, empresa_id, cliente_id, conteudo, autor_id, autor_display_name)
    VALUES (${ctx.organizacaoId}::uuid, ${empresaId}::uuid, ${cli.id}::uuid, ${t}, ${ctx.userId}::uuid, ${ctx.userName ?? null})`);
  revalidatePath(`/clientes/${empresaId}`);
  return { ok: true };
}

/** CSM da conta. Grava as duas colunas de dono para a tela de CS, a Carteira e o 360 lerem o mesmo nome. */
export async function acaoAtribuirCsm(empresaId: string, usuarioId: string): Promise<Resultado> {
  const ctx = await getTenantContext();
  if (!ctx) return { ok: false, erro: SESSAO };
  const cli = await clienteDaOrg(ctx.organizacaoId, empresaId);
  if (!cli) return { ok: false, erro: "Cliente não encontrado." };
  if (!UUID.test(usuarioId)) return { ok: false, erro: "Responsável inválido." };
  const [novo] = await db.execute<{ nome: string }>(sql`
    SELECT nome FROM usuarios WHERE id = ${usuarioId}::uuid AND organizacao_id = ${ctx.organizacaoId}::uuid AND ativo = true`);
  if (!novo) return { ok: false, erro: "Esse usuário não está ativo na equipe." };
  if (cli.csm_id === usuarioId) return { ok: true };
  const [antes] = cli.csm_id ? await db.execute<{ nome: string }>(sql`SELECT nome FROM usuarios WHERE id = ${cli.csm_id}::uuid`) : [];

  await db.execute(sql`
    UPDATE clientes SET responsavel_cs_id = ${usuarioId}::uuid, responsavel_id = ${usuarioId}::uuid, updated_at = now()
     WHERE id = ${cli.id}::uuid`);
  await registrarMudancaResponsavel({
    organizacaoId: ctx.organizacaoId, entityType: "cliente", entityId: empresaId,
    previousOwnerId: cli.csm_id, newOwnerId: usuarioId, actorId: ctx.userId,
  });
  await registrarEvento({
    organizacaoId: ctx.organizacaoId, tipo: "OwnerChanged", ator: { tipo: "HUMAN", usuarioId: ctx.userId },
    empresaId, contexto: { entidade: "cliente", de: antes?.nome ?? null, para: novo.nome, deId: cli.csm_id, paraId: usuarioId },
  });
  revalidatePath(`/clientes/${empresaId}`);
  revalidatePath("/clientes/cs");
  return { ok: true };
}

/** Contato principal DESIGNADO (clientes.pessoa_principal_id + vínculo). Aceita id de pessoa ou de lead sem pessoa. */
export async function acaoTornarPrincipal(empresaId: string, pessoaOuLeadId: string): Promise<Resultado> {
  const ctx = await getTenantContext();
  if (!ctx) return { ok: false, erro: SESSAO };
  const cli = await clienteDaOrg(ctx.organizacaoId, empresaId);
  if (!cli) return { ok: false, erro: "Cliente não encontrado." };
  if (!UUID.test(pessoaOuLeadId)) return { ok: false, erro: "Pessoa inválida." };

  let [p] = await db.execute<{ id: string; nome: string }>(sql`
    SELECT id::text, nome FROM pessoas
     WHERE id = ${pessoaOuLeadId}::uuid AND organizacao_id = ${ctx.organizacaoId}::uuid AND empresa_id = ${empresaId}::uuid`);
  if (!p) {
    // Pessoa que só existe como lead: vira pessoa canônica (uma vez) para poder ser designada.
    [p] = await db.execute<{ id: string; nome: string }>(sql`
      INSERT INTO pessoas (organizacao_id, empresa_id, nome, sobrenome, email, telefone, cargo, lead_id_legado)
      SELECT l.organizacao_id, l.empresa_id, l.nome, l.sobrenome, l.email, l.telefone, l.cargo, l.id
        FROM leads l WHERE l.id = ${pessoaOuLeadId}::uuid AND l.organizacao_id = ${ctx.organizacaoId}::uuid
         AND l.empresa_id = ${empresaId}::uuid
      ON CONFLICT (lead_id_legado) DO UPDATE SET updated_at = now()
      RETURNING id::text, nome`);
  }
  if (!p) return { ok: false, erro: "Essa pessoa não pertence à empresa." };

  await db.execute(sql`UPDATE pessoa_empresa_vinculos SET principal = false, updated_at = now()
     WHERE empresa_id = ${empresaId}::uuid AND encerrado_em IS NULL AND principal AND pessoa_id <> ${p.id}::uuid`);
  await db.execute(sql`
    INSERT INTO pessoa_empresa_vinculos (organizacao_id, pessoa_id, empresa_id, papel, principal)
    VALUES (${ctx.organizacaoId}::uuid, ${p.id}::uuid, ${empresaId}::uuid, 'contato_principal', true)
    ON CONFLICT (pessoa_id, empresa_id) WHERE encerrado_em IS NULL DO UPDATE SET principal = true, updated_at = now()`);
  await db.execute(sql`UPDATE clientes SET pessoa_principal_id = ${p.id}::uuid, updated_at = now() WHERE id = ${cli.id}::uuid`);
  await registrarEvento({
    organizacaoId: ctx.organizacaoId, tipo: "PersonLinkedToCompany", ator: { tipo: "HUMAN", usuarioId: ctx.userId },
    empresaId, pessoaId: p.id, contexto: { principal: true, nome: p.nome },
  });
  revalidatePath(`/clientes/${empresaId}`);
  return { ok: true };
}

const PAPEL_DO_DESENHO: Record<string, string> = {
  "Decisor": "decisor", "Influenciador": "influenciador", "Financeiro": "financeiro",
  "Técnico": "tecnico", "Usuário": "usuario", "Contato principal": "contato_principal",
};

export async function acaoAdicionarPessoaAoCliente(empresaId: string, d: {
  nome: string; cargo?: string; email?: string; telefone?: string; papel?: string;
}): Promise<Resultado> {
  const ctx = await getTenantContext();
  if (!ctx) return { ok: false, erro: SESSAO };
  const cli = await clienteDaOrg(ctx.organizacaoId, empresaId);
  if (!cli) return { ok: false, erro: "Cliente não encontrado." };
  const nome = d.nome.trim();
  if (!nome) return { ok: false, erro: "Informe o nome." };
  const email = d.email?.trim().toLowerCase() || null;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, erro: "E-mail inválido." };
  const [dup] = await db.execute<{ id: string }>(sql`
    SELECT id::text FROM pessoas WHERE organizacao_id = ${ctx.organizacaoId}::uuid AND empresa_id = ${empresaId}::uuid
       AND (lower(trim(concat_ws(' ', nome, sobrenome))) = ${nome.toLowerCase()} ${email ? sql`OR lower(email) = ${email}` : sql``})`);
  if (dup) return { ok: false, erro: `${nome} já está na conta.` };

  const papel = PAPEL_DO_DESENHO[d.papel ?? ""] ?? "outro";
  const [nova] = await db.execute<{ id: string }>(sql`
    INSERT INTO pessoas (organizacao_id, empresa_id, nome, email, telefone, cargo)
    VALUES (${ctx.organizacaoId}::uuid, ${empresaId}::uuid, ${nome}, ${email}, ${d.telefone?.trim() || null}, ${d.cargo?.trim() || null})
    RETURNING id::text`);
  await db.execute(sql`
    INSERT INTO pessoa_empresa_vinculos (organizacao_id, pessoa_id, empresa_id, papel, principal, cargo)
    VALUES (${ctx.organizacaoId}::uuid, ${nova.id}::uuid, ${empresaId}::uuid, ${papel}, false, ${d.cargo?.trim() || null})`);
  await registrarEvento({
    organizacaoId: ctx.organizacaoId, tipo: "PersonCreated", ator: { tipo: "HUMAN", usuarioId: ctx.userId },
    empresaId, pessoaId: nova.id, contexto: { nome, papel, origem: "cliente_360" },
  });
  revalidatePath(`/clientes/${empresaId}`);
  return { ok: true };
}

/** Remove um documento ENVIADO pelo 360 (o legado do Zoho não se apaga). Só tira o vínculo; o binário segue no acervo se outro registro usar. */
export async function acaoRemoverDocumentoDoCliente(empresaId: string, vinculoId: string): Promise<Resultado> {
  const ctx = await getTenantContext();
  if (!ctx) return { ok: false, erro: SESSAO };
  if (!UUID.test(vinculoId) || !(await clienteDaOrg(ctx.organizacaoId, empresaId))) return { ok: false, erro: "Documento não encontrado." };
  const r = await db.execute<{ id: string }>(sql`
    DELETE FROM file_links WHERE id = ${vinculoId}::uuid AND organizacao_id = ${ctx.organizacaoId}::uuid
       AND entity_type = 'empresa' AND entity_id = ${empresaId}::uuid RETURNING id::text`);
  if (!r.length) return { ok: false, erro: "Documento não encontrado." };
  revalidatePath(`/clientes/${empresaId}`);
  return { ok: true };
}
