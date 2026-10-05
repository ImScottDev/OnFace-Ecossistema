"use server";

/* Tags da oportunidade (e do lead) — a peça "Tags Oportunidade" do handoff.
 *
 * Escrita sempre pela porta única (`lib/crm/tags.ts`), que grava a canônica,
 * espelha as legadas e publica TagAdded/TagRemoved para as automações. Aqui só
 * mora o que é da tela: ler o alvo, conferir que ele é da organização e
 * resolver no servidor a empresa e a pessoa ligadas a ele — o cliente nunca
 * diz em qual empresa a tag cai. */

import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/auth/tenant";
import { RegraDeNegocio } from "@/lib/vendas/dominio";
import { executar, type Resultado } from "@/lib/vendas/resultado";
import { adicionarTag, removerTag } from "@/lib/crm/tags";

export type TipoAlvoDeTag = "opp" | "lead";

export interface AlvoDeTag {
  id: string;
  empresa: string | null;
  empresaId: string | null;
  pessoa: string | null;
  /** O lead que É a pessoa da oportunidade; nulo quando não há. */
  leadId: string | null;
  familia: string | null;
  tags: string[];
}

export type TagDoCatalogo = { id: string; nome: string; cor: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function organizacao(): Promise<string | null> {
  const ctx = await getTenantContext();
  return ctx?.organizacaoId ?? null;
}

async function lerAlvo(organizacaoId: string, tipo: TipoAlvoDeTag, id: string): Promise<AlvoDeTag | null> {
  if (!UUID.test(id)) return null;
  if (tipo === "opp") {
    const [n] = await db.execute<{
      id: string; empresa: string | null; empresa_id: string | null; pessoa: string | null;
      lead_id: string | null; familia: string | null; tags: string[] | null;
    }>(sql`
      SELECT n.id::text, COALESCE(e.nome, l.empresa) AS empresa, n.empresa_id::text,
             NULLIF(trim(concat_ws(' ', l.nome, l.sobrenome)), '') AS pessoa,
             n.lead_id::text, COALESCE(n.service_family, o.service_family) AS familia,
             to_json(ARRAY(SELECT lb.nome FROM labels lb
                    WHERE lb.organizacao_id = n.organizacao_id
                      AND lb.id IN (SELECT label_id FROM entity_labels
                                     WHERE entity_type = 'negocio' AND entity_id = n.id
                                    UNION SELECT label_id FROM negocio_labels WHERE negocio_id = n.id)
                    ORDER BY lb.nome)) AS tags
        FROM negocios n
        LEFT JOIN empresas e ON e.id = n.empresa_id
        LEFT JOIN leads l ON l.id = n.lead_id
        LEFT JOIN oportunidades o ON o.negocio_id_legado = n.id
       WHERE n.id = ${id}::uuid AND n.organizacao_id = ${organizacaoId}::uuid`);
    if (!n) return null;
    return { id: n.id, empresa: n.empresa, empresaId: n.empresa_id, pessoa: n.pessoa, leadId: n.lead_id, familia: n.familia, tags: n.tags ?? [] };
  }
  const [l] = await db.execute<{
    id: string; empresa: string | null; empresa_id: string | null; pessoa: string | null; tags: string[] | null;
  }>(sql`
    SELECT l.id::text, COALESCE(e.nome, l.empresa) AS empresa, l.empresa_id::text,
           NULLIF(trim(concat_ws(' ', l.nome, l.sobrenome)), '') AS pessoa,
           to_json(ARRAY(SELECT lb.nome FROM labels lb
                  WHERE lb.organizacao_id = l.organizacao_id
                    AND lb.id IN (SELECT label_id FROM entity_labels
                                   WHERE entity_type = 'lead' AND entity_id = l.id
                                  UNION SELECT label_id FROM lead_labels WHERE lead_id = l.id)
                  ORDER BY lb.nome)) AS tags
      FROM leads l
      LEFT JOIN empresas e ON e.id = l.empresa_id
     WHERE l.id = ${id}::uuid AND l.organizacao_id = ${organizacaoId}::uuid`);
  if (!l) return null;
  return { id: l.id, empresa: l.empresa, empresaId: l.empresa_id, pessoa: l.pessoa, leadId: l.id, familia: null, tags: l.tags ?? [] };
}

async function lerCatalogo(organizacaoId: string): Promise<TagDoCatalogo[]> {
  const linhas = await db.execute<TagDoCatalogo>(sql`
    SELECT id::text, nome, cor FROM labels
     WHERE organizacao_id = ${organizacaoId}::uuid ORDER BY nome`);
  return [...linhas];
}

/** O alvo (oportunidade ou lead) com as tags que já tem, e o catálogo da organização. */
export async function acaoTagsDoAlvo(
  tipo: TipoAlvoDeTag, id: string,
): Promise<Resultado<{ alvo: AlvoDeTag | null; catalogo: TagDoCatalogo[] }>> {
  const org = await organizacao();
  if (!org) return { ok: false, erro: "Sessão expirada." };
  return executar("ler tags", async () => {
    const [alvo, catalogo] = await Promise.all([lerAlvo(org, tipo, id), lerCatalogo(org)]);
    return { alvo, catalogo };
  });
}

/* A peça não tem seletor de cor: a tag nasce com uma cor da paleta, escolhida
   pelo nome para que o mesmo nome caia sempre na mesma cor. Muda em Ajustes. */
const PALETA = ["#e23752", "#F97316", "#4C9EFF", "#8e27ef", "#1f7256", "#c2330f", "#0e7490", "#a16207"];
function corDoNome(nome: string): string {
  let h = 0;
  for (const ch of nome) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETA[h % PALETA.length];
}

/** Cria a tag na organização. Se já existe uma com o mesmo nome (sem caixa), devolve ela. */
export async function acaoCriarTag(nome: string): Promise<Resultado<TagDoCatalogo>> {
  const org = await organizacao();
  if (!org) return { ok: false, erro: "Sessão expirada." };
  const limpo = String(nome ?? "").trim();
  if (!limpo || limpo.length > 50) return { ok: false, erro: "O nome da tag precisa ter de 1 a 50 caracteres." };
  return executar("criar tag", async () => {
    const [existente] = await db.execute<TagDoCatalogo>(sql`
      SELECT id::text, nome, cor FROM labels
       WHERE organizacao_id = ${org}::uuid AND lower(nome) = lower(${limpo}) LIMIT 1`);
    if (existente) return existente;
    const [nova] = await db.execute<TagDoCatalogo>(sql`
      INSERT INTO labels (nome, cor, organizacao_id)
      VALUES (${limpo}, ${corDoNome(limpo)}, ${org}::uuid)
      RETURNING id::text, nome, cor`);
    return nova;
  });
}

/**
 * Aplica e remove tags no alvo. As que entram também vão para a empresa e para
 * a pessoa (o lead) quando a tela pede — remoção fica só no alvo, como no
 * protótipo: tirar a tag da oportunidade não apaga o que a empresa já tem.
 */
export async function acaoAplicarTags(entrada: {
  tipo: TipoAlvoDeTag; id: string;
  adicionar: string[]; remover: string[];
  naEmpresa: boolean; naPessoa: boolean;
}): Promise<Resultado<{ mudou: number }>> {
  const org = await organizacao();
  if (!org) return { ok: false, erro: "Sessão expirada." };
  return executar("aplicar tags", async () => {
    const alvo = await lerAlvo(org, entrada.tipo, entrada.id);
    if (!alvo) throw new RegraDeNegocio("ALVO_INEXISTENTE", "Este registro não existe nesta organização.");
    const entidade = entrada.tipo === "opp" ? "negocio" : "lead";
    const adicionar = (entrada.adicionar ?? []).filter((x) => UUID.test(x));
    const remover = (entrada.remover ?? []).filter((x) => UUID.test(x));
    let mudou = 0;
    for (const label of adicionar) {
      const r = await adicionarTag({ organizacaoId: org, entityType: entidade, entityId: alvo.id, label });
      if (!r.ok) throw new RegraDeNegocio("TAG_INEXISTENTE", "Uma das tags não existe mais. Recarregue e tente de novo.");
      if (r.mudou) mudou++;
      if (entrada.naEmpresa && alvo.empresaId) {
        await adicionarTag({ organizacaoId: org, entityType: "empresa", entityId: alvo.empresaId, label });
      }
      if (entrada.naPessoa && entrada.tipo === "opp" && alvo.leadId) {
        await adicionarTag({ organizacaoId: org, entityType: "lead", entityId: alvo.leadId, label });
      }
    }
    for (const label of remover) {
      const r = await removerTag({ organizacaoId: org, entityType: entidade, entityId: alvo.id, label });
      if (r.mudou) mudou++;
    }
    revalidatePath("/pipeline");
    revalidatePath("/pre-vendas");
    return { mudou };
  });
}
