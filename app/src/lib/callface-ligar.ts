import { toast } from "sonner";

/**
 * Única porta do botão "Ligar": o Callface abre a tela de chamada em
 * `/calls?call_to=<número>`. O número vai só em dígitos, sem o 55 do país.
 * Telefone vazio ou curto devolve null — quem chama avisa, não finge ligar.
 */
export function urlLigarCallface(telefone: unknown): string | null {
  let n = String(telefone ?? "").replace(/\D/g, "");
  if (n.length > 11 && n.startsWith("55")) n = n.slice(2);
  return n.length >= 10 ? `https://app.callface.ai/calls?call_to=${n}` : null;
}

/**
 * Ponto único de saída para URL externa das Ligas. Se for ligação
 * (`call_to=`), normaliza o número; sem telefone válido avisa em vez de abrir
 * uma aba morta. O host pode assumir a abertura (`abrir`); sem ele, nova aba.
 */
export function abrirUrlExterna(url: string, abrir?: (u: string) => void): void {
  let alvo = url;
  const i = url.indexOf("call_to=");
  if (i >= 0) {
    let bruto = url.slice(i + 8);
    try { bruto = decodeURIComponent(bruto); } catch { /* número já cru */ }
    const ligar = urlLigarCallface(bruto);
    if (!ligar) { toast.warning("Sem telefone cadastrado para ligar."); return; }
    alvo = ligar;
  }
  if (abrir) abrir(alvo); else window.open(alvo, "_blank", "noopener");
}
