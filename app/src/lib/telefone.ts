/**
 * Telefone: a única régua, no cliente (máscara do campo) e no servidor
 * (normalização que vai para o banco). Sem dependência de `db`, então Client
 * Component pode importar.
 *
 * Forma gravada: E.164 ("+5511999999999"). Sem "+", assume Brasil (+55).
 * Com "+", o código do país digitado é respeitado.
 */

const soDigitos = (v: string) => v.replace(/\D/g, "");

/** E.164 ("+55…") ou null quando não dá para confiar que é um número. */
export function normalizarE164(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const bruto = valor.trim();
  const d = soDigitos(bruto);
  if (!d) return null;
  if (bruto.startsWith("+") || bruto.startsWith("00")) {
    const n = bruto.startsWith("00") ? d.slice(2) : d;
    if (n.startsWith("55")) return /^55\d{10,11}$/.test(n) ? "+" + n : null;
    return n.length >= 8 && n.length <= 15 && !n.startsWith("0") ? "+" + n : null;
  }
  if (/^55[1-9]\d{9,10}$/.test(d)) return "+" + d; // 12-13 dígitos: já traz o país (DDD 55 local tem só 10-11)
  if (/^[1-9]\d{9,10}$/.test(d)) return "+55" + d;
  return null;
}

/**
 * Chave de comparação: a mesma para "(11) 99999-0001", "11999990001",
 * "+55 11 99999-0001" e "5511999990001". Base tem formato misto, então toda
 * comparação passa por aqui (ou por `telefoneChaveSql`, que faz o mesmo no banco).
 */
export function chaveTelefone(valor: string | null | undefined): string | null {
  const e = normalizarE164(valor);
  return e ? e.slice(1) : null;
}

/** Máscara do campo enquanto digita. BR: (11) 99999-9999. Com "+": mantém o país. */
export function mascararTelefone(entrada: string): string {
  const v = entrada.trim();
  const d = soDigitos(v);
  if (!d) return v.startsWith("+") ? "+" : "";
  if (v.startsWith("+")) {
    if (d.startsWith("55")) return "+55" + (d.length > 2 ? " " + mascaraBr(d.slice(2, 13)) : "");
    return "+" + d.slice(0, 15);
  }
  return mascaraBr(d.slice(0, 11));
}

function mascaraBr(d: string): string {
  if (d.length <= 2) return d.length ? "(" + d : "";
  const ddd = d.slice(0, 2), resto = d.slice(2);
  if (resto.length <= 4) return `(${ddd}) ${resto}`;
  const corte = d.length > 10 ? 5 : 4;
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

/** Como mostrar um telefone já gravado (E.164 ou legado). Desconhecido passa como veio. */
export function formatarTelefone(valor: string | null | undefined): string {
  if (!valor) return "";
  const e = normalizarE164(valor);
  if (!e) return valor;
  return e.startsWith("+55") ? "+55 " + mascaraBr(e.slice(3)) : e;
}
