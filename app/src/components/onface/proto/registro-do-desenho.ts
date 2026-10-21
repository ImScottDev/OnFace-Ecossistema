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

/**
 * Link para o criativo, no Gerenciador de Anúncios.
 *
 * **Sem a conta, este link mente.** O Gerenciador abre na última conta que a
 * pessoa usou e aplica o `selected_ad_ids` ali: em 21/10 um anúncio da conta
 * 1979606826185515 abriu na 867028606744143 e listou dois criativos que não
 * eram o dele — pior que não abrir, porque o errado parece certo. Por isso,
 * sem `adAccountId`, o link não é oferecido.
 *
 * Era a Biblioteca de Anúncios (`/ads/library/?id=`) por ser pública, e **não
 * funcionava**: o `id` da Biblioteca é o *Ad Archive ID*, que não é o `ad_id`
 * do Gerenciador. Buscar um ad_id lá dá "nenhum anúncio encontrado". E mesmo
 * com o id certo a Biblioteca só mantém anúncio ativo (ou político), então
 * criativo de campanha encerrada — o caso mais comum numa ficha antiga — some
 * de qualquer jeito.
 *
 * O Gerenciador resolve por `ad_id` e guarda o histórico. Exige login na conta
 * de anúncios, e é o preço de o link de fato abrir o criativo.
 */
export function linkDoAnuncio(adId: string | null, adAccountId?: string | null): string | null {
  const id = adId?.trim();
  if (!id || !/^\d+$/.test(id)) return null;
  const conta = adAccountId?.trim();
  if (!conta) return null;
  const act = conta.startsWith("act_") ? conta.slice(4) : conta;
  return `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${act}&selected_ad_ids=${id}`;
}

/** Mesma régua para o conjunto e para a campanha: o Gerenciador abre os três. */
export function linkDoConjunto(adsetId: string | null, adAccountId?: string | null): string | null {
  const id = adsetId?.trim();
  if (!id || !/^\d+$/.test(id)) return null;
  const conta = adAccountId?.trim();
  if (!conta) return null;
  const act = conta.startsWith("act_") ? conta.slice(4) : conta;
  return `https://adsmanager.facebook.com/adsmanager/manage/adsets?act=${act}&selected_adset_ids=${id}`;
}

export function linkDaCampanha(campaignId: string | null, adAccountId?: string | null): string | null {
  const id = campaignId?.trim();
  if (!id || !/^\d+$/.test(id)) return null;
  const conta = adAccountId?.trim();
  if (!conta) return null;
  const act = conta.startsWith("act_") ? conta.slice(4) : conta;
  return `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${act}&selected_campaign_ids=${id}`;
}

/**
 * Origem do contato, legível.
 *
 * Antes a ficha mostrava a MESMA coisa duas vezes: o nome, com rótulo de
 * jargão ("Conteúdo (utm_content)"), e o id, como número cru de 17 dígitos
 * ("ID do anúncio (Meta)"). Ninguém lê `120249446086250170`, e quem lê
 * "Conteúdo (utm_content): Ads_copiloto" não sabe que aquilo é o nome do
 * anúncio.
 *
 * Para lead de Meta Lead Ads os dois são a mesma entidade: foi o próprio
 * sistema que preencheu `utm_term` com o conjunto e `utm_content` com o
 * anúncio, a partir do `traffic_value` que a Meta manda como
 * "{conjunto}@{anúncio}". Então viram uma linha só, com o nome à frente e o id
 * levando ao Gerenciador.
 *
 * Sem id da Meta (lead de outra origem), `utm_term` e `utm_content` voltam a
 * ser o que são — termo e conteúdo de UTM, que em busca paga significam outra
 * coisa — e continuam com o rótulo técnico.
 */
export function rastreioDoLead(
  a: DetalheLead["atribuicao"], meta?: Record<string, string>,
): RegistroDoDesenho["rastreio"] {
  // A conta vem DENTRO da atribuição, do servidor: como terceiro parâmetro,
  // qualquer chamador que a esquecesse perdia todos os links em silêncio.
  const adAccountId = a.metaAdAccountId;
  const linhas: RegistroDoDesenho["rastreio"] = [];
  const add = (rotulo: string, valor: string | null, href?: string | null) => {
    if (valor?.trim()) linhas.push(href ? { rotulo, valor: valor.trim(), href } : { rotulo, valor: valor.trim() });
  };
  const txt = (v: string | null | undefined) => (v?.trim() ? v.trim() : null);
  const doMeta = Boolean(txt(a.metaCampaignId) || txt(a.metaAdsetId) || txt(a.metaAdId));

  /* O NOME vem da própria Meta. `camposRastreioMeta` grava `meta_ad_nome`,
     `meta_conjunto_nome` e `meta_campanha_nome` desde que o Lead Ads existe, e
     a ficha não lia nenhum dos três: mostrava o id de 17 dígitos e, em outra
     linha, o mesmo nome rotulado como "Conteúdo (utm_content)". A UTM é o
     fallback — ela só carrega o nome porque o código a preencheu a partir do
     `traffic_value`, e em campanha nativa nem sempre existe. */
  add("Campanha", txt(meta?.meta_campanha_nome) ?? txt(a.campanha) ?? txt(a.metaCampaignId),
    linkDaCampanha(a.metaCampaignId, adAccountId));
  add("Meio (utm_medium)", a.medium);
  if (doMeta) {
    add("Conjunto", txt(meta?.meta_conjunto_nome) ?? txt(a.termo) ?? txt(a.metaAdsetId),
      linkDoConjunto(a.metaAdsetId, adAccountId));
    add("Anúncio", txt(meta?.meta_ad_nome) ?? txt(a.conteudo) ?? txt(a.metaAdId),
      linkDoAnuncio(a.metaAdId, adAccountId));
  } else {
    add("Conteúdo (utm_content)", a.conteudo);
    add("Termo (utm_term)", a.termo);
  }
  add("Landing page", a.landingPage);
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
    anuncioHref: linkDoAnuncio(l.atribuicao.metaAdId, l.atribuicao.metaAdAccountId),
  };
}
