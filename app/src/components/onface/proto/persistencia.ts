/* ─────────────────────────────────────────────────────────────────────────
 * A tradução entre o desenho e os commands de vendas.
 *
 * Pipeline e Oportunidade mexem nas MESMAS oportunidades pelas mesmas regras —
 * um pelo arraste, o outro pelo botão. Escrever a tradução duas vezes garantia
 * que um dia elas discordassem sobre o que é uma perda válida.
 * ───────────────────────────────────────────────────────────────────────── */

import { MOTIVOS_PERDA, type EtapaPipelineAberta, type MotivoPerda } from "@/lib/vendas/dominio";
import type { Resultado } from "@/lib/vendas/resultado";

/** Rótulo do protótipo → chave do domínio. Os textos batem um a um. */
const CHAVE_DO_MOTIVO: Map<string, MotivoPerda> = new Map(
  MOTIVOS_PERDA.map((m) => [m.rotulo as string, m.chave]),
);

/** As etapas que `moverEtapa` aceita. Ganho e Perdido têm command próprio. */
const ETAPAS_ABERTAS = new Set(["entrada", "diagnostico", "proposta", "negociacao"]);

/* `Resultado` é o contrato que as server actions já devolvem — inclusive o
   `acao` do CTA. Reescrevê-lo aqui só criaria uma segunda verdade. */
export interface CommandsDeEtapa {
  moverEtapa: (negocioId: string, para: EtapaPipelineAberta) => Promise<Resultado>;
  perder: (negocioId: string, motivo: MotivoPerda, detalhe: string | null) => Promise<Resultado>;
  tentarGanhar: (negocioId: string) => Promise<Resultado<{ ganhou: boolean; motivo: string }>>;
}

/** O que aconteceu, para quem chamou decidir o que mostrar. */
export type Desfecho =
  | { tipo: "gravou" }
  | { tipo: "recusado"; motivo: string; acao?: { rotulo: string; tipo: string } }
  | { tipo: "sem-command"; motivo: string };

/**
 * Leva uma mudança de etapa ao command certo.
 *
 * Devolve o desfecho em vez de já mostrar o toast: quem chama sabe se tem um
 * modal para abrir no CTA, e essa decisão é da tela.
 */
export async function persistirEtapa(
  antes: { etapa?: string } | null | undefined,
  depois: { id: string; etapa: string; motivoPerda?: string | null; obsPerda?: string | null },
  evento: string,
  acoes: CommandsDeEtapa,
): Promise<Desfecho> {
  if (!antes || antes.etapa === depois.etapa) {
    return { tipo: "sem-command", motivo: `"${evento}" ainda não é gravado por esta tela.` };
  }

  let r: Resultado<{ ganhou: boolean; motivo: string }> | Resultado;

  if (depois.etapa === "perdido") {
    const motivo = CHAVE_DO_MOTIVO.get(depois.motivoPerda ?? "");
    if (!motivo) {
      return { tipo: "recusado", motivo: `Motivo de perda desconhecido: ${depois.motivoPerda}` };
    }
    r = await acoes.perder(depois.id, motivo, depois.obsPerda?.trim() || null);
  } else if (depois.etapa === "ganho") {
    // Ganho não se marca, se TENTA: o gate de evidência é quem decide.
    const g = await acoes.tentarGanhar(depois.id);
    if (g.ok && g.dados && !g.dados.ganhou) {
      return { tipo: "recusado", motivo: g.dados.motivo };
    }
    r = g;
  } else if (ETAPAS_ABERTAS.has(depois.etapa)) {
    r = await acoes.moverEtapa(depois.id, depois.etapa as EtapaPipelineAberta);
  } else {
    return { tipo: "recusado", motivo: `Etapa desconhecida: ${depois.etapa}` };
  }

  if (!r.ok) {
    // `acao` é o CTA que destrava — "Definir família", "Criar proposta".
    // Perder isto deixa o operador travado sabendo o problema e não a saída.
    return { tipo: "recusado", motivo: r.erro, acao: r.acao };
  }
  return { tipo: "gravou" };
}
