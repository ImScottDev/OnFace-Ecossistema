/* ─────────────────────────────────────────────────────────────────────────
 * As saídas do lead: do que a peça grava para o command que o domínio expõe.
 *
 * O protótipo persiste do jeito dele — escreve o array `leads` inteiro no
 * store e segue. O produto tem um command por intenção (qualificar, nutrir,
 * desqualificar, atribuir), e cada um com regra própria.
 *
 * Este arquivo é a ponte: recebe o lead ANTES e DEPOIS e diz qual intenção
 * aquilo foi. Sem ele, a única alternativa seria editar o arquivo gerado.
 * ───────────────────────────────────────────────────────────────────────── */

import {
  MOTIVOS_DESQUALIFICACAO, MOTIVOS_NUTRICAO,
  type MotivoDesqualificacao, type MotivoNutricao,
} from "@/lib/vendas/dominio";

/** As etapas que `acaoMoverEtapa` aceita — o resto tem command próprio. */
export const ETAPAS_SIMPLES = new Set(["novo", "em_contato", "qualificacao"]);

/**
 * A ordem do funil, para o diff nunca mandar um lead para TRÁS.
 *
 * Este diff existe para traduzir o que a pessoa fez na tela em comando. Só que
 * o servidor também avança a etapa sozinho — registrar ligação, WhatsApp ou
 * e-mail move o lead para "Em contato". Quando isso acontece, a lista em
 * memória ainda tem a etapa antiga; a repintura seguinte vira um diff
 * "em_contato → novo" e o lead voltava, segundos depois de avançar.
 *
 * Medido em produção em 15/10/2026: o lead do Johnny Silva oscilou cinco vezes
 * entre Novo e Em contato em onze minutos, sempre em nome de quem tinha acabado
 * de ligar; 7 leads no mesmo dia.
 *
 * Regra do Scott: interação move para frente, nunca para trás. Voltar etapa
 * deixa de ser efeito colateral de repintura — quem quiser mesmo regredir usa o
 * seletor de etapa da ficha, que chama o command direto.
 */
const ORDEM_DO_FUNIL = ["novo", "em_contato", "qualificacao", "qualificado", "oportunidade"];
function regrediu(de: string | null | undefined, para: string): boolean {
  const i = ORDEM_DO_FUNIL.indexOf(de ?? "");
  const j = ORDEM_DO_FUNIL.indexOf(para);
  return i >= 0 && j >= 0 && j < i;
}

const CHAVES_NUTRICAO = new Set<string>(MOTIVOS_NUTRICAO.map((m) => m.chave));
const CHAVES_DESQUALIFICACAO = new Set<string>(MOTIVOS_DESQUALIFICACAO.map((m) => m.chave));

/**
 * Os dois motivos em que o handoff e o domínio usam nomes diferentes.
 *
 * O protótipo oferece "Sem interesse" e "Dados inválidos"; o domínio chama de
 * `sem_necessidade` e `contato_invalido`. Traduzir é melhor do que gravar uma
 * chave que o relatório de perdas não conhece — ali ela viraria uma fatia
 * "outro" que ninguém sabe ler.
 *
 * Se o handoff for corrigido para usar as chaves do domínio, este mapa fica
 * inerte sozinho: as chaves já corretas passam direto.
 */
const DESQUALIFICACAO_DO_PROTOTIPO: Record<string, MotivoDesqualificacao> = {
  sem_interesse: "sem_necessidade",
  dados_invalidos: "contato_invalido",
};

export function motivoDeNutricao(chave: string | null | undefined): MotivoNutricao | null {
  if (!chave) return null;
  return CHAVES_NUTRICAO.has(chave) ? (chave as MotivoNutricao) : null;
}

export function motivoDeDesqualificacao(chave: string | null | undefined): MotivoDesqualificacao | null {
  if (!chave) return null;
  const traduzido = DESQUALIFICACAO_DO_PROTOTIPO[chave];
  if (traduzido) return traduzido;
  return CHAVES_DESQUALIFICACAO.has(chave) ? (chave as MotivoDesqualificacao) : null;
}

/** O lead na forma em que o desenho o guarda. */
export interface LeadDoEstado {
  id: string;
  etapa?: string;
  resp?: string | null;
  venceEm?: string | null;
  interesse?: string | null;
  empresa?: string | null;
  pessoa?: string | null;
}

/** O que o usuário quis fazer, deduzido da diferença entre antes e depois. */
export type Intencao =
  | { tipo: "mover"; leadId: string; para: "novo" | "em_contato" | "qualificacao" }
  | { tipo: "qualificar"; leadId: string }
  | { tipo: "nutrir"; leadId: string; retomarEm: string | null }
  | { tipo: "desqualificar"; leadId: string }
  | { tipo: "criar-oportunidade"; leadId: string; empresa: string | null; interesse: string | null; responsavel: string | null; /** etapa de onde o lead saiu: só quem já estava qualificado dispensa qualificar antes. */ de?: string | null }
  | { tipo: "atribuir"; leadId: string; responsavel: string | null }
  | { tipo: "desconhecida"; leadId: string; descricao: string };

/**
 * Compara as duas listas e devolve o que mudou, uma intenção por lead.
 *
 * Lead novo na lista é ignorado: criar lead tem fluxo próprio, e tratar
 * "apareceu" como mudança faria a primeira renderização disparar um command
 * por lead da base.
 */
export function intencoesDoPatch(
  antes: LeadDoEstado[] | null | undefined,
  depois: LeadDoEstado[] | null | undefined,
): Intencao[] {
  if (!antes?.length || !depois?.length) return [];
  const anterior = new Map(antes.map((l) => [l.id, l]));
  const saida: Intencao[] = [];

  for (const d of depois) {
    const a = anterior.get(d.id);
    if (!a) continue;

    if (a.etapa !== d.etapa && d.etapa) {
      if (ETAPAS_SIMPLES.has(d.etapa)) {
        // Repintura com estado velho não desfaz o avanço que o servidor gravou.
        if (regrediu(a.etapa, d.etapa)) continue;
        saida.push({ tipo: "mover", leadId: d.id, para: d.etapa as "novo" | "em_contato" | "qualificacao" });
      } else if (d.etapa === "qualificado") {
        saida.push({ tipo: "qualificar", leadId: d.id });
      } else if (d.etapa === "nutricao") {
        saida.push({ tipo: "nutrir", leadId: d.id, retomarEm: d.venceEm ?? null });
      } else if (d.etapa === "desqualificado") {
        saida.push({ tipo: "desqualificar", leadId: d.id });
      } else if (d.etapa === "oportunidade") {
        saida.push({
          tipo: "criar-oportunidade", leadId: d.id,
          empresa: d.empresa ?? null, interesse: d.interesse ?? null, responsavel: d.resp ?? null, de: a.etapa ?? null,
        });
      } else {
        saida.push({ tipo: "desconhecida", leadId: d.id, descricao: `etapa "${d.etapa}"` });
      }
      continue;
    }

    if (a.resp !== d.resp) {
      saida.push({ tipo: "atribuir", leadId: d.id, responsavel: d.resp ?? null });
    }
  }

  return saida;
}
