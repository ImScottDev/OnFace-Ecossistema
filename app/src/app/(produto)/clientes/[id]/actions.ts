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
import { getTenantContext } from "@/lib/auth/tenant";
import { criarOportunidade } from "@/lib/vendas/pipeline";
import { RegraDeNegocio } from "@/lib/vendas/dominio";
import type { Familia, Motion, ProcessoOrigem } from "@/lib/vendas/dominio";

export type TipoDeVenda = "expansao" | "upgrade" | "crosssell" | "renovacao";

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
