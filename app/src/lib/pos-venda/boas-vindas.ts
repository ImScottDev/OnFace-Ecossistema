/**
 * E-mail de boas-vindas do onboarding. O TEXTO vive em `email_templates` (nome "Onboarding - boas-vindas", semeado pela
 * migration 0144 e editável em Ajustes > E-mail > Modelos); nada de texto em código.
 *
 * Envio: caixa conectada do responsável (Microsoft/Google) e, sem conta conectada, Resend com reply-to do responsável
 * (regra do Scott de 13/10). RD Station não entra: o módulo dele é só de entrada.
 *
 * NÃO ESTÁ LIGADO AO GANHO. O link do e-mail tem de cair no endpoint de agendamento do ONFACE (para a reunião marcar a
 * tarefa como feita), e esse endpoint público para o onboarding ainda não existe. Enviar com link morto seria pior que
 * não enviar. Quando existir, o motor chama `enviarBoasVindas` passando o link.
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { emailTemplates, usuarios } from "@/lib/db/schema";
import { interpolateTemplate } from "@/lib/email/template-engine";
import { enviarPelaCaixaDoUsuario } from "@/lib/email/enviar-como-usuario";
import { isResendConfigured, sendResendEmail } from "@/lib/email/resend";

export const MODELO_BOAS_VINDAS = "Onboarding - boas-vindas";

export interface VariaveisBoasVindas { nome: string; empresa: string; responsavel: string; link_agendamento: string }

/** Pura: troca as variáveis. Variável sem valor fica como `{{x}}` (visível), nunca some em silêncio. */
export function renderizarModelo(modelo: { assunto: string; corpo: string }, v: VariaveisBoasVindas): { assunto: string; html: string } {
  return { assunto: interpolateTemplate(modelo.assunto, { ...v }), html: interpolateTemplate(modelo.corpo, { ...v }) };
}

export type ResultadoBoasVindas =
  | { enviado: true; via: "caixa_do_responsavel" | "resend" }
  | { enviado: false; motivo: string };

export async function enviarBoasVindas(p: {
  organizacaoId: string; responsavelId: string; para: string; vars: VariaveisBoasVindas;
}): Promise<ResultadoBoasVindas> {
  const [modelo] = await db.select({ assunto: emailTemplates.assunto, corpo: emailTemplates.corpo }).from(emailTemplates)
    .where(and(eq(emailTemplates.organizacaoId, p.organizacaoId), eq(emailTemplates.nome, MODELO_BOAS_VINDAS))).limit(1);
  if (!modelo) return { enviado: false, motivo: `modelo "${MODELO_BOAS_VINDAS}" não existe nesta organização` };
  const { assunto, html } = renderizarModelo(modelo, p.vars);

  const pelaCaixa = await enviarPelaCaixaDoUsuario({ organizacaoId: p.organizacaoId, userId: p.responsavelId, para: p.para, assunto, html });
  if (pelaCaixa?.enviado) return { enviado: true, via: "caixa_do_responsavel" };
  if (pelaCaixa && !pelaCaixa.enviado) return { enviado: false, motivo: `a caixa do responsável recusou: ${pelaCaixa.erro}` };

  if (!isResendConfigured()) return { enviado: false, motivo: "responsável sem caixa conectada e Resend não configurado" };
  const [u] = await db.select({ email: usuarios.email }).from(usuarios)
    .where(and(eq(usuarios.id, p.responsavelId), eq(usuarios.organizacaoId, p.organizacaoId))).limit(1);
  const r = await sendResendEmail({ to: p.para, subject: assunto, html, replyTo: u?.email ?? undefined });
  return r.sent ? { enviado: true, via: "resend" } : { enviado: false, motivo: r.error ?? "Resend não enviou" };
}
