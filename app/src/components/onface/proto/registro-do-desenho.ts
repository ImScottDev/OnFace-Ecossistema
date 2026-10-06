/* ─────────────────────────────────────────────────────────────────────────
 * O "registro" que as fichas de Empresa e Pessoa consomem.
 *
 * As duas telas do handoff são centradas em LEAD, não no diretório canônico:
 * pegam uma lista de leads e escolhem um alvo pelo `?registro=`. Por isso o
 * adaptador entrega o lead real achatado na forma que elas leem, em vez de
 * tentar encaixar `Empresa360` num molde que não é o dela.
 * ───────────────────────────────────────────────────────────────────────── */

import type { DetalheLead } from "@/lib/vendas/consultas";

/** O lead na forma que as fichas leem. */
export interface RegistroDoDesenho {
  id: string;
  registro: string;
  pessoa: string;
  cargo: string;
  empresa: string | null;
  empresaId: string | null;
  cnpj: string | null;
  cidade: string | null;
  segmento: string | null;
  site: string | null;
  email: string | null;
  tel: string | null;
  whatsapp: string | null;
  linkedin: string | null;
  tags: string[];
  etapa: string;
  rel: string;
  resp: string | null;
  origem: string | null;
  campanha: string | null;
  interesse: string | null;
  acao: string | null;
  venceEm: string | null;
  dias: number;
  /** Toda resposta do formulário, na ordem em que veio. Vazio = não há. */
  respostas: Array<{ pergunta: string; resposta: string }>;
  /** Origem e rastreamento: só as linhas que têm dado. `href` só existe com id real. */
  rastreio: Array<{ rotulo: string; valor: string; href?: string }>;
}

/** Biblioteca de Anúncios da Meta: pública, abre o criativo pelo id do anúncio
 *  sem exigir login na conta de anúncios (o Gerenciador exige). */
export function linkDoAnuncio(adId: string | null): string | null {
  const id = adId?.trim();
  return id && /^\d+$/.test(id) ? `https://www.facebook.com/ads/library/?id=${id}` : null;
}

export function rastreioDoLead(a: DetalheLead["atribuicao"]): RegistroDoDesenho["rastreio"] {
  const linhas: RegistroDoDesenho["rastreio"] = [];
  const add = (rotulo: string, valor: string | null, href?: string | null) => {
    if (valor?.trim()) linhas.push(href ? { rotulo, valor: valor.trim(), href } : { rotulo, valor: valor.trim() });
  };
  add("Campanha", a.campanha);
  add("Meio (utm_medium)", a.medium);
  add("Conteúdo (utm_content)", a.conteudo);
  add("Termo (utm_term)", a.termo);
  add("Landing page", a.landingPage);
  add("ID da campanha (Meta)", a.metaCampaignId);
  add("ID do conjunto (Meta)", a.metaAdsetId);
  add("ID do anúncio (Meta)", a.metaAdId, linkDoAnuncio(a.metaAdId));
  return linhas;
}

/**
 * O relacionamento, derivado da etapa do lead.
 *
 * A ficha mostra "Cliente", "Lead", "Prospect" ou "Contato" — é o vocabulário
 * do diretório. A etapa de pré-vendas é o que o produto sabe hoje; quando uma
 * oportunidade é ganha, o lead sai do board e o cliente vive em outro lugar.
 */
export function relacionamentoDaEtapa(etapa: string): string {
  if (etapa === "oportunidade") return "Prospect";
  if (etapa === "desqualificado") return "Contato";
  return "Lead";
}

/** Quantos dias desde a data, ou 0 quando não há data. */
function diasDesde(iso: string | null): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

/**
 * `DetalheLead` na forma do desenho.
 *
 * Campo ausente vira `null`, nunca um valor plausível: estas telas mostram
 * e-mail e telefone, e um contato inventado é pior do que um campo vazio —
 * alguém liga.
 */
export function registroDoDesenho(l: DetalheLead): RegistroDoDesenho {
  return {
    id: l.id,
    registro: l.id,
    pessoa: l.pessoa.nome,
    cargo: l.pessoa.cargo ?? "",
    empresa: l.empresa.nome || null,
    empresaId: l.empresa.id,
    cnpj: l.empresa.cnpj,
    cidade: l.empresa.cidade,
    segmento: l.empresa.setor,
    site: l.empresa.website,
    email: l.pessoa.email,
    tel: l.pessoa.telefone,
    whatsapp: l.pessoa.whatsapp,
    /* A ficha monta "linkedin.com/in/" + o nome quando o campo não vem, e o
       botão "Abrir LinkedIn" leva a um perfil que não é da pessoa. Passar o
       valor real — ou `null` — é o que faz a tela mostrar "—" em vez de um
       endereço plausível e errado. Só 65 dos 4.066 leads têm o campo. */
    linkedin: l.pessoa.linkedin,
    /* As tags REAIS do lead (tabela `labels`). O desenho só monta tags de
       exemplo quando não há registro; com registro, a lista vem daqui — e
       vinha vazia porque eu não a passava. */
    tags: l.tags.map((t) => t.nome),
    etapa: l.etapa,
    /* Cliente ganha do estágio de pré-vendas: um lead com oportunidade em
       "ganho" é cliente, mesmo que a etapa do lead tenha parado em "novo" na
       migração. Sem isto a ficha mostrava "Lead" no topo de quem já paga. */
    rel: l.oportunidades.some((o) => o.etapa === "ganho")
      ? "Cliente"
      : relacionamentoDaEtapa(l.etapa),
    resp: l.responsavel.nome,
    origem: l.atribuicao.origem,
    campanha: l.atribuicao.campanha,
    interesse: l.servicos?.[0] ?? null,
    acao: l.proximaAcao?.titulo ?? null,
    venceEm: l.proximaAcao?.venceEm ?? null,
    dias: diasDesde(l.criadoEm),
    respostas: l.respostasFormulario,
    rastreio: rastreioDoLead(l.atribuicao),
  };
}
