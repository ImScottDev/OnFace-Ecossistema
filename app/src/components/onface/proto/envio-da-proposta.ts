/* Regras puras do passo 5 (Revisão e envio) do Builder de Proposta.
   Sem React e sem banco: a página do servidor e a tela usam as mesmas funções, e o teste roda em node:test.

   1. DESTINATÁRIO: vem do contato da oportunidade pelo `lead_id` (pessoa com `lead_id_legado` = lead do negócio,
      depois o próprio lead). NUNCA por casamento de nome: "Scott" no lead e "Scott Fulano" na pessoa não casavam,
      e o e-mail e o telefone chegavam vazios na tela.
   2. GRAVADO || CONTATO: um rascunho que guardou `para`/`wa` vazios não pode esconder o contato real.
   3. SÓ DIZ "ENVIADA" DEPOIS DO SERVIDOR: `enviarConfirmando` só chama `sucesso` quando a gravação voltou `ok`.
      Com uma trava de reentrada: clique duplo não grava (nem cria proposta) duas vezes. */

export interface FonteDeContato { email?: string | null; telefone?: string | null; whatsapp?: string | null }
export interface Destinatario { email: string; telefone: string }

const limpa = (v: string | null | undefined) => (v ?? "").trim();

/** Campo a campo, a primeira fonte que tem valor. O telefone prefere o WhatsApp do cadastro. */
export function destinatarioDe(...fontes: Array<FonteDeContato | null | undefined>): Destinatario {
  let email = "", telefone = "";
  for (const f of fontes) {
    if (!f) continue;
    if (!email) email = limpa(f.email);
    if (!telefone) telefone = limpa(f.whatsapp) || limpa(f.telefone);
  }
  return { email, telefone };
}

/** O contato do negócio: a pessoa cujo `leadId` é o do negócio (nunca pelo nome), e o lead como reserva. */
export function destinatarioDoLead(
  leadId: string | null | undefined,
  pessoas: Array<FonteDeContato & { leadId?: string | null }>,
  lead?: FonteDeContato | null,
): Destinatario {
  const pessoa = leadId ? pessoas.find((p) => p.leadId === leadId) : undefined;
  return destinatarioDe(pessoa, lead);
}

/** `gravado || contato`: só preenche o que está vazio; o que o vendedor digitou fica. */
export function comDestinatario<T extends { para?: string; wa?: string; sigs?: Array<{ nome?: string; email?: string }> }>(d: T, dest: Destinatario): T {
  const sigs = d.sigs && d.sigs.length
    ? d.sigs.map((s, i) => (i === 0 && !limpa(s.email) ? { ...s, email: dest.email } : s))
    : d.sigs;
  return { ...d, para: limpa(d.para) || dest.email, wa: limpa(d.wa) || dest.telefone, ...(sigs ? { sigs } : {}) };
}

/* ── Envio ─────────────────────────────────────────────────────────────── */

export interface AvisoDoEnvio {
  email?: string; destinatario?: string | null; emailVia?: "conta" | "resend" | null; emailDe?: string | null; avisoEmail?: string | null;
  whatsapp?: string; whatsappErro?: string | null;
}

/** O que REALMENTE saiu, em frases para a tela e para o aviso. `falhou` = algo que o vendedor pediu e não saiu. */
export function resumoDoEnvio(a: AvisoDoEnvio | null | undefined): { linhas: string[]; falhou: boolean } {
  const linhas: string[] = [];
  let falhou = false;
  if (!a) return { linhas: ["Proposta enviada."], falhou: false };
  if (a.email === "enviado") {
    linhas.push(a.emailVia === "conta"
      ? `E-mail enviado para ${a.destinatario} pela sua caixa${a.emailDe ? ` (${a.emailDe})` : ""}. A entrega não é confirmada por esse tipo de caixa: se o cliente não responder, confira o endereço.`
      : `E-mail aceito pelo provedor para ${a.destinatario}, pelo e-mail do sistema: você não tem caixa conectada, e as respostas voltam para o seu e-mail. A entrega (ou recusa) aparece na proposta em "E-mails enviados".`);
    if (a.avisoEmail) linhas.push(a.avisoEmail);
  } else if (a.email === "sem_destinatario") { linhas.push("E-mail NÃO enviado: o contato não tem e-mail."); falhou = true; }
  else if (a.email === "sem_provedor") { linhas.push("E-mail NÃO enviado: provedor de e-mail não configurado."); falhou = true; }
  else if (a.email === "falhou") { linhas.push("E-mail NÃO enviado: falha no envio."); falhou = true; }
  if (a.whatsapp === "enviado") linhas.push("WhatsApp enviado pelo seu número do Atendimento.");
  else if (a.whatsapp && a.whatsapp !== "nao_solicitado") {
    const motivo = a.whatsapp === "sem_sessao" ? "você não tem um número de WhatsApp conectado"
      : a.whatsapp === "desconectada" ? "o seu número está desconectado"
      : a.whatsapp === "sem_telefone" ? "o contato não tem número válido"
      : (a.whatsappErro || "falha no envio");
    linhas.push(`WhatsApp NÃO enviado: ${motivo}. Nada saiu por outro número.`);
    falhou = true;
  }
  if (!linhas.length) linhas.push("Só o link: nenhuma mensagem foi enviada. Copie o link na página da proposta.");
  return { linhas, falhou };
}

export type ResultadoDaGravacao = { ok: true; [k: string]: unknown } | { ok: false; erro: string; [k: string]: unknown };

/**
 * Roda a gravação/envio com trava de reentrada. `sucesso` (que mostra "Proposta enviada") só é chamado com
 * `ok: true` vindo do servidor; erro, ou exceção, chama `erro` e solta a trava para tentar de novo.
 */
export async function enviarConfirmando<R extends ResultadoDaGravacao>(
  trava: { ocupado: boolean },
  executar: () => Promise<R>,
  hooks: { inicio: () => void; sucesso: (r: Extract<R, { ok: true }>) => void; erro: (mensagem: string, r?: R) => void },
): Promise<"ok" | "erro" | "ocupado"> {
  if (trava.ocupado) return "ocupado";
  trava.ocupado = true;
  hooks.inicio();
  try {
    const r = await executar();
    if (r.ok) { hooks.sucesso(r as Extract<R, { ok: true }>); return "ok"; }
    hooks.erro(r.erro, r);
    return "erro";
  } catch (e) {
    hooks.erro(e instanceof Error ? e.message : "Não consegui falar com o servidor.");
    return "erro";
  } finally {
    trava.ocupado = false;
  }
}
