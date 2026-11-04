"use server";

import { getTenantContext } from "@/lib/auth/tenant";
import { dispararAgenteDeVoz, telefoneParaPlanilha } from "@/lib/integrations/callface-agente-voz";

/**
 * Ligação de teste do agente de voz, sem passar por lead nenhum.
 *
 * Serve para experimentar o roteiro e o contexto antes de apontar o fluxo de
 * Pré-vendas para ele: preenche-se o que o CRM mandaria e ouve-se o resultado.
 * Fica atrás do login de propósito — cada disparo gasta minuto de agente, e
 * um formulário aberto na internet seria uma torneira de ligação com custo.
 */
export interface ResultadoTeste {
  ok: boolean;
  mensagem: string;
}

export async function ligarDeTeste(entrada: {
  nome: string; telefone: string; email: string; empresa: string; origem: string;
}): Promise<ResultadoTeste> {
  const ctx = await getTenantContext();
  if (!ctx) return { ok: false, mensagem: "Sessão expirada. Entre de novo." };

  const nome = entrada.nome.trim();
  if (!nome) return { ok: false, mensagem: "Diga o nome de quem vai atender: é a primeira coisa que o agente fala." };
  if (!telefoneParaPlanilha(entrada.telefone)) {
    return { ok: false, mensagem: `Telefone inválido: ${entrada.telefone || "vazio"}. Use DDD + número.` };
  }

  const r = await dispararAgenteDeVoz({
    nome,
    telefone: entrada.telefone,
    email: entrada.email.trim() || null,
    empresa: entrada.empresa.trim() || null,
    origem: entrada.origem.trim() || null,
  });

  return {
    ok: r.ok,
    mensagem: r.ok
      ? "Ligação disparada. O telefone toca em alguns segundos; o resultado aparece no histórico da Callface e, se o número for de um lead, na ficha dele."
      : r.detalhe,
  };
}
