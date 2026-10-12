/**
 * Quando dois registros de lead são a MESMA pessoa.
 *
 * O modelo é 1:1 por construção (`pessoas.lead_id_legado` e
 * `aquisicoes.lead_legado_id` são únicos, e hoje cada pessoa tem uma
 * aquisição), mas a MESMA pessoa entra mais de uma vez: a Meta e o formulário
 * do site mandam o mesmo contato, e a deduplicação só liga uma parte dos pares
 * (`leads.canonical_lead_id`). O card "Relações em andamento" da Pessoa precisa
 * mostrar todas as aquisições dela, e é esta regra que diz quais são.
 *
 * Pura (sem banco): a consulta traz os candidatos, aqui se decide. Três provas
 * de identidade, da mais forte para a mais fraca:
 *   1. o mesmo registro, a mesma pessoa canônica ou o vínculo de deduplicação;
 *   2. o mesmo e-mail;
 *   3. o mesmo telefone E o mesmo primeiro nome.
 *
 * Telefone sozinho NÃO basta: central telefônica e número-lixo ("1000000000",
 * 6 leads de nomes diferentes no banco local) ligariam gente que não se
 * conhece, e a ficha de uma pessoa passaria a mostrar a negociação de outra.
 */

export interface IdentidadeDoLead {
  id: string;
  pessoaId?: string | null;
  canonicalLeadId?: string | null;
  nome?: string | null;
  email?: string | null;
  telefones?: Array<string | null | undefined>;
}

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export const emailNormalizado = (e: string | null | undefined): string | null => {
  const v = (e ?? "").trim().toLowerCase();
  return v.includes("@") ? v : null;
};

/** Só dígitos, sem o 55 do país: o número comparável, ou null quando não é telefone utilizável. */
export function telefoneDeIdentidade(t: string | null | undefined): string | null {
  let d = (t ?? "").replace(/\D/g, "");
  if (d.startsWith("55") && d.length > 11) d = d.slice(2);
  if (d.length < 10) return null;
  // "0000000000", "1000000000", "11111111111": preenchimento, não número.
  if (/^(\d)\1*$/.test(d) || /^\d0{9,}$/.test(d)) return null;
  return d;
}

export const primeiroNome = (n: string | null | undefined): string => semAcento((n ?? "").trim().split(/\s+/)[0] ?? "");

export function mesmaPessoa(a: IdentidadeDoLead, b: IdentidadeDoLead): boolean {
  if (a.id === b.id) return true;
  if (a.pessoaId && a.pessoaId === b.pessoaId) return true;
  if (a.canonicalLeadId === b.id || b.canonicalLeadId === a.id) return true;
  if (a.canonicalLeadId && a.canonicalLeadId === b.canonicalLeadId) return true;

  const ea = emailNormalizado(a.email);
  if (ea && ea === emailNormalizado(b.email)) return true;

  const fa = new Set((a.telefones ?? []).map(telefoneDeIdentidade).filter((x): x is string => !!x));
  const compartilha = (b.telefones ?? []).map(telefoneDeIdentidade).some((x) => !!x && fa.has(x));
  const na = primeiroNome(a.nome);
  return compartilha && !!na && na === primeiroNome(b.nome);
}
