/**
 * Origem canônica do lead.
 *
 * A base mistura jeitos de escrever a mesma origem: `meta_ads` e "Mídia Paga",
 * `organico` e "Orgânico", `direto` e `(direct)`. Em vez de reescrever o dado
 * (um dump novo de produção traria tudo de volta), a unificação mora na LEITURA:
 * todo lugar que mostra ou filtra origem passa por aqui. Nome próprio de fonte
 * (RD Station, ZohoDesk, Webinar…) passa como veio.
 */
const SEM_ACENTO = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const CANONICA: Record<string, string> = {
  meta_ads: "Mídia Paga", "midia paga": "Mídia Paga", "meta ads": "Mídia Paga", facebook_ads: "Mídia Paga",
  organico: "Orgânico", "organic": "Orgânico",
  direto: "Direto", "(direct)": "Direto", direct: "Direto",
  indicacao: "Indicação", "(referral)": "Indicação", referral: "Indicação",
  apollo: "Outbound", outbound: "Outbound",
  manual: "Manual", whatsapp: "WhatsApp", site: "Site",
};

export function origemCanonica(bruta: string | null | undefined): string | null {
  const t = (bruta ?? "").trim();
  if (!t || /^n[aã]o definido$/i.test(t)) return null;
  return CANONICA[SEM_ACENTO(t)] ?? t;
}
