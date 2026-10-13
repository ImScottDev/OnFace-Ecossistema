/* ─────────────────────────────────────────────────────────────────────────
 * O "registro" que as fichas de Empresa e Pessoa consomem.
 *
 * As duas telas do handoff são centradas em LEAD, não no diretório canônico:
 * pegam uma lista de leads e escolhem um alvo pelo `?registro=`. Por isso o
 * adaptador entrega o lead real achatado na forma que elas leem, em vez de
 * tentar encaixar `Empresa360` num molde que não é o dela.
 * ───────────────────────────────────────────────────────────────────────── */

import { ROTULO_CLASSE } from "@/lib/vendas/classificacao-rotulos";
import { formatarTelefone } from "@/lib/telefone";
import type { DetalheLead } from "@/lib/vendas/consultas";
import { qualDoDesenho } from "./qual-do-desenho";
import { linhasOrigemMeta } from "@/lib/vendas/respostas-formulario";

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
  qualificacao: Record<string, unknown>;
  acao: string | null;
  venceEm: string | null;
  dias: number;
  /** Toda resposta do formulário, na ordem em que veio. Vazio = não há. */
  respostas: Array<{ pergunta: string; resposta: string }>;
  obs?: string | null;
  cidadeContato?: string | null;
  /** Origem e rastreamento: só as linhas que têm dado. `href` só existe com id real. */
  rastreio: Array<{ rotulo: string; valor: string; href?: string }>;
  /** Campos que a produção mostrava (E12): score do lead e telefone/observações da empresa. */
  leadScore: number;
  empresaTel: string | null;
  empresaObs: string | null;
  /** Anúncio de origem na Biblioteca de Anúncios; só com id real. */
  anuncioHref: string | null;
}

/** Biblioteca de Anúncios da Meta: pública, abre o criativo pelo id do anúncio
 *  sem exigir login na conta de anúncios (o Gerenciador exige). */
export function linkDoAnuncio(adId: string | null): string | null {
  const id = adId?.trim();
  return id && /^\d+$/.test(id) ? `https://www.facebook.com/ads/library/?id=${id}` : null;
}

export function rastreioDoLead(a: DetalheLead["atribuicao"], meta?: Record<string, string>): RegistroDoDesenho["rastreio"] {
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
  for (const l of linhasOrigemMeta(meta)) add(l.rotulo, l.valor);
  return linhas;
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
    tel: formatarTelefone(l.pessoa.telefone) || null,
    whatsapp: formatarTelefone(l.pessoa.whatsapp) || null,
    /* A ficha monta "linkedin.com/in/" + o nome quando o campo não vem, e o
       botão "Abrir LinkedIn" leva a um perfil que não é da pessoa. Passar o
       valor real — ou `null` — é o que faz a tela mostrar "—" em vez de um
       endereço plausível e errado. Só 65 dos 4.066 leads têm o campo. */
    linkedin: l.pessoa.linkedin,
    obs: l.pessoa.observacao,
    cidadeContato: l.pessoa.cidade,
    /* As tags REAIS do lead (tabela `labels`). O desenho só monta tags de
       exemplo quando não há registro; com registro, a lista vem daqui — e
       vinha vazia porque eu não a passava. */
    tags: l.tags.map((t) => t.nome),
    etapa: l.etapa,
    /* Cliente = a empresa está na carteira (serviço ativo). Antes bastava
       qualquer oportunidade em "ganho", e quem ganhou e cancelou seguia como
       Cliente na ficha enquanto Contatos já dizia outra coisa (P12). */
    rel: ROTULO_CLASSE[l.classificacao.classe],
    resp: l.responsavel.nome,
    origem: l.atribuicao.origem,
    campanha: l.atribuicao.campanha,
    interesse: l.servicos?.[0] ?? null,
    /* Qualificação real (interesse/tamanho/dor/fit), da MESMA fonte do drawer.
       Antes a ficha de Empresa lia `P.qualificacao` que nunca era preenchido,
       e caía em valores de exemplo ("Alto custo com telefonia"). */
    qualificacao: qualDoDesenho(l.qualificacao) ?? {},
    acao: l.proximaAcao?.titulo ?? null,
    venceEm: l.proximaAcao?.venceEm ?? null,
    dias: diasDesde(l.criadoEm),
    respostas: l.respostasFormulario,
    rastreio: rastreioDoLead(l.atribuicao, l.metaRastreio),
    leadScore: l.leadScore,
    empresaTel: formatarTelefone(l.empresa.telefone) || null,
    empresaObs: l.empresa.observacoes,
    anuncioHref: linkDoAnuncio(l.atribuicao.metaAdId),
  };
}
