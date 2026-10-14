/**
 * Empresa do negócio: porta única que garante `negocios.empresa_id` antes do Ganho.
 *
 * Por que existe (medido em 14/10 na cópia de produção): 150 de 632 negócios ganhos não tinham empresa, e
 * Cliente 360, serviço canônico, conta de CS e implantação dependem dela. Causa: o negócio COPIA
 * `leads.empresa_id` no momento em que nasce, e o lead costuma receber a empresa depois (ficha, contato, webhook).
 * Nada propagava, e o Ganho só dava `console.warn("ganho sem empresa vinculada")`. Em 120 dos 150 o lead JÁ tem
 * empresa; em 17 só o nome; em 13 não há nada utilizável.
 *
 * Ordem (a primeira que decide vence; nada é chutado):
 *   1. o próprio negócio  2. o lead  3. a oportunidade  4. outros leads do negócio (só se for UMA empresa)
 *   5. CNPJ do lead -> `resolverEmpresa` (CNPJ, domínio, nome; cria se não existe)
 *   6. domínio corporativo do e-mail que aponta para UMA empresa
 *   7. nome do lead (>= 3 letras) -> `resolverEmpresa` (nome normalizado igual ou cria, sem duplicar)
 *   8. nada serve: `ok: false` com o motivo. Quem chama decide como falhar, mas nunca segue mudo.
 *
 * Escrita só aqui, com `organizacao_id` conferido: negocios, oportunidades (espelho) e leads.empresa_id quando vazio.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { ExecutorDb } from "./executor";
import type { Ator } from "./dominio";
import { resolverEmpresa, normalizarCnpj } from "./identidade";
import { dominioCorporativo } from "@/lib/crm/dominio-empresa";
import { empresaUnicaPorDominio } from "@/lib/crm/resolver-empresa";

export type OrigemEmpresaDoNegocio =
  | "negocio" | "lead" | "oportunidade" | "lead_vinculado" | "cnpj" | "dominio" | "nome" | "criada";

export type EmpresaDoNegocio =
  | { ok: true; empresaId: string; origem: OrigemEmpresaDoNegocio; alterou: boolean }
  | { ok: false; motivo: string; pista: Record<string, unknown> };

const ATOR: Ator = { tipo: "SYSTEM", usuarioId: null, ref: "empresa_do_negocio" };

export const FRASE_GANHO_SEM_EMPRESA =
  "Não é possível concluir o ganho sem empresa: o lead não tem empresa cadastrada nem dados (nome, CNPJ ou e-mail corporativo) para criar uma. Vincule ou cadastre a empresa do negócio e tente de novo.";

/** Nome que serve para criar empresa: 3 letras/dígitos ou mais depois de normalizar ("J", "Ws" não servem). */
function nomeUtil(nome: string | null | undefined): string | null {
  const n = nome?.trim() ?? "";
  return n.replace(/[^\p{L}\p{N}]+/gu, "").length >= 3 ? n : null;
}

