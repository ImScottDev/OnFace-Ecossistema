/**
 * Elo entre o Módulo Vendas e o Atendimento do ONFACE.
 *
 * Nenhuma ação de contato sai do sistema. `wa.me`, `mailto:` e `tel:` jogam o
 * operador para fora do produto e deixam a conversa sem registro nenhum — o
 * histórico do lead fica com um buraco exatamente no momento em que alguém
 * falou com ele. Todo canal entra pelo workspace de Atendimento, que já sabe
 * resolver a conversa por lead ou por telefone e já grava o que foi dito.
 */

export type CanalAtendimento = "whatsapp" | "email" | "ligacao";

export interface AlvoDeContato {
  leadId?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
}

/** Só dígitos, sem o 55 do país: é como o discador e a lista de conversas
 *  normalizam o número antes de casar uma conversa com um lead. */
export function digitosDeContato(valor: string | null | undefined): string | null {
  if (!valor) return null;
  let d = valor.replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  return d.length >= 10 ? d : null;
}

/**
 * URL do Atendimento já posicionado no canal e no contato certos.
 *
 * Devolve `null` quando não há dado suficiente para abrir a conversa certa:
 * botão que leva a um inbox genérico é pior que botão ausente, porque parece
 * ter funcionado.
 */
export function urlAtendimento(
  canal: CanalAtendimento,
  alvo: AlvoDeContato,
  texto?: string | null,
): string | null {
  const telefone = digitosDeContato(alvo.whatsapp) ?? digitosDeContato(alvo.telefone);
  const leadId = alvo.leadId ?? null;

  if (canal === "email" && !alvo.email) return null;
  if ((canal === "whatsapp" || canal === "ligacao") && !telefone) return null;
  // E-mail é o único canal que o workspace resolve apenas por lead: não existe
  // busca de thread por endereço solto.
  if (canal === "email" && !leadId) return null;

  const params = new URLSearchParams({ canal });
  if (leadId) params.set("leadId", leadId);
  if (telefone) params.set("telefone", telefone);
  if (texto) params.set("texto", texto);
  return `/atendimento?${params.toString()}`;
}

/** Quais canais este contato de fato suporta agora. */
export function canaisDisponiveis(alvo: AlvoDeContato): CanalAtendimento[] {
  return (["whatsapp", "ligacao", "email"] as const).filter((c) => urlAtendimento(c, alvo) !== null);
}