export async function garantirEmpresaDoNegocio(
  organizacaoId: string,
  negocioId: string,
  tx: ExecutorDb = db,
): Promise<EmpresaDoNegocio> {
  const [n] = await tx.execute<{
    empresa_id: string | null; lead_id: string | null; lead_empresa_id: string | null; op_empresa_id: string | null;
    nome: string | null; email: string | null; cnpj: string | null; setor: string | null; porte: string | null;
    cidade: string | null; estado: string | null;
  }>(sql`
    SELECT n.empresa_id::text, n.lead_id::text, (SELECT e.id::text FROM empresas e WHERE e.id = l.empresa_id AND e.organizacao_id = n.organizacao_id) AS lead_empresa_id,
           (SELECT e.id::text FROM oportunidades o JOIN empresas e ON e.id = o.empresa_id AND e.organizacao_id = n.organizacao_id
             WHERE o.negocio_id_legado = n.id AND o.organizacao_id = n.organizacao_id LIMIT 1) AS op_empresa_id,
           l.empresa AS nome, l.email, l.empresa_cnpj AS cnpj, l.empresa_setor AS setor, l.empresa_porte AS porte,
           l.empresa_cidade AS cidade, l.empresa_estado AS estado
      FROM negocios n
      LEFT JOIN leads l ON l.id = n.lead_id AND l.organizacao_id = n.organizacao_id
     WHERE n.id = ${negocioId}::uuid AND n.organizacao_id = ${organizacaoId}::uuid`);
  if (!n) return { ok: false, motivo: "negócio não encontrado nesta organização", pista: {} };
  if (n.empresa_id) return { ok: true, empresaId: n.empresa_id, origem: "negocio", alterou: false };

  const cnpj = normalizarCnpj(n.cnpj);
  const nome = nomeUtil(n.nome);
  const dominio = dominioCorporativo(n.email);
  const pista = { leadId: n.lead_id, leadNome: n.nome, leadEmail: n.email, cnpj, dominio };

  let escolha: { empresaId: string; origem: OrigemEmpresaDoNegocio } | null = null;
  if (n.lead_empresa_id) escolha = { empresaId: n.lead_empresa_id, origem: "lead" };
  else if (n.op_empresa_id) escolha = { empresaId: n.op_empresa_id, origem: "oportunidade" };

  if (!escolha) {
    const vinculadas = await tx.execute<{ id: string }>(sql`
      SELECT DISTINCT l.empresa_id::text AS id FROM negocio_leads nl
        JOIN leads l ON l.id = nl.lead_id AND l.organizacao_id = ${organizacaoId}::uuid
       WHERE nl.negocio_id = ${negocioId}::uuid AND l.empresa_id IS NOT NULL`);
    if (vinculadas.length === 1) escolha = { empresaId: vinculadas[0].id, origem: "lead_vinculado" };
  }

  const dadosEmpresa = nome ? { nome, cnpj, email: n.email, setor: n.setor, porte: n.porte, cidade: n.cidade, estado: n.estado } : null;

  if (!escolha && cnpj && dadosEmpresa) {
    const r = await resolverEmpresa(organizacaoId, dadosEmpresa, ATOR, tx);
    escolha = { empresaId: r.empresaId, origem: r.criada ? "criada" : "cnpj" };
  }
  if (!escolha && dominio) {
    const id = await empresaUnicaPorDominio(organizacaoId, dominio);
    if (id) escolha = { empresaId: id, origem: "dominio" };
  }
  if (!escolha && dadosEmpresa) {
    const r = await resolverEmpresa(organizacaoId, dadosEmpresa, ATOR, tx);
    escolha = { empresaId: r.empresaId, origem: r.criada ? "criada" : (r.resolvidaPor ?? "nome") as OrigemEmpresaDoNegocio };
  }
  if (!escolha) {
    return {
      ok: false, pista,
      motivo: nome || cnpj || dominio
        ? "domínio ambíguo ou sem dados suficientes para resolver a empresa com segurança"
        : "lead sem empresa, sem CNPJ, sem nome de empresa utilizável e sem e-mail corporativo",
    };
  }

  const { empresaId } = escolha;
  await tx.execute(sql`
    UPDATE negocios SET empresa_id = ${empresaId}::uuid, updated_at = updated_at
     WHERE id = ${negocioId}::uuid AND organizacao_id = ${organizacaoId}::uuid AND empresa_id IS NULL`);
  await tx.execute(sql`
    UPDATE oportunidades SET empresa_id = ${empresaId}::uuid, updated_at = updated_at
     WHERE negocio_id_legado = ${negocioId}::uuid AND organizacao_id = ${organizacaoId}::uuid AND empresa_id IS NULL`);
  if (n.lead_id) {
    await tx.execute(sql`
      UPDATE leads SET empresa_id = ${empresaId}::uuid, updated_at = updated_at
       WHERE id = ${n.lead_id}::uuid AND organizacao_id = ${organizacaoId}::uuid AND empresa_id IS NULL`);
  }
  return { ok: true, empresaId, origem: escolha.origem, alterou: true };
}

/**
 * Causa na origem: quando o lead GANHA empresa depois de ter negócio aberto, o negócio acompanha (só se estiver
 * sem empresa; nunca troca uma já definida). Sem isto o snapshot do nascimento do negócio fica velho para sempre.
 */
export async function propagarEmpresaDoLeadParaNegocios(
  organizacaoId: string,
  leadId: string,
  empresaId: string,
  tx: ExecutorDb = db,
): Promise<void> {
  await tx.execute(sql`
    UPDATE negocios SET empresa_id = ${empresaId}::uuid, updated_at = updated_at
     WHERE lead_id = ${leadId}::uuid AND organizacao_id = ${organizacaoId}::uuid AND empresa_id IS NULL`);
  await tx.execute(sql`
    UPDATE oportunidades o SET empresa_id = ${empresaId}::uuid, updated_at = o.updated_at
      FROM negocios n
     WHERE n.id = o.negocio_id_legado AND n.lead_id = ${leadId}::uuid AND n.organizacao_id = ${organizacaoId}::uuid
       AND n.empresa_id = ${empresaId}::uuid AND o.organizacao_id = ${organizacaoId}::uuid AND o.empresa_id IS NULL`);
}

/** Pendência visível para o caminho automático (webhook): um caso aberto em `reconciliacao_casos`, sem duplicar. */
export async function registrarGanhoSemEmpresa(
  organizacaoId: string,
  negocioId: string,
  motivo: string,
  pista: Record<string, unknown>,
  tx: ExecutorDb = db,
): Promise<void> {
  await tx.execute(sql`
    INSERT INTO reconciliacao_casos (organizacao_id, fase, tipo, entidade_alvo, origens, evidencia, sugestao)
    VALUES (${organizacaoId}::uuid, 'ganho-empresa', 'GANHO_SEM_EMPRESA', ${"negocio:" + negocioId},
            ${JSON.stringify([{ tabela: "negocios", id: negocioId }])}::jsonb,
            ${JSON.stringify({ motivo, ...pista })}::jsonb,
            ${JSON.stringify({ acao: "vincular ou cadastrar a empresa do negócio e refazer o ganho" })}::jsonb)
    ON CONFLICT DO NOTHING`);
}
